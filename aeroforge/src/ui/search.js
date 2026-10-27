// Part search palette: a field over the stage that filters the vehicle's parts as you type
// (ranking in learn/search.js) and focuses the chosen part the way a click on the model does.

import { el } from './dom.js';
import { rankParts } from '../learn/search.js';

const FIELD_LABEL = { name: '', system: 'system', desc: 'in the description' };

export class PartSearch {
  /**
   * hooks: { getParts() → part groups, systemColor(name), onPick(group), onHover(group | null),
   *          onOpen(), onClose() }
   */
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.active = -1;
    this.rows = [];
    this.input = el('input', { type: 'search', class: 'search-input', placeholder: 'Find a part, system or description word', 'aria-label': 'Find a part', autocomplete: 'off', spellcheck: 'false', 'aria-controls': 'search-results', 'aria-expanded': 'false', role: 'combobox', 'aria-autocomplete': 'list' });
    this.list = el('ol', { class: 'search-results', id: 'search-results', role: 'listbox', 'aria-label': 'Matching parts' });
    this.hint = el('p', { class: 'search-hint' });
    const close = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close the part search', text: '×' });
    close.addEventListener('click', () => this.close());
    const glyph = el('span', { class: 'search-glyph', 'aria-hidden': 'true' });
    glyph.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="6.8" cy="6.8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.3 10.3 14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    root.replaceChildren(
      el('div', { class: 'search-field' }, glyph, this.input, el('kbd', { class: 'search-kbd', text: 'Esc' }), close),
      this.list, this.hint);
    this.input.addEventListener('input', () => this.update());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { this.move(1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.move(-1); e.preventDefault(); }
      else if (e.key === 'Enter') { if (this.rows.length) this.pick(this.rows[Math.max(0, this.active)].group); e.preventDefault(); }
      else if (e.key === 'Escape') { if (this.input.value) { this.input.value = ''; this.update(); } else this.close(); e.preventDefault(); }
      e.stopPropagation();
    });
    root.addEventListener('keydown', (e) => e.stopPropagation());
    root.addEventListener('pointerleave', () => this.h.onHover?.(null));
  }

  get open() { return !this.root.hidden; }

  show() {
    if (!this.open) { this.root.hidden = false; this.h.onOpen?.(); }
    this.update();
    this.input.focus({ preventScroll: true });
    this.input.select();
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  close() {
    if (!this.open) return;
    this.root.hidden = true;
    this.input.value = '';
    this.rows = [];
    this.list.replaceChildren();
    this.h.onHover?.(null);
    this.h.onClose?.();
  }

  /** A vehicle change empties the field (its parts are different). */
  reset() { this.input.value = ''; if (this.open) this.update(); }

  move(d) {
    if (!this.rows.length) return;
    this.setActive((this.active + d + this.rows.length) % this.rows.length);
  }

  setActive(i) {
    this.active = i;
    this.rows.forEach((r, k) => {
      r.el.setAttribute('aria-selected', String(k === i));
      if (k === i) r.el.scrollIntoView?.({ block: 'nearest' });
    });
    this.input.setAttribute('aria-activedescendant', this.rows[i]?.el.id || '');
    this.h.onHover?.(this.rows[i]?.group || null);
  }

  pick(group) {
    if (!group) return;
    this.h.onPick(group);
    this.close();
  }

  update() {
    const groups = this.h.getParts() || [];
    const q = this.input.value.trim();
    const records = groups.map((g) => g.userData.part);
    const hits = q ? rankParts(records, q, { limit: 14 }) : [];
    const byRecord = new Map(groups.map((g) => [g.userData.part, g]));
    this.rows = hits.map(({ part, field }, k) => {
      const group = byRecord.get(part);
      const b = el('button', { type: 'button', class: 'search-row', role: 'option', id: `search-opt-${k}`, 'aria-selected': 'false' },
        el('span', { class: 'sys-dot', style: `background:${this.h.systemColor(part.system)}` }),
        el('span', { class: 'sr-name', text: part.count > 1 ? `${part.name} ×${part.count}` : part.name }),
        el('span', { class: 'sr-sys', text: part.system }),
        FIELD_LABEL[field] ? el('span', { class: 'sr-field', text: FIELD_LABEL[field] }) : null);
      b.addEventListener('click', () => this.pick(group));
      b.addEventListener('pointerenter', () => this.setActive(k));
      return { el: b, group };
    });
    this.list.replaceChildren(...this.rows.map((r) => el('li', {}, r.el)));
    this.input.setAttribute('aria-expanded', String(this.rows.length > 0));
    this.hint.textContent = !q ? `${groups.length} parts · type to filter, ↑↓ to choose, Enter to focus`
      : this.rows.length ? `${this.rows.length === 14 ? '14+' : this.rows.length} ${this.rows.length === 1 ? 'match' : 'matches'} · Enter focuses the first`
        : 'No part matches that';
    this.list.hidden = !this.rows.length;
    this.active = -1;
    if (this.rows.length) this.setActive(0);
    else this.h.onHover?.(null);
  }
}
