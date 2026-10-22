'use strict';
/* States & solutions: Ch 11 Gases, Ch 12 Liquids, Solids and Intermolecular Forces, Ch 13 Solutions,
   Ch 14 Acids and Bases. Nuclear: Ch 17 Radioactivity and Nuclear Chemistry */

/* ================= Ch 11: Gases ================= */
const GAS_MODES = {
  free: ['Free', 'Change anything; P follows from PV = nRT.'],
  boyle: ['Boyle (T, n fixed)', 'P₁V₁ = P₂V₂: squeeze the gas and pressure rises.'],
  charles: ['Charles (P, n fixed)', 'V₁/T₁ = V₂/T₂: heat the gas and it expands.'],
  gay: ['Gay-Lussac (V, n fixed)', 'P₁/T₁ = P₂/T₂: heat a sealed can and pressure climbs.'],
  avogadro: ['Avogadro (P, T fixed)', 'V₁/n₁ = V₂/n₂: more gas takes more room.'],
};

registerLab({
  id: 'gases', ch: 11, sym: 'Gs', fam: 'state',
  title: 'Gas Laws', chapter: 'Gases',
  blurb: 'Run a piston full of moving particles. Change volume, temperature or amount and watch the pressure respond.',
  ideas: [
    'Gas pressure comes from particles hitting the walls. More hits, or harder hits, means more pressure.',
    'Units: <span class="eqn">1 atm = 760 mmHg = 760 torr = 101.325 kPa = 14.7 psi</span>.',
    '<b>Always use kelvin</b> in gas laws: K = °C + 273.',
    '<b>Boyle:</b> P₁V₁ = P₂V₂. <b>Charles:</b> V₁/T₁ = V₂/T₂. <b>Combined:</b> P₁V₁/T₁ = P₂V₂/T₂. <b>Avogadro:</b> V₁/n₁ = V₂/n₂.',
    '<b>Ideal gas law:</b> <span class="eqn">PV = nRT</span> with R = 0.08206 L·atm/(mol·K).',
    'At STP (0 °C, 1 atm), one mole of any gas occupies <b>22.4 L</b>.',
    '<b>Dalton:</b> total pressure is the sum of partial pressures, P<sub>total</sub> = P<sub>a</sub> + P<sub>b</sub> + …',
  ],
  bench(el) {
    let V = 12, T = 300, n = 1, mode = 'free', Pfix = null, raf = 0, hits = 0, hitRate = 0, lastT = performance.now(), parts = [];
    el.innerHTML = `
      <div class="panel">
        <h3>Piston simulator</h3>
        <div class="seg" id="gs-mode">${Object.entries(GAS_MODES).map(([k, [t]]) => `<button type="button" data-m="${k}" aria-pressed="${k === mode}">${t}</button>`).join('')}</div>
        <p class="sub" id="gs-law" style="margin-top:0"></p>
        <div class="canvas-wrap"><canvas id="gs-c" aria-label="Particles moving inside a cylinder with a movable piston"></canvas></div>
        ${UI.slider('gs-v', 'Volume V', 2, 30, 0.5, V)}
        ${UI.slider('gs-t', 'Temperature T', 100, 900, 5, T)}
        ${UI.slider('gs-n', 'Amount n', 0.2, 3, 0.1, n)}
        <div id="gs-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const P = () => n * R_GAS * T / V;
    function syncParticles() {
      const want = Math.round(n * 22);
      while (parts.length < want) parts.push({ x: Math.random(), y: Math.random(), a: Math.random() * Math.PI * 2 });
      parts.length = want;
    }
    const cv = makeCanvas($('#gs-c'), w => Math.max(170, Math.min(240, w * 0.42)), draw);
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      const left = 14, top = 14, bottom = h - 14, maxW = w - 60, boxW = maxW * V / 30;
      ctx.fillStyle = tok('surface'); ctx.fillRect(left, top, boxW, bottom - top);
      ctx.strokeStyle = tok('ink'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(left + maxW + 30, top); ctx.lineTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + maxW + 30, bottom); ctx.stroke();
      ctx.fillStyle = tok('muted'); ctx.fillRect(left + boxW, top + 2, 10, bottom - top - 4);
      ctx.fillRect(left + boxW + 10, (top + bottom) / 2 - 4, maxW + 40 - boxW, 8);
      const flash = Math.min(1, hitRate / 400);
      ctx.fillStyle = tok('c2'); ctx.globalAlpha = 0.15 + flash * 0.6; ctx.fillRect(left + boxW - 3, top + 2, 3, bottom - top - 4); ctx.globalAlpha = 1;
      const hot = (T - 100) / 800;
      ctx.fillStyle = hot > 0.5 ? tok('c2') : tok('c1');
      for (const p of parts) { ctx.beginPath(); ctx.arc(left + 5 + p.x * (boxW - 10), top + 5 + p.y * (bottom - top - 10), 4, 0, Math.PI * 2); ctx.fill(); }
    }
    function step(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const speed = 0.35 * Math.sqrt(T / 300) * (12 / V) ** 0.15;
      for (const p of parts) {
        p.x += Math.cos(p.a) * speed * dt * (12 / V); p.y += Math.sin(p.a) * speed * dt * 1.6;
        if (p.x > 1) { p.x = 2 - p.x; p.a = Math.PI - p.a; hits++; } if (p.x < 0) { p.x = -p.x; p.a = Math.PI - p.a; }
        if (p.y > 1) { p.y = 2 - p.y; p.a = -p.a; } if (p.y < 0) { p.y = -p.y; p.a = -p.a; }
      }
      hitRate = hitRate * 0.95 + (hits / Math.max(dt, 1e-3)) * 0.05; hits = 0;
      cv.redraw();
      raf = requestAnimationFrame(step);
    }
    function update(src) {
      if (mode === 'charles' && src !== 'v') { V = U.clamp(n * R_GAS * T / Pfix, 2, 30); }
      if (mode === 'avogadro' && src !== 'v') { V = U.clamp(n * R_GAS * T / Pfix, 2, 30); }
      $('#gs-v').value = V; $('#gs-t').value = T; $('#gs-n').value = n;
      $('#gs-v').disabled = mode === 'charles' || mode === 'gay' || mode === 'avogadro';
      $('#gs-t').disabled = mode === 'boyle' || mode === 'avogadro';
      $('#gs-n').disabled = mode === 'boyle' || mode === 'charles' || mode === 'gay';
      $('#gs-v-o').textContent = V.toFixed(1) + ' L'; $('#gs-t-o').textContent = `${T} K`; $('#gs-n-o').textContent = n.toFixed(1) + ' mol';
      $('#gs-law').textContent = GAS_MODES[mode][1];
      const p = P();
      $('#gs-out').innerHTML = `<div class="readout">P = ${p.toFixed(2)} atm</div>
        ${UI.kv([['mmHg', fmt(p * 760, 4)], ['kPa', fmt(p * 101.325, 4)], ['T in °C', (T - 273).toFixed(0) + ' °C'], ['PV/nT', (p * V / (n * T)).toFixed(5)]])}
        <p class="note">PV/nT stays at R = 0.08206 no matter what you change. That constant is the ideal gas law.</p>`;
      syncParticles(); if (reduce) cv.redraw();
    }
    $('#gs-v').addEventListener('input', e => { V = +e.target.value; update('v'); });
    $('#gs-t').addEventListener('input', e => {
      const t = +e.target.value;
      if (mode === 'charles') { const v = n * R_GAS * t / Pfix; if (v < 2 || v > 30) { e.target.value = T; return; } }
      T = t; update('t');
    });
    $('#gs-n').addEventListener('input', e => {
      const nn = +e.target.value;
      if (mode === 'avogadro') { const v = nn * R_GAS * T / Pfix; if (v < 2 || v > 30) { e.target.value = n; return; } }
      n = nn; update('n');
    });
    $('#gs-mode').addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      mode = b.dataset.m; Pfix = P();
      el.querySelectorAll('#gs-mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      update('mode');
    });
    update('init');
    if (!reduce) raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); cv.stop(); };
  },
  problems: [
    { name: 'Boyle\'s law', gen() {
      const P1 = U.sf(0.5, 3, 3), V1 = U.sf(1, 20, 3), V2 = U.sf(1, 20, 3), P2 = P1 * V1 / V2;
      return { kind: 'num', unit: 'atm', q: `A gas at <b>${P1} atm</b> occupies <b>${V1} L</b>. At constant temperature it is changed to <b>${V2} L</b>. What is the new pressure?`, answer: P2, explain: `<span class="eqn">P₂ = P₁V₁/V₂ = ${P1} × ${V1} / ${V2} = ${fmt(P2, 3)} atm</span>` };
    } },
    { name: 'Charles\'s law', gen() {
      const V1 = U.sf(1, 10, 3), t1 = U.ri(-20, 60), t2 = U.ri(70, 250), V2 = V1 * (t2 + 273.15) / (t1 + 273.15);
      return { kind: 'num', unit: 'L', q: `A balloon holds <b>${V1} L</b> at <b>${t1} °C</b>. What is its volume at <b>${t2} °C</b> (constant pressure)?`, answer: V2, explain: `Convert to kelvin: ${(t1 + 273.15).toFixed(2)} K and ${(t2 + 273.15).toFixed(2)} K. <span class="eqn">V₂ = ${V1} × ${(t2 + 273.15).toFixed(2)} / ${(t1 + 273.15).toFixed(2)} = ${fmt(V2, 3)} L</span>` };
    } },
    { name: 'Combined gas law', gen() {
      const P1 = U.sf(0.8, 2, 3), V1 = U.sf(2, 15, 3), T1 = U.ri(250, 350), P2 = U.sf(0.5, 3, 3), T2 = U.ri(250, 500), V2 = P1 * V1 * T2 / (T1 * P2);
      return { kind: 'num', unit: 'L', q: `A gas occupies <b>${V1} L</b> at <b>${P1} atm</b> and <b>${T1} K</b>. What volume does it occupy at <b>${P2} atm</b> and <b>${T2} K</b>?`, answer: V2, explain: `<span class="eqn">V₂ = P₁V₁T₂ / (T₁P₂) = ${P1}·${V1}·${T2} / (${T1}·${P2}) = ${fmt(V2, 3)} L</span>` };
    } },
    { name: 'Ideal gas law', gen() {
      const n = U.sf(0.1, 3, 3), T = U.ri(250, 500), V = U.sf(1, 30, 3), P = n * R_GAS * T / V, ask = U.pick(['P', 'V', 'n', 'T']);
      if (ask === 'P') return { kind: 'num', unit: 'atm', q: `What is the pressure of <b>${n} mol</b> of gas in <b>${V} L</b> at <b>${T} K</b>?`, answer: P, explain: `<span class="eqn">P = nRT/V = ${n} × 0.08206 × ${T} / ${V} = ${fmt(P, 3)} atm</span>` };
      const Pr = Number(P.toPrecision(3));
      if (ask === 'V') return { kind: 'num', unit: 'L', q: `What volume do <b>${n} mol</b> of gas occupy at <b>${Pr} atm</b> and <b>${T} K</b>?`, answer: n * R_GAS * T / Pr, explain: `<span class="eqn">V = nRT/P = ${n} × 0.08206 × ${T} / ${Pr} = ${fmt(n * R_GAS * T / Pr, 3)} L</span>` };
      if (ask === 'n') return { kind: 'num', unit: 'mol', q: `How many moles of gas are in <b>${V} L</b> at <b>${Pr} atm</b> and <b>${T} K</b>?`, answer: Pr * V / (R_GAS * T), explain: `<span class="eqn">n = PV/RT = ${Pr} × ${V} / (0.08206 × ${T}) = ${fmt(Pr * V / (R_GAS * T), 3)} mol</span>` };
      return { kind: 'num', unit: 'K', q: `At what temperature do <b>${n} mol</b> of gas exert <b>${Pr} atm</b> in <b>${V} L</b>?`, answer: Pr * V / (n * R_GAS), explain: `<span class="eqn">T = PV/nR = ${Pr} × ${V} / (${n} × 0.08206) = ${fmt(Pr * V / (n * R_GAS), 3)} K</span>` };
    } },
    { name: 'Molar volume at STP', gen() {
      const f = U.pick(['O2', 'N2', 'CO2', 'CH4', 'He', 'NH3', 'H2', 'Ar']), M = Chem.molarMass(f), g = U.sf(1, 80, 3), L = g / M * 22.4;
      return { kind: 'num', unit: 'L', q: `What volume does <b>${g} g of ${fmtF(f)}</b> occupy at STP?`, answer: L, explain: `<span class="eqn">${g} g ÷ ${M.toFixed(2)} g/mol × 22.4 L/mol = ${fmt(L, 3)} L</span>` };
    } },
    { name: 'Pressure units', gen() {
      const conv = [['atm', 'mmHg', 760], ['mmHg', 'atm', 1 / 760], ['atm', 'kPa', 101.325], ['kPa', 'atm', 1 / 101.325], ['mmHg', 'kPa', 101.325 / 760], ['psi', 'atm', 1 / 14.7]];
      const [a, b, f] = U.pick(conv), x = a === 'mmHg' ? U.sf(100, 1500, 3) : a === 'kPa' ? U.sf(20, 400, 3) : a === 'psi' ? U.sf(10, 60, 3) : U.sf(0.2, 5, 3);
      return { kind: 'num', unit: b, q: `Convert <b>${x} ${a}</b> to ${b}.`, answer: x * f, explain: `1 atm = 760 mmHg = 101.325 kPa = 14.7 psi, so ${x} ${a} = <b>${fmt(x * f, 3)} ${b}</b>.` };
    } },
    { name: 'Partial pressures', gen() {
      const a = U.sf(50, 400, 3), b = U.sf(50, 400, 3), tot = U.sf(a + b + 20, a + b + 300, 3);
      return { kind: 'num', unit: 'mmHg', q: `A mixture of N₂, O₂ and Ar has a total pressure of <b>${tot} mmHg</b>. P(N₂) = ${a} mmHg and P(O₂) = ${b} mmHg. What is P(Ar)?`, answer: tot - a - b, abs: 1.5, explain: `<span class="eqn">P(Ar) = ${tot} − ${a} − ${b} = ${fmt(tot - a - b, 3)} mmHg</span>` };
    } },
  ],
});

/* ================= Ch 12: Liquids, solids, IMF ================= */
const IMF_DATA = [
  ['CH4', 'Dispersion', -161.5, 'nonpolar'], ['C2H6', 'Dispersion', -89, 'nonpolar'], ['C3H8', 'Dispersion', -42, 'nonpolar'], ['C4H10', 'Dispersion', -0.5, 'nonpolar'], ['C8H18', 'Dispersion', 125.6, 'nonpolar'],
  ['Ne', 'Dispersion', -246, 'nonpolar'], ['Ar', 'Dispersion', -186, 'nonpolar'], ['Kr', 'Dispersion', -153, 'nonpolar'], ['N2', 'Dispersion', -196, 'nonpolar'], ['O2', 'Dispersion', -183, 'nonpolar'],
  ['F2', 'Dispersion', -188, 'nonpolar'], ['Cl2', 'Dispersion', -34, 'nonpolar'], ['Br2', 'Dispersion', 59, 'nonpolar'], ['I2', 'Dispersion', 184, 'nonpolar'], ['CCl4', 'Dispersion', 77, 'nonpolar'],
  ['HCl', 'Dipole–dipole', -85, 'polar'], ['H2S', 'Dipole–dipole', -60, 'polar'], ['CH3Cl', 'Dipole–dipole', -24, 'polar'], ['CH2O', 'Dipole–dipole', -19, 'polar'], ['CH3COCH3', 'Dipole–dipole', 56, 'polar'], ['PH3', 'Dipole–dipole', -88, 'polar'],
  ['H2O', 'Hydrogen bonding', 100, 'polar, H on O'], ['NH3', 'Hydrogen bonding', -33, 'polar, H on N'], ['HF', 'Hydrogen bonding', 19.5, 'polar, H on F'], ['CH3OH', 'Hydrogen bonding', 65, 'polar, H on O'], ['C2H5OH', 'Hydrogen bonding', 78, 'polar, H on O'],
].map(([f, imf, bp, note]) => ({ f, imf, bp, note }));
const IMF_RANK = ['Dispersion', 'Dipole–dipole', 'Hydrogen bonding'];
const WATER = { cIce: 2.09, cLiq: 4.184, cGas: 2.01, fus: 334, vap: 2260 };
function heatingSegments(m) {
  return [
    ['Warm ice −20 → 0 °C', m * WATER.cIce * 20, -20, 0, 'solid'], ['Melt at 0 °C', m * WATER.fus, 0, 0, 'melting'],
    ['Warm water 0 → 100 °C', m * WATER.cLiq * 100, 0, 100, 'liquid'], ['Boil at 100 °C', m * WATER.vap, 100, 100, 'boiling'], ['Warm steam 100 → 120 °C', m * WATER.cGas * 20, 100, 120, 'gas'],
  ];
}

registerLab({
  id: 'liquids-solids', ch: 12, sym: 'If', fam: 'state',
  title: 'Intermolecular Forces & Phase Changes', chapter: 'Liquids, Solids, and Intermolecular Forces',
  blurb: 'Rank molecules by the forces between them, then heat a block of ice through melting and boiling on a live heating curve.',
  ideas: [
    'Intermolecular forces (IMFs) are attractions <i>between</i> molecules. Stronger IMFs → higher boiling point, higher viscosity and surface tension, lower vapor pressure.',
    '<b>Dispersion</b> forces exist in all molecules and grow with molar mass (more electrons). They are the only IMF in nonpolar substances.',
    '<b>Dipole–dipole</b> forces act between polar molecules.',
    '<b>Hydrogen bonding</b> is an extra-strong dipole force when H is bonded directly to N, O or F. It is why water boils at 100 °C instead of about −80 °C.',
    'On a heating curve, temperature stays flat during melting and boiling: the energy breaks IMFs instead of speeding molecules up.',
    'Sloped parts: <span class="eqn">q = m·c·ΔT</span>. Flat parts: <span class="eqn">q = n·ΔH<sub>fus</sub></span> (6.02 kJ/mol for water) or <span class="eqn">q = n·ΔH<sub>vap</sub></span> (40.7 kJ/mol).',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>IMF identifier</h3>
        <div class="row">${UI.select('im-m', 'Substance', IMF_DATA.map((d, i) => [i, d.f]), 21)}</div>
        <div id="im-out" style="display:grid;gap:10px"></div>
        <div id="im-bars" style="display:grid;gap:3px"></div>
      </div>
      <div class="panel">
        <h3>Heating curve of water</h3>
        <p class="sub">Start with ice at −20 °C and add heat.</p>
        <div class="row">${UI.num('hc2-m', 'Mass of water', '18.0', 'g')}</div>
        ${UI.slider('hc2-q', 'Heat added', 0, 1000, 1, 380)}
        <div class="canvas-wrap"><canvas id="hc2-c" aria-label="Temperature versus heat added for water"></canvas></div>
        <div id="hc2-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function imf() {
      const d = IMF_DATA[$('#im-m').value], rank = IMF_RANK.indexOf(d.imf);
      $('#im-out').innerHTML = `<div class="row" style="align-items:baseline;gap:14px"><span class="big-formula">${fmtF(d.f)}</span><span class="note">${d.note}, boils at ${d.bp} °C</span></div>
        <div class="btn-row">${IMF_RANK.map((x, i) => `<span class="pill ${i === rank ? 'on' : i < rank ? '' : ''}" style="${i > rank ? 'opacity:.4;text-decoration:line-through' : ''}">${x}${i === rank ? ' (strongest)' : ''}</span>`).join('')}</div>`;
      const sorted = IMF_DATA.slice().sort((a, b) => a.bp - b.bp), lo = -250, hi = 190;
      const col = { 'Dispersion': 'var(--c1)', 'Dipole–dipole': 'var(--c3)', 'Hydrogen bonding': 'var(--c2)' };
      $('#im-bars').innerHTML = `<div class="note" style="display:flex;gap:14px;flex-wrap:wrap;margin:4px 0">${IMF_RANK.map(x => `<span><b style="color:${col[x]}">■</b> ${x}</span>`).join('')}</div>` + sorted.map(x => `<div style="display:grid;grid-template-columns:78px 1fr 60px;gap:8px;align-items:center;font-size:.8rem;${x === d ? 'font-weight:700' : ''}">
        <span>${fmtF(x.f)}</span><div style="height:9px;border-radius:3px;background:color-mix(in srgb,var(--line) 50%,transparent)"><div style="height:100%;border-radius:3px;width:${(x.bp - lo) / (hi - lo) * 100}%;background:${col[x.imf]};opacity:${x === d ? 1 : .55}"></div></div><span style="font-family:var(--mono);text-align:right">${x.bp} °C</span></div>`).join('');
    }
    $('#im-m').addEventListener('change', imf);
    let segs = [], total = 0;
    const cv = makeCanvas($('#hc2-c'), w => Math.max(180, Math.min(260, w * 0.5)), draw);
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      if (!total) return;
      const pad = { l: 44, r: 12, t: 12, b: 26 }, X = q => pad.l + (w - pad.l - pad.r) * q / total, Y = t => h - pad.b - (h - pad.t - pad.b) * (t + 30) / 160;
      ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
      [-20, 0, 50, 100, 120].forEach(t => { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(w - pad.r, Y(t)); ctx.stroke(); ctx.fillText(t + '°', 6, Y(t) + 4); });
      ctx.fillText('heat added →', w - 96, h - 8);
      let q0 = 0; ctx.lineWidth = 3;
      segs.forEach(([, q, t0, t1, ph]) => {
        ctx.strokeStyle = ph === 'melting' || ph === 'boiling' ? tok('c2') : tok('c1');
        ctx.beginPath(); ctx.moveTo(X(q0), Y(t0)); ctx.lineTo(X(q0 + q), Y(t1)); ctx.stroke(); q0 += q;
      });
      const st = state(); ctx.fillStyle = tok('ink');
      ctx.beginPath(); ctx.arc(X(st.q), Y(st.T), 6, 0, Math.PI * 2); ctx.fill();
    }
    function state() {
      const q = +$('#hc2-q').value / 1000 * total; let acc = 0;
      for (const [label, sq, t0, t1, ph] of segs) {
        if (q <= acc + sq) { const f = (q - acc) / sq; return { q, T: t0 + (t1 - t0) * f, label, ph, f }; }
        acc += sq;
      }
      return { q: total, T: 120, label: segs[4][0], ph: 'gas', f: 1 };
    }
    function heat() {
      const m = parseNum($('#hc2-m').value);
      if (m === null || m <= 0) { $('#hc2-out').innerHTML = '<div class="callout warn">Enter a positive mass.</div>'; return; }
      segs = heatingSegments(m); total = segs.reduce((s, x) => s + x[1], 0);
      const st = state();
      $('#hc2-q-o').textContent = fmt(st.q / 1000, 3) + ' kJ';
      const phaseTxt = { solid: 'all ice', melting: `melting: ${(st.f * 100).toFixed(0)}% liquid`, liquid: 'all liquid water', boiling: `boiling: ${(st.f * 100).toFixed(0)}% steam`, gas: 'all steam' }[st.ph];
      $('#hc2-out').innerHTML = `${UI.kv([['Temperature', st.T.toFixed(1) + ' °C'], ['State', phaseTxt], ['Heat added', fmt(st.q / 1000, 3) + ' kJ']])}
        <div class="scroll" style="margin-top:10px"><table class="t"><tr><th>Step</th><th class="n">q (kJ)</th></tr>${segs.map(([l, q]) => `<tr class="${l === st.label ? 'hl' : ''}"><td>${l}</td><td class="n">${(q / 1000).toFixed(2)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="n"><b>${(total / 1000).toFixed(2)}</b></td></tr></table></div>
        <p class="note">Boiling takes about 7 times more energy than melting: every hydrogen bond has to break for a molecule to escape as gas.</p>`;
      cv.redraw();
    }
    $('#hc2-m').addEventListener('input', heat); $('#hc2-q').addEventListener('input', heat);
    imf(); heat();
    return () => cv.stop();
  },
  problems: [
    { name: 'Strongest IMF', gen() {
      const d = U.pick(IMF_DATA);
      return { ...mc(d.imf, IMF_RANK), q: `What is the strongest intermolecular force in <b style="font-size:1.2em">${fmtF(d.f)}</b>?`,
        explain: d.imf === 'Hydrogen bonding' ? `${fmtF(d.f)} has H bonded directly to N, O or F, so it hydrogen bonds.` : d.imf === 'Dipole–dipole' ? `${fmtF(d.f)} is polar but has no H on N, O or F.` : `${fmtF(d.f)} is nonpolar, so dispersion forces are all it has.` };
    } },
    { name: 'Higher boiling point', gen() {
      let a, b; do { a = U.pick(IMF_DATA); b = U.pick(IMF_DATA); } while (a === b || Math.abs(a.bp - b.bp) < 15);
      const win = a.bp > b.bp ? a : b, lose = win === a ? b : a;
      const mw = Chem.molarMass(win.f), ml = Chem.molarMass(lose.f);
      const same = { 'Hydrogen bonding': 'it forms more hydrogen bonds per molecule', 'Dipole–dipole': 'its molecules are more polar (a larger dipole)', Dispersion: 'its electron cloud is spread over more atoms and is easier to distort' };
      const why = win.imf !== lose.imf && IMF_RANK.indexOf(win.imf) > IMF_RANK.indexOf(lose.imf) ? `${fmtF(win.f)} has stronger IMFs (${win.imf.toLowerCase()} vs ${lose.imf.toLowerCase()}).`
        : mw > ml ? `${fmtF(win.f)} is larger (${mw.toFixed(0)} vs ${ml.toFixed(0)} g/mol), so its dispersion forces are stronger${win.imf !== lose.imf ? ', enough to outweigh the other molecule\'s ' + lose.imf.toLowerCase() : ''}.`
        : win.imf === lose.imf ? `Both have ${win.imf.toLowerCase()} as their strongest force, but ${fmtF(win.f)} has the stronger attractions: ${same[win.imf] || 'its molecules attract each other more strongly'}. Molar mass is only a rough guide (${mw.toFixed(0)} vs ${ml.toFixed(0)} g/mol).`
        : `${fmtF(win.f)} boils higher even though its strongest force type is weaker; size and shape matter too. Boiling points are measured, and these rules are only a guide.`;
      return { ...mc(fmtF(win.f), [fmtF(a.f), fmtF(b.f)]), q: `Which has the higher boiling point: <b>${fmtF(a.f)}</b> or <b>${fmtF(b.f)}</b>?`, explain: `${why} Boiling points: ${fmtF(a.f)} ${a.bp} °C, ${fmtF(b.f)} ${b.bp} °C.` };
    } },
    { name: 'Melting & boiling heat', gen() {
      const g = U.sf(5, 200, 3), n = g / 18.02;
      if (Math.random() < .5) return { kind: 'num', unit: 'kJ', q: `How much heat is needed to melt <b>${g} g of ice</b> at 0 °C? (ΔH<sub>fus</sub> = 6.02 kJ/mol)`, answer: n * 6.02, explain: `<span class="eqn">${g} g ÷ 18.02 g/mol = ${fmt(n, 3)} mol × 6.02 kJ/mol = ${fmt(n * 6.02, 3)} kJ</span>` };
      return { kind: 'num', unit: 'kJ', q: `How much heat is needed to boil <b>${g} g of water</b> at 100 °C? (ΔH<sub>vap</sub> = 40.7 kJ/mol)`, answer: n * 40.7, explain: `<span class="eqn">${g} g ÷ 18.02 g/mol = ${fmt(n, 3)} mol × 40.7 kJ/mol = ${fmt(n * 40.7, 3)} kJ</span>` };
    } },
    { name: 'Multi-step heating', gen() {
      const g = U.sf(10, 100, 3), t0 = -U.ri(5, 25), t1 = U.ri(20, 80);
      const q1 = g * WATER.cIce * -t0, q2 = g / 18.02 * 6020, q3 = g * WATER.cLiq * t1, tot = (q1 + q2 + q3) / 1000;
      return { kind: 'num', unit: 'kJ', tol: 0.03, q: `How much heat converts <b>${g} g of ice at ${t0} °C</b> into liquid water at <b>${t1} °C</b>? (c<sub>ice</sub> = 2.09, c<sub>water</sub> = 4.184 J/g·°C; ΔH<sub>fus</sub> = 6.02 kJ/mol)`, answer: tot,
        explain: `Warm ice: ${fmt(q1 / 1000, 3)} kJ. Melt: ${fmt(q2 / 1000, 3)} kJ. Warm water: ${fmt(q3 / 1000, 3)} kJ. Total <b>${fmt(tot, 3)} kJ</b>.` };
    } },
  ],
});

/* ================= Ch 13: Solutions ================= */
const SOLUTES = [['NaCl', 'Sodium chloride', null], ['C6H12O6', 'Glucose', null], ['CuSO4', 'Copper(II) sulfate', '#2f86e0'], ['KMnO4', 'Potassium permanganate', '#8e2fa8'], ['NiCl2', 'Nickel(II) chloride', '#2fae64'], ['K2Cr2O7', 'Potassium dichromate', '#e8751a']];
function beakerSVG(fill, color, alpha, label) {
  const top = 100 - fill * 80;
  return `<svg viewBox="0 0 100 112" width="110" height="124" role="img" aria-label="${label}" style="flex:none">
    <rect x="16" y="${12 + top}" width="68" height="${88 - top}" rx="3" fill="${color || 'var(--c1)'}" opacity="${color ? alpha : 0.12}"/>
    <path d="M12 6 L16 12 L16 96 Q16 102 22 102 L78 102 Q84 102 84 96 L84 12 L88 6" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    ${[25, 50, 75].map(y => `<line x1="16" x2="26" y1="${12 + y * 0.88}" y2="${12 + y * 0.88}" stroke="var(--muted)" stroke-width="1.2"/>`).join('')}
  </svg>`;
}

registerLab({
  id: 'solutions', ch: 13, sym: 'Sn', fam: 'state',
  title: 'Solutions & Concentration', chapter: 'Solutions',
  blurb: 'Mix solutions by mass and volume, watch the color deepen with concentration, and dilute a stock solution.',
  ideas: [
    'A solution is a homogeneous mixture: a <b>solute</b> dissolved in a <b>solvent</b>. "Like dissolves like": polar with polar, nonpolar with nonpolar.',
    'Solids usually dissolve better in hot water; gases dissolve better in cold water and at higher pressure.',
    '<b>Molarity:</b> <span class="eqn">M = mol solute / L solution</span>. <b>Mass percent:</b> <span class="eqn">g solute / g solution × 100%</span>.',
    '<b>Dilution:</b> <span class="eqn">M₁V₁ = M₂V₂</span>. Adding water changes the volume, not the moles of solute.',
    '<b>Molality:</b> <span class="eqn">m = mol solute / kg solvent</span>, used for colligative properties.',
    'Solutes lower the freezing point and raise the boiling point: <span class="eqn">ΔT<sub>f</sub> = m·K<sub>f</sub></span> (water 1.86 °C/m), <span class="eqn">ΔT<sub>b</sub> = m·K<sub>b</sub></span> (water 0.512 °C/m).',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Make a solution</h3>
        <div class="row">${UI.select('so-s', 'Solute', SOLUTES.map((s, i) => [i, `${s[1]} (${s[0]})`]), 2)}</div>
        ${UI.slider('so-g', 'Solute mass', 0, 40, 0.1, 8)}
        ${UI.slider('so-v', 'Final volume', 50, 1000, 10, 250)}
        <div class="row" style="align-items:center;gap:16px"><div id="so-b"></div><div id="so-out" style="flex:1 1 220px;min-width:0"></div></div>
      </div>
      <div class="panel">
        <h3>Dilute it</h3>
        <p class="sub">Take some of the solution above and add water.</p>
        ${UI.slider('dl-v1', 'Stock taken V₁', 5, 250, 5, 50)}
        ${UI.slider('dl-v2', 'Dilute to V₂', 10, 1000, 10, 500)}
        <div class="row" style="align-items:center;gap:16px"><div id="dl-b"></div><div id="dl-out" style="flex:1 1 220px;min-width:0"></div></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let M = 0;
    function make() {
      const [f, name, color] = SOLUTES[$('#so-s').value], g = +$('#so-g').value, V = +$('#so-v').value, MM = Chem.molarMass(f), mol = g / MM;
      M = mol / (V / 1000);
      $('#so-g-o').textContent = g.toFixed(1) + ' g'; $('#so-v-o').textContent = V + ' mL';
      $('#so-b').innerHTML = beakerSVG(V / 1000, color, Math.min(0.95, 0.12 + M * 1.6), `${name} solution, ${M.toFixed(3)} M`);
      $('#so-out').innerHTML = `<div class="readout">${M.toFixed(3)} M</div>
        <p class="note" style="margin:6px 0">${g.toFixed(1)} g ÷ ${MM.toFixed(2)} g/mol = ${fmt(mol, 3)} mol; ${fmt(mol, 3)} mol ÷ ${(V / 1000).toFixed(3)} L = ${M.toFixed(3)} M</p>
        ${color ? '' : '<p class="note">This solute is colorless, so the beaker looks the same at any concentration.</p>'}`;
      dil();
    }
    function dil() {
      const [f, , color] = SOLUTES[$('#so-s').value];
      let V1 = +$('#dl-v1').value, V2 = +$('#dl-v2').value;
      if (V2 < V1) { V2 = V1; $('#dl-v2').value = V2; }
      const M2 = M * V1 / V2;
      $('#dl-v1-o').textContent = V1 + ' mL'; $('#dl-v2-o').textContent = V2 + ' mL';
      $('#dl-b').innerHTML = beakerSVG(V2 / 1000, color, Math.min(0.95, 0.12 + M2 * 1.6), `Diluted ${f} solution, ${M2.toFixed(3)} M`);
      $('#dl-out').innerHTML = `<div class="readout">${M2.toFixed(4)} M</div><p class="note" style="margin-top:6px">M₂ = M₁V₁ / V₂ = ${M.toFixed(3)} × ${V1} / ${V2}. The ${fmt(M * V1 / 1000, 3)} mol of solute is the same before and after; it is just spread through ${(V2 / V1).toFixed(1)}× the volume.</p>`;
    }
    ['#so-s', '#so-g', '#so-v'].forEach(s => $(s).addEventListener('input', make));
    ['#dl-v1', '#dl-v2'].forEach(s => $(s).addEventListener('input', dil));
    make();
  },
  problems: [
    { name: 'Molarity', gen() {
      const [f] = U.pick(SOLUTES.concat([['KCl'], ['NaOH'], ['CaCl2'], ['KNO3']])), g = U.sf(1, 60, 3), V = U.sf(100, 1500, 3), MM = Chem.molarMass(f), ans = g / MM / (V / 1000);
      return { kind: 'num', unit: 'M', q: `What is the molarity of a solution made by dissolving <b>${g} g of ${fmtF(f)}</b> in enough water to make <b>${V} mL</b>?`, answer: ans, explain: `<span class="eqn">${g} g ÷ ${MM.toFixed(2)} g/mol = ${fmt(g / MM, 3)} mol; ÷ ${fmtP(V / 1000, 3)} L = ${fmt(ans, 3)} M</span>` };
    } },
    { name: 'Grams needed', gen() {
      const [f] = U.pick([['NaCl'], ['KCl'], ['NaOH'], ['C6H12O6'], ['CuSO4'], ['KNO3']]), M = U.sf(0.05, 2, 3), V = U.sf(100, 2000, 3), MM = Chem.molarMass(f), ans = M * V / 1000 * MM;
      return { kind: 'num', unit: 'g', q: `How many grams of <b>${fmtF(f)}</b> are needed to make <b>${V} mL</b> of a <b>${M} M</b> solution?`, answer: ans, explain: `<span class="eqn">${M} mol/L × ${fmtP(V / 1000, 3)} L × ${MM.toFixed(2)} g/mol = ${fmt(ans, 3)} g</span>` };
    } },
    { name: 'Dilution', gen() {
      const M1 = U.sf(1, 18, 3), V2 = U.sf(250, 2000, 3), M2 = U.sf(0.05, M1 * 0.5, 3);
      if (Math.random() < .5) return { kind: 'num', unit: 'mL', q: `What volume of <b>${M1} M</b> stock is needed to make <b>${V2} mL</b> of <b>${M2} M</b> solution?`, answer: M2 * V2 / M1, explain: `<span class="eqn">V₁ = M₂V₂/M₁ = ${M2} × ${V2} / ${M1} = ${fmt(M2 * V2 / M1, 3)} mL</span>` };
      const V1 = U.sf(5, 100, 3);
      return { kind: 'num', unit: 'M', q: `<b>${V1} mL</b> of <b>${M1} M</b> HCl is diluted to <b>${V2} mL</b>. What is the new concentration?`, answer: M1 * V1 / V2, explain: `<span class="eqn">M₂ = M₁V₁/V₂ = ${M1} × ${V1} / ${V2} = ${fmt(M1 * V1 / V2, 3)} M</span>` };
    } },
    { name: 'Mass percent', gen() {
      const g = U.sf(2, 50, 3), w = U.sf(50, 500, 3), ans = g / (g + w) * 100;
      return { kind: 'num', unit: '%', q: `<b>${g} g</b> of sugar is dissolved in <b>${w} g</b> of water. What is the mass percent of sugar?`, answer: ans, explain: `Solution mass = solute + solvent = ${fmtP(g + w, 4)} g. <span class="eqn">${g} / ${fmtP(g + w, 4)} × 100% = ${fmt(ans, 3)}%</span>` };
    } },
    { name: 'Freezing & boiling point', gen() {
      const [f, name] = U.pick([['C6H12O6', 'glucose'], ['C12H22O11', 'sucrose'], ['C2H6O2', 'ethylene glycol'], ['CH3OH', 'methanol']]);
      const g = U.sf(10, 200, 3), kg = U.sf(0.2, 2, 3), m = g / Chem.molarMass(f) / kg;
      // methanol is volatile, so ΔTb = m·Kb does not apply to it: freezing point only
      if (f === 'CH3OH' || Math.random() < .5) return { kind: 'num', unit: '°C', q: `<b>${g} g of ${name}</b> (${fmtF(f)}) is dissolved in <b>${kg} kg of water</b>. What is the new freezing point? (K<sub>f</sub> = 1.86 °C/m)`, answer: -m * 1.86, abs: 0.05, explain: `m = ${fmt(g / Chem.molarMass(f), 3)} mol ÷ ${kg} kg = ${fmt(m, 3)} m. ΔT<sub>f</sub> = ${fmt(m, 3)} × 1.86 = ${fmt(m * 1.86, 3)} °C, so it freezes at <b>${fmt(-m * 1.86, 3)} °C</b>.` };
      return { kind: 'num', unit: '°C', q: `<b>${g} g of ${name}</b> (${fmtF(f)}) is dissolved in <b>${kg} kg of water</b>. What is the new boiling point? (K<sub>b</sub> = 0.512 °C/m)`, answer: 100 + m * 0.512, abs: 0.03, tol: 0, explain: `m = ${fmt(m, 3)} m. ΔT<sub>b</sub> = ${fmt(m, 3)} × 0.512 = ${fmt(m * 0.512, 3)} °C, so it boils at <b>${(100 + m * 0.512).toFixed(2)} °C</b>.` };
    } },
  ],
});

/* ================= Ch 14: Acids and bases ================= */
const PH_EXAMPLES = [[0.5, 'battery acid'], [1.5, 'stomach acid'], [2.2, 'lemon juice'], [2.9, 'vinegar'], [4.2, 'tomato juice'], [5, 'black coffee'], [5.6, 'rain'], [6.6, 'milk'], [7, 'pure water'], [7.4, 'blood'], [8.1, 'seawater'], [8.3, 'baking soda'], [10.5, 'milk of magnesia'], [11.6, 'household ammonia'], [12.5, 'bleach'], [13.8, 'drain cleaner']];
const indicatorColor = ph => { const stops = [[0, [200, 30, 40]], [3, [235, 110, 40]], [5, [240, 200, 50]], [7, [80, 170, 70]], [9, [40, 120, 190]], [11, [70, 60, 170]], [14, [110, 40, 130]]]; for (let i = 1; i < stops.length; i++) if (ph <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (ph - a) / (b - a); return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * f)).join(',')})`; } return 'rgb(110,40,130)'; };
const CONJ = [['HCl', 'Cl-'], ['HNO3', 'NO3-'], ['H2SO4', 'HSO4-'], ['HF', 'F-'], ['H2O', 'OH-'], ['NH4+', 'NH3'], ['H3O+', 'H2O'], ['HCO3-', 'CO3^2-'], ['HC2H3O2', 'C2H3O2-'], ['H2CO3', 'HCO3-'], ['HSO4-', 'SO4^2-'], ['H3PO4', 'H2PO4-'], ['HCN', 'CN-']];

registerLab({
  id: 'acids-bases', ch: 14, sym: 'Ab', fam: 'state',
  title: 'Acids, Bases & pH', chapter: 'Acids and Bases',
  blurb: 'Slide along the pH scale from battery acid to drain cleaner, then run a titration and find the equivalence point.',
  ideas: [
    '<b>Arrhenius:</b> acids make H⁺ (H₃O⁺) in water; bases make OH⁻. <b>Brønsted–Lowry:</b> acids donate H⁺; bases accept H⁺.',
    'Removing H⁺ from an acid gives its <b>conjugate base</b> (HF → F⁻). Adding H⁺ to a base gives its <b>conjugate acid</b> (NH₃ → NH₄⁺).',
    '<b>Strong acids</b> ionize completely: HCl, HBr, HI, HNO₃, H₂SO₄, HClO₄. Weak acids (HF, HC₂H₃O₂) only partly.',
    'In water, <span class="eqn">[H₃O⁺][OH⁻] = 1.0 × 10⁻¹⁴</span> at 25 °C.',
    '<span class="eqn">pH = −log[H₃O⁺]</span>, <span class="eqn">pOH = −log[OH⁻]</span>, <span class="eqn">pH + pOH = 14</span>. Below 7 is acidic, above 7 is basic.',
    'Each pH unit is a factor of 10: pH 3 has 10 times more H₃O⁺ than pH 4.',
    '<b>Titration:</b> at the equivalence point, mol H⁺ = mol OH⁻. For a strong acid and strong base, pH = 7 there.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>pH explorer</h3>
        ${UI.slider('ph-s', 'pH', 0, 14, 0.1, 2.9)}
        <div style="position:relative;height:30px;border-radius:6px;border:1px solid var(--line);background:linear-gradient(90deg,${Array.from({ length: 15 }, (_, i) => indicatorColor(i) + ' ' + (i / 14 * 100) + '%').join(',')})">
          <div id="ph-mk" style="position:absolute;top:-5px;bottom:-5px;width:4px;border-radius:2px;background:var(--ink);box-shadow:0 0 0 2px var(--bg)"></div></div>
        <div class="note" style="display:flex;justify-content:space-between"><span>0 acidic</span><span>7 neutral</span><span>basic 14</span></div>
        <div class="btn-row" id="ph-ex">${PH_EXAMPLES.map(([p, n]) => `<button type="button" class="chip" data-p="${p}">${n}</button>`).join('')}</div>
        <div id="ph-out"></div>
      </div>
      <div class="panel">
        <h3>Titration: strong acid + strong base</h3>
        <div class="row">${UI.num('ti-va', 'HCl volume', '25.0', 'mL')}${UI.num('ti-ma', 'HCl molarity', '0.100', 'M')}${UI.num('ti-mb', 'NaOH molarity', '0.100', 'M')}</div>
        ${UI.slider('ti-vb', 'NaOH added', 0, 50, 0.1, 12)}
        <div class="canvas-wrap"><canvas id="ti-c" aria-label="Titration curve: pH versus volume of base added"></canvas></div>
        <div id="ti-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function ph() {
      const p = +$('#ph-s').value, h = 10 ** -p, oh = 1e-14 / h;
      $('#ph-s-o').textContent = p.toFixed(1);
      $('#ph-mk').style.left = `calc(${p / 14 * 100}% - 2px)`;
      const near = PH_EXAMPLES.reduce((a, b) => Math.abs(b[0] - p) < Math.abs(a[0] - p) ? b : a);
      $('#ph-out').innerHTML = `${UI.kv([['[H₃O⁺]', fmt(h, 2) + ' M'], ['[OH⁻]', fmt(oh, 2) + ' M'], ['pOH', (14 - p).toFixed(1)], ['Solution is', p < 6.95 ? '<b>acidic</b>' : p > 7.05 ? '<b>basic</b>' : '<b>neutral</b>']])}
        <p class="note" style="margin-top:8px">Close to: ${near[1]} (pH ≈ ${near[0]}). ${p < 6.95 ? `That is ${fmt(h / 1e-7, 2)} times more H₃O⁺ than pure water.` : p > 7.05 ? `That is ${fmt(oh / 1e-7, 2)} times more OH⁻ than pure water.` : ''}</p>`;
    }
    $('#ph-s').addEventListener('input', ph);
    $('#ph-ex').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { $('#ph-s').value = b.dataset.p; ph(); } });
    const tiPH = (Va, Ma, Mb, Vb) => { const na = Ma * Va, nb = Mb * Vb, V = (Va + Vb) / 1000; if (Math.abs(na - nb) < 1e-9) return 7; return na > nb ? -Math.log10((na - nb) / 1000 / V) : 14 + Math.log10((nb - na) / 1000 / V); };
    let par = null;
    const cv = makeCanvas($('#ti-c'), w => Math.max(180, Math.min(260, w * 0.5)), draw);
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h); if (!par) return;
      const pad = { l: 34, r: 12, t: 10, b: 26 }, X = v => pad.l + (w - pad.l - pad.r) * v / 50, Y = p => h - pad.b - (h - pad.t - pad.b) * p / 14;
      ctx.fillStyle = tok('f-nuc'); ctx.globalAlpha = 0.12; ctx.fillRect(pad.l, Y(10), w - pad.l - pad.r, Y(8.2) - Y(10)); ctx.globalAlpha = 1;
      ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
      [0, 7, 14].forEach(p => { ctx.beginPath(); ctx.moveTo(pad.l, Y(p)); ctx.lineTo(w - pad.r, Y(p)); ctx.stroke(); ctx.fillText(p, 8, Y(p) + 4); });
      [0, 25, 50].forEach(v => ctx.fillText(v + ' mL', X(v) - (v ? 20 : 0), h - 8));
      if (par.veq <= 50) { ctx.setLineDash([4, 4]); ctx.strokeStyle = tok('muted'); ctx.beginPath(); ctx.moveTo(X(par.veq), pad.t); ctx.lineTo(X(par.veq), h - pad.b); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = tok('c1'); ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 500; i++) { const v = i / 10, p = tiPH(par.Va, par.Ma, par.Mb, v); i ? ctx.lineTo(X(v), Y(p)) : ctx.moveTo(X(v), Y(p)); }
      ctx.stroke();
      const p = tiPH(par.Va, par.Ma, par.Mb, par.Vb);
      ctx.fillStyle = indicatorColor(p); ctx.strokeStyle = tok('ink'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(par.Vb), Y(p), 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    function ti() {
      const Va = parseNum($('#ti-va').value), Ma = parseNum($('#ti-ma').value), Mb = parseNum($('#ti-mb').value), Vb = +$('#ti-vb').value;
      $('#ti-vb-o').textContent = Vb.toFixed(1) + ' mL';
      if ([Va, Ma, Mb].some(x => x === null || x <= 0)) { $('#ti-out').innerHTML = '<div class="callout warn">Enter positive volumes and molarities.</div>'; return; }
      const veq = Ma * Va / Mb, p = tiPH(Va, Ma, Mb, Vb);
      par = { Va, Ma, Mb, Vb, veq };
      const phen = p >= 8.2;
      $('#ti-out').innerHTML = `${UI.kv([['pH now', p.toFixed(2)], ['Equivalence at', fmt(veq, 3) + ' mL'], ['Phenolphthalein', phen ? '<b style="color:var(--f-nuc)">pink</b>' : 'colorless']])}
        <p class="note" style="margin-top:8px">${Math.abs(Vb - veq) < 0.05 ? 'Equivalence point: mol OH⁻ added equals mol H⁺, so pH = 7.' : Vb < veq ? `${fmt((Ma * Va - Mb * Vb) / 1000, 3)} mol H⁺ still unneutralized.` : `${fmt((Mb * Vb - Ma * Va) / 1000, 3)} mol excess OH⁻ makes it basic.`} The shaded band is where phenolphthalein turns pink (pH 8.2–10).</p>`;
      cv.redraw();
    }
    ['#ti-va', '#ti-ma', '#ti-mb', '#ti-vb'].forEach(s => $(s).addEventListener('input', ti));
    ph(); ti();
    return () => cv.stop();
  },
  problems: [
    { name: 'pH from [H₃O⁺]', gen() {
      const h = U.sf(1, 9.9, 2) * 10 ** -U.ri(1, 12), p = -Math.log10(h);
      return { kind: 'num', abs: 0.02, tol: 0, q: `What is the pH of a solution with <b>[H₃O⁺] = ${fmt(h, 2)} M</b>?`, answer: p, display: p.toFixed(2), explain: `<span class="eqn">pH = −log(${fmt(h, 2)}) = ${p.toFixed(2)}</span>. ${p < 7 ? 'Acidic.' : 'Basic.'}` };
    } },
    { name: '[H₃O⁺] from pH', gen() {
      const p = Number(U.rnd(1, 13).toFixed(2)), h = 10 ** -p;
      return { kind: 'num', unit: 'M', tol: 0.03, q: `A solution has <b>pH = ${p}</b>. What is [H₃O⁺]?`, answer: h, explain: `<span class="eqn">[H₃O⁺] = 10<sup>−pH</sup> = 10<sup>−${p}</sup> = ${fmt(h, 2)} M</span>` };
    } },
    { name: 'pH from [OH⁻]', gen() {
      const oh = U.sf(1, 9.9, 2) * 10 ** -U.ri(1, 12), poh = -Math.log10(oh);
      return { kind: 'num', abs: 0.02, tol: 0, q: `What is the pH of a solution with <b>[OH⁻] = ${fmt(oh, 2)} M</b>?`, answer: 14 - poh, display: (14 - poh).toFixed(2), explain: `<span class="eqn">pOH = −log(${fmt(oh, 2)}) = ${poh.toFixed(2)}; pH = 14 − ${poh.toFixed(2)} = ${(14 - poh).toFixed(2)}</span>` };
    } },
    { name: 'Strong acid & base pH', gen() {
      const [f, base] = U.pick([['HCl', false], ['HNO3', false], ['HBr', false], ['NaOH', true], ['KOH', true]]), c = U.sf(1, 9.9, 2) * 10 ** -U.ri(1, 4);
      const p = base ? 14 + Math.log10(c) : -Math.log10(c);
      return { kind: 'num', abs: 0.02, tol: 0, q: `What is the pH of <b>${fmt(c, 2)} M ${fmtF(f)}</b>?`, answer: p, display: p.toFixed(2),
        explain: base ? `Strong base: [OH⁻] = ${fmt(c, 2)} M. pOH = ${(-Math.log10(c)).toFixed(2)}, so pH = <b>${p.toFixed(2)}</b>.` : `Strong acid ionizes completely: [H₃O⁺] = ${fmt(c, 2)} M, pH = <b>${p.toFixed(2)}</b>.` };
    } },
    { name: 'Titration volume', gen() {
      const [acid, k] = U.pick([['HCl', 1], ['HNO3', 1], ['H2SO4', 2]]), Ma = U.sf(0.05, 0.5, 3), Va = U.sf(10, 50, 3), Mb = U.sf(0.05, 0.5, 3), Vb = k * Ma * Va / Mb;
      return { kind: 'num', unit: 'mL', q: `What volume of <b>${Mb} M NaOH</b> neutralizes <b>${Va} mL of ${Ma} M ${fmtF(acid)}</b>?`, answer: Vb,
        explain: `mol H⁺ = ${k > 1 ? '2 × ' : ''}${Ma} × ${Va} mL = ${fmt(k * Ma * Va, 3)} mmol. ${k > 1 ? 'H₂SO₄ gives 2 H⁺ per formula unit. ' : ''}V = ${fmt(k * Ma * Va, 3)} mmol ÷ ${Mb} M = <b>${fmt(Vb, 3)} mL</b>.` };
    } },
    { name: 'Conjugate pairs', gen() {
      const [a, b] = U.pick(CONJ);
      if (Math.random() < .5) return { kind: 'formula', ph: 'e.g. NO3-', q: `What is the <b>conjugate base</b> of <b style="font-size:1.2em">${fmtF(a)}</b>?`, answer: b, hint: 'Show the charge, e.g. NO3- or CO3^2-.', explain: `Remove one H⁺ (subtract H and lower the charge by 1): ${fmtF(a)} → <b>${fmtF(b)}</b>.` };
      return { kind: 'formula', ph: 'e.g. NH4+', q: `What is the <b>conjugate acid</b> of <b style="font-size:1.2em">${fmtF(b)}</b>?`, answer: a, hint: 'Show the charge, e.g. NH4+.', explain: `Add one H⁺ (add H and raise the charge by 1): ${fmtF(b)} → <b>${fmtF(a)}</b>.` };
    } },
  ],
});

/* ================= Ch 17: Nuclear ================= */
const ISOTOPES = [['C', 14, 5730, 'years', 'beta'], ['I', 131, 8.02, 'days', 'beta'], ['U', 238, 4.47e9, 'years', 'alpha'], ['Rn', 222, 3.82, 'days', 'alpha'], ['Co', 60, 5.27, 'years', 'beta'], ['Tc', '99m', 6.0, 'hours', 'gamma'], ['P', 32, 14.3, 'days', 'beta'], ['Ra', 226, 1600, 'years', 'alpha'], ['H', 3, 12.3, 'years', 'beta'], ['Pu', 239, 24100, 'years', 'alpha']];
const DECAYS = {
  alpha: { dA: -4, dZ: -2, part: [4, 2, 'He'], name: 'alpha (α)' },
  beta: { dA: 0, dZ: 1, part: [0, -1, 'e'], name: 'beta (β⁻)' },
  positron: { dA: 0, dZ: -1, part: [0, 1, 'e'], name: 'positron (β⁺)' },
  ec: { dA: 0, dZ: -1, part: [0, -1, 'e'], name: 'electron capture', capture: true },
  gamma: { dA: 0, dZ: 0, part: [0, 0, 'γ'], name: 'gamma (γ)' },
};
const PARENTS = [['U', 238, 'alpha'], ['Th', 234, 'beta'], ['Ra', 226, 'alpha'], ['Rn', 222, 'alpha'], ['Po', 210, 'alpha'], ['Pu', 239, 'alpha'], ['C', 14, 'beta'], ['K', 40, 'beta'], ['Co', 60, 'beta'], ['I', 131, 'beta'], ['Na', 22, 'positron'], ['H', 3, 'beta'], ['P', 32, 'beta'], ['Sr', 90, 'beta'], ['Cs', 137, 'beta'], ['F', 18, 'positron'], ['C', 11, 'positron'], ['Bi', 210, 'beta']];
const nucHTML = (A, Z, s) => `<span class="nuc"><span class="az"><sup>${A}</sup><sub>${Z}</sub></span>${s}</span>`;
function decay(sym, A, mode) {
  const d = DECAYS[mode], Z = EL[sym].Z, Z2 = Z + d.dZ, A2 = A + d.dA, prod = ELZ[Z2] || { sym: '?', name: 'no element' };
  const p = nucHTML(...d.part);
  const eq = d.capture ? `${nucHTML(A, Z, sym)} + ${p} → ${nucHTML(A2, Z2, prod.sym)}` : `${nucHTML(A, Z, sym)} → ${nucHTML(A2, Z2, prod.sym)} + ${p}`;
  return { Z2, A2, prod, eq };
}

registerLab({
  id: 'nuclear', ch: 17, sym: 'Nu', fam: 'nuc',
  title: 'Radioactivity & Half-Life', chapter: 'Radioactivity and Nuclear Chemistry',
  blurb: 'Watch a sample of nuclei decay at random, see why half-life is predictable anyway, and write balanced nuclear equations.',
  ideas: [
    '<b>Alpha (α)</b> = ⁴₂He: mass number −4, atomic number −2. Stopped by paper but very damaging inside the body.',
    '<b>Beta (β⁻)</b> = ⁰₋₁e: a neutron becomes a proton, so Z goes up by 1 and A stays the same.',
    '<b>Positron (β⁺)</b> = ⁰₊₁e and <b>electron capture</b>: a proton becomes a neutron, so Z goes down by 1. <b>Gamma (γ)</b> is pure energy and changes nothing.',
    'In a nuclear equation, the mass numbers and the atomic numbers must each add up the same on both sides.',
    'A <b>half-life</b> is the time for half of a sample to decay. After n half-lives, <span class="eqn">fraction left = (½)ⁿ</span>.',
    'Each nucleus decays at random, but with billions of them the half-life is precise. That makes carbon-14 (5730 years) a reliable clock for dating.',
    '<b>Fission</b> splits heavy nuclei (U-235) and <b>fusion</b> joins light ones (H → He); both convert a little mass into a lot of energy.',
  ],
  bench(el) {
    const N0 = 400;
    let iso = ISOTOPES[0], alive = new Array(N0).fill(true), t = 0, running = true, speed = 1, raf = 0, hist = [[0, N0]], last = performance.now();
    el.innerHTML = `
      <div class="panel">
        <h3>Half-life simulator</h3>
        <div class="row">${UI.select('hl-i', 'Isotope', ISOTOPES.map((x, i) => [i, `${EL[x[0]].name}-${x[1]} (t½ = ${fmt(x[2], 3).replace(/<[^>]+>/g, m => m === '<sup>' ? '^' : '')} ${x[3]})`]), 0)}</div>
        <div class="btn-row"><button type="button" class="btn primary" id="hl-run">Pause</button><button type="button" class="btn" id="hl-reset">Reset</button>
          <div class="seg" id="hl-sp">${[0.5, 1, 3].map(s => `<button type="button" data-s="${s}" aria-pressed="${s === speed}">${s}×</button>`).join('')}</div></div>
        <div class="row" style="align-items:flex-start;gap:16px">
          <div class="canvas-wrap" style="flex:1 1 220px;max-width:300px"><canvas id="hl-g" aria-label="Grid of nuclei, filled dots have not decayed"></canvas></div>
          <div class="canvas-wrap" style="flex:1 1 260px;min-width:0"><canvas id="hl-p" aria-label="Nuclei remaining over time compared with the half-life curve"></canvas></div>
        </div>
        <div id="hl-out"></div>
      </div>
      <div class="panel">
        <h3>Nuclear equation builder</h3>
        <div class="row">${UI.select('nd-p', 'Parent nuclide', PARENTS.map(([s, A], i) => [i, `${s}-${A}`]), 0)}${UI.select('nd-m', 'Decay type', Object.entries(DECAYS).map(([k, d]) => [k, d.name]), 'alpha')}</div>
        <div id="nd-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grid = makeCanvas($('#hl-g'), 1, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h); const n = 20, cell = w / n;
      for (let i = 0; i < N0; i++) { const x = (i % n + 0.5) * cell, y = (Math.floor(i / n) + 0.5) * cell; ctx.fillStyle = alive[i] ? tok('f-nuc') : tok('line'); ctx.beginPath(); ctx.arc(x, y, cell * (alive[i] ? 0.36 : 0.18), 0, Math.PI * 2); ctx.fill(); }
    });
    const plot = makeCanvas($('#hl-p'), w => Math.max(180, Math.min(260, w * 0.62)), (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 36, r: 10, t: 10, b: 26 }, tmax = 5, X = x => pad.l + (w - pad.l - pad.r) * x / tmax, Y = y => h - pad.b - (h - pad.t - pad.b) * y / N0;
      ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
      for (let k = 0; k <= tmax; k++) { ctx.beginPath(); ctx.moveTo(X(k), pad.t); ctx.lineTo(X(k), h - pad.b); ctx.stroke(); ctx.fillText(k + 't½', X(k) - 8, h - 8); }
      [N0, N0 / 2, N0 / 4].forEach(v => { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); ctx.fillText(v, 4, Y(v) + 4); });
      ctx.setLineDash([5, 4]); ctx.strokeStyle = tok('muted'); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 100; i++) { const x = i / 100 * tmax, y = N0 * 0.5 ** x; i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); } ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = tok('f-nuc'); ctx.lineWidth = 2.5; ctx.beginPath();
      hist.forEach(([x, y], i) => i ? ctx.lineTo(X(Math.min(x, tmax)), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
    });
    function report() {
      const left = alive.filter(Boolean).length;
      $('#hl-out').innerHTML = UI.kv([['Time', `${t.toFixed(2)} half-lives`], ['Real time', `${fmt(t * iso[2], 3)} ${iso[3]}`], ['Undecayed', `${left} of ${N0}`], ['Expected (½)ⁿ', `${(N0 * 0.5 ** t).toFixed(0)}`]]);
    }
    function frame(now) {
      const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
      if (running && t < 5) {
        const dt = dtReal * 0.35 * speed, p = 1 - 0.5 ** dt;
        for (let i = 0; i < N0; i++) if (alive[i] && Math.random() < p) alive[i] = false;
        t = Math.min(5, t + dt); hist.push([t, alive.filter(Boolean).length]);
        grid.redraw(); plot.redraw(); report();
        if (t >= 5) { running = false; $('#hl-run').textContent = 'Play'; }
      }
      raf = requestAnimationFrame(frame);
    }
    function reset() { alive.fill(true); t = 0; hist = [[0, N0]]; grid.redraw(); plot.redraw(); report(); }
    $('#hl-run').addEventListener('click', () => { if (t >= 5) reset(); running = !running; $('#hl-run').textContent = running ? 'Pause' : 'Play'; });
    $('#hl-reset').addEventListener('click', reset);
    $('#hl-i').addEventListener('change', () => { iso = ISOTOPES[$('#hl-i').value]; reset(); });
    $('#hl-sp').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; speed = +b.dataset.s; el.querySelectorAll('#hl-sp button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    function nd() {
      const [s, A] = PARENTS[$('#nd-p').value], mode = $('#nd-m').value, r = decay(s, A, mode), d = DECAYS[mode];
      $('#nd-out').innerHTML = `<div class="callout" style="font-size:1.6rem;overflow-x:auto;white-space:nowrap">${r.eq}</div>
        ${UI.kv([['Mass numbers', d.capture ? `${A} + 0 = ${r.A2}` : `${A} = ${r.A2} + ${d.part[0]}`], ['Atomic numbers', d.capture ? `${EL[s].Z} + (−1) = ${r.Z2}` : `${EL[s].Z} = ${r.Z2} + (${d.part[1]})`], ['Product', `${r.prod.name}-${r.A2}`]])}
        ${r.Z2 < 1 ? '<div class="callout warn">This decay is impossible: there would be no protons left.</div>' : ''}
        ${PARENTS[$('#nd-p').value][2] === mode ? `<p class="note" style="margin-top:8px">${EL[s].name}-${A} really does decay this way.</p>` : `<p class="note" style="margin-top:8px">The usual decay mode for ${EL[s].name}-${A} is ${DECAYS[PARENTS[$('#nd-p').value][2]].name}.</p>`}
        ${mode === 'gamma' ? '<p class="note" style="margin-top:8px">Gamma emission releases energy from an excited nucleus. The element does not change (often written with an asterisk on the parent, like Tc-99m).</p>' : ''}`;
    }
    $('#nd-p').addEventListener('change', nd); $('#nd-m').addEventListener('change', nd);
    reset(); nd();
    if (reduce) running = false, $('#hl-run').textContent = 'Play';
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); grid.stop(); plot.stop(); };
  },
  problems: [
    { name: 'Decay product', gen() {
      const [s, A, mode] = U.pick(PARENTS);
      const r = decay(s, A, mode), ans = `${r.prod.sym}-${r.A2}`;
      return { kind: 'text', ph: 'e.g. Th-234', q: `What nuclide forms when <b>${EL[s].name}-${A}</b> undergoes <b>${DECAYS[mode].name}</b> decay? Answer as Symbol-A.`, answer: ans, display: `${ans} (${r.prod.name}-${r.A2})`,
        check: x => { const v = x.replace(/\s/g, ''); if (!v) return null; return [`${r.prod.sym}-${r.A2}`, `${r.prod.sym}${r.A2}`, `${r.A2}${r.prod.sym}`, `${r.A2}-${r.prod.sym}`].includes(v) || normText(v) === normText(`${r.prod.name}-${r.A2}`); },
        explain: `${r.eq}. Mass numbers and atomic numbers balance on both sides; Z = ${r.Z2} is ${r.prod.name}.` };
    } },
    { name: 'Amount remaining', gen() {
      const [s, A, th, unit] = U.pick(ISOTOPES.filter(x => x[2] < 1e5)), n = U.ri(1, 6), m0 = U.sf(10, 500, 3), left = m0 * 0.5 ** n;
      return { kind: 'num', unit: 'g', q: `${EL[s].name}-${A} has a half-life of ${fmt(th, 3)} ${unit}. How much of a <b>${m0} g</b> sample remains after <b>${fmt(th * n, 3)} ${unit}</b>?`, answer: left,
        explain: `${fmt(th * n, 3)} ÷ ${fmt(th, 3)} = ${n} half-lives. <span class="eqn">${m0} × (½)<sup>${n}</sup> = ${fmt(left, 3)} g</span>` };
    } },
    { name: 'Dating with half-life', gen() {
      const n = U.ri(1, 5), frac = 0.5 ** n;
      return { kind: 'num', unit: 'years', q: `A wooden artifact has <b>${(frac * 100).toFixed(2).replace(/\.?0+$/, '')}%</b> of the carbon-14 found in living wood. How old is it? (t½ = 5730 years)`, answer: n * 5730,
        explain: `${(frac * 100).toFixed(2).replace(/\.?0+$/, '')}% = (½)<sup>${n}</sup>, so ${n} half-lives have passed: ${n} × 5730 = <b>${n * 5730} years</b>.` };
    } },
    { name: 'Identify the particle', gen() {
      const [s, A, mode] = U.pick(PARENTS);
      const r = decay(s, A, mode);
      return { ...mc(DECAYS[mode].name, ['alpha (α)', 'beta (β⁻)', 'positron (β⁺)', 'gamma (γ)']), q: `What particle is emitted? <span class="eqline">${nucHTML(A, EL[s].Z, s)} → ${nucHTML(r.A2, r.Z2, r.prod.sym)} + ?</span>`,
        explain: `Missing mass number: ${A} − ${r.A2} = ${A - r.A2}. Missing atomic number: ${EL[s].Z} − ${r.Z2} = ${EL[s].Z - r.Z2}. That is <b>${DECAYS[mode].name}</b>.` };
    } },
  ],
});
