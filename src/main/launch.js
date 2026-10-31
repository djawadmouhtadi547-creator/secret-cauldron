import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getState, getStorageRoot } from './state.js';
import { getInstance, getInstancePath, readOptions } from './instances.js';
import { ensureInstalled, locateProfile } from './install.js';
import { installBaseVersion, getLibraryTasks, rulesAllow } from './gameFiles.js';
import { resolveJava } from './java.js';
import { extractZip } from './archive.js';
import { startPlaySession, endPlaySession } from './playtime.js';
import { LauncherError } from './errors.js';
import { normalizeResolution } from './launch-arguments.js';

function legacyArguments(raw) {
  const matches = String(raw || '').match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]+/g) || [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, '').replaceAll('\\"', '"'));
}

function argumentValues(values, features, result = []) {
  for (const entry of values || []) {
    if (typeof entry === 'string') {
      result.push(entry);
    } else if (entry && typeof entry === 'object' && rulesAllow(entry.rules, features)) {
      if (Array.isArray(entry.value)) result.push(...entry.value.filter((value) => typeof value === 'string'));
      else if (typeof entry.value === 'string') result.push(entry.value);
    }
  }
  return result;
}

function resolveToken(argument, tokens) {
  return argument.replace(/\$\{([^}]+)\}/g, (_match, key) => String(tokens[key] ?? ''));
}


function deduplicateArgs(args) {
  const seen = new Set();
  return args.filter((argument) => {
    if (argument === '-cp' || argument === '-classpath' || argument === '${classpath}') return true;
    if (seen.has(argument)) return false;
    seen.add(argument);
    return true;
  });
}

function parseServer(address) {
  if (!address) return [];
  if (typeof address !== 'string' || address.length > 255 || /[\s\r\n]/.test(address)) {
    throw new LauncherError('INVALID_SERVER_ADDRESS', 'Server address must be a host name with an optional port.');
  }
  const match = address.match(/^\[([^\]]+)\](?::(\d{1,5}))?$/) || address.match(/^([^:]+)(?::(\d{1,5}))?$/);
  if (!match) throw new LauncherError('INVALID_SERVER_ADDRESS', 'Server address format is invalid.');
  const host = match[1];
  const port = match[2];
  if (port && (Number(port) < 1 || Number(port) > 65535)) throw new LauncherError('INVALID_SERVER_ADDRESS', 'Server port must be between 1 and 65535.');
  return ['--server', host, ...(port ? ['--port', port] : [])];
}

function buildTokens({ instance, profileId, base, account, token, gameDirectory, nativeDirectory, classpath, clientId, resolutionWidth, resolutionHeight }) {
  return {
    auth_player_name: account.username,
    version_name: profileId,
    game_directory: gameDirectory,
    assets_root: path.join(getStorageRoot(), 'assets'),
    assets_index_name: base.assetIndex?.id || base.assets || '',
    auth_uuid: account.uuid,
    auth_access_token: token,
    clientid: clientId || '',
    auth_xuid: account.xuid || '',
    user_type: account.type === 'microsoft' ? 'msa' : 'legacy',
    version_type: base.type || 'release',
    natives_directory: nativeDirectory,
    library_directory: path.join(getStorageRoot(), 'libraries'),
    classpath,
    classpath_separator: path.delimiter,
    launcher_name: 'Prime Launcher',
    launcher_version: '0.4.0-beta.1',
    user_properties: '{}',
    game_assets: base.assetIndex?.map_to_resources
      ? path.join(getStorageRoot(), 'assets', 'virtual', 'legacy')
      : path.join(getStorageRoot(), 'assets'),
    resolution_width: String(resolutionWidth || 1280),
    resolution_height: String(resolutionHeight || 720),
    quickPlayPath: '',
    quickPlaySingleplayer: '',
    quickPlayMultiplayer: '',
    quickPlayRealms: '',
    is_demo_user: 'false',
    version: instance.version
  };
}

async function extractNatives(instance, libraries, nativeDirectory) {
  const features = { has_custom_resolution: true, is_demo_user: false, has_quick_plays_support: true };
  const { natives } = getLibraryTasks(libraries.filter((library) => rulesAllow(library.rules)), features);
  await fs.promises.rm(nativeDirectory, { recursive: true, force: true });
  await fs.promises.mkdir(nativeDirectory, { recursive: true });
  for (const item of natives) {
    const file = item.destination;
    const exists = await fs.promises.stat(file).then((stat) => stat.isFile(), () => false);
    if (exists) await extractZip(file, nativeDirectory);
  }
}

async function composeLaunch(instance, account, accessToken, keys) {
  const instanceOptions = await readOptions(instance.id);
  const baseMetadata = await import('./versions.js').then(({ getVersionMetadata }) => getVersionMetadata(instance.version));
  const located = await locateProfile(instance);
  const profile = located.metadata;
  const profileId = located.profileId;
  const libraries = [
    ...(baseMetadata.libraries || []),
    ...(profile.id === baseMetadata.id ? [] : profile.libraries || [])
  ];
  const features = {
    has_custom_resolution: true,
    is_demo_user: false,
    has_quick_plays_support: true,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false
  };
  const artifacts = getLibraryTasks(libraries.filter((library) => rulesAllow(library.rules)), features).artifacts;
  const jarPath = path.join(getStorageRoot(), 'versions', instance.version, `${instance.version}.jar`);
  const classpath = [jarPath, ...artifacts.map((task) => task.destination)]
    .filter((file, index, all) => file && all.indexOf(file) === index)
    .join(path.delimiter);
  const gameDirectory = getInstancePath(instance.id);
  const nativeDirectory = path.join(gameDirectory, 'natives');
  const resolution = normalizeResolution(instanceOptions);
  await extractNatives(instance, libraries, nativeDirectory);
  const tokens = buildTokens({
    instance,
    profileId,
    base: baseMetadata,
    account,
    token: accessToken,
    gameDirectory,
    nativeDirectory,
    classpath,
    clientId: keys.azureClientId,
    resolutionWidth: resolution.width,
    resolutionHeight: resolution.height
  });

  const profileJvm = argumentValues(profile.arguments?.jvm, features);
  const baseJvm = profile.id === baseMetadata.id ? [] : argumentValues(baseMetadata.arguments?.jvm, features);
  const jvmRaw = [...baseJvm, ...profileJvm];
  const hasClasspath = jvmRaw.some((arg) => arg === '-cp' || arg === '-classpath' || arg === '${classpath}');
  const totalMemoryMb = Math.floor(os.totalmem() / (1024 * 1024));
  const automaticMemory = Math.max(1024, Math.min(8192, Math.floor(totalMemoryMb * 0.65)));
  const safeMemoryLimit = Math.max(512, Math.min(8192, Math.floor(totalMemoryMb * 0.8)));
  const requestedMemory = instanceOptions.memoryAllocation === 'auto' || !instanceOptions.memoryAllocation
    ? automaticMemory
    : Number(instanceOptions.memoryAllocation);
  const maxMemory = Number.isFinite(requestedMemory)
    ? Math.max(512, Math.min(safeMemoryLimit, Math.floor(requestedMemory)))
    : automaticMemory;
  const jvmArgs = jvmRaw.length
    ? jvmRaw.map((argument) => resolveToken(argument, tokens))
    : [
        `-Djava.library.path=${nativeDirectory}`,
        `-Dminecraft.launcher.brand=Prime Launcher`,
        `-Dminecraft.launcher.version=0.4.0-beta.1`,
        '-cp',
        classpath
      ];
  // Launcher-managed memory always wins over a profile's default -Xmx.
  for (let index = jvmArgs.length - 1; index >= 0; index -= 1) {
    if (/^-Xmx\d+[mMgG]?$/.test(jvmArgs[index])) jvmArgs.splice(index, 1);
  }
  jvmArgs.unshift(`-Xmx${maxMemory}M`);
  const extraJvmArgs = legacyArguments(instanceOptions.jvmArgs || '').filter((argument) =>
    !['-cp', '-classpath'].includes(argument)
    && !/^-Xmx\d+[mMgG]?$/i.test(argument)
    && !argument.startsWith('-Djava.library.path=')
  );
  jvmArgs.push(...extraJvmArgs);
  if (!hasClasspath) jvmArgs.push('-cp', classpath);
  if (!jvmArgs.some((argument) => argument.startsWith('-Djava.library.path='))) {
    jvmArgs.push(`-Djava.library.path=${nativeDirectory}`);
  }
  const gameRaw = profile.arguments
    ? [...argumentValues(baseMetadata.arguments?.game, features), ...argumentValues(profile.arguments.game, features)]
    : legacyArguments(profile.minecraftArguments || baseMetadata.minecraftArguments);
  const gameArgs = deduplicateArgs(gameRaw.map((argument) => resolveToken(argument, tokens)));
  if (resolution.overrideWidth !== null && !gameArgs.includes('--width')) gameArgs.push('--width', String(resolution.overrideWidth));
  if (resolution.overrideHeight !== null && !gameArgs.includes('--height')) gameArgs.push('--height', String(resolution.overrideHeight));
  if (instanceOptions.fullscreen === 'true' && !gameArgs.includes('--fullscreen')) gameArgs.push('--fullscreen');
  const customJavaPath = typeof instanceOptions.javaPath === 'string' && instanceOptions.javaPath.trim() ? instanceOptions.javaPath.trim() : null;
  const javaPath = await resolveJava(baseMetadata, customJavaPath);
  return { javaPath, jvmArgs, gameArgs, mainClass: profile.mainClass || baseMetadata.mainClass, gameDirectory, tokens, profileId };
}

async function createCrashReport(instanceId, sessionId, processResult) {
  const directory = getInstancePath(instanceId);
  const reportDirectory = path.join(directory, 'crash-reports');
  const outputDirectory = path.join(getStorageRoot(), 'logs', 'crashes');
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const files = await fs.promises.readdir(reportDirectory, { withFileTypes: true }).catch(() => []);
  const reports = await Promise.all(files.filter((entry) => entry.isFile()).map(async (entry) => {
    const file = path.join(reportDirectory, entry.name);
    const stats = await fs.promises.stat(file);
    return { file, mtime: stats.mtimeMs };
  }));
  reports.sort((a, b) => b.mtime - a.mtime);
  const crash = reports[0] ? await fs.promises.readFile(reports[0].file, 'utf8').then((text) => text.slice(0, 1_500_000), () => '') : '';
  const latestLog = await fs.promises.readFile(path.join(directory, 'logs', 'latest.log'), 'utf8').then((text) => text.slice(-800_000), () => '');
  const report = [
    'Prime Launcher crash report',
    `Instance: ${instanceId}`,
    `Session: ${sessionId}`,
    `Exit code: ${processResult.code ?? 'unknown'}`,
    `Signal: ${processResult.signal ?? 'none'}`,
    `Time: ${new Date().toISOString()}`,
    crash ? `\nMinecraft crash report:\n${crash}` : '\nMinecraft did not write a crash report.',
    latestLog ? `\nLatest log tail:\n${latestLog}` : '\nNo latest.log was available.'
  ].join('\n');
  const filePath = path.join(outputDirectory, `${instanceId}-${sessionId}.txt`);
  await fs.promises.writeFile(filePath, report, 'utf8');
  return filePath;
}

export function createLaunchEngine({ emit, appendLog, keys, refreshAccount }) {
  const sessions = new Map();
  const cancelled = new Set();

  async function start(instance, launchOptions = {}) {
    if (sessions.has(instance.id)) throw new LauncherError('INSTANCE_ALREADY_RUNNING', 'This instance is already running.');
    const account = getState().accounts.find((item) => item.active);
    if (!account) throw new LauncherError('ACCOUNT_REQUIRED', 'Add an offline or Microsoft account before launching Minecraft.');
    if (account.type === 'microsoft' && !account.connected) throw new LauncherError('ACCOUNT_DISCONNECTED', 'Reconnect this Microsoft account before launching Minecraft.');
    const sessionId = randomUUID();
    const abortController = new AbortController();
    const launchSession = { sessionId, process: null, abortController, started: false };
    sessions.set(instance.id, launchSession);
    try {
      const freshAccount = account.type === 'microsoft' ? await refreshAccount(account.id) : account;
      const accessToken = freshAccount.type === 'microsoft' ? freshAccount.accessToken : '0';
      const installed = await ensureInstalled(instance, {
        sessionId,
        signal: abortController.signal,
        onProgress: (payload) => emit('launch:progress', payload),
        onLog: (line) => appendLog('info', line.slice(0, 800), instance.id, sessionId)
      });
      if (cancelled.has(instance.id)) throw new LauncherError('CANCELLED', 'Minecraft launch was cancelled.');
      emit('launch:progress', { instanceId: instance.id, sessionId, percent: 100, stage: 'starting_java' });
      const plan = await composeLaunch(installed, freshAccount, accessToken, keys);
      const args = [...plan.jvmArgs, plan.mainClass, ...plan.gameArgs];
      if (installed.loader === 'forge' || installed.loader === 'neoforge') {
        // Installer profiles normally declare the classpath as JVM metadata.
        if (!plan.jvmArgs.includes('-cp') && !plan.jvmArgs.includes('-classpath')) {
          args.splice(plan.jvmArgs.length, 0, '-cp', plan.tokens.classpath);
        }
      }
      args.push(...parseServer(launchOptions.serverAddress));
      const child = spawn(plan.javaPath, args, {
        cwd: plan.gameDirectory,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      launchSession.process = child;
      launchSession.started = true;
      startPlaySession(instance.id, sessionId);
      emit('launch:progress', { instanceId: instance.id, sessionId, percent: 100, stage: 'launched' });
      appendLog('info', `Started ${installed.name} (${installed.loader} ${installed.version}) using Java.`, instance.id, sessionId);
      const consume = (stream, defaultLevel) => {
        let pending = '';
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => {
          pending += chunk;
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() || '';
          for (const line of lines) {
            if (line) appendLog(/\b(ERROR|FATAL|SEVERE)\b/i.test(line) ? 'error' : /\b(WARN|WARNING)\b/i.test(line) ? 'warn' : defaultLevel, line.slice(0, 4000), instance.id, sessionId);
          }
          if (pending.length > 8000) {
            appendLog(defaultLevel, pending.slice(0, 4000), instance.id, sessionId);
            pending = '';
          }
        });
        stream.once('end', () => {
          if (pending) appendLog(defaultLevel, pending.slice(0, 4000), instance.id, sessionId);
        });
      };
      if (child.stdout) consume(child.stdout, 'info');
      if (child.stderr) consume(child.stderr, 'warn');
      child.once('error', async (error) => {
        appendLog('error', `Minecraft process could not start: ${error.message}`, instance.id, sessionId);
        await finish(instance.id, sessionId, { code: null, signal: null, error });
      });
      child.once('close', (code, signal) => finish(instance.id, sessionId, { code, signal }).catch((error) => appendLog('error', error.message, instance.id, sessionId)));
      return { sessionId, status: 'started' };
    } catch (error) {
      sessions.delete(instance.id);
      cancelled.delete(instance.id);
      if (error?.code === 'CANCELLED') throw error;
      throw error;
    }
  }

  async function finish(instanceId, sessionId, result) {
    const session = sessions.get(instanceId);
    if (!session || session.sessionId !== sessionId) return;
    sessions.delete(instanceId);
    cancelled.delete(instanceId);
    endPlaySession(instanceId, sessionId);
    if (result.code !== 0) {
      const reportPath = await createCrashReport(instanceId, sessionId, result).catch(() => null);
      const details = result.error?.message || `Minecraft exited with code ${result.code ?? 'unknown'}${result.signal ? ` (${result.signal})` : ''}.`;
      appendLog('error', `${details}${reportPath ? ` Crash report: ${reportPath}` : ''}`, instanceId, sessionId);
    } else {
      appendLog('info', 'Minecraft closed normally.', instanceId, sessionId);
    }
  }

  function stop(instanceId) {
    const session = sessions.get(instanceId);
    if (!session) return false;
    cancelled.add(instanceId);
    session.abortController.abort(new LauncherError('CANCELLED', 'Minecraft launch was stopped.'));
    if (session.process && !session.process.killed) session.process.kill();
    if (!session.started) {
      sessions.delete(instanceId);
      cancelled.delete(instanceId);
    }
    return true;
  }

  function hasActive(instanceId) {
    return sessions.has(instanceId);
  }

  function dispose() {
    for (const [instanceId, session] of sessions) {
      session.abortController.abort(new LauncherError('CANCELLED', 'Prime Launcher is closing.'));
      if (session.process && !session.process.killed) session.process.kill();
      sessions.delete(instanceId);
    }
    cancelled.clear();
  }

  return { start, stop, hasActive, dispose };
}
