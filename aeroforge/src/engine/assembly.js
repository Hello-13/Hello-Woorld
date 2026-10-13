// Part/assembly bookkeeping: every inspectable component is a Group tagged with
// engineering metadata and an exploded-view offset.

import * as THREE from 'three';

export function mesh(geometry, material, { cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

export class Assembly {
  constructor() {
    this.root = new THREE.Group();
    this.parts = [];
  }

  /**
   * Register a part.
   * info: {
   *   system     one of the names in engine/systems.js (drives the Systems view colour)
   *   material, desc
   *   mass       kg; shown as an estimate unless massSource names a public figure
   *   massSource where the mass comes from, e.g. 'GE Aviation type certificate data'
   *   count      how many identical items the part represents (e.g. 22 fan blades)
   *   skin       true for exterior skins / fairings: ghosted in the Systems view, faint in X-ray
   *   temp (K), explode: [x,y,z] (m), callout, anchor: [x,y,z]
   * }
   */
  part(name, info, objects = [], parent = this.root) {
    const g = new THREE.Group();
    g.name = name;
    for (const o of [].concat(objects)) g.add(o);
    g.userData.part = {
      name,
      system: info.system || 'Structure',
      material: info.material || '—',
      mass: info.mass ?? null,
      massSource: info.massSource || null,
      count: info.count ?? null,
      skin: !!info.skin,
      temp: info.temp ?? 288,
      desc: info.desc || '',
      callout: !!info.callout,
      anchor: info.anchor ? new THREE.Vector3(...info.anchor) : null,
      explode: new THREE.Vector3(...(info.explode || [0, 0, 0])),
      id: `${this.parts.length}`,
    };
    parent.add(g);
    this.parts.push(g);
    return g;
  }

  /** Record rest positions; call once all parts are placed. */
  finalize() {
    for (const p of this.parts) p.userData.base = p.position.clone();
    return this;
  }
}

/** Apply an exploded-view factor (0 = assembled, 1 = fully exploded) to a parts list. */
export function applyExplode(parts, t) {
  for (const p of parts) {
    const info = p.userData.part;
    if (!p.userData.base) p.userData.base = p.position.clone();
    p.position.copy(p.userData.base).addScaledVector(info.explode, t);
  }
}
