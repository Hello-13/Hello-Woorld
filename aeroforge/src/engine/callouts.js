// Leader-line callouts that track key parts in screen space (CSS2D overlay).
//
// Each callout is a dot on its part with a leader line to a label. layout() places the labels so
// they do not overlap one another or the interface panels: it tries the label up-right of its dot,
// then up-left, down-right, down-left, then stacked further up on either side, and keeps a label
// where it is for as long as that spot stays clear (so labels do not jump while the view moves).

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const DX = 22, DY = 18, GAP = 4;   // leader length (px) and spacing between stacked labels
// placement candidates: horizontal side (1 right, -1 left), vertical side (-1 up, 1 down), stack step
const SLOTS = [[1, -1, 0], [-1, -1, 0], [1, 1, 0], [-1, 1, 0], [1, -1, 1], [-1, -1, 1], [1, -1, 2], [-1, -1, 2], [1, 1, 1], [-1, 1, 1]];
const v = new THREE.Vector3();

export class Callouts {
  constructor(onClick) {
    this.onClick = onClick;
    this.objects = [];
    this.visible = true;
    this.obstacles = () => [];
  }

  attach(vehicle) {
    this.clear();
    this.muted = false;
    for (const part of vehicle.parts) {
      const info = part.userData.part;
      if (!info.callout || !info.anchor) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'callout';
      el.innerHTML = `<span class="callout-dot"></span><span class="callout-line"></span><span class="callout-text"></span>`;
      el.querySelector('.callout-text').textContent = info.name;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onClick(part); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      const obj = new CSS2DObject(el);
      obj.position.copy(info.anchor);
      obj.center.set(0, 0);
      part.add(obj);
      this.objects.push({ obj, el, part, text: el.querySelector('.callout-text'), line: el.querySelector('.callout-line'), slot: -1 });
    }
    this.setVisible(this.visible);
  }

  clear() {
    for (const { obj } of this.objects) {
      obj.element.remove();
      obj.parent?.remove(obj);
    }
    this.objects = [];
  }

  setVisible(v) {
    this.visible = v;
    for (const o of this.objects) o.obj.visible = v && !this.muted && (!this.filter || this.filter.has(o.part));
  }

  /** Temporarily hide every callout (e.g. while another label layer is showing). */
  setMuted(m) {
    this.muted = m;
    this.setVisible(this.visible);
  }

  /** Show only the callouts of these parts (null shows all). */
  setFilter(set) {
    this.filter = set;
    this.setVisible(this.visible);
  }

  setSelected(part) {
    for (const { el, part: p } of this.objects) el.classList.toggle('is-selected', p === part);
  }

  /** Lay the visible labels out without overlaps. width / height: the label layer in CSS pixels;
   *  obstacles(): screen rectangles [x0, y0, x1, y1] of interface panels to keep clear of. */
  layout(camera, width, height) {
    const live = this.objects.filter((o) => o.obj.visible && o.part.visible);
    if (!live.length) return;
    const placed = this.obstacles().slice();
    const items = [];
    for (const o of live) {
      o.obj.getWorldPosition(v).project(camera);
      if (v.z > 1) continue;
      if (!o.w && o.text.offsetWidth) { o.w = o.text.offsetWidth; o.h = o.text.offsetHeight; o.slot = -1; }   // measured once shown
      const w = o.w || 120, h = o.h || 20;
      items.push({ o, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, w, h });
    }
    items.sort((a, b) => a.y - b.y);                 // top to bottom: upper labels claim upward slots first
    const R = 7;                                     // every dot is kept clear of the other labels
    const dots = items.map((it) => [it.x - R, it.y - R, it.x + R, it.y + R]);
    const rectFor = (it, [sx, sy, k]) => {
      const lx = sx > 0 ? it.x + DX : it.x - DX - it.w;
      const ly = sy < 0 ? it.y - DY - it.h - k * (it.h + GAP) : it.y + DY + k * (it.h + GAP);
      return [lx, ly, lx + it.w, ly + it.h];
    };
    const overlap = (r, q) => {
      const ox = Math.min(r[2], q[2]) - Math.max(r[0], q[0]), oy = Math.min(r[3], q[3]) - Math.max(r[1], q[1]);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    };
    const cost = (r, self) => {
      let c = 0;
      for (const q of placed) c += overlap(r, q);
      for (let j = 0; j < dots.length; j++) if (j !== self) c += overlap(r, dots[j]) * 4;   // covering a dot hides a part's anchor
      const off = Math.max(0, -r[0]) + Math.max(0, r[2] - width) + Math.max(0, -r[1]) + Math.max(0, r[3] - height);
      return c + off * 400;
    };
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      let best = it.o.slot >= 0 ? it.o.slot : 0;
      let bestCost = cost(rectFor(it, SLOTS[best]), n);
      if (bestCost > 0) {
        for (let i = 0; i < SLOTS.length && bestCost > 0; i++) {
          const c = cost(rectFor(it, SLOTS[i]), n);
          if (c < bestCost) { best = i; bestCost = c; }
        }
      }
      const r = rectFor(it, SLOTS[best]);
      placed.push([r[0] - GAP, r[1] - GAP, r[2] + GAP, r[3] + GAP]);
      if (best !== it.o.slot) {
        it.o.slot = best;
        const [sx, sy, k] = SLOTS[best];
        const tx = r[0] - it.x, ty = r[1] - it.y;      // label box relative to the dot
        it.o.text.style.transform = `translate(${tx}px, ${ty}px)`;
        // leader from the dot to the label's nearest corner
        const ex = sx > 0 ? DX : -DX, ey = sy < 0 ? -DY - k * (it.h + GAP) : DY + k * (it.h + GAP);
        it.o.line.style.width = `${Math.hypot(ex, ey)}px`;
        it.o.line.style.transform = `rotate(${Math.atan2(ey, ex)}rad)`;
      }
    }
  }
}
