// Screenshot / drive the AEROFORGE app headless (software GL), with three.js served from a local copy.
// Usage: node tools/harness/shot.mjs <page under aeroforge, e.g. 'index.html#fighter'> <out.png>
//          [width height] [waitMs] [js | @file.js] ...
// Each extra argument is evaluated in the page in order (async expressions are awaited) and its
// JSON result printed as "[eval] ...". Env: APP (app root, default <repo>/aeroforge), THREE_DIR,
// SCRATCH (served at /__scratch/), DSF (device scale factor), TIMEOUT (ms), VERBOSE=1 (all console).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const APP = process.env.APP || path.resolve(HERE, '../../aeroforge');
const THREE = process.env.THREE_DIR || '/opt/aeroforge-deps/node_modules/three';
const SCRATCH = process.env.SCRATCH || '';
const [,, page = 'index.html', out = 'out.png', w = '1280', h = '800', wait = '2000', ...evals] = process.argv;
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.exr': 'application/octet-stream', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webp': 'image/webp' };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DSF || 1) });
const pg = await ctx.newPage();
pg.setDefaultTimeout(+(process.env.TIMEOUT || 30000));
const logs = [];
pg.on('console', (m) => { if (process.env.VERBOSE || m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
pg.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await pg.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  let file = null;
  if (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/three@0.170.0/')) file = path.join(THREE, url.pathname.replace('/npm/three@0.170.0/', ''));
  else if (url.host === 'app.local' && SCRATCH && url.pathname.startsWith('/__scratch/')) file = path.join(SCRATCH, decodeURIComponent(url.pathname.slice(11)));
  else if (url.host === 'app.local') file = path.join(APP, decodeURIComponent(url.pathname));
  if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': types[path.extname(file)] || 'application/octet-stream' } });
  if (url.host === 'app.local' || url.host === 'cdn.jsdelivr.net') { logs.push('[404] ' + url); return route.fulfill({ status: 404, body: 'not found' }); }
  return route.abort();       // web fonts and anything else off-machine: expected "net::ERR_FAILED" lines
});
const t0 = Date.now();
await pg.goto('http://app.local/' + page);
await pg.waitForTimeout(+wait);
for (const e of evals) {
  const src = e.startsWith('@') ? fs.readFileSync(e.slice(1), 'utf8') : e;
  try {
    const r = await pg.evaluate(src);
    console.log('[eval] ' + JSON.stringify(r));
  } catch (err) { console.log('[eval error] ' + err.message.split('\n')[0]); }
}
await pg.screenshot({ path: out });
for (const l of logs) console.log(l);
console.log(`elapsed ${Date.now() - t0} ms`);
await browser.close();
