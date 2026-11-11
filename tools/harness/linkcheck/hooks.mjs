// Node module hooks: resolve the browser's import-map names for three.js to a local copy.
import { pathToFileURL } from 'node:url';
const THREE = process.env.THREE_DIR || '/opt/aeroforge-deps/node_modules/three';
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: pathToFileURL(`${THREE}/build/three.module.js`).href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: pathToFileURL(`${THREE}/examples/jsm/${specifier.slice(13)}`).href, shortCircuit: true };
  return next(specifier, context);
}
