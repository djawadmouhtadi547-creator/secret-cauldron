import fs from 'node:fs';
import path from 'node:path';
import { getStorageRoot } from './state.js';
import { downloadFile, downloadMany } from './downloader.js';
import { getVersionMetadata } from './versions.js';
import { LauncherError } from './errors.js';

const LIBRARY_MAVEN = 'https://libraries.minecraft.net/';

export function platformName(platform = process.platform) {
  return platform === 'win32' ? 'windows' : platform === 'darwin' ? 'osx' : 'linux';
}

function osVersionMatches(rule) {
  if (!rule?.version) return true;
  try {
    return new RegExp(rule.version).test(process.getSystemVersion?.() || '');
  } catch {
    return false;
  }
}

export function rulesAllow(rules, features = {}) {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    const osMatches = !rule.os || (
      (!rule.os.name || rule.os.name === platformName())
      && (!rule.os.arch || rule.os.arch === process.arch)
      && osVersionMatches(rule.os)
    );
    const featureMatches = Object.entries(rule.features || {}).every(([key, value]) => features[key] === value);
    if (osMatches && featureMatches) allowed = rule.action === 'allow';
  }
  return allowed;
}

function mavenPath(coordinate) {
  const [group, artifact, version, classifier = ''] = coordinate.split(':');
  if (!group || !artifact || !version) throw new LauncherError('INVALID_LIBRARY', `Invalid Maven library coordinate: ${coordinate}`);
  const extensionSplit = classifier.split('@');
  const classifierName = extensionSplit[0];
  const extension = extensionSplit[1] || 'jar';
  const base = `${artifact}-${version}${classifierName ? `-${classifierName}` : ''}.${extension}`;
  return `${group.replaceAll('.', '/')}/${artifact}/${version}/${base}`;
}

function nativeClassifier(library) {
  const classifier = library.natives?.[platformName()];
  if (!classifier) return null;
  return classifier.replaceAll('${arch}', process.arch === 'ia32' ? '32' : '64');
}

function libraryDownload(library) {
  const artifact = library.downloads?.artifact;
  if (artifact?.url && artifact.path) {
    return { url: artifact.url, destination: path.join(getStorageRoot(), 'libraries', artifact.path), sha1: artifact.sha1, size: artifact.size };
  }
  const coordinate = library.name;
  const relative = mavenPath(coordinate);
  const [group, artifactName, version] = coordinate.split(':');
  const base = path.posix.basename(relative);
  return {
    url: `${library.url || LIBRARY_MAVEN}${relative}`,
    destination: path.join(getStorageRoot(), 'libraries', group.replaceAll('.', path.sep), artifactName, version, base),
    sha1: null,
    size: null
  };
}

export function getLibraryTasks(libraries = [], features = {}) {
  const artifacts = [];
  const natives = [];
  for (const library of libraries) {
    if (!rulesAllow(library.rules, features)) continue;
    if (library.name) {
      const artifact = libraryDownload(library);
      if (artifact?.url && artifact?.destination) artifacts.push(artifact);
    }
    const native = nativeDownload(library);
    if (native?.url && native?.destination) natives.push(native);
  }
  return { artifacts, natives };
}

function nativeDownload(library) {
  const classifier = nativeClassifier(library);
  if (!classifier) return null;
  const artifact = library.downloads?.classifiers?.[classifier];
  if (artifact?.url && artifact.path) {
    return { url: artifact.url, destination: path.join(getStorageRoot(), 'libraries', artifact.path), sha1: artifact.sha1, size: artifact.size };
  }
  const coordinate = library.name.split(':').slice(0, 3).join(':') + `:${classifier}`;
  const relative = mavenPath(coordinate);
  const [group, artifactName, version] = coordinate.split(':');
  return {
    url: `${library.url || LIBRARY_MAVEN}${relative}`,
    destination: path.join(getStorageRoot(), 'libraries', group.replaceAll('.', path.sep), artifactName, version, path.posix.basename(relative)),
    sha1: null,
    size: null
  };
}

function assetTasks(index) {
  if (!index?.objects || typeof index.objects !== 'object') return [];
  return Object.values(index.objects).map((object) => {
    if (!/^[a-f0-9]{40}$/i.test(object.hash)) throw new LauncherError('INVALID_ASSET_INDEX', 'Mojang returned an invalid asset hash.');
    return {
      url: `https://resources.download.minecraft.net/${object.hash.slice(0, 2)}/${object.hash}`,
      destination: path.join(getStorageRoot(), 'assets', 'objects', object.hash.slice(0, 2), object.hash),
      sha1: object.hash,
      size: object.size
    };
  });
}

export async function installBaseVersion(versionId, options = {}) {
  const root = getStorageRoot();
  const metadata = await getVersionMetadata(versionId);
  const versionDirectory = path.join(root, 'versions', versionId);
  const versionJson = path.join(versionDirectory, `${versionId}.json`);
  const client = metadata.downloads?.client;
  if (!client?.url || !client.sha1) throw new LauncherError('VERSION_CLIENT_MISSING', `Minecraft ${versionId} has no verified client download.`);
  await fs.promises.mkdir(versionDirectory, { recursive: true });
  const jarDestination = path.join(versionDirectory, `${versionId}.jar`);
  const directTasks = [{
    url: client.url,
    destination: jarDestination,
    sha1: client.sha1,
    size: client.size
  }];

  const libraries = (metadata.libraries || []).filter((library) => rulesAllow(library.rules, options.features));
  const libraryTasks = getLibraryTasks(libraries);
  directTasks.push(...libraryTasks.artifacts, ...libraryTasks.natives);
  const nativeTasks = libraryTasks.natives.map((task) => task.destination);

  let assetIndex = null;
  let assetIndexFile = null;
  if (metadata.assetIndex?.url) {
    const response = await fetch(metadata.assetIndex.url, { signal: options.signal });
    if (!response.ok) throw new LauncherError('ASSET_INDEX_FAILED', `Minecraft asset index failed with HTTP ${response.status}.`);
    assetIndex = await response.json();
    assetIndexFile = path.join(root, 'assets', 'indexes', `${metadata.assetIndex.id}.json`);
    await fs.promises.mkdir(path.dirname(assetIndexFile), { recursive: true });
    await fs.promises.writeFile(assetIndexFile, JSON.stringify(assetIndex));
  }

  const allTasks = [...new Map(directTasks.map((task) => [task.destination, task])).values()];
  const filesTotal = allTasks.length;
  let filesComplete = 0;
  await downloadMany(allTasks, {
    concurrency: 8,
    signal: options.signal,
    stage: 'minecraft_files',
    onProgress: (progress) => {
      options.onProgress?.({
        percent: filesTotal ? Math.floor((Math.min(filesTotal, filesComplete + progress.percent / 100) / filesTotal) * 72) + 8 : 80,
        stage: 'minecraft_files'
      });
      if (progress.percent === 100) filesComplete += 1;
    }
  });

  if (assetIndex) {
    const objects = assetTasks(assetIndex);
    await downloadMany(objects, {
      concurrency: 12,
      signal: options.signal,
      stage: 'assets',
      onProgress: (progress) => options.onProgress?.({ percent: 80 + Math.floor(progress.percent * 0.18), stage: 'assets' })
    });
    if (assetIndex.map_to_resources) {
      const virtualRoot = path.join(root, 'assets', 'virtual', 'legacy');
      await fs.promises.mkdir(virtualRoot, { recursive: true });
      const mappings = Object.entries(assetIndex.objects).map(([name, object]) => ({
        name,
        source: path.join(root, 'assets', 'objects', object.hash.slice(0, 2), object.hash)
      }));
      await Promise.all(mappings.map(async ({ name, source }) => {
        const destination = path.resolve(virtualRoot, ...name.split('/'));
        if (!destination.startsWith(`${path.resolve(virtualRoot)}${path.sep}`)) {
          throw new LauncherError('INVALID_ASSET_INDEX', 'Mojang returned an invalid legacy asset path.');
        }
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.copyFile(source, destination);
      }));
    }
  }
  await fs.promises.writeFile(versionJson, JSON.stringify(metadata, null, 2));
  options.onProgress?.({ percent: 99, stage: 'version_ready' });
  return {
    metadata,
    versionDirectory,
    versionJson,
    jarPath: jarDestination,
    libraryPaths: libraryTasks.artifacts.map((task) => task.destination),
    nativePaths: nativeTasks
  };
}

export async function readVersionJson(versionId) {
  const metadata = await getVersionMetadata(versionId);
  return metadata;
}

export function getGameRoot(instanceId) {
  if (!/^[\w-]{1,100}$/.test(instanceId)) throw new LauncherError('INVALID_INSTANCE_ID', 'Instance ID is invalid.');
  return path.join(getStorageRoot(), 'instances', instanceId);
}
