import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

for (const file of ['keys.json', 'keys.local.example.json']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`Missing key template: ${file}`);
    continue;
  }
  try {
    const value = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const key of ['azureClientId', 'curseForgeApiKey']) {
      if (typeof value[key] !== 'string') errors.push(`${file}: ${key} must be a string.`);
      else if (value[key].trim()) errors.push(`${file}: ${key} must remain blank in the public repository.`);
    }
  } catch {
    errors.push(`${file}: invalid JSON.`);
  }
}

const candidates = [
  'src', 'assets', 'docs', '.github', 'README.md', 'HANDOFF.md', 'CHANGELOG.md',
  'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'HANDOFF.md', 'PHASE4_HANDOFF.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json'
];
const secretPatterns = [
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
];

function inspect(file) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(file)) inspect(path.join(file, entry));
    return;
  }
  if (stat.size > 2_000_000) return;
  const source = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(source)) errors.push(`${path.relative(root, file)} may contain ${label}.`);
  }
}

for (const candidate of candidates) {
  const full = path.join(root, candidate);
  if (fs.existsSync(full)) inspect(full);
}

const ignoredLocalKeys = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).includes('keys.local.json');
if (!ignoredLocalKeys) errors.push('.gitignore must ignore keys.local.json.');

const trackedResult = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
if (trackedResult.status === 0) {
  const protectedFiles = trackedResult.stdout.split('\0').filter(Boolean).filter((file) =>
    /(^|\/)(?:keys\.local\.json|\.env(?:\..*)?|[^/]+\.(?:pem|p12|pfx))$/i.test(file)
  );
  if (protectedFiles.length) errors.push(`Sensitive local files must not be tracked: ${protectedFiles.join(', ')}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public key templates are blank; local credentials are ignored; no common secret patterns detected.');
}
