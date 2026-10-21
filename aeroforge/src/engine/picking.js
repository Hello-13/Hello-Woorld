// Pointer picking: hover + click selection of parts, with drag rejection so orbiting
// the camera never selects anything by accident.

import * as THREE from 'three';
import { partOf } from './modes.js';

export class Picker {
  /** accept(part): false skips the part so the ray carries on (ghosted skins, unfocused parts). */
  constructor(stage, { getRoot, onHover, onSelect, enabled = () => true, accept = () => true }) {
    this.stage = stage;
    this.accept = accept;
    this.getRoot = getRoot;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.enabled = enabled;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.hovered = null;
    this.pending = null;
    this.down = null;
    const el = stage.renderer.domElement;
    el.addEventListener('pointermove', (e) => { this.pending = e; this.last = e; });
    el.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!this.down) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      const quick = performance.now() - this.down.t < 600;
      this.down = null;
      if (moved < 6 && quick && this.enabled()) this.onSelect(this.pick(e));
    });
    el.addEventListener('pointerleave', () => { this.pending = null; this.setHover(null); });
    stage.onFrame(() => {
      if (!this.pending) return;
      // dense models hold hundreds of thousands of triangles: hover-test at most ~20 times a second
      const now = performance.now();
      if (now - (this.lastPick || 0) < 50) return;
      this.lastPick = now;
      const e = this.pending;
      this.pending = null;
      if (e.pointerType === 'touch' || !this.enabled()) return;
      this.setHover(this.pick(e));
    });
  }

  pick(e) {
    const root = this.getRoot();
    if (!root) return null;
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
    const hits = this.ray.intersectObject(root, true);
    for (const h of hits) {
      const o = h.object;
      if (!o.isMesh || o.userData.fx) continue;
      let vis = true;
      for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) continue;
      const part = partOf(o);
      if (part && this.accept(part)) return part;
    }
    return null;
  }

  setHover(part) {
    if (part === this.hovered) return;
    this.hovered = part;
    this.stage.renderer.domElement.style.cursor = part ? 'pointer' : '';
    this.onHover(part);
  }
}
