import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'node_modules', 'skinview3d');
const bundleCandidates = [
  path.join(packageRoot, 'bundles', 'skinview3d.bundle.min.js'),
  path.join(packageRoot, 'bundles', 'skinview3d.bundle.js')
];
const bundle = bundleCandidates.find((candidate) => fs.existsSync(candidate));
const license = path.join(packageRoot, 'LICENSE');
const destination = path.join(root, 'src', 'renderer', 'vendor');

if (!fs.existsSync(packageRoot)) {
  throw new Error('skinview3d is not installed. Run npm install successfully before building Prime Launcher.');
}

if (!bundle) {
  throw new Error(
    'skinview3d was installed, but its browser bundle was not found in node_modules/skinview3d/bundles/. ' +
    'Check the installed skinview3d package contents before building.'
  );
}

fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(bundle, path.join(destination, 'skinview3d.bundle.min.js'));

if (fs.existsSync(license)) {
  fs.copyFileSync(license, path.join(destination, 'skinview3d.LICENSE'));
}

console.log(`Copied skinview3d browser bundle from ${path.relative(root, bundle)} into src/renderer/vendor/.`);
