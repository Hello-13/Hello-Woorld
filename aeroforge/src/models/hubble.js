// Placeholder: replaced by the full Hubble Space Telescope model.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { M } from '../engine/materials.js';

export function buildHubble() {
  const A = new Assembly();
  A.part('Telescope', { system: 'Structure', desc: 'Placeholder airframe.' }, mesh(new THREE.CylinderGeometry(2.1, 2.1, 13, 32), M.aluminium()));
  A.finalize();
  return {
    id: 'hubble', designation: 'HST', name: 'HUBBLE', role: 'Space telescope',
    tagline: 'Model in progress', summary: 'Placeholder.', specs: [], fleetTag: '',
    root: A.root, parts: A.parts, view: { dir: [1, 0.45, 1.2], fill: 1 }, displaySize: 12, thermalRange: [200, 900], state: {},
  };
}
