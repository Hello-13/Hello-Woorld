// Small DOM helpers for instrument-style controls.

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

export const fmt = {
  n: (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'),
  pct: (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)} %` : '—'),
  time: (s) => {
    if (!Number.isFinite(s)) return '—';
    const sign = s < 0 ? '−' : '+';
    const a = Math.abs(s);
    const m = Math.floor(a / 60), ss = Math.floor(a % 60);
    return `T${sign}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  },
  hms: (s) => {
    if (!Number.isFinite(s)) return '—';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
    return `${h}h ${String(m).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`;
  },
};

let uid = 0;

/** Range slider with a live readout. */
export function slider({ label, min, max, step = 1, value, unit = '', format = (v) => fmt.n(v, step < 1 ? (step < 0.1 ? 2 : 1) : 0), onInput, id }) {
  const inputId = id || `ctl-${++uid}`;
  const out = el('output', { for: inputId, class: 'ctl-value' });
  const input = el('input', { type: 'range', id: inputId, min, max, step, value });
  const set = (v, silent) => {
    input.value = v;
    out.textContent = `${format(+input.value)}${unit ? ` ${unit}` : ''}`;
    if (!silent) onInput?.(+input.value);
  };
  input.addEventListener('input', () => set(input.value));
  const node = el('div', { class: 'ctl' }, el('label', { for: inputId, class: 'ctl-head' }, el('span', { class: 'ctl-label', text: label }), out), input);
  set(value, true);
  return { el: node, input, set, get: () => +input.value };
}

/** Two-state switch button. */
export function toggle({ label, value = false, onChange, id }) {
  const b = el('button', { type: 'button', class: 'toggle', 'aria-pressed': String(value), id: id || `tg-${++uid}` },
    el('span', { class: 'toggle-led', 'aria-hidden': 'true' }), el('span', { text: label }));
  const set = (v, silent) => {
    b.setAttribute('aria-pressed', String(!!v));
    if (!silent) onChange?.(!!v);
  };
  b.addEventListener('click', () => set(b.getAttribute('aria-pressed') !== 'true'));
  return { el: b, set, get: () => b.getAttribute('aria-pressed') === 'true' };
}

/** Segmented control (radio group). */
export function segmented({ options, value, onChange, label }) {
  const wrap = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map(([v, text]) => {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), class: 'seg-btn', 'data-value': v, text });
    b.addEventListener('click', () => { set(v); });
    wrap.append(b);
    return b;
  });
  const set = (v, silent) => {
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.value === String(v)));
    if (!silent) onChange?.(v);
  };
  return { el: wrap, set };
}

/**
 * Grid of labelled readouts. items: [{ key, label, unit }]
 * set(key, text, state) where state ∈ ok | warn | crit | undefined.
 */
export function readouts(items, { cols = 2 } = {}) {
  const grid = el('dl', { class: `readouts cols-${cols}` });
  const map = {};
  for (const it of items) {
    const v = el('dd', { class: 'ro-value' }, el('span', { class: 'ro-num', text: '—' }), it.unit ? el('span', { class: 'ro-unit', text: it.unit }) : null);
    const row = el('div', { class: 'ro' }, el('dt', { class: 'ro-label', text: it.label }), v);
    grid.append(row);
    map[it.key] = { row, num: v.querySelector('.ro-num') };
  }
  return {
    el: grid,
    set(key, text, state) {
      const r = map[key];
      if (!r) return;
      if (r.num.textContent !== text) r.num.textContent = text;
      r.row.dataset.state = state || '';
    },
  };
}

export function section(title, ...children) {
  return el('section', { class: 'lab-section' }, el('h3', { class: 'lab-h', text: title }), ...children);
}

export function button(label, onClick, { kind = 'secondary', id } = {}) {
  return el('button', { type: 'button', class: `btn btn-${kind}`, id, onclick: onClick, text: label });
}
