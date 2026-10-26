// Pointer picking: hover + click selection of parts, with drag rejection so orbiting
// the camera never selects anything by accident.

import * as THREE from 'three';
import { partOf } from './modes.js';

export class Picker {
  /** accept(part): false skips the part so the ray carries on (ghosted skins, unfocused parts).
   *  keeps(point): false skips a hit the section cut has clipped away, so clicks land on what is drawn. */
  constructor(stage, { getRoot, onHover, onSelect, enabled = () => true, accept = () => true, keeps = () => true }) {
    this.stage = stage;
    this.accept = accept;
    this.keeps = keeps;
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
      if (!this.keeps(h.point)) continue;
      const part = partOf(o);
      if (part && this.accept(part)) return part;
    }
    return null;
  }

  /**
   * Can this part be seen from outside the vehicle in Studio (nothing in front of it)? Sample
   * points on the part's surface are each sighted from outside the vehicle, looking inward along
   * the line from the vehicle's centre through the point; the part is exterior if any sighting's
   * first solid hit is the part itself. Cached on the part (the answer does not change with the view).
   */
  visibleFromOutside(part, root = this.getRoot()) {
    if (!part || !root) return false;
    if (part.userData.exterior !== undefined) return part.userData.exterior;
    root.updateMatrixWorld(true);
    const whole = new THREE.Box3().setFromObject(root, true);
    if (whole.isEmpty()) return (part.userData.exterior = false);
    const sph = whole.getBoundingSphere(new THREE.Sphere());
    const centre = sph.center, R = sph.radius * 2.5;
    // up to ~16 surface points spread over the part's meshes
    const meshes = [];
    part.traverse((o) => { if (o.isMesh && !o.userData.fx && o.geometry?.attributes.position) meshes.push(o); });
    const per = Math.max(1, Math.ceil(16 / Math.max(1, meshes.length)));
    const samples = [];
    for (const m of meshes) {
      const pos = m.geometry.attributes.position;
      const stride = Math.max(1, Math.floor(pos.count / per));
      for (let i = 0; i < pos.count && samples.length < 24; i += stride) samples.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    }
    const origin = new THREE.Vector3(), dir = new THREE.Vector3();
    let seen = false;
    for (const pt of samples) {
      dir.subVectors(pt, centre);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      dir.normalize();
      if (dir.y < -0.35) continue;              // the underside is below the floor's horizon
      origin.copy(pt).addScaledVector(dir, R);
      this.ray.set(origin, dir.clone().negate());
      this.ray.far = R * 1.5;
      for (const h of this.ray.intersectObject(root, true)) {
        const o = h.object;
        if (!o.isMesh || o.userData.fx) continue;
        let vis = true;
        for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
        if (!vis) continue;
        const hitPart = partOf(o);
        if (!hitPart) continue;
        seen = hitPart === part;
        break;
      }
      if (seen) break;
    }
    this.ray.far = Infinity;
    part.userData.exterior = seen;
    return seen;
  }

  setHover(part) {
    if (part === this.hovered) return;
    this.hovered = part;
    this.stage.renderer.domElement.style.cursor = part ? 'pointer' : '';
    this.onHover(part);
  }
}
