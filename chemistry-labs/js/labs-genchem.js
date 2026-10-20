'use strict';
/* Gen Chem Bridge: the general chemistry topics an intro course skips or only touches.
   G1 Thermochemistry, G2 Weak acids & buffers, G3 Kinetics, G4 Thermodynamics,
   G5 Electrochemistry, G6 Quantum numbers & advanced bonding.
   Also adds gen chem problem types to existing labs (gases, solutions, equilibrium). */

const R_J = 8.314, FARADAY = 96485;
const sci = (x, n = 2) => fmt(x, n);
const lg = Math.log10;

/* ================= G1: Thermochemistry ================= */
const DISSOLVE = [['NaOH', 'Sodium hydroxide', -44.5], ['CaCl2', 'Calcium chloride', -81.3], ['NH4NO3', 'Ammonium nitrate (cold pack)', 25.7], ['KCl', 'Potassium chloride', 17.2], ['LiCl', 'Lithium chloride', -37.0]];
const HF_TABLE = { 'CH4': -74.8, 'CO2': -393.5, 'H2O(l)': -285.8, 'H2O(g)': -241.8, 'C2H6': -84.7, 'C3H8': -103.8, 'NH3': -45.9, 'NO': 90.3, 'NO2': 33.2, 'SO2': -296.8, 'SO3': -395.7, 'C2H5OH': -277.7, 'C6H12O6': -1273.3, 'CaCO3': -1207.6, 'CaO': -635.1, 'Fe2O3': -824.2, 'Al2O3': -1675.7, 'O2': 0, 'N2': 0, 'H2': 0, 'Fe': 0, 'Al': 0 };
const HF_RX = [
  [[[1, 'CH4'], [2, 'O2']], [[1, 'CO2'], [2, 'H2O(l)']]], [[[1, 'C3H8'], [5, 'O2']], [[3, 'CO2'], [4, 'H2O(l)']]], [[[2, 'C2H6'], [7, 'O2']], [[4, 'CO2'], [6, 'H2O(l)']]],
  [[[1, 'CaCO3']], [[1, 'CaO'], [1, 'CO2']]], [[[1, 'Fe2O3'], [2, 'Al']], [[1, 'Al2O3'], [2, 'Fe']]], [[[4, 'NH3'], [5, 'O2']], [[4, 'NO'], [6, 'H2O(g)']]],
  [[[1, 'C2H5OH'], [3, 'O2']], [[2, 'CO2'], [3, 'H2O(l)']]], [[[2, 'SO2'], [1, 'O2']], [[2, 'SO3']]], [[[1, 'N2'], [3, 'H2']], [[2, 'NH3']]], [[[1, 'C6H12O6'], [6, 'O2']], [[6, 'CO2'], [6, 'H2O(l)']]],
];
const rxHTML = (re, pr, arrow = '→') => `${re.map(([c, f]) => `${c > 1 ? c + ' ' : ''}${fmtF(f.replace(/\(.*\)/, ''))}${/\(/.test(f) ? f.match(/\(.*\)/)[0] : ''}`).join(' + ')} ${arrow} ${pr.map(([c, f]) => `${c > 1 ? c + ' ' : ''}${fmtF(f.replace(/\(.*\)/, ''))}${/\(/.test(f) ? f.match(/\(.*\)/)[0] : ''}`).join(' + ')}`;
const dHrxn = ([re, pr]) => pr.reduce((s, [c, f]) => s + c * HF_TABLE[f], 0) - re.reduce((s, [c, f]) => s + c * HF_TABLE[f], 0);
/* Hess's law puzzles: equations as {species: coefficient} (products +, reactants −) */
const HESS = [
  { target: { C: -1, O2: -0.5, CO: 1 }, steps: [[{ C: -1, O2: -1, CO2: 1 }, -393.5], [{ CO: -1, O2: -0.5, CO2: 1 }, -283.0]], sol: [1, -1] },
  { target: { C: -1, H2: -2, CH4: 1 }, steps: [[{ C: -1, O2: -1, CO2: 1 }, -393.5], [{ H2: -1, O2: -0.5, H2O: 1 }, -285.8], [{ CH4: -1, O2: -2, CO2: 1, H2O: 2 }, -890.3]], sol: [1, 2, -1] },
  { target: { S: -2, O2: -3, SO3: 2 }, steps: [[{ S: -1, O2: -1, SO2: 1 }, -296.8], [{ SO2: -2, O2: -1, SO3: 2 }, -197.8]], sol: [2, 1] },
  { target: { N2: -1, O2: -2, NO2: 2 }, steps: [[{ N2: -1, O2: -1, NO: 2 }, 180.6], [{ NO: -2, O2: -1, NO2: 2 }, -114.2]], sol: [1, 1] },
  { target: { C2H4: -1, H2: -1, C2H6: 1 }, steps: [[{ C2H4: -1, O2: -3, CO2: 2, H2O: 2 }, -1411], [{ H2: -1, O2: -0.5, H2O: 1 }, -285.8], [{ C2H6: -1, O2: -3.5, CO2: 2, H2O: 3 }, -1560]], sol: [1, 1, -1] },
];
const hessSum = (steps, f) => { const m = {}; steps.forEach(([eq], i) => { for (const k in eq) m[k] = (m[k] || 0) + eq[k] * f[i]; }); for (const k in m) if (Math.abs(m[k]) < 1e-9) delete m[k]; return m; };
const coefTxt = c => { const a = Math.abs(c); return a === 1 ? '' : (a === 0.5 ? '½' : a === 1.5 ? '3⁄2' : a === 3.5 ? '7⁄2' : a === 2.5 ? '5⁄2' : String(+a.toFixed(2))) + ' '; };
const mapEq = m => { const re = Object.entries(m).filter(([, c]) => c < 0), pr = Object.entries(m).filter(([, c]) => c > 0); const side = l => l.map(([k, c]) => coefTxt(c) + fmtF(k)).join(' + ') || '—'; return `${side(re)} → ${side(pr)}`; };
const sameMap = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) if (Math.abs((a[k] || 0) - (b[k] || 0)) > 1e-9) return false; return true; };
const BOND_E = { 'H–H': 436, 'O=O': 498, 'O–H': 463, 'C–H': 413, 'C=O': 799, 'Cl–Cl': 242, 'H–Cl': 431, 'N≡N': 945, 'N–H': 391, 'C–C': 348 };
const BOND_RX = [
  ['H₂ + Cl₂ → 2 HCl', [['H–H', 1], ['Cl–Cl', 1]], [['H–Cl', 2]]], ['2 H₂ + O₂ → 2 H₂O', [['H–H', 2], ['O=O', 1]], [['O–H', 4]]],
  ['CH₄ + 2 O₂ → CO₂ + 2 H₂O', [['C–H', 4], ['O=O', 2]], [['C=O', 2], ['O–H', 4]]], ['N₂ + 3 H₂ → 2 NH₃', [['N≡N', 1], ['H–H', 3]], [['N–H', 6]]],
  ['C₂H₆ → C₂H₄ + H₂ (C–C stays, one C–C becomes C=C: use C–H only)', null, null],
].filter(r => r[1]);

registerLab({
  id: 'thermo', ch: 101, code: 'G1', sym: 'Th', fam: 'gen',
  title: 'Thermochemistry', chapter: 'Enthalpy, calorimetry and Hess\'s law',
  blurb: 'Run a coffee-cup calorimeter, chain equations together with Hess\'s law, and calculate reaction enthalpies three different ways.',
  ideas: [
    '<b>Enthalpy change ΔH</b> is the heat a reaction absorbs or releases at constant pressure. ΔH < 0 is <b>exothermic</b> (releases heat); ΔH > 0 is <b>endothermic</b>.',
    '<b>System vs surroundings:</b> in a calorimeter, <span class="eqn">q<sub>rxn</sub> = −q<sub>solution</sub> = −m·c·ΔT</span>. If the water warms up, the reaction released heat.',
    '<span class="eqn">ΔH<sub>rxn</sub> = q<sub>rxn</sub> / moles</span>, reported in kJ/mol. ΔH scales with the equation: double the coefficients, double ΔH.',
    '<b>Hess\'s law:</b> ΔH depends only on start and end, so you can add equations. Reverse an equation → flip the sign of ΔH. Multiply it → multiply ΔH.',
    '<b>From heats of formation:</b> <span class="eqn">ΔH°<sub>rxn</sub> = ΣnΔH°<sub>f</sub>(products) − ΣnΔH°<sub>f</sub>(reactants)</span>. Elements in their standard state have ΔH°<sub>f</sub> = 0.',
    '<b>From bond energies (estimate):</b> <span class="eqn">ΔH ≈ Σ bonds broken − Σ bonds formed</span>. Breaking bonds costs energy; forming them releases it.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Coffee-cup calorimeter</h3>
        <p class="sub">Dissolve a salt in water and read the thermometer. The water's temperature change reveals ΔH.</p>
        <div class="row">${UI.select('cal-s', 'Solute', DISSOLVE.map((d, i) => [i, `${d[1]} (${d[0]})`]), 0)}</div>
        ${UI.slider('cal-g', 'Solute mass', 0.5, 20, 0.1, 5)}
        ${UI.slider('cal-w', 'Water', 50, 250, 5, 100)}
        <div class="row" style="align-items:stretch;gap:16px"><div id="cal-th" style="flex:0 0 46px"></div><div id="cal-out" style="flex:1 1 220px;display:grid;gap:10px;min-width:0"></div></div>
      </div>
      <div class="panel">
        <h3>Hess's law workbench</h3>
        <p class="sub">Flip and scale the known equations until they add up to the target. Species on both sides cancel.</p>
        <div class="row">${UI.select('hs-p', 'Puzzle', HESS.map((h, i) => [i, `${i + 1}. ${mapEq(h.target).replace(/<[^>]+>/g, '')}`]), 0)}</div>
        <div id="hs-out" style="display:grid;gap:10px"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function cal() {
      const [f, name, dH] = DISSOLVE[$('#cal-s').value], g = +$('#cal-g').value, w = +$('#cal-w').value;
      $('#cal-g-o').textContent = g.toFixed(1) + ' g'; $('#cal-w-o').textContent = w + ' g';
      const M = Chem.molarMass(f), n = g / M, qrxn = n * dH * 1000, qsol = -qrxn, dT = qsol / ((w + g) * 4.184), Ti = 22.0, Tf = Ti + dT;
      const lo = 0, hi = 50, pos = t => U.clamp((t - lo) / (hi - lo), 0, 1) * 100;
      $('#cal-th').innerHTML = `<div style="position:relative;height:100%;min-height:170px;width:22px;margin:0 auto;border:2px solid var(--line);border-radius:12px;background:var(--raised);overflow:hidden">
        <div style="position:absolute;left:0;right:0;bottom:0;height:${pos(Tf)}%;background:${dT >= 0 ? 'var(--c2)' : 'var(--c1)'};transition:height .4s ease"></div>
        <div style="position:absolute;left:-2px;right:-2px;bottom:${pos(Ti)}%;height:2px;background:var(--ink);opacity:.5"></div></div>`;
      $('#cal-out').innerHTML = `<div class="readout">${Ti.toFixed(1)} → ${Tf.toFixed(1)} °C</div>
        ${UI.kv([['ΔT', signed(+dT.toFixed(2)) + ' °C'], ['q<sub>solution</sub> = mcΔT', fmt(qsol / 1000, 3) + ' kJ'], ['q<sub>rxn</sub> = −q<sub>soln</sub>', fmt(qrxn / 1000, 3) + ' kJ'], ['moles of solute', fmt(n, 3) + ' mol'], ['ΔH<sub>soln</sub> = q<sub>rxn</sub>/n', dH + ' kJ/mol']])}
        <div class="callout ${dH < 0 ? 'warn' : ''}">${dH < 0 ? `<b>Exothermic.</b> Dissolving ${f} releases heat into the water, so the cup gets warmer.` : `<b>Endothermic.</b> Dissolving ${f} pulls heat out of the water, so the cup gets colder. That's how instant cold packs work.`}</div>`;
    }
    ['#cal-s', '#cal-g', '#cal-w'].forEach(s => $(s).addEventListener('input', cal));
    let pz, fac;
    const FACT = [-2, -1, -0.5, 0.5, 1, 2, 3];
    function hessSetup() { pz = HESS[$('#hs-p').value]; fac = pz.steps.map(() => 1); hess(); }
    function hess() {
      const sum = hessSum(pz.steps, fac), dH = pz.steps.reduce((s, [, h], i) => s + h * fac[i], 0), ok = sameMap(sum, pz.target);
      $('#hs-out').innerHTML = `<div class="callout"><b>Target:</b> ${mapEq(pz.target)}</div>
        <div class="scroll"><table class="t"><tr><th>Known equation</th><th class="n">ΔH (kJ)</th><th>Use it ×</th><th class="n">Contributes</th></tr>
        ${pz.steps.map(([eq, h], i) => `<tr><td>${mapEq(eq)}</td><td class="n">${h}</td><td><div class="seg" data-row="${i}">${FACT.map(f => `<button type="button" data-f="${f}" aria-pressed="${fac[i] === f}">${f > 0 ? '×' + (coefTxt(f).trim() || '1') : 'reverse ×' + (coefTxt(-f).trim() || '1')}</button>`).join('')}</div></td><td class="n">${fmt(h * fac[i], 4)}</td></tr>`).join('')}</table></div>
        <div class="callout ${ok ? 'good' : ''}"><b>Sum:</b> ${mapEq(sum)} &nbsp; ΔH = <b>${fmt(dH, 4)} kJ</b>${ok ? '<br><b>That matches the target.</b> Hess\'s law gives ΔH for a reaction that is hard to measure directly.' : '<br>Not the target yet. Look for a species that should cancel, or one that sits on the wrong side.'}</div>`;
      $('#hs-out').querySelectorAll('[data-row]').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; fac[+seg.dataset.row] = +b.dataset.f; hess(); }));
    }
    $('#hs-p').addEventListener('change', hessSetup);
    cal(); hessSetup();
  },
  problems: [
    { name: 'Calorimetry → ΔH', gen() {
      const [f, name, dH] = U.pick(DISSOLVE), g = U.sf(2, 15, 3), w = U.pick([50.0, 75.0, 100.0, 150.0]), n = g / Chem.molarMass(f);
      const dT = Number((-(n * dH * 1000) / ((w + g) * 4.184)).toFixed(1)), Ti = U.pick([21.5, 22.0, 22.4, 23.1, 24.0]);
      const ans = -((w + g) * 4.184 * dT) / n / 1000;
      return { kind: 'num', unit: 'kJ/mol', tol: 0.03, q: `You dissolve <b>${g} g of ${fmtF(f)}</b> in <b>${w.toFixed(1)} g of water</b> in a coffee-cup calorimeter. The temperature changes from ${Ti.toFixed(1)} °C to <b>${(Ti + dT).toFixed(1)} °C</b>. Assuming the solution has c = 4.184 J/g·°C, what is ΔH<sub>soln</sub> in kJ/mol?`, answer: ans,
        explain: `Mass of solution = ${w} + ${g} = ${fmtP(w + g, 4)} g. q<sub>soln</sub> = ${fmtP(w + g, 4)} × 4.184 × (${dT}) = ${fmt((w + g) * 4.184 * dT, 3)} J. q<sub>rxn</sub> = −q<sub>soln</sub>. n = ${g} ÷ ${Chem.molarMass(f).toFixed(2)} = ${fmt(n, 3)} mol. ΔH = q<sub>rxn</sub>/n = <b>${fmt(ans, 3)} kJ/mol</b>${ans < 0 ? ' (exothermic: the water warmed).' : ' (endothermic: the water cooled).'}` };
    } },
    { name: 'Hess\'s law', gen() {
      const pz = U.pick(HESS), ans = pz.steps.reduce((s, [, h], i) => s + h * pz.sol[i], 0);
      return { kind: 'num', unit: 'kJ', tol: 0, abs: 0.6, q: `Use these equations to find ΔH for <span class="eqline">${mapEq(pz.target)}</span>${pz.steps.map(([eq, h]) => `<span class="eqline" style="font-size:.95rem">${mapEq(eq)} &nbsp; ΔH = ${h} kJ</span>`).join('')}`, answer: ans, display: fmt(ans, 4) + ' kJ',
        explain: pz.steps.map(([, h], i) => `${pz.sol[i] < 0 ? 'Reverse' : 'Keep'} equation ${i + 1}${Math.abs(pz.sol[i]) !== 1 ? ` and multiply by ${Math.abs(pz.sol[i])}` : ''}: ${fmt(h * pz.sol[i], 4)} kJ`).join('. ') + `. Add them: <b>${fmt(ans, 4)} kJ</b>.` };
    } },
    { name: 'ΔH° from formation', gen() {
      const rx = U.pick(HF_RX), ans = dHrxn(rx), used = [...new Set([...rx[0], ...rx[1]].map(x => x[1]))];
      return { kind: 'num', unit: 'kJ', tol: 0, abs: 1.5, q: `Calculate ΔH°<sub>rxn</sub> for <span class="eqline">${rxHTML(...rx)}</span>ΔH°<sub>f</sub> (kJ/mol): ${used.map(f => `${fmtF(f.replace(/\(.*\)/, ''))}${(f.match(/\(.*\)/) || [''])[0]} ${HF_TABLE[f]}`).join(', ')}`, answer: ans, display: ans.toFixed(1) + ' kJ',
        explain: `Products: ${rx[1].map(([c, f]) => `${c}(${HF_TABLE[f]})`).join(' + ')} = ${rx[1].reduce((s, [c, f]) => s + c * HF_TABLE[f], 0).toFixed(1)}. Reactants: ${rx[0].map(([c, f]) => `${c}(${HF_TABLE[f]})`).join(' + ')} = ${rx[0].reduce((s, [c, f]) => s + c * HF_TABLE[f], 0).toFixed(1)}. Products − reactants = <b>${ans.toFixed(1)} kJ</b>.` };
    } },
    { name: 'Heat from a reaction', gen() {
      const rx = U.pick(HF_RX.filter(r => r[0][0][1] !== 'O2' && dHrxn(r) < 0)), dH = dHrxn(rx), [c, f] = rx[0][0], M = Chem.molarMass(f.replace(/\(.*\)/, '')), g = U.sf(5, 120, 3);
      const q = g / M / c * Math.abs(dH);
      return { kind: 'num', unit: 'kJ', q: `<span class="eqline">${rxHTML(...rx)} &nbsp; ΔH = ${dH.toFixed(1)} kJ</span>How much heat is <b>released</b> when <b>${g} g of ${fmtF(f)}</b> reacts completely?`, answer: q,
        explain: `<span class="eqn">${g} g ÷ ${M.toFixed(2)} g/mol = ${fmt(g / M, 3)} mol ${fmtF(f)}</span>. The equation releases ${Math.abs(dH).toFixed(1)} kJ per ${c} mol ${fmtF(f)}, so q = ${fmt(g / M, 3)} × ${Math.abs(dH).toFixed(1)} / ${c} = <b>${fmt(q, 3)} kJ</b>.` };
    } },
    { name: 'Bond energies', gen() {
      const [eq, br, fo] = U.pick(BOND_RX), sb = br.reduce((s, [b, n]) => s + n * BOND_E[b], 0), sf = fo.reduce((s, [b, n]) => s + n * BOND_E[b], 0), ans = sb - sf;
      const all = [...new Set([...br, ...fo].map(x => x[0]))];
      return { kind: 'num', unit: 'kJ', tol: 0, abs: 1, q: `Estimate ΔH for <span class="eqline">${eq}</span>Bond energies (kJ/mol): ${all.map(b => `${b} ${BOND_E[b]}`).join(', ')}.`, answer: ans,
        explain: `Broken: ${br.map(([b, n]) => `${n} ${b}`).join(' + ')} = ${sb} kJ. Formed: ${fo.map(([b, n]) => `${n} ${b}`).join(' + ')} = ${sf} kJ. ΔH ≈ ${sb} − ${sf} = <b>${ans} kJ</b>.` };
    } },
    { name: 'Exo or endo', gen() {
      const items = [['Water freezing', 'Exothermic', 'Molecules settle into a lower-energy solid and release heat.'], ['Ice melting', 'Endothermic', 'Heat is absorbed to break hydrogen bonds.'], ['Burning methane', 'Exothermic', 'Combustion releases heat (ΔH = −890 kJ/mol).'], ['Dissolving NH₄NO₃ in a cold pack', 'Endothermic', 'The pack gets cold because the process absorbs heat.'], ['Water vapor condensing', 'Exothermic', 'Condensation releases the heat of vaporization.'], ['Photosynthesis', 'Endothermic', 'Plants store the energy of sunlight in glucose.'], ['A hand warmer (iron rusting)', 'Exothermic', 'Iron oxidation releases heat.'], ['Breaking a chemical bond', 'Endothermic', 'Breaking bonds always costs energy.'], ['Forming a chemical bond', 'Exothermic', 'Forming bonds always releases energy.'], ['Boiling water', 'Endothermic', 'Molecules need energy to escape into the gas.']];
      const [it, ans, why] = U.pick(items);
      return { ...mc(ans, ['Exothermic', 'Endothermic']), q: `Is <b>${it.toLowerCase()}</b> exothermic or endothermic (from the system's point of view)?`, explain: why };
    } },
  ],
});

/* ================= G2: Weak acids, ICE tables and buffers ================= */
const WEAK_ACIDS = [['HC2H3O2', 'acetic acid', 1.8e-5], ['HF', 'hydrofluoric acid', 6.8e-4], ['HNO2', 'nitrous acid', 4.6e-4], ['HCOOH', 'formic acid', 1.8e-4], ['HClO', 'hypochlorous acid', 2.9e-8], ['HCN', 'hydrocyanic acid', 4.9e-10], ['C6H5COOH', 'benzoic acid', 6.5e-5]];
const WEAK_BASES = [['NH3', 'ammonia', 1.8e-5], ['CH3NH2', 'methylamine', 4.4e-4], ['C5H5N', 'pyridine', 1.7e-9]];
const BUFFERS = [['HC2H3O2 / C2H3O2⁻', 'acetic acid / acetate', 1.8e-5], ['NH4⁺ / NH3', 'ammonium / ammonia', 5.6e-10], ['H2PO4⁻ / HPO4²⁻', 'dihydrogen / hydrogen phosphate', 6.2e-8], ['H2CO3 / HCO3⁻', 'carbonic acid / bicarbonate', 4.3e-7]];
const xExact = (K, C) => (-K + Math.sqrt(K * K + 4 * K * C)) / 2;
/* pH of a buffer (or what is left of it) after adding strong acid/base, by stoichiometry then Henderson–Hasselbalch */
function bufferPH(Ka, nHA, nA, addH, V) {
  let ha = nHA, a = nA;
  if (addH > 0) { const use = Math.min(addH, a); a -= use; ha += use; const extra = addH - use; if (extra > 1e-12) return -lg(extra / V); }
  if (addH < 0) { const use = Math.min(-addH, ha); ha -= use; a += use; const extra = -addH - use; if (extra > 1e-12) return 14 + lg(extra / V); }
  if (ha <= 1e-12) { const Kb = 1e-14 / Ka, oh = Math.sqrt(Kb * a / V); return 14 + lg(oh); }
  if (a <= 1e-12) return -lg(xExact(Ka, ha / V));
  return -lg(Ka) + lg(a / ha);
}
const waterPH = (addH, V) => Math.abs(addH) < 1e-12 ? 7 : addH > 0 ? -lg(addH / V + 1e-7) : 14 + lg(-addH / V + 1e-7);

registerLab({
  id: 'buffers', ch: 102, code: 'G2', sym: 'Bf', fam: 'gen',
  title: 'Weak Acids, ICE Tables & Buffers', chapter: 'Acid–base equilibria',
  blurb: 'Solve weak-acid equilibria with live ICE tables, then build a buffer and watch it shrug off added acid and base.',
  ideas: [
    'A weak acid only partly ionizes: <span class="eqn">HA ⇌ H⁺ + A⁻</span>, with <span class="eqn">K<sub>a</sub> = [H⁺][A⁻]/[HA]</span>. Smaller K<sub>a</sub> means a weaker acid. <span class="eqn">pK<sub>a</sub> = −log K<sub>a</sub></span>.',
    '<b>ICE table:</b> write Initial, Change (−x, +x, +x) and Equilibrium rows, plug into K<sub>a</sub>, and solve for x = [H⁺].',
    '<b>The 5% shortcut:</b> if K<sub>a</sub> is small, C − x ≈ C, so <span class="eqn">x ≈ √(K<sub>a</sub>·C)</span>. Check: x/C × 100% should be under 5%.',
    'Weak bases work the same way with K<sub>b</sub> and [OH⁻]. Conjugate pairs: <span class="eqn">K<sub>a</sub> × K<sub>b</sub> = K<sub>w</sub> = 1.0 × 10⁻¹⁴</span>.',
    'A <b>buffer</b> is a weak acid plus its conjugate base. Added H⁺ is grabbed by A⁻; added OH⁻ is neutralized by HA. The pH barely moves.',
    '<b>Henderson–Hasselbalch:</b> <span class="eqn">pH = pK<sub>a</sub> + log([A⁻]/[HA])</span>. Equal amounts → pH = pK<sub>a</sub>. Choose a buffer whose pK<sub>a</sub> is within 1 of the pH you need.',
  ],
  bench(el) {
    let addH = 0;
    el.innerHTML = `
      <div class="panel">
        <h3>Weak acid ICE table</h3>
        <div class="row">${UI.select('ice-a', 'Acid', WEAK_ACIDS.map((a, i) => [i, `${a[1]} (K<sub>a</sub> ${fmtP(a[2], 2)})`.replace(/<[^>]+>/g, '')]), 0)}</div>
        ${UI.slider('ice-c', 'Concentration (log scale)', -3, 0, 0.05, -1)}
        <div id="ice-out" style="display:grid;gap:10px"></div>
      </div>
      <div class="panel">
        <h3>Buffer vs. plain water</h3>
        <p class="sub">100 mL of each. Add 1.0 M HCl or NaOH one milliliter at a time.</p>
        <div class="row">${UI.select('bf-p', 'Buffer pair', BUFFERS.map((b, i) => [i, `${b[0]} (pK<sub>a</sub> ${(-lg(b[2])).toFixed(2)})`.replace(/<[^>]+>/g, '')]), 0)}</div>
        ${UI.slider('bf-ha', '[HA]', 0.05, 1, 0.05, 0.5)}
        ${UI.slider('bf-a', '[A⁻]', 0.05, 1, 0.05, 0.5)}
        <div class="btn-row"><button type="button" class="btn" data-add="1">+1 mL HCl</button><button type="button" class="btn" data-add="5">+5 mL HCl</button><button type="button" class="btn" data-add="-1">+1 mL NaOH</button><button type="button" class="btn" data-add="-5">+5 mL NaOH</button><button type="button" class="btn ghost" id="bf-reset">Reset</button></div>
        <div class="canvas-wrap"><canvas id="bf-c" aria-label="pH of the buffer and of plain water as acid or base is added"></canvas></div>
        <div class="note" style="display:flex;gap:16px;flex-wrap:wrap"><span><b style="color:var(--c1)">━</b> buffer</span><span><b style="color:var(--c2)">━</b> plain water</span><span>● where you are now</span></div>
        <div id="bf-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function ice() {
      const [f, name, Ka] = WEAK_ACIDS[$('#ice-a').value], C = 10 ** +$('#ice-c').value, x = xExact(Ka, C), xa = Math.sqrt(Ka * C), pct = x / C * 100;
      $('#ice-c-o').textContent = fmtP(C, 3) + ' M';
      const base = f.replace(/^H/, '');
      $('#ice-out').innerHTML = `<div class="callout" style="overflow-x:auto;white-space:nowrap">${fmtF(f)} ⇌ H⁺ + ${fmtF(base)}⁻ &nbsp; K<sub>a</sub> = ${sci(Ka)}</div>
        <div class="scroll"><table class="t"><tr><th></th><th class="n">[${fmtF(f)}]</th><th class="n">[H⁺]</th><th class="n">[${fmtF(base)}⁻]</th></tr>
        <tr><td><b>I</b>nitial</td><td class="n">${fmtP(C, 3)}</td><td class="n">0</td><td class="n">0</td></tr>
        <tr><td><b>C</b>hange</td><td class="n">−x</td><td class="n">+x</td><td class="n">+x</td></tr>
        <tr class="hl"><td><b>E</b>quilibrium</td><td class="n">${fmt(C - x, 3)}</td><td class="n">${fmt(x, 3)}</td><td class="n">${fmt(x, 3)}</td></tr></table></div>
        <div class="callout" style="overflow-x:auto"><span style="white-space:nowrap;font-family:var(--mono);font-size:.9rem">${sci(Ka)} = x² / (${fmtP(C, 3)} − x) → x = ${fmt(x, 3)} M</span></div>
        ${UI.kv([['pH', (-lg(x)).toFixed(2)], ['% ionized', pct.toFixed(pct < 1 ? 2 : 1) + '%'], ['Shortcut √(K<sub>a</sub>C)', fmt(xa, 3) + ' M'], ['Shortcut pH', (-lg(xa)).toFixed(2)]])}
        <div class="callout ${pct < 5 ? 'good' : 'warn'}">${pct < 5 ? `Under 5% ionized, so the shortcut x ≈ √(K<sub>a</sub>·C) is fine here (pH off by ${Math.abs(lg(xa) - lg(x)).toFixed(3)}).` : `${pct.toFixed(1)}% ionized: the 5% shortcut fails. Use the quadratic formula (as above).`} Notice: diluting a weak acid makes a <i>larger</i> fraction of it ionize.</div>`;
    }
    $('#ice-a').addEventListener('change', ice); $('#ice-c').addEventListener('input', ice);
    const V0 = 0.1;
    const cv = makeCanvas($('#bf-c'), w => Math.max(180, Math.min(250, w * 0.45)), (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const Ka = BUFFERS[$('#bf-p').value][2], ha = +$('#bf-ha').value * V0, a = +$('#bf-a').value * V0;
      const pad = { l: 30, r: 10, t: 10, b: 24 }, X = mL => pad.l + (w - pad.l - pad.r) * (mL + 30) / 60, Y = p => h - pad.b - (h - pad.t - pad.b) * p / 14;
      ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
      [0, 7, 14].forEach(p => { ctx.beginPath(); ctx.moveTo(pad.l, Y(p)); ctx.lineTo(w - pad.r, Y(p)); ctx.stroke(); ctx.fillText(p, 6, Y(p) + 4); });
      ctx.fillText('← NaOH (mL)', pad.l, h - 6); ctx.fillText('HCl (mL) →', w - pad.r - 72, h - 6);
      ctx.beginPath(); ctx.moveTo(X(0), pad.t); ctx.lineTo(X(0), h - pad.b); ctx.stroke();
      const curve = (fn, col) => { ctx.strokeStyle = tok(col); ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k <= 240; k++) { const mL = -30 + k / 4, p = fn(mL); k ? ctx.lineTo(X(mL), Y(U.clamp(p, 0, 14))) : ctx.moveTo(X(mL), Y(U.clamp(p, 0, 14))); } ctx.stroke(); };
      curve(mL => bufferPH(Ka, ha, a, mL / 1000, V0 + Math.abs(mL) / 1000), 'c1');
      curve(mL => waterPH(mL / 1000, V0 + Math.abs(mL) / 1000), 'c2');
      const V = V0 + Math.abs(addH) / 1000;
      [[bufferPH(Ka, ha, a, addH / 1000, V), 'c1'], [waterPH(addH / 1000, V), 'c2']].forEach(([p, c]) => { ctx.fillStyle = tok(c); ctx.strokeStyle = tok('ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(U.clamp(addH, -30, 30)), Y(U.clamp(p, 0, 14)), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    });
    function buf() {
      const [pair, name, Ka] = BUFFERS[$('#bf-p').value], cha = +$('#bf-ha').value, ca = +$('#bf-a').value, V = V0 + Math.abs(addH) / 1000;
      $('#bf-ha-o').textContent = cha.toFixed(2) + ' M'; $('#bf-a-o').textContent = ca.toFixed(2) + ' M';
      const p0 = bufferPH(Ka, cha * V0, ca * V0, 0, V0), p = bufferPH(Ka, cha * V0, ca * V0, addH / 1000, V), pw = waterPH(addH / 1000, V);
      const capH = ca * V0 * 1000, capOH = cha * V0 * 1000;
      $('#bf-out').innerHTML = `${UI.kv([['Added', addH === 0 ? 'nothing yet' : addH > 0 ? `${addH} mL HCl` : `${-addH} mL NaOH`], ['Buffer pH', `${p.toFixed(2)} <span class="note">(was ${p0.toFixed(2)})</span>`], ['Water pH', `${pw.toFixed(2)} <span class="note">(was 7.00)</span>`], ['pK<sub>a</sub>', (-lg(Ka)).toFixed(2)]])}
        <div class="callout ${Math.abs(p - p0) < 0.5 ? 'good' : 'bad'}" style="margin-top:10px">${addH === 0 ? `pH = pK<sub>a</sub> + log([A⁻]/[HA]) = ${(-lg(Ka)).toFixed(2)} + log(${ca.toFixed(2)}/${cha.toFixed(2)}) = ${p0.toFixed(2)}. Now add some acid or base.` : Math.abs(p - p0) < 0.5 ? `The buffer moved only ${Math.abs(p - p0).toFixed(2)} pH units while plain water moved ${Math.abs(pw - 7).toFixed(2)}. ${addH > 0 ? 'A⁻ grabbed the added H⁺, turning into HA.' : 'HA neutralized the added OH⁻, turning into A⁻.'}` : `The buffer is <b>overwhelmed</b>: you added more ${addH > 0 ? 'acid than there was A⁻' : 'base than there was HA'} to absorb it. Its capacity was about ${(addH > 0 ? capH : capOH).toFixed(0)} mL of 1.0 M ${addH > 0 ? 'HCl' : 'NaOH'}.`}</div>`;
      cv.redraw();
    }
    ['#bf-p', '#bf-ha', '#bf-a'].forEach(s => $(s).addEventListener('input', () => { addH = 0; buf(); }));
    el.addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) { addH = U.clamp(addH + +b.dataset.add, -30, 30); buf(); } });
    $('#bf-reset').addEventListener('click', () => { addH = 0; buf(); });
    ice(); buf();
    return () => cv.stop();
  },
  problems: [
    { name: 'pH of a weak acid', gen() {
      const [f, name, Ka] = U.pick(WEAK_ACIDS), C = U.pick([0.010, 0.050, 0.10, 0.20, 0.25, 0.50, 1.0]), x = xExact(Ka, C), p = -lg(x);
      return { kind: 'num', abs: 0.04, tol: 0, q: `What is the pH of <b>${C} M ${name}</b> (${fmtF(f)}, K<sub>a</sub> = ${sci(Ka)})?`, answer: p, display: p.toFixed(2),
        explain: `ICE: K<sub>a</sub> = x²/(${C} − x). ${x / C < 0.05 ? `x is small, so x ≈ √(${sci(Ka)} × ${C}) = ${fmt(Math.sqrt(Ka * C), 3)} M` : `Solve the quadratic: x = ${fmt(x, 3)} M`}. pH = −log(${fmt(x, 3)}) = <b>${p.toFixed(2)}</b>.` };
    } },
    { name: 'Percent ionization', gen() {
      const [f, name, Ka] = U.pick(WEAK_ACIDS.filter(a => a[2] > 1e-6)), C = U.pick([0.010, 0.050, 0.10, 0.50]), x = xExact(Ka, C);
      return { kind: 'num', unit: '%', tol: 0.04, q: `What percent of the acid is ionized in <b>${C} M ${fmtF(f)}</b> (K<sub>a</sub> = ${sci(Ka)})?`, answer: x / C * 100,
        explain: `[H⁺] = x = ${fmt(x, 3)} M. % ionized = x/C × 100% = ${fmt(x, 3)} / ${C} × 100% = <b>${fmt(x / C * 100, 3)}%</b>.` };
    } },
    { name: 'K<sub>a</sub> from pH', gen() {
      const [f, name, Ka] = U.pick(WEAK_ACIDS), C = U.pick([0.050, 0.10, 0.20, 0.50]), p = Number((-lg(xExact(Ka, C))).toFixed(2)), x = 10 ** -p, ans = x * x / (C - x);
      return { kind: 'num', tol: 0.06, q: `A <b>${C} M</b> solution of a weak acid HA has <b>pH = ${p}</b>. What is K<sub>a</sub>?`, answer: ans,
        explain: `[H⁺] = 10<sup>−${p}</sup> = ${fmt(x, 3)} M = [A⁻]. [HA] = ${C} − ${fmt(x, 3)}. K<sub>a</sub> = (${fmt(x, 3)})² / ${fmt(C - x, 3)} = <b>${fmt(ans, 2)}</b>.` };
    } },
    { name: 'pH of a weak base', gen() {
      const [f, name, Kb] = U.pick(WEAK_BASES), C = U.pick([0.050, 0.10, 0.20, 0.50]), x = xExact(Kb, C), p = 14 + lg(x);
      return { kind: 'num', abs: 0.04, tol: 0, q: `What is the pH of <b>${C} M ${name}</b> (${fmtF(f)}, K<sub>b</sub> = ${sci(Kb)})?`, answer: p, display: p.toFixed(2),
        explain: `B + H₂O ⇌ BH⁺ + OH⁻. x = [OH⁻] ≈ √(K<sub>b</sub>·C) = ${fmt(x, 3)} M. pOH = ${(-lg(x)).toFixed(2)}, pH = 14 − pOH = <b>${p.toFixed(2)}</b>.` };
    } },
    { name: 'Buffer pH', gen() {
      const [pair, name, Ka] = U.pick(BUFFERS), ha = U.sf(0.1, 1, 2), a = U.sf(0.1, 1, 2), p = -lg(Ka) + lg(a / ha), [acid, base] = pair.split(' / ');
      return { kind: 'num', abs: 0.03, tol: 0, q: `A buffer contains <b>${ha} M ${acid}</b> and <b>${a} M ${base}</b> (K<sub>a</sub> = ${sci(Ka)}). What is its pH?`, answer: p, display: p.toFixed(2),
        explain: `pK<sub>a</sub> = ${(-lg(Ka)).toFixed(2)}. pH = pK<sub>a</sub> + log([base]/[acid]) = ${(-lg(Ka)).toFixed(2)} + log(${a}/${ha}) = <b>${p.toFixed(2)}</b>.` };
    } },
    { name: 'Buffer + strong acid/base', gen() {
      const Ka = 1.8e-5, ha = U.pick([0.20, 0.25, 0.30, 0.50]), a = U.pick([0.20, 0.25, 0.30, 0.50]), V = 1.0, add = U.pick([0.010, 0.020, 0.050]), acid = Math.random() < 0.5;
      const nHA = ha + (acid ? add : -add), nA = a - (acid ? add : -add), p = -lg(Ka) + lg(nA / nHA);
      return { kind: 'num', abs: 0.03, tol: 0, q: `1.0 L of buffer contains <b>${ha} mol HC₂H₃O₂</b> and <b>${a} mol NaC₂H₃O₂</b> (pK<sub>a</sub> = 4.74). What is the pH after adding <b>${add} mol ${acid ? 'HCl' : 'NaOH'}</b>?`, answer: p, display: p.toFixed(2),
        explain: `${acid ? `H⁺ + A⁻ → HA: A⁻ drops to ${fmtP(nA, 3)} mol, HA rises to ${fmtP(nHA, 3)} mol` : `OH⁻ + HA → A⁻ + H₂O: HA drops to ${fmtP(nHA, 3)} mol, A⁻ rises to ${fmtP(nA, 3)} mol`}. pH = 4.74 + log(${fmtP(nA, 3)}/${fmtP(nHA, 3)}) = <b>${p.toFixed(2)}</b>.` };
    } },
    { name: 'K<sub>b</sub> from K<sub>a</sub>', gen() {
      const [f, name, Ka] = U.pick(WEAK_ACIDS), Kb = 1e-14 / Ka, base = f.replace(/^H/, '');
      return { kind: 'num', tol: 0.03, q: `K<sub>a</sub> for ${fmtF(f)} is ${sci(Ka)}. What is K<sub>b</sub> for its conjugate base, ${fmtF(base)}⁻?`, answer: Kb, explain: `<span class="eqn">K<sub>b</sub> = K<sub>w</sub>/K<sub>a</sub> = 1.0×10⁻¹⁴ / ${sci(Ka)} = ${fmt(Kb, 2)}</span>` };
    } },
    { name: 'Choose a buffer', gen() {
      const target = U.pick([4.5, 5.0, 7.0, 7.4, 9.0, 9.5, 6.5]), best = BUFFERS.reduce((b, x) => Math.abs(-lg(x[2]) - target) < Math.abs(-lg(b[2]) - target) ? x : b);
      return { ...mc(best[0], BUFFERS.map(b => b[0])), q: `You need a buffer at <b>pH ${target}</b>. Which pair is the best choice?`, explain: `Pick the pK<sub>a</sub> closest to the target pH. pK<sub>a</sub> values: ${BUFFERS.map(b => `${b[0]} ${(-lg(b[2])).toFixed(2)}`).join(', ')}. Best: <b>${best[0]}</b>.` };
    } },
  ],
});

/* ================= G3: Kinetics ================= */
registerLab({
  id: 'kinetics', ch: 103, code: 'G3', sym: 'Kn', fam: 'gen',
  title: 'Reaction Rates & Kinetics', chapter: 'Chemical kinetics',
  blurb: 'Find rate laws from data, see which integrated plot comes out straight, and watch temperature and activation energy control how fast molecules react.',
  ideas: [
    '<b>Rate</b> = how fast a concentration changes. For aA → bB: <span class="eqn">rate = −(1/a)Δ[A]/Δt = (1/b)Δ[B]/Δt</span>.',
    '<b>Rate law:</b> <span class="eqn">rate = k[A]<sup>m</sup>[B]<sup>n</sup></span>. The orders m and n come from <b>experiment</b>, not from the coefficients.',
    '<b>Method of initial rates:</b> double [A] while holding [B] fixed. Rate ×1 → order 0; ×2 → order 1; ×4 → order 2.',
    'Integrated laws: zero order <span class="eqn">[A] = [A]₀ − kt</span>; first order <span class="eqn">ln[A] = ln[A]₀ − kt</span>; second order <span class="eqn">1/[A] = 1/[A]₀ + kt</span>. Whichever plot is a straight line tells you the order.',
    'First-order half-life is constant: <span class="eqn">t<sub>½</sub> = 0.693/k</span> (radioactive decay is first order).',
    '<b>Collision theory:</b> molecules must collide with enough energy (≥ E<sub>a</sub>) and the right orientation. Heating raises the fraction with enough energy; a catalyst lowers E<sub>a</sub>.',
    '<b>Arrhenius:</b> <span class="eqn">k = A·e<sup>−E<sub>a</sub>/RT</sup></span>, and <span class="eqn">ln(k₂/k₁) = (E<sub>a</sub>/R)(1/T₁ − 1/T₂)</span> with R = 8.314 J/mol·K.',
  ],
  bench(el) {
    let order = 1;
    el.innerHTML = `
      <div class="panel">
        <h3>Which plot is straight?</h3>
        <div class="row"><div class="stepper"><span class="lbl">Reaction order</span><div class="seg" id="kn-o">${[0, 1, 2].map(o => `<button type="button" data-o="${o}" aria-pressed="${o === order}">${['zero', 'first', 'second'][o]}</button>`).join('')}</div></div></div>
        ${UI.slider('kn-k', 'Rate constant k', 0.02, 0.5, 0.01, 0.1)}
        ${UI.slider('kn-a0', '[A]₀', 0.2, 2, 0.1, 1)}
        <div class="row" style="gap:10px;align-items:stretch">${['[A] vs t', 'ln[A] vs t', '1/[A] vs t'].map((t, i) => `<div style="flex:1 1 150px;min-width:0;display:grid;gap:4px"><span class="lbl" id="kn-l${i}">${t}</span><div class="canvas-wrap"><canvas id="kn-c${i}" aria-label="${t}"></canvas></div></div>`).join('')}</div>
        <div id="kn-out"></div>
      </div>
      <div class="panel">
        <h3>Energy distribution and activation energy</h3>
        <p class="sub">Only molecules in the shaded tail have enough energy to react.</p>
        ${UI.slider('ar-t', 'Temperature', 250, 1000, 10, 300)}
        ${UI.slider('ar-e', 'Activation energy Eₐ', 3, 30, 0.5, 12)}
        <label class="field" style="flex:0 0 auto"><span class="lbl">Catalyst</span><span class="inwrap"><input type="checkbox" id="ar-cat"> lowers Eₐ by 40%</span></label>
        <div class="canvas-wrap"><canvas id="ar-c" aria-label="Distribution of molecular energies with the activation energy marked"></canvas></div>
        <div id="ar-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const conc = (t, k, a0) => order === 0 ? Math.max(0, a0 - k * t) : order === 1 ? a0 * Math.exp(-k * t) : 1 / (1 / a0 + k * t);
    const plots = [0, 1, 2].map(i => makeCanvas($('#kn-c' + i), w => Math.max(120, Math.min(170, w * 0.75)), (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const k = +$('#kn-k').value, a0 = +$('#kn-a0').value, tmax = 30, f = [c => c, c => Math.log(c), c => 1 / c][i];
      const pts = []; for (let s = 0; s <= 60; s++) { const t = s / 60 * tmax, c = conc(t, k, a0); if (c > 1e-4) pts.push([t, f(c)]); }
      const ys = pts.map(p => p[1]), ymin = Math.min(...ys), ymax = Math.max(...ys), pad = 14;
      const X = t => pad + (w - 2 * pad) * t / tmax, Y = y => h - pad - (h - 2 * pad) * (ymax === ymin ? 0.5 : (y - ymin) / (ymax - ymin));
      ctx.strokeStyle = tok('line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h - pad); ctx.lineTo(w - pad, h - pad); ctx.stroke();
      const lin = i === order;
      ctx.strokeStyle = tok(lin ? 'c3' : 'c1'); ctx.lineWidth = lin ? 3 : 2; ctx.beginPath(); pts.forEach(([t, y], j) => j ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y))); ctx.stroke();
      ctx.fillStyle = tok('muted'); ctx.font = `10px ${tok('mono') || 'monospace'}`; ctx.fillText('t →', w - pad - 22, h - 3);
    }));
    function kin() {
      const k = +$('#kn-k').value, a0 = +$('#kn-a0').value;
      $('#kn-k-o').textContent = k.toFixed(2); $('#kn-a0-o').textContent = a0.toFixed(1) + ' M';
      el.querySelectorAll('#kn-o button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.o === order)));
      [0, 1, 2].forEach(i => { $('#kn-l' + i).style.color = i === order ? 'var(--c3)' : ''; plots[i].redraw(); });
      const th = order === 0 ? a0 / (2 * k) : order === 1 ? 0.693 / k : 1 / (k * a0);
      $('#kn-out').innerHTML = `${UI.kv([['Rate law', ['rate = k', 'rate = k[A]', 'rate = k[A]²'][order]], ['Straight-line plot', ['[A] vs t', 'ln[A] vs t', '1/[A] vs t'][order]], ['Slope', order === 2 ? '+k' : '−k'], ['Half-life', `${fmt(th, 3)} s`], ['t<sub>½</sub> formula', ['[A]₀/2k', '0.693/k', '1/(k[A]₀)'][order]]])}
        <p class="note" style="margin-top:8px">${order === 1 ? 'First-order half-life does not depend on [A]₀: change [A]₀ and t½ stays the same.' : `This half-life depends on [A]₀. Change [A]₀ and watch it change.`}</p>`;
    }
    $('#kn-o').addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (b) { order = +b.dataset.o; kin(); } });
    ['#kn-k', '#kn-a0'].forEach(s => $(s).addEventListener('input', kin));
    const mb = makeCanvas($('#ar-c'), w => Math.max(170, Math.min(240, w * 0.42)), (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const T = +$('#ar-t').value, Ea0 = +$('#ar-e').value, Ea = $('#ar-cat').checked ? Ea0 * 0.6 : Ea0, RT = R_J * T / 1000, Emax = 30;
      const f = (E, rt) => Math.sqrt(E) * Math.exp(-E / rt) / rt ** 1.5;
      const pad = { l: 12, r: 10, t: 10, b: 24 }, X = E => pad.l + (w - pad.l - pad.r) * E / Emax;
      const rt0 = R_J * 300 / 1000, peak = Math.max(f(RT / 2, RT), f(rt0 / 2, rt0)) * 1.12, Y = v => h - pad.b - (h - pad.t - pad.b) * Math.min(1, v / peak);
      ctx.strokeStyle = tok('line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
      ctx.fillStyle = tok('c2'); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(X(Ea), Y(0));
      for (let E = Ea; E <= Emax; E += 0.25) ctx.lineTo(X(E), Y(f(E, RT))); ctx.lineTo(X(Emax), Y(0)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      if (T !== 300) { ctx.strokeStyle = tok('muted'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); for (let E = 0.05; E <= Emax; E += 0.25) { const y = Y(f(E, R_J * 300 / 1000)); E < 0.1 ? ctx.moveTo(X(E), y) : ctx.lineTo(X(E), y); } ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = tok('c1'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let E = 0.05; E <= Emax; E += 0.25) { const y = Y(f(E, RT)); E < 0.1 ? ctx.moveTo(X(E), y) : ctx.lineTo(X(E), y); } ctx.stroke();
      ctx.strokeStyle = tok('ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(Ea), pad.t); ctx.lineTo(X(Ea), h - pad.b); ctx.stroke();
      ctx.fillStyle = tok('ink'); ctx.font = `600 11px ${tok('body') || 'sans-serif'}`; ctx.fillText('Eₐ', X(Ea) + 4, pad.t + 10);
      ctx.fillStyle = tok('muted'); ctx.font = `10px ${tok('mono') || 'monospace'}`; ctx.fillText('molecular energy (kJ/mol) →', pad.l, h - 6);
    });
    const tail = (Ea, T) => { const rt = R_J * T / 1000; let a = 0, b = 0; for (let E = 0.01; E < 200; E += 0.02) { const v = Math.sqrt(E) * Math.exp(-E / rt); a += v; if (E >= Ea) b += v; } return b / a; };
    function arr() {
      const T = +$('#ar-t').value, Ea0 = +$('#ar-e').value, cat = $('#ar-cat').checked, Ea = cat ? Ea0 * 0.6 : Ea0;
      $('#ar-t-o').textContent = `${T} K`; $('#ar-e-o').textContent = `${Ea0} kJ/mol`;
      const fr = tail(Ea, T), fr300 = tail(Ea0, 300), k10 = Math.exp(Ea * 1000 / R_J * (1 / T - 1 / (T + 10)));
      $('#ar-out').innerHTML = `${UI.kv([['Fraction with E ≥ Eₐ', fr < 1e-4 ? fmt(fr, 2) : (fr * 100).toFixed(2) + '%'], ['Rate vs. 300 K, no catalyst', '×' + fmt(fr / fr300, 3)], ['10 K hotter speeds it up', '×' + k10.toFixed(2)], ['Effective Eₐ', Ea.toFixed(1) + ' kJ/mol']])}
        <p class="note" style="margin-top:8px">Dashed curve: the same molecules at 300 K. Heating spreads the curve to higher energies, so far more molecules clear Eₐ. ${cat ? 'The catalyst moved the Eₐ line left without changing the curve.' : 'Tick "Catalyst" to lower the barrier instead.'}</p>`;
      mb.redraw();
    }
    ['#ar-t', '#ar-e', '#ar-cat'].forEach(s => $(s).addEventListener('input', arr));
    kin(); arr();
    return () => { plots.forEach(p => p.stop()); mb.stop(); };
  },
  problems: [
    { name: 'Order from initial rates', gen() {
      const m = U.ri(0, 2), n = U.ri(0, 2), k = U.sf(0.1, 5, 2), A = U.pick([0.10, 0.20, 0.15]), B = U.pick([0.10, 0.20, 0.30]), fa = U.pick([2, 3]), fb = U.pick([2, 3]);
      const rate = (a, b) => k * a ** m * b ** n, rows = [[A, B], [A * fa, B], [A, B * fb]];
      const ask = U.pick(['A', 'B', 'overall']), ans = ask === 'A' ? m : ask === 'B' ? n : m + n;
      return { kind: 'num', tol: 0, ph: 'whole number', q: `For A + B → products:<div class="scroll"><table class="t" style="margin-top:6px"><tr><th>Exp</th><th class="n">[A] (M)</th><th class="n">[B] (M)</th><th class="n">Initial rate (M/s)</th></tr>${rows.map(([a, b], i) => `<tr><td>${i + 1}</td><td class="n">${fmtP(a, 3)}</td><td class="n">${fmtP(b, 3)}</td><td class="n">${fmt(rate(a, b), 3)}</td></tr>`).join('')}</table></div>What is the reaction order ${ask === 'overall' ? '<b>overall</b>' : `with respect to <b>${ask}</b>`}?`, answer: ans,
        explain: `Exp 1 → 2: [A] ×${fa}, rate ×${fmtP(fa ** m, 3)} = ${fa}<sup>${m}</sup>, so order in A = ${m}. Exp 1 → 3: [B] ×${fb}, rate ×${fmtP(fb ** n, 3)} = ${fb}<sup>${n}</sup>, so order in B = ${n}. Rate law: rate = k${m ? `[A]${m > 1 ? '<sup>2</sup>' : ''}` : ''}${n ? `[B]${n > 1 ? '<sup>2</sup>' : ''}` : ''}${ask === 'overall' ? `; overall order = ${m + n}` : ''}.` };
    } },
    { name: 'First-order half-life', gen() {
      const k = U.sf(0.005, 0.5, 2), unit = U.pick(['s⁻¹', 'min⁻¹']), u = unit.replace('⁻¹', '');
      if (Math.random() < 0.5) return { kind: 'num', unit: u, q: `A first-order reaction has k = <b>${k} ${unit}</b>. What is its half-life?`, answer: 0.693 / k, explain: `<span class="eqn">t<sub>½</sub> = 0.693/k = 0.693 / ${k} = ${fmt(0.693 / k, 3)} ${u}</span>` };
      const th = U.sf(5, 200, 2);
      return { kind: 'num', unit: unit, q: `A first-order reaction has a half-life of <b>${th} ${u}</b>. What is k?`, answer: 0.693 / th, explain: `<span class="eqn">k = 0.693/t<sub>½</sub> = 0.693 / ${th} = ${fmt(0.693 / th, 3)} ${unit}</span>` };
    } },
    { name: 'Integrated rate laws', gen() {
      const order = U.pick([0, 1, 2]), a0 = U.pick([0.50, 0.80, 1.00, 1.50]), k = U.sf(0.002, 0.05, 2), t = U.ri(10, 120);
      const a = order === 0 ? a0 - k * t : order === 1 ? a0 * Math.exp(-k * t) : 1 / (1 / a0 + k * t);
      if (a <= 0) return this.gen();
      const law = ['[A] = [A]₀ − kt', 'ln[A] = ln[A]₀ − kt', '1/[A] = 1/[A]₀ + kt'][order], units = ['M/s', 's⁻¹', 'M⁻¹s⁻¹'][order];
      return { kind: 'num', unit: 'M', q: `A <b>${['zero', 'first', 'second'][order]}-order</b> reaction has k = ${k} ${units} and [A]₀ = ${a0} M. What is [A] after <b>${t} s</b>?`, answer: a, explain: `Use <span class="eqn">${law}</span>: [A] = <b>${fmt(a, 3)} M</b>.` };
    } },
    { name: 'Arrhenius equation', gen() {
      const Ea = U.ri(40, 120), T1 = U.ri(280, 320), T2 = T1 + U.ri(10, 50), k1 = U.sf(0.001, 0.5, 2);
      const r = Math.exp(Ea * 1000 / R_J * (1 / T1 - 1 / T2));
      if (Math.random() < 0.5) return { kind: 'num', unit: 's⁻¹', tol: 0.04, q: `A reaction has E<sub>a</sub> = <b>${Ea} kJ/mol</b> and k = ${k1} s⁻¹ at ${T1} K. What is k at <b>${T2} K</b>?`, answer: k1 * r, explain: `<span class="eqn">ln(k₂/k₁) = (E<sub>a</sub>/R)(1/T₁ − 1/T₂) = (${Ea * 1000}/8.314)(1/${T1} − 1/${T2}) = ${Math.log(r).toFixed(3)}</span>, so k₂/k₁ = ${r.toFixed(2)} and k₂ = <b>${fmt(k1 * r, 3)} s⁻¹</b>.` };
      return { kind: 'num', unit: 'kJ/mol', tol: 0.04, q: `The rate constant of a reaction goes from ${k1} s⁻¹ at ${T1} K to <b>${fmt(k1 * r, 3).replace(/<[^>]+>/g, '')} s⁻¹</b> at ${T2} K. What is E<sub>a</sub>?`, answer: Ea, explain: `<span class="eqn">E<sub>a</sub> = R·ln(k₂/k₁) / (1/T₁ − 1/T₂) = 8.314 × ${Math.log(r).toFixed(3)} / ${(1 / T1 - 1 / T2).toExponential(3)} = ${Ea} kJ/mol</span>` };
    } },
    { name: 'Relative rates', gen() {
      const rx = U.pick([['2 N₂O₅ → 4 NO₂ + O₂', ['N₂O₅', 2, -1], [['NO₂', 4], ['O₂', 1]]], ['N₂ + 3 H₂ → 2 NH₃', ['H₂', 3, -1], [['NH₃', 2], ['N₂', 1]]], ['2 H₂O₂ → 2 H₂O + O₂', ['H₂O₂', 2, -1], [['O₂', 1], ['H₂O', 2]]]]);
      const [eq, [r, rc], others] = rx, x = U.sf(0.01, 0.9, 2), [o, oc] = U.pick(others), ans = x * oc / rc;
      return { kind: 'num', unit: 'M/s', q: `<span class="eqline">${eq}</span>${r} is consumed at <b>${x} M/s</b>. How fast is ${o} ${['N₂'].includes(o) ? 'consumed' : 'formed'}?`, answer: ans, explain: `Rates are proportional to coefficients: ${o}/${r} = ${oc}/${rc}, so ${x} × ${oc}/${rc} = <b>${fmt(ans, 3)} M/s</b>.` };
    } },
    { name: 'What changes k?', gen() {
      const items = [['Raising the temperature', 'Increases k', 'More molecules have energy ≥ Eₐ, so k rises (Arrhenius).'], ['Adding a catalyst', 'Increases k', 'A catalyst offers a path with lower Eₐ.'], ['Increasing [A] (concentration)', 'No change to k', 'More collisions raise the rate, but k itself depends only on T and Eₐ.'], ['Lowering the temperature', 'Decreases k', 'Fewer molecules clear the activation barrier.'], ['Using a smaller container (gases)', 'No change to k', 'Concentration rises, so the rate rises, but k is unchanged.']];
      const [it, ans, why] = U.pick(items);
      return { ...mc(ans, ['Increases k', 'Decreases k', 'No change to k']), q: `What does <b>${it.toLowerCase()}</b> do to the rate constant k?`, explain: why };
    } },
  ],
});

/* ================= G4: Thermodynamics ================= */
const S_TABLE = { H2: 130.7, O2: 205.2, N2: 191.6, NH3: 192.8, 'H2O(l)': 70.0, 'H2O(g)': 188.8, CO2: 213.8, CH4: 186.3, CaCO3: 92.9, CaO: 38.1, SO2: 248.2, SO3: 256.8, NO2: 240.1, N2O4: 304.4, 'C(s)': 5.7, HCl: 186.9, Cl2: 223.1 };
const S_RX = [
  [[[1, 'N2'], [3, 'H2']], [[2, 'NH3']]], [[[2, 'SO2'], [1, 'O2']], [[2, 'SO3']]], [[[1, 'CaCO3']], [[1, 'CaO'], [1, 'CO2']]], [[[1, 'CH4'], [2, 'O2']], [[1, 'CO2'], [2, 'H2O(l)']]],
  [[[1, 'N2O4']], [[2, 'NO2']]], [[[1, 'H2'], [1, 'Cl2']], [[2, 'HCl']]], [[[2, 'H2'], [1, 'O2']], [[2, 'H2O(g)']]], [[[1, 'C(s)'], [1, 'O2']], [[1, 'CO2']]],
];
const dSrxn = ([re, pr]) => pr.reduce((s, [c, f]) => s + c * S_TABLE[f], 0) - re.reduce((s, [c, f]) => s + c * S_TABLE[f], 0);
const G_PRESETS = [['Ice melting', 6.01, 22.0], ['Water boiling', 40.7, 109.0], ['CaCO₃ → CaO + CO₂', 178.3, 160.5], ['N₂ + 3 H₂ → 2 NH₃', -92.2, -198.8], ['2 H₂O₂ → 2 H₂O + O₂', -196.0, 125.0], ['6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂', 2803, -262]];
const DS_SIGN = [['Ice melting', '+'], ['Water freezing', '−'], ['Sugar dissolving in water', '+'], ['Steam condensing', '−'], ['Dry ice subliming', '+'], ['2 H₂(g) + O₂(g) → 2 H₂O(g)', '−'], ['CaCO₃(s) → CaO(s) + CO₂(g)', '+'], ['N₂O₄(g) → 2 NO₂(g)', '+'], ['N₂(g) + 3 H₂(g) → 2 NH₃(g)', '−'], ['Heating a gas', '+'], ['A gas compressed into a smaller volume', '−'], ['2 KClO₃(s) → 2 KCl(s) + 3 O₂(g)', '+']];
const gCase = (dH, dS) => dH < 0 && dS > 0 ? 'Spontaneous at all temperatures' : dH > 0 && dS < 0 ? 'Never spontaneous' : dH < 0 ? 'Spontaneous only at low T' : 'Spontaneous only at high T';

registerLab({
  id: 'gibbs', ch: 104, code: 'G4', sym: 'Gb', fam: 'gen',
  title: 'Entropy & Free Energy', chapter: 'Thermodynamics',
  blurb: 'Balance energy against disorder: tune ΔH, ΔS and temperature and see exactly when a reaction becomes spontaneous.',
  ideas: [
    '<b>Entropy S</b> measures how spread out energy and matter are. S rises from solid → liquid → gas, when moles of gas increase, when things dissolve or mix, and when temperature rises.',
    '<b>Second law:</b> in a spontaneous process, the entropy of the universe increases.',
    '<b>Gibbs free energy:</b> <span class="eqn">ΔG = ΔH − TΔS</span> (T in kelvin; convert ΔS from J/K to kJ/K). ΔG < 0 → spontaneous; ΔG > 0 → not; ΔG = 0 → equilibrium.',
    'Four cases: ΔH−, ΔS+ always spontaneous; ΔH+, ΔS− never; ΔH−, ΔS− only at low T; ΔH+, ΔS+ only at high T. The switch happens at <span class="eqn">T = ΔH/ΔS</span>.',
    '<span class="eqn">ΔS°<sub>rxn</sub> = ΣnS°(products) − ΣnS°(reactants)</span>. Unlike ΔH°<sub>f</sub>, elements have S° > 0.',
    'Free energy and equilibrium: <span class="eqn">ΔG° = −RT ln K</span>. ΔG° < 0 means K > 1 (products favored).',
    '"Spontaneous" says nothing about speed. Diamond turning to graphite is spontaneous, but far too slow to notice. That is kinetics, not thermodynamics.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>ΔG = ΔH − TΔS explorer</h3>
        <div class="btn-row" id="gb-pre">${G_PRESETS.map((p, i) => `<button type="button" class="chip" data-i="${i}">${p[0]}</button>`).join('')}</div>
        ${UI.slider('gb-h', 'ΔH (kJ)', -300, 300, 1, 178)}
        ${UI.slider('gb-s', 'ΔS (J/K)', -400, 400, 1, 160)}
        ${UI.slider('gb-t', 'Temperature (K)', 0, 2000, 5, 298)}
        <div class="canvas-wrap"><canvas id="gb-c" aria-label="ΔG versus temperature"></canvas></div>
        <div id="gb-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let dH = 178.3, dS = 160.5;
    const cv = makeCanvas($('#gb-c'), w => Math.max(170, Math.min(240, w * 0.42)), (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const T = +$('#gb-t').value, G = t => dH - t * dS / 1000, ys = [G(0), G(2000)], lim = Math.max(50, ...ys.map(Math.abs)) * 1.1;
      const pad = { l: 44, r: 10, t: 10, b: 24 }, X = t => pad.l + (w - pad.l - pad.r) * t / 2000, Y = g => pad.t + (h - pad.t - pad.b) * (1 - (g + lim) / (2 * lim));
      ctx.fillStyle = tok('good'); ctx.globalAlpha = 0.08; ctx.fillRect(pad.l, Y(0), w - pad.l - pad.r, Y(-lim) - Y(0)); ctx.globalAlpha = 1;
      ctx.strokeStyle = tok('line'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(w - pad.r, Y(0)); ctx.stroke();
      ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`;
      ctx.fillText('0', 30, Y(0) + 4); ctx.fillText(Math.round(lim), 4, Y(lim) + 10); ctx.fillText(-Math.round(lim), 4, Y(-lim) - 2);
      ctx.fillText('spontaneous (ΔG < 0)', pad.l + 6, Y(-lim) - 6); ctx.fillText('T (K) →', w - 60, h - 6);
      ctx.strokeStyle = tok('c1'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(0), Y(G(0))); ctx.lineTo(X(2000), Y(G(2000))); ctx.stroke();
      const Tx = dH / (dS / 1000);
      if (dS !== 0 && Tx > 0 && Tx < 2000) { ctx.setLineDash([4, 4]); ctx.strokeStyle = tok('muted'); ctx.beginPath(); ctx.moveTo(X(Tx), pad.t); ctx.lineTo(X(Tx), h - pad.b); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = G(T) < 0 ? tok('good') : tok('bad'); ctx.strokeStyle = tok('ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(T), Y(U.clamp(G(T), -lim, lim)), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    function draw() {
      const T = +$('#gb-t').value, G = dH - T * dS / 1000, Tx = dH / (dS / 1000), lnK = -G * 1000 / (R_J * Math.max(T, 1));
      $('#gb-h-o').textContent = dH.toFixed(1); $('#gb-s-o').textContent = dS.toFixed(1); $('#gb-t-o').textContent = `${T} K`;
      const Ktxt = Math.abs(lnK) > 690 ? (lnK > 0 ? '≫ 10³⁰⁰' : '≪ 10⁻³⁰⁰') : fmt(Math.exp(lnK), 3);
      $('#gb-out').innerHTML = `${UI.kv([['ΔG at ' + T + ' K', `<b style="color:var(${G < 0 ? '--good' : '--bad'})">${G.toFixed(1)} kJ</b>`], ['Verdict', G < 0 ? 'spontaneous' : G > 0 ? 'not spontaneous' : 'at equilibrium'], ['Crossover T = ΔH/ΔS', dS !== 0 && Tx > 0 ? `${Tx.toFixed(0)} K (${(Tx - 273.15).toFixed(0)} °C)` : 'none'], ['K = e<sup>−ΔG/RT</sup>', Ktxt]])}
        <div class="scroll" style="margin-top:10px"><table class="t"><tr><th></th><th>ΔS > 0</th><th>ΔS < 0</th></tr>
          <tr><th>ΔH < 0</th><td class="${dH < 0 && dS > 0 ? 'cur' : ''}">always spontaneous</td><td class="${dH < 0 && dS < 0 ? 'cur' : ''}">spontaneous at low T</td></tr>
          <tr><th>ΔH > 0</th><td class="${dH > 0 && dS > 0 ? 'cur' : ''}">spontaneous at high T</td><td class="${dH > 0 && dS < 0 ? 'cur' : ''}">never spontaneous</td></tr></table></div>
        <style>#gb-out td.cur{background:color-mix(in srgb,var(--accent) 16%,transparent);font-weight:700}</style>`;
      cv.redraw();
    }
    $('#gb-h').addEventListener('input', e => { dH = +e.target.value; draw(); });
    $('#gb-s').addEventListener('input', e => { dS = +e.target.value; draw(); });
    $('#gb-t').addEventListener('input', draw);
    $('#gb-pre').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; [, dH, dS] = G_PRESETS[+b.dataset.i]; $('#gb-h').value = U.clamp(dH, -300, 300); $('#gb-s').value = dS; draw(); });
    draw();
    return () => cv.stop();
  },
  problems: [
    { name: 'Sign of ΔS', gen() { const [p, s] = U.pick(DS_SIGN); return { ...mc(s === '+' ? 'ΔS > 0 (increases)' : 'ΔS < 0 (decreases)', ['ΔS > 0 (increases)', 'ΔS < 0 (decreases)']), q: `Predict the sign of ΔS for: <b>${p}</b>`, explain: s === '+' ? 'Matter or energy becomes more spread out: more gas, a less ordered phase, or more freedom of motion.' : 'Matter becomes more ordered or confined: fewer gas molecules, or a more ordered phase.' }; } },
    { name: 'Calculate ΔG', gen() {
      const dH = U.ri(-250, 250), dS = U.ri(-300, 300), T = U.pick([298, 350, 500, 1000, 273]), G = dH - T * dS / 1000;
      return { kind: 'num', unit: 'kJ', tol: 0, abs: 0.6, q: `For a reaction, ΔH = <b>${dH} kJ</b> and ΔS = <b>${dS} J/K</b>. What is ΔG at <b>${T} K</b>?`, answer: G, display: G.toFixed(1) + ' kJ', explain: `Convert ΔS to kJ/K: ${dS / 1000}. <span class="eqn">ΔG = ${dH} − ${T}(${dS / 1000}) = ${G.toFixed(1)} kJ</span>, so it is ${G < 0 ? 'spontaneous' : 'not spontaneous'} at ${T} K.` };
    } },
    { name: 'Crossover temperature', gen() {
      const same = Math.random() < 0.5 ? 1 : -1, dH = same * U.ri(20, 200), dS = same * U.ri(40, 300), T = dH * 1000 / dS;
      return { kind: 'num', unit: 'K', tol: 0.01, q: `ΔH = <b>${dH} kJ</b> and ΔS = <b>${dS} J/K</b>. Above or below what temperature does the reaction become spontaneous?`, answer: T,
        explain: `Set ΔG = 0: <span class="eqn">T = ΔH/ΔS = ${dH * 1000} J / ${dS} J/K = ${T.toFixed(0)} K</span>. Since ΔH and ΔS are both ${dH > 0 ? 'positive, it is spontaneous above' : 'negative, it is spontaneous below'} this temperature.` };
    } },
    { name: 'Spontaneity cases', gen() {
      const sh = U.pick([-1, 1]), ss = U.pick([-1, 1]), ans = gCase(sh, ss);
      return { ...mc(ans, ['Spontaneous at all temperatures', 'Never spontaneous', 'Spontaneous only at low T', 'Spontaneous only at high T']), q: `A process has <b>ΔH ${sh < 0 ? '&lt; 0' : '&gt; 0'}</b> and <b>ΔS ${ss < 0 ? '&lt; 0' : '&gt; 0'}</b>. When is it spontaneous?`, explain: `ΔG = ΔH − TΔS. ${ans}. ${sh * ss > 0 ? 'When ΔH and ΔS have the same sign, temperature decides.' : 'When the signs differ, temperature cannot change the outcome.'}` };
    } },
    { name: 'ΔS° from tables', gen() {
      const rx = U.pick(S_RX), ans = dSrxn(rx), used = [...new Set([...rx[0], ...rx[1]].map(x => x[1]))];
      return { kind: 'num', unit: 'J/K', tol: 0, abs: 0.6, q: `Calculate ΔS° for <span class="eqline">${rxHTML(...rx)}</span>S° (J/mol·K): ${used.map(f => `${fmtF(f.replace(/\(.*\)/, ''))}${(f.match(/\(.*\)/) || [''])[0]} ${S_TABLE[f]}`).join(', ')}`, answer: ans, display: ans.toFixed(1) + ' J/K',
        explain: `Products: ${rx[1].map(([c, f]) => `${c}(${S_TABLE[f]})`).join(' + ')}. Reactants: ${rx[0].map(([c, f]) => `${c}(${S_TABLE[f]})`).join(' + ')}. Difference: <b>${ans.toFixed(1)} J/K</b>${ans < 0 ? ' (fewer moles of gas, so entropy drops)' : ''}.` };
    } },
    { name: 'ΔG° and K', gen() {
      const T = 298;
      if (Math.random() < 0.5) { const G = U.ri(-60, 40), K = Math.exp(-G * 1000 / (R_J * T)); return { kind: 'num', tol: 0.05, q: `ΔG° = <b>${G} kJ/mol</b> at 298 K. What is K?`, answer: K, explain: `<span class="eqn">K = e<sup>−ΔG°/RT</sup> = e<sup>−(${G * 1000})/(8.314 × 298)</sup> = ${fmt(K, 3)}</span>. ${G < 0 ? 'ΔG° < 0, so K > 1.' : 'ΔG° > 0, so K < 1.'}` }; }
      const K = U.pick([1.8e-5, 4.5e-3, 0.25, 6.0, 1.2e3, 3.4e8]), G = -R_J * T * Math.log(K) / 1000;
      return { kind: 'num', unit: 'kJ/mol', tol: 0, abs: 0.3, q: `An equilibrium has K = <b>${sci(K)}</b> at 298 K. What is ΔG°?`, answer: G, display: G.toFixed(1) + ' kJ/mol', explain: `<span class="eqn">ΔG° = −RT ln K = −(8.314)(298) ln(${sci(K).replace(/<[^>]+>/g, '')}) = ${G.toFixed(1)} kJ/mol</span>` };
    } },
  ],
});

/* ================= G5: Electrochemistry ================= */
const HALF = [['Li', 1, -3.04], ['K', 1, -2.93], ['Ca', 2, -2.87], ['Na', 1, -2.71], ['Mg', 2, -2.37], ['Al', 3, -1.66], ['Zn', 2, -0.76], ['Fe', 2, -0.45], ['Ni', 2, -0.26], ['Sn', 2, -0.14], ['Pb', 2, -0.13], ['Cu', 2, 0.34], ['Ag', 1, 0.80], ['Au', 3, 1.50]].map(([m, z, E]) => ({ m, z, E }));
const ionOf = h => `${h.m}${h.z > 1 ? '<sup>' + h.z + '+</sup>' : '<sup>+</sup>'}`;
function cell(a, c) {
  const n = U.lcm(a.z, c.z), na = n / a.z, nc = n / c.z;
  return { n, na, nc, E: c.E - a.E, eq: `${na > 1 ? na + ' ' : ''}${a.m}(s) + ${nc > 1 ? nc + ' ' : ''}${ionOf(c)}(aq) → ${na > 1 ? na + ' ' : ''}${ionOf(a)}(aq) + ${nc > 1 ? nc + ' ' : ''}${c.m}(s)` };
}
const ION_COLOR = { Cu: '#3a86e0', Ni: '#3fae6a', Fe: '#9fbf6a', Au: '#e6c229' };

registerLab({
  id: 'electrochem', ch: 105, code: 'G5', sym: 'Ec', fam: 'gen',
  title: 'Batteries & Electrochemistry', chapter: 'Electrochemistry',
  blurb: 'Build a galvanic cell from any two metals, watch electrons flow from anode to cathode, and calculate the voltage, ΔG and the effect of concentration.',
  ideas: [
    'A <b>galvanic (voltaic) cell</b> turns a spontaneous redox reaction into electricity by separating oxidation and reduction into two half-cells.',
    '<b>An Ox, Red Cat:</b> oxidation happens at the <b>anode</b> (−); reduction happens at the <b>cathode</b> (+). Electrons flow through the wire from anode to cathode; the salt bridge keeps both sides neutral.',
    'Standard reduction potentials E° rank how strongly each ion pulls electrons. The half-cell with the <b>higher E°</b> is the cathode.',
    '<span class="eqn">E°<sub>cell</sub> = E°<sub>cathode</sub> − E°<sub>anode</sub></span>. Do not multiply E° by coefficients. E°<sub>cell</sub> > 0 means spontaneous.',
    '<span class="eqn">ΔG° = −nFE°<sub>cell</sub></span>, with F = 96,485 C/mol e⁻ and n = moles of electrons transferred.',
    '<b>Nernst equation:</b> <span class="eqn">E = E° − (0.0592/n) log Q</span> at 25 °C. As the battery runs, Q grows and the voltage drops until E = 0 (a dead battery is at equilibrium).',
    '<b>Electrolysis</b> forces a non-spontaneous reaction with outside power: <span class="eqn">moles e⁻ = I·t / F</span>.',
  ],
  bench(el) {
    el.innerHTML = `
      <style>
        .ec-wire{stroke-dasharray:6 10;animation:ecflow 0.9s linear infinite}
        .ec-wire.rev{animation-direction:reverse}
        @keyframes ecflow{to{stroke-dashoffset:-32}}
        @media (prefers-reduced-motion:reduce){.ec-wire{animation:none}}
      </style>
      <div class="panel">
        <h3>Galvanic cell builder</h3>
        <div class="row">${UI.select('ec-l', 'Left half-cell', HALF.map((h, i) => [i, `${h.m} | ${h.m}${h.z > 1 ? h.z : ''}+ (E° ${h.E.toFixed(2)} V)`]), 6)}${UI.select('ec-r', 'Right half-cell', HALF.map((h, i) => [i, `${h.m} | ${h.m}${h.z > 1 ? h.z : ''}+ (E° ${h.E.toFixed(2)} V)`]), 11)}</div>
        ${UI.slider('ec-cl', 'Left ion concentration', -3, 1, 0.1, 0)}
        ${UI.slider('ec-cr', 'Right ion concentration', -3, 1, 0.1, 0)}
        <div class="canvas-wrap scroll" id="ec-svg" style="padding:6px"></div>
        <div id="ec-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function draw() {
      const L = HALF[$('#ec-l').value], Rr = HALF[$('#ec-r').value], cl = 10 ** +$('#ec-cl').value, cr = 10 ** +$('#ec-cr').value;
      $('#ec-cl-o').textContent = fmtP(cl, 2) + ' M'; $('#ec-cr-o').textContent = fmtP(cr, 2) + ' M';
      if (L.m === Rr.m) { $('#ec-svg').innerHTML = ''; $('#ec-out').innerHTML = '<div class="callout warn">Pick two different metals. The same metal on both sides gives E° = 0 (a concentration cell).</div>'; return; }
      const leftIsAnode = L.E < Rr.E, an = leftIsAnode ? L : Rr, ca = leftIsAnode ? Rr : L, c = cell(an, ca);
      const [ia, ic] = leftIsAnode ? [cl, cr] : [cr, cl];
      const Q = ia ** c.na / ic ** c.nc, E = c.E - 0.05916 / c.n * lg(Q), dG = -c.n * FARADAY * c.E / 1000, logK = c.n * c.E / 0.05916;
      const beaker = (x, h, conc, role) => {
        const col = ION_COLOR[h.m] || 'var(--c1)', alpha = Math.min(0.55, 0.1 + 0.12 * Math.log10(conc * 1000 + 1));
        return `<rect x="${x}" y="110" width="150" height="100" rx="8" fill="${col}" opacity="${alpha}"/>
          <path d="M${x - 4} 70 L${x - 4} 206 Q${x - 4} 214 ${x + 4} 214 L${x + 146} 214 Q${x + 154} 214 ${x + 154} 206 L${x + 154} 70" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
          <rect x="${x + 60}" y="40" width="30" height="150" rx="3" fill="var(--muted)" opacity=".75"/>
          <text x="${x + 75}" y="200" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${h.m}</text>
          <text x="${x + 75}" y="232" text-anchor="middle" font-size="12" fill="var(--ink)" font-weight="700">${role === 'an' ? 'ANODE (−) · oxidation' : 'CATHODE (+) · reduction'}</text>
          <text x="${x + 75}" y="248" text-anchor="middle" font-size="11" fill="var(--muted)">${h.m}${h.z > 1 ? h.z : ''}+ ${fmtP(conc, 2)} M</text>`;
      };
      $('#ec-svg').innerHTML = `<svg viewBox="0 0 520 260" width="520" height="260" style="max-width:100%;height:auto" role="img" aria-label="Galvanic cell with ${an.m} anode and ${ca.m} cathode">
        ${beaker(40, L, cl, leftIsAnode ? 'an' : 'ca')}${beaker(330, Rr, cr, leftIsAnode ? 'ca' : 'an')}
        <path d="M150 112 L150 82 Q150 70 162 70 L358 70 Q370 70 370 82 L370 112" fill="none" stroke="var(--muted)" stroke-width="14" opacity=".35" stroke-linecap="round"/>
        <text x="260" y="96" text-anchor="middle" font-size="11" fill="var(--muted)">salt bridge</text>
        <path d="M115 40 L115 18 L405 18 L405 40" fill="none" stroke="var(--ink)" stroke-width="2"/>
        <path class="ec-wire${leftIsAnode ? '' : ' rev'}" d="M115 40 L115 18 L405 18 L405 40" fill="none" stroke="var(--c1)" stroke-width="5" stroke-linecap="round"/>
        <rect x="222" y="2" width="76" height="30" rx="6" fill="var(--raised)" stroke="var(--ink)" stroke-width="2"/>
        <text x="260" y="22" text-anchor="middle" font-size="14" font-family="var(--mono)" font-weight="700" fill="var(--ink)">${E.toFixed(3)} V</text>
        <text x="${leftIsAnode ? 165 : 355}" y="12" text-anchor="middle" font-size="11" fill="var(--c1)" font-weight="700">e⁻ ${leftIsAnode ? '→' : '←'}</text></svg>`;
      $('#ec-out').innerHTML = `<div class="callout" style="overflow-x:auto"><div style="white-space:nowrap"><b>Anode:</b> ${an.m} → ${ionOf(an)} + ${an.z}e⁻</div><div style="white-space:nowrap"><b>Cathode:</b> ${ionOf(ca)} + ${ca.z}e⁻ → ${ca.m}</div><div style="white-space:nowrap"><b>Overall:</b> ${c.eq}</div></div>
        ${UI.kv([['E°cell', `${ca.E.toFixed(2)} − (${an.E.toFixed(2)}) = ${c.E.toFixed(2)} V`], ['n (electrons)', c.n], ['E (Nernst, now)', E.toFixed(3) + ' V'], ['ΔG°', fmt(dG, 3) + ' kJ'], ['K', logK > 300 ? `10<sup>${logK.toFixed(0)}</sup>` : fmt(10 ** logK, 3)]])}
        <p class="note" style="margin-top:8px">Raise the cathode ion concentration or lower the anode's and the voltage rises (Q gets smaller). A battery dies as its Q climbs toward K.</p>`;
    }
    ['#ec-l', '#ec-r', '#ec-cl', '#ec-cr'].forEach(s => $(s).addEventListener('input', draw));
    draw();
  },
  problems: [
    { name: 'E°cell', gen() {
      let a, c; do { a = U.pick(HALF); c = U.pick(HALF); } while (a.m === c.m);
      if (a.E > c.E) [a, c] = [c, a];
      const ce = cell(a, c);
      return { kind: 'num', unit: 'V', tol: 0, abs: 0.006, q: `A galvanic cell uses ${a.m}|${ionOf(a)} (E° = ${a.E.toFixed(2)} V) and ${c.m}|${ionOf(c)} (E° = ${c.E.toFixed(2)} V). What is E°<sub>cell</sub>?`, answer: ce.E, display: ce.E.toFixed(2) + ' V',
        explain: `Higher E° is the cathode (${c.m}). <span class="eqn">E°<sub>cell</sub> = ${c.E.toFixed(2)} − (${a.E.toFixed(2)}) = ${ce.E.toFixed(2)} V</span>` };
    } },
    { name: 'Which is the anode?', gen() {
      let a, c; do { a = U.pick(HALF); c = U.pick(HALF); } while (a.m === c.m);
      const an = a.E < c.E ? a : c;
      return { ...mc(an.m, [a.m, c.m]), q: `In a galvanic cell made from <b>${a.m}</b> (E° = ${a.E.toFixed(2)} V) and <b>${c.m}</b> (E° = ${c.E.toFixed(2)} V), which metal is the <b>anode</b>?`, explain: `The lower E° is oxidized, so <b>${an.m}</b> is the anode. Its electrons flow to the other electrode, the cathode.` };
    } },
    { name: 'Spontaneous?', gen() {
      let a, c; do { a = U.pick(HALF); c = U.pick(HALF); } while (a.m === c.m);
      const ce = cell(a, c), yes = ce.E > 0;
      return { ...mc(yes ? 'Spontaneous (E° > 0)' : 'Not spontaneous (E° < 0)', ['Spontaneous (E° > 0)', 'Not spontaneous (E° < 0)']), q: `Is this reaction spontaneous under standard conditions?<span class="eqline">${ce.eq}</span>E°: ${a.m} ${a.E.toFixed(2)} V, ${c.m} ${c.E.toFixed(2)} V.`,
        explain: `Here ${a.m} is oxidized and ${c.m}${c.z > 1 ? c.z : ''}+ reduced: E° = ${c.E.toFixed(2)} − (${a.E.toFixed(2)}) = ${ce.E.toFixed(2)} V. ${yes ? 'Positive, so spontaneous.' : 'Negative, so the reverse reaction is the spontaneous one.'}` };
    } },
    { name: 'ΔG° from E°', gen() {
      let a, c; do { a = U.pick(HALF); c = U.pick(HALF); } while (a.m === c.m || a.E >= c.E);
      const ce = cell(a, c), dG = -ce.n * FARADAY * ce.E / 1000;
      return { kind: 'num', unit: 'kJ', tol: 0.01, q: `For <span class="eqline">${ce.eq} &nbsp; E° = ${ce.E.toFixed(2)} V</span>what is ΔG°?`, answer: dG, explain: `n = ${ce.n} mol e⁻. <span class="eqn">ΔG° = −nFE° = −(${ce.n})(96,485)(${ce.E.toFixed(2)}) = ${fmt(dG * 1000, 3)} J = ${fmt(dG, 3)} kJ</span>` };
    } },
    { name: 'Nernst equation', gen() {
      const a = HALF[6], c = HALF[11], ce = cell(a, c), za = U.pick([0.010, 0.10, 1.0, 2.0]), zc = U.pick([0.010, 0.10, 1.0, 2.0]), E = ce.E - 0.05916 / 2 * lg(za / zc);
      return { kind: 'num', unit: 'V', tol: 0, abs: 0.004, q: `Zn(s) + Cu<sup>2+</sup>(aq) → Zn<sup>2+</sup>(aq) + Cu(s), E° = 1.10 V. What is E when [Zn<sup>2+</sup>] = <b>${za} M</b> and [Cu<sup>2+</sup>] = <b>${zc} M</b>?`, answer: E, display: E.toFixed(3) + ' V',
        explain: `Q = [Zn²⁺]/[Cu²⁺] = ${fmtP(za / zc, 3)}. <span class="eqn">E = 1.10 − (0.0592/2) log(${fmtP(za / zc, 3)}) = ${E.toFixed(3)} V</span>` };
    } },
    { name: 'Electrolysis', gen() {
      const [m, z] = U.pick([['Cu', 2], ['Ag', 1], ['Zn', 2], ['Al', 3], ['Ni', 2], ['Au', 3]]), I = U.sf(0.5, 10, 2), min = U.ri(10, 120), M = EL[m].mass, g = I * min * 60 / FARADAY / z * M;
      return { kind: 'num', unit: 'g', q: `A current of <b>${I} A</b> runs for <b>${min} minutes</b> through a solution of ${m}${z > 1 ? '<sup>' + z + '+</sup>' : '<sup>+</sup>'}. What mass of ${m} plates out?`, answer: g,
        explain: `Charge = ${I} × ${min * 60} s = ${fmt(I * min * 60, 3)} C. mol e⁻ = ÷ 96,485 = ${fmt(I * min * 60 / FARADAY, 3)}. mol ${m} = ÷ ${z} = ${fmt(I * min * 60 / FARADAY / z, 3)}. Mass = × ${M} = <b>${fmt(g, 3)} g</b>.` };
    } },
  ],
});

/* ================= G6: Quantum numbers & advanced bonding ================= */
const LNAME = 'spdf';
/* Lewis structures for formal charge and resonance: atoms [sym, x, y], bonds [i, j, order], lone pairs per atom */
const LEWIS = {
  'CO₂': { charge: 0, structs: [
    { atoms: [['O', 0, 0], ['C', 1, 0], ['O', 2, 0]], bonds: [[0, 1, 2], [1, 2, 2]], lp: [2, 0, 2] },
    { atoms: [['O', 0, 0], ['C', 1, 0], ['O', 2, 0]], bonds: [[0, 1, 3], [1, 2, 1]], lp: [1, 0, 3] }] },
  'OCN⁻': { charge: -1, structs: [
    { atoms: [['O', 0, 0], ['C', 1, 0], ['N', 2, 0]], bonds: [[0, 1, 2], [1, 2, 2]], lp: [2, 0, 2] },
    { atoms: [['O', 0, 0], ['C', 1, 0], ['N', 2, 0]], bonds: [[0, 1, 3], [1, 2, 1]], lp: [1, 0, 3] },
    { atoms: [['O', 0, 0], ['C', 1, 0], ['N', 2, 0]], bonds: [[0, 1, 1], [1, 2, 3]], lp: [3, 0, 1] }] },
  'N₂O': { charge: 0, structs: [
    { atoms: [['N', 0, 0], ['N', 1, 0], ['O', 2, 0]], bonds: [[0, 1, 2], [1, 2, 2]], lp: [2, 0, 2] },
    { atoms: [['N', 0, 0], ['N', 1, 0], ['O', 2, 0]], bonds: [[0, 1, 3], [1, 2, 1]], lp: [1, 0, 3] },
    { atoms: [['N', 0, 0], ['N', 1, 0], ['O', 2, 0]], bonds: [[0, 1, 1], [1, 2, 3]], lp: [3, 0, 1] }] },
  'O₃': { charge: 0, structs: [
    { atoms: [['O', 0, 0.35], ['O', 1, 0], ['O', 2, 0.35]], bonds: [[0, 1, 2], [1, 2, 1]], lp: [2, 1, 3] },
    { atoms: [['O', 0, 0.35], ['O', 1, 0], ['O', 2, 0.35]], bonds: [[0, 1, 1], [1, 2, 2]], lp: [3, 1, 2] }] },
  'NO₃⁻': { charge: -1, structs: [0, 1, 2].map(d => ({ atoms: [['N', 1, 0.55], ['O', 1, -0.45], ['O', 0.13, 1.05], ['O', 1.87, 1.05]], bonds: [1, 2, 3].map(k => [0, k, k - 1 === d ? 2 : 1]), lp: [0, ...[1, 2, 3].map(k => (k - 1 === d ? 2 : 3))] })) },
  'CO₃²⁻': { charge: -2, structs: [0, 1, 2].map(d => ({ atoms: [['C', 1, 0.55], ['O', 1, -0.45], ['O', 0.13, 1.05], ['O', 1.87, 1.05]], bonds: [1, 2, 3].map(k => [0, k, k - 1 === d ? 2 : 1]), lp: [0, ...[1, 2, 3].map(k => (k - 1 === d ? 2 : 3))] })) },
};
const VAL = { H: 1, C: 4, N: 5, O: 6, F: 7, S: 6, Cl: 7 };
const formalCharges = st => st.atoms.map((a, i) => VAL[a[0]] - 2 * st.lp[i] - st.bonds.filter(b => b[0] === i || b[1] === i).reduce((s, b) => s + b[2], 0));
const fcTxt = q => q === 0 ? '0' : q > 0 ? '+' + q : '−' + -q;
function lewisSVG(st, opts = {}) {
  const fc = formalCharges(st), S = 70, ox = 50, oy = opts.tall ? 70 : 60, W = Math.max(...st.atoms.map(a => a[1])) * S + ox * 2, H = (Math.max(...st.atoms.map(a => a[2])) + 0) * S + oy + 50;
  const P = a => [ox + a[1] * S, oy + a[2] * S], parts = [];
  st.bonds.forEach(([i, j, n]) => {
    const [x1, y1] = P(st.atoms[i]), [x2, y2] = P(st.atoms[j]), L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
    const offs = n === 1 ? [0] : n === 2 ? [-3.5, 3.5] : [-6, 0, 6];
    offs.forEach(o => parts.push(`<line x1="${x1 + ux * 15 + nx * o}" y1="${y1 + uy * 15 + ny * o}" x2="${x2 - ux * 15 + nx * o}" y2="${y2 - uy * 15 + ny * o}" stroke="var(--ink)" stroke-width="2.2"/>`));
  });
  st.atoms.forEach((a, i) => {
    const [x, y] = P(a), used = st.bonds.filter(b => b[0] === i || b[1] === i).map(b => { const o = st.atoms[b[0] === i ? b[1] : b[0]]; return Math.atan2(o[2] - a[2], o[1] - a[1]); });
    const cands = [-Math.PI / 2, Math.PI / 2, Math.PI, 0, -Math.PI * 0.75, -Math.PI / 4, Math.PI * 0.75, Math.PI / 4].filter(t => used.every(u => Math.abs(Math.atan2(Math.sin(t - u), Math.cos(t - u))) > 0.9));
    cands.slice(0, st.lp[i]).forEach(t => { const cx = x + Math.cos(t) * 19, cy = y + Math.sin(t) * 19, px = -Math.sin(t) * 4.5, py = Math.cos(t) * 4.5; parts.push(`<circle cx="${cx + px}" cy="${cy + py}" r="2.6" fill="var(--c1)"/><circle cx="${cx - px}" cy="${cy - py}" r="2.6" fill="var(--c1)"/>`); });
    parts.push(`<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="var(--ink)">${a[0]}</text>`);
    if (opts.label === i) parts.push(`<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="var(--c2)" stroke-width="2.5"/>`);
    if (!opts.hideFC) parts.push(`<text x="${x + 17}" y="${y - 22}" font-size="13" font-weight="700" fill="${fc[i] === 0 ? 'var(--muted)' : fc[i] > 0 ? 'var(--bad)' : 'var(--c1)'}">${fcTxt(fc[i])}</text>`);
  });
  return `<svg viewBox="-6 -4 ${W + 12} ${H + 4}" width="${W + 12}" style="max-width:100%;height:auto" role="img" aria-label="Lewis structure">${parts.join('')}</svg>`;
}
const HYBRID = [['CH₄', 'sp³', 'tetrahedral', 4, 0], ['NH₃', 'sp³', 'trigonal pyramidal', 4, 1], ['H₂O', 'sp³', 'bent', 4, 2], ['BF₃', 'sp²', 'trigonal planar', 3, 0], ['CO₂', 'sp', 'linear', 2, 0], ['SO₂', 'sp²', 'bent', 3, 1], ['PCl₅', 'sp³d', 'trigonal bipyramidal', 5, 0], ['SF₄', 'sp³d', 'seesaw', 5, 1], ['ClF₃', 'sp³d', 'T-shaped', 5, 2], ['XeF₂', 'sp³d', 'linear', 5, 3], ['I₃⁻', 'sp³d', 'linear', 5, 3], ['SF₆', 'sp³d²', 'octahedral', 6, 0], ['BrF₅', 'sp³d²', 'square pyramidal', 6, 1], ['XeF₄', 'sp³d²', 'square planar', 6, 2], ['HCN (C)', 'sp', 'linear', 2, 0], ['C₂H₄ (each C)', 'sp²', 'trigonal planar', 3, 0], ['C₂H₂ (each C)', 'sp', 'linear', 2, 0]];
const SIGMA_PI = [['C₂H₆', 7, 0], ['C₂H₄', 5, 1], ['C₂H₂', 3, 2], ['CO₂', 2, 2], ['HCN', 2, 2], ['N₂', 1, 2], ['CH₂O', 3, 1], ['O₂', 1, 1], ['CH₃COOH', 7, 1], ['C₃H₆ (propene)', 8, 1]];

registerLab({
  id: 'quantum', ch: 106, code: 'G6', sym: 'Qn', fam: 'gen',
  title: 'Quantum Numbers & Advanced Bonding', chapter: 'Atomic structure and bonding theories',
  blurb: 'Walk the four quantum numbers to see each orbital\'s shape, then use formal charge, resonance and hybridization to pick the best Lewis structures.',
  ideas: [
    '<b>n</b> (principal, 1, 2, 3…): shell and size. <b>l</b> (0 to n−1): shape: 0 = s, 1 = p, 2 = d, 3 = f. <b>m<sub>l</sub></b> (−l to +l): orientation. <b>m<sub>s</sub></b> (+½ or −½): spin.',
    'Counts: a subshell has <span class="eqn">2l + 1</span> orbitals; shell n has <span class="eqn">n²</span> orbitals and holds <span class="eqn">2n²</span> electrons. No two electrons share all four quantum numbers (Pauli).',
    '<b>Formal charge</b> = valence e⁻ − (lone-pair e⁻ + ½ bonding e⁻). The best Lewis structure has formal charges closest to zero, with any negative charge on the most electronegative atom.',
    '<b>Resonance:</b> when more than one valid structure exists, the real molecule is an average (all three N–O bonds in NO₃⁻ are identical).',
    '<b>Expanded octets:</b> atoms in period 3 and below (P, S, Cl, Xe…) can hold more than 8 electrons: PCl₅, SF₆, XeF₄.',
    '<b>Hybridization</b> follows electron groups: 2 → sp, 3 → sp², 4 → sp³, 5 → sp³d, 6 → sp³d².',
    'Every single bond is one <b>σ</b> bond. A double bond is 1 σ + 1 <b>π</b>; a triple bond is 1 σ + 2 π.',
  ],
  bench(el) {
    let n = 3, l = 1, ml = 0, mol = 'OCN⁻', si = 0;
    el.innerHTML = `
      <div class="panel">
        <h3>Quantum number explorer</h3>
        <div class="row">${UI.stepper('qn-n', 'n', n)}${UI.stepper('qn-l', 'l', l)}${UI.stepper('qn-m', 'mₗ', ml)}</div>
        <div class="row" style="align-items:flex-start;gap:16px"><div class="canvas-wrap" style="flex:0 1 240px"><canvas id="qn-c" aria-label="Shape of the selected orbital"></canvas></div><div id="qn-out" style="flex:1 1 220px;min-width:0;display:grid;gap:10px"></div></div>
      </div>
      <div class="panel">
        <h3>Formal charge and resonance</h3>
        <p class="sub">Compare valid Lewis structures. Small numbers are each atom's formal charge.</p>
        <div class="seg" id="lw-m">${Object.keys(LEWIS).map(k => `<button type="button" data-m="${k}" aria-pressed="${k === mol}">${k}</button>`).join('')}</div>
        <div id="lw-out" style="display:grid;gap:10px"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const cv = makeCanvas($('#qn-c'), 1, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36 * (0.6 + n * 0.1);
      ctx.strokeStyle = tok('line'); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(w - 10, cy); ctx.moveTo(cx, 10); ctx.lineTo(cx, h - 10); ctx.stroke(); ctx.setLineDash([]);
      const lobe = (ang, len, wid, col) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); const g = ctx.createRadialGradient(len * 0.55, 0, 2, len * 0.55, 0, len * 0.6); g.addColorStop(0, col); g.addColorStop(1, 'transparent'); ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(len * 0.3, -wid, len * 1.05, -wid * 1.1, len, 0); ctx.bezierCurveTo(len * 1.05, wid * 1.1, len * 0.3, wid, 0, 0); ctx.fill(); ctx.globalAlpha = 1; ctx.restore(); };
      const a = tok('c1'), b = tok('c2');
      if (l === 0) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, a); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; for (let k = 1; k < n; k++) { ctx.strokeStyle = tok('bg'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R * k / n, 0, Math.PI * 2); ctx.stroke(); } }
      else if (l === 1) { const ang = ml === 0 ? -Math.PI / 2 : ml === 1 ? 0 : -Math.PI / 5; lobe(ang, R, R * 0.42, a); lobe(ang + Math.PI, R, R * 0.42, b); }
      else if (l === 2) { if (ml === 0) { lobe(-Math.PI / 2, R, R * 0.36, a); lobe(Math.PI / 2, R, R * 0.36, a); ctx.strokeStyle = b; ctx.lineWidth = 8; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.5, R * 0.16, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; } else { const off = ml === 2 || ml === -2 ? (ml === 2 ? 0 : Math.PI / 4) : Math.PI / 4; [0, 1, 2, 3].forEach(k => lobe(off + k * Math.PI / 2, R * 0.95, R * 0.3, k % 2 ? b : a)); } }
      else { [0, 1, 2, 3, 4, 5].forEach(k => lobe(k * Math.PI / 3 + ml * 0.2, R * 0.9, R * 0.22, k % 2 ? b : a)); }
      ctx.fillStyle = tok('ink'); ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    });
    function qn() {
      l = U.clamp(l, 0, n - 1); ml = U.clamp(ml, -l, l);
      $('#qn-n').textContent = n; $('#qn-l').textContent = l; $('#qn-m').textContent = ml;
      const name = n + LNAME[l], pnames = { '-1': 'p<sub>y</sub>', 0: 'p<sub>z</sub>', 1: 'p<sub>x</sub>' };
      $('#qn-out').innerHTML = `<span class="big-formula">${name}</span>${UI.kv([['Shape', ['sphere', 'dumbbell', 'cloverleaf', 'complex (8 lobes)'][l]], ['Orbitals in ' + name, 2 * l + 1], ['Max e⁻ in ' + name, 2 * (2 * l + 1)], ['Orbitals in shell ' + n, n * n], ['Max e⁻ in shell ' + n, 2 * n * n], ['Nodes', `${n - 1} total (${l} angular)`]])}
        <p class="note">Allowed values here: l from 0 to ${n - 1}, mₗ from −${l} to +${l}${l === 1 ? `. This one is drawn as ${pnames[ml]}.` : '.'} Each orbital holds two electrons, mₛ = +½ and −½.</p>`;
      cv.redraw();
    }
    wireSteppers(el, (id, d) => { if (id === 'qn-n') n = U.clamp(n + d, 1, 4); if (id === 'qn-l') l = U.clamp(l + d, 0, n - 1); if (id === 'qn-m') ml = U.clamp(ml + d, -l, l); qn(); });
    function lw() {
      const M = LEWIS[mol], fcs = M.structs.map(formalCharges), score = fcs.map((f, i) => f.reduce((s, q) => s + Math.abs(q), 0) * 10 + f.reduce((s, q, k) => s + (q < 0 ? -EN[M.structs[i].atoms[k][0]] : 0), 0));
      const best = score.indexOf(Math.min(...score)), equal = score.every(s => Math.abs(s - score[0]) < 1e-9);
      el.querySelectorAll('#lw-m button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mol)));
      $('#lw-out').innerHTML = `<div class="row" style="gap:12px;align-items:stretch">${M.structs.map((st, i) => `<div class="lw-card${!equal && i === best ? ' best' : ''}" style="flex:1 1 180px;min-width:0;border:1.5px solid ${!equal && i === best ? 'var(--good)' : 'var(--line)'};border-radius:8px;padding:6px;background:var(--raised);display:grid;justify-items:center;gap:4px"><div class="scroll">${lewisSVG(st)}</div><span class="note">FC: ${fcs[i].map(fcTxt).join(', ')}${!equal && i === best ? ' · <b style="color:var(--good)">best</b>' : ''}</span></div>`).join('')}</div>
        <div class="callout">${equal ? `These structures are equivalent. That is <b>resonance</b>: the real ${mol} is a blend of all ${M.structs.length}, with every bond the same length.` : `The highlighted structure has formal charges closest to zero, with any negative charge on the most electronegative atom. It contributes most to the real molecule.`} The formal charges add up to the overall charge (${M.charge === 0 ? '0' : fcTxt(M.charge)}).</div>`;
    }
    $('#lw-m').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mol = b.dataset.m; lw(); } });
    qn(); lw();
    return () => cv.stop();
  },
  problems: [
    { name: 'Allowed quantum numbers?', gen() {
      const n = U.ri(1, 4); let l = U.ri(0, n), ml = U.ri(-3, 3); const ms = U.pick(['+½', '−½']);
      if (Math.random() < 0.5) { l = U.ri(0, n - 1); ml = U.ri(-l, l); }
      const ok = l <= n - 1 && Math.abs(ml) <= l;
      return { ...mc(ok ? 'Allowed' : 'Not allowed', ['Allowed', 'Not allowed']), q: `Is the set <b>n = ${n}, l = ${l}, mₗ = ${ml}, mₛ = ${ms}</b> allowed?`,
        explain: ok ? `Yes: l = ${l} is ${n === 1 ? 'the only value allowed when n = 1' : `between 0 and ${n - 1}`}, and mₗ = ${ml} is ${l === 0 ? 'the only value allowed when l = 0' : `between −${l} and +${l}`}. This is a ${n}${LNAME[l]} electron.` : l > n - 1 ? `No: l must be at most n − 1 = ${n - 1}.` : `No: mₗ must be between −${l} and +${l}.` };
    } },
    { name: 'Orbitals and electrons', gen() {
      const n = U.ri(1, 5), l = U.ri(0, Math.min(3, n - 1)), mode = U.ri(0, 3);
      const [q, a, ex] = [[`How many orbitals are in the <b>${n}${LNAME[l]}</b> subshell?`, 2 * l + 1, `2l + 1 = 2(${l}) + 1 = ${2 * l + 1}`], [`How many electrons can the <b>${n}${LNAME[l]}</b> subshell hold?`, 2 * (2 * l + 1), `(2l + 1) orbitals × 2 = ${2 * (2 * l + 1)}`], [`How many orbitals are in the <b>n = ${n}</b> shell?`, n * n, `n² = ${n * n}`], [`What is the maximum number of electrons in the <b>n = ${n}</b> shell?`, 2 * n * n, `2n² = ${2 * n * n}`]][mode];
      return { kind: 'num', tol: 0, ph: 'whole number', q, answer: a, explain: `<span class="eqn">${ex}</span>` };
    } },
    { name: 'Formal charge', gen() {
      const key = U.pick(Object.keys(LEWIS)), M = LEWIS[key], si = U.ri(0, M.structs.length - 1), st = M.structs[si], i = U.ri(0, st.atoms.length - 1), fc = formalCharges(st)[i];
      const bonds = st.bonds.filter(b => b[0] === i || b[1] === i).reduce((s, b) => s + b[2], 0);
      return { kind: 'num', tol: 0, ph: 'e.g. 0, +1 or -1', q: `In this Lewis structure of <b>${key}</b>, what is the formal charge on the circled <b>${st.atoms[i][0]}</b>?<div class="scroll" style="margin-top:6px">${lewisSVG(st, { hideFC: true, label: i })}</div>`, answer: fc, display: fcTxt(fc),
        check: x => { const v = parseNum(String(x).replace(/^\+/, '')); return v === null ? null : v === fc; },
        explain: `FC = valence − lone-pair electrons − ½(bonding electrons) = ${VAL[st.atoms[i][0]]} − ${2 * st.lp[i]} − ½(${2 * bonds}) = <b>${fcTxt(fc)}</b>.` };
    } },
    { name: 'Hybridization', gen() {
      const [m, hyb, , g, lp] = U.pick(HYBRID);
      return { ...mc(hyb, ['sp', 'sp²', 'sp³', 'sp³d', 'sp³d²']), q: `What is the hybridization of the central atom in <b>${m}</b>?`, explain: `${g} electron groups (${g - lp} bonded atoms + ${lp} lone pair${lp === 1 ? '' : 's'}) → <b>${hyb}</b>.` };
    } },
    { name: 'Expanded-octet shapes', gen() {
      const [m, hyb, shape, g, lp] = U.pick(HYBRID.filter(h => h[3] >= 5));
      return { ...mc(shape, ['trigonal bipyramidal', 'seesaw', 'T-shaped', 'linear', 'octahedral', 'square pyramidal', 'square planar'].filter(s => s !== shape).sort(() => Math.random() - 0.5).slice(0, 3)), q: `What is the molecular geometry of <b>${m}</b>?`,
        explain: `${g} electron groups with ${lp} lone pair${lp === 1 ? '' : 's'}. ${g === 5 ? 'Lone pairs go in the equatorial positions of the trigonal bipyramid' : 'Lone pairs sit opposite each other in the octahedron'}, giving <b>${shape}</b>.` };
    } },
    { name: 'σ and π bonds', gen() {
      const [m, s, p] = U.pick(SIGMA_PI), ask = Math.random() < 0.5 ? 'σ' : 'π';
      return { kind: 'num', tol: 0, ph: 'whole number', q: `How many <b>${ask}</b> bonds are in <b>${m}</b>?`, answer: ask === 'σ' ? s : p, explain: `Every bond has one σ; each extra bond in a double or triple is π. ${m}: ${s} σ and ${p} π.` };
    } },
  ],
});

/* ================= Watch it content for the bridge labs ================= */
function collisionSim(root) {
  const reduce = REDUCE();
  let T = 300, Ea = 50, cat = false, ps = [], hist = [], raf = 0, stopped = false, last = performance.now(), flashes = [], reacted = 0, tick = 0;
  root.innerHTML = `<div class="row" style="align-items:stretch;gap:14px">
      <div class="canvas-wrap story-stage" style="flex:1 1 300px"><canvas id="cs-box" aria-label="A and B molecules colliding; some collisions react"></canvas></div>
      <div class="canvas-wrap story-stage" style="flex:1 1 240px"><canvas id="cs-plot" aria-label="Amount of reactant A left over time"></canvas></div></div>
    <div class="row">${UI.slider('cs-t', 'Temperature', 200, 800, 10, T)}${UI.slider('cs-e', 'Activation energy', 10, 100, 1, Ea)}</div>
    <div class="btn-row"><label class="inwrap"><input type="checkbox" id="cs-cat"> Add a catalyst</label><button type="button" class="btn ghost" id="cs-reset">Restart</button></div>
    <div id="cs-out" class="note"></div>`;
  const $ = s => root.querySelector(s);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  const sd = () => Math.sqrt(T / 300) * 12;
  function reset() { ps = []; for (let i = 0; i < 40; i++) ps.push({ x: 4 + Math.random() * 92, y: 4 + Math.random() * 42, vx: gauss() * sd(), vy: gauss() * sd(), t: i % 2 ? 'B' : 'A' }); hist = []; reacted = 0; }
  const box = makeCanvas($('#cs-box'), w => Math.max(170, Math.min(250, w * 0.55)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const s = Math.min(w / 100, h / 50), ox = (w - 100 * s) / 2, oy = (h - 50 * s) / 2;
    for (const f of flashes) { ctx.globalAlpha = f.life; ctx.strokeStyle = tok('good'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ox + f.x * s, oy + f.y * s, (1.2 - f.life) * 8 * s, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const p of ps) {
      const x = ox + p.x * s, y = oy + p.y * s;
      if (p.t === 'C') { ctx.fillStyle = tok('c1'); ctx.beginPath(); ctx.arc(x - 1.2 * s, y, 1.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = tok('c2'); ctx.beginPath(); ctx.arc(x + 1.2 * s, y, 1.5 * s, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = tok(p.t === 'A' ? 'c1' : 'c2'); ctx.beginPath(); ctx.arc(x, y, 1.7 * s, 0, Math.PI * 2); ctx.fill(); }
    }
  });
  const plot = makeCanvas($('#cs-plot'), w => Math.max(170, Math.min(250, w * 0.55)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 26, r: 8, t: 10, b: 22 }, X = i => pad.l + (w - pad.l - pad.r) * i / 599, Y = v => h - pad.b - (h - pad.t - pad.b) * v / 20;
    ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
    [0, 10, 20].forEach(v => { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); ctx.fillText(v, 4, Y(v) + 4); });
    ctx.fillText('A left · time →', w - 104, h - 6);
    ctx.strokeStyle = tok('c1'); ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))); ctx.stroke();
  });
  function loop(now) {
    if (stopped) return;
    const dt = Math.min(0.04, (now - last) / 1000); last = now;
    const thr = (cat ? 0.6 : 1) * Ea * 5.5;
    for (const p of ps) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 2 || p.x > 98) { p.vx *= -1; p.x = U.clamp(p.x, 2, 98); } if (p.y < 2 || p.y > 48) { p.vy *= -1; p.y = U.clamp(p.y, 2, 48); } }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > 12 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn <= 0) continue;
      if (((a.t === 'A' && b.t === 'B') || (a.t === 'B' && b.t === 'A')) && 0.5 * vn * vn > thr) {
        a.t = 'C'; a.vx = (a.vx + b.vx) / 2; a.vy = (a.vy + b.vy) / 2; a.x = (a.x + b.x) / 2; a.y = (a.y + b.y) / 2; b.dead = true; reacted++;
        flashes.push({ x: a.x, y: a.y, life: 1 });
      } else { a.vx -= vn * nx; a.vy -= vn * ny; b.vx += vn * nx; b.vy += vn * ny; }
    }
    ps = ps.filter(p => !p.dead);
    // gentle thermostat so speeds follow the slider
    const ke = ps.reduce((s, p) => s + p.vx * p.vx + p.vy * p.vy, 0) / ps.length / 2, lam = Math.sqrt(1 + 0.05 * (sd() * sd() / Math.max(ke, 1) - 1));
    ps.forEach(p => { p.vx *= lam; p.vy *= lam; });
    flashes.forEach(f => { f.life -= dt * 1.6; }); flashes = flashes.filter(f => f.life > 0);
    if (++tick % 4 === 0) { hist.push(ps.filter(p => p.t === 'A').length); if (hist.length > 600) hist.shift(); }
    if (tick % 20 === 0) { const a = ps.filter(p => p.t === 'A').length; $('#cs-out').innerHTML = `${a} of 20 A molecules left · ${reacted} successful collisions. Only collisions harder than E<sub>a</sub> react (green flash); the rest just bounce.${a === 0 ? ' <b>All reacted.</b> Press Restart and try a different temperature.' : ''}`; }
    box.redraw(); plot.redraw();
    raf = requestAnimationFrame(loop);
  }
  $('#cs-t').addEventListener('input', e => { T = +e.target.value; $('#cs-t-o').textContent = T + ' K'; });
  $('#cs-e').addEventListener('input', e => { Ea = +e.target.value; $('#cs-e-o').textContent = Ea + ' (relative)'; });
  $('#cs-cat').addEventListener('change', e => { cat = e.target.checked; });
  $('#cs-reset').addEventListener('click', reset);
  $('#cs-t-o').textContent = T + ' K'; $('#cs-e-o').textContent = Ea + ' (relative)';
  reset();
  if (reduce) { box.redraw(); $('#cs-out').textContent = 'Animation is paused because your device asks for reduced motion.'; }
  else raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); box.stop(); plot.stop(); };
}

function bufferFrames() {
  const HA = (i, x, y) => [A('h' + i, 'H', x - 3.4, y, { r: 1.7 }), A('a' + i, 'X', x + 1, y, { lab: 'A', color: '#5b7cf0', r: 2.8 }), B('h' + i, 'a' + i)];
  const Am = (i, x, y) => A('a' + i, 'X', x, y, { lab: 'A', color: '#5b7cf0', r: 2.8, q: '−' });
  const pos = [[16, 14], [32, 14], [48, 14], [16, 34], [32, 34], [48, 34]];
  const startHA = [0, 1, 2].map(i => HA(i, ...pos[i])), startA = [3, 4, 5].map(i => Am(i, ...pos[i]));
  const ph = s => T('ph', 80, 6, s, { size: 3.2, mono: true });
  return [
    F('A buffer holds a weak acid (HA) <b>and</b> its conjugate base (A⁻) in similar amounts. Here: 3 HA and 3 A⁻.', [startHA, startA, ph('pH = pKₐ')]),
    F('Add a strong acid: free H⁺ ions arrive.', [startHA, startA, A('x1', 'H', 78, 26, { q: '+', r: 1.7 }), A('x2', 'H', 86, 36, { q: '+', r: 1.7 }), ph('pH = pKₐ')], { hl: ['x1', 'x2'], hold: 1800 }),
    F('The A⁻ ions grab them and become HA. The H⁺ is <b>used up</b> instead of staying free, so the pH barely changes.', [startHA, Am(5, 48, 34), A('x1', 'H', 12.6, 34, { r: 1.7 }), B('x1', 'a3'), A('a3', 'X', 17, 34, { lab: 'A', color: '#5b7cf0', r: 2.8 }), A('x2', 'H', 28.6, 34, { r: 1.7 }), B('x2', 'a4'), A('a4', 'X', 33, 34, { lab: 'A', color: '#5b7cf0', r: 2.8 }), ph('pH ↓ 0.1'), T('n', 50, 46, 'H⁺ + A⁻ → HA', { size: 3 })]),
    F('Add a strong base instead: OH⁻ pulls H⁺ off HA, making water and more A⁻. Again the pH barely moves. A buffer fails only when one partner runs out (its <b>capacity</b>).', [Am(0, 16, 14), HA(1, 32, 14), HA(2, 48, 14), startA, M('H2O', 76, 22, ['wO', 'h0', 'wH']), ph('pH ↑ 0.1'), T('n', 50, 46, 'OH⁻ + HA → A⁻ + H₂O', { size: 3 })]),
  ];
}
function electrochemFrames() {
  const zy = [10, 18, 26, 34], cy = [10, 18, 26, 34];
  const strips = [Box('zs', 14, 4, 8, 38, { fill: '--muted', alpha: 0.2, stroke: '--muted' }), Box('cs', 78, 4, 8, 38, { fill: '--c2', alpha: 0.2, stroke: '--c2' }), Box('br', 30, 4, 40, 3, { fill: '--muted', alpha: 0.25 }), T('bl', 50, 10, 'salt bridge', { size: 2.2, color: '--muted', weight: 400 }), T('an', 18, 47, 'anode: Zn', { size: 2.5 }), T('ca', 82, 47, 'cathode: Cu', { size: 2.5 })];
  const zn = skip => zy.map((y, i) => skip.includes(i) ? null : A('z' + i, 'Zn', 18, y, { r: 2.9 }));
  const cu = (have) => cy.map((y, i) => have.includes(i) ? A('c' + i, 'Cu', 82, y, { r: 2.9 }) : null);
  const ions = [A('k0', 'Cu', 66, 22, { q: '2+', r: 2.6 }), A('k1', 'Cu', 70, 34, { q: '2+', r: 2.6 })];
  return [
    F('A <b>galvanic cell</b> splits Zn + Cu²⁺ → Zn²⁺ + Cu into two halves joined by a wire and a salt bridge.', [strips, zn([]), cu([0, 1, 2, 3]), ions, Ar('w', 22, 2.5, 78, 2.5, { color: '--line' })]),
    F('At the <b>anode</b>, a zinc atom is oxidized. It leaves as Zn²⁺, and its two electrons go into the wire.', [strips, zn([1]), A('z1', 'Zn', 28, 20, { q: '2+', r: 2.6 }), A('e1', 'e', 22, 6, { r: 1.1 }), A('e2', 'e', 26, 4, { r: 1.1 }), cu([0, 1, 2, 3]), ions, Ar('w', 22, 2.5, 78, 2.5, { color: '--c1' })], { hl: ['e1', 'e2'] }),
    F('Electrons travel <b>through the wire</b> from anode to cathode. That flow is the electric current your device uses.', [strips, zn([1]), A('z1', 'Zn', 34, 22, { q: '2+', r: 2.6 }), A('e1', 'e', 74, 4, { r: 1.1 }), A('e2', 'e', 70, 2.5, { r: 1.1 }), cu([0, 1, 2, 3]), ions, Ar('w', 22, 2.5, 78, 2.5, { color: '--c1' })], { hold: 1800 }),
    F('At the <b>cathode</b>, Cu²⁺ picks up the two electrons and plates out as copper metal. Ions drifting through the salt bridge keep both sides electrically neutral.', [strips, zn([1]), A('z1', 'Zn', 36, 24, { q: '2+', r: 2.6 }), cu([0, 1, 2, 3]), A('k0', 'Cu', 82, 42, { r: 2.9 }), A('k1', 'Cu', 70, 34, { q: '2+', r: 2.6 }), T('eq', 50, 30, 'E°cell = 0.34 − (−0.76) = 1.10 V', { size: 2.6, mono: true })]),
  ];
}
STORIES.kinetics = { title: 'Collision theory: why heat speeds reactions up', live: collisionSim };
STORIES.buffers = { title: 'How a buffer absorbs acid and base', frames: bufferFrames };
STORIES.electrochem = { title: 'Inside a battery: electrons through the wire', frames: electrochemFrames };

/* ================= Gen chem problem types added to existing labs ================= */
function addProblems(id, list) { const lab = LABS.find(l => l.id === id); if (lab) lab.problems.push(...list); }
addProblems('gases', [
  { name: 'Gas density & molar mass', gen() {
    const f = U.pick(['O2', 'N2', 'CO2', 'CH4', 'Ar', 'NH3', 'SO2', 'Cl2']), M = Chem.molarMass(f), P = U.sf(0.8, 2, 3), T = U.ri(273, 400), d = P * M / (R_GAS * T);
    if (Math.random() < 0.5) return { kind: 'num', unit: 'g/L', q: `What is the density of <b>${fmtF(f)}</b> gas at <b>${P} atm</b> and <b>${T} K</b>?`, answer: d, explain: `<span class="eqn">d = PM/RT = (${P})(${M.toFixed(2)}) / (0.08206 × ${T}) = ${fmt(d, 3)} g/L</span>` };
    const dr = Number(d.toPrecision(3));
    return { kind: 'num', unit: 'g/mol', q: `An unknown gas has a density of <b>${dr} g/L</b> at ${P} atm and ${T} K. What is its molar mass?`, answer: dr * R_GAS * T / P, explain: `<span class="eqn">M = dRT/P = (${dr})(0.08206)(${T}) / ${P} = ${fmt(dr * R_GAS * T / P, 3)} g/mol</span>, which matches ${fmtF(f)} (${M.toFixed(2)}).` };
  } },
  { name: 'Graham\'s law', gen() {
    const pairs = [['H2', 'O2'], ['He', 'Ar'], ['CH4', 'SO2'], ['NH3', 'HCl'], ['N2', 'CO2'], ['H2', 'CO2']], [a, b] = U.pick(pairs), Ma = Chem.molarMass(a), Mb = Chem.molarMass(b), r = Math.sqrt(Mb / Ma);
    return { kind: 'num', tol: 0.01, q: `How many times faster does <b>${fmtF(a)}</b> effuse than <b>${fmtF(b)}</b>?`, answer: r, explain: `<span class="eqn">rate₁/rate₂ = √(M₂/M₁) = √(${Mb.toFixed(2)}/${Ma.toFixed(2)}) = ${r.toFixed(2)}</span>. Lighter molecules move faster.` };
  } },
  { name: 'Gas stoichiometry', gen() {
    const opts = [['2 KClO₃ → 2 KCl + 3 O₂', 'KClO3', 2, 'O₂', 3], ['Zn + 2 HCl → ZnCl₂ + H₂', 'Zn', 1, 'H₂', 1], ['CaCO₃ → CaO + CO₂', 'CaCO3', 1, 'CO₂', 1], ['2 NaN₃ → 2 Na + 3 N₂', 'NaN3', 2, 'N₂', 3]];
    const [eq, f, cf, gas, cg] = U.pick(opts), g = U.sf(2, 60, 3), P = U.sf(0.9, 1.2, 3), T = U.ri(290, 310), n = g / Chem.molarMass(f) * cg / cf, V = n * R_GAS * T / P;
    return { kind: 'num', unit: 'L', q: `<span class="eqline">${eq}</span>What volume of ${gas} forms from <b>${g} g of ${fmtF(f)}</b> at ${P} atm and ${T} K?`, answer: V,
      explain: `mol ${fmtF(f)} = ${g} ÷ ${Chem.molarMass(f).toFixed(2)} = ${fmt(g / Chem.molarMass(f), 3)}; × ${cg}/${cf} = ${fmt(n, 3)} mol ${gas}. <span class="eqn">V = nRT/P = ${fmt(V, 3)} L</span>` };
  } },
]);
addProblems('solutions', [
  { name: 'van\'t Hoff factor', gen() {
    const [f, i] = U.pick([['NaCl', 2], ['CaCl2', 3], ['KBr', 2], ['MgCl2', 3], ['Na2SO4', 3], ['C6H12O6', 1], ['AlCl3', 4]]), m = U.sf(0.1, 1.5, 2), dT = i * m * 1.86;
    return { kind: 'num', unit: '°C', abs: 0.05, tol: 0, q: `What is the freezing point of a <b>${m} m</b> aqueous solution of <b>${fmtF(f)}</b>? (K<sub>f</sub> = 1.86 °C/m, assume complete dissociation)`, answer: -dT, display: (-dT).toFixed(2) + ' °C',
      explain: `${fmtF(f)} gives i = ${i} particle${i > 1 ? 's' : ''} per formula unit. <span class="eqn">ΔT<sub>f</sub> = i·m·K<sub>f</sub> = ${i} × ${m} × 1.86 = ${dT.toFixed(2)} °C</span>, so it freezes at <b>${(-dT).toFixed(2)} °C</b>.` };
  } },
]);
addProblems('equilibrium', [
  { name: 'ICE table for K', gen() {
    const K = U.pick([4.0, 9.0, 16, 25, 0.25]), c0 = U.pick([0.50, 1.00, 2.00]), r = Math.sqrt(K), x = r * c0 / (2 + r);
    return { kind: 'num', unit: 'M', tol: 0.02, q: `H₂(g) + I₂(g) ⇌ 2 HI(g), K = <b>${K}</b>. If [H₂]₀ = [I₂]₀ = <b>${c0} M</b> and no HI is present, what is [HI] at equilibrium?`, answer: 2 * x,
      explain: `ICE: [H₂] = [I₂] = ${c0} − x, [HI] = 2x. K = (2x)²/(${c0} − x)². Square root: ${r.toFixed(2)} = 2x/(${c0} − x), so x = ${fmt(x, 3)} and [HI] = 2x = <b>${fmt(2 * x, 3)} M</b>.` };
  } },
  { name: 'Common-ion effect', gen() {
    const [salt, ksp, ion, src] = U.pick([['AgCl', 1.77e-10, 'Cl⁻', 'NaCl'], ['BaSO4', 1.07e-10, 'SO₄²⁻', 'Na₂SO₄'], ['AgBr', 5.35e-13, 'Br⁻', 'KBr']]), c = U.pick([0.010, 0.050, 0.10]), s = ksp / c;
    return { kind: 'num', unit: 'M', tol: 0.03, q: `K<sub>sp</sub> of <b>${fmtF(salt)}</b> is ${sci(ksp)}. What is its molar solubility in <b>${c} M ${src}</b>?`, answer: s,
      explain: `The ${ion} already in solution is ${c} M, so K<sub>sp</sub> = s × ${c}. s = ${fmt(ksp, 3)} / ${c} = <b>${fmt(s, 3)} M</b>, much less than in pure water (${fmt(Math.sqrt(ksp), 3)} M). That is the common-ion effect.` };
  } },
]);
