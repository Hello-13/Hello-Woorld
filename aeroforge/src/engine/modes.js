// Render modes: STUDIO (PBR), X-RAY (fresnel hologram; skins faint so the interior reads),
// BLUEPRINT (edges on drafting blue), SYSTEMS (cutaway-poster colours by subsystem, skins
// ghosted), THERMAL (per-part temperature on an inferno scale) and PRESSURE (live pressure
// coefficient on lifting surfaces). A ghost overlay fades every part except the ones in focus.

import * as THREE from 'three';
import { xrayMaterial, inferno } from './effects.js';
import { systemColor } from './systems.js';

export const MODES = ['studio', 'xray', 'blueprint', 'systems', 'thermal', 'pressure'];

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
    this.xray = xrayMaterial(0x5fd4ff, 1.8, 0.06);
    this.xraySkin = xrayMaterial(0x5fd4ff, 3.2, 0.006);
    this.sysSkin = xrayMaterial(0x9fc3e6, 2.6, 0.008);
    this.sysMats = new Map();
    this.sysSel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5 });
    this.xraySel = xrayMaterial(0xffb000, 1.5, 0.1);
    this.ghostMat = xrayMaterial(0x8fb6d8, 2.6, 0.012);
    this.bpFill = new THREE.MeshBasicMaterial({ color: 0x0f3d6e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.bpFillSel = new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    this.bpLine = new THREE.LineBasicMaterial({ color: 0xd4ecff, transparent: true, opacity: 0.8 });
    this.bpLineSel = new THREE.LineBasicMaterial({ color: 0xffc640 });
    this.thermalMats = new Map();
    this.cp = pressureMaterial();
    this.cpBody = new THREE.MeshStandardMaterial({ color: 0x8e959c, roughness: 0.7, metalness: 0.1 });
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
    for (const m of this.meshes(vehicle)) {
      const edges = m.userData.edges;
      const ghosted = focus && !focus.has(partOf(m));
      if (m.userData.decal) { m.visible = mode === 'studio' && !ghosted; continue; }
      if (ghosted) {
        m.material = this.ghostMat;
        if (edges) edges.visible = false;
        m.castShadow = false;
        continue;
      }
      if (mode === 'studio') {
        m.material = m.userData.studio;
        if (edges) edges.visible = false;
        m.castShadow = true;
      } else if (mode === 'xray') {
        m.material = inSel(m) ? this.xraySel : partOf(m)?.userData.part.skin ? this.xraySkin : this.xray;
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
    }
  }
}

export { partOf };
