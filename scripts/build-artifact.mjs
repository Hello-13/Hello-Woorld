// Inline the Vite build into one self-contained HTML page (for sharing as a single file or a
// claude.ai Artifact). Run after `vite build`: node scripts/build-artifact.mjs [out.html]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const dist = join(root, 'dist');
const out = resolve(process.argv[2] ?? join(root, 'artifact', 'string-theory.html'));
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const script = /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/.exec(html);
const style = /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/.exec(html);
if (!script || !style) throw new Error('Could not find the built script and stylesheet in dist/index.html');

const js = readFileSync(join(dist, script[1]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
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
<script type="module">
${js}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(1)} KB)`);
