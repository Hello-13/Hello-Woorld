'use strict';
/* Reactions: Ch 7 Chemical Reactions, Ch 8 Quantities in Chemical Reactions, Ch 15 Chemical Equilibrium, Ch 16 Oxidation and Reduction */

/* ---------- Balancing ---------- */
const REACTIONS = [
  ['H2 + O2 -> H2O', 'Synthesis', true], ['N2 + H2 -> NH3', 'Synthesis'], ['Na + Cl2 -> NaCl', 'Synthesis'], ['Al + Cl2 -> AlCl3', 'Synthesis'], ['CaO + H2O -> Ca(OH)2', 'Synthesis'],
  ['Mg + O2 -> MgO', 'Synthesis', true], ['Fe + O2 -> Fe2O3', 'Synthesis', true], ['Al + O2 -> Al2O3', 'Synthesis', true], ['P4 + O2 -> P4O10', 'Synthesis', true], ['H2 + Cl2 -> HCl', 'Synthesis'],
  ['KClO3 -> KCl + O2', 'Decomposition'], ['H2O2 -> H2O + O2', 'Decomposition'], ['CaCO3 -> CaO + CO2', 'Decomposition'], ['H2O -> H2 + O2', 'Decomposition'], ['NaN3 -> Na + N2', 'Decomposition'],
  ['Zn + HCl -> ZnCl2 + H2', 'Single displacement'], ['Al + HCl -> AlCl3 + H2', 'Single displacement'], ['Cu + AgNO3 -> Cu(NO3)2 + Ag', 'Single displacement'], ['Fe + CuSO4 -> FeSO4 + Cu', 'Single displacement'], ['Na + H2O -> NaOH + H2', 'Single displacement'], ['Cl2 + KBr -> KCl + Br2', 'Single displacement'],
  ['AgNO3 + NaCl -> AgCl + NaNO3', 'Double displacement'], ['Pb(NO3)2 + KI -> PbI2 + KNO3', 'Double displacement'], ['BaCl2 + Na2SO4 -> BaSO4 + NaCl', 'Double displacement'], ['HCl + NaOH -> NaCl + H2O', 'Double displacement'], ['H2SO4 + NaOH -> Na2SO4 + H2O', 'Double displacement'], ['Na2CO3 + HCl -> NaCl + H2O + CO2', 'Double displacement', true],
  ['CH4 + O2 -> CO2 + H2O', 'Combustion'], ['C3H8 + O2 -> CO2 + H2O', 'Combustion'], ['C2H6 + O2 -> CO2 + H2O', 'Combustion'], ['C6H12O6 + O2 -> CO2 + H2O', 'Combustion'], ['C2H5OH + O2 -> CO2 + H2O', 'Combustion'], ['C8H18 + O2 -> CO2 + H2O', 'Combustion'],
].map(([eq, type, ambiguous]) => { const [l, r] = eq.split(' -> '); return { re: l.split(' + '), pr: r.split(' + '), type, ambiguous: !!ambiguous }; });
const RX_TYPE_WHY = {
  'Synthesis': 'A + B → AB: simpler substances combine into one product.',
  'Decomposition': 'AB → A + B: one reactant breaks apart.',
  'Single displacement': 'A + BC → AC + B: an element replaces another in a compound.',
  'Double displacement': 'AB + CD → AD + CB: the cations and anions trade partners.',
  'Combustion': 'A fuel reacts with O₂, giving CO₂ and H₂O for compounds of C and H (and O).',
};
function atomTally(rx, co) {
  const L = {}, R = {};
  rx.re.forEach((f, i) => { const c = Chem.parseFormula(f).counts; for (const e in c) L[e] = (L[e] || 0) + c[e] * co[i]; });
  rx.pr.forEach((f, i) => { const c = Chem.parseFormula(f).counts; for (const e in c) R[e] = (R[e] || 0) + c[e] * co[i + rx.re.length]; });
  return { L, R, els: Object.keys(L), ok: Object.keys(L).every(e => L[e] === R[e]) && Object.keys(R).every(e => L[e] === R[e]) };
}
/* Smallest whole-number coefficients: null space of the element × species matrix by Gaussian elimination */
function solveBalance(rx) {
  if (rx.sol) return rx.sol;
  const sp = rx.re.concat(rx.pr), parsed = sp.map(f => Chem.parseFormula(f).counts);
  const els = [...new Set(parsed.flatMap(c => Object.keys(c)))], n = sp.length;
  const A = els.map(e => parsed.map((c, j) => (c[e] || 0) * (j < rx.re.length ? 1 : -1)));
  const pivots = []; let r = 0;
  for (let c = 0; c < n && r < A.length; c++) {
    let best = r; for (let i = r; i < A.length; i++) if (Math.abs(A[i][c]) > Math.abs(A[best][c])) best = i;
    if (Math.abs(A[best][c]) < 1e-9) continue;
    [A[r], A[best]] = [A[best], A[r]];
    const pv = A[r][c]; A[r] = A[r].map(v => v / pv);
    for (let i = 0; i < A.length; i++) if (i !== r && A[i][c]) { const f = A[i][c]; A[i] = A[i].map((v, k) => v - f * A[r][k]); }
    pivots.push(c); r++;
  }
  const free = [...Array(n).keys()].find(c => !pivots.includes(c));
  const x = new Array(n).fill(0); x[free] = 1;
  pivots.forEach((c, i) => { x[c] = -A[i][free]; });
  for (let k = 1; k <= 1000; k++) {
    const y = x.map(v => v * k);
    if (y.every(v => Math.abs(v - Math.round(v)) < 1e-6)) { rx.sol = y.map(v => Math.abs(Math.round(v))); break; }
  }
  return rx.sol;
}

/* ---------- Solubility ---------- */
const SOL_CATIONS = [['Li', 1, 'Li'], ['Na', 1, 'Na'], ['K', 1, 'K'], ['NH4', 1, 'NH4'], ['Ag', 1, 'Ag'], ['Pb', 2, 'Pb'], ['Ba', 2, 'Ba'], ['Ca', 2, 'Ca'], ['Sr', 2, 'Sr'], ['Mg', 2, 'Mg'], ['Zn', 2, 'Zn'], ['Cu', 2, 'Cu'], ['Fe', 3, 'Fe'], ['Al', 3, 'Al']].map(([f, q]) => ({ f, q, poly: f === 'NH4' }));
const SOL_ANIONS = [['Cl', -1], ['Br', -1], ['I', -1], ['NO3', -1], ['C2H3O2', -1], ['SO4', -2], ['OH', -1], ['S', -2], ['CO3', -2], ['PO4', -3]].map(([f, q]) => ({ f, q, poly: f.length > 2 || /\d/.test(f) }));
function solubility(c, a) {
  const alk = ['Li', 'Na', 'K', 'NH4'];
  if (['NO3', 'C2H3O2'].includes(a.f)) return [true, 'Nitrates and acetates are always soluble.'];
  if (alk.includes(c.f)) return [true, 'Compounds of Li⁺, Na⁺, K⁺ and NH₄⁺ are soluble.'];
  if (['Cl', 'Br', 'I'].includes(a.f)) return ['Ag', 'Pb'].includes(c.f) ? [false, 'Chlorides, bromides and iodides are soluble except with Ag⁺, Hg₂²⁺ and Pb²⁺.'] : [true, 'Chlorides, bromides and iodides are soluble except with Ag⁺, Hg₂²⁺ and Pb²⁺.'];
  if (a.f === 'SO4') return ['Sr', 'Ba', 'Pb', 'Ag', 'Ca'].includes(c.f) ? [false, 'Sulfates are soluble except with Sr²⁺, Ba²⁺, Pb²⁺, Ag⁺ and Ca²⁺.'] : [true, 'Sulfates are soluble except with Sr²⁺, Ba²⁺, Pb²⁺, Ag⁺ and Ca²⁺.'];
  if (a.f === 'S') return ['Ca', 'Sr', 'Ba'].includes(c.f) ? [true, 'Sulfides are insoluble except with Li⁺, Na⁺, K⁺, NH₄⁺, Ca²⁺, Sr²⁺ and Ba²⁺.'] : [false, 'Sulfides are insoluble except with Li⁺, Na⁺, K⁺, NH₄⁺, Ca²⁺, Sr²⁺ and Ba²⁺.'];
  if (a.f === 'OH') return [false, `Hydroxides are insoluble except with Li⁺, Na⁺, K⁺ and NH₄⁺${['Ca', 'Sr', 'Ba'].includes(c.f) ? ' (Ca²⁺, Sr²⁺ and Ba²⁺ hydroxides are slightly soluble)' : ''}.`];
  return [false, 'Carbonates and phosphates are insoluble except with Li⁺, Na⁺, K⁺ and NH₄⁺.'];
}
const solFormula = (c, a) => ionic({ ...c, name: '' }, { ...a, name: '' }).formula;

registerLab({
  id: 'reactions', ch: 7, sym: 'Rx', fam: 'rx',
  title: 'Balancing & Reaction Types', chapter: 'Chemical Reactions',
  blurb: 'Balance equations with live atom counts, sort reactions by type, and predict precipitates from the solubility rules.',
  ideas: [
    'Signs of a chemical reaction: color change, gas bubbles, a solid forming, heat or light.',
    '<b>Balancing:</b> change only coefficients, never subscripts. Balance elements that appear once on each side first; save H and O (or free elements) for last.',
    'Use the lowest whole-number coefficients. 4 H₂ + 2 O₂ → 4 H₂O is balanced but should be 2 H₂ + O₂ → 2 H₂O.',
    'Types: <b>synthesis</b> A + B → AB, <b>decomposition</b> AB → A + B, <b>single displacement</b> A + BC → AC + B, <b>double displacement</b> AB + CD → AD + CB, <b>combustion</b> fuel + O₂ → CO₂ + H₂O.',
    '<b>Solubility rules:</b> Li⁺, Na⁺, K⁺, NH₄⁺, NO₃⁻ and C₂H₃O₂⁻ compounds always dissolve. Cl⁻/Br⁻/I⁻ dissolve except with Ag⁺, Pb²⁺, Hg₂²⁺. SO₄²⁻ dissolves except with Sr²⁺, Ba²⁺, Pb²⁺, Ag⁺, Ca²⁺. OH⁻, S²⁻, CO₃²⁻, PO₄³⁻ are mostly insoluble.',
    'A <b>precipitate</b> forms when a double displacement makes an insoluble product.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Equation balancer</h3>
        <p class="sub">Adjust coefficients until every element matches on both sides.</p>
        <div class="row">${UI.select('bl-r', 'Reaction', REACTIONS.map((r, i) => [i, `${r.re.join(' + ')} → ${r.pr.join(' + ')}`]), 27)}</div>
        <div id="bl-eq" class="scroll"></div>
        <div id="bl-tally"></div>
        <div class="btn-row"><button type="button" class="btn" id="bl-reset">Reset to 1s</button><button type="button" class="btn ghost" id="bl-show">Show balanced</button></div>
      </div>
      <div class="panel">
        <h3>Solubility check</h3>
        <p class="sub">Will this ionic compound dissolve in water?</p>
        <div class="row">${UI.select('sl-c', 'Cation', SOL_CATIONS.map((c, i) => [i, c.f + chargeStr(c.q)]), 4)}${UI.select('sl-a', 'Anion', SOL_ANIONS.map((a, i) => [i, a.f + chargeStr(a.q)]), 0)}</div>
        <div id="sl-out" class="row" style="align-items:center;gap:18px"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let rx, co;
    function pickRx() { rx = REACTIONS[$('#bl-r').value]; co = new Array(rx.re.length + rx.pr.length).fill(1); render(); }
    function render() {
      const sp = (f, i) => `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;margin:0 2px">
        <span class="stepbox"><button type="button" data-step="${i}" data-d="-1" aria-label="Lower coefficient of ${f}">−</button><output>${co[i]}</output><button type="button" data-step="${i}" data-d="1" aria-label="Raise coefficient of ${f}">+</button></span>
        <span style="font-size:1.3rem;font-weight:700">${fmtF(f)}</span></span>`;
      const L = rx.re.map((f, i) => sp(f, i)).join('<span style="font-size:1.3rem;align-self:flex-end">+</span>');
      const R = rx.pr.map((f, i) => sp(f, i + rx.re.length)).join('<span style="font-size:1.3rem;align-self:flex-end">+</span>');
      $('#bl-eq').innerHTML = `<div style="display:flex;align-items:flex-end;gap:6px;min-width:max-content;padding:4px 0">${L}<span style="font-size:1.5rem;padding:0 6px">→</span>${R}</div>`;
      const t = atomTally(rx, co), g = co.reduce(U.gcd);
      $('#bl-tally').innerHTML = `<div class="scroll"><table class="t"><tr><th>Element</th><th class="n">Reactants</th><th class="n">Products</th><th></th></tr>
        ${t.els.map(e => `<tr><td>${e}</td><td class="n">${t.L[e]}</td><td class="n">${t.R[e] || 0}</td><td>${t.L[e] === t.R[e] ? '<span class="pill good">match</span>' : '<span class="pill bad">off</span>'}</td></tr>`).join('')}</table></div>
        <div class="callout ${t.ok && g === 1 ? 'good' : t.ok ? 'warn' : ''}" style="margin-top:10px">${t.ok ? (g === 1 ? `<b>Balanced.</b> ${fmtEq(rx.re, rx.pr, co)} &nbsp;·&nbsp; ${rx.type}` : `Balanced, but every coefficient divides by ${g}. Reduce to the lowest whole numbers.`) : 'Not balanced yet. Find an element that is off and adjust the coefficient of a substance containing it.'}</div>`;
    }
    wireSteppers($('#bl-eq'), (i, d) => { co[i] = U.clamp(co[i] + d, 1, 20); render(); });
    $('#bl-r').addEventListener('change', pickRx);
    $('#bl-reset').addEventListener('click', () => { co.fill(1); render(); });
    $('#bl-show').addEventListener('click', () => { co = solveBalance(rx).slice(); render(); });
    function sol() {
      const c = SOL_CATIONS[$('#sl-c').value], a = SOL_ANIONS[$('#sl-a').value], [ok, rule] = solubility(c, a), f = solFormula(c, a);
      $('#sl-out').innerHTML = `<svg viewBox="0 0 80 96" width="80" height="96" aria-hidden="true" style="flex:none">
          <path d="M10 8 L10 84 Q10 92 18 92 L62 92 Q70 92 70 84 L70 8" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
          <rect x="12" y="30" width="56" height="60" rx="5" fill="var(--c1)" opacity=".18"/>
          ${ok ? '' : Array.from({ length: 22 }, (_, i) => `<circle cx="${16 + (i * 37) % 48}" cy="${80 + (i * 13) % 9}" r="2.6" fill="var(--ink)" opacity=".75"/>`).join('')}</svg>
        <div style="display:grid;gap:6px;min-width:0;flex:1 1 200px"><span class="big-formula">${fmtF(f)}</span>
        <span class="pill ${ok ? 'good' : 'bad'}" style="justify-self:start">${ok ? 'Soluble: dissolves into ions' : 'Insoluble: forms a precipitate'}</span><p class="note">${rule}</p></div>`;
    }
    $('#sl-c').addEventListener('change', sol); $('#sl-a').addEventListener('change', sol);
    pickRx(); sol();
  },
  problems: [
    { name: 'Balance it', gen() {
      const rx = U.pick(REACTIONS), sol = solveBalance(rx), n = sol.length;
      return { kind: 'text', ph: `${n} coefficients, e.g. ${sol.map(() => 1).join(', ')}`, q: `Balance this equation. Enter all ${n} coefficients in order, separated by commas (write 1 where needed).<span class="eqline">${fmtEq(rx.re, rx.pr)}</span>`,
        answer: sol.join(', '), display: fmtEq(rx.re, rx.pr, sol), hint: `Enter ${n} whole numbers separated by commas.`,
        check: r => {
          const nums = r.split(/[,\s]+/).filter(Boolean).map(Number);
          if (nums.length !== n || nums.some(x => !Number.isInteger(x) || x < 1)) return null;
          return atomTally(rx, nums).ok && nums.reduce(U.gcd) === 1;
        },
        explain: `Balanced: ${fmtEq(rx.re, rx.pr, sol)}. Check: ${Object.entries(atomTally(rx, sol).L).map(([e, v]) => `${v} ${e}`).join(', ')} on each side.` };
    } },
    { name: 'Reaction type', gen() {
      const rx = U.pick(REACTIONS.filter(r => !r.ambiguous)), sol = solveBalance(rx);
      return { ...mc(rx.type, Object.keys(RX_TYPE_WHY)), q: `Classify this reaction:<span class="eqline">${fmtEq(rx.re, rx.pr, sol)}</span>`, explain: RX_TYPE_WHY[rx.type] };
    } },
    { name: 'Soluble or not', gen() {
      const c = U.pick(SOL_CATIONS), a = U.pick(SOL_ANIONS), [ok, rule] = solubility(c, a);
      return { ...mc(ok ? 'Soluble' : 'Insoluble', ['Soluble', 'Insoluble']), q: `Is <b style="font-size:1.2em">${fmtF(solFormula(c, a))}</b> soluble in water?`, explain: rule };
    } },
    { name: 'Predict the precipitate', gen() {
      for (;;) {
        const c1 = U.pick(SOL_CATIONS), c2 = U.pick(SOL_CATIONS), a1 = U.pick(SOL_ANIONS), a2 = U.pick(SOL_ANIONS);
        if (c1.f === c2.f || a1.f === a2.f || !solubility(c1, a1)[0] || !solubility(c2, a2)[0]) continue;
        const p1 = [c1, a2], p2 = [c2, a1], s1 = solubility(...p1), s2 = solubility(...p2);
        if (!s1[0] && !s2[0]) continue;
        const f1 = solFormula(...p1), f2 = solFormula(...p2);
        const ans = !s1[0] ? fmtF(f1) : !s2[0] ? fmtF(f2) : 'No precipitate';
        return { ...mc(ans, [fmtF(f1), fmtF(f2), 'No precipitate']), q: `Solutions of <b>${fmtF(solFormula(c1, a1))}</b> and <b>${fmtF(solFormula(c2, a2))}</b> are mixed. Which precipitate forms, if any?`,
          explain: `Swap partners: ${fmtF(f1)} and ${fmtF(f2)}. ${fmtF(f1)}: ${s1[0] ? 'soluble' : 'insoluble'}. ${fmtF(f2)}: ${s2[0] ? 'soluble' : 'insoluble'}. ${(!s1[0] ? s1 : !s2[0] ? s2 : s1)[1]}` };
      }
    } },
  ],
});

/* ---------- Stoichiometry ---------- */
const STOICH = [
  [['H2', 2], ['O2', 1], [['H2O', 2]]], [['N2', 1], ['H2', 3], [['NH3', 2]]], [['Fe', 4], ['O2', 3], [['Fe2O3', 2]]], [['Al', 2], ['Cl2', 3], [['AlCl3', 2]]],
  [['CH4', 1], ['O2', 2], [['CO2', 1], ['H2O', 2]]], [['Na', 2], ['Cl2', 1], [['NaCl', 2]]], [['C3H8', 1], ['O2', 5], [['CO2', 3], ['H2O', 4]]], [['Mg', 2], ['O2', 1], [['MgO', 2]]],
].map(([a, b, pr]) => ({ a, b, pr, eq: fmtEq([a[0], b[0]], pr.map(p => p[0]), [a[1], b[1], ...pr.map(p => p[1])]) }));

registerLab({
  id: 'stoichiometry', ch: 8, sym: 'St', fam: 'rx',
  title: 'Stoichiometry & Limiting Reactants', chapter: 'Quantities in Chemical Reactions',
  blurb: 'Load reactants onto the scale, see which one runs out first, and calculate theoretical and percent yield.',
  ideas: [
    'Coefficients are <b>mole ratios</b>. In 2 H₂ + O₂ → 2 H₂O, 2 mol H₂ react with 1 mol O₂ to make 2 mol H₂O.',
    'The road map: <span class="eqn">grams A → mol A → mol B → grams B</span>, using molar mass, then the mole ratio, then molar mass again.',
    'The <b>limiting reactant</b> is the one that makes the <i>least</i> product. Calculate product from each reactant; the smaller answer wins.',
    'The other reactant is <b>in excess</b>. Some of it is left over when the reaction stops.',
    '<b>Theoretical yield</b> is the most product possible (from the limiting reactant). <span class="eqn">% yield = actual ÷ theoretical × 100%</span>.',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Limiting reactant scale</h3>
        <div class="row">${UI.select('st-r', 'Reaction', STOICH.map((r, i) => [i, r.eq.replace(/<[^>]+>/g, '')]), 0)}${UI.select('st-p', 'Product to make', [], 0)}</div>
        <div id="st-eq" class="callout" style="font-size:1.1rem;overflow-x:auto"></div>
        ${UI.slider('st-ga', 'Reactant A', 1, 100, 0.5, 10)}
        ${UI.slider('st-gb', 'Reactant B', 1, 100, 0.5, 40)}
        <div id="st-out" style="display:grid;gap:12px"></div>
        <div class="row">${UI.num('st-act', 'Actual yield you collected', '30.0', 'g')}</div>
        <div id="st-py"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let theo = 0;
    function setRx() {
      const r = STOICH[$('#st-r').value];
      $('#st-p').innerHTML = r.pr.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
      $('#st-eq').innerHTML = r.eq;
      calc();
    }
    function calc() {
      const r = STOICH[$('#st-r').value], prod = r.pr[$('#st-p').value || 0];
      const ga = +$('#st-ga').value, gb = +$('#st-gb').value;
      $('#st-ga-o').textContent = ga + ' g ' + r.a[0]; $('#st-gb-o').textContent = gb + ' g ' + r.b[0];
      const Ma = Chem.molarMass(r.a[0]), Mb = Chem.molarMass(r.b[0]), Mp = Chem.molarMass(prod[0]);
      const na = ga / Ma, nb = gb / Mb, fromA = na * prod[1] / r.a[1], fromB = nb * prod[1] / r.b[1];
      const limA = fromA <= fromB, nP = Math.min(fromA, fromB);
      theo = nP * Mp;
      const usedOther = limA ? na * r.b[1] / r.a[1] : nb * r.a[1] / r.b[1];
      const left = limA ? (nb - usedOther) * Mb : (na - usedOther) * Ma;
      const mx = Math.max(fromA, fromB);
      const bar = (lbl, v, lim) => `<div style="display:grid;grid-template-columns:minmax(90px,auto) 1fr auto;gap:10px;align-items:center"><span>${lbl}</span><div style="height:14px;border-radius:4px;background:color-mix(in srgb,var(--line) 60%,transparent);overflow:hidden"><div style="height:100%;width:${v / mx * 100}%;background:${lim ? 'var(--c2)' : 'var(--c1)'}"></div></div><span style="font-family:var(--mono);font-size:.88rem">${fmt(v, 3)} mol</span></div>`;
      $('#st-out').innerHTML = `<div class="scroll"><table class="t"><tr><th></th><th class="n">g</th><th class="n">g/mol</th><th class="n">mol</th><th class="n">mol ${fmtF(prod[0])} possible</th></tr>
        <tr class="${limA ? 'hl' : ''}"><td>${fmtF(r.a[0])}</td><td class="n">${ga}</td><td class="n">${Ma.toFixed(2)}</td><td class="n">${fmt(na, 3)}</td><td class="n">${fmt(fromA, 3)}</td></tr>
        <tr class="${!limA ? 'hl' : ''}"><td>${fmtF(r.b[0])}</td><td class="n">${gb}</td><td class="n">${Mb.toFixed(2)}</td><td class="n">${fmt(nb, 3)}</td><td class="n">${fmt(fromB, 3)}</td></tr></table></div>
        <div style="display:grid;gap:6px">${bar(`from ${fmtF(r.a[0])}`, fromA, limA)}${bar(`from ${fmtF(r.b[0])}`, fromB, !limA)}</div>
        ${UI.kv([['Limiting reactant', `<b>${fmtF(limA ? r.a[0] : r.b[0])}</b>`], ['Theoretical yield', `${fmt(theo, 3)} g ${fmtF(prod[0])}`], ['Excess left over', `${fmt(Math.max(0, left), 3)} g ${fmtF(limA ? r.b[0] : r.a[0])}`]])}`;
      py();
    }
    function py() {
      const a = parseNum($('#st-act').value);
      if (a === null) { $('#st-py').innerHTML = ''; return; }
      const pct = a / theo * 100;
      $('#st-py').innerHTML = `<div class="callout ${pct > 100 ? 'bad' : ''}">Percent yield = ${fmt(a, 3)} ÷ ${fmt(theo, 3)} × 100% = <b>${fmt(pct, 3)}%</b>${pct > 100 ? '. Over 100% is impossible; the product is probably still wet or impure.' : ''}</div>`;
    }
    $('#st-r').addEventListener('change', setRx); $('#st-p').addEventListener('change', calc);
    $('#st-ga').addEventListener('input', calc); $('#st-gb').addEventListener('input', calc); $('#st-act').addEventListener('input', py);
    setRx();
  },
  problems: [
    { name: 'Mole to mole', gen() {
      const r = U.pick(STOICH), from = U.pick([r.a, r.b]), to = U.pick(r.pr), n = U.sf(0.2, 12, 3), ans = n * to[1] / from[1];
      return { kind: 'num', unit: `mol ${fmtF(to[0])}`, q: `<span class="eqline">${r.eq}</span>How many moles of ${fmtF(to[0])} form from <b>${n} mol ${fmtF(from[0])}</b> (other reactant in excess)?`, answer: ans,
        explain: `<span class="eqn">${n} mol ${fmtF(from[0])} × (${to[1]} mol ${fmtF(to[0])} / ${from[1]} mol ${fmtF(from[0])}) = ${fmt(ans, 3)} mol</span>` };
    } },
    { name: 'Grams to grams', gen() {
      const r = U.pick(STOICH), from = U.pick([r.a, r.b]), to = U.pick(r.pr), g = U.sf(2, 80, 3);
      const Mf = Chem.molarMass(from[0]), Mt = Chem.molarMass(to[0]), ans = g / Mf * to[1] / from[1] * Mt;
      return { kind: 'num', unit: `g ${fmtF(to[0])}`, q: `<span class="eqline">${r.eq}</span>What mass of ${fmtF(to[0])} forms from <b>${g} g ${fmtF(from[0])}</b> (other reactant in excess)?`, answer: ans,
        explain: `<span class="eqn">${g} g ÷ ${Mf.toFixed(2)} × ${to[1]}/${from[1]} × ${Mt.toFixed(2)} = ${fmt(ans, 3)} g</span>` };
    } },
    { name: 'Limiting reactant', gen() {
      const r = U.pick(STOICH), ga = U.sf(2, 60, 3), gb = U.sf(2, 60, 3), p = r.pr[0];
      const fa = ga / Chem.molarMass(r.a[0]) / r.a[1], fb = gb / Chem.molarMass(r.b[0]) / r.b[1];
      if (Math.abs(fa - fb) / Math.max(fa, fb) < 0.05) return this.gen();
      const lim = fa < fb ? r.a[0] : r.b[0];
      return { ...mc(fmtF(lim), [fmtF(r.a[0]), fmtF(r.b[0])]), q: `<span class="eqline">${r.eq}</span>You mix <b>${ga} g ${fmtF(r.a[0])}</b> with <b>${gb} g ${fmtF(r.b[0])}</b>. Which is the limiting reactant?`,
        explain: `mol ${fmtF(p[0])} possible: from ${fmtF(r.a[0])} ${fmt(fa * p[1], 3)}, from ${fmtF(r.b[0])} ${fmt(fb * p[1], 3)}. The smaller amount comes from <b>${fmtF(lim)}</b>.` };
    } },
    { name: 'Theoretical yield', gen() {
      const r = U.pick(STOICH), ga = U.sf(2, 60, 3), gb = U.sf(2, 60, 3), p = r.pr[0], Mp = Chem.molarMass(p[0]);
      const fa = ga / Chem.molarMass(r.a[0]) * p[1] / r.a[1], fb = gb / Chem.molarMass(r.b[0]) * p[1] / r.b[1], ans = Math.min(fa, fb) * Mp;
      return { kind: 'num', unit: `g ${fmtF(p[0])}`, q: `<span class="eqline">${r.eq}</span>What is the theoretical yield of ${fmtF(p[0])} from <b>${ga} g ${fmtF(r.a[0])}</b> and <b>${gb} g ${fmtF(r.b[0])}</b>?`, answer: ans,
        explain: `Product from ${fmtF(r.a[0])}: ${fmt(fa, 3)} mol; from ${fmtF(r.b[0])}: ${fmt(fb, 3)} mol. Limiting gives ${fmt(Math.min(fa, fb), 3)} mol × ${Mp.toFixed(2)} g/mol = <b>${fmt(ans, 3)} g</b>.` };
    } },
    { name: 'Percent yield', gen() {
      const theo = U.sf(10, 120, 3), act = U.sf(theo * 0.5, theo * 0.98, 3);
      return { kind: 'num', unit: '%', q: `A reaction has a theoretical yield of <b>${theo} g</b>. You collect <b>${act} g</b>. What is the percent yield?`, answer: act / theo * 100,
        explain: `<span class="eqn">${act} ÷ ${theo} × 100% = ${fmt(act / theo * 100, 3)}%</span>` };
    } },
  ],
});

/* ---------- Equilibrium ---------- */
const EQ_RX = [
  { re: [['N2', 1, 'g'], ['H2', 3, 'g']], pr: [['NH3', 2, 'g']], dH: -92 },
  { re: [['SO2', 2, 'g'], ['O2', 1, 'g']], pr: [['SO3', 2, 'g']], dH: -198 },
  { re: [['N2O4', 1, 'g']], pr: [['NO2', 2, 'g']], dH: 57 },
  { re: [['H2', 1, 'g'], ['I2', 1, 'g']], pr: [['HI', 2, 'g']], dH: -9 },
  { re: [['CaCO3', 1, 's']], pr: [['CaO', 1, 's'], ['CO2', 1, 'g']], dH: 178 },
  { re: [['PCl5', 1, 'g']], pr: [['PCl3', 1, 'g'], ['Cl2', 1, 'g']], dH: 88 },
  { re: [['CO', 1, 'g'], ['H2O', 1, 'g']], pr: [['CO2', 1, 'g'], ['H2', 1, 'g']], dH: -41 },
];
const eqTxt = rx => `${rx.re.map(([f, c, s]) => `${c > 1 ? c + ' ' : ''}${fmtF(f)}(${s})`).join(' + ')} ⇌ ${rx.pr.map(([f, c, s]) => `${c > 1 ? c + ' ' : ''}${fmtF(f)}(${s})`).join(' + ')}`;
const term = ([f, c], exp = true) => `[${fmtF(f)}]${exp && c > 1 ? `<sup>${c}</sup>` : ''}`;
const frac = (n, d) => `<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.5"><span style="border-bottom:1.5px solid currentColor;padding:0 4px">${n || '1'}</span><span>${d || '1'}</span></span>`;
function kExpr(rx, { exp = true, solids = false, invert = false } = {}) {
  const keep = s => solids || (s[2] !== 's' && s[2] !== 'l');
  const top = rx.pr.filter(keep).map(s => term(s, exp)).join(''), bot = rx.re.filter(keep).map(s => term(s, exp)).join('');
  const [n, d] = invert ? [bot, top] : [top, bot];
  return 'K = ' + (d ? frac(n, d) : n || '1');
}
const gasMoles = side => side.filter(s => s[2] === 'g').reduce((t, s) => t + s[1], 0);
function lcPredict(rx, change) {
  const dn = gasMoles(rx.pr) - gasMoles(rx.re);
  switch (change.k) {
    case 'addR': return ['Shifts right', `Adding a reactant lowers Q below K, so the reaction makes more products.`];
    case 'remR': return ['Shifts left', `Removing a reactant makes the reaction run backward to replace it.`];
    case 'addP': return ['Shifts left', `Adding a product pushes the reaction back toward reactants.`];
    case 'remP': return ['Shifts right', `Removing a product pulls the reaction forward to replace it.`];
    case 'P+': return dn === 0 ? ['No shift', 'Both sides have the same moles of gas, so pressure has no effect.'] : [dn < 0 ? 'Shifts right' : 'Shifts left', `Higher pressure favors the side with fewer moles of gas (${gasMoles(rx.re)} vs ${gasMoles(rx.pr)}).`];
    case 'P-': return dn === 0 ? ['No shift', 'Both sides have the same moles of gas, so pressure has no effect.'] : [dn > 0 ? 'Shifts right' : 'Shifts left', `Lower pressure favors the side with more moles of gas (${gasMoles(rx.re)} vs ${gasMoles(rx.pr)}).`];
    case 'T+': return [rx.dH < 0 ? 'Shifts left' : 'Shifts right', `The reaction is ${rx.dH < 0 ? 'exothermic (heat is a product)' : 'endothermic (heat is a reactant)'}, so adding heat shifts ${rx.dH < 0 ? 'left' : 'right'}.`];
    case 'T-': return [rx.dH < 0 ? 'Shifts right' : 'Shifts left', `The reaction is ${rx.dH < 0 ? 'exothermic (heat is a product)' : 'endothermic (heat is a reactant)'}, so removing heat shifts ${rx.dH < 0 ? 'right' : 'left'}.`];
    case 'cat': return ['No shift', 'A catalyst speeds up both directions equally. Equilibrium is reached faster but does not move.'];
    case 'solid': return ['No shift', 'Solids do not appear in K, so adding more solid does not change Q.'];
  }
}

registerLab({
  id: 'equilibrium', ch: 15, sym: 'Eq', fam: 'rx',
  title: 'Equilibrium & Le Châtelier', chapter: 'Chemical Equilibrium',
  blurb: 'Disturb the ammonia equilibrium and watch the concentrations shift back until Q equals K again.',
  ideas: [
    'At <b>equilibrium</b>, forward and reverse rates are equal, so concentrations stop changing. They are not necessarily equal to each other.',
    'For aA + bB ⇌ cC + dD: <span class="eqn">K = [C]ᶜ[D]ᵈ / [A]ᵃ[B]ᵇ</span>. Leave out pure solids and liquids.',
    'K ≫ 1: products favored. K ≪ 1: reactants favored.',
    '<b>Q</b> uses the same expression with current concentrations. Q < K → shifts right. Q > K → shifts left. Q = K → at equilibrium.',
    '<b>Le Châtelier:</b> a disturbed system shifts to counteract the change. Add a substance → shift away from it; higher pressure → toward fewer gas moles; heat → in the endothermic direction.',
    'A catalyst gets you to equilibrium faster but does not shift it. Only temperature changes the value of K.',
    'Solubility: for AB(s) ⇌ A⁺ + B⁻, <span class="eqn">K<sub>sp</sub> = [A⁺][B⁻]</span>, so molar solubility s = √K<sub>sp</sub>.',
  ],
  bench(el) {
    const KT = { Cool: 2.0, Moderate: 0.5, Hot: 0.1 };
    let T = 'Moderate', K = KT[T], c = { N2: 0.5, H2: 1.5, NH3: 0 }, hist = [], target = null, from = null, frame = 0, timer = 0, stopped = false, msg = '';
    el.innerHTML = `
      <div class="panel">
        <h3>Le Châtelier simulator</h3>
        <div class="callout" style="font-size:1.08rem;overflow-x:auto;white-space:nowrap">N<sub>2</sub>(g) + 3 H<sub>2</sub>(g) ⇌ 2 NH<sub>3</sub>(g) &nbsp; ΔH = −92 kJ</div>
        <div class="btn-row" id="lc-btns">
          <button type="button" class="btn" data-a="N2">+ N₂</button><button type="button" class="btn" data-a="H2">+ H₂</button><button type="button" class="btn" data-a="NH3">+ NH₃</button><button type="button" class="btn" data-a="-NH3">Remove NH₃</button>
          <button type="button" class="btn" data-a="squeeze">Halve volume</button><button type="button" class="btn" data-a="expand">Double volume</button><button type="button" class="btn" data-a="cat">Add catalyst</button><button type="button" class="btn ghost" data-a="reset">Reset</button>
        </div>
        <div class="row"><span class="lbl">Temperature</span><div class="seg" id="lc-t">${Object.keys(KT).map(t => `<button type="button" aria-pressed="${t === T}" data-t="${t}">${t} (K = ${KT[t]})</button>`).join('')}</div></div>
        <div class="canvas-wrap"><canvas id="lc-c" aria-label="Concentration of each gas over time"></canvas></div>
        <div class="note" style="display:flex;gap:16px;flex-wrap:wrap"><span><b style="color:var(--c1)">━</b> [N₂]</span><span><b style="color:var(--c2)">━</b> [H₂]</span><span><b style="color:var(--c3)">━</b> [NH₃]</span></div>
        <div id="lc-out" style="display:grid;gap:10px"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const Q = x => x.NH3 ** 2 / (x.N2 * x.H2 ** 3);
    function solve(x) {
      const g = e => (x.NH3 + 2 * e) ** 2 / ((x.N2 - e) * (x.H2 - 3 * e) ** 3) - K;
      let lo = -x.NH3 / 2 + 1e-12, hi = Math.min(x.N2, x.H2 / 3) - 1e-12;
      for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
      const e = (lo + hi) / 2;
      return { N2: x.N2 - e, H2: x.H2 - 3 * e, NH3: x.NH3 + 2 * e, e };
    }
    const cv = makeCanvas($('#lc-c'), w => Math.max(170, Math.min(260, w * 0.45)), draw);
    function draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 40, r: 10, t: 10, b: 22 }, max = Math.max(2, ...hist.flatMap(p => [p.N2, p.H2, p.NH3])) * 1.1;
      const X = i => pad.l + (w - pad.l - pad.r) * i / 299, Y = v => h - pad.b - (h - pad.t - pad.b) * v / max;
      ctx.strokeStyle = tok('line'); ctx.fillStyle = tok('muted'); ctx.font = `11px ${tok('mono') || 'monospace'}`; ctx.lineWidth = 1;
      for (let v = 0; v <= max; v += max > 4 ? 1 : 0.5) { ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke(); ctx.fillText(v.toFixed(1), 4, Y(v) + 4); }
      ctx.fillText('time →', w - 54, h - 6); ctx.fillText('M', 4, pad.t + 2);
      [['N2', 'c1'], ['H2', 'c2'], ['NH3', 'c3']].forEach(([k, col]) => {
        ctx.strokeStyle = tok(col); ctx.lineWidth = 2.5; ctx.beginPath();
        hist.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p[k])) : ctx.moveTo(X(i), Y(p[k]))); ctx.stroke();
      });
    }
    function push() { hist.push({ ...c }); if (hist.length > 300) hist.shift(); }
    function disturb(newC, text) {
      c = newC; push(); from = { ...c }; target = solve(c); frame = 0;
      const q = Q(c), dir = Math.abs(q - K) / K < 0.01 ? 'none' : q < K ? 'right' : 'left';
      msg = `${text} Right after the change, Q = ${isFinite(q) ? fmt(q, 3) : '0'} ${dir === 'none' ? '= K' : dir === 'right' ? '< K' : '> K'}, so the reaction ${dir === 'none' ? 'does not shift' : `shifts <b>${dir}</b> (toward ${dir === 'right' ? 'NH₃' : 'N₂ and H₂'})`}.`;
      report();
    }
    function report() {
      $('#lc-out').innerHTML = `${UI.kv([['[N₂]', c.N2.toFixed(3) + ' M'], ['[H₂]', c.H2.toFixed(3) + ' M'], ['[NH₃]', c.NH3.toFixed(3) + ' M'], ['Q', isFinite(Q(c)) ? fmt(Q(c), 3) : '0'], ['K', K]])}${msg ? `<div class="callout">${msg}</div>` : ''}`;
    }
    function tick() {
      if (target) {
        frame++; const f = 1 - Math.exp(-frame / 14);
        c = { N2: from.N2 + (target.N2 - from.N2) * f, H2: from.H2 + (target.H2 - from.H2) * f, NH3: from.NH3 + (target.NH3 - from.NH3) * f };
        if (frame > 90) { c = { N2: target.N2, H2: target.H2, NH3: target.NH3 }; target = null; }
        report();
      }
      push(); cv.redraw(); if (!stopped) timer = setTimeout(() => requestAnimationFrame(() => { if (!stopped) tick(); }), 40);
    }
    $('#lc-btns').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const x = { ...c };
      if (a === 'N2') disturb({ ...x, N2: x.N2 + 0.5 }, 'You added N₂.');
      else if (a === 'H2') disturb({ ...x, H2: x.H2 + 0.5 }, 'You added H₂.');
      else if (a === 'NH3') disturb({ ...x, NH3: x.NH3 + 0.5 }, 'You added NH₃.');
      else if (a === '-NH3') disturb({ ...x, NH3: x.NH3 * 0.3 }, 'You removed most of the NH₃.');
      else if (a === 'squeeze') disturb({ N2: x.N2 * 2, H2: x.H2 * 2, NH3: x.NH3 * 2 }, 'Halving the volume doubles every concentration (4 mol gas on the left, 2 on the right).');
      else if (a === 'expand') disturb({ N2: x.N2 / 2, H2: x.H2 / 2, NH3: x.NH3 / 2 }, 'Doubling the volume halves every concentration.');
      else if (a === 'cat') { msg = 'A catalyst speeds up both directions equally. Nothing shifts; equilibrium would just be reached sooner.'; report(); }
      else if (a === 'reset') { c = { N2: 0.5, H2: 1.5, NH3: 0 }; hist = []; T = 'Moderate'; K = KT[T]; el.querySelectorAll('#lc-t button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === T))); disturb(c, 'Starting from pure N₂ and H₂.'); }
    });
    $('#lc-t').addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === T) return;
      const hotter = Object.keys(KT).indexOf(b.dataset.t) > Object.keys(KT).indexOf(T);
      T = b.dataset.t; K = KT[T];
      el.querySelectorAll('#lc-t button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      disturb({ ...c }, `${hotter ? 'Heating' : 'Cooling'} changes K itself: this reaction is exothermic, so K ${hotter ? 'drops' : 'rises'} to ${K}.`);
    });
    disturb(c, 'Starting from pure N₂ and H₂.');
    for (let i = 0; i < 40; i++) push();
    tick();
    return () => { stopped = true; clearTimeout(timer); cv.stop(); };
  },
  problems: [
    { name: 'Write K', gen() {
      const rx = U.pick(EQ_RX), right = kExpr(rx);
      const wrong = [kExpr(rx, { invert: true }), kExpr(rx, { exp: false }), kExpr(rx, { solids: true }), kExpr(rx, { exp: false, invert: true })];
      const uniq = [...new Set(wrong)].filter(w => w !== right).slice(0, 3);
      return { ...mc(right, uniq), q: `Which is the equilibrium expression for <span class="eqline">${eqTxt(rx)}</span>`, explain: 'Products over reactants, each raised to its coefficient. Pure solids and liquids are left out.' };
    } },
    { name: 'Calculate K', gen() {
      const opts = [
        () => { const a = U.sf(0.1, 0.9, 2), b = U.sf(0.1, 0.9, 2), p = U.sf(0.5, 3, 2), K = p * p / (a * b); return [`H<sub>2</sub>(g) + I<sub>2</sub>(g) ⇌ 2 HI(g)`, `[H<sub>2</sub>] = ${a} M, [I<sub>2</sub>] = ${b} M, [HI] = ${p} M`, K, `K = [HI]² / [H₂][I₂] = ${p}² / (${a} × ${b}) = ${fmt(K, 3)}`]; },
        () => { const a = U.sf(0.02, 0.5, 2), p = U.sf(0.02, 0.5, 2), K = p * p / a; return [`N<sub>2</sub>O<sub>4</sub>(g) ⇌ 2 NO<sub>2</sub>(g)`, `[N<sub>2</sub>O<sub>4</sub>] = ${a} M, [NO<sub>2</sub>] = ${p} M`, K, `K = [NO₂]² / [N₂O₄] = ${p}² / ${a} = ${fmt(K, 3)}`]; },
        () => { const a = U.sf(0.2, 1.5, 2), b = U.sf(0.2, 1.5, 2), p = U.sf(0.05, 0.6, 2), K = p * p / (a * b ** 3); return [`N<sub>2</sub>(g) + 3 H<sub>2</sub>(g) ⇌ 2 NH<sub>3</sub>(g)`, `[N<sub>2</sub>] = ${a} M, [H<sub>2</sub>] = ${b} M, [NH<sub>3</sub>] = ${p} M`, K, `K = [NH₃]² / [N₂][H₂]³ = ${p}² / (${a} × ${b}³) = ${fmt(K, 3)}`]; },
      ];
      const [eq, conc, K, ex] = U.pick(opts)();
      return { kind: 'num', q: `<span class="eqline">${eq}</span>At equilibrium: ${conc}. Calculate K.`, answer: K, explain: `<span class="eqn">${ex}</span>` };
    } },
    { name: 'Q vs K', gen() {
      const K = U.pick([0.05, 0.5, 4.0, 25, 160]), Qv = K * U.pick([0.1, 0.4, 3, 8]);
      const ans = Qv < K ? 'Shifts right (toward products)' : 'Shifts left (toward reactants)';
      return { ...mc(ans, ['Shifts right (toward products)', 'Shifts left (toward reactants)', 'Already at equilibrium']), q: `For a reaction with <b>K = ${K}</b>, a mixture has <b>Q = ${fmt(Qv, 3)}</b>. What happens?`,
        explain: `Q ${Qv < K ? '<' : '>'} K, so the reaction ${Qv < K ? 'makes more products to raise Q' : 'runs backward to lower Q'} until Q = K.` };
    } },
    { name: 'Le Châtelier', gen() {
      const rx = U.pick(EQ_RX);
      const gasR = rx.re.filter(s => s[2] !== 's'), gasP = rx.pr.filter(s => s[2] !== 's'), solid = rx.re.concat(rx.pr).find(s => s[2] === 's');
      const changes = [
        gasR.length && { k: 'addR', t: `${fmtF(U.pick(gasR)[0])} is added` }, gasR.length && { k: 'remR', t: `some ${fmtF(U.pick(gasR)[0])} is removed` },
        { k: 'addP', t: `${fmtF(U.pick(gasP)[0])} is added` }, { k: 'remP', t: `some ${fmtF(U.pick(gasP)[0])} is removed` },
        { k: 'P+', t: 'the volume is decreased (pressure increased)' }, { k: 'P-', t: 'the volume is increased (pressure decreased)' },
        { k: 'T+', t: 'the temperature is raised' }, { k: 'T-', t: 'the temperature is lowered' }, { k: 'cat', t: 'a catalyst is added' },
        solid && { k: 'solid', t: `more solid ${fmtF(solid[0])} is added` },
      ].filter(Boolean);
      const ch = U.pick(changes), [ans, why] = lcPredict(rx, ch);
      return { ...mc(ans, ['Shifts right', 'Shifts left', 'No shift']), q: `<span class="eqline">${eqTxt(rx)} &nbsp; ΔH = ${rx.dH > 0 ? '+' : '−'}${Math.abs(rx.dH)} kJ</span>What happens when ${ch.t}?`, explain: why };
    } },
    { name: 'K<sub>sp</sub> & solubility', gen() {
      const salts = [['AgCl', 1.77e-10, 1], ['BaSO4', 1.07e-10, 1], ['CaCO3', 4.96e-9, 1], ['PbSO4', 1.82e-8, 1], ['AgBr', 5.35e-13, 1], ['CaF2', 1.46e-10, 2], ['PbCl2', 1.17e-5, 2], ['Mg(OH)2', 2.06e-13, 2]];
      const [f, ksp, type] = U.pick(salts), s = type === 1 ? Math.sqrt(ksp) : Math.cbrt(ksp / 4);
      return { kind: 'num', unit: 'M', q: `K<sub>sp</sub> for <b>${fmtF(f)}</b> is ${fmt(ksp, 3)}. What is its molar solubility?`, answer: s,
        explain: type === 1 ? `AB ⇌ A + B: K<sub>sp</sub> = s·s = s², so <span class="eqn">s = √(${fmt(ksp, 3)}) = ${fmt(s, 3)} M</span>` : `AB₂ ⇌ A + 2B: K<sub>sp</sub> = s(2s)² = 4s³, so <span class="eqn">s = ∛(${fmt(ksp, 3)} / 4) = ${fmt(s, 3)} M</span>` };
    } },
  ],
});

/* ---------- Redox ---------- */
const ACTIVITY = ['Li', 'K', 'Ca', 'Na', 'Mg', 'Al', 'Mn', 'Zn', 'Cr', 'Fe', 'Ni', 'Sn', 'Pb', 'H2', 'Cu', 'Ag', 'Au'];
const ION_OF = { Li: 'Li^+', K: 'K^+', Ca: 'Ca^2+', Na: 'Na^+', Mg: 'Mg^2+', Al: 'Al^3+', Mn: 'Mn^2+', Zn: 'Zn^2+', Cr: 'Cr^3+', Fe: 'Fe^2+', Ni: 'Ni^2+', Sn: 'Sn^2+', Pb: 'Pb^2+', H2: 'H^+', Cu: 'Cu^2+', Ag: 'Ag^+', Au: 'Au^3+' };
const ionHTML = k => fmtF(ION_OF[k].replace('^', '^'));
const OX_TARGETS = [['H2SO4', 'S'], ['KMnO4', 'Mn'], ['Cr2O7^2-', 'Cr'], ['NO3-', 'N'], ['NH3', 'N'], ['CO2', 'C'], ['CH4', 'C'], ['ClO3-', 'Cl'], ['Fe2O3', 'Fe'], ['SO3^2-', 'S'], ['PO4^3-', 'P'], ['H2O2', 'O'], ['NaH', 'H'], ['NO2', 'N'], ['Cl2', 'Cl'], ['S^2-', 'S'], ['Cu2O', 'Cu'], ['CO3^2-', 'C'], ['MnO2', 'Mn'], ['CrO4^2-', 'Cr'], ['N2O', 'N'], ['Na2S2O3', 'S'], ['HNO2', 'N'], ['ClO4-', 'Cl'], ['NH4+', 'N'], ['SO2', 'S'], ['OF2', 'O']];
const REDOX_RX = [
  { eq: '2 Na + Cl<sub>2</sub> → 2 NaCl', ox: 'Na', red: 'Cl', oa: 'Cl<sub>2</sub>', ra: 'Na', sp: ['Na', 'Cl<sub>2</sub>'] },
  { eq: 'Zn + Cu<sup>2+</sup> → Zn<sup>2+</sup> + Cu', ox: 'Zn', red: 'Cu', oa: 'Cu<sup>2+</sup>', ra: 'Zn', sp: ['Zn', 'Cu<sup>2+</sup>'] },
  { eq: 'Mg + 2 HCl → MgCl<sub>2</sub> + H<sub>2</sub>', ox: 'Mg', red: 'H', oa: 'HCl', ra: 'Mg', sp: ['Mg', 'HCl'] },
  { eq: 'CH<sub>4</sub> + 2 O<sub>2</sub> → CO<sub>2</sub> + 2 H<sub>2</sub>O', ox: 'C', red: 'O', oa: 'O<sub>2</sub>', ra: 'CH<sub>4</sub>', sp: ['CH<sub>4</sub>', 'O<sub>2</sub>'] },
  { eq: '2 Fe<sub>2</sub>O<sub>3</sub> + 3 C → 4 Fe + 3 CO<sub>2</sub>', ox: 'C', red: 'Fe', oa: 'Fe<sub>2</sub>O<sub>3</sub>', ra: 'C', sp: ['Fe<sub>2</sub>O<sub>3</sub>', 'C'] },
  { eq: 'Fe + CuSO<sub>4</sub> → FeSO<sub>4</sub> + Cu', ox: 'Fe', red: 'Cu', oa: 'CuSO<sub>4</sub>', ra: 'Fe', sp: ['Fe', 'CuSO<sub>4</sub>'] },
  { eq: '2 H<sub>2</sub> + O<sub>2</sub> → 2 H<sub>2</sub>O', ox: 'H', red: 'O', oa: 'O<sub>2</sub>', ra: 'H<sub>2</sub>', sp: ['H<sub>2</sub>', 'O<sub>2</sub>'] },
  { eq: 'Cu + 2 AgNO<sub>3</sub> → Cu(NO<sub>3</sub>)<sub>2</sub> + 2 Ag', ox: 'Cu', red: 'Ag', oa: 'AgNO<sub>3</sub>', ra: 'Cu', sp: ['Cu', 'AgNO<sub>3</sub>'] },
  { eq: '2 Al + 3 Br<sub>2</sub> → 2 AlBr<sub>3</sub>', ox: 'Al', red: 'Br', oa: 'Br<sub>2</sub>', ra: 'Al', sp: ['Al', 'Br<sub>2</sub>'] },
  { eq: 'Cl<sub>2</sub> + 2 KI → 2 KCl + I<sub>2</sub>', ox: 'I', red: 'Cl', oa: 'Cl<sub>2</sub>', ra: 'KI', sp: ['Cl<sub>2</sub>', 'KI'] },
  { eq: '2 Mg + O<sub>2</sub> → 2 MgO', ox: 'Mg', red: 'O', oa: 'O<sub>2</sub>', ra: 'Mg', sp: ['Mg', 'O<sub>2</sub>'] },
];

registerLab({
  id: 'redox', ch: 16, sym: 'Ox', fam: 'rx',
  title: 'Oxidation & Reduction', chapter: 'Oxidation and Reduction',
  blurb: 'Assign oxidation numbers rule by rule, track electrons in redox reactions, and use the activity series to predict reactions.',
  ideas: [
    '<b>OIL RIG:</b> Oxidation Is Loss of electrons, Reduction Is Gain. Oxidation number goes up when oxidized, down when reduced.',
    'The substance that gets reduced is the <b>oxidizing agent</b>; the substance that gets oxidized is the <b>reducing agent</b>.',
    'Oxidation number rules, in priority order: free element = 0; monatomic ion = its charge; group 1 = +1, group 2 = +2; F = −1; H = +1 (−1 with metals); O = −2 (−1 in peroxides).',
    'The sum of oxidation numbers equals 0 for a compound, or the charge for an ion. Solve for the one element left over.',
    '<b>Activity series:</b> a metal displaces the ion of any metal below it. Metals above H₂ react with acids to release hydrogen gas.',
    'Batteries and corrosion are redox: electrons flow from the more active metal (anode, oxidation) to the less active (cathode, reduction).',
  ],
  bench(el) {
    el.innerHTML = `
      <div class="panel">
        <h3>Oxidation number calculator</h3>
        <p class="sub">Type a compound or ion. Write ion charges like SO4^2- or NH4+.</p>
        <div class="row">${UI.text('ox-f', 'Formula', 'Cr2O7^2-', 'e.g. KMnO4, NO3-')}</div>
        <div class="btn-row" id="ox-ex">${['H2SO4', 'KMnO4', 'NH4+', 'H2O2', 'Fe3O4', 'NaH', 'ClO4-', 'Na2S2O3'].map(f => `<button type="button" class="chip" data-f="${f}">${fmtF(f)}</button>`).join('')}</div>
        <div id="ox-out" style="display:grid;gap:10px"></div>
      </div>
      <div class="panel">
        <h3>Activity series</h3>
        <p class="sub">Pick a metal and an ion in solution. A metal only displaces ions of metals below it.</p>
        <div class="row">${UI.select('as-m', 'Solid metal', ACTIVITY.filter(x => x !== 'H2').map(m => [m, m]), 'Zn')}${UI.select('as-i', 'Ion in solution', ACTIVITY.map(m => [m, ION_OF[m].replace('^', '')]), 'Cu')}</div>
        <div class="row" style="align-items:flex-start;gap:18px">
          <ol id="as-list" style="list-style:none;margin:0;padding:0;display:grid;gap:2px;font-family:var(--mono);font-size:.85rem;flex:0 0 auto"></ol>
          <div id="as-out" style="flex:1 1 220px;min-width:0"></div>
        </div>
      </div>`;
    const $ = s => el.querySelector(s);
    function ox() {
      try {
        const f = $('#ox-f').value.trim(), r = Chem.oxidation(f);
        const els = Object.keys(r.counts), sum = els.reduce((s, e) => s + r.states[e] * r.counts[e], 0);
        $('#ox-out').innerHTML = `<span class="big-formula">${fmtF(f)}</span>
          <div class="scroll"><table class="t"><tr><th>Element</th><th class="n">Ox. no.</th><th class="n">× atoms</th><th>Why</th></tr>
          ${els.map(e => `<tr><td><b>${e}</b></td><td class="n"><b>${isNaN(r.states[e]) ? '?' : fracStr(r.states[e])}</b></td><td class="n">${r.counts[e]}</td><td style="white-space:normal;min-width:200px">${r.why[e]}</td></tr>`).join('')}</table></div>
          ${isNaN(sum) ? '<div class="callout warn">More than one element is left without a rule. Try a simpler formula or split it into ions first.</div>' : `<div class="callout">Check: ${els.map(e => `${r.counts[e]}(${fracStr(r.states[e])})`).join(' + ')} = ${Math.round(sum * 1000) / 1000}, the overall charge.</div>`}
          ${els.some(e => !Number.isInteger(r.states[e]) && !isNaN(r.states[e])) ? '<p class="note">A fractional value is an average: the atoms of that element have different oxidation states.</p>' : ''}`;
      } catch (err) { $('#ox-out').innerHTML = `<div class="callout warn">${U.esc(err.message)}</div>`; }
    }
    $('#ox-f').addEventListener('input', ox);
    $('#ox-ex').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { $('#ox-f').value = b.dataset.f; ox(); } });
    function act() {
      const m = $('#as-m').value, i = $('#as-i').value, im = ACTIVITY.indexOf(m), ii = ACTIVITY.indexOf(i), yes = im < ii;
      $('#as-list').innerHTML = ACTIVITY.map((x, k) => `<li style="padding:1px 8px;border-radius:4px;${x === m ? 'background:var(--c2);color:var(--bg)' : x === i ? 'background:var(--c1);color:var(--bg)' : ''}">${k === 0 ? '▲ ' : k === ACTIVITY.length - 1 ? '▼ ' : '&nbsp; '}${x}</li>`).join('');
      $('#as-out').innerHTML = m === i ? '<div class="callout">Same metal: no reaction.</div>' : `<div class="callout ${yes ? 'good' : 'bad'}"><b>${yes ? 'Reaction occurs.' : 'No reaction.'}</b> ${m} is ${yes ? 'above' : 'below'} ${i === 'H2' ? 'H₂' : i} in the series.</div>
        ${yes ? `<p style="margin-top:10px">${m} is oxidized to ${ionHTML(m)}; ${ionHTML(i)} is reduced to ${i === 'H2' ? 'H<sub>2</sub> gas' : i}.</p>` : `<p class="note" style="margin-top:10px">${i === 'H2' ? `${m} is below H₂, so it does not react with acid.` : `${i} holds its electrons more strongly than ${m} can push them.`}</p>`}
        <p class="note" style="margin-top:6px">Most active at top (▲), least active at bottom (▼).</p>`;
    }
    $('#as-m').addEventListener('change', act); $('#as-i').addEventListener('change', act);
    ox(); act();
  },
  problems: [
    { name: 'Oxidation number', gen() {
      const [f, e] = U.pick(OX_TARGETS), r = Chem.oxidation(f), v = r.states[e];
      return { kind: 'num', tol: 0, abs: 0.01, ph: 'e.g. +6 or -2', q: `What is the oxidation number of <b>${e}</b> in <b style="font-size:1.2em">${fmtF(f)}</b>?`, answer: v, display: fracStr(v),
        check: x => { const n = parseNum(String(x).replace(/^\+/, '')); return n === null ? null : Math.abs(n - v) < 0.01; },
        explain: Object.keys(r.counts).map(k => `${k}: ${fracStr(r.states[k])} (${r.why[k].replace(/\.$/, '')})`).join('. ') + '.' };
    } },
    { name: 'Oxidized or reduced', gen() {
      const rx = U.pick(REDOX_RX), ask = U.pick(['ox', 'red', 'oa', 'ra']);
      const label = { ox: 'Which element is <b>oxidized</b>?', red: 'Which element is <b>reduced</b>?', oa: 'What is the <b>oxidizing agent</b>?', ra: 'What is the <b>reducing agent</b>?' }[ask];
      const opts = ask === 'ox' || ask === 'red' ? [rx.ox, rx.red] : rx.sp;
      return { ...mc(rx[ask], opts), q: `<span class="eqline">${rx.eq}</span>${label}`,
        explain: `${rx.ox} loses electrons (its oxidation number rises), so it is oxidized and ${rx.ra} is the reducing agent. ${rx.red} gains electrons (oxidation number falls), so it is reduced and ${rx.oa} is the oxidizing agent.` };
    } },
    { name: 'Activity series', gen() {
      const metals = ACTIVITY.filter(x => x !== 'H2'), m = U.pick(metals); let i; do i = U.pick(ACTIVITY); while (i === m);
      const yes = ACTIVITY.indexOf(m) < ACTIVITY.indexOf(i);
      return { ...mc(yes ? 'Yes, a reaction occurs' : 'No reaction', ['Yes, a reaction occurs', 'No reaction']), q: `Will solid <b>${m}</b> react with a solution containing <b>${ionHTML(i)}</b>${i === 'H2' ? ' (an acid)' : ''}?`,
        explain: `${m} is ${yes ? 'above' : 'below'} ${i === 'H2' ? 'H₂' : i} in the activity series, so ${yes ? `${m} gives up electrons to ${ionHTML(i)}` : 'nothing happens'}.` };
    } },
  ],
});
