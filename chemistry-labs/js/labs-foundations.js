'use strict';
/* Foundations: Ch 2 Measurement and Problem Solving, Ch 3 Matter and Energy */

/* ---------- Significant figures ---------- */
function sigInfo(raw) {
  const s = String(raw).trim().replace(/^[-+−]/, '');
  const m = s.match(/^([\d.]+)(?:\s*(?:e|[x×*]\s*10\^?)\s*([-+−]?\d+))?$/i);
  if (!m) return null;
  const mant = m[1];
  if ((mant.match(/\./g) || []).length > 1 || !/\d/.test(mant)) return null;
  const hasDot = mant.includes('.');
  const chars = [...mant];
  const digitIdx = chars.map((c, i) => (/\d/.test(c) ? i : -1)).filter(i => i >= 0);
  const firstNZ = digitIdx.find(i => chars[i] !== '0');
  if (firstNZ === undefined) return { chars, sig: chars.map(() => false), count: 0, notes: ['A value of zero has no significant figures to count. Try a measured value.'], ambiguous: false };
  const lastNZ = [...digitIdx].reverse().find(i => chars[i] !== '0');
  const lastSig = hasDot ? digitIdx[digitIdx.length - 1] : lastNZ;
  const sig = chars.map((c, i) => /\d/.test(c) && i >= firstNZ && i <= lastSig);
  const notes = ['Nonzero digits are always significant.'];
  if (digitIdx.some(i => i < firstNZ)) notes.push('Leading zeros only locate the decimal point. They are never significant.');
  if (digitIdx.some(i => chars[i] === '0' && i > firstNZ && i < lastNZ)) notes.push('Zeros between nonzero digits are significant.');
  let ambiguous = false;
  if (lastSig > lastNZ) notes.push('Trailing zeros after a decimal point are significant.');
  if (!hasDot && digitIdx.some(i => i > lastNZ)) { ambiguous = true; notes.push('Trailing zeros with no decimal point are ambiguous, so they are not counted. Write 1.20 × 10³ (or "120.") to show they were measured.'); }
  if (m[2] !== undefined) notes.push('The ×10ⁿ part never changes the count.');
  return { chars, sig, count: sig.filter(Boolean).length, notes, ambiguous };
}
function decimals(str) { const s = String(str).trim(); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }
/* A number string with exactly n sig figs, between lo and hi */
function sfString(lo, hi, n) {
  for (let k = 0; k < 50; k++) {
    const s = U.rnd(lo, hi).toPrecision(n);
    if (!s.includes('e') && sigInfo(s).count === n) return s;
  }
  return (1.5).toPrecision(n);
}

const UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, 'µm': 1e-6, nm: 1e-9, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.34 },
  mass: { g: 1, kg: 1000, mg: 0.001, 'µg': 1e-6, lb: 453.59, oz: 28.35 },
  volume: { L: 1, mL: 0.001, 'cm³': 0.001, 'm³': 1000, gal: 3.785, qt: 0.9464 },
};
const unitDim = u => Object.keys(UNITS).find(d => u in UNITS[d]);

registerLab({
  id: 'measurement', ch: 2, sym: 'Ms', fam: 'found',
  title: 'Measurement & Sig Figs', chapter: 'Measurement and Problem Solving',
  blurb: 'Count significant figures digit by digit, carry them through calculations, and convert units with dimensional analysis.',
  ideas: [
    'Significant figures show how precisely something was measured. The last digit is the estimated one.',
    '<b>Counting:</b> nonzero digits count; zeros between them count; leading zeros never count; trailing zeros count only when there is a decimal point.',
    '<b>× and ÷:</b> round the answer to the <i>fewest significant figures</i> among the inputs.',
    '<b>+ and −:</b> round to the <i>fewest decimal places</i> among the inputs.',
    'Exact numbers (counted objects, defined conversions like 1 in = 2.54 cm) have unlimited sig figs.',
    '<b>Dimensional analysis:</b> multiply by conversion factors arranged so the unwanted unit cancels: <span class="eqn">given × (desired / given) = desired</span>.',
  ],
  bench(el) {
    const allUnits = Object.entries(UNITS).flatMap(([d, us]) => Object.keys(us).map(u => [u, `${u} (${d})`]));
    el.innerHTML = `
      <div class="panel">
        <h3>Sig fig inspector</h3>
        <p class="sub">Type any measured value. Significant digits light up.</p>
        <div class="row">${UI.text('sf-in', 'Measured value', '0.004050', 'e.g. 1200. or 3.040e5')}</div>
        <div id="sf-out"></div>
      </div>
      <div class="panel">
        <h3>Unit converter</h3>
        <p class="sub">See the conversion factor that cancels the unit you start with.</p>
        <div class="row">${UI.num('uc-v', 'Value', '12.0')}${UI.select('uc-from', 'From', allUnits, 'in')}${UI.select('uc-to', 'To', [], 'cm')}</div>
        <div id="uc-out"></div>
      </div>`;
    const sfIn = el.querySelector('#sf-in'), sfOut = el.querySelector('#sf-out');
    function sf() {
      const info = sigInfo(sfIn.value);
      if (!info) { sfOut.innerHTML = '<div class="callout warn">Enter a number such as 0.0250, 4500, or 6.02e23.</div>'; return; }
      const digits = info.chars.map((c, i) => `<span class="dg${info.sig[i] ? ' on' : ''}">${U.esc(c)}</span>`).join('');
      sfOut.innerHTML = `
        <style>.dg{display:inline-block;min-width:.72em;text-align:center;font-family:var(--mono);font-size:clamp(1.8rem,6vw,2.6rem);font-weight:600;color:var(--muted);opacity:.55;border-bottom:3px solid transparent}.dg.on{color:var(--f-found);opacity:1;border-color:var(--f-found)}</style>
        <div class="row" style="align-items:center;gap:18px"><div class="scroll">${digits}</div>
        <div><div class="readout">${info.count}</div><div class="note">significant figure${info.count === 1 ? '' : 's'}</div></div></div>
        <ul class="note" style="margin:0;padding-left:1.1em">${info.notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
    }
    const from = el.querySelector('#uc-from'), to = el.querySelector('#uc-to'), v = el.querySelector('#uc-v'), ucOut = el.querySelector('#uc-out');
    function fillTo(keep) {
      const d = unitDim(from.value);
      to.innerHTML = Object.keys(UNITS[d]).filter(u => u !== from.value).map(u => `<option${u === keep ? ' selected' : ''}>${u}</option>`).join('');
    }
    function uc() {
      const x = parseNum(v.value), d = unitDim(from.value);
      if (x === null) { ucOut.innerHTML = '<div class="callout warn">Enter a number to convert.</div>'; return; }
      const r = UNITS[d][from.value] / UNITS[d][to.value];
      const sfN = Math.max(1, sigInfo(v.value)?.count || 3);
      ucOut.innerHTML = `<div class="callout" style="font-size:1.05rem;overflow-x:auto">
        <span style="white-space:nowrap">${U.esc(v.value)} <b>${from.value}</b> × <span style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.92em;margin:0 4px"><span style="border-bottom:1.5px solid currentColor;padding:0 4px">${fmt(r, 5)} ${to.value}</span><span>1 ${from.value}</span></span> = <b>${fmt(x * r, sfN)} ${to.value}</b></span></div>
        <p class="note">Answer rounded to ${sfN} sig fig${sfN > 1 ? 's' : ''} to match the value you entered. ${['in→cm', 'cm→in', 'ft→m', 'm→ft'].includes(from.value + '→' + to.value) ? 'The factor is exact by definition, so it does not limit sig figs.' : ''}</p>`;
    }
    sfIn.addEventListener('input', sf);
    from.addEventListener('change', () => { fillTo(); uc(); });
    to.addEventListener('change', uc); v.addEventListener('input', uc);
    fillTo('cm'); sf(); uc();
  },
  problems: [
    { name: 'Count sig figs', gen() {
      const forms = [
        () => '0.' + '0'.repeat(U.ri(1, 3)) + sfString(1, 9.99, U.ri(2, 4)).replace('.', ''),
        () => sfString(1, 999, U.ri(3, 5)),
        () => String(U.ri(1, 9)) + '0' + String(U.ri(1, 9)) + (Math.random() < .5 ? '.0' : '0'),
        () => String(U.ri(11, 99)) + '00' + (Math.random() < .5 ? '.' : ''),
        () => `${sfString(1, 9.99, U.ri(2, 5))} × 10^${U.ri(-8, 9)}`,
        () => sfString(10, 99.9, U.ri(3, 4)) + '0',
      ];
      const s = U.pick(forms)();
      const info = sigInfo(s);
      return { kind: 'num', q: `How many significant figures are in <b style="font-family:var(--mono)">${s.replace(/\^(-?\d+)/, '<sup>$1</sup>')}</b>?`, answer: info.count, tol: 0, ph: 'whole number',
        explain: info.notes.join(' ') };
    } },
    { name: 'Round', gen() {
      const n = U.ri(2, 4), e = U.ri(-4, 4);
      const x = Number((U.rnd(1, 9.999) * 10 ** e).toPrecision(7));
      const ans = Number(x.toPrecision(n));
      return { kind: 'num', q: `Round <b style="font-family:var(--mono)">${x}</b> to ${n} significant figures.`, answer: ans, display: fmt(ans, n),
        check: r => { const v = parseNum(r); if (v === null) return null; const si = sigInfo(r.replace(/,/g, '')); return Math.abs(v - ans) <= Math.abs(ans) * 1e-9 && (!si || si.count === n || si.ambiguous); },
        explain: `Keep ${n} digits starting at the first nonzero digit, then look at the next digit: 5 or more rounds up. Result: <b>${fmt(ans, n)}</b>.` };
    } },
    { name: 'Multiply & divide', gen() {
      const na = U.ri(2, 4), nb = U.ri(2, 4);
      const a = sfString(1, 99, na), b = sfString(1, 99, nb);
      const div = Math.random() < .5;
      const raw = div ? a / b : a * b, n = Math.min(na, nb), ans = Number(raw.toPrecision(n));
      return { kind: 'num', q: `Calculate and report with the correct sig figs: <b style="font-family:var(--mono)">${a} ${div ? '÷' : '×'} ${b}</b>`, answer: ans, display: fmt(ans, n),
        check: r => { const v = parseNum(r); if (v === null) return null; const si = sigInfo(r.replace(/,/g, '')); return Math.abs(v - ans) <= Math.abs(ans) * 1e-9 && (!si || si.count === n || si.ambiguous); },
        explain: `Calculator: ${Number(raw.toPrecision(7))}. ${a} has ${na} sig figs and ${b} has ${nb}, so keep <b>${n}</b>: ${fmt(ans, n)}.` };
    } },
    { name: 'Add & subtract', gen() {
      const parts = [0, 1, 2].map(() => U.rnd(1, 80).toFixed(U.ri(0, 3)));
      const sub = Math.random() < .35;
      const vals = parts.map(Number);
      const raw = sub ? vals[0] + vals[1] - vals[2] : vals[0] + vals[1] + vals[2];
      const dp = Math.min(...parts.map(decimals)), ans = Number(raw.toFixed(dp));
      return { kind: 'num', q: `Calculate and report with the correct sig figs: <b style="font-family:var(--mono)">${parts[0]} + ${parts[1]} ${sub ? '−' : '+'} ${parts[2]}</b>`, answer: ans, display: ans.toFixed(dp),
        check: r => { const v = parseNum(r); if (v === null) return null; return Math.abs(v - ans) < 1e-9 && decimals(r.trim().replace(/\.$/, '')) === dp; },
        explain: `Raw sum: ${Number(raw.toFixed(6))}. The input with the fewest decimal places has <b>${dp}</b>, so round to ${dp} decimal place${dp === 1 ? '' : 's'}: ${ans.toFixed(dp)}.` };
    } },
    { name: 'Convert units', gen() {
      const d = U.pick(Object.keys(UNITS)), us = U.shuffle(Object.keys(UNITS[d]));
      const [a, b] = us, x = U.sf(0.5, 500, 3), r = UNITS[d][a] / UNITS[d][b];
      return { kind: 'num', q: `Convert <b>${x} ${a}</b> to ${b}.`, answer: x * r, unit: b, tol: 0.01,
        explain: `<span class="eqn">${x} ${a} × (${fmt(r, 4)} ${b} / 1 ${a}) = ${fmt(x * r, 3)} ${b}</span>` };
    } },
  ],
});

/* ---------- Matter and energy ---------- */
const SPECIFIC_HEAT = [['Water (liquid)', 4.184], ['Ethanol', 2.44], ['Aluminum', 0.903], ['Glass', 0.84], ['Iron', 0.449], ['Copper', 0.385], ['Silver', 0.235], ['Gold', 0.128]];
const MATTER_ITEMS = [
  ['pure gold', 'Element'], ['helium gas', 'Element'], ['copper wire', 'Element'], ['mercury', 'Element'], ['diamond (pure carbon)', 'Element'], ['oxygen gas', 'Element'],
  ['pure water', 'Compound'], ['table salt (NaCl)', 'Compound'], ['table sugar (sucrose)', 'Compound'], ['carbon dioxide', 'Compound'], ['baking soda (NaHCO₃)', 'Compound'], ['rust (Fe₂O₃)', 'Compound'],
  ['air', 'Homogeneous mixture'], ['salt water', 'Homogeneous mixture'], ['brass', 'Homogeneous mixture'], ['vinegar', 'Homogeneous mixture'], ['black coffee', 'Homogeneous mixture'], ['steel', 'Homogeneous mixture'],
  ['granite', 'Heterogeneous mixture'], ['chicken noodle soup', 'Heterogeneous mixture'], ['oil and water', 'Heterogeneous mixture'], ['sand and iron filings', 'Heterogeneous mixture'], ['chocolate chip cookie', 'Heterogeneous mixture'], ['soil', 'Heterogeneous mixture'],
];
const CHANGES = [
  ['ice melting', 'Physical'], ['sugar dissolving in tea', 'Physical'], ['water boiling', 'Physical'], ['cutting paper', 'Physical'], ['dry ice subliming', 'Physical'], ['crushing a can', 'Physical'], ['breaking glass', 'Physical'], ['alcohol evaporating', 'Physical'], ['bending a wire', 'Physical'],
  ['wood burning', 'Chemical'], ['iron rusting', 'Chemical'], ['milk souring', 'Chemical'], ['baking a cake', 'Chemical'], ['gasoline combusting', 'Chemical'], ['silver tarnishing', 'Chemical'], ['frying an egg', 'Chemical'], ['digesting food', 'Chemical'], ['a firework exploding', 'Chemical'],
];
const MATTER_WHY = {
  'Element': 'An element is a pure substance made of only one kind of atom.',
  'Compound': 'A compound is a pure substance of two or more elements in a fixed ratio.',
  'Homogeneous mixture': 'A homogeneous mixture has the same composition throughout. You cannot see separate parts.',
  'Heterogeneous mixture': 'A heterogeneous mixture has visibly different regions.',
  'Physical': 'A physical change alters form or state but the substance stays the same.',
  'Chemical': 'A chemical change makes new substances (look for gas, color change, heat or light, a new smell).',
};
const toF = c => c * 9 / 5 + 32, fromF = f => (f - 32) * 5 / 9;

registerLab({
  id: 'matter-energy', ch: 3, sym: 'Me', fam: 'found',
  title: 'Matter & Energy', chapter: 'Matter and Energy',
  blurb: 'Classify matter and changes, convert temperatures, and calculate the heat it takes to warm a substance.',
  ideas: [
    '<b>Pure substances</b> are elements or compounds. <b>Mixtures</b> are homogeneous (uniform) or heterogeneous (not uniform).',
    '<b>Physical change:</b> same substance, new form. <b>Chemical change:</b> new substance forms.',
    'Energy is conserved. Units: <span class="eqn">1 cal = 4.184 J</span>, <span class="eqn">1 Cal = 1000 cal</span>, <span class="eqn">1 kWh = 3.60 × 10⁶ J</span>.',
    'Temperature: <span class="eqn">K = °C + 273.15</span> and <span class="eqn">°F = 1.8(°C) + 32</span>.',
    '<b>Heat capacity:</b> <span class="eqn">q = m · c · ΔT</span>, where c is the specific heat (J/g·°C) and ΔT = T<sub>final</sub> − T<sub>initial</sub>.',
    'Positive q means heat is absorbed. Negative q means heat is released. Water\'s high specific heat (4.184) is why it warms slowly.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Heat calculator</h3>
        <p class="sub">q = m · c · ΔT. No phase changes happen in this range.</p>
        <div class="row">${UI.select('hc-sub', 'Substance', SPECIFIC_HEAT.map(([n, c]) => [c, `${n} (c = ${c})`]), 4.184)}${UI.num('hc-m', 'Mass', '250', 'g')}</div>
        ${UI.slider('hc-ti', 'Start temp', 0, 95, 1, 20)}
        ${UI.slider('hc-tf', 'End temp', 0, 95, 1, 80)}
        <div class="row" style="align-items:stretch;gap:16px">
          <div id="hc-therm" style="flex:0 0 46px"></div>
          <div style="flex:1 1 220px;display:grid;gap:10px;min-width:0" id="hc-out"></div>
        </div>
      </div>
      <div class="panel">
        <h3>Temperature converter</h3>
        <p class="sub">Edit any box; the others follow.</p>
        <div class="row">${UI.num('tc-c', 'Celsius', '25', '°C')}${UI.num('tc-f', 'Fahrenheit', '77', '°F')}${UI.num('tc-k', 'Kelvin', '298.15', 'K')}</div>
        <div class="callout" id="tc-note"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function heat() {
      const c = +$('#hc-sub').value, m = parseNum($('#hc-m').value), ti = +$('#hc-ti').value, tf = +$('#hc-tf').value;
      $('#hc-ti-o').textContent = ti + ' °C'; $('#hc-tf-o').textContent = tf + ' °C';
      const lo = Math.min(ti, tf), hi = Math.max(ti, tf), up = tf >= ti;
      $('#hc-therm').innerHTML = `<div style="position:relative;height:100%;min-height:150px;width:22px;margin:0 auto;border:2px solid var(--line);border-radius:12px;background:var(--raised);overflow:hidden">
        <div style="position:absolute;left:0;right:0;bottom:${lo / 95 * 100}%;height:${(hi - lo) / 95 * 100}%;background:${up ? 'var(--c2)' : 'var(--c1)'};opacity:.85"></div>
        <div style="position:absolute;left:-2px;right:-2px;bottom:${tf / 95 * 100}%;height:3px;background:var(--ink)"></div></div>`;
      if (m === null || m <= 0) { $('#hc-out').innerHTML = '<div class="callout warn">Enter a positive mass in grams.</div>'; return; }
      const dT = tf - ti, q = m * c * dT;
      $('#hc-out').innerHTML = `<div class="readout">q = ${fmt(q, 3)} J</div>
        ${UI.kv([['ΔT', `${signed(dT)} °C`], ['kilojoules', fmt(q / 1000, 3) + ' kJ'], ['calories', fmt(q / 4.184, 3) + ' cal'], ['food Calories', fmt(q / 4184, 3) + ' Cal']])}
        <div class="callout ${q > 0 ? '' : q < 0 ? 'good' : ''}">${q > 0 ? `The ${m} g sample <b>absorbs</b> heat from its surroundings.` : q < 0 ? `The sample <b>releases</b> heat as it cools (q is negative).` : 'No temperature change, so no heat flows.'}</div>`;
    }
    ['#hc-sub', '#hc-m', '#hc-ti', '#hc-tf'].forEach(s => $(s).addEventListener('input', heat));
    function temp(src) {
      const v = parseNum($(src).value); if (v === null) return;
      let c = src === '#tc-c' ? v : src === '#tc-f' ? fromF(v) : v - 273.15;
      if (src !== '#tc-c') $('#tc-c').value = fmtP(c, 5);
      if (src !== '#tc-f') $('#tc-f').value = fmtP(toF(c), 5);
      if (src !== '#tc-k') $('#tc-k').value = fmtP(c + 273.15, 5);
      const marks = [[-273.15, 'absolute zero: nothing is colder'], [0, 'water freezes'], [37, 'body temperature'], [100, 'water boils at 1 atm']];
      const near = marks.find(([t]) => Math.abs(t - c) < 1.5);
      $('#tc-note').innerHTML = c < -273.15 ? 'Below absolute zero. That temperature cannot exist, and kelvin can never be negative.' : near ? `${fmtP(c, 4)} °C is about where ${near[1]}.` : 'Kelvin has no degree sign and no negative values: 0 K is absolute zero.';
    }
    ['#tc-c', '#tc-f', '#tc-k'].forEach(s => $(s).addEventListener('input', () => temp(s)));
    heat(); temp('#tc-c');
  },
  problems: [
    { name: 'Classify matter', gen() {
      const [item, ans] = U.pick(MATTER_ITEMS);
      return { ...mc(ans, ['Element', 'Compound', 'Homogeneous mixture', 'Heterogeneous mixture']), q: `Classify <b>${item}</b>.`, explain: MATTER_WHY[ans] };
    } },
    { name: 'Physical or chemical', gen() {
      const [item, ans] = U.pick(CHANGES);
      return { ...mc(ans, ['Physical', 'Chemical']), q: `Is <b>${item}</b> a physical change or a chemical change?`, explain: MATTER_WHY[ans] };
    } },
    { name: 'q = mcΔT', gen() {
      const [name, c] = U.pick(SPECIFIC_HEAT);
      const m = U.sf(10, 500, 3), ti = U.ri(5, 30), tf = ti + U.ri(10, 60) * (Math.random() < .25 ? -0.3 : 1) | 0;
      const dT = tf - ti, q = m * c * dT, mode = U.ri(0, 2);
      if (mode === 0) return { kind: 'num', q: `How much heat (in J) is needed to change ${m} g of ${name.toLowerCase()} from ${ti} °C to ${tf} °C? (c = ${c} J/g·°C)`, answer: q, unit: 'J', explain: `<span class="eqn">q = ${m} g × ${c} J/g·°C × (${tf} − ${ti}) °C = ${fmt(q, 3)} J</span>${q < 0 ? ' Negative, so heat is released.' : ''}` };
      if (mode === 1) { const qa = Math.abs(q); return { kind: 'num', q: `A ${m} g sample of ${name.toLowerCase()} (c = ${c} J/g·°C) absorbs ${fmt(qa, 3)} J. By how many °C does its temperature rise?`, answer: qa / (m * c), unit: '°C', explain: `<span class="eqn">ΔT = q / (m·c) = ${fmt(qa, 3)} / (${m} × ${c}) = ${fmt(qa / (m * c), 3)} °C</span>` }; }
      const qa = Math.abs(q), d = Math.abs(dT);
      return { kind: 'num', q: `An unknown sample of ${m} g absorbs ${fmt(qa, 3)} J and warms by ${d} °C. What is its specific heat?`, answer: c, unit: 'J/g·°C', explain: `<span class="eqn">c = q / (m·ΔT) = ${fmt(qa, 3)} / (${m} × ${d}) = ${fmt(c, 3)} J/g·°C</span>, which matches ${name.toLowerCase()}.` };
    } },
    { name: 'Temperature scales', gen() {
      const mode = U.ri(0, 3);
      if (mode === 0) { const c = U.ri(-80, 400); return { kind: 'num', q: `Convert ${c} °C to kelvin.`, answer: c + 273.15, unit: 'K', abs: 0.6, tol: 0, explain: `<span class="eqn">K = ${c} + 273.15 = ${(c + 273.15).toFixed(2)} K</span>` }; }
      if (mode === 1) { const k = U.ri(50, 700); return { kind: 'num', q: `Convert ${k} K to °C.`, answer: k - 273.15, unit: '°C', abs: 0.6, tol: 0, explain: `<span class="eqn">°C = ${k} − 273.15 = ${(k - 273.15).toFixed(2)} °C</span>` }; }
      if (mode === 2) { const f = U.ri(-40, 450); return { kind: 'num', q: `Convert ${f} °F to °C.`, answer: fromF(f), unit: '°C', abs: 0.6, tol: 0, explain: `<span class="eqn">°C = (${f} − 32) / 1.8 = ${fromF(f).toFixed(1)} °C</span>` }; }
      const c = U.ri(-40, 250); return { kind: 'num', q: `Convert ${c} °C to °F.`, answer: toF(c), unit: '°F', abs: 0.6, tol: 0, explain: `<span class="eqn">°F = 1.8 × ${c} + 32 = ${toF(c).toFixed(1)} °F</span>` };
    } },
    { name: 'Energy units', gen() {
      const conv = [
        ['J', 'cal', 1 / 4.184, '1 cal = 4.184 J'], ['cal', 'J', 4.184, '1 cal = 4.184 J'], ['Cal', 'kJ', 4.184, '1 Cal = 1000 cal = 4.184 kJ'],
        ['kJ', 'Cal', 1 / 4.184, '1 Cal = 4.184 kJ'], ['kWh', 'J', 3.6e6, '1 kWh = 3.60 × 10⁶ J'], ['J', 'kWh', 1 / 3.6e6, '1 kWh = 3.60 × 10⁶ J'],
      ];
      const [a, b, f, rule] = U.pick(conv);
      const x = a === 'J' && b === 'kWh' ? U.sf(1e6, 9e7, 3) : U.sf(1, 900, 3);
      return { kind: 'num', q: `Convert ${fmt(x, 3)} ${a} to ${b}.`, answer: x * f, unit: b, explain: `Use ${rule}: ${fmt(x, 3)} ${a} → <b>${fmt(x * f, 3)} ${b}</b>.` };
    } },
  ],
});
