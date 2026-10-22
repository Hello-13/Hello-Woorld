'use strict';
/* Atoms & compounds: Ch 4 Atoms and Elements, Ch 5 Molecules and Compounds, Ch 6 Chemical Composition,
   Ch 9 Electrons in Atoms and the Periodic Table, Ch 10 Chemical Bonding */

/* ================= Ch 4: Atoms and elements ================= */
const ISOTOPE_SETS = {
  Boron: [[10.0129, 19.9], [11.0093, 80.1]],
  Chlorine: [[34.9689, 75.78], [36.9659, 24.22]],
  Copper: [[62.9296, 69.15], [64.9278, 30.85]],
  Magnesium: [[23.9850, 78.99], [24.9858, 10.00], [25.9826, 11.01]],
  Gallium: [[68.9256, 60.11], [70.9247, 39.89]],
  Silver: [[106.9051, 51.84], [108.9048, 48.16]],
};
const ISO_SYM = { Boron: 'B', Chlorine: 'Cl', Copper: 'Cu', Magnesium: 'Mg', Gallium: 'Ga', Silver: 'Ag' };
const SHELL_CAP = [2, 8, 8, 18, 18, 32];
const ionCharge = sym => ({ 1: 1, 2: 2, 13: 3, 15: -3, 16: -2, 17: -1 })[Chem.group(EL[sym].Z)];

registerLab({
  id: 'atoms', ch: 4, sym: 'At', fam: 'atom',
  title: 'Atoms & Isotopes', chapter: 'Atoms and Elements',
  blurb: 'Build any atom or ion from protons, neutrons and electrons, then calculate an atomic mass from isotope abundances.',
  ideas: [
    'The <b>atomic number Z</b> (protons) defines the element. Change the protons and you have a different element.',
    '<b>Mass number A</b> = protons + neutrons. Isotopes have the same Z but different numbers of neutrons, written like <span class="eqn">C-14</span> or ¹⁴₆C.',
    '<b>Ions</b> form when electrons are gained or lost: charge = protons − electrons. Metals lose electrons (cations, +); nonmetals gain them (anions, −).',
    'Main-group ion charges follow the group: 1A → 1+, 2A → 2+, 3A → 3+, 5A → 3−, 6A → 2−, 7A → 1−.',
    '<b>Atomic mass</b> is the weighted average of the naturally occurring isotopes: <span class="eqn">Σ (fraction × isotope mass)</span>. Boron: (0.199)(10.01) + (0.801)(11.01) = 10.81 amu.',
  ],
  bench(el) {
    let p = 6, n = 6, e = 6;
    el.innerHTML = `
      <div class="panel">
        <h3>Atom builder</h3>
        <p class="sub">Add or remove particles. The element, isotope and charge update as you go.</p>
        <div class="row">${UI.stepper('ab-p', 'Protons', p)}${UI.stepper('ab-n', 'Neutrons', n)}${UI.stepper('ab-e', 'Electrons', e)}<button type="button" class="btn" id="ab-neutral">Make neutral</button></div>
        <div class="row" style="align-items:center;gap:18px">
          <div class="canvas-wrap" style="flex:1 1 240px;max-width:340px"><canvas id="ab-c" aria-label="Simplified Bohr model of the atom"></canvas></div>
          <div id="ab-out" style="flex:1 1 220px;display:grid;gap:10px;min-width:0"></div>
        </div>
      </div>
      <div class="panel">
        <h3>Atomic mass from isotopes</h3>
        <p class="sub">Weighted average of isotope masses. Start from a real element or type your own values.</p>
        <div class="row">${UI.select('am-set', 'Element', Object.keys(ISOTOPE_SETS), 'Boron')}</div>
        <div id="am-rows" style="display:grid;gap:8px"></div>
        <div id="am-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const cv = makeCanvas($('#ab-c'), 1, draw);
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, shells = [];
      let left = e; for (const cap of SHELL_CAP) { if (left <= 0) break; shells.push(Math.min(cap, left)); left -= cap; }
      const nucR = Math.min(w, h) * 0.11, step = (Math.min(w, h) / 2 - nucR - 10) / Math.max(shells.length, 3);
      ctx.strokeStyle = tok('line'); ctx.lineWidth = 1.2;
      shells.forEach((cnt, i) => {
        const r = nucR + step * (i + 1);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < cnt; k++) {
          const a = -Math.PI / 2 + k * 2 * Math.PI / cnt;
          ctx.fillStyle = tok('c1'); ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 4.5, 0, Math.PI * 2); ctx.fill();
        }
      });
      // nucleus: protons and neutrons packed in a spiral
      const total = p + n, pr = Math.max(2.4, nucR / Math.sqrt(total + 1) * 0.95);
      const pairs = 2 * Math.min(p, n), order = Array.from({ length: total }, (_, i) => i < pairs ? i % 2 === 0 : p > n);
      for (let i = total - 1; i >= 0; i--) {
        const rr = pr * 1.1 * Math.sqrt(i), a = i * 2.39996;
        ctx.fillStyle = order[i] ? tok('c2') : tok('muted');
        ctx.beginPath(); ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), pr, 0, Math.PI * 2); ctx.fill();
      }
    }
    function update() {
      $('#ab-p').textContent = p; $('#ab-n').textContent = n; $('#ab-e').textContent = e;
      const elx = ELZ[p], A = p + n, q = p - e;
      const common = Math.round(elx.mass);
      const iso = `<span class="big-formula">${Chem.isotope(elx.sym, A)}<sup style="font-size:.45em">${chargeStr(q)}</sup></span>`;
      $('#ab-out').innerHTML = `${iso}
        <div><b>${elx.name}-${A}</b>${q ? ` ${q > 0 ? 'cation' : 'anion'}` : ', neutral atom'}</div>
        ${UI.kv([['Atomic number Z', p], ['Mass number A', A], ['Charge', q === 0 ? '0' : signed(q)], ['Most common A', common]])}
        <p class="note"><span style="color:var(--c2)">●</span> protons <span style="color:var(--muted)">●</span> neutrons <span style="color:var(--c1)">●</span> electrons (simplified Bohr shells)</p>
        ${Math.abs(A - common) > 4 ? '<div class="callout warn">This isotope is far from the usual mass number, so it would be very unstable (radioactive) or not exist.</div>' : ''}`;
      cv.redraw();
    }
    wireSteppers(el, (id, d) => {
      if (id === 'ab-p') p = U.clamp(p + d, 1, 54);
      if (id === 'ab-n') n = U.clamp(n + d, 0, 80);
      if (id === 'ab-e') e = U.clamp(e + d, 0, 60);
      update();
    });
    $('#ab-neutral').addEventListener('click', () => { e = p; update(); });
    function amRows() {
      const set = ISOTOPE_SETS[$('#am-set').value], sym = ISO_SYM[$('#am-set').value];
      $('#am-rows').innerHTML = set.map(([m, pct], i) => `<div class="row">${UI.num('am-m' + i, `${sym}-${Math.round(m)} mass`, m, 'amu')}${UI.num('am-p' + i, 'Abundance', pct, '%')}</div>`).join('');
      $('#am-rows').querySelectorAll('input').forEach(x => x.addEventListener('input', am));
      am();
    }
    function am() {
      const set = ISOTOPE_SETS[$('#am-set').value], name = $('#am-set').value;
      const rows = set.map((_, i) => [parseNum($('#am-m' + i).value), parseNum($('#am-p' + i).value)]);
      if (rows.some(([m, pc]) => m === null || pc === null)) { $('#am-out').innerHTML = '<div class="callout warn">Fill in every mass and abundance.</div>'; return; }
      const sum = rows.reduce((s, [, pc]) => s + pc, 0), avg = rows.reduce((s, [m, pc]) => s + m * pc / 100, 0);
      $('#am-out').innerHTML = `<div class="callout" style="overflow-x:auto"><span style="white-space:nowrap;font-family:var(--mono);font-size:.92rem">${rows.map(([m, pc]) => `(${fmtP(pc / 100, 4)})(${m})`).join(' + ')} = <b>${fmt(avg, 5)} amu</b></span></div>
        ${Math.abs(sum - 100) > 0.05 ? `<div class="callout warn">The abundances add to ${fmtP(sum, 4)}%, not 100%.</div>` : `<p class="note">Periodic table value for ${name.toLowerCase()}: ${EL[ISO_SYM[name]].mass} amu. The average sits closer to the more abundant isotope.</p>`}`;
    }
    $('#am-set').addEventListener('change', amRows);
    update(); amRows();
    return () => cv.stop();
  },
  problems: [
    { name: 'Protons, neutrons, electrons', gen() {
      const Z = U.ri(1, 56), elx = ELZ[Z];
      const A = Math.max(Z, Math.round(elx.mass) + U.ri(-1, 2));
      // skip charges that are not real simple ions (B³⁺, H⁺ as a bare nucleus, As³⁻, Sb³⁻)
      const q = Math.random() < .45 && ionCharge(elx.sym) !== undefined && !['B', 'H', 'As', 'Sb'].includes(elx.sym) ? ionCharge(elx.sym) : 0;
      const ask = U.pick(['protons', 'neutrons', 'electrons']);
      const ans = { protons: Z, neutrons: A - Z, electrons: Z - q }[ask];
      return { kind: 'num', tol: 0, ph: 'whole number', q: `How many <b>${ask}</b> are in <span style="font-size:1.4em">${Chem.isotope(elx.sym, A)}<sup>${chargeStr(q)}</sup></span> (${elx.name}-${A}${q ? `, charge ${signed(q)}` : ''})?`,
        answer: ans, explain: `Protons = Z = ${Z}. Neutrons = A − Z = ${A} − ${Z} = ${A - Z}. Electrons = protons − charge = ${Z} − (${q}) = ${Z - q}.` };
    } },
    { name: 'Atomic mass', gen() {
      let name, set, sym;
      if (Math.random() < .6) { name = U.pick(Object.keys(ISOTOPE_SETS)); set = ISOTOPE_SETS[name]; sym = ISO_SYM[name]; }
      else {
        name = 'Element X'; sym = 'X'; const base = U.ri(20, 120), p1 = U.sf(10, 90, 3);
        set = [[base + U.rnd(-0.1, 0.1), p1], [base + 2 + U.rnd(-0.1, 0.1), Number((100 - p1).toFixed(1))]].map(([m, pc]) => [Number(m.toFixed(4)), pc]);
      }
      const avg = set.reduce((s, [m, pc]) => s + m * pc / 100, 0);
      return { kind: 'num', unit: 'amu', abs: 0.015, tol: 0, q: `${name} has these naturally occurring isotopes: ${set.map(([m, pc]) => `<b>${sym}-${Math.round(m)}</b> (${m} amu, ${pc}%)`).join(', ')}. Calculate the atomic mass.`,
        answer: avg, display: avg.toFixed(2) + ' amu', explain: `<span class="eqn">${set.map(([m, pc]) => `(${fmtP(pc / 100, 4)})(${m})`).join(' + ')} = ${avg.toFixed(2)} amu</span>` };
    } },
    { name: 'Ion charge', gen() {
      const sym = U.pick(['Li', 'Na', 'K', 'Rb', 'Mg', 'Ca', 'Sr', 'Ba', 'Al', 'N', 'P', 'O', 'S', 'Se', 'F', 'Cl', 'Br', 'I']);
      const q = ionCharge(sym), g = Chem.group(EL[sym].Z);
      const parse = r => { const s = String(r).replace(/\s/g, '').replace(/[−–]/g, '-'); let m = s.match(/^([+-])?(\d*)([+-])?$/); if (!m || (!m[1] && !m[3])) return null; const sign = (m[1] || m[3]) === '+' ? 1 : -1; return sign * (m[2] ? +m[2] : 1); };
      return { kind: 'text', ph: 'e.g. 2+ or 1−', q: `What charge does <b>${EL[sym].name}</b> usually form as an ion?`, answer: chargeStr(q),
        display: chargeStr(q), check: r => { const v = parse(r); return v === null ? null : v === q; }, hint: 'Write the charge like 2+ or 3−.',
        explain: `${EL[sym].name} is in group ${g <= 2 ? g : g - 10}A. ${q > 0 ? `As a metal it loses ${q} electron${q > 1 ? 's' : ''}` : `As a nonmetal it gains ${-q} electron${q < -1 ? 's' : ''}`} to reach a noble-gas configuration, giving ${EL[sym].sym}<sup>${chargeStr(q)}</sup>.` };
    } },
    { name: 'Name the isotope', gen() {
      const Z = U.ri(1, 40), elx = ELZ[Z], A = Math.max(Z, Math.round(elx.mass) + U.ri(-1, 2)), N = A - Z;
      return { kind: 'text', ph: `e.g. ${elx.sym === 'C' ? 'O' : 'C'}-14`, q: `An atom has <b>${Z} proton${Z === 1 ? '' : 's'}</b> and <b>${N} neutron${N === 1 ? '' : 's'}</b>. Write its isotope symbol as Symbol-A.`,
        answer: [`${elx.sym}-${A}`, `${elx.name}-${A}`, `${elx.sym}${A}`, `${A}${elx.sym}`], display: `${elx.sym}-${A}`,
        check: r => { const s = r.replace(/\s/g, ''); if (!s) return null; return [`${elx.sym}-${A}`, `${elx.sym}${A}`, `${A}${elx.sym}`, `${A}-${elx.sym}`].includes(s) || normText(s) === normText(`${elx.name}-${A}`); },
        explain: `Z = ${Z} means ${elx.name}. A = ${Z} + ${N} = ${A}, so it is <b>${elx.sym}-${A}</b>.` };
    } },
  ],
});

/* ================= Ch 5: Molecules and compounds ================= */
const CATIONS = [
  ['Li', 1, 'lithium'], ['Na', 1, 'sodium'], ['K', 1, 'potassium'], ['NH4', 1, 'ammonium'], ['Ag', 1, 'silver'],
  ['Mg', 2, 'magnesium'], ['Ca', 2, 'calcium'], ['Sr', 2, 'strontium'], ['Ba', 2, 'barium'], ['Zn', 2, 'zinc'], ['Al', 3, 'aluminum'],
  ['Fe', 2, 'iron(II)', 'ferrous'], ['Fe', 3, 'iron(III)', 'ferric'], ['Cu', 1, 'copper(I)', 'cuprous'], ['Cu', 2, 'copper(II)', 'cupric'],
  ['Pb', 2, 'lead(II)', 'plumbous'], ['Pb', 4, 'lead(IV)', 'plumbic'], ['Sn', 2, 'tin(II)', 'stannous'], ['Sn', 4, 'tin(IV)', 'stannic'],
  ['Cr', 3, 'chromium(III)', 'chromic'], ['Co', 2, 'cobalt(II)', 'cobaltous'], ['Co', 3, 'cobalt(III)', 'cobaltic'], ['Mn', 2, 'manganese(II)'], ['Ni', 2, 'nickel(II)'],
].map(([f, q, name, common]) => ({ f, q, name, common, poly: f.length > 2 || /\d/.test(f) }));
const ANIONS = [
  ['F', -1, 'fluoride'], ['Cl', -1, 'chloride'], ['Br', -1, 'bromide'], ['I', -1, 'iodide'], ['O', -2, 'oxide'], ['S', -2, 'sulfide'], ['N', -3, 'nitride'], ['P', -3, 'phosphide'],
  ['OH', -1, 'hydroxide'], ['NO3', -1, 'nitrate'], ['NO2', -1, 'nitrite'], ['C2H3O2', -1, 'acetate'], ['ClO3', -1, 'chlorate'], ['ClO4', -1, 'perchlorate'], ['MnO4', -1, 'permanganate'],
  ['HCO3', -1, 'hydrogen carbonate'], ['CN', -1, 'cyanide'], ['SO4', -2, 'sulfate'], ['SO3', -2, 'sulfite'], ['CO3', -2, 'carbonate'], ['CrO4', -2, 'chromate'], ['Cr2O7', -2, 'dichromate'], ['PO4', -3, 'phosphate'],
].map(([f, q, name]) => ({ f, q, name, poly: /[A-Z].*[A-Z]|\d/.test(f) }));
const ionTxt = ion => `${fmtF(ion.f)}<sup>${chargeStr(ion.q)}</sup>`;
function ionic(cat, an) {
  const l = U.lcm(cat.q, -an.q), nc = l / cat.q, na = l / -an.q;
  const part = (ion, k) => k === 1 ? ion.f : ion.poly ? `(${ion.f})${k}` : ion.f + k;
  const name = `${cat.name} ${an.name}`;
  const names = [name]; if (cat.common) names.push(`${cat.common} ${an.name}`);
  if (an.name === 'hydrogen carbonate') { names.push(`${cat.name} bicarbonate`); }
  return { formula: part(cat, nc) + part(an, na), nc, na, name, names };
}
const fixedCharge = c => !c.name.includes('(');
const PREFIX = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const MOLECULAR = [['CO', 'carbon monoxide'], ['CO2', 'carbon dioxide'], ['NO', 'nitrogen monoxide'], ['NO2', 'nitrogen dioxide'], ['N2O', 'dinitrogen monoxide'], ['N2O4', 'dinitrogen tetroxide'], ['N2O5', 'dinitrogen pentoxide'], ['N2O3', 'dinitrogen trioxide'], ['SO2', 'sulfur dioxide'], ['SO3', 'sulfur trioxide'], ['PCl3', 'phosphorus trichloride'], ['PCl5', 'phosphorus pentachloride'], ['P2O5', 'diphosphorus pentoxide'], ['SF6', 'sulfur hexafluoride'], ['SiCl4', 'silicon tetrachloride'], ['CCl4', 'carbon tetrachloride'], ['CS2', 'carbon disulfide'], ['BF3', 'boron trifluoride'], ['XeF4', 'xenon tetrafluoride'], ['Cl2O7', 'dichlorine heptoxide'], ['IF5', 'iodine pentafluoride'], ['NI3', 'nitrogen triiodide'], ['BrF3', 'bromine trifluoride'], ['S2Cl2', 'disulfur dichloride']];
const molAlts = n => [n, n.replace('monoxide', 'monooxide').replace('tetroxide', 'tetraoxide').replace('pentoxide', 'pentaoxide').replace('heptoxide', 'heptaoxide')];
const SUBSTANCE_TYPES = {
  'Atomic element': ['Fe', 'He', 'Ne', 'Cu', 'Na', 'Ar', 'Au', 'Mg'],
  'Molecular element': ['O2', 'N2', 'H2', 'Cl2', 'P4', 'S8', 'F2', 'Br2', 'I2'],
  'Molecular compound': ['H2O', 'CO2', 'NH3', 'CH4', 'C6H12O6', 'C12H22O11', 'SO2', 'C2H5OH'],
  'Ionic compound': ['NaCl', 'MgO', 'CaCl2', 'KNO3', 'Al2O3', 'NH4Cl', 'Na2SO4', 'CaCO3'],
};
const TYPE_WHY = {
  'Atomic element': 'An atomic element exists as single atoms (no subscript), like He or Fe.',
  'Molecular element': 'A molecular element is atoms of one element bonded together: the diatomics H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂, plus P₄ and S₈.',
  'Molecular compound': 'A molecular compound is two or more nonmetals bonded into molecules.',
  'Ionic compound': 'An ionic compound is a metal (or NH₄⁺) combined with a nonmetal or polyatomic anion.',
};
const HYDRATES = [['CuSO4', 5, 'copper(II) sulfate'], ['CoCl2', 6, 'cobalt(II) chloride'], ['MgSO4', 7, 'magnesium sulfate'], ['Na2CO3', 10, 'sodium carbonate'], ['CaCl2', 2, 'calcium chloride'], ['BaCl2', 2, 'barium chloride'], ['FeCl3', 6, 'iron(III) chloride'], ['NiSO4', 6, 'nickel(II) sulfate'], ['CaSO4', 2, 'calcium sulfate'], ['Na2SO4', 10, 'sodium sulfate'], ['LiCl', 1, 'lithium chloride']];
const EMPIRICAL_PAIRS = [['C6H12O6', 'CH2O'], ['C2H4', 'CH2'], ['H2O2', 'HO'], ['C6H6', 'CH'], ['N2O4', 'NO2'], ['C4H10', 'C2H5'], ['C8H18', 'C4H9'], ['C2H6', 'CH3'], ['P4O10', 'P2O5'], ['C3H6', 'CH2'], ['C2H2', 'CH'], ['B2H6', 'BH3']];
const randomIonic = (filter = () => true) => {
  for (;;) {
    const c = U.pick(CATIONS), a = U.pick(ANIONS);
    if (c.f === 'NH4' && ['N', 'P', 'O', 'S'].includes(a.f)) continue;
    if (filter(c, a)) return [c, a];
  }
};

registerLab({
  id: 'compounds', ch: 5, sym: 'Cp', fam: 'atom',
  title: 'Compounds & Naming', chapter: 'Molecules and Compounds',
  blurb: 'Snap cations and anions together with the criss-cross method, then name ionic, molecular and hydrate compounds.',
  ideas: [
    'Every substance is one of four kinds: <b>atomic element</b> (Fe, He), <b>molecular element</b> (O₂, P₄), <b>molecular compound</b> (H₂O), or <b>ionic compound</b> (NaCl).',
    '<b>Criss-cross:</b> each ion\'s charge becomes the other ion\'s subscript, then reduce: Pb⁴⁺ + O²⁻ → Pb₂O₄ → PbO₂. Total charge must be zero.',
    '<b>Ionic names:</b> cation name + anion name. Anions end in <i>-ide</i> (Cl⁻ chloride) or keep the polyatomic name (SO₄²⁻ sulfate). Subscripts never change the name.',
    'Metals with more than one charge get a Roman numeral (Stock system): FeCl₃ is iron(III) chloride. The older common system uses -ous (lower) and -ic (higher): ferrous, ferric.',
    '<b>Hidden charge:</b> work backwards from the anion. In Co₂O₃, 3 × (2−) = 6−, so each Co is 3+ → cobalt(III) oxide.',
    '<b>Molecular names</b> use prefixes: mono, di, tri, tetra, penta, hexa, hepta, octa, nona, deca. Skip mono on the first element: N₂O₄ is dinitrogen tetroxide.',
    '<b>Hydrates</b> list the water with a dot: CuSO₄·5H₂O is copper(II) sulfate pentahydrate.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Ionic compound builder</h3>
        <p class="sub">Pick a cation and an anion. The charges must cancel.</p>
        <div class="row">${UI.select('ib-c', 'Cation (+)', CATIONS.map((c, i) => [i, `${c.f}${chargeStr(c.q)} · ${c.name}`]), 12)}${UI.select('ib-a', 'Anion (−)', ANIONS.map((a, i) => [i, `${a.f}${chargeStr(a.q)} · ${a.name}`]), 4)}</div>
        <div id="ib-out" style="display:grid;gap:12px"></div>
      </div>
      <div class="panel">
        <h3>Molecular compound namer</h3>
        <p class="sub">Two nonmetals: count each atom with a Greek prefix.</p>
        <div class="row">${UI.select('mn-pick', 'Compound', MOLECULAR.map(([f]) => [f, f]), 'N2O4')}</div>
        <div id="mn-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function build() {
      const c = CATIONS[$('#ib-c').value], a = ANIONS[$('#ib-a').value], r = ionic(c, a);
      const chip = (ion, k, cls) => Array.from({ length: k }, () => `<span class="ionchip ${cls}">${ionTxt(ion)}</span>`).join('');
      $('#ib-out').innerHTML = `
        <style>.ionchip{display:inline-flex;align-items:center;justify-content:center;min-width:58px;padding:8px 10px;border-radius:8px;font-weight:700;border:1.5px solid}.ionchip.c{border-color:var(--c2);background:color-mix(in srgb,var(--c2) 12%,var(--raised))}.ionchip.a{border-color:var(--c1);background:color-mix(in srgb,var(--c1) 12%,var(--raised))}</style>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${chip(c, r.nc, 'c')}${chip(a, r.na, 'a')}</div>
        <div class="row" style="align-items:baseline;gap:16px"><span class="big-formula">${fmtF(r.formula)}</span><b style="font-size:1.15rem">${r.name}</b>${c.common ? `<span class="note">(common name: ${c.common} ${a.name})</span>` : ''}</div>
        <div class="callout" style="font-family:var(--mono);font-size:.92rem;overflow-x:auto"><span style="white-space:nowrap">${r.nc} × (${signed(c.q)}) + ${r.na} × (${signed(a.q)}) = ${r.nc * c.q + r.na * a.q}</span></div>
        ${UI.kv([['Criss-cross', `${c.f}<sub>${-a.q}</sub> ${a.poly ? '(' + a.f + ')' : a.f}<sub>${c.q}</sub>`], ['Reduced ratio', `${r.nc} : ${r.na}`], ['Formula mass', fmt(Chem.molarMass(r.formula), 5) + ' amu']])}
        ${a.poly || c.poly ? '<p class="note">Polyatomic ions stay intact. Use parentheses when you need more than one of them.</p>' : ''}`;
    }
    function mol() {
      const [f, name] = MOLECULAR.find(m => m[0] === $('#mn-pick').value), cnt = Chem.parseFormula(f).counts, els = Object.keys(cnt);
      $('#mn-out').innerHTML = `<div class="row" style="align-items:baseline;gap:16px"><span class="big-formula">${fmtF(f)}</span><b style="font-size:1.15rem">${name}</b></div>
        <div class="scroll"><table class="t"><tr><th>Element</th><th class="n">Atoms</th><th>Prefix</th><th>Name part</th></tr>
        ${els.map((e, i) => `<tr><td>${e}</td><td class="n">${cnt[e]}</td><td>${cnt[e] === 1 && i === 0 ? '(none: skip mono first)' : PREFIX[cnt[e]]}</td><td>${name.split(' ')[i]}</td></tr>`).join('')}</table></div>`;
    }
    $('#ib-c').addEventListener('change', build); $('#ib-a').addEventListener('change', build); $('#mn-pick').addEventListener('change', mol);
    build(); mol();
  },
  problems: [
    { name: 'Name the ionic compound', gen() {
      const [c, a] = randomIonic(), r = ionic(c, a);
      return { kind: 'text', ph: 'e.g. iron(III) chloride', q: `Name <b style="font-size:1.25em">${fmtF(r.formula)}</b>.`, answer: r.names, display: r.name,
        explain: `Cation ${ionTxt(c)} = ${c.name}${fixedCharge(c) ? '' : ` (${r.na} × ${-a.q} = ${r.na * -a.q} negative charge over ${r.nc} metal ion${r.nc > 1 ? 's' : ''} → ${c.q}+)`}. Anion ${ionTxt(a)} = ${a.name}.` };
    } },
    { name: 'Write the formula', gen() {
      const [c, a] = randomIonic(), r = ionic(c, a);
      return { kind: 'formula', ph: 'e.g. Ca(NO3)2', q: `Write the formula for <b>${r.name}</b>.`, answer: r.formula,
        explain: `Ions: ${ionTxt(c)} and ${ionTxt(a)}. Criss-cross and reduce: ${r.nc} : ${r.na} → <b>${fmtF(r.formula)}</b>.` };
    } },
    { name: 'Find the hidden charge', gen() {
      const [c, a] = randomIonic(c => !fixedCharge(c)), r = ionic(c, a);
      return { kind: 'num', tol: 0, ph: 'charge as a number', q: `What is the charge on each metal ion in <b style="font-size:1.2em">${fmtF(r.formula)}</b>?`, answer: c.q, display: `${c.q}+ → ${c.name}`,
        check: x => { const v = parseNum(String(x).replace(/\+$/, '')); return v === null ? null : v === c.q; },
        explain: `Anions: ${r.na} × (${a.q}) = ${r.na * a.q}. Spread +${-r.na * a.q} over ${r.nc} metal ion${r.nc > 1 ? 's' : ''}: each is <b>${c.q}+</b>, so this is ${r.name}.` };
    } },
    { name: 'Molecular names', gen() {
      const [f, name] = U.pick(MOLECULAR);
      if (Math.random() < .5) return { kind: 'text', q: `Name the molecular compound <b style="font-size:1.25em">${fmtF(f)}</b>.`, answer: molAlts(name), display: name, explain: 'Prefix + first element, then prefix + second element root + -ide. Drop mono on the first element; drop the a/o of the prefix before "oxide".' };
      return { kind: 'formula', q: `Write the formula for <b>${name}</b>.`, answer: f, explain: `The prefixes give the subscripts directly: <b>${fmtF(f)}</b>.` };
    } },
    { name: 'Classify the substance', gen() {
      const type = U.pick(Object.keys(SUBSTANCE_TYPES)), f = U.pick(SUBSTANCE_TYPES[type]);
      return { ...mc(type, Object.keys(SUBSTANCE_TYPES)), q: `Classify <b style="font-size:1.2em">${fmtF(f)}</b>.`, explain: TYPE_WHY[type] };
    } },
    { name: 'Hydrates', gen() {
      const [f, n, name] = U.pick(HYDRATES), full = `${f}·${n}H2O`, hn = `${name} ${PREFIX[n]}hydrate`;
      if (Math.random() < .5) return { kind: 'text', q: `Name the hydrate <b style="font-size:1.2em">${fmtF(full)}</b>.`, answer: [hn, hn.replace('monohydrate', 'hydrate')], display: hn, explain: `Name the ionic compound (${name}), then add a prefix for the ${n} water${n > 1 ? 's' : ''} + "hydrate".` };
      return { kind: 'num', unit: 'amu', tol: 0.005, q: `What is the formula mass of <b>${fmtF(full)}</b>?`, answer: Chem.molarMass(full), explain: `${fmtF(f)} = ${fmt(Chem.molarMass(f), 5)}, plus ${n} × 18.02 for the water = <b>${fmt(Chem.molarMass(full), 5)}</b> amu (so its molar mass is the same number in g/mol).` };
    } },
    { name: 'Empirical formula', gen() {
      const [mf, ef] = U.pick(EMPIRICAL_PAIRS);
      return { kind: 'counts', ph: 'e.g. CH2O', q: `What is the empirical formula of <b style="font-size:1.2em">${fmtF(mf)}</b>?`, answer: ef,
        check: r => { try { return Chem.sameCounts(Chem.parseFormula(r).counts, Chem.parseFormula(ef).counts); } catch (e) { return null; } },
        explain: `Divide every subscript by their greatest common factor: ${fmtF(mf)} → <b>${fmtF(ef)}</b>.` };
    } },
  ],
});

/* ================= Ch 6: Chemical composition ================= */
const COMMON = ['H2O', 'CO2', 'NaCl', 'C6H12O6', 'CaCO3', 'H2SO4', 'NH3', 'CH4', 'C2H5OH', 'NaHCO3', 'Mg(OH)2', 'Al2(SO4)3', 'KMnO4', 'C12H22O11', 'Fe2O3', 'Ca3(PO4)2', '(NH4)2SO4', 'C8H18', 'N2O5', 'C3H8', 'HNO3', 'Na2CO3'];
const EMP_POOL = ['CH2O', 'C2H6O', 'Fe2O3', 'N2O5', 'C3H8', 'NO2', 'Na2SO4', 'KClO3', 'C2H5', 'SO3', 'P2O5', 'Al2O3', 'C3H6O', 'CH4N', 'K2O', 'MgCl2'];
const MOLEC_POOL = [['CH2O', 'C6H12O6'], ['CH', 'C6H6'], ['C2H5', 'C4H10'], ['NO2', 'N2O4'], ['CH2', 'C4H8'], ['P2O5', 'P4O10'], ['HO', 'H2O2'], ['CH2', 'C5H10'], ['C3H4', 'C9H12'], ['CH3O', 'C2H6O2']];
const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--f-atom)', 'var(--f-nuc)', 'var(--warn)', 'var(--muted)'];
function percentComp(f) {
  const c = Chem.parseFormula(f).counts, M = Chem.molarMass(c);
  return Object.keys(c).map(e => [e, c[e], EL[e].mass * c[e] / M * 100]);
}

registerLab({
  id: 'composition', ch: 6, sym: 'Mo', fam: 'atom',
  title: 'Moles & Composition', chapter: 'Chemical Composition',
  blurb: 'Weigh any formula, convert between grams, moles and particles, and work out formulas from percent composition.',
  ideas: [
    'A <b>mole</b> is 6.022 × 10²³ particles (Avogadro\'s number), just as a dozen is 12.',
    '<b>Molar mass</b> (g/mol) = sum of the atomic masses in the formula. H₂O: 2(1.008) + 16.00 = 18.02 g/mol.',
    'The road map: <span class="eqn">grams ⇄ moles ⇄ particles</span>. Divide grams by molar mass; multiply moles by 6.022 × 10²³.',
    '<b>Mass percent</b> of an element = (mass of that element in 1 mol ÷ molar mass) × 100%.',
    '<b>Empirical formula from %:</b> assume 100 g, so % becomes grams → convert each to moles → divide by the smallest → multiply to whole numbers if needed.',
    '<b>Molecular formula</b> = empirical formula × n, where n = molar mass ÷ empirical formula mass.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Molar mass calculator</h3>
        <p class="sub">Type a formula. Parentheses and hydrates work: Ca(OH)2, CuSO4·5H2O.</p>
        <div class="row">${UI.text('mm-f', 'Formula', 'C6H12O6', 'e.g. Al2(SO4)3')}</div>
        <div id="mm-out" style="display:grid;gap:12px"></div>
      </div>
      <div class="panel">
        <h3>Grams ⇄ moles ⇄ particles</h3>
        <p class="sub">Uses the formula above. Edit any box.</p>
        <div class="row">${UI.num('cv-g', 'Mass', '90.0', 'g')}${UI.num('cv-n', 'Amount', '', 'mol')}${UI.num('cv-p', 'Particles', '', 'units')}</div>
        <div id="cv-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let M = null, counts = null;
    function calc() {
      try {
        const r = Chem.parseFormula($('#mm-f').value); counts = r.counts; M = Chem.molarMass(counts);
        const rows = percentComp($('#mm-f').value.replace(/\^.*$/, ''));
        $('#mm-out').innerHTML = `<div class="row" style="align-items:baseline;gap:14px"><span class="big-formula">${fmtF($('#mm-f').value.trim())}</span><span class="readout">${M.toFixed(2)} g/mol</span></div>
          <div style="display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--line)">${rows.map(([e, , pc], i) => `<div title="${e} ${pc.toFixed(1)}%" style="width:${pc}%;background:${PALETTE[i % PALETTE.length]}"></div>`).join('')}</div>
          <div class="scroll"><table class="t"><tr><th>Element</th><th class="n">Atoms</th><th class="n">Atomic mass</th><th class="n">Subtotal</th><th class="n">Mass %</th></tr>
          ${rows.map(([e, n, pc], i) => `<tr><td><span style="color:${PALETTE[i % PALETTE.length]}">■</span> ${e}</td><td class="n">${n}</td><td class="n">${EL[e].mass}</td><td class="n">${(EL[e].mass * n).toFixed(3)}</td><td class="n">${pc.toFixed(2)}%</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td></td><td></td><td class="n"><b>${M.toFixed(3)}</b></td><td class="n">100%</td></tr></table></div>`;
        conv('#cv-g');
      } catch (err) { M = null; $('#mm-out').innerHTML = `<div class="callout warn">${U.esc(err.message)}</div>`; $('#cv-out').innerHTML = ''; }
    }
    function conv(src) {
      if (!M) return;
      const v = parseNum($(src).value); if (v === null) return;
      const mol = src === '#cv-g' ? v / M : src === '#cv-n' ? v : v / NA;
      if (src !== '#cv-g') $('#cv-g').value = fmtP(mol * M, 4);
      if (src !== '#cv-n') $('#cv-n').value = fmtP(mol, 4);
      if (src !== '#cv-p') $('#cv-p').value = fmtP(mol * NA, 4);
      const atoms = Object.entries(counts).map(([e, n]) => `${fmt(mol * NA * n, 3)} ${e}`).join(', ');
      $('#cv-out').innerHTML = `<div class="callout" style="overflow-x:auto"><span style="white-space:nowrap;font-family:var(--mono);font-size:.9rem">${fmt(mol * M, 4)} g ÷ ${M.toFixed(2)} g/mol = ${fmt(mol, 4)} mol × 6.022×10²³ = ${fmt(mol * NA, 4)}</span></div><p class="note">That sample contains ${atoms} atoms.</p>`;
    }
    $('#mm-f').addEventListener('input', calc);
    ['#cv-g', '#cv-n', '#cv-p'].forEach(s => $(s).addEventListener('input', () => conv(s)));
    calc();
  },
  problems: [
    { name: 'Molar mass', gen() { const f = U.pick(COMMON), M = Chem.molarMass(f); return { kind: 'num', unit: 'g/mol', tol: 0.004, q: `What is the molar mass of <b style="font-size:1.2em">${fmtF(f)}</b>?`, answer: M, display: M.toFixed(2) + ' g/mol', explain: percentComp(f).map(([e, n]) => `${n} × ${EL[e].mass}`).join(' + ') + ` = <b>${M.toFixed(2)} g/mol</b>` }; } },
    { name: 'Grams → moles', gen() { const f = U.pick(COMMON), M = Chem.molarMass(f), g = U.sf(1, 250, 3); return { kind: 'num', unit: 'mol', q: `How many moles are in <b>${g} g</b> of ${fmtF(f)}?`, answer: g / M, explain: `<span class="eqn">${g} g ÷ ${M.toFixed(2)} g/mol = ${fmt(g / M, 3)} mol</span>` }; } },
    { name: 'Moles → grams', gen() { const f = U.pick(COMMON), M = Chem.molarMass(f), n = U.sf(0.05, 5, 3); return { kind: 'num', unit: 'g', q: `What is the mass of <b>${n} mol</b> of ${fmtF(f)}?`, answer: n * M, explain: `<span class="eqn">${n} mol × ${M.toFixed(2)} g/mol = ${fmt(n * M, 3)} g</span>` }; } },
    { name: 'Counting atoms', gen() {
      const f = U.pick(COMMON.filter(x => !x.includes('('))), c = Chem.parseFormula(f).counts, e = U.pick(Object.keys(c)), M = Chem.molarMass(c), g = U.sf(1, 100, 3);
      const ans = g / M * NA * c[e];
      // ionic compounds (metal or NH₄⁺ first) are counted in formula units, molecular ones in molecules
      const unitWord = /^(Li|Na|K|Mg|Ca|Ba|Al|Fe|Cu|Zn|Ag|Pb|Sn|NH4)/.test(f) ? 'formula unit' : 'molecule';
      return { kind: 'num', unit: `${e} atoms`, q: `How many <b>${EL[e].name.toLowerCase()} atoms</b> are in ${g} g of ${fmtF(f)}?`, answer: ans, explain: `<span class="eqn">${g} g ÷ ${M.toFixed(2)} g/mol × 6.022×10²³ ${unitWord}s/mol × ${c[e]} ${e}/${unitWord} = ${fmt(ans, 3)}</span>` };
    } },
    { name: 'Mass percent', gen() { const f = U.pick(COMMON), rows = percentComp(f), [e, n, pc] = U.pick(rows); return { kind: 'num', unit: '%', tol: 0.005, abs: 0.06, q: `What is the mass percent of <b>${EL[e].name.toLowerCase()}</b> in ${fmtF(f)}?`, answer: pc, display: pc.toFixed(2) + '%', explain: `<span class="eqn">${n} × ${EL[e].mass} ÷ ${Chem.molarMass(f).toFixed(2)} × 100% = ${pc.toFixed(2)}%</span>` }; } },
    { name: 'Empirical from %', gen() {
      const ef = U.pick(EMP_POOL), rows = percentComp(ef);
      const shown = rows.map(([e, n, pc]) => [e, n, Number(pc.toFixed(2))]);
      const moles = shown.map(([e, , pc]) => [e, pc / EL[e].mass]);
      const min = Math.min(...moles.map(m => m[1]));
      return { kind: 'counts', ph: 'e.g. CH2O', q: `A compound is ${shown.map(([e, , pc]) => `<b>${pc}% ${e}</b>`).join(', ')} by mass. What is its empirical formula?`, answer: ef,
        check: r => { try { return Chem.sameCounts(Chem.parseFormula(r).counts, Chem.parseFormula(ef).counts); } catch (e) { return null; } },
        explain: `In 100 g: ${moles.map(([e, m]) => `${e} ${fmt(m, 4)} mol`).join(', ')}. Divide by ${fmt(min, 4)}: ${moles.map(([e, m]) => `${e} ${(m / min).toFixed(2)}`).join(', ')}. ${moles.some(([, m]) => Math.abs(m / min - Math.round(m / min)) > 0.1) ? 'Multiply to clear the fraction. ' : ''}Formula: <b>${fmtF(ef)}</b>.` };
    } },
    { name: 'Molecular formula', gen() {
      const [ef, mf] = U.pick(MOLEC_POOL), em = Chem.molarMass(ef), mm = Chem.molarMass(mf), n = Math.round(mm / em);
      return { kind: 'counts', ph: 'e.g. C6H12O6', q: `A compound has the empirical formula <b>${fmtF(ef)}</b> and a molar mass of <b>${mm.toFixed(2)} g/mol</b>. What is its molecular formula?`, answer: mf,
        check: r => { try { return Chem.sameCounts(Chem.parseFormula(r).counts, Chem.parseFormula(mf).counts); } catch (e) { return null; } },
        explain: `Empirical formula mass = ${em.toFixed(2)}. n = ${mm.toFixed(2)} ÷ ${em.toFixed(2)} = ${n}. Multiply every subscript by ${n}: <b>${fmtF(mf)}</b>.` };
    } },
  ],
});

/* ================= Ch 9: Electrons and the periodic table ================= */
function orbitalBoxes(cfg) {
  return `<div class="orbs">${cfg.map(([o, e]) => {
    const n = Chem.CAP[o[1]] / 2, boxes = [];
    for (let i = 0; i < n; i++) { const up = e > i, dn = e > n + i; boxes.push(`<span class="ob">${up ? '↑' : ''}${dn ? '↓' : ''}</span>`); }
    return `<div class="og"><div class="obx">${boxes.join('')}</div><div class="ol">${o}</div></div>`;
  }).join('')}</div>`;
}
function lambdaColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else if (nm <= 750) { r = 1; }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
const colorName = nm => nm < 380 ? 'ultraviolet' : nm < 450 ? 'violet' : nm < 495 ? 'blue' : nm < 570 ? 'green' : nm < 590 ? 'yellow' : nm < 620 ? 'orange' : nm <= 750 ? 'red' : 'infrared';
const TREND_SETS = { radius: [RADIUS, 'larger atomic radius'], ie: [IE, 'higher first ionization energy'], en: [EN, 'higher electronegativity'] };
const MAIN_GROUP = Object.keys(RADIUS);

registerLab({
  id: 'electrons', ch: 9, sym: 'El', fam: 'atom',
  title: 'Electron Configurations', chapter: 'Electrons in Atoms and the Periodic Table',
  blurb: 'Pick any element on the table to see its orbital diagram fill, then explore light, energy and periodic trends.',
  ideas: [
    'Light energy: <span class="eqn">c = λν</span> and <span class="eqn">E = hν</span>. Shorter wavelength means higher frequency and more energy per photon.',
    'Electrons fill orbitals from lowest energy up (<b>aufbau</b>): 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p…',
    '<b>Pauli:</b> each orbital holds at most 2 electrons, with opposite spins. <b>Hund:</b> fill each orbital in a sublevel singly before pairing.',
    'Capacities: s = 2, p = 6, d = 10, f = 14. Noble-gas shorthand: Na = [Ne] 3s¹.',
    '<b>Valence electrons</b> are in the outermost principal level. For main-group elements this equals the A-group number.',
    'Trends: atomic radius grows down a group and shrinks left → right. Ionization energy and electronegativity do the opposite.',
    'Exceptions to know: Cr = [Ar] 4s¹ 3d⁵ and Cu = [Ar] 4s¹ 3d¹⁰ (half-filled and filled d sublevels are extra stable).',
  ],
  bench(el) {
    let Z = 26;
    const cells = ELZ.slice(1, 55).map(e => {
      const g = Chem.group(e.Z), p = Chem.period(e.Z);
      const block = g <= 2 || e.Z === 2 ? 's' : g >= 13 ? 'p' : 'd';
      return `<button type="button" class="pt pt-${block}" data-z="${e.Z}" style="grid-column:${g};grid-row:${p}" aria-label="${e.name}">${e.sym}</button>`;
    }).join('');
    el.innerHTML = `
      <style>
        .ptable{display:grid;grid-template-columns:repeat(18,minmax(0,1fr));gap:2px;min-width:520px}
        .pt{font:inherit;font-size:.72rem;font-weight:700;aspect-ratio:1;padding:0;border-radius:4px;border:1px solid var(--line);background:var(--raised);color:var(--ink);cursor:pointer}
        .pt-s{background:color-mix(in srgb,var(--c2) 14%,var(--raised))}.pt-p{background:color-mix(in srgb,var(--c3) 14%,var(--raised))}.pt-d{background:color-mix(in srgb,var(--c1) 12%,var(--raised))}
        .pt[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
        .orbs{display:flex;flex-wrap:wrap;gap:10px 14px}.og{display:grid;justify-items:center;gap:3px}.obx{display:flex}
        .ob{width:30px;height:32px;border:1.5px solid var(--ink);margin-left:-1.5px;display:grid;place-items:center;font-size:1.05rem;font-weight:700;letter-spacing:-2px;color:var(--c1)}.ob:first-child{margin-left:0}
        .ol{font-family:var(--mono);font-size:.78rem;color:var(--muted)}
      </style>
      <div class="panel">
        <h3>Configuration builder</h3>
        <p class="sub">Tap an element (H through Xe). <span style="color:var(--c2)">s-block</span>, <span style="color:var(--c3)">p-block</span>, <span style="color:var(--c1)">d-block</span>.</p>
        <div class="scroll"><div class="ptable" id="pt">${cells}</div></div>
        <div class="row"><button type="button" class="btn" id="ec-prev" aria-label="Previous element">← Z−1</button><button type="button" class="btn" id="ec-next" aria-label="Next element">Z+1 →</button></div>
        <div id="ec-out" style="display:grid;gap:12px"></div>
      </div>
      <div class="panel">
        <h3>Light and energy</h3>
        <p class="sub">Slide the wavelength. Energy per photon rises as wavelength falls.</p>
        ${UI.slider('lt-l', 'Wavelength', 100, 1000, 1, 520)}
        <div style="position:relative;height:26px;border-radius:6px;overflow:hidden;border:1px solid var(--line);background:linear-gradient(90deg,#3d3d4a 0%,#3d3d4a 31%,${[380, 420, 460, 500, 540, 580, 620, 660, 700, 750].map(nm => lambdaColor(nm) + ' ' + ((nm - 100) / 9).toFixed(1) + '%').join(',')},#4a3434 72.5%,#4a3434 100%)">
          <div id="lt-mk" style="position:absolute;top:-2px;bottom:-2px;width:3px;background:var(--ink);box-shadow:0 0 0 1.5px var(--bg)"></div></div>
        <div class="note" style="display:flex;justify-content:space-between"><span>100 nm · UV</span><span>visible 380–750</span><span>IR · 1000 nm</span></div>
        <div id="lt-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function show() {
      const e = ELZ[Z], cfg = Chem.config(Z), g = Chem.group(Z);
      el.querySelectorAll('.pt').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.z === Z)));
      const last = cfg[cfg.length - 1][0];
      $('#ec-out').innerHTML = `<div class="row" style="align-items:baseline;gap:14px"><span class="big-formula">${e.sym}</span><b style="font-size:1.1rem">${e.name}, Z = ${Z}</b></div>
        ${orbitalBoxes(cfg)}
        <div class="callout" style="overflow-x:auto"><div style="white-space:nowrap"><b>Full:</b> ${Chem.configHTML(cfg)}</div><div style="white-space:nowrap"><b>Noble gas:</b> ${Chem.shortHTML(Z)}</div></div>
        ${UI.kv([['Period', Chem.period(Z)], ['Group', g], ['Block', last[1]], ['Valence e⁻', g >= 3 && g <= 12 ? `${Chem.valence(Z)} (outer s)` : Chem.valence(Z)], ['Unpaired e⁻', Chem.unpaired(Z)]])}
        ${Chem.EXC[Z] ? '<div class="callout warn">Exception: one 4s/5s electron moves into d to make a half-filled or filled d sublevel.</div>' : ''}`;
    }
    $('#pt').addEventListener('click', ev => { const b = ev.target.closest('.pt'); if (b) { Z = +b.dataset.z; show(); } });
    $('#ec-prev').addEventListener('click', () => { Z = Math.max(1, Z - 1); show(); });
    $('#ec-next').addEventListener('click', () => { Z = Math.min(54, Z + 1); show(); });
    function light() {
      const nm = +$('#lt-l').value, nu = 2.998e8 / (nm * 1e-9), E = 6.626e-34 * nu;
      $('#lt-l-o').textContent = nm + ' nm';
      $('#lt-mk').style.left = `calc(${(nm - 100) / 9}% - 1.5px)`;
      const vis = nm >= 380 && nm <= 750;
      $('#lt-out').innerHTML = `${UI.kv([['Frequency ν', fmt(nu, 3) + ' s⁻¹'], ['Energy per photon', fmt(E, 3) + ' J'], ['Per mole of photons', fmt(E * NA / 1000, 3) + ' kJ/mol'], ['Region', `<span style="display:inline-block;width:.8em;height:.8em;border-radius:2px;vertical-align:-1px;background:${vis ? lambdaColor(nm) : 'var(--muted)'}"></span> ${colorName(nm)}`]])}`;
    }
    $('#lt-l').addEventListener('input', light);
    show(); light();
  },
  problems: [
    { name: 'Write the configuration', gen() {
      const Z = U.ri(3, 36), e = ELZ[Z], cfg = Chem.config(Z), want = Object.fromEntries(cfg);
      return { kind: 'text', ph: 'e.g. 1s2 2s2 2p3  or  [He] 2s2 2p3', q: `Write the electron configuration for <b>${e.name} (${e.sym}, Z = ${Z})</b>. Separate sublevels with spaces.`,
        answer: Chem.configText(cfg), display: `${Chem.configHTML(cfg)} &nbsp;or&nbsp; ${Chem.shortHTML(Z)}`, hint: 'Separate each sublevel with a space, like 1s2 2s2 2p6.',
        check: r => { const m = Chem.parseConfig(r); if (!m) return null; const k = new Set([...Object.keys(m), ...Object.keys(want)]); for (const o of k) if ((m[o] || 0) !== (want[o] || 0)) return false; return true; },
        explain: `Fill in order 1s 2s 2p 3s 3p 4s 3d 4p until ${Z} electrons are placed: ${Chem.configHTML(cfg)}.${Chem.EXC[Z] ? ' This is one of the exceptions (half-filled/filled d).' : ''}` };
    } },
    { name: 'Valence electrons', gen() {
      const sym = U.pick(MAIN_GROUP.concat(['H', 'He', 'Ne', 'Ar'])), Z = EL[sym].Z, v = Chem.valence(Z), g = Chem.group(Z);
      return { kind: 'num', tol: 0, ph: 'whole number', q: `How many valence electrons does <b>${EL[sym].name}</b> have?`, answer: v,
        explain: `${sym} is in group ${g <= 2 ? g : g - 10}A (${Chem.shortHTML(Z)}). The outermost level holds <b>${v}</b> electrons.` };
    } },
    { name: 'Unpaired electrons', gen() {
      const Z = U.ri(1, 36), e = ELZ[Z], cfg = Chem.config(Z), last = cfg[cfg.length - 1];
      return { kind: 'num', tol: 0, ph: 'whole number', q: `How many <b>unpaired</b> electrons does a ground-state <b>${e.name}</b> atom have?`, answer: Chem.unpaired(Z),
        explain: `Config: ${Chem.shortHTML(Z)}. By Hund's rule, electrons in ${last[0]} occupy separate orbitals before pairing, leaving <b>${Chem.unpaired(Z)}</b> unpaired.` };
    } },
    { name: 'Periodic trends', gen() {
      const prop = U.pick(Object.keys(TREND_SETS)), [data, label] = TREND_SETS[prop];
      for (;;) {
        const a = U.pick(MAIN_GROUP), b = U.pick(MAIN_GROUP);
        if (a === b || data[a] === undefined || data[b] === undefined || data[a] === data[b]) continue;
        const sameG = Chem.group(EL[a].Z) === Chem.group(EL[b].Z), sameP = Chem.period(EL[a].Z) === Chem.period(EL[b].Z);
        if (!sameG && !sameP) continue;
        const win = data[a] > data[b] ? a : b;
        const why = prop === 'radius' ? (sameG ? 'Radius increases down a group (more electron shells).' : 'Radius decreases across a period (more protons pull the same shell closer).')
          : prop === 'ie' ? (sameG ? 'Ionization energy decreases down a group (outer electrons are farther from the nucleus).' : 'Ionization energy generally increases across a period.')
            : (sameG ? 'Electronegativity decreases down a group.' : 'Electronegativity increases across a period toward fluorine.');
        const other = win === a ? b : a, gW = Chem.group(EL[win].Z), gO = Chem.group(EL[other].Z), pW = Chem.period(EL[win].Z), pO = Chem.period(EL[other].Z);
        // does the winner follow the simple trend? radius grows down and to the left; IE and EN grow up and to the right
        const follows = prop === 'radius' ? (sameG ? pW > pO : gW < gO) : (sameG ? pW < pO : gW > gO);
        const exc = !follows && (sameP ? ' This pair is a known exception to the trend (a filled or half-filled sublevel is extra stable).'
          : ' This pair breaks the simple trend: the 10 d-block elements just before it add protons that pull its electrons in more than the extra shell pushes them out.');
        const vals = prop === 'radius' ? `${a} ${data[a]} pm, ${b} ${data[b]} pm` : prop === 'ie' ? `${a} ${data[a]} kJ/mol, ${b} ${data[b]} kJ/mol` : `${a} ${data[a]}, ${b} ${data[b]}`;
        return { ...mc(`${EL[win].name} (${win})`, [`${EL[a].name} (${a})`, `${EL[b].name} (${b})`]), q: `Which has the <b>${label}</b>?`, explain: `${exc ? why.replace('generally ', '').replace(/\.$/, ', in general.') + exc : why} Data: ${vals}.` };
      }
    } },
    { name: 'Light calculations', gen() {
      const nm = U.ri(120, 900), nu = 2.998e8 / (nm * 1e-9), E = 6.626e-34 * nu;
      if (Math.random() < .5) return { kind: 'num', unit: 's⁻¹', q: `What is the frequency of light with a wavelength of <b>${nm} nm</b>?`, answer: nu, explain: `<span class="eqn">ν = c/λ = 3.00×10⁸ m/s ÷ ${nm}×10⁻⁹ m = ${fmt(nu, 3)} s⁻¹</span>` };
      return { kind: 'num', unit: 'J', q: `What is the energy of one photon of <b>${nm} nm</b> light?`, answer: E, explain: `<span class="eqn">E = hc/λ = (6.626×10⁻³⁴)(3.00×10⁸) ÷ ${nm}×10⁻⁹ = ${fmt(E, 3)} J</span>` };
    } },
  ],
});

/* ================= Ch 10: Chemical bonding ================= */
const MOLECULES = [
  ['CH4', 'C', 'HHHH', 0, 0], ['NH3', 'N', 'HHH', 1, 0], ['H2O', 'O', 'HH', 2, 0], ['CO2', 'C', 'OO', 0, 0], ['BF3', 'B', 'FFF', 0, 0], ['SO2', 'S', 'OO', 1, 0],
  ['HCN', 'C', 'H,N', 0, 0], ['CH2O', 'C', 'O,H,H', 0, 0], ['CCl4', 'C', 'Cl,Cl,Cl,Cl', 0, 0], ['PCl3', 'P', 'Cl,Cl,Cl', 1, 0], ['H2S', 'S', 'HH', 2, 0],
  ['CHCl3', 'C', 'H,Cl,Cl,Cl', 0, 0], ['OF2', 'O', 'FF', 2, 0], ['NF3', 'N', 'FFF', 1, 0], ['SO3', 'S', 'OOO', 0, 0], ['BeCl2', 'Be', 'Cl,Cl', 0, 0], ['SiH4', 'Si', 'HHHH', 0, 0],
  ['NH4+', 'N', 'HHHH', 0, 1], ['H3O+', 'O', 'HHH', 1, 1], ['NO3-', 'N', 'OOO', 0, -1], ['CO3^2-', 'C', 'OOO', 0, -2], ['SO4^2-', 'S', 'OOOO', 0, -2], ['ClO3-', 'Cl', 'OOO', 1, -1], ['NO2-', 'N', 'OO', 1, -1],
].map(([f, c, outer, lone, q]) => {
  const atoms = outer.includes(',') ? outer.split(',') : outer.match(/[A-Z][a-z]?/g);
  const groups = atoms.length + lone;
  const eg = ['', '', 'linear', 'trigonal planar', 'tetrahedral'][groups];
  const mg = { '2,0': 'linear', '3,0': 'trigonal planar', '3,1': 'bent', '4,0': 'tetrahedral', '4,1': 'trigonal pyramidal', '4,2': 'bent' }[groups + ',' + lone];
  const ang = { '2,0': '180°', '3,0': '120°', '3,1': '<120° (≈119°)', '4,0': '109.5°', '4,1': '<109.5° (≈107°)', '4,2': '<109.5° (≈104.5°)' }[groups + ',' + lone];
  const symmetric = lone === 0 && atoms.every(a => a === atoms[0]);
  return { f, c, atoms, lone, q, groups, eg, mg, ang, polar: q !== 0 ? null : !symmetric };
});
const valenceOf = sym => sym === 'He' ? 2 : (g => g <= 2 ? g : g - 10)(Chem.group(EL[sym].Z));
function valenceTotal(m) { const c = Chem.parseFormula(m.f); let t = 0; for (const e in c.counts) t += valenceOf(e) * c.counts[e]; return t - c.charge; }
const CPK = { H: '#eef0f2', C: '#454b52', N: '#3a6fe0', O: '#e0453a', F: '#86d65c', Cl: '#3fb950', S: '#e5c22e', P: '#f08a24', B: '#f2a3a3', Si: '#d0b48a', Be: '#b5d334' };
function geomDirs(n) {
  if (n === 2) return [[1, 0, 0], [-1, 0, 0]];
  if (n === 3) return [0, 1, 2].map(i => { const a = i * 2 * Math.PI / 3; return [Math.sin(a), Math.cos(a), 0]; });
  const r = Math.sqrt(8) / 3, y = -1 / 3;
  return [[0, 1, 0], ...[0, 1, 2].map(i => { const a = i * 2 * Math.PI / 3; return [r * Math.cos(a), y, r * Math.sin(a)]; })];
}
const bondType = d => d < 0.4 ? 'Pure covalent' : d <= 2.0 ? 'Polar covalent' : 'Ionic';

registerLab({
  id: 'bonding', ch: 10, sym: 'Bd', fam: 'atom',
  title: 'Bonding & VSEPR', chapter: 'Chemical Bonding',
  blurb: 'Spin 3D molecules to see how electron groups set their shape, and use electronegativity to predict bond type and polarity.',
  ideas: [
    '<b>Lewis structures:</b> count total valence electrons (subtract for + charge, add for − charge), bond the atoms, then complete octets (H gets 2).',
    '<b>VSEPR:</b> electron groups (bonds or lone pairs) around the central atom spread as far apart as possible. A double or triple bond counts as one group.',
    '2 groups → linear 180°. 3 → trigonal planar 120°. 4 → tetrahedral 109.5°.',
    'Lone pairs shape the molecule without being "seen": 4 groups with 1 lone pair = trigonal pyramidal; with 2 lone pairs = bent.',
    '<b>Bond type</b> from ΔEN: under 0.4 pure covalent, 0.4 to 2.0 polar covalent, over 2.0 ionic.',
    'A molecule is <b>polar</b> when it has polar bonds that do not cancel. Symmetric shapes with identical outer atoms (CO₂, CH₄, BF₃) are nonpolar.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>VSEPR viewer</h3>
        <p class="sub">Drag to rotate. Shaded lobes are lone pairs on the central atom.</p>
        <div class="row">${UI.select('vs-m', 'Molecule or ion', MOLECULES.map((m, i) => [i, m.f.replace('^', '')]), 1)}</div>
        <div class="row" style="align-items:flex-start;gap:16px">
          <div class="canvas-wrap" style="flex:1 1 260px;max-width:380px;cursor:grab"><canvas id="vs-c" aria-label="3D model of the selected molecule"></canvas></div>
          <div id="vs-out" style="flex:1 1 220px;display:grid;gap:10px;min-width:0"></div>
        </div>
      </div>
      <div class="panel">
        <h3>Bond type from electronegativity</h3>
        <div class="row">${UI.select('bt-a', 'Atom 1', Object.keys(EN), 'H')}${UI.select('bt-b', 'Atom 2', Object.keys(EN), 'Cl')}</div>
        <div id="bt-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let mol = MOLECULES[1], rotY = 0.6, rotX = -0.35, dragging = false, lastX = 0, lastY = 0, raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = makeCanvas($('#vs-c'), 0.9, draw);
    function proj([x, y, z]) {
      const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
      return [x1, y2, z2];
    }
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      const S = Math.min(w, h) * 0.32, cx = w / 2, cy = h / 2;
      const dirs = geomDirs(mol.groups);
      const items = [{ kind: 'center', p: [0, 0, 0], sym: mol.c }];
      dirs.forEach((d, i) => { if (i < mol.lone) items.push({ kind: 'lone', p: d.map(v => v * 0.62) }); else items.push({ kind: 'atom', p: d, sym: mol.atoms[i - mol.lone] }); });
      const P = items.map(it => ({ ...it, q: proj(it.p) })).sort((a, b) => a.q[2] - b.q[2]);
      const scr = q => { const k = 1 / (1 - q[2] * 0.18); return [cx + q[0] * S * k, cy - q[1] * S * k, k]; };
      for (const it of P) {
        const [X, Y, k] = scr(it.q);
        if (it.kind === 'lone') {
          ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = tok('f-atom');
          ctx.beginPath(); ctx.arc(X, Y, S * 0.24 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          ctx.fillStyle = tok('ink');
          [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(X + s * 5 * k, Y, 3 * k, 0, Math.PI * 2); ctx.fill(); });
          continue;
        }
        if (it.kind === 'atom') {
          const [X0, Y0] = scr(proj([0, 0, 0]));
          ctx.strokeStyle = tok('muted'); ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X, Y); ctx.stroke();
        }
        const r = (it.sym === 'H' ? 0.16 : it.kind === 'center' ? 0.26 : 0.22) * S * k;
        ctx.fillStyle = CPK[it.sym] || '#9aa4ad';
        ctx.strokeStyle = tok('ink'); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const dark = ['C', 'N', 'O', 'Cl'].includes(it.sym);
        ctx.fillStyle = dark ? '#ffffff' : '#111111';
        ctx.font = `700 ${Math.max(10, r * 0.8)}px ${tok('body') || 'sans-serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.sym, X, Y + 1);
      }
    }
    function loop() { if (!dragging && !reduce) rotY += 0.008; cv.redraw(); raf = requestAnimationFrame(loop); }
    const c = $('#vs-c');
    c.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => { if (!dragging) return; rotY += (e.clientX - lastX) * 0.01; rotX = U.clamp(rotX + (e.clientY - lastY) * 0.01, -1.4, 1.4); lastX = e.clientX; lastY = e.clientY; if (reduce) cv.redraw(); });
    c.addEventListener('pointerup', () => { dragging = false; });
    function info() {
      mol = MOLECULES[$('#vs-m').value];
      const cnt = Chem.parseFormula(mol.f);
      const parts = Object.entries(cnt.counts).map(([e, n]) => `${n > 1 ? n + '×' : ''}${e} ${valenceOf(e)}`).join(' + ');
      $('#vs-out').innerHTML = `<span class="big-formula">${fmtF(mol.f)}</span>
        ${UI.kv([['Valence e⁻', `${valenceTotal(mol)}`], ['Electron groups', mol.groups], ['Lone pairs (central)', mol.lone], ['Electron geometry', mol.eg], ['Molecular shape', `<b>${mol.mg}</b>`], ['Bond angle', mol.ang]])}
        <p class="note">Count: ${parts}${cnt.charge ? ` ${cnt.charge > 0 ? '−' : '+'} ${Math.abs(cnt.charge)} for the charge` : ''} = ${valenceTotal(mol)}.</p>
        ${mol.polar === null ? '<div class="callout">Ions carry a net charge, so polarity is not usually asked for them.</div>' : `<div class="callout ${mol.polar ? 'warn' : 'good'}"><b>${mol.polar ? 'Polar' : 'Nonpolar'}</b>: ${mol.polar ? (mol.lone ? 'lone pairs make the shape lopsided, so bond dipoles do not cancel.' : 'the outer atoms differ, so bond dipoles do not cancel.') : 'identical bonds in a symmetric shape cancel out.'}</div>`}`;
      cv.redraw();
    }
    function bt() {
      const a = $('#bt-a').value, b = $('#bt-b').value, d = Math.abs(EN[a] - EN[b]), type = bondType(d);
      const pct = Math.min(100, d / 3.3 * 100);
      $('#bt-out').innerHTML = `<div style="position:relative;height:30px;border-radius:6px;overflow:hidden;display:flex;border:1px solid var(--line);font-size:.74rem;font-weight:700">
          <div style="width:${0.4 / 3.3 * 100}%;background:color-mix(in srgb,var(--c3) 22%,var(--raised));display:grid;place-items:center"></div>
          <div style="width:${1.6 / 3.3 * 100}%;background:color-mix(in srgb,var(--c1) 18%,var(--raised));display:grid;place-items:center">polar covalent</div>
          <div style="flex:1;background:color-mix(in srgb,var(--c2) 20%,var(--raised));display:grid;place-items:center">ionic</div>
          <div style="position:absolute;top:0;bottom:0;left:calc(${pct}% - 1.5px);width:3px;background:var(--ink)"></div></div>
        <div class="note" style="display:flex;justify-content:space-between"><span>0</span><span>0.4</span><span>2.0</span><span>3.3</span></div>
        ${UI.kv([[`EN ${a}`, EN[a]], [`EN ${b}`, EN[b]], ['ΔEN', d.toFixed(2)], ['Bond', `<b>${type}</b>`]])}
        ${type === 'Polar covalent' ? `<p class="note">The electrons sit closer to ${EN[a] > EN[b] ? a : b}, which carries a partial negative charge (δ−).</p>` : ''}`;
    }
    $('#vs-m').addEventListener('change', info); $('#bt-a').addEventListener('change', bt); $('#bt-b').addEventListener('change', bt);
    info(); bt(); loop();
    return () => { cancelAnimationFrame(raf); cv.stop(); };
  },
  problems: [
    { name: 'Count valence electrons', gen() {
      const m = U.pick(MOLECULES), c = Chem.parseFormula(m.f);
      return { kind: 'num', tol: 0, ph: 'whole number', q: `How many total valence electrons are in the Lewis structure of <b style="font-size:1.2em">${fmtF(m.f)}</b>?`, answer: valenceTotal(m),
        explain: Object.entries(c.counts).map(([e, n]) => `${n} ${e} × ${valenceOf(e)}`).join(' + ') + (c.charge ? ` ${c.charge > 0 ? '−' : '+'} ${Math.abs(c.charge)} (charge)` : '') + ` = <b>${valenceTotal(m)}</b>` };
    } },
    { name: 'Molecular shape', gen() {
      const m = U.pick(MOLECULES);
      return { ...mc(m.mg, ['linear', 'trigonal planar', 'bent', 'tetrahedral', 'trigonal pyramidal']), q: `What is the molecular geometry of <b style="font-size:1.2em">${fmtF(m.f)}</b>?`,
        explain: `The central ${m.c} has ${m.groups} electron groups (${m.atoms.length} bonded atom${m.atoms.length > 1 ? 's' : ''}, ${m.lone} lone pair${m.lone === 1 ? '' : 's'}). Electron geometry: ${m.eg}. Shape: <b>${m.mg}</b>, ${m.ang}.` };
    } },
    { name: 'Bond type', gen() {
      for (;;) {
        const keys = Object.keys(EN), a = U.pick(keys), b = U.pick(keys);
        // metal–metal pairs form metallic bonds, which this ΔEN scale does not describe: keep at least one nonmetal
        const NONMETAL = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Se', 'Br', 'I'];
        if (!NONMETAL.includes(a) && !NONMETAL.includes(b)) continue;
        if (a === b && (Math.random() < .7 || !NONMETAL.includes(a))) continue;
        const d = Math.abs(EN[a] - EN[b]);
        if (Math.abs(d - 0.4) < 0.08 || Math.abs(d - 2.0) < 0.12) continue;
        const t = bondType(d);
        return { ...mc(t, ['Pure covalent', 'Polar covalent', 'Ionic']), q: `What kind of bond forms between <b>${a}</b> and <b>${b}</b>?`, explain: `ΔEN = |${EN[a]} − ${EN[b]}| = ${d.toFixed(2)}. ${t === 'Pure covalent' ? 'Under 0.4' : t === 'Ionic' ? 'Over 2.0' : 'Between 0.4 and 2.0'} → <b>${t.toLowerCase()}</b>.` };
      }
    } },
    { name: 'Polar or nonpolar', gen() {
      const m = U.pick(MOLECULES.filter(x => x.polar !== null));
      return { ...mc(m.polar ? 'Polar' : 'Nonpolar', ['Polar', 'Nonpolar']), q: `Is <b style="font-size:1.2em">${fmtF(m.f)}</b> a polar or nonpolar molecule?`,
        explain: `Shape: ${m.mg}. ${m.polar ? (m.lone ? 'Lone pairs make it asymmetric, so the bond dipoles add up to a net dipole.' : 'The outer atoms are different, so the dipoles do not cancel.') : 'All outer atoms are the same and arranged symmetrically, so the bond dipoles cancel.'}` };
    } },
  ],
});
