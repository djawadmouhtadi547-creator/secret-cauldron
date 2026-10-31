import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import * as contentHub from '../src/renderer/pages/content-hub.js';
import * as servers from '../src/renderer/pages/servers.js';
import * as customization from '../src/renderer/pages/customization.js';
import * as library from '../src/renderer/pages/library.js';
import * as instance from '../src/renderer/pages/instance.js';
import * as settings from '../src/renderer/pages/settings.js';
import { renderNewInstanceModal } from '../src/renderer/modals/new-instance.js';
import { renderInstanceSettingsModal } from '../src/renderer/modals/instance-settings.js';
import { escapeHtml } from '../src/renderer/components/ui.js';
import { normalizeResolution } from '../src/main/launch-arguments.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const t = (key) => key;

const demoInstance = {
  id: 'test-instance',
  name: 'Prime Test',
  version: '1.21.1',
  loader: 'fabric',
  loaderVersion: '0.16.0',
  status: 'ready',
  linkedPack: null
};

test('Arabic and English dictionaries contain the same non-empty string keys', () => {
  const ar = JSON.parse(read('src/renderer/i18n/ar.json'));
  const en = JSON.parse(read('src/renderer/i18n/en.json'));
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  assert.ok(Object.keys(ar).length >= 450);
  const manifest = JSON.parse(read('package.json'));
  assert.equal(ar.version, manifest.version);
  assert.equal(en.version, manifest.version);
  for (const [key, value] of Object.entries(ar)) assert.equal(typeof value, 'string', `ar.${key}`);
  for (const [key, value] of Object.entries(en)) assert.equal(typeof value, 'string', `en.${key}`);
});

test('all phase-three page and modal renderers return valid HTML strings', () => {
  const outputs = [
    contentHub.render(t),
    servers.render(t),
    customization.render(t),
    library.render(t),
    instance.render(t),
    settings.render(t),
    renderNewInstanceModal(t),
    renderInstanceSettingsModal(t, demoInstance)
  ];
  for (const html of outputs) {
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 50);
    assert.match(html, /^</);
  }
  assert.match(outputs[6], /data-form="new-instance"/);
  assert.match(outputs[6], /data-ni-versions/);
  assert.match(outputs[7], /data-istab="general"/);
});

test('renderer escapes untrusted text before inserting it into HTML', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('native modpack import picker is documented, exposed and handled', () => {
  const contract = read('docs/API_CONTRACT.md');
  const preload = read('src/preload/index.mjs');
  const main = read('src/main/ipc.js');
  const libraryPage = read('src/renderer/pages/library.js');
  assert.match(contract, /prime\.instances\.selectImportFile\(\).*instances:select-import-file/);
  assert.match(preload, /selectImportFile:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('instances:select-import-file'\)/);
  assert.match(main, /safeHandler\('instances:select-import-file'/);
  assert.match(libraryPage, /window\.prime\.instances\.selectImportFile\(\)/);
  assert.match(libraryPage, /window\.prime\.instances\.import\(\{\s*filePath:/);
});

test('skin viewer bundle is prepared locally during dependency installation', () => {
  const pkg = JSON.parse(read('package.json'));
  const html = read('src/renderer/index.html');
  const customizationPage = read('src/renderer/pages/customization.js');
  assert.equal(pkg.dependencies.skinview3d, '3.4.2');
  assert.equal(pkg.scripts.postinstall, 'node scripts/copy-vendor-assets.js');
  assert.match(html, /vendor\/skinview3d\.bundle\.min\.js/);
  assert.match(html, /img-src[^>]*http:\/\/127\.0\.0\.1:\*/);
  assert.match(html, /connect-src[^>]*http:\/\/127\.0\.0\.1:\*/);
  assert.match(customizationPage, /window\.skinview3d \|\| window\.SkinView3D/);
  assert.ok(fs.existsSync(path.join(root, 'THIRD_PARTY_NOTICES.md')));
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')));
});

test('modern Minecraft launch arguments use base metadata and validated resolution tokens', () => {
  const launch = read('src/main/launch.js');
  assert.match(launch, /argumentValues\(baseMetadata\.arguments\?\.game, features\)/);
  assert.doesNotMatch(launch, /base\.metadata\.arguments/);
  assert.match(launch, /normalizeResolution\(instanceOptions\)/);
  assert.deepEqual(normalizeResolution({ overrideWidth: '1600', overrideHeight: '900' }), { width: 1600, height: 900, overrideWidth: 1600, overrideHeight: 900 });
  assert.deepEqual(normalizeResolution({ overrideWidth: '1600; --server evil', overrideHeight: '-1' }), { width: 1280, height: 720, overrideWidth: null, overrideHeight: null });
  assert.deepEqual(normalizeResolution({ overrideWidth: '1600' }), { width: 1600, height: 720, overrideWidth: 1600, overrideHeight: null });
  assert.match(launch, /resolutionWidth: resolution\.width/);
  assert.match(launch, /resolutionHeight: resolution\.height/);
  assert.match(launch, /resolution\.overrideWidth !== null/);
  assert.match(launch, /resolution\.overrideHeight !== null/);
});

test('project consistency checker passes', () => {
  const result = spawnSync(process.execPath, ['scripts/check-project.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('instance Java and memory settings are persisted and consumed by the launch engine', () => {
  const modal = read('src/renderer/modals/instance-settings.js');
  const instancesMain = read('src/main/instances.js');
  const launchMain = read('src/main/launch.js');
  const settingsPage = read('src/renderer/pages/settings.js');
  assert.match(modal, /data-option-field="memoryAllocation"/);
  assert.match(modal, /data-option-field="javaPath"/);
  assert.match(modal, /data-option-field="jvmArgs"/);
  assert.match(instancesMain, /prime-options\.json/);
  assert.match(launchMain, /readOptions\(instance\.id\)/);
  assert.match(launchMain, /resolveJava\(baseMetadata, customJavaPath\)/);
  assert.match(launchMain, /-Xmx\$\{maxMemory\}M/);
  assert.match(settingsPage, /data-java-install/);
  assert.match(settingsPage, /data-java-remove/);
});


test('IPC handlers reject non-main-frame and non-file renderer requests', () => {
  const ipc = read('src/main/ipc.js');
  assert.match(ipc, /function isTrustedRenderer\(event\)/);
  assert.match(ipc, /event\.sender !== mainWindow\.webContents/);
  assert.match(ipc, /event\.senderFrame\.parent !== null/);
  assert.match(ipc, /event\.senderFrame\.url === rendererEntryUrl/);
  assert.match(ipc, /rendererEntryUrl = pathToFileURL/);
  assert.match(ipc, /UNTRUSTED_RENDERER/);
});

test('public repository keeps service credentials out of tracked key templates', () => {
  const keys = JSON.parse(read('keys.json'));
  const localExample = JSON.parse(read('keys.local.example.json'));
  for (const item of [keys, localExample]) {
    assert.equal(item.azureClientId, '');
    assert.equal(item.curseForgeApiKey, '');
  }
  assert.match(read('.gitignore'), /^keys\.local\.json$/m);
  assert.match(read('src/main/ipc.js'), /PRIME_AZURE_CLIENT_ID/);
  assert.match(read('src/main/ipc.js'), /PRIME_CURSEFORGE_API_KEY/);
  assert.match(read('package.json'), /0\.4\.0-beta\.1/);
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.devDependencies.electron, '45.2.1');
  assert.equal(manifest.devDependencies['electron-builder'], '26.18.1');
  assert.equal(manifest.engines.node, '>=22.12.0');
});

test('GitHub tag releases build both desktop targets and publish installers', () => {
  const workflow = read('.github/workflows/build.yml');
  assert.match(workflow, /tags: \['v\*'\]/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /softprops\/action-gh-release@v2/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /RELEASE_TAG/);
  assert.ok(fs.existsSync(path.join(root, '.github/dependabot.yml')));
});

test('Electron renderer policy locks navigation and denies insecure external windows', () => {
  const main = read('src/main/index.js');
  const html = read('src/renderer/index.html');
  assert.match(main, /will-navigate/);
  assert.match(main, /external\.protocol === 'https:'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /frame-src 'none'/);
});
