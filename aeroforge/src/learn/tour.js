// Guided-tour player: steps through a vehicle's lesson, choreographing camera, ghosting,
// render mode, exploded view and live demonstrations on the model.

import * as THREE from 'three';
import { TOURS } from './tours.js';
import { solidBounds } from '../engine/stage.js';
import { applyExplode } from '../engine/assembly.js';
import { el } from '../ui/dom.js';

export class TourPlayer {
  /**
   * hooks: { stage, modes, callouts, getVehicle, getLab, setMode, setExplode, log, onStart, onStop }
   */
  constructor(card, hooks) {
    this.card = card;
    this.h = hooks;
    this.steps = null;
    this.i = 0;
    this.demo = null;
    this.t = 0;
    card.addEventListener('keydown', (e) => e.stopPropagation());
  }

  get active() { return !!this.steps; }

  has(id) { return !!TOURS[id]; }

  start(id) {
    this.steps = TOURS[id];
    if (!this.steps) return;
    this.id = id;
    this.i = 0;
    this.h.onStart?.();
    this.h.log('LEARN', `Guided tour started · ${this.steps.length} steps`, 'ok');
    this.apply(0);
  }

  stop({ silent = false } = {}) {
    if (!this.steps) return;
    this.exitDemo();
    this.steps = null;
    this.card.hidden = true;
    const { modes, callouts } = this.h;
    modes.setFocus(this.h.getVehicle(), null);
    callouts.setFilter(null);
    this.h.setMode('studio', { quiet: true });
    this.h.setExplode(0);
    this.h.stage.frameVehicle(this.h.getVehicle());
    this.h.onStop?.();
    if (!silent) this.h.log('LEARN', 'Guided tour closed');
  }

  next() { if (this.steps && this.i < this.steps.length - 1) this.apply(this.i + 1); else this.stop(); }
  prev() { if (this.steps && this.i > 0) this.apply(this.i - 1); }

  apply(i) {
    if (!this.steps?.[i]) return;            // e.g. a stale progress dot clicked after the tour closed
    this.exitDemo();
    this.i = i;
    const step = this.steps[i];
    const v = this.h.getVehicle();
    const { modes, callouts, stage } = this.h;
    const focus = (step.focus || []).map((name) => v.parts.find((p) => p.userData.part.name === name)).filter(Boolean);
    this.h.setMode(step.mode || 'studio', { quiet: true });
    modes.setFocus(v, focus.length ? focus : null);
    callouts.setFilter(focus.length ? new Set(focus) : null);
    const explode = step.explode || 0;
    this.h.setExplode(explode, { instant: true });
    applyExplode(v.parts, explode);
    // aim the camera at the focused parts (or the whole vehicle) from the step's direction
    const box = new THREE.Box3();
    for (const p of focus.length ? focus : [v.root]) box.union(solidBounds(p));
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(...(step.view?.dir || v.view.dir)).normalize();
    const { tanV, tanH } = stage.frameTan();
    const fovV = 2 * Math.atan(tanV), fovH = 2 * Math.atan(tanH);
    const fill = step.view?.fill || 1;
    // a vertical view shift (phones) leaves roughly the upper half for the subject, so back off
    const room = 1 + (stage._shiftY || 0) * 2;
    const dist = Math.max(3, Math.max(sph.radius / Math.sin(fovV / 2), sph.radius / Math.sin(fovH / 2)) * fill * room * (focus.length ? 1.05 : 0.78));
    const target = sph.center.clone();
    if (step.view?.lift) target.y += sph.radius * step.view.lift;
    stage.flyTo(target.clone().addScaledVector(dir, Math.min(dist, stage.controls.maxDistance * 0.92)), target, 1.3);
    this.enterDemo(step.demo);
    this.render();
  }

  render() {
    const step = this.steps[this.i];
    const n = this.steps.length;
    const dots = el('ol', { class: 'tour-dots', 'aria-label': 'Tour progress' });
    for (let k = 0; k < n; k++) {
      const b = el('button', { type: 'button', class: 'tour-dot', 'aria-current': String(k === this.i), 'aria-label': `Step ${k + 1}: ${this.steps[k].title}` });
      b.addEventListener('click', () => this.apply(k));
      dots.append(el('li', {}, b));
    }
    const prev = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Back' });
    prev.disabled = this.i === 0;
    prev.addEventListener('click', () => this.prev());
    const next = el('button', { type: 'button', class: 'btn btn-primary', text: this.i === n - 1 ? 'Finish' : 'Next' });
    next.addEventListener('click', () => this.next());
    const close = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close guided tour', text: '×' });
    close.addEventListener('click', () => this.stop());
    // fold the text away to see the whole model; stays folded across steps
    const fold = el('button', { type: 'button', class: 'icon-btn', 'aria-expanded': String(!this.collapsed), 'aria-label': this.collapsed ? 'Show step text' : 'Hide step text', text: this.collapsed ? '+' : '–' });
    fold.addEventListener('click', () => { this.collapsed = !this.collapsed; this.render(); this.card.querySelector('.tour-actions .icon-btn')?.focus({ preventScroll: true }); });
    this.card.classList.toggle('is-collapsed', !!this.collapsed);
    this.card.replaceChildren(
      el('div', { class: 'tour-top' }, el('span', { class: 'tour-step', text: `Step ${this.i + 1} of ${n}` }), el('span', { class: 'tour-actions' }, fold, close)),
      el('h3', { class: 'tour-title', text: step.title }),
      el('p', { class: 'tour-body', text: step.body }),
      step.key ? el('p', { class: 'tour-key' }, el('span', { class: 'tour-key-label', text: 'Key idea' }), el('span', { text: step.key })) : null,
      el('div', { class: 'tour-nav' }, prev, dots, next),
    );
    this.card.hidden = false;
    next.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ demonstrations
  enterDemo(name) {
    this.demo = name || null;
    this.t = 0;
    const v = this.h.getVehicle();
    const lab = this.h.getLab();
    const api = lab?.api || {};
    this.restore = null;
    switch (name) {
      case 'bay': v.setBay?.(true); this.restore = () => v.setBay?.(false); break;
      case 'tvc': {
        const c = api.getCondition?.();
        api.setCondition?.({ throttle: 0.97 });
        this.restore = () => { api.setStick?.({ pitch: 0, roll: 0, yaw: 0 }); if (c) api.setCondition?.(c); };
        break;
      }
      case 'surfaces': this.restore = () => api.setStick?.({ pitch: 0, roll: 0, yaw: 0 }); break;
      case 'mach2': {
        const c = api.getCondition?.();
        api.setCondition?.({ mach: 2.0, altitude: 12000, throttle: 1, alpha: 3 });
        this.restore = () => { if (c) api.setCondition?.(c); };
        break;
      }
      case 'deploy': v.setDeploy?.(0.12); break;
      case 'flow': api.setDisplay?.({ flow: true, stations: true }); this.restore = () => api.setDisplay?.({ stations: false }); break;
      case 'laser': api.setLaser?.(true); this.restore = () => api.setLaser?.(false); break;
      default: break;
    }
  }

  exitDemo() {
    this.restore?.();
    this.restore = null;
    if (this.demo === 'deploy') this.h.getVehicle().setDeploy?.(1);
    this.demo = null;
  }

  update(dt) {
    if (!this.demo) return;
    this.t += dt;
    const t = this.t;
    const api = this.h.getLab()?.api || {};
    if (this.demo === 'surfaces') {
      const k = t % 7.5;
      api.setStick?.({
        roll: k < 2.5 ? Math.sin((k / 2.5) * Math.PI * 2) : 0,
        pitch: k >= 2.5 && k < 5 ? Math.sin(((k - 2.5) / 2.5) * Math.PI * 2) * 0.9 : 0,
        yaw: k >= 5 ? Math.sin(((k - 5) / 2.5) * Math.PI * 2) * 0.8 : 0,
      });
    } else if (this.demo === 'tvc') {
      api.setStick?.({ pitch: Math.sin(t * 1.6) * 0.9, roll: 0, yaw: 0 });
    } else if (this.demo === 'deploy' && t > 1.4 && t < 1.5) {
      this.h.getVehicle().setDeploy?.(1);
    }
  }
}
