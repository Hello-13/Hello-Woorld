// Force-vector overlay: glowing arrows sized from the physics (lift, drag, thrust, weight),
// each with a screen-space label carrying its magnitude.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const UP = new THREE.Vector3(0, 1, 0);
const _off = new THREE.Vector3();
const _q = new THREE.Quaternion();

export const FORCE_COLORS = { lift: 0x3987e5, drag: 0xe66767, thrust: 0xffb000, weight: 0xd8e0e8 };

export class ForceArrows {
  /** parent: object whose local frame the origins/directions are given in; radius: shaft radius. */
  constructor(parent, { radius = 0.06 } = {}) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.userData.fx = true;
    parent.add(this.group);
    this.radius = radius;
    this.arrows = {};
  }

  ensure(key, color, name) {
    if (this.arrows[key]) return this.arrows[key];
    const mat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: 2.4, roughness: 0.4, transparent: true, opacity: 0.92, depthTest: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(this.radius, this.radius, 1, 12).translate(0, 0.5, 0), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(this.radius * 3, this.radius * 7, 16).translate(0, this.radius * 3.5, 0), mat);
    const g = new THREE.Group();
    g.add(shaft, head);
    g.renderOrder = 20;
    for (const m of [shaft, head]) { m.userData.fx = true; m.userData.noAO = true; m.renderOrder = 20; m.raycast = () => {}; }
    const el = document.createElement('div');
    el.className = 'force-label';
    el.style.setProperty('--c', `#${new THREE.Color(color).getHexString()}`);
    el.innerHTML = '<b></b><span></span>';
    el.querySelector('span').textContent = name;
    const label = new CSS2DObject(el);
    g.add(label);
    this.group.add(g);
    this.arrows[key] = { g, shaft, head, label, el, value: el.querySelector('b') };
    return this.arrows[key];
  }

  /** Place an arrow: origin & dir in the parent frame, length in parent units, text for the label;
   *  labelOffset (parent frame) moves the label off the tip. */
  set(key, { origin, dir, length, text, name, color = FORCE_COLORS[key], labelOffset = null }) {
    const a = this.ensure(key, color, name || key);
    const L = Math.max(0.001, length);
    const headLen = this.radius * 7;
    a.g.position.copy(origin);
    a.g.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    a.shaft.scale.set(1, Math.max(0.001, L - headLen), 1);
    a.head.position.y = Math.max(0, L - headLen);
    a.label.position.set(0, L + this.radius * 4, 0);
    // optional nudge in the parent frame, to keep neighbouring labels apart
    if (labelOffset) a.label.position.add(_off.copy(labelOffset).applyQuaternion(_q.copy(a.g.quaternion).invert()));
    a.g.visible = length > this.radius * 2;
    a.label.visible = this.group.visible && a.g.visible;
    if (a.value.textContent !== text) a.value.textContent = text;
  }

  setVisible(v) {
    this.group.visible = v;
    for (const a of Object.values(this.arrows)) a.label.visible = v && a.g.visible;
  }
}

/** kN formatting for labels. */
export const kN = (newtons) => (Math.abs(newtons) >= 1e6 ? `${(newtons / 1e6).toFixed(2)} MN` : `${Math.round(newtons / 1000).toLocaleString('en-US')} kN`);
