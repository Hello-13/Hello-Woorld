// F-22A–specific materials (shared ones come from engine/materials.js).

import * as THREE from 'three';
import { M, SKIN } from '../../engine/materials.js';

const cache = new Map();
const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };
const std = (k, p) => once(k, () => new THREE.MeshStandardMaterial(p));

export const F = {
  skin: () => SKIN.stealth(),
  wing: () => SKIN.stealthWing(),
  /**
   * One-piece canopy: polycarbonate with a gold-tinted indium-tin-oxide film. Roughness is held
   * above ~0.1 on both lobes so the large curved bubble carries broad, steady highlights.
   */
  canopy: () => once('f22.canopy', () => new THREE.MeshPhysicalMaterial({
    color: 0x9a7a3e, metalness: 0.45, roughness: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.1,
    specularIntensity: 0.9, specularColor: new THREE.Color(0xffe2a8),
    transparent: true, opacity: 0.82, envMapIntensity: 1.0, side: THREE.FrontSide,
  })),
  canopyFrame: () => std('f22.canopyFrame', { color: 0x3c4147, roughness: 0.55, metalness: 0.35 }),
  duct: () => std('f22.duct', { color: 0x3a3f45, roughness: 0.8, metalness: 0.15, side: THREE.DoubleSide }),
  ductDark: () => std('f22.ductDark', { color: 0x15181b, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide }),
  bay: () => std('f22.bay', { color: 0xc3c8cc, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide }),
  doorInner: () => std('f22.doorInner', { color: 0xb8bdc2, roughness: 0.6, metalness: 0.15 }),
  ti: () => M.titanium(),
  tiDull: () => std('f22.tiDull', { color: 0x9aa1a7, roughness: 0.45, metalness: 0.9 , side: THREE.DoubleSide }),
  alu: () => std('f22.alu', { color: 0xb4bbc2, roughness: 0.42, metalness: 0.85 , side: THREE.DoubleSide }),
  primer: () => std('f22.primer', { color: 0x9da88f, roughness: 0.6, metalness: 0.2 , side: THREE.DoubleSide }),
  composite: () => std('f22.composite', { color: 0x34383d, roughness: 0.55, metalness: 0.15 , side: THREE.DoubleSide }),
  bmi: () => std('f22.bmi', { color: 0x5a4b3c, roughness: 0.5, metalness: 0.2 , side: THREE.DoubleSide }),
  steel: () => std('f22.steel', { color: 0x8e959c, roughness: 0.35, metalness: 0.95 }),
  chrome: () => std('f22.chrome', { color: 0xd9dee3, roughness: 0.16, metalness: 1 }),
  gear: () => std('f22.gear', { color: 0xd6d9dc, roughness: 0.45, metalness: 0.2 }),
  tyre: () => std('f22.tyre', { color: 0x151515, roughness: 0.88, metalness: 0 }),
  wheel: () => std('f22.wheel', { color: 0xa9afb5, roughness: 0.38, metalness: 0.85 }),
  brake: () => std('f22.brake', { color: 0x24262a, roughness: 0.7, metalness: 0.3 }),
  tank: () => std('f22.tank', { color: 0x6f8aa3, roughness: 0.55, metalness: 0.25 }),
  sealant: () => std('f22.sealant', { color: 0x5d7c5a, roughness: 0.6, metalness: 0.1 }),
  pipe: () => std('f22.pipe', { color: 0xa8aeb3, roughness: 0.35, metalness: 0.9 }),
  hyd: () => std('f22.hyd', { color: 0x8a9a9c, roughness: 0.35, metalness: 0.85 }),
  box: () => std('f22.box', { color: 0x2f3337, roughness: 0.55, metalness: 0.4 }),
  boxLight: () => std('f22.boxLight', { color: 0x6c737a, roughness: 0.5, metalness: 0.45 }),
  black: () => std('f22.black', { color: 0x0f1113, roughness: 0.7, metalness: 0.2 }),
  hot: () => std('f22.hot', { color: 0x5a4f4a, roughness: 0.45, metalness: 0.9 }),
  inconel: () => M.inconel(),
  heat: () => M.heatTint(),
  blade: () => std('f22.blade', { color: 0x8c9399, roughness: 0.3, metalness: 1 }),
  bladeHot: () => std('f22.bladeHot', { color: 0x6e5d57, roughness: 0.35, metalness: 1 }),
  ceramic: () => std('f22.ceramic', { color: 0xc9c2b4, roughness: 0.7, metalness: 0.05 }),
  liner: () => SKIN.liner(),
  array: () => std('f22.array', { color: 0x2c4a42, roughness: 0.45, metalness: 0.55 }),
  tile: () => std('f22.tile', { color: 0xc9a65a, roughness: 0.35, metalness: 0.9 }),
  seat: () => std('f22.seat', { color: 0x2a2d30, roughness: 0.7, metalness: 0.15 }),
  cushion: () => std('f22.cushion', { color: 0x3c4a3a, roughness: 0.9, metalness: 0 }),
  suit: () => std('f22.suit', { color: 0x5c6650, roughness: 0.9, metalness: 0 }),
  helmet: () => std('f22.helmet', { color: 0x4a5048, roughness: 0.45, metalness: 0.1 }),
  visor: () => std('f22.visor', { color: 0x2a2416, roughness: 0.2, metalness: 0.7 }),
  panel: () => std('f22.panel', { color: 0x1c1f22, roughness: 0.75, metalness: 0.1 }),
  display: () => std('f22.display', { color: 0x061008, emissive: 0x2a8a50, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0 }),
  displayAmber: () => std('f22.displayAmber', { color: 0x100a02, emissive: 0xd08a2a, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0 }),
  hud: () => std('f22.hud', { color: 0x102018, emissive: 0x40ff80, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.45 }),
  missile: () => M.missile(),
  seeker: () => M.seeker(),
  missileBand: () => std('f22.missileBand', { color: 0xb08a2e, roughness: 0.5, metalness: 0.2 }),
  gun: () => std('f22.gun', { color: 0x30343a, roughness: 0.38, metalness: 0.85 }),
  brass: () => std('f22.brass', { color: 0xa88a3a, roughness: 0.35, metalness: 0.95 }),
  copper: () => M.copper(),
  yellow: () => std('f22.yellow', { color: 0xc9a227, roughness: 0.5, metalness: 0.2 }),
  orange: () => std('f22.orange', { color: 0xd06a28, roughness: 0.5, metalness: 0.2 }),
  lens: () => std('f22.lens', { color: 0x1a1d20, roughness: 0.12, metalness: 0.3 }),
  probe: () => std('f22.probe', { color: 0x9aa0a6, roughness: 0.3, metalness: 0.95 }),
  nozzle: () => std('f22.nozzle', { color: 0x4b4744, roughness: 0.5, metalness: 0.7 }),
  nozzleIn: () => std('f22.nozzleIn', { color: 0x3a302c, roughness: 0.5, metalness: 0.85, side: THREE.DoubleSide }),
};
