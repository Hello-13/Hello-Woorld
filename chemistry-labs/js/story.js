'use strict';
/* Storyboard engine: captioned, step-by-step particle animations on canvas.
   World coordinates are 100 × 50. A frame lists atoms (by id), bonds and extras (text, arrows,
   rings, photons); stepping between frames tweens every atom that exists in both, fades the rest,
   and lets bonds break and form. Electrons can orbit. Everything respects prefers-reduced-motion. */

const ATOM_LOOK = {
  H: ['#f1f3f5', 1.8], C: ['#4a5058', 2.6], N: ['#3d6fe0', 2.55], O: ['#e2483d', 2.5], F: ['#8fd85f', 2.3], Cl: ['#41b84c', 3.1],
  Na: ['#9b7cf0', 3.2], K: ['#9b7cf0', 3.5], Mg: ['#7fbf4d', 3.0], Al: ['#b8bcc4', 2.9], Li: ['#c08af0', 3.0], He: ['#5ac6d9', 1.8],
  Zn: ['#8d99a6', 3.1], Cu: ['#d9824a', 3.0], S: ['#e5c22e', 3.1], U: ['#5b8f3a', 5],
  p: ['#e8633f', 1.45], n: ['#a3adb6', 1.45], e: ['#3d7bf0', 0.85], X: ['#9aa4ad', 2.2],
};
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0) / 4294967295; };
const REDUCE = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- authoring helpers ---- */
const MOLS = {
  H2: [[['H', -1.8, 0], ['H', 1.8, 0]], [[0, 1, 1]]],
  O2: [[['O', -2.4, 0], ['O', 2.4, 0]], [[0, 1, 2]]],
  N2: [[['N', -2.3, 0], ['N', 2.3, 0]], [[0, 1, 3]]],
  Cl2: [[['Cl', -3, 0], ['Cl', 3, 0]], [[0, 1, 1]]],
  H2O: [[['O', 0, 0], ['H', -3, 2.3], ['H', 3, 2.3]], [[0, 1, 1], [0, 2, 1]]],
  CO2: [[['C', 0, 0], ['O', -5, 0], ['O', 5, 0]], [[0, 1, 2], [0, 2, 2]]],
  CH4: [[['C', 0, 0], ['H', 0, -4.2], ['H', 4.2, 0], ['H', 0, 4.2], ['H', -4.2, 0]], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]],
  NH3: [[['N', 0, 0], ['H', -3.6, 2.4], ['H', 3.6, 2.4], ['H', 0, -4]], [[0, 1, 1], [0, 2, 1], [0, 3, 1]]],
  HCl: [[['H', -2.8, 0], ['Cl', 1.8, 0]], [[0, 1, 1]]],
  HF: [[['H', -2.4, 0], ['F', 1.4, 0]], [[0, 1, 1]]],
};
const MOL_SCALE = 1.5;
/* Molecule part: ids is a prefix string or an array of ids in template order */
function M(kind, x, y, ids, rot = 0, o = {}) {
  const [atoms, bonds] = MOLS[kind];
  const idl = Array.isArray(ids) ? ids : atoms.map((_, i) => `${ids}.${i}`);
  const c = Math.cos(rot), s = Math.sin(rot);
  return {
    atoms: atoms.map(([el, dx, dy], i) => ({ id: idl[i], el, x: x + (dx * c - dy * s) * MOL_SCALE, y: y + (dx * s + dy * c) * MOL_SCALE, ...(o[i] || {}) })),
    bonds: bonds.map(([a, b, n]) => [idl[a], idl[b], n]),
  };
}
const A = (id, el, x, y, o = {}) => ({ atoms: [{ id, el, x, y, ...o }] });
const B = (a, b, n = 1) => ({ bonds: [[a, b, n]] });
const T = (id, x, y, s, o = {}) => ({ extras: [{ type: 'text', id, x, y, s, ...o }] });
const Ar = (id, x1, y1, x2, y2, o = {}) => ({ extras: [{ type: 'arrow', id, x1, y1, x2, y2, ...o }] });
const Ring = (id, x, y, r, o = {}) => ({ extras: [{ type: 'ring', id, x, y, r, ...o }] });
const Ph = (id, x1, y1, x2, y2, color, o = {}) => ({ extras: [{ type: 'photon', id, x1, y1, x2, y2, color, ...o }] });
const Box = (id, x, y, w, h, o = {}) => ({ extras: [{ type: 'box', id, x, y, w, h, ...o }] });
/* Packed nucleus of protons and neutrons */
function nucleus(prefix, np, nn, cx, cy, spread = 1.3, rad) {
  const total = np + nn, atoms = [], pairs = 2 * Math.min(np, nn);
  for (let i = 0; i < total; i++) {
    const isP = i < pairs ? i % 2 === 0 : np > nn, r = spread * Math.sqrt(i), a = i * 2.39996;
    atoms.push({ id: `${prefix}.${i}`, el: isP ? 'p' : 'n', x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), ...(rad ? { r: rad } : {}) });
  }
  return { atoms };
}
/* Electron that orbits (cx, cy) at radius r, starting at angle phase */
const E = (id, cx, cy, r, phase = 0, speed = 0.9, o = {}) => A(id, 'e', cx + r * Math.cos(phase), cy + r * Math.sin(phase), { orb: [cx, cy, r, phase, speed], ...o });
function F(cap, parts, o = {}) {
  const f = { cap, atoms: new Map(), bonds: new Map(), extras: new Map(), hl: o.hl || [], hold: o.hold, still: o.still };
  for (const p of [parts].flat(Infinity)) {
    if (!p) continue;
    (p.atoms || []).forEach(a => f.atoms.set(a.id, a));
    (p.bonds || []).forEach(([a, b, n]) => f.bonds.set([a, b].sort().join('|') + '|' + n, { a, b, n }));
    (p.extras || []).forEach(x => f.extras.set(x.id, x));
  }
  return f;
}

/* ---- the player ---- */
function Storyboard(root, frames, opts = {}) {
  const reduce = REDUCE();
  let idx = 0, from = frames[0], to = frames[0], t0 = 0, tween = 1, playing = false, holdUntil = 0, raf = 0, stopped = false, seen = false;
  const TWEEN = reduce ? 0 : (opts.tween || 1100);
  root.classList.add('story');
  root.innerHTML = `<div class="canvas-wrap story-stage"><canvas aria-hidden="true"></canvas></div>
    ${opts.compact ? '' : `<div class="story-bar">
      <button type="button" class="btn ghost sb-prev" aria-label="Previous step">◀</button>
      <button type="button" class="btn sb-play">Play</button>
      <button type="button" class="btn ghost sb-next" aria-label="Next step">▶</button>
      <div class="sb-dots" role="tablist" aria-label="Steps">${frames.map((_, i) => `<button type="button" role="tab" data-i="${i}" aria-label="Step ${i + 1}"></button>`).join('')}</div>
    </div>
    <p class="story-cap" aria-live="polite"></p>`}`;
  const canvas = root.querySelector('canvas'), cap = root.querySelector('.story-cap'), playB = root.querySelector('.sb-play');
  const cv = makeCanvas(canvas, w => opts.aspect ? w * opts.aspect : Math.max(190, Math.min(380, w * 0.5)), draw);

  function posOf(a, now) {
    if (a.orb && !reduce && !from.still && !to.still) { const [cx, cy, r, ph, sp] = a.orb, ang = ph + now / 1000 * sp; return [cx + r * Math.cos(ang), cy + r * Math.sin(ang) * 0.92]; }
    return [a.x, a.y];
  }
  function state(now) {
    const k = ease(Math.min(1, tween)), atoms = new Map();
    const ids = new Set([...from.atoms.keys(), ...to.atoms.keys()]);
    for (const id of ids) {
      const a = from.atoms.get(id), b = to.atoms.get(id);
      const look = ATOM_LOOK[(b || a).el] || ATOM_LOOK.X;
      if (a && b) {
        const [ax, ay] = posOf(a, now), [bx, by] = posOf(b, now);
        atoms.set(id, { ...(k < 0.5 ? a : b), x: lerp(ax, bx, k), y: lerp(ay, by, k), r: lerp(a.r ?? (ATOM_LOOK[a.el] || look)[1], b.r ?? look[1], k), o: lerp(a.o ?? 1, b.o ?? 1, k) });
      } else if (b) { const [bx, by] = posOf(b, now); atoms.set(id, { ...b, x: bx, y: by, r: (b.r ?? look[1]) * (0.4 + 0.6 * k), o: (b.o ?? 1) * k }); }
      else { const [ax, ay] = posOf(a, now); atoms.set(id, { ...a, x: ax, y: ay, r: a.r ?? (ATOM_LOOK[a.el] || look)[1], o: (a.o ?? 1) * (1 - k) }); }
    }
    const bonds = [];
    for (const key of new Set([...from.bonds.keys(), ...to.bonds.keys()])) {
      // bonds break early in a move and form only as atoms arrive
      const bd = to.bonds.get(key) || from.bonds.get(key), o = to.bonds.has(key) && from.bonds.has(key) ? 1 : to.bonds.has(key) ? Math.max(0, (k - 0.7) / 0.3) : Math.max(0, 1 - k / 0.3);
      if (atoms.has(bd.a) && atoms.has(bd.b) && o > 0.01) bonds.push({ ...bd, o });
    }
    const extras = [];
    for (const id of new Set([...from.extras.keys(), ...to.extras.keys()])) {
      const a = from.extras.get(id), b = to.extras.get(id);
      if (a && b) { const m = { ...(k < 0.5 ? a : b), o: 1 }; ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'w', 'h'].forEach(p => { if (p in a && p in b) m[p] = lerp(a[p], b[p], k); }); extras.push(m); }
      else extras.push({ ...(a || b), o: b ? k : 1 - k });
    }
    return { atoms, bonds, extras };
  }
  function draw(ctx, w, h) {
    const now = performance.now();
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / 100, h / 50), ox = (w - 100 * s) / 2, oy = (h - 50 * s) / 2;
    const X = x => ox + x * s, Y = y => oy + y * s;
    const st = state(now), ink = tok('ink'), muted = tok('muted');
    const jig = (id, axis) => (reduce || to.still ? 0 : Math.sin(now / 1000 * (1.7 + hash(id + axis) * 1.6) + hash(id) * 6.28) * 0.22);
    const P = a => [X(a.x + jig(a.id, 'x')), Y(a.y + jig(a.id, 'y'))];
    const col = c => (c && c.startsWith('--') ? tok(c.slice(2)) : c) || ink;
    // rings and boxes first
    for (const x of st.extras) {
      ctx.globalAlpha = x.o;
      if (x.type === 'ring') { ctx.setLineDash([3, 4]); ctx.strokeStyle = col(x.color) || muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(X(x.x), Y(x.y), x.r * s, x.r * s * 0.92, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      if (x.type === 'box') { ctx.fillStyle = col(x.fill || '--c1'); ctx.globalAlpha = x.o * (x.alpha ?? 0.1); ctx.beginPath(); ctx.roundRect(X(x.x), Y(x.y), x.w * s, x.h * s, 6); ctx.fill(); if (x.stroke) { ctx.globalAlpha = x.o * 0.6; ctx.strokeStyle = col(x.stroke); ctx.lineWidth = 1.5; ctx.stroke(); } }
    }
    // bonds
    for (const b of st.bonds) {
      const A1 = st.atoms.get(b.a), B1 = st.atoms.get(b.b); const [x1, y1] = P(A1), [x2, y2] = P(B1);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, gap = 2.6;
      ctx.globalAlpha = b.o * Math.min(A1.o, B1.o); ctx.strokeStyle = muted; ctx.lineWidth = Math.max(1.6, s * 0.55); ctx.lineCap = 'round';
      const offs = b.n === 1 ? [0] : b.n === 2 ? [-gap, gap] : [-gap * 1.6, 0, gap * 1.6];
      for (const o of offs) { ctx.beginPath(); ctx.moveTo(x1 + nx * o, y1 + ny * o); ctx.lineTo(x2 + nx * o, y2 + ny * o); ctx.stroke(); }
    }
    // arrows and photons
    for (const x of st.extras) {
      ctx.globalAlpha = x.o;
      if (x.type === 'arrow') {
        const x1 = X(x.x1), y1 = Y(x.y1), x2 = X(x.x2), y2 = Y(x.y2), a = Math.atan2(y2 - y1, x2 - x1), hd = Math.max(6, s * 1.6);
        ctx.strokeStyle = ctx.fillStyle = col(x.color) || muted; ctx.lineWidth = Math.max(1.5, s * 0.4); if (x.dashed) ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hd * 0.6, y2 - Math.sin(a) * hd * 0.6); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hd * Math.cos(a - 0.45), y2 - hd * Math.sin(a - 0.45)); ctx.lineTo(x2 - hd * Math.cos(a + 0.45), y2 - hd * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
      }
      if (x.type === 'photon') {
        const x1 = X(x.x1), y1 = Y(x.y1), x2 = X(x.x2), y2 = Y(x.y2), L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1), ph = reduce ? 0 : now / 120;
        ctx.save(); ctx.translate(x1, y1); ctx.rotate(a); ctx.strokeStyle = x.color; ctx.lineWidth = 2.4; ctx.beginPath();
        const wl = x.wl || 7;
        for (let d = 0; d <= L; d += 1.5) { const yy = Math.sin(d / wl * 2 * Math.PI / 1 - ph) * s * 1.1 * Math.min(1, d / 10, (L - d) / 10); d ? ctx.lineTo(d, yy) : ctx.moveTo(d, yy); }
        ctx.stroke(); ctx.fillStyle = x.color; ctx.beginPath(); ctx.moveTo(L + 2, 0); ctx.lineTo(L - 7, -5); ctx.lineTo(L - 7, 5); ctx.fill(); ctx.restore();
      }
    }
    // atoms (big first so electrons sit on top)
    const list = [...st.atoms.values()].sort((a, b) => b.r - a.r);
    for (const a of list) {
      if (a.o <= 0.01) continue;
      const [x, y] = P(a), r = a.r * s, look = ATOM_LOOK[a.el] || ATOM_LOOK.X, c = a.color || look[0];
      ctx.globalAlpha = a.o;
      if (to.hl.includes(a.id) && tween >= 1 && !reduce) { ctx.strokeStyle = tok('c2'); ctx.lineWidth = 2; ctx.globalAlpha = a.o * (0.5 + 0.5 * Math.sin(now / 220)); ctx.beginPath(); ctx.arc(x, y, r + 4 + 2 * Math.sin(now / 220), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = a.o; }
      const g = ctx.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.05, x, y, r * 1.05);
      g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.22, c); g.addColorStop(1, c);
      ctx.fillStyle = a.el === 'e' || a.el === 'p' || a.el === 'n' ? c : g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (a.el !== 'e') { ctx.strokeStyle = ink; ctx.globalAlpha = a.o * 0.35; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = a.o; }
      const label = a.lab ?? (['e', 'p', 'n'].includes(a.el) ? (a.el === 'p' && r > 5 ? '+' : '') : a.el);
      if (label && r > 5) {
        const dark = ['C', 'N', 'O', 'Cl', 'Na', 'K', 'Li', 'Mg', 'U', 'p', 'Zn', 'Cu', 'Al'].includes(a.el);
        ctx.fillStyle = dark ? '#ffffff' : '#111111'; ctx.font = `700 ${Math.max(9, r * 0.82)}px ${tok('body') || 'sans-serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 1);
      }
      if (a.q) {
        const qs = a.q, fs = Math.max(10, r * 0.75);
        ctx.font = `700 ${fs}px ${tok('body') || 'sans-serif'}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = ink; ctx.fillText(qs, x + r * 0.8, y - r * 0.85);
      }
    }
    // text on top
    for (const x of st.extras) {
      if (x.type !== 'text') continue;
      ctx.globalAlpha = x.o; ctx.fillStyle = col(x.color) || ink;
      ctx.font = `${x.weight || 700} ${Math.max(10, (x.size || 3.2) * s)}px ${x.mono ? tok('mono') : (x.display ? tok('display') : tok('body')) || 'sans-serif'}`;
      ctx.textAlign = x.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(x.s, X(x.x), Y(x.y));
    }
    ctx.globalAlpha = 1;
  }
  function setCaption() {
    if (!cap) return;
    cap.innerHTML = `<span class="sn">Step ${idx + 1} of ${frames.length}</span>${frames[idx].cap}`;
    root.querySelectorAll('.sb-dots button').forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    if (playB) playB.textContent = playing ? 'Pause' : idx === frames.length - 1 ? 'Replay' : 'Play';
  }
  function go(i, now = performance.now()) {
    i = Math.max(0, Math.min(frames.length - 1, i));
    // mid-tween, freeze the current in-between picture as the new starting frame
    from = tween >= 1 ? to : snapshot(state(now));
    to = frames[i]; idx = i; t0 = now; tween = TWEEN ? 0 : 1;
    holdUntil = now + TWEEN + (frames[i].hold || opts.hold || 2600);
    setCaption();
  }
  function snapshot(cur) {
    const f = { cap: '', atoms: new Map(), bonds: new Map(), extras: new Map(), hl: [] };
    cur.atoms.forEach((a, id) => { if (a.o > 0.02) { const c = { ...a }; delete c.orb; f.atoms.set(id, c); } });
    cur.bonds.forEach(b => { if (b.o > 0.5) f.bonds.set([b.a, b.b].sort().join('|') + '|' + b.n, b); });
    cur.extras.forEach(x => { if (x.o > 0.5) f.extras.set(x.id, { ...x }); });
    return f;
  }
  function loop(now) {
    if (stopped) return;
    tween = TWEEN ? Math.min(1, (now - t0) / TWEEN) : 1;
    if (playing && now >= holdUntil) {
      if (idx < frames.length - 1) go(idx + 1, now);
      else if (opts.loop) { go(0, now); }
      else { playing = false; setCaption(); }
    }
    cv.redraw();
    raf = requestAnimationFrame(loop);
  }
  function play() { if (idx === frames.length - 1 && !opts.loop) go(0); playing = true; holdUntil = Math.min(holdUntil, performance.now() + 1400); setCaption(); }
  if (playB) {
    playB.addEventListener('click', () => { if (playing) { playing = false; setCaption(); } else play(); });
    root.querySelector('.sb-prev').addEventListener('click', () => { playing = false; go(idx - 1); });
    root.querySelector('.sb-next').addEventListener('click', () => { playing = false; go(idx + 1); });
    root.querySelector('.sb-dots').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { playing = false; go(+b.dataset.i); } });
    root.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { playing = false; go(idx + 1); } if (e.key === 'ArrowLeft') { playing = false; go(idx - 1); } });
  }
  from = to = frames[0]; setCaption();
  holdUntil = performance.now() + (frames[0].hold || opts.hold || 2600);
  // start playing the first time the storyboard scrolls into view
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !seen) { seen = true; if (!reduce) play(); } }, { threshold: 0.4 });
  io.observe(root);
  raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); io.disconnect(); cv.stop(); };
}
