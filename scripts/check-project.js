import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|mjs)$/.test(entry.name)) {
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g)) {
        const specifier = match[2];
        if (!specifier.startsWith('.')) continue;
        const resolved = path.resolve(path.dirname(full), specifier);
        if (!fs.existsSync(resolved)) errors.push(`${path.relative(root, full)} imports missing ${specifier}`);
      }
      if (/TODO|FIXME|أكمل بنفسك/.test(source)) errors.push(`${path.relative(root, full)} contains a prohibited incomplete marker`);
    }
  }
}

walk(path.join(root, 'src'));

const iconDirectory = path.join(root, 'assets', 'icons');
const iconFiles = fs.readdirSync(iconDirectory).filter((file) => file.endsWith('.svg'));
for (const file of iconFiles) {
  const svg = fs.readFileSync(path.join(iconDirectory, file), 'utf8');
  if (!svg.includes('viewBox="0 0 24 24"') || !svg.includes('stroke-width="1.75"')) {
    errors.push(`Invalid icon geometry or stroke: ${file}`);
  }
}

for (const directory of ['src/renderer/pages', 'src/renderer/components', 'src/renderer/modals']) {
  for (const file of fs.readdirSync(path.join(root, directory))) {
    const full = path.join(root, directory, file);
    if (!file.endsWith('.js')) continue;
    const source = fs.readFileSync(full, 'utf8');
    for (const name of source.matchAll(/Icon\('([a-z0-9-]+)'/g)) {
      if (!fs.existsSync(path.join(iconDirectory, `${name[1]}.svg`))) {
        errors.push(`Missing SVG icon: ${name[1]} (used in ${path.relative(root, full)})`);
      }
    }
  }
}

const arabicPath = path.join(root, 'src/renderer/i18n/ar.json');
const englishPath = path.join(root, 'src/renderer/i18n/en.json');
let arabic;
let english;
try {
  arabic = JSON.parse(fs.readFileSync(arabicPath, 'utf8'));
  english = JSON.parse(fs.readFileSync(englishPath, 'utf8'));
  const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (arabic.version !== packageInfo.version || english.version !== packageInfo.version) {
    errors.push('The About screen version must match package.json.');
  }
  const arabicKeys = Object.keys(arabic).sort();
  const englishKeys = Object.keys(english).sort();
  if (JSON.stringify(arabicKeys) !== JSON.stringify(englishKeys)) errors.push('Arabic and English translation keys do not match.');
} catch {
  errors.push('Invalid JSON in renderer translation files.');
}

const contractPath = path.join(root, 'docs/API_CONTRACT.md');
const ipcPath = path.join(root, 'src/main/ipc.js');
const preloadPath = path.join(root, 'src/preload/index.mjs');
const contract = fs.readFileSync(contractPath, 'utf8');
const ipc = fs.readFileSync(ipcPath, 'utf8');
const preload = fs.readFileSync(preloadPath, 'utf8');
const allContractChannels = [...new Set([...contract.matchAll(/`([a-z]+:[a-z-]+)`/g)].map((match) => match[1]))];
const eventChannels = [...new Set([...contract.matchAll(/event `([a-z]+:[a-z-]+)`/g)].map((match) => match[1]))];
const requestChannels = allContractChannels.filter((channel) => !eventChannels.includes(channel));
const mainHandlers = [...new Set([...ipc.matchAll(/safeHandler\('([^']+)'/g)].map((match) => match[1]))];
const preloadChannels = [...new Set([...preload.matchAll(/(?:ipcRenderer\.invoke|invoke|subscribe)\('([^']+)'/g)].map((match) => match[1]))];
for (const channel of requestChannels) {
  if (!mainHandlers.includes(channel)) errors.push(`API contract channel has no main handler: ${channel}`);
  if (!preloadChannels.includes(channel)) errors.push(`API contract channel is not exposed in preload: ${channel}`);
}
for (const channel of eventChannels) {
  if (!preloadChannels.includes(channel)) errors.push(`API event is not exposed in preload: ${channel}`);
  const eventFiles = ['src/main/ipc.js', 'src/main/mock/launch.js'];
  if (!eventFiles.some((file) => fs.readFileSync(path.join(root, file), 'utf8').includes(`emit('${channel}'`))) {
    errors.push(`API event has no main-process emitter: ${channel}`);
  }
}
for (const channel of mainHandlers) {
  if (!requestChannels.includes(channel)) errors.push(`Main process has an undocumented IPC handler: ${channel}`);
}

for (const file of [
  'package.json', '.gitignore', 'keys.json', 'README.md', 'LICENSE', 'HANDOFF.md', 'CHANGELOG.md',
  'docs/API_CONTRACT.md', 'docs/ICONS.md', 'docs/TEST_REPORT.md', 'docs/RELEASE_CHECKLIST.md', 'docs/GITHUB_PUBLISH.md', 'THIRD_PARTY_NOTICES.md', 'scripts/copy-vendor-assets.js', 'scripts/check-syntax.js', 'scripts/check-secrets.js', '.github/workflows/build.yml', '.github/dependabot.yml', '.github/pull_request_template.md', '.editorconfig', '.gitattributes', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'CODE_OF_CONDUCT.md', 'PHASE4_HANDOFF.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml', 'keys.local.example.json', 'src/renderer/index.html'
]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Project structure, relative imports, ${arabic ? Object.keys(arabic).length : 0} i18n keys, ${requestChannels.length} IPC calls, ${eventChannels.length} events and ${iconFiles.length} SVG icons: OK`);
}
