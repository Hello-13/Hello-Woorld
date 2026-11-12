// Link check: import every module under <app>/src (except main.js, which needs the page) so that a
// missing export or file fails here and not in the browser, where it silently drops a vehicle.
// Usage: node --import ./tools/harness/linkcheck/register.mjs tools/harness/linkcheck/check.mjs [app dir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../aeroforge'));
// enough of a page for module top levels that read storage, the URL or make a canvas
const anything = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : anything), apply: () => anything, construct: () => anything });
globalThis.window ??= globalThis;
globalThis.self ??= globalThis;
globalThis.document ??= anything;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location ??= { search: '', hash: '', href: 'http://app.local/' };
globalThis.requestAnimationFrame ??= () => 0;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p); } })(path.join(root, 'src'));
let bad = 0;
for (const f of files) {
  if (path.relative(root, f) === path.join('src', 'main.js')) continue;
  try { await import(pathToFileURL(f).href); } catch (e) { bad++; console.log(`FAIL ${path.relative(root, f)}: ${String(e.message).split('\n')[0]}`); }
}
console.log(bad ? `${bad} module(s) do not link` : 'all modules link');
process.exit(bad ? 1 : 0);
