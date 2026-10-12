// Leader-line callouts that track key parts in screen space (CSS2D overlay).

import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export class Callouts {
  constructor(onClick) {
    this.onClick = onClick;
    this.objects = [];
    this.visible = true;
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
      obj.center.set(0, 1);
      part.add(obj);
      this.objects.push({ obj, el, part });
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
    for (const { obj, part } of this.objects) obj.visible = v && !this.muted && (!this.filter || this.filter.has(part));
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
}
