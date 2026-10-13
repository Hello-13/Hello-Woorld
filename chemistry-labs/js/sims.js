'use strict';
/* Live particle simulations for the "Watch it" sections:
   - statesSim: 2D Lennard-Jones "water" molecules with gravity and a thermostat (solid, liquid, gas)
   - equilibriumSim: A ⇌ B molecules converting at random, with live counts and rates */

function statesSim(root) {
  const reduce = REDUCE(), N = 48, SIG = 4.2, RC = 2.6 * SIG, G = 0.06, W = 100, H = 50;
  let tempC = -20, raf = 0, stopped = false, ps = [];
  root.innerHTML = `<div class="canvas-wrap story-stage"><canvas aria-label="Water molecules moving: their spacing and motion show the state of matter"></canvas></div>
    ${UI.slider('sm-t', 'Temperature', -50, 200, 1, tempC)}
    <div class="row" style="align-items:center;gap:12px"><span class="pill" id="sm-phase"></span><span class="note" id="sm-note"></span></div>
    <div class="btn-row"><button type="button" class="btn ghost" data-t="-30">Freeze (−30 °C)</button><button type="button" class="btn ghost" data-t="40">Melt (40 °C)</button><button type="button" class="btn ghost" data-t="160">Boil (160 °C)</button><button type="button" class="btn ghost" id="sm-reset">Reset to ice</button></div>
    <p class="note">A model, not to scale: each ball is one water molecule. The molecules attract each other; heat makes them move faster until they break free.</p>`;
  const $ = s => root.querySelector(s);
  function reset() {
    ps = [];
    for (let i = 0; i < N; i++) ps.push({ x: 31 + (i % 8) * 4.6 + (Math.floor(i / 8) % 2) * 2.3, y: H - 3 - Math.floor(i / 8) * 4.0, vx: 0, vy: 0, a: Math.random() * 6.28, w: 0 });
    forces();
  }
  const Tstar = c => c < 0 ? 0.05 + (c + 50) / 50 * 0.17 : c < 100 ? 0.32 + c / 100 * 0.13 : c === 100 ? 0.6 : 0.8 + (c - 100) / 100 * 1.7;
  function forces() {
    for (const p of ps) { p.fx = 0; p.fy = G; }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const dx = ps[j].x - ps[i].x, dy = ps[j].y - ps[i].y, r2 = dx * dx + dy * dy;
      if (r2 > RC * RC) continue;
      const sr2 = SIG * SIG / Math.max(r2, 0.5 * SIG * SIG), sr6 = sr2 ** 3;
      const f = U.clamp(24 * (2 * sr6 * sr6 - sr6) / r2, -20, 60);
      ps[i].fx -= f * dx; ps[i].fy -= f * dy; ps[j].fx += f * dx; ps[j].fy += f * dy;
    }
  }
  function step(T, dt = 0.02) {
    const R = SIG / 2;
    for (const p of ps) {
      p.vx += p.fx * dt / 2; p.vy += p.fy * dt / 2; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < R) { p.x = R; p.vx = Math.abs(p.vx); } if (p.x > W - R) { p.x = W - R; p.vx = -Math.abs(p.vx); }
      if (p.y < R) { p.y = R; p.vy = Math.abs(p.vy); } if (p.y > H - R) { p.y = H - R; p.vy = -Math.abs(p.vy); }
    }
    forces();
    let ke = 0;
    for (const p of ps) { p.vx += p.fx * dt / 2; p.vy += p.fy * dt / 2; ke += (p.vx * p.vx + p.vy * p.vy) / 2; }
    const lam = Math.sqrt(1 + 0.02 * (T / Math.max(ke / N, 1e-6) - 1));
    for (const p of ps) { p.vx *= lam; p.vy *= lam; p.w = p.w * 0.98 + (Math.random() - 0.5) * Math.sqrt(T) * 0.08; p.a += p.w; }
  }
  const cv = makeCanvas($('canvas'), w => Math.max(190, Math.min(360, w * 0.5)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
    ctx.strokeStyle = tok('line'); ctx.lineWidth = 2; ctx.strokeRect(ox + 1, oy + 1, W * s - 2, H * s - 2);
    for (const p of ps) {
      const x = ox + p.x * s, y = oy + p.y * s, r = SIG * 0.36 * s;
      for (const da of [-0.95, 0.95]) {
        const hx = x + Math.cos(p.a + da) * r * 1.05, hy = y + Math.sin(p.a + da) * r * 1.05;
        ctx.fillStyle = '#eef0f2'; ctx.strokeStyle = tok('ink'); ctx.globalAlpha = 1; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(hx, hy, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
      }
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#e2483d'); g.addColorStop(1, '#c23a30');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
  function label() {
    $('#sm-t-o').textContent = tempC + ' °C';
    const ph = tempC < 0 ? ['Solid (ice)', 'Molecules lock into a pattern and only vibrate in place.'] : tempC < 100 ? ['Liquid water', 'Molecules stay close but slide past each other, so a liquid flows and takes the shape of its container.'] : tempC === 100 ? ['Boiling', 'Some molecules have enough energy to escape the liquid.'] : ['Gas (steam)', 'Molecules fly apart and fill the whole container. Attractions barely matter.'];
    $('#sm-phase').textContent = ph[0]; $('#sm-note').textContent = ph[1];
  }
  function loop() {
    if (stopped) return;
    const T = Tstar(tempC);
    for (let k = 0; k < 20; k++) step(T);
    cv.redraw();
    raf = requestAnimationFrame(loop);
  }
  $('#sm-t').addEventListener('input', e => { tempC = +e.target.value; label(); });
  root.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { tempC = +b.dataset.t; $('#sm-t').value = tempC; label(); } });
  $('#sm-reset').addEventListener('click', () => { tempC = -20; $('#sm-t').value = tempC; reset(); label(); });
  reset(); label();
  if (reduce) { for (let k = 0; k < 200; k++) step(Tstar(tempC)); cv.redraw(); $('#sm-t').addEventListener('change', () => { for (let k = 0; k < 6000; k++) step(Tstar(tempC)); cv.redraw(); }); }
  else raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); cv.stop(); };
}

function equilibriumSim(root) {
  const reduce = REDUCE(), N = 60;
  let kf = 1.0, kr = 0.5, ps = [], hist = [], fRate = 0, rRate = 0, raf = 0, stopped = false, last = performance.now(), flashes = [];
  root.innerHTML = `<div class="row" style="align-items:stretch;gap:14px">
      <div class="canvas-wrap story-stage" style="flex:1 1 300px"><canvas id="eqs-box" aria-label="Molecules switching between form A and form B"></canvas></div>
      <div class="canvas-wrap story-stage" style="flex:1 1 260px"><canvas id="eqs-plot" aria-label="Number of A and B molecules over time"></canvas></div></div>
    <div class="row">${UI.slider('eqs-kf', 'Forward A → B', 0.1, 2, 0.05, kf)}${UI.slider('eqs-kr', 'Reverse B → A', 0.1, 2, 0.05, kr)}</div>
    <div class="btn-row"><button type="button" class="btn ghost" id="eqs-allA">Start with all A</button><button type="button" class="btn ghost" id="eqs-allB">Start with all B</button><button type="button" class="btn ghost" id="eqs-add">Add 20 A</button></div>
    <div id="eqs-out"></div>`;
  const $ = s => root.querySelector(s);
  const mk = st => ({ x: Math.random() * 96 + 2, y: Math.random() * 46 + 2, vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 18, st });
  function fill(st, n = N) { ps = Array.from({ length: n }, () => mk(st)); hist = []; }
  const box = makeCanvas($('#eqs-box'), w => Math.max(170, Math.min(260, w * 0.55)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / 100, h / 50), ox = (w - 100 * s) / 2, oy = (h - 50 * s) / 2;
    for (const f of flashes) { ctx.globalAlpha = f.life; ctx.strokeStyle = tok(f.to === 'B' ? 'c2' : 'c1'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + f.x * s, oy + f.y * s, (1 - f.life) * 6 * s + 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const p of ps) {
      const x = ox + p.x * s, y = oy + p.y * s;
      ctx.fillStyle = tok(p.st === 'A' ? 'c1' : 'c2');
      if (p.st === 'A') { ctx.beginPath(); ctx.arc(x, y, 1.7 * s, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(x - 1.1 * s, y, 1.3 * s, 0, Math.PI * 2); ctx.arc(x + 1.1 * s, y, 1.3 * s, 0, Math.PI * 2); ctx.fill(); }
    }
  });
  const plot = makeCanvas($('#eqs-plot'), w => Math.max(170, Math.min(260, w * 0.55)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 30, r: 8, t: 10, b: 22 }, max = Math.max(N, ...hist.map(p => p.a + p.b));
    const X = i => pad.l + (w - pad.l - pad.r) * i / 399, Y = v => h - pad.b - (h - pad.t - pad.b) * v / max;
    ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
    [0, max / 2, max].forEach(v => { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v), 4, Y(v) + 4); });
    ctx.fillText('time →', w - 52, h - 6);
    [['a', 'c1'], ['b', 'c2']].forEach(([k, c]) => { ctx.strokeStyle = tok(c); ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p[k])) : ctx.moveTo(X(i), Y(p[k]))); ctx.stroke(); });
  });
  function report() {
    const a = ps.filter(p => p.st === 'A').length, b = ps.length - a;
    const eq = Math.abs(fRate - rRate) < Math.max(1.2, 0.25 * Math.max(fRate, rRate)) && hist.length > 120;
    $('#eqs-out').innerHTML = `${UI.kv([['<span style="color:var(--c1)">●</span> A', a], ['<span style="color:var(--c2)">●●</span> B', b], ['A → B per s', fRate.toFixed(1)], ['B → A per s', rRate.toFixed(1)], ['[B]/[A] now', a ? (b / a).toFixed(2) : '—'], ['K = k<sub>f</sub>/k<sub>r</sub>', (kf / kr).toFixed(2)]])}
      <div class="callout ${eq ? 'good' : ''}" style="margin-top:10px">${eq ? '<b>At equilibrium.</b> Molecules keep converting, but the forward and reverse rates are equal, so the counts hold steady (around K = ' + (kf / kr).toFixed(2) + ').' : 'Not at equilibrium yet: one direction is faster, so the counts are still changing.'}</div>`;
  }
  let tick = 0, fCount = 0, rCount = 0, acc = 0;
  function loop(now) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const p of ps) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 2 || p.x > 98) p.vx *= -1; if (p.y < 2 || p.y > 48) p.vy *= -1;
      p.x = U.clamp(p.x, 2, 98); p.y = U.clamp(p.y, 2, 48);
      const k = p.st === 'A' ? kf : kr;
      if (Math.random() < k * dt * 0.6) { p.st = p.st === 'A' ? 'B' : 'A'; flashes.push({ x: p.x, y: p.y, life: 1, to: p.st }); if (p.st === 'B') fCount++; else rCount++; }
    }
    flashes.forEach(f => { f.life -= dt * 2; }); flashes = flashes.filter(f => f.life > 0);
    acc += dt;
    if (acc > 0.25) { fRate = fRate * 0.7 + fCount / acc * 0.3; rRate = rRate * 0.7 + rCount / acc * 0.3; fCount = rCount = 0; acc = 0; }
    if (++tick % 3 === 0) { const a = ps.filter(p => p.st === 'A').length; hist.push({ a, b: ps.length - a }); if (hist.length > 400) hist.shift(); }
    if (tick % 15 === 0) report();
    box.redraw(); plot.redraw();
    raf = requestAnimationFrame(loop);
  }
  $('#eqs-kf').addEventListener('input', e => { kf = +e.target.value; $('#eqs-kf-o').textContent = kf.toFixed(2) + '/s'; });
  $('#eqs-kr').addEventListener('input', e => { kr = +e.target.value; $('#eqs-kr-o').textContent = kr.toFixed(2) + '/s'; });
  $('#eqs-allA').addEventListener('click', () => fill('A'));
  $('#eqs-allB').addEventListener('click', () => fill('B'));
  $('#eqs-add').addEventListener('click', () => { for (let i = 0; i < 20; i++) ps.push(mk('A')); });
  $('#eqs-kf-o').textContent = kf.toFixed(2) + '/s'; $('#eqs-kr-o').textContent = kr.toFixed(2) + '/s';
  fill('A'); report();
  if (reduce) { const a = Math.round(N / (1 + kf / kr)); ps.forEach((p, i) => { p.st = i < a ? 'A' : 'B'; }); box.redraw(); report(); }
  else raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); box.stop(); plot.stop(); };
}
