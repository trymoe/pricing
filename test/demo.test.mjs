import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../demo/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../demo/app.js', import.meta.url), 'utf8');
const defaults = { input: '250000', output: '10000', time: '2026-06-01T04:00:00', currency: 'USD', fx: '7', scenario: 'base' };
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { value: defaults[id] ?? '', textContent: '', hidden: false, events: {}, addEventListener(type, callback) { this.events[type] = callback; } });
  return nodes.get(id);
};
node('calculator').reset = () => { for (const [id, value] of Object.entries(defaults)) node(id).value = value; };
globalThis.document = { getElementById: node };
const core = new URL('../dist/index.js', import.meta.url).href;
await import(`data:text/javascript;base64,${Buffer.from(source.replace("'./core.js'", JSON.stringify(core))).toString('base64')}`);
const change = (id, value) => { node(id).value = value; node('calculator').events.input(); };
test('demo shows the same core result, tier, time and promotion semantics', () => {
  assert.equal(node('total').textContent, '0.580000');
  change('scenario', 'tier'); assert.equal(node('total').textContent, '0.870000');
  change('scenario', 'time'); assert.equal(node('total').textContent, '1.120000');
  change('scenario', 'promotion'); assert.equal(node('total').textContent, '0.290000');
  change('time', '2026-06-02T00:00:00'); assert.equal(node('total').textContent, '0.580000');
});
test('demo hides stale estimates for blank/invalid input and resets all fields', () => {
  change('input', ''); assert.equal(node('result').hidden, true); assert.equal(node('error').hidden, false);
  change('input', '-1'); assert.equal(node('result').hidden, true);
  change('currency', 'CNY'); node('reset-demo').events.click();
  assert.equal(node('result').hidden, false); assert.equal(node('error').hidden, true);
  assert.equal(node('total').textContent, '0.580000'); assert.equal(node('currency').value, 'USD');
  node('reset-demo').events.click(); assert.equal(node('total').textContent, '0.580000');
});
test('demo reset control cannot shadow native form.reset', () => {
  assert.doesNotMatch(html, /(?:id|name)=["']reset["']/);
  assert.match(html, /id="reset-demo"/);
});
test('demo keeps browser computation local and has no inline execution', () => {
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|sendBeacon)\b/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
});
test('demo build refuses stale output instead of silently publishing it', async () => {
  const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const scratch = await mkdtemp(join(tmpdir(), 'synthetic-demo-check-'));
  await mkdir(join(scratch, 'site'));
  await writeFile(join(scratch, 'site/unexpected.txt'), 'Synthetic fixture, not a secret');
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/build-demo.mjs', import.meta.url))], { cwd: scratch, stdio: 'pipe' }), error => error.stderr.toString().includes('Unexpected site/ entry'));
  assert.equal(await readFile(join(scratch, 'site/unexpected.txt'), 'utf8'), 'Synthetic fixture, not a secret');
});
