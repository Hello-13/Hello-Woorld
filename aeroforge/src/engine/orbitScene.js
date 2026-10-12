// Orbit view: dot-matrix Earth, parking / transfer / target orbits and an animated
// Hohmann transfer that follows Kepler's equation (fast at perigee, slow at apogee).

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { earthMaterial, atmosphereShell } from './effects.js';
import { glowTexture } from './materials.js';
import { RE, hohmann, positionOnEllipse } from '../physics/orbital.js';

const S = 2 / RE;     // scene units per km

function label(text, cls = 'orbit-label') {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  return new CSS2DObject(d);
}

export class OrbitScene {
  constructor(stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    this.group.visible = false;
    stage.scene.add(this.group);
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 64), earthMaterial());
    this.earth.rotation.y = -1.2;
    this.group.add(this.earth, atmosphereShell(2));
    this.lines = new THREE.Group();
    this.group.add(this.lines);
    this.sat = new THREE.Group();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc640, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.32);
    this.sat.add(glow);
    this.satLabel = label('SENTINEL-4', 'orbit-label is-sat');
    this.satLabel.position.set(0, 0.25, 0);
    this.sat.add(this.satLabel);
    this.group.add(this.sat);
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(this.flare);
    this.phase = 'parking';
    this.nu = 0.4;
    this.met = 0;
    this.pending = false;
    this.flareT = 0;
    this.listeners = {};
  }

  on(ev, fn) { this.listeners[ev] = fn; }
  emit(ev, data) { this.listeners[ev]?.(data); }

  attachModel(model) {
    if (this.model) this.sat.remove(this.model);
    this.model = model;
    model.scale.setScalar(0.03);
    this.sat.add(model);
  }

  configure(h1, h2, di) {
    this.cfg = { h1, h2, di, ...hohmann(h1, h2, di) };
    const { r1, r2, at, e } = this.cfg;
    for (const c of [...this.lines.children]) { this.lines.remove(c); c.geometry?.dispose(); c.traverse?.((o) => o.element?.remove()); }
    const inc = (di * Math.PI) / 180;
    this.qInit = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), inc);
    const circle = (r, color, q, opacity = 0.9) => {
      const pts = [];
      for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r * S, 0, -Math.sin(a) * r * S).applyQuaternion(q)); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      return l;
    };
    const ident = new THREE.Quaternion();
    this.lines.add(circle(r1, 0x5fd4ff, this.qInit));
    this.lines.add(circle(r2, 0xe8f0f8, ident, 0.7));
    // transfer half-ellipse in the initial plane: perigee at +x, apogee at −x
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const nu = (i / 200) * Math.PI;
      const r = (at * (1 - e * e)) / (1 + e * Math.cos(nu));
      pts.push(new THREE.Vector3(Math.cos(nu) * r * S, 0, -Math.sin(nu) * r * S).applyQuaternion(this.qInit));
    }
    const tl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffb000, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.95 }));
    tl.computeLineDistances();
    this.lines.add(tl);
    const l1 = label(`Parking orbit · ${Math.round(h1).toLocaleString('en-US')} km`);
    l1.position.set(0, 0, -r1 * S).applyQuaternion(this.qInit);
    const l2 = label(`Target orbit · ${Math.round(h2).toLocaleString('en-US')} km`);
    l2.position.set(0, 0, r2 * S);
    const b1 = label('Burn 1 · perigee', 'orbit-label is-burn');
    b1.position.set(r1 * S, 0.2, 0);
    const b2 = label('Burn 2 · apogee', 'orbit-label is-burn');
    b2.position.set(-r2 * S, 0.2, 0);
    this.lines.add(l1, l2, b1, b2);
    this.reset();
  }

  reset() { this.phase = 'parking'; this.nu = 0.4; this.met = 0; this.pending = false; this.tau = 0; }

  requestTransfer() {
    if (this.phase === 'final') this.reset();
    this.pending = true;
  }

  show(on) {
    this.group.visible = on;
    for (const c of this.lines.children) if (c.isCSS2DObject) c.visible = on;
    this.satLabel.visible = on;
  }

  frame(animate = true) {
    const r2 = this.cfg ? this.cfg.r2 * S : 10;
    const d = Math.max(9, r2 * 2.5);
    this.stage.flyTo(new THREE.Vector3(d * 0.35, d * 0.55, d * 0.85), new THREE.Vector3(0, 0, 0), animate ? 1.6 : 0);
  }

  burn(pos) {
    this.flare.position.copy(pos);
    this.flareT = 1;
  }

  update(dt) {
    if (!this.group.visible || !this.cfg) return;
    const c = this.cfg;
    this.earth.rotation.y += dt * 0.04;
    this.earth.material.uniforms.time.value += dt;
    const pos = new THREE.Vector3();
    if (this.phase === 'parking') {
      const prev = this.nu;
      this.nu += (Math.PI * 2 * dt) / 6;
      this.met += dt * (c.period1 / 6);
      if (this.pending && Math.floor(prev / (Math.PI * 2)) !== Math.floor(this.nu / (Math.PI * 2))) {
        this.phase = 'transfer';
        this.tau = 0;
        this.nu = 0;
        this.pending = false;
        pos.set(c.r1 * S, 0, 0);
        this.burn(pos);
        this.emit('burn1', c);
      }
      const r = c.r1 * S;
      pos.set(Math.cos(this.nu) * r, 0, -Math.sin(this.nu) * r).applyQuaternion(this.qInit);
    }
    if (this.phase === 'transfer') {
      this.tau += dt * (c.tof / 6);
      this.met += dt * (c.tof / 6);
      const { nu, r } = positionOnEllipse(c.at, c.e, Math.min(this.tau, c.tof));
      pos.set(Math.cos(nu) * r * S, 0, -Math.sin(nu) * r * S).applyQuaternion(this.qInit);
      if (this.tau >= c.tof) {
        this.phase = 'final';
        this.nu = Math.PI;
        this.burn(pos);
        this.emit('burn2', c);
      }
    } else if (this.phase === 'final') {
      this.nu += (Math.PI * 2 * dt) / 14;
      this.met += dt * (c.period2 / 14);
      pos.set(Math.cos(this.nu) * c.r2 * S, 0, -Math.sin(this.nu) * c.r2 * S);
    }
    this.sat.position.copy(pos);
    if (this.model) this.model.lookAt(0, 0, 0);
    if (this.flareT > 0) {
      this.flareT = Math.max(0, this.flareT - dt * 0.8);
      this.flare.material.opacity = this.flareT;
      this.flare.scale.setScalar(0.5 + (1 - this.flareT) * 2.5);
    }
  }
}
