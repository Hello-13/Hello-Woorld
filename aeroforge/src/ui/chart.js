// Canvas line chart: one y-axis, hairline grid, 2 px lines with a 10 % area wash,
// ringed end-markers, event markers, crosshair/nearest-point tooltip and a data table.

import { el } from './dom.js';

function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (max - min < 1e-9) { max = min + 1; }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) ticks.push(+v.toPrecision(12));
  return { min: lo, max: hi, ticks };
}
const compact = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(0)}K`;
  if (a >= 1000) return `${+(v / 1e3).toFixed(1)}K`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return +v.toFixed(1) + '';
  return +v.toFixed(2) + '';
};

export class LineChart {
  /**
   * opts: { title, xLabel, yLabel, series: [{ key, label, color, area }], mode: 'x' | 'nearest',
   *         xFormat, yFormat, height, tableRows: number }
   */
  constructor(opts) {
    this.o = { mode: 'x', height: 170, xFormat: compact, yFormat: compact, tableRows: 10, ...opts };
    this.data = {};
    this.extra = {};
    const legend = this.o.series.length > 1
      ? el('ul', { class: 'chart-legend' }, this.o.series.map((s) => el('li', {}, el('span', { class: 'key-line', style: `background:${s.color}` }), el('span', { text: s.label }))))
      : null;
    this.canvas = el('canvas', { class: 'chart-canvas', role: 'img', 'aria-label': this.o.title });
    this.tip = el('div', { class: 'chart-tip', hidden: true });
    this.table = el('table', { class: 'chart-table' });
    this.el = el('figure', { class: 'chart' },
      el('figcaption', { class: 'chart-head' }, el('span', { class: 'chart-title', text: this.o.title }), legend),
      el('div', { class: 'chart-plot', style: `height:${this.o.height}px` }, this.canvas, this.tip),
      el('details', { class: 'chart-data' }, el('summary', { text: 'Data table' }), el('div', { class: 'chart-table-wrap' }, this.table)));
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
    this.canvas.addEventListener('pointermove', (e) => this.hover(e));
    this.canvas.addEventListener('pointerleave', () => { this.tip.hidden = true; this.hoverX = null; this.draw(); });
  }

  /** data: { [seriesKey]: [{x, y}] }; extra: { xDomain, yDomain, markers, cursor, points, zero } */
  setData(data, extra = {}) {
    this.data = data;
    this.extra = extra;
    this.draw();
    this.dirtyTable = true;
    if (this.el.querySelector('details').open || !this.tableBuilt) this.buildTable();
  }

  buildTable() {
    this.tableBuilt = true;
    const s0 = this.o.series[0];
    const rows = this.data[s0.key] || [];
    const n = Math.min(this.o.tableRows, rows.length);
    const head = el('tr', {}, el('th', { scope: 'col', text: this.o.xLabel }), this.o.series.map((s) => el('th', { scope: 'col', text: `${s.label}${this.o.yLabel ? ` (${this.o.yLabel})` : ''}` })));
    const body = [];
    for (let i = 0; i < n; i++) {
      const idx = n > 1 ? Math.round((i / (n - 1)) * (rows.length - 1)) : 0;
      const x = rows[idx]?.x;
      body.push(el('tr', {}, el('td', { text: this.o.xFormat(x) }), this.o.series.map((s) => {
        const p = (this.data[s.key] || [])[idx];
        return el('td', { text: p && Number.isFinite(p.y) ? this.o.yFormat(p.y) : '—' });
      })));
    }
    this.table.replaceChildren(el('thead', {}, head), el('tbody', {}, body));
  }

  tokens() {
    const cs = getComputedStyle(this.el);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    return {
      surface: v('--panel', '#0c131b'), grid: v('--grid', '#172331'), axis: v('--line', '#1f2e3e'),
      text: v('--text', '#d6e1ea'), muted: v('--muted', '#7f93a8'), font: v('--font-data', 'monospace'),
    };
  }

  layout() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { w, h, l: 44, r: 14, t: 16, b: 30 };
  }

  domain() {
    const xs = [], ys = [];
    for (const s of this.o.series) for (const p of this.data[s.key] || []) {
      if (Number.isFinite(p.x)) xs.push(p.x);
      if (Number.isFinite(p.y)) ys.push(p.y);
    }
    for (const p of this.extra.points || []) { xs.push(p.x); ys.push(p.y); }
    let [x0, x1] = this.extra.xDomain || [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = this.extra.yDomain || [Math.min(...ys), Math.max(...ys)];
    if (this.extra.zero) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    if (!Number.isFinite(y0)) { y0 = 0; y1 = 1; }
    const yt = niceTicks(y0, y1, 4);
    const xt = this.extra.xDomain ? { min: x0, max: x1, ticks: niceTicks(x0, x1, 5).ticks.filter((t) => t >= x0 - 1e-9 && t <= x1 + 1e-9) } : niceTicks(x0, x1, 5);
    return { xt, yt };
  }

  draw() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h, l, r, t, b } = this.layout();
    if (w < 10 || h < 10) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const k = this.tokens();
    const { xt, yt } = this.domain();
    this.scale = { xt, yt, l, r, t, b, w, h };
    const X = (x) => l + ((x - xt.min) / (xt.max - xt.min || 1)) * (w - l - r);
    const Y = (y) => t + (1 - (y - yt.min) / (yt.max - yt.min || 1)) * (h - t - b);
    this.X = X; this.Y = Y;

    // grid + y ticks
    ctx.font = `11px ${k.font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    for (const v of yt.ticks) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = v === 0 && this.extra.zero ? k.muted : k.grid;
      ctx.globalAlpha = v === 0 && this.extra.zero ? 0.55 : 1;
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(w - r, y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = k.muted;
      ctx.fillText(this.o.yFormat(v), l - 6, y);
    }
    // x ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of xt.ticks) {
      const x = X(v);
      ctx.fillStyle = k.muted;
      ctx.fillText(this.o.xFormat(v), x, h - b + 6);
    }
    ctx.strokeStyle = k.axis;
    ctx.beginPath(); ctx.moveTo(l, h - b + 0.5); ctx.lineTo(w - r, h - b + 0.5); ctx.stroke();
    // axis titles
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = k.muted;
    ctx.fillText(this.o.xLabel, w - r, h - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (this.o.yLabel) ctx.fillText(this.o.yLabel, 2, 0);

    // event markers
    for (const m of this.extra.markers || []) {
      if (m.x < xt.min || m.x > xt.max) continue;
      const x = Math.round(X(m.x)) + 0.5;
      ctx.strokeStyle = k.muted; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, h - b); ctx.stroke();
      ctx.globalAlpha = 1;
      if (m.label) {
        ctx.save();
        ctx.translate(x + 3, t + 1);
        ctx.fillStyle = k.muted;
        ctx.font = `10px ${k.font}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(m.label, 0, 0);
        ctx.restore();
      }
    }

    // series (clipped to the plot area so a fixed y-domain can crop extremes)
    ctx.save();
    ctx.beginPath(); ctx.rect(l, t - 6, w - l - r, h - t - b + 6); ctx.clip();
    const y0px = Y(Math.max(yt.min, Math.min(0, yt.max)));
    for (const s of this.o.series) {
      const pts = this.data[s.key] || [];
      if (!pts.length) continue;
      const segs = [];
      let cur = [];
      for (const p of pts) {
        if (Number.isFinite(p.y) && Number.isFinite(p.x)) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        if (s.area !== false && this.o.mode === 'x') {
          ctx.beginPath();
          ctx.moveTo(X(seg[0].x), y0px);
          for (const p of seg) ctx.lineTo(X(p.x), Y(p.y));
          ctx.lineTo(X(seg[seg.length - 1].x), y0px);
          ctx.closePath();
          ctx.fillStyle = s.color; ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        seg.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
      }
      if (this.extra.endDot && segs.length) {
        const last = segs[segs.length - 1].at(-1);
        this.dot(ctx, X(last.x), Y(last.y), s.color, k.surface);
      }
    }

    ctx.restore();

    // labelled points (e.g. cycle stations)
    for (const p of this.extra.points || []) {
      const s = this.o.series.find((q) => q.key === p.series) || this.o.series[0];
      const px = X(p.x), py = Y(p.y);
      this.dot(ctx, px, py, s.color, k.surface);
      if (p.label) {
        ctx.font = `600 11px ${k.font}`;
        ctx.fillStyle = k.text;
        ctx.textAlign = p.align || 'left'; ctx.textBaseline = 'middle';
        const dx = p.align === 'right' ? -8 : 8;
        ctx.fillText(p.label, Math.min(w - r - 4, Math.max(l + 4, px + dx)), py + (p.dy || 0));
      }
    }

    // cursor (current condition)
    const cx = this.extra.cursor?.x;
    if (Number.isFinite(cx) && cx >= xt.min && cx <= xt.max) {
      const x = Math.round(X(cx)) + 0.5;
      ctx.strokeStyle = k.text; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, h - b); ctx.stroke();
      ctx.globalAlpha = 1;
      for (const s of this.o.series) {
        const y = this.valueAt(s.key, cx);
        if (Number.isFinite(y) && y >= yt.min && y <= yt.max) this.dot(ctx, X(cx), Y(y), s.color, k.surface);
      }
      if (this.extra.cursor.label) {
        ctx.font = `600 11px ${k.font}`;
        ctx.fillStyle = k.text;
        const right = x > w * 0.7;
        ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'top';
        ctx.fillText(this.extra.cursor.label, x + (right ? -6 : 6), t + 2);
      }
    }

    // hover crosshair
    if (this.hoverX != null && this.o.mode === 'x') {
      const x = Math.round(X(this.hoverX)) + 0.5;
      ctx.strokeStyle = k.muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, h - b); ctx.stroke();
      ctx.globalAlpha = 1;
      for (const s of this.o.series) {
        const y = this.valueAt(s.key, this.hoverX);
        if (Number.isFinite(y)) this.dot(ctx, X(this.hoverX), Y(y), s.color, k.surface);
      }
    }
  }

  dot(ctx, x, y, color, surface) {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = surface; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }

  valueAt(key, x) {
    const pts = (this.data[key] || []).filter((p) => Number.isFinite(p.y));
    if (!pts.length) return NaN;
    if (x < pts[0].x || x > pts[pts.length - 1].x) return NaN;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].x <= x) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    return a.y + ((b.y - a.y) * (x - a.x)) / ((b.x - a.x) || 1);
  }

  hover(e) {
    if (!this.scale) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const { xt, l, r, w } = this.scale;
    const rows = [];
    let tipX = px;
    if (this.o.mode === 'x') {
      const x = xt.min + ((px - l) / (w - l - r)) * (xt.max - xt.min);
      if (x < xt.min || x > xt.max) { this.tip.hidden = true; this.hoverX = null; this.draw(); return; }
      this.hoverX = x;
      for (const s of this.o.series) rows.push([s, this.valueAt(s.key, x)]);
      this.renderTip(this.o.xFormat(x), rows, tipX, py);
    } else {
      let best = null, bd = 28 * 28;
      for (const s of this.o.series) for (const p of this.data[s.key] || []) {
        const d = (this.X(p.x) - px) ** 2 + (this.Y(p.y) - py) ** 2;
        if (d < bd) { bd = d; best = { s, p }; }
      }
      for (const p of this.extra.points || []) {
        const d = (this.X(p.x) - px) ** 2 + (this.Y(p.y) - py) ** 2;
        if (d < bd) { bd = d; best = { s: this.o.series.find((q) => q.key === p.series) || this.o.series[0], p }; }
      }
      if (!best) { this.tip.hidden = true; return; }
      this.renderTip(best.p.name || `${this.o.xLabel} ${this.o.xFormat(best.p.x)}`, [[best.s, best.p.y]], this.X(best.p.x), this.Y(best.p.y));
    }
    this.draw();
  }

  renderTip(head, rows, x, y) {
    this.tip.replaceChildren(
      el('div', { class: 'tip-head', text: head }),
      ...rows.map(([s, v]) => el('div', { class: 'tip-row' },
        el('span', { class: 'key-line', style: `background:${s.color}` }),
        el('strong', { text: Number.isFinite(v) ? `${this.o.yFormat(v)}${this.o.yUnit ? ` ${this.o.yUnit}` : ''}` : '—' }),
        el('span', { class: 'tip-series', text: s.label }))),
    );
    this.tip.hidden = false;
    const w = this.canvas.clientWidth;
    const tw = this.tip.offsetWidth;
    this.tip.style.left = `${Math.min(w - tw - 4, Math.max(4, x + 12))}px`;
    this.tip.style.top = `${Math.max(4, y - 36)}px`;
  }
}
