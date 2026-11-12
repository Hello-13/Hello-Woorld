// Render modes: STUDIO (PBR), X-RAY (fresnel hologram; skins faint so the interior reads, crowded
// parts dimmed and layers screen-blended so dense views do not wash out),
// BLUEPRINT (edges on drafting blue), SYSTEMS (cutaway-poster colours by subsystem, skins
// ghosted), THERMAL (per-part temperature on an inferno scale) and PRESSURE (live pressure
// coefficient on lifting surfaces). A ghost overlay fades every part except the ones in focus.

import * as THREE from 'three';
import { inferno } from './effects.js';
import { systemColor } from './systems.js';
import { clipMaterial } from './section.js';

export const MODES = ['studio', 'xray', 'blueprint', 'systems', 'thermal', 'pressure'];

/**
 * Fresnel hologram for X-ray, the Systems view's skins and the ghost overlay: a rim glow at
 * grazing angles over a faint base. Layers combine with a screen blend, out = src + dst·(1 − src),
 * instead of plain addition: a few layers add up almost exactly as before, but a stack of many
 * (a bus full of boxes seen end-on, a fuselage nose-on) saturates toward the hologram colour and
 * never overshoots the HDR range into bloom, so dense views stay readable instead of washing out
 * to a white blob. The output is premultiplied and clamped to [0, 1] for that blend; gain dims a
 * layer for crowded spots (see density()).
 */
export function holoMaterial(color, power, base, gain = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, base: { value: base }, gain: { value: gain } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float power; uniform float base; uniform float gain;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), power);
        float a = clamp(f + base, 0.0, 1.0);
        vec3 c = clamp(color * (f * 1.6 + base) * a * gain, 0.0, 1.0);
        gl_FragColor = vec4(c, a * gain);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcColorFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

/** A mesh with this many or fewer other meshes enclosing its centre keeps its full X-ray glow;
 *  beyond it the glow falls as the square root of the count (see density()). */
const DENSE_N = 6;

function partOf(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.part) return o;
  return null;
}

/**
 * Pressure coefficient on a lifting surface from thin-airfoil theory:
 *   ΔCp(x) = 4α·√((1−x)/x)  split ± between the surfaces, plus a thickness suction bump,
 * corrected for compressibility with Prandtl–Glauert (subsonic) or Ackeret (supersonic).
 * Past the stall angle the upper-surface suction collapses.
 */
export function pressureMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 0.07 }, mach: { value: 0.5 }, stall: { value: 0 }, time: { value: 0 },
      tau: { value: 0.05 },
    },
    vertexShader: /* glsl */`
      attribute float chord; attribute float side;
      varying float vX; varying float vSide; varying vec3 vN; varying vec3 vV;
      void main() {
        vX = chord; vSide = side;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float alpha; uniform float mach; uniform float stall; uniform float time; uniform float tau;
      varying float vX; varying float vSide; varying vec3 vN; varying vec3 vV;
      vec3 diverge(float cp) {
        // suction (Cp < 0) → blue, ambient (0) → neutral grey, compression (Cp > 0) → red
        vec3 neutral = vec3(0.78, 0.79, 0.8);
        vec3 suck = vec3(0.13, 0.36, 0.86);
        vec3 deep = vec3(0.04, 0.12, 0.42);
        vec3 push = vec3(0.86, 0.24, 0.16);
        if (cp < 0.0) {
          float t = clamp(-cp / 1.6, 0.0, 1.0);
          return t < 0.6 ? mix(neutral, suck, t / 0.6) : mix(suck, deep, (t - 0.6) / 0.4);
        }
        return mix(neutral, push, clamp(cp / 0.9, 0.0, 1.0));
      }
      void main() {
        float x = clamp(vX, 0.004, 0.999);
        float a = alpha;
        float cp;
        if (mach < 0.95) {
          float pg = 1.0 / sqrt(max(1.0 - mach * mach, 0.12));
          float loading = 2.0 * a * sqrt((1.0 - x) / x);
          float thick = -2.2 * tau * (1.0 - abs(2.0 * x - 1.0)) + 0.9 * tau * smoothstep(0.03, 0.0, x);
          cp = (-vSide * loading + thick) * pg;
        } else {
          float ack = 2.0 / sqrt(max(mach * mach - 1.0, 0.09));
          cp = -vSide * a * ack + (x < 0.5 ? 1.0 : -1.0) * tau * ack * 0.8;
        }
        if (vSide > 0.0 && stall > 0.0) {
          // separated flow: suction collapses and flickers behind the separation point
          float sep = smoothstep(0.05, 0.35, x);
          cp = mix(cp, -0.25 + 0.15 * sin(time * 9.0 + x * 40.0), stall * sep);
        }
        vec3 col = diverge(cp);
        float lit = 0.55 + 0.45 * max(dot(normalize(vN), normalize(vec3(0.3, 0.8, 0.5))), 0.0);
        float rim = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 3.0);
        gl_FragColor = vec4(col * lit + rim * 0.08, 1.0);
      }`,
  });
}

export class RenderModes {
  constructor(stage) {
    this.stage = stage;
    this.mode = 'studio';
    this.focus = null;
    this.xray = holoMaterial(0x5fd4ff, 1.8, 0.06);
    this.xraySkin = holoMaterial(0x5fd4ff, 3.2, 0.006);
    this.sysSkin = holoMaterial(0x9fc3e6, 2.6, 0.008);
    this.sysMats = new Map();
    this.sysSel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5 });
    this.xraySel = holoMaterial(0xffb000, 1.5, 0.1);
    this.ghostMat = holoMaterial(0x8fb6d8, 2.6, 0.012);
    this.bpFill = new THREE.MeshBasicMaterial({ color: 0x0f3d6e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.bpFillSel = new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.bpLine = new THREE.LineBasicMaterial({ color: 0xd4ecff, transparent: true, opacity: 0.8 });
    this.bpLineSel = new THREE.LineBasicMaterial({ color: 0xffc640 });
    this.thermalMats = new Map();
    this.cp = pressureMaterial();
    this.cpBody = new THREE.MeshStandardMaterial({ color: 0x8e959c, roughness: 0.7, metalness: 0.1 });
    // Section cut (engine/section.js): its shared plane list; every material a mesh is given below is
    // handed to clipMaterial() with it, so the cut follows the mesh through every mode and vehicle.
    this.clippingPlanes = null;
  }

  /** X-ray material dimmed to weight w (0..1): dense rows of blades or vanes set a low weight, and
   *  density() lowers it for crowded spots, so the glow of many stacked layers stays readable. */
  xrayWeighted(w) {
    if (!(w < 1)) return this.xray;
    const k = Math.max(0.05, Math.round(w * 20) / 20);
    let mat = this.xrayDim?.get(k);
    if (!mat) {
      mat = holoMaterial(0x5fd4ff, 1.8, 0.06, k);
      (this.xrayDim || (this.xrayDim = new Map())).set(k, mat);
    }
    return mat;
  }

  /** Skin X-ray material dimmed to weight w; parts that set no xraySkinWeight get the standard faint skin. */
  xraySkinWeighted(w) {
    if (!(w < 1)) return this.xraySkin;
    const k = Math.max(0.05, Math.round(w * 20) / 20);
    let mat = this.xraySkinDim?.get(k);
    if (!mat) {
      mat = holoMaterial(0x5fd4ff, 3.2, 0.006, k);
      (this.xraySkinDim || (this.xraySkinDim = new Map())).set(k, mat);
    }
    return mat;
  }

  /**
   * How crowded each mesh's surroundings are, as an X-ray weight per mesh (cached on the vehicle):
   * the number n of other meshes whose world-space bounding boxes enclose the mesh's centre is
   * about how many surfaces a ray through that spot crosses, so the mesh's glow is scaled by
   * min(1, √(DENSE_N / (n + 1))). A box deep in a crowded bus or fuselage draws at a quarter of
   * the glow of an isolated panel or blade, and the sum over a dense stack grows as √n rather than n.
   * Skins keep their own faint weight: they are single surfaces that give the silhouette.
   */
  density(vehicle) {
    if (vehicle._xrayDensity) return vehicle._xrayDensity;
    const list = this.meshes(vehicle);
    vehicle.root.updateMatrixWorld(true);
    const boxes = [], centres = [], all = new THREE.Box3();
    for (const m of list) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      boxes.push(bb);
      centres.push(bb.getCenter(new THREE.Vector3()));
      all.union(bb);
    }
    const pad = all.getSize(new THREE.Vector3()).length() * 0.004;
    for (const bb of boxes) bb.expandByScalar(pad);
    const w = new Map();
    for (let i = 0; i < list.length; i++) {
      let n = 0;
      for (let j = 0; j < boxes.length; j++) if (j !== i && boxes[j].containsPoint(centres[i])) n++;
      w.set(list[i], Math.min(1, Math.sqrt(DENSE_N / (n + 1))));
    }
    vehicle._xrayDensity = w;
    return w;
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
      // a thermal imager sees emission, not reflected studio light: mostly emissive, faint shading
      this.thermalMats.set(key, new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.3), emissive: c, emissiveIntensity: 1.0, roughness: 0.85, metalness: 0, envMapIntensity: 0.12 }));
    }
    return this.thermalMats.get(key);
  }

  systemMaterial(system) {
    const c = systemColor(system);
    if (!this.sysMats.has(c)) {
      const col = new THREE.Color(c);
      this.sysMats.set(c, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.22, roughness: 0.55, metalness: 0.08 }));
    }
    return this.sysMats.get(c);
  }

  temperature(vehicle, mesh) {
    if (typeof mesh.userData.temp === 'function') return mesh.userData.temp();
    if (typeof mesh.userData.temp === 'number') return mesh.userData.temp;
    const p = partOf(mesh);
    const info = p?.userData.part;
    if (!info) return 288;
    return vehicle.temperatureOf ? vehicle.temperatureOf(info, mesh) : info.temp;
  }

  /** Restrict the full-colour render to a set of parts (guided tours); null clears it. */
  setFocus(vehicle, parts) {
    this.focus = parts && parts.length ? new Set(parts) : null;
    this.apply(vehicle, this.mode, this._sel);
  }

  apply(vehicle, mode = this.mode, selected = null) {
    this.mode = mode;
    this._sel = selected;
    if (!vehicle) return;
    const sel = selected;
    const inSel = (m) => sel && partOf(m) === sel;
    const focus = this.focus;
    const dens = mode === 'xray' ? this.density(vehicle) : null;
    for (const m of this.meshes(vehicle)) {
      const edges = m.userData.edges;
      const ghosted = focus && !focus.has(partOf(m));
      if (m.userData.decal) { m.visible = mode === 'studio' && !ghosted; clipMaterial(m.material, this.clippingPlanes); continue; }
      if (ghosted) {
        m.material = this.ghostMat;
        if (edges) edges.visible = false;
        m.castShadow = false;
        clipMaterial(m.material, this.clippingPlanes);
        continue;
      }
      if (mode === 'studio') {
        m.material = m.userData.studio;
        if (edges) edges.visible = false;
        m.castShadow = true;
      } else if (mode === 'xray') {
        const info = partOf(m)?.userData.part;
        const w = (m.userData.xrayWeight ?? info?.xrayWeight ?? 1) * (dens.get(m) ?? 1);
        m.material = inSel(m) ? this.xraySel : info?.skin ? this.xraySkinWeighted(info.xraySkinWeight) : this.xrayWeighted(w);
        if (edges) edges.visible = false;
        m.castShadow = false;
      } else if (mode === 'systems') {
        const info = partOf(m)?.userData.part;
        m.material = inSel(m) ? this.sysSel : info?.skin ? this.sysSkin : this.systemMaterial(info?.system);
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
      } else if (mode === 'pressure') {
        m.material = m.geometry.attributes.chord ? this.cp : this.cpBody;
        if (edges) edges.visible = false;
        m.castShadow = true;
      }
      clipMaterial(m.material, this.clippingPlanes);
      if (m.userData.edges) clipMaterial(m.userData.edges.material, this.clippingPlanes);
    }
    for (const fx of this.fxObjects(vehicle)) {
      if (fx.userData.keepInModes) continue;
      fx.material.visible = mode !== 'blueprint';
    }
    const env = this.stage.env;
    const overlay = mode === 'blueprint' ? 'blueprint' : mode === 'xray' || mode === 'systems' ? 'xray' : null;
    if (!env.space && env.overlay !== overlay && !this.stage.ascending) env.setOverlay(overlay);
    this.stage.lights.key.castShadow = !overlay;
    if (this.stage.ao) this.stage.ao.enabled = !overlay;
  }

  /** Drive the pressure shader from the current flight condition. */
  setFlow({ alphaDeg = 4, mach = 0.5, stall = 0, tau = 0.045 }) {
    const u = this.cp.uniforms;
    u.alpha.value = (alphaDeg * Math.PI) / 180;
    u.mach.value = mach;
    u.stall.value = stall;
    u.tau.value = tau;
  }

  tick(t) { this.cp.uniforms.time.value = t; }

  /** Re-evaluate thermal colours (temperatures change with flight condition / throttle). */
  refreshThermal(vehicle) {
    if (this.mode !== 'thermal' || !vehicle) return;
    for (const m of this.meshes(vehicle)) {
      if (m.userData.decal || (this.focus && !this.focus.has(partOf(m)))) continue;
      m.material = this.thermalMaterial(this.temperature(vehicle, m), vehicle.thermalRange || [200, 1200]);
      clipMaterial(m.material, this.clippingPlanes);
    }
  }
}

export { partOf };
