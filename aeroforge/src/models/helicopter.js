// Placeholder: replaced by the full UH-60M Black Hawk model.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { M } from '../engine/materials.js';

export function buildHelicopter() {
  const A = new Assembly();
  A.part('Fuselage', { system: 'Structure', desc: 'Placeholder airframe.' }, mesh(new THREE.BoxGeometry(12, 2, 2.2), M.uavDark()));
  A.finalize();
  return {
    id: 'helicopter', designation: 'UH-60M', name: 'BLACK HAWK', role: 'Utility helicopter',
    tagline: 'Model in progress', summary: 'Placeholder.', specs: [], fleetTag: '',
    root: A.root, parts: A.parts, view: { dir: [1, 0.45, 1.2], fill: 1 }, displaySize: 12, thermalRange: [200, 900], state: {},
  };
}
