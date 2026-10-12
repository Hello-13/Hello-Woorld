// Render modes: STUDIO (PBR), X-RAY (fresnel hologram), BLUEPRINT (edges on drafting blue)
// and THERMAL (per-part temperature mapped through an inferno colour scale).

import * as THREE from 'three';
import { xrayMaterial, inferno } from './effects.js';

export const MODES = ['studio', 'xray', 'blueprint', 'thermal'];

function partOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.part) return o;
  return null;
}

export class RenderModes {
  constructor(stage) {
    this.stage = stage;
    this.mode = 'studio';
    this.xray = xrayMaterial(0x5fd4ff, 2.2, 0.03);
    this.xraySel = xrayMaterial(0xffb000, 1.5, 0.1);
    this.bpFill = new THREE.MeshBasicMaterial({ color: 0x0f3d6e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.bpFillSel = new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.bpLine = new THREE.LineBasicMaterial({ color: 0xd4ecff, transparent: true, opacity: 0.8 });
    this.bpLineSel = new THREE.LineBasicMaterial({ color: 0xffc640 });
    this.thermalMats = new Map();
  }

  meshes(vehicle) {
    if (!vehicle._meshes) {
      const list = [];
      vehicle.root.traverse((o) => {
        if (o.isMesh && !o.userData.fx) {
          if (!o.userData.studio) o.userData.studio = o.material;
          list.push(o);
        }
      });
      vehicle._meshes = list;
    }
    return vehicle._meshes;
  }

  fxObjects(vehicle) {
    const list = [];
    vehicle.root.traverse((o) => { if ((o.isMesh || o.isPoints) && o.userData.fx && !o.userData.edges) list.push(o); });
    return list;
  }

  thermalMaterial(T, range) {
    const k = Math.round(T / 4) * 4;
    const key = `${k}|${range[0]}|${range[1]}`;
    if (!this.thermalMats.has(key)) {
      const c = inferno((k - range[0]) / (range[1] - range[0]));
      this.thermalMats.set(key, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, roughness: 0.75, metalness: 0.05 }));
    }
    return this.thermalMats.get(key);
  }

  temperature(vehicle, mesh) {
    if (typeof mesh.userData.temp === 'function') return mesh.userData.temp();
    if (typeof mesh.userData.temp === 'number') return mesh.userData.temp;
    const p = partOf(mesh);
    const info = p?.userData.part;
    if (!info) return 288;
    return vehicle.temperatureOf ? vehicle.temperatureOf(info, mesh) : info.temp;
  }

  apply(vehicle, mode = this.mode, selected = null) {
    this.mode = mode;
    if (!vehicle) return;
    const sel = selected;
    const inSel = (m) => sel && partOf(m) === sel;
    for (const m of this.meshes(vehicle)) {
      const edges = m.userData.edges;
      if (mode === 'studio') {
        m.material = m.userData.studio;
        if (edges) edges.visible = false;
        m.castShadow = true;
      } else if (mode === 'xray') {
        m.material = inSel(m) ? this.xraySel : this.xray;
        if (edges) edges.visible = false;
        m.castShadow = false;
      } else if (mode === 'blueprint') {
        m.material = inSel(m) ? this.bpFillSel : this.bpFill;
        if (!edges) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 24), this.bpLine);
          e.userData.fx = true;
          e.userData.edges = true;
          e.raycast = () => {};
          m.add(e);
          m.userData.edges = e;
        }
        m.userData.edges.material = inSel(m) ? this.bpLineSel : this.bpLine;
        m.userData.edges.visible = true;
        m.castShadow = false;
      } else if (mode === 'thermal') {
        m.material = this.thermalMaterial(this.temperature(vehicle, m), vehicle.thermalRange || [200, 1200]);
        if (edges) edges.visible = false;
        m.castShadow = true;
      }
    }
    for (const fx of this.fxObjects(vehicle)) {
      if (fx.userData.keepInModes) continue;
      fx.material.visible = mode !== 'blueprint';
    }
    const st = this.stage;
    if (st.env !== 'custom' && st.env !== 'space') st.setEnvironment(mode === 'blueprint' ? 'blueprint' : 'hangar');
    const solidDeck = mode === 'studio' || mode === 'thermal';
    for (const k of ['platform', 'deck', 'ticks']) st.platform[k].visible = solidDeck;
    st.lights.key.castShadow = solidDeck;
  }

  /** Re-evaluate thermal colours (temperatures change with flight condition / throttle). */
  refreshThermal(vehicle) {
    if (this.mode !== 'thermal' || !vehicle) return;
    for (const m of this.meshes(vehicle)) {
      m.material = this.thermalMaterial(this.temperature(vehicle, m), vehicle.thermalRange || [200, 1200]);
    }
  }
}

export { partOf };
