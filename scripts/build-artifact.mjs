// Turn the artifact build (vite.artifact.config.ts) into one self-contained HTML page:
// our code and styles inline, Preact from a pinned jsDelivr copy, fonts from Google Fonts.
// Usage: vite build --config vite.artifact.config.ts && node scripts/build-artifact.mjs [out.html]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const dist = join(root, 'dist-artifact');
const out = resolve(process.argv[2] ?? join(root, 'artifact', 'string-theory.html'));
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const preactVersion = JSON.parse(readFileSync(join(root, 'node_modules', 'preact', 'package.json'), 'utf8')).version;
const cdn = `https://cdn.jsdelivr.net/npm/preact@${preactVersion}`;

const script = /<script[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/.exec(html);
const style = /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)">/.exec(html);
if (!script || !style) throw new Error('Could not find the built script and stylesheet in dist-artifact/index.html');

const js = readFileSync(join(dist, script[1]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
if (/^\s*import\s|\bimport\s*\(/m.test(js)) throw new Error('Artifact bundle still contains ES imports; check the externals.');
const css = readFileSync(join(dist, style[1]), 'utf8');
const fonts = /<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"\s*\/?>/.exec(html);

const page = `<title>String Theory</title>
<meta name="description" content="A guitar practice studio: tuner, chords, scales, backing band, ear training and fretboard games.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts ? `<link rel="stylesheet" href="${fonts[1]}">` : ''}
<style>
${css}
</style>
<div id="app"></div>
<script src="${cdn}/dist/preact.min.umd.js"></script>
<script src="${cdn}/hooks/dist/hooks.umd.js"></script>
<script src="${cdn}/jsx-runtime/dist/jsxRuntime.umd.js"></script>
<script>
${js}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(1)} KB, Preact ${preactVersion} from jsDelivr)`);
