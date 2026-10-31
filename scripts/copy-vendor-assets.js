import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'node_modules', 'skinview3d');
const bundle = path.join(packageRoot, 'bundles', 'skinview3d.bundle.min.js');
const license = path.join(packageRoot, 'LICENSE');
const destination = path.join(root, 'src', 'renderer', 'vendor');

if (!fs.existsSync(bundle)) {
  throw new Error('skinview3d bundle is missing. Run npm install before packaging Prime Launcher.');
}
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(bundle, path.join(destination, 'skinview3d.bundle.min.js'));
if (fs.existsSync(license)) fs.copyFileSync(license, path.join(destination, 'skinview3d.LICENSE'));
console.log('Copied skinview3d 3.4.2 browser bundle and license into src/renderer/vendor/.');
