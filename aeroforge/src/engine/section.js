// Section cut: one clipping plane slices the vehicle along a station (longitudinal), waterline
// (vertical) or buttline (lateral) axis, so the interior reads like a textbook cutaway. The plane
// is applied through material.clippingPlanes on the vehicle's meshes only, never on the
// environment, floor, effects or callouts: RenderModes assigns a mesh's material and then hands it
// to clipMaterial() (see modes.js), so every render mode's material, shared or vehicle-specific,
// carries the same `planes` array. While a cut is on, front-face materials draw both sides, so a
// wall seen through the cut reads as a solid surface instead of vanishing.

import * as THREE from 'three';
import { applyExplode } from './assembly.js';
import { solidBounds } from './stage.js';

/** The three cutting axes (aircraft terms: fuselage station, waterline and buttline). */
export const AXES = {
  station: { label: 'Station' },
  waterline: { label: 'Waterline' },
  buttline: { label: 'Buttline' },
};
export const AXIS_ORDER = ['station', 'waterline', 'buttline'];

/** Give a ShaderMaterial the clipping chunks three's built-in materials already have. */
function patchShader(mat) {
  mat.clipping = true;
  const vs = mat.vertexShader, fs = mat.fragmentShader;
  if (!vs.includes('clipping_planes_vertex')) {
    mat.vertexShader = `#include <clipping_planes_pars_vertex>\n${vs.replace(/}\s*$/, '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\n  #include <clipping_planes_vertex>\n}')}`;
  }
  if (!fs.includes('clipping_planes_fragment')) {
    mat.fragmentShader = `#include <clipping_planes_pars_fragment>\n${fs.replace('void main() {', 'void main() {\n  #include <clipping_planes_fragment>')}`;
  }
  mat.needsUpdate = true;
}

/**
 * Attach the shared plane list to a material (idempotent, cheap to call every frame). With a cut
 * active (planes.length > 0) single-sided materials turn double-sided; they go back when it ends.
 */
export function clipMaterial(mat, planes) {
  if (!mat || !planes) return;
  if (Array.isArray(mat)) { for (const x of mat) clipMaterial(x, planes); return; }
  if (mat.clippingPlanes !== planes) {
    mat.clippingPlanes = planes;
    mat.clipShadows = true;
    if (mat.isShaderMaterial && !mat.clipping) patchShader(mat);
  }
  const on = planes.length > 0;
  if (on && mat.side === THREE.FrontSide) {
    mat.userData.sectionSide = mat.side;
    mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
  } else if (!on && mat.userData.sectionSide !== undefined) {
    mat.side = mat.userData.sectionSide;
    delete mat.userData.sectionSide;
    mat.needsUpdate = true;
  }
}

export class SectionCut {
  /** modes: the RenderModes instance; its `clippingPlanes` list is this cut's `planes`. */
  constructor(stage, modes) {
    this.stage = stage;
    this.modes = modes;
    stage.renderer.localClippingEnabled = true;
    this.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.planes = [];                 // [] when off, [plane] when on: materials share this array
    modes.clippingPlanes = this.planes;
    this.enabled = false;
    this.axis = 'station';
    this.t = 0.5;                     // fraction of the span sliced away, 0 = nothing cut
    this.flipped = false;             // cut from the other end, keeping the other side
    this.vehicle = null;
    this.box = null;
    this.onChange = null;
  }

  /**
   * Measure a vehicle's (unexploded) world bounds. `explode` is the current exploded-view factor.
   * options.vertical: the vehicle stands on end (a launcher), so stations run down from the nose
   * along y and the two other cuts are lateral; options.nose: what the forward end is called in the
   * label ('nose', 'intake', 'aperture').
   */
  attach(vehicle, explode = 0, { vertical = false, nose = 'nose' } = {}) {
    this.vehicle = vehicle;
    this.vertical = vertical;
    this.nose = nose;
    if (!vehicle) { this.box = null; return; }
    const root = vehicle.root;
    const y = root.position.y;
    if (explode > 0) applyExplode(vehicle.parts, 0);
    if (vehicle._baseY != null) root.position.y = vehicle._baseY;
    // the vehicle's own extent: a launcher's pad and tower (Ground support) would otherwise set the
    // nose and the centreline the labels measure from
    const own = (vehicle.parts || []).filter((p) => p.userData.part?.system !== 'Ground support');
    if (own.length && own.length < (vehicle.parts || []).length) {
      root.updateMatrixWorld(true);
      this.box = new THREE.Box3();
      for (const p of own) this.box.union(solidBounds(p));
    } else this.box = solidBounds(root);
    root.position.y = y;
    if (explode > 0) applyExplode(vehicle.parts, explode);
    this.update();
  }

  /** Real-metre length of the vehicle along each axis (display scaling undone). */
  get scale() { return this.vehicle?._fitScale || 1; }

  setEnabled(on) {
    on = !!on;
    if (on === this.enabled) return;
    this.enabled = on;
    this.planes.length = 0;
    if (on) this.planes.push(this.plane);
    this.update();
  }

  setAxis(axis) {
    if (!AXES[axis]) return;
    this.axis = axis;
    this.update();
  }

  setFraction(t) {
    this.t = Math.min(1, Math.max(0, +t || 0));
    this.update();
  }

  flip() {
    this.flipped = !this.flipped;
    this.update();
  }

  /** Axis unit vector, the end the cut starts from and the length, in world units. */
  geometry() {
    const box = this.box;
    if (!box) return null;
    const min = box.min, max = box.max;
    // station: cut aft from the nose (+x), keep what is aft of it; waterline: cut down from the top,
    // keep what is below; buttline: cut from the right (+z) toward the left, keep the left. Flipped,
    // the cut starts from the opposite end and keeps the opposite side.
    // a vehicle standing on end: stations run down its height, the waterline cut turns lateral
    const def = (this.vertical ? {
      station: { n: new THREE.Vector3(0, 1, 0), start: max.y, end: min.y },
      waterline: { n: new THREE.Vector3(1, 0, 0), start: max.x, end: min.x },
      buttline: { n: new THREE.Vector3(0, 0, 1), start: max.z, end: min.z },
    } : {
      station: { n: new THREE.Vector3(1, 0, 0), start: max.x, end: min.x },
      waterline: { n: new THREE.Vector3(0, 1, 0), start: max.y, end: min.y },
      buttline: { n: new THREE.Vector3(0, 0, 1), start: max.z, end: min.z },
    })[this.axis];
    const start = this.flipped ? def.end : def.start, end = this.flipped ? def.start : def.end;
    return { n: def.n, start, end, length: Math.abs(end - start) };
  }

  /** World-space coordinate of the cut along its axis. */
  get cut() {
    const g = this.geometry();
    return g ? g.start + (g.end - g.start) * this.t : 0;
  }

  update() {
    const g = this.geometry();
    if (g) {
      // three keeps the side where plane.distanceToPoint ≥ 0. Normal: start → end means the kept side
      // lies toward `end`: n·p + c ≥ 0 with n = sign(end − start)·axis and c = −n·cut.
      const s = Math.sign(g.end - g.start) || 1;
      this.plane.normal.copy(g.n).multiplyScalar(s);
      this.plane.constant = -s * this.cut * 1;
      // nudge a hair so the slider's end positions leave the model whole / fully cut without z-fighting
      this.plane.constant += this.t <= 0 ? 1e-3 : this.t >= 1 ? -1e-3 : 0;
    }
    this.onChange?.(this);
  }

  /** Position of the cut in real metres from the axis's reference (nose, bottom or centreline),
   *  signed for the lateral cuts (positive toward +z, the right side, or +x). */
  metres() {
    const box = this.box;
    if (!box) return 0;
    const cut = this.cut, s = this.scale;
    if (this.axis === 'station') return ((this.vertical ? box.max.y : box.max.x) - cut) / s;
    if (this.axis === 'waterline') return this.vertical ? (cut - (box.min.x + box.max.x) / 2) / s : (cut - box.min.y) / s;
    return (cut - (box.min.z + box.max.z) / 2) / s;
  }

  /** Slider label, e.g. "7.4 m aft of the nose", "1.2 m right of the centreline". */
  label() {
    if (!this.box) return '—';
    const m = this.metres();
    const d = Math.abs(m) >= 100 ? 0 : Math.abs(m) >= 10 ? 1 : 2;
    const lateral = (pos, neg) => `${Math.abs(m).toFixed(d)} m ${Math.abs(m) < 0.005 ? 'on the' : m > 0 ? pos : neg} centreline`;
    if (this.axis === 'buttline') return lateral('right of the', 'left of the');
    if (this.axis === 'waterline') return this.vertical ? lateral('+x of the', '−x of the') : `${m.toFixed(d)} m above the bottom`;
    return `${m.toFixed(d)} m ${this.vertical ? 'below' : 'aft of'} the ${this.nose}`;
  }

  /** Is this world point on the kept side (used by picking so clicks land on what is drawn)? */
  keeps(point) {
    return !this.enabled || this.plane.distanceToPoint(point) >= 0;
  }
}
