// GE90-specific materials. Colours follow what the real hardware looks like on a shop stand or
// in a museum cutaway: dark composite fan blades with bright titanium leading-edge sheaths,
// bare titanium booster and front HPC, straw-to-bronze heat tint on the nickel rear stages,
// off-white thermal-barrier coat on the hot-section airfoils, grey-green painted forged-aluminium
// fan case and the Boeing nacelle in white. (kevlar is kept for the temporary 2003 containment wrap
// but is not used on the production engine shown.)

import * as THREE from 'three';
import { SKIN } from '../../engine/materials.js';

const cache = new Map();
const std = (key, p) => { if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(p)); return cache.get(key); };
const phys = (key, p) => { if (!cache.has(key)) cache.set(key, new THREE.MeshPhysicalMaterial(p)); return cache.get(key); };
const lerp = (a, b, f) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, f)));

export const GM = {
  // the blades' clearcoat is kept low: a sharper one threw the key light back as a bloom hot spot
  composite: () => phys('composite', { color: 0x2b2e33, roughness: 0.5, metalness: 0.05, clearcoat: 0.18, clearcoatRoughness: 0.5 }),
  tiSheath: () => std('tiSheath', { color: 0xc8ccd0, roughness: 0.36, metalness: 1 }),
  titanium: () => std('titanium', { color: 0xb6bcc2, roughness: 0.3, metalness: 1 }),
  ti6246: (i) => std(`hpc${i}`, { color: lerp(0xb6bcc2, 0xab8f62, (i - 3) / 6), roughness: 0.32, metalness: 1 }),
  nickel: () => std('nickel', { color: 0x8a8279, roughness: 0.4, metalness: 0.95 }),
  nickelDark: () => std('nickelDark', { color: 0x6c625a, roughness: 0.45, metalness: 0.92 }),
  heat: (f) => std(`heat${Math.round(f * 10)}`, { color: lerp(0x6a5468, 0x9d8763, f), roughness: 0.42, metalness: 0.92 }),
  tbc: () => std('tbc', { color: 0xd7cfbf, roughness: 0.72, metalness: 0.05 }),
  liner: () => std('liner', { color: 0xcfc6b4, roughness: 0.68, metalness: 0.1, side: THREE.DoubleSide }),
  casing: () => std('casing', { color: 0x8d9195, roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide }),
  casingDark: () => std('casingDark', { color: 0x6b7075, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide }),
  fanCase: () => std('fanCase', { color: 0x7c8a82, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }),
  kevlar: () => std('kevlar', { color: 0xc9a443, roughness: 0.78, metalness: 0.0 }),
  rubStrip: () => std('rubStrip', { color: 0xa9a59c, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
  acoustic: () => std('acoustic', { color: 0x5e6468, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }),
  coreCowl: () => std('coreCowl', { color: 0xb8bdc2, roughness: 0.36, metalness: 0.5, side: THREE.DoubleSide }),
  aluminium: () => std('alu', { color: 0xc3c9cf, roughness: 0.36, metalness: 0.95 }),
  magnesium: () => std('mag', { color: 0x8a9086, roughness: 0.6, metalness: 0.4 }),
  painted: () => std('painted', { color: 0x9aa39c, roughness: 0.55, metalness: 0.2 }),
  avionics: () => std('avionics', { color: 0x3a3f45, roughness: 0.55, metalness: 0.4 }),
  steel: () => std('steel', { color: 0xa9afb5, roughness: 0.3, metalness: 1 }),
  shaft: () => std('shaft', { color: 0x9da3a8, roughness: 0.28, metalness: 1 }),
  bearing: () => std('bearing', { color: 0xc9cdd1, roughness: 0.18, metalness: 1 }),
  bronze: () => std('bronze', { color: 0xa47a48, roughness: 0.35, metalness: 1 }),
  copper: () => std('copper', { color: 0xb5713f, roughness: 0.32, metalness: 1 }),
  braid: () => std('braid', { color: 0x6f7378, roughness: 0.6, metalness: 0.6 }),
  harness: () => std('harness', { color: 0x4a4436, roughness: 0.8, metalness: 0.05 }),
  connector: () => std('connector', { color: 0x9b8a52, roughness: 0.45, metalness: 0.8 }),
  duct: () => std('duct', { color: 0xb3a58a, roughness: 0.4, metalness: 0.9 }),
  oil: () => std('oil', { color: 0x7d8a96, roughness: 0.35, metalness: 0.9 }),
  red: () => std('red', { color: 0xa3261e, roughness: 0.5, metalness: 0.2 }),
  blue: () => std('blue', { color: 0x2f5f8e, roughness: 0.5, metalness: 0.3 }),
  cascade: () => std('cascade', { color: 0x3b3f44, roughness: 0.5, metalness: 0.4 }),
  // the reverser's torque box and cascade vane boxes, the light-grey structure the open sleeves expose
  cascadeBox: () => std('cascadeBox', { color: 0xc6cacd, roughness: 0.62, metalness: 0.1, side: THREE.DoubleSide }),
  cascadeVane: () => std('cascadeVane', { color: 0x9fa5aa, roughness: 0.58, metalness: 0.2, side: THREE.DoubleSide }),
  // the strut stub's light-grey paint
  strut: () => std('strut', { color: 0xb9bec2, roughness: 0.5, metalness: 0.15 }),
  // cut faces of the museum cutaway: the strong red of a sectioned exhibit
  section: () => std('section', { color: 0xc4181c, roughness: 0.58, metalness: 0.04, side: THREE.DoubleSide }),
  // Boeing nacelle paint: the shared skin tile, with less clearcoat (so the key light's reflection
  // on the white cowl does not bloom like a lamp) and a lighter normal map (flush panel joints)
  nacelle: () => {
    if (!cache.has('nacelle')) {
      const m = SKIN.nacelle().clone();
      m.clearcoat = 0.2; m.clearcoatRoughness = 0.42; m.roughness = 0.46;
      m.normalScale.set(0.12, 0.12);
      cache.set('nacelle', m);
    }
    return cache.get('nacelle');
  },
  // holes (cooling, dilution and web holes) drawn as dark discs through a wall
  hole: () => std('hole', { color: 0x16130f, roughness: 0.9, metalness: 0.1 }),
  gear: () => std('gear', { color: 0xb9b2a4, roughness: 0.26, metalness: 1 }),
  fairing: () => std('fairing', { color: 0x9a8f80, roughness: 0.5, metalness: 0.85 }),
  orange: () => std('orange', { color: 0xc8692a, roughness: 0.5, metalness: 0.2 }),
};
