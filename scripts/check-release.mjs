import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const allowed = JSON.parse(await readFile('scripts/release-files.json', 'utf8'));
const generated = ['dist/index.js', 'dist/index.d.ts'];
const patterns = [
  ['private key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['provider token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/],
  ['AWS key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['credential URL', /https?:\/\/[^\s/]+:[^\s/]+@/],
  ['private source name', new RegExp('relay' + '-notes')],
  ['local absolute path', /\/(?:workspace|home\/agent|Users)\//],
];
function inspect(path, content) {
  if (content.includes('\0')) throw new Error(`Binary content in ${path}`);
  for (const [label, regex] of patterns) if (regex.test(content)) throw new Error(`${label} pattern in ${path}; inspect privately`);
}
const ignored = new Set(['.git', 'node_modules', 'dist', 'site', 'coverage']);
async function walk(directory = '.') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === '.' && ignored.has(entry.name)) continue;
    const path = directory === '.' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${path}`);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (!entry.name.endsWith('.tgz')) result.push(path);
  }
  return result;
}
for (const path of await walk()) if (!allowed.includes(path)) throw new Error(`Not in release whitelist: ${path}`);
const hashes = {};
for (const path of [...allowed, ...generated]) {
  const bytes = await readFile(path);
  inspect(path, bytes.toString('utf8'));
  hashes[path] = createHash('sha256').update(bytes).digest('hex');
}
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
if (Object.keys(manifest.dependencies ?? {}).length) throw new Error('Runtime dependencies require a new license review');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
for (const [name, value] of Object.entries(lock.packages)) {
  if (!name) continue;
  if (!value.dev || value.license !== 'Apache-2.0' || !value.resolved.startsWith('https://registry.npmjs.org/') || !value.integrity?.startsWith('sha512-')) throw new Error(`Review dependency ${name}`);
}
const expectedPackage = ['dist/index.js','dist/index.d.ts','src/index.ts','LICENSE','README.md','README.zh-CN.md','docs/semantics.md','docs/third-party-notices.md'];
if (JSON.stringify(manifest.files) !== JSON.stringify(expectedPackage)) throw new Error('Review package whitelist');
let commits = [];
try {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (root === process.cwd()) commits = execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch { /* Source archives have no Git history. */ }
for (const commit of commits) {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', commit], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const path of paths) {
    if (!allowed.includes(path)) throw new Error(`Historical path outside whitelist: ${path}`);
    inspect(`${commit.slice(0, 8)}:${path}`, execFileSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8' }));
  }
}
console.log(`Release whitelist and pattern scan passed: ${allowed.length} source files, ${generated.length} build files, ${commits.length} historical commits. No runtime dependencies.`);
if (process.argv.includes('--hashes')) console.log(JSON.stringify(hashes, null, 2));
