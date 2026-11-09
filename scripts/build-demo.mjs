import { mkdir, copyFile, readdir, lstat } from 'node:fs/promises';
const allowed = ['index.html', 'app.js', 'style.css', 'core.js', 'LICENSE.txt'];
await mkdir('site', { recursive: true });
if ((await lstat('site')).isSymbolicLink()) throw new Error('site/ must be a real output directory');
for (const entry of await readdir('site', { withFileTypes: true })) {
  if (!entry.isFile() || !allowed.includes(entry.name)) throw new Error(`Unexpected site/ entry: ${entry.name}; build in a clean output directory`);
}
for (const file of ['index.html', 'app.js', 'style.css']) await copyFile(`demo/${file}`, `site/${file}`);
await copyFile('dist/index.js', 'site/core.js');
await copyFile('LICENSE', 'site/LICENSE.txt');
console.log('Static demo built in site/ (five-file whitelist verified)');
