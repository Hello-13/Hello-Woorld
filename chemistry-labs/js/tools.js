'use strict';
/* Study tools: interactive periodic table, flashcards with spaced repetition, and test mode */

/* ================= Periodic table ================= */
const EN_ALL = '2.20,,0.98,1.57,2.04,2.55,3.04,3.44,3.98,,0.93,1.31,1.61,1.90,2.19,2.58,3.16,,0.82,1.00,1.36,1.54,1.63,1.66,1.55,1.83,1.88,1.91,1.90,1.65,1.81,2.01,2.18,2.55,2.96,3.00,0.82,0.95,1.22,1.33,1.6,2.16,1.9,2.2,2.28,2.20,1.93,1.69,1.78,1.96,2.05,2.1,2.66,2.60,0.79,0.89,1.10,1.12,1.13,1.14,1.13,1.17,1.2,1.2,1.1,1.22,1.23,1.24,1.25,1.1,1.27,1.3,1.5,2.36,1.9,2.2,2.20,2.28,2.54,2.00,1.62,2.33,2.02,2.0,2.2,2.2,0.7,0.9,1.1,1.3,1.5,1.38,1.36,1.28,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3'.split(',').map(x => (x ? +x : null));
const CATS = {
  alkali: 'Alkali metal', alkaline: 'Alkaline earth metal', transition: 'Transition metal', post: 'Post-transition metal', metalloid: 'Metalloid',
  nonmetal: 'Nonmetal', halogen: 'Halogen', noble: 'Noble gas', lanth: 'Lanthanide', act: 'Actinide',
};
function category(Z) {
  if ([2, 10, 18, 36, 54, 86, 118].includes(Z)) return 'noble';
  if ([3, 11, 19, 37, 55, 87].includes(Z)) return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(Z)) return 'alkaline';
  if ([9, 17, 35, 53, 85, 117].includes(Z)) return 'halogen';
  if (Z >= 57 && Z <= 71) return 'lanth';
  if (Z >= 89 && Z <= 103) return 'act';
  if ([5, 14, 32, 33, 51, 52].includes(Z)) return 'metalloid';
  if ([1, 6, 7, 8, 15, 16, 34].includes(Z)) return 'nonmetal';
  const g = Chem.group(Z);
  return g >= 3 && g <= 12 ? 'transition' : 'post';
}
const GASES = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86], LIQUIDS = [35, 80];
const stateOf = Z => GASES.includes(Z) ? 'gas' : LIQUIDS.includes(Z) ? 'liquid' : Z > 100 ? 'unknown' : 'solid';
function cellPos(Z) {
  if (Z >= 57 && Z <= 71) return [Z - 57 + 3, 9];
  if (Z >= 89 && Z <= 103) return [Z - 89 + 3, 10];
  return [Chem.group(Z), Chem.period(Z)];
}
const blockOf = Z => (Z >= 57 && Z <= 71) || (Z >= 89 && Z <= 103) ? 'f' : (g => g <= 2 || Z === 2 ? 's' : g >= 13 ? 'p' : 'd')(Chem.group(Z));
const COMMON_ION = { 1: [1], 2: [2], 13: [3], 15: [-3], 16: [-2], 17: [-1] };
const TM_IONS = { Fe: '2+, 3+', Cu: '1+, 2+', Zn: '2+', Ag: '1+', Co: '2+, 3+', Cr: '2+, 3+', Mn: '2+', Ni: '2+', Sn: '2+, 4+', Pb: '2+, 4+', Hg: '1+ (Hg₂²⁺), 2+', Au: '1+, 3+', Cd: '2+', Ti: '4+', Pt: '2+, 4+' };

registerPage('table', {
  title: 'Periodic Table',
  render(app) {
    let mode = 'cat', sel = 26;
    const cells = ELZ.slice(1).map(e => { const [c, r] = cellPos(e.Z); return `<button type="button" class="pe c-${category(e.Z)}" data-z="${e.Z}" style="grid-column:${c};grid-row:${r}" aria-label="${e.name}"><span class="pz">${e.Z}</span><span class="ps">${e.sym}</span></button>`; }).join('');
    app.innerHTML = `
      <style>
        .ptab-wrap{overflow-x:auto;padding-bottom:6px}
        .ptab{display:grid;grid-template-columns:repeat(18,minmax(34px,1fr));grid-template-rows:repeat(7,auto) 12px repeat(2,auto);gap:3px;min-width:680px}
        .pe{font:inherit;position:relative;aspect-ratio:1/1.08;border-radius:5px;border:1.5px solid transparent;background:var(--pc,var(--raised));color:var(--ink);cursor:pointer;padding:2px;display:grid;place-items:center;min-width:0}
        .pe .pz{position:absolute;top:2px;left:4px;font-family:var(--mono);font-size:.56rem;color:var(--muted)}
        .pe .ps{font-weight:700;font-size:clamp(.7rem,1.5vw,1.05rem)}
        .pe[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--ink)}
        .pe.dim{opacity:.18}
        .ph{grid-column:3;font-size:.6rem;color:var(--muted);display:grid;place-items:center;border:1.5px dashed var(--line);border-radius:5px}
        .c-alkali{--pc:color-mix(in srgb,#e8553f 30%,var(--raised))}.c-alkaline{--pc:color-mix(in srgb,#f0a030 32%,var(--raised))}
        .c-transition{--pc:color-mix(in srgb,#d9b23a 26%,var(--raised))}.c-post{--pc:color-mix(in srgb,#7f9aa8 30%,var(--raised))}
        .c-metalloid{--pc:color-mix(in srgb,#3fae8a 30%,var(--raised))}.c-nonmetal{--pc:color-mix(in srgb,#3d8be0 30%,var(--raised))}
        .c-halogen{--pc:color-mix(in srgb,#4ac0d8 32%,var(--raised))}.c-noble{--pc:color-mix(in srgb,#8a68e0 32%,var(--raised))}
        .c-lanth{--pc:color-mix(in srgb,#e06aa8 26%,var(--raised))}.c-act{--pc:color-mix(in srgb,#c25a7a 32%,var(--raised))}
        .plegend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.82rem;color:var(--muted)}
        .plegend span{display:inline-flex;align-items:center;gap:6px}.plegend i{width:12px;height:12px;border-radius:3px;background:var(--pc)}
        .pdetail{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start}
        .pbig{width:120px;aspect-ratio:1/1.1;border-radius:8px;background:var(--pc);border:2px solid var(--ink);padding:8px 10px;display:grid;grid-template-rows:auto 1fr auto}
        .pbig .ps{font-family:var(--display);font-size:2.8rem;font-weight:800;line-height:1;align-self:center}
        @media (max-width:560px){.pdetail{grid-template-columns:1fr}}
      </style>
      <div class="lab-head"><div class="lab-title"><p class="eyebrow">Reference</p><h1>Periodic Table</h1><p class="lede">Tap any element for its details. Recolor the table to see families, blocks, states, or how electronegativity rises toward fluorine.</p></div></div>
      <section class="panel-card">
        <div class="row" style="justify-content:space-between">
          <div class="seg" id="pt-mode" role="group" aria-label="Color by">${[['cat', 'Family'], ['block', 'Block'], ['state', 'State at 25 °C'], ['en', 'Electronegativity']].map(([k, t]) => `<button type="button" data-m="${k}" aria-pressed="${k === mode}">${t}</button>`).join('')}</div>
          <label class="field" style="flex:0 1 240px" for="pt-q"><span class="lbl">Find</span><input id="pt-q" type="text" placeholder="name, symbol or number" autocomplete="off"></label>
        </div>
        <div class="ptab-wrap"><div class="ptab" id="ptab">${cells}<div class="ph" style="grid-row:6">57–71</div><div class="ph" style="grid-row:7">89–103</div></div></div>
        <div class="plegend" id="pt-legend"></div>
        <div id="pt-detail"></div>
      </section>`;
    const $ = s => app.querySelector(s);
    const enColor = v => v === null ? 'var(--raised)' : `color-mix(in srgb, var(--c2) ${Math.round((v - 0.7) / 3.3 * 85) + 6}%, var(--raised))`;
    const blockCol = { s: 'var(--c2)', p: 'var(--c3)', d: 'var(--c1)', f: 'var(--f-nuc)' }, stateCol = { gas: 'var(--c1)', liquid: 'var(--c3)', solid: 'var(--muted)', unknown: 'var(--line)' };
    function paint() {
      app.querySelectorAll('.pe').forEach(b => {
        const Z = +b.dataset.z;
        b.style.removeProperty('--pc');
        if (mode === 'en') b.style.setProperty('--pc', enColor(EN_ALL[Z - 1] ?? null));
        if (mode === 'block') b.style.setProperty('--pc', `color-mix(in srgb, ${blockCol[blockOf(Z)]} 26%, var(--raised))`);
        if (mode === 'state') b.style.setProperty('--pc', `color-mix(in srgb, ${stateCol[stateOf(Z)]} ${stateOf(Z) === 'solid' ? 14 : 34}%, var(--raised))`);
      });
      $('#pt-legend').innerHTML = mode === 'cat' ? Object.entries(CATS).map(([k, v]) => `<span class="c-${k}"><i></i>${v}</span>`).join('')
        : mode === 'block' ? Object.entries(blockCol).map(([k, c]) => `<span style="--pc:color-mix(in srgb,${c} 26%,var(--raised))"><i></i>${k}-block</span>`).join('')
          : mode === 'state' ? Object.entries(stateCol).map(([k, c]) => `<span style="--pc:color-mix(in srgb,${c} ${k === 'solid' ? 14 : 34}%,var(--raised))"><i></i>${k}</span>`).join('')
            : `<span style="--pc:${enColor(0.8)}"><i></i>0.7 (Cs, Fr)</span><span style="--pc:${enColor(2.2)}"><i></i>2.2</span><span style="--pc:${enColor(3.98)}"><i></i>3.98 (F)</span><span>Noble gases He, Ne, Ar have no value</span>`;
    }
    function detail() {
      const e = ELZ[sel], g = Chem.group(sel), cat = category(sel), en = EN_ALL[sel - 1];
      app.querySelectorAll('.pe').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.z === sel)));
      const main = [1, 2, 13, 14, 15, 16, 17, 18].includes(g) && !['lanth', 'act'].includes(cat);
      const ion = COMMON_ION[g] && sel > 2 && ![6, 14, 32].includes(sel) && sel < 87 ? COMMON_ION[g].map(q => e.sym + '<sup>' + chargeStr(q) + '</sup>').join(', ') : TM_IONS[e.sym] ? `${e.sym}: ${TM_IONS[e.sym]}` : '—';
      $('#pt-detail').innerHTML = `<div class="pdetail">
        <div class="pbig c-${cat}"><span class="pz" style="font-family:var(--mono)">${sel}</span><span class="ps">${e.sym}</span><span style="font-family:var(--mono);font-size:.82rem">${e.mass}</span></div>
        <div style="display:grid;gap:10px;min-width:0"><div><h2 style="font-size:1.6rem">${e.name}</h2><p class="note">${CATS[cat]} · ${stateOf(sel) === 'unknown' ? 'state unknown (made in labs, a few atoms at a time)' : stateOf(sel) + ' at room temperature'}</p></div>
        ${UI.kv([['Atomic number', sel], ['Atomic mass', e.mass + ' amu'], ['Group', g ?? 'f-block'], ['Period', Chem.period(sel)], ['Block', blockOf(sel)], ['Electronegativity', en ?? '—'], ['Valence e⁻', main ? Chem.valence(sel) : '—'], ['Common ions', ion]])}
        <div class="callout" style="overflow-x:auto"><span style="white-space:nowrap"><b>Electron configuration:</b> ${Chem.shortHTML(sel)}</span>${sel > 56 && (blockOf(sel) === 'f' || sel > 103) ? '<div class="note">Predicted from the aufbau order; some heavy elements differ slightly.</div>' : ''}</div>
        ${sel <= 54 ? `<p class="note">See its orbital diagram in <a href="#electrons">Electron Configurations</a>.</p>` : ''}</div></div>`;
    }
    $('#ptab').addEventListener('click', e => { const b = e.target.closest('.pe'); if (b) { sel = +b.dataset.z; detail(); } });
    $('#pt-mode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; app.querySelectorAll('#pt-mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); });
    $('#pt-q').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      let hit = null;
      app.querySelectorAll('.pe').forEach(b => {
        const el = ELZ[+b.dataset.z], m = !q || el.name.toLowerCase().startsWith(q) || el.sym.toLowerCase() === q || String(el.Z) === q;
        b.classList.toggle('dim', !m);
        if (q && m && (!hit || el.sym.toLowerCase() === q || String(el.Z) === q)) hit = el.Z;
      });
      if (hit) { sel = hit; detail(); }
    });
    paint(); detail();
  },
});

/* ================= Flashcards ================= */
const POLY_EXTRA = [['NH4^+', 'ammonium'], ['H3O^+', 'hydronium'], ['Hg2^2+', 'mercury(I)'], ['HSO4^-', 'hydrogen sulfate (bisulfate)'], ['H2PO4^-', 'dihydrogen phosphate'], ['HPO4^2-', 'hydrogen phosphate'], ['O2^2-', 'peroxide'], ['ClO^-', 'hypochlorite'], ['ClO2^-', 'chlorite'], ['BrO3^-', 'bromate'], ['IO3^-', 'iodate'], ['SCN^-', 'thiocyanate'], ['C2O4^2-', 'oxalate'], ['S2O3^2-', 'thiosulfate'], ['HSO3^-', 'hydrogen sulfite (bisulfite)']];
const DECKS = {
  poly: { name: 'Polyatomic ions', blurb: 'Name ⇄ formula with charge', cards: () => ANIONS.filter(a => a.poly).map(a => [a.name, fmtF(a.f + '^' + chargeStr(a.q).replace('−', '-'))]).concat(POLY_EXTRA.map(([f, n]) => [n, fmtF(f)])) },
  symbols: { name: 'Element symbols', blurb: 'Symbol ⇄ name for the elements you use most', cards: () => ELZ.slice(1, 37).concat(['Rb', 'Sr', 'Ag', 'Sn', 'I', 'Xe', 'Cs', 'Ba', 'W', 'Pt', 'Au', 'Hg', 'Pb', 'Rn', 'Ra', 'U', 'Pu'].map(s => EL[s])).map(e => [`<span style="font-family:var(--display);font-size:2.6em;font-weight:800">${e.sym}</span>`, e.name]) },
  ions: { name: 'Ion charges', blurb: 'The charge each element usually takes', cards: () => ['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Al', 'N', 'P', 'O', 'S', 'F', 'Cl', 'Br', 'I', 'Zn', 'Ag'].map(s => [`Ion formed by <b>${EL[s].name}</b>`, `${s}<sup>${chargeStr(ionCharge(s) ?? ({ Zn: 2, Ag: 1 })[s])}</sup>`]).concat(Object.entries({ Fe: 'iron(II) Fe²⁺ · iron(III) Fe³⁺', Cu: 'copper(I) Cu⁺ · copper(II) Cu²⁺', Sn: 'tin(II) Sn²⁺ · tin(IV) Sn⁴⁺', Pb: 'lead(II) Pb²⁺ · lead(IV) Pb⁴⁺' }).map(([s, t]) => [`Ions formed by <b>${EL[s].name}</b>`, t])) },
  metric: { name: 'Metric prefixes', blurb: 'Prefix ⇄ symbol and power of ten', cards: () => [['giga', 'G · 10⁹'], ['mega', 'M · 10⁶'], ['kilo', 'k · 10³'], ['deci', 'd · 10⁻¹'], ['centi', 'c · 10⁻²'], ['milli', 'm · 10⁻³'], ['micro', 'µ · 10⁻⁶'], ['nano', 'n · 10⁻⁹'], ['pico', 'p · 10⁻¹²']] },
  greek: { name: 'Naming prefixes', blurb: 'Greek prefixes for molecular compounds and hydrates', cards: () => PREFIX.slice(1).map((p, i) => [p + '-', String(i + 1)]).concat([['hemi-', '½']]) },
  acids: { name: 'Acids & bases', blurb: 'Strong vs weak, names and formulas', cards: () => [['HCl', 'hydrochloric acid · strong'], ['HBr', 'hydrobromic acid · strong'], ['HI', 'hydroiodic acid · strong'], ['HNO<sub>3</sub>', 'nitric acid · strong'], ['H<sub>2</sub>SO<sub>4</sub>', 'sulfuric acid · strong (diprotic)'], ['HClO<sub>4</sub>', 'perchloric acid · strong'], ['HF', 'hydrofluoric acid · weak'], ['HC<sub>2</sub>H<sub>3</sub>O<sub>2</sub>', 'acetic acid · weak'], ['H<sub>2</sub>CO<sub>3</sub>', 'carbonic acid · weak'], ['H<sub>3</sub>PO<sub>4</sub>', 'phosphoric acid · weak'], ['NaOH', 'sodium hydroxide · strong base'], ['KOH', 'potassium hydroxide · strong base'], ['Ca(OH)<sub>2</sub>', 'calcium hydroxide · strong base'], ['NH<sub>3</sub>', 'ammonia · weak base']] },
  formulas: { name: 'Constants & formulas', blurb: 'The equations you need on test day', cards: () => [['Avogadro\'s number', '6.022 × 10²³ per mol'], ['Ideal gas law', 'PV = nRT'], ['Gas constant R', '0.08206 L·atm/(mol·K)'], ['Molar volume at STP', '22.4 L/mol (0 °C, 1 atm)'], ['Heat and temperature', 'q = m·c·ΔT'], ['Specific heat of water', '4.184 J/(g·°C)'], ['Combined gas law', 'P₁V₁/T₁ = P₂V₂/T₂'], ['Dilution', 'M₁V₁ = M₂V₂'], ['Molarity', 'M = mol solute / L solution'], ['pH', 'pH = −log[H₃O⁺]'], ['Ion product of water', 'K<sub>w</sub> = [H₃O⁺][OH⁻] = 1.0 × 10⁻¹⁴'], ['Percent yield', 'actual ÷ theoretical × 100%'], ['Kelvin', 'K = °C + 273.15'], ['1 atm in mmHg', '760 mmHg (torr) = 101.325 kPa'], ['Speed of light', 'c = λν = 3.00 × 10⁸ m/s'], ['Photon energy', 'E = hν, h = 6.626 × 10⁻³⁴ J·s'], ['Half-life', 'amount left = start × (½)ⁿ']] },
};

registerPage('cards', {
  title: 'Flashcards',
  render(app) {
    const box = Store.bag('cards');
    let deck = null, cards = [], cur = -1, flipped = false, dir = 'front', lastIdx = -1;
    const key = (d, i) => d + '|' + i;
    const learned = d => DECKS[d].cards().filter((_, i) => (box[key(d, i)] || 0) >= 3).length;
    function home() {
      deck = null;
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Memorize</p><h1>Flashcards</h1><p class="lede">Flip a card, then say whether you knew it. Cards you miss come back often; cards you know drift away. A card counts as learned after you get it right three times in a row.</p></div></div>
        <div class="decks">${Object.entries(DECKS).map(([k, d]) => { const n = d.cards().length, l = learned(k); return `<button type="button" class="deck" data-d="${k}"><b>${d.name}</b><span>${d.blurb}</span><span class="meter"><i style="width:${l / n * 100}%"></i></span><span class="note">${l} of ${n} learned</span></button>`; }).join('')}</div>`;
      app.querySelector('.decks').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) open(b.dataset.d); });
    }
    function pickNext() {
      const lv = cards.map((_, i) => box[key(deck, i)] || 0);
      // weight low boxes heavily: box 0 → 16, 1 → 8, ... 4 → 1
      const weights = lv.map((b, i) => (i === lastIdx && cards.length > 1 ? 0 : 2 ** (4 - Math.min(b, 4))));
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
      return 0;
    }
    function open(d) { deck = d; cards = DECKS[d].cards(); next(); }
    function next() { cur = pickNext(); lastIdx = cur; flipped = false; draw(); }
    function draw() {
      const [front, back] = cards[cur], rev = dir === 'back' || (dir === 'mixed' && (cur * 7 + cards.length) % 2 === 1);
      const shown = flipped ? (rev ? front : back) : (rev ? back : front);
      const lvl = box[key(deck, cur)] || 0;
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow"><a href="#cards" id="fc-back">Flashcards</a> · ${DECKS[deck].name}</p><h1>${DECKS[deck].name}</h1></div></div>
        <div class="fc-wrap">
          <div class="row" style="justify-content:space-between"><div class="seg" id="fc-dir" role="group" aria-label="Which side to show first">${[['front', 'Name first'], ['back', 'Answer first'], ['mixed', 'Mixed']].map(([k, t]) => `<button type="button" data-dir="${k}" aria-pressed="${dir === k}">${t}</button>`).join('')}</div><span class="note">${learned(deck)} of ${cards.length} learned</span></div>
          <button type="button" class="fcard${flipped ? ' flipped' : ''}" id="fc-card" aria-live="polite"><span class="fc-side">${flipped ? 'Answer' : 'Prompt'} · box ${lvl}</span><span class="fc-text">${shown}</span><span class="fc-tip">${flipped ? '' : 'Tap or press Space to flip'}</span></button>
          <div class="btn-row" style="justify-content:center" ${flipped ? '' : 'hidden'} id="fc-grade"><button type="button" class="btn" id="fc-again">Missed it</button><button type="button" class="btn primary" id="fc-good">Knew it</button></div>
        </div>`;
      app.querySelector('#fc-card').addEventListener('click', () => { flipped = !flipped; draw(); app.querySelector('#fc-card').focus(); });
      app.querySelector('#fc-dir').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) { dir = b.dataset.dir; flipped = false; draw(); } });
      app.querySelector('#fc-back').addEventListener('click', e => { e.preventDefault(); home(); });
      const gradeCard = good => { const k = key(deck, cur); box[k] = good ? Math.min(5, (box[k] || 0) + 1) : 0; Store.save(); next(); app.querySelector('#fc-card').focus(); };
      app.querySelector('#fc-again').addEventListener('click', () => gradeCard(false));
      app.querySelector('#fc-good').addEventListener('click', () => gradeCard(true));
    }
    const onKey = e => {
      if (!deck || e.target.matches('input, select, textarea')) return;
      if (e.key === ' ' && document.activeElement?.id !== 'fc-card') { e.preventDefault(); flipped = !flipped; draw(); }
      else if (flipped && (e.key === 'ArrowRight' || e.key === 'k')) app.querySelector('#fc-good')?.click();
      else if (flipped && (e.key === 'ArrowLeft' || e.key === 'j')) app.querySelector('#fc-again')?.click();
    };
    document.addEventListener('keydown', onKey);
    home();
    return () => document.removeEventListener('keydown', onKey);
  },
});

/* ================= Test mode ================= */
registerPage('exam', {
  title: 'Test Mode',
  render(app) {
    const hist = Store.bag('exams');
    hist.list = hist.list || [];
    let chosen = new Set(hist.lastChosen || LABS.map(l => l.id)), count = hist.lastCount || 15, qs = [], i = 0;
    function setup() {
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Review</p><h1>Test Mode</h1><p class="lede">A mixed quiz drawn from the chapters you pick. You see right or wrong as you go, and the worked solutions at the end, like a real test.</p></div></div>
        <section class="panel-card">
          <div class="row" style="justify-content:space-between"><span class="lbl">Chapters</span><span class="btn-row"><button type="button" class="btn ghost" id="ex-all">All</button><button type="button" class="btn ghost" id="ex-none">None</button></span></div>
          <div class="chips" id="ex-ch">${LABS.map(l => `<button type="button" class="chip fam-${l.fam}" data-id="${l.id}" aria-pressed="${chosen.has(l.id)}">${chTag(l)} · ${l.title}</button>`).join('')}</div>
          <div class="row"><span class="lbl">Questions</span><div class="seg" id="ex-n">${[10, 15, 25, 40].map(n => `<button type="button" data-n="${n}" aria-pressed="${n === count}">${n}</button>`).join('')}</div></div>
          <div><button type="button" class="btn primary" id="ex-go">Start test</button> <span class="note" id="ex-msg"></span></div>
        </section>
        ${hist.list.length ? `<section class="panel-card"><h2 class="mini-h">Recent tests</h2><div class="scroll"><table class="t"><tr><th>Date</th><th>Chapters</th><th class="n">Score</th></tr>${hist.list.slice(-8).reverse().map(h => `<tr><td>${new Date(h.t).toLocaleDateString()}</td><td style="white-space:normal">${h.ch}</td><td class="n">${h.c}/${h.n} (${Math.round(h.c / h.n * 100)}%)</td></tr>`).join('')}</table></div></section>` : ''}`;
      const $ = s => app.querySelector(s);
      $('#ex-ch').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; chosen.has(b.dataset.id) ? chosen.delete(b.dataset.id) : chosen.add(b.dataset.id); b.setAttribute('aria-pressed', String(chosen.has(b.dataset.id))); });
      $('#ex-all').addEventListener('click', () => { chosen = new Set(LABS.map(l => l.id)); setup(); });
      $('#ex-none').addEventListener('click', () => { chosen = new Set(); setup(); });
      $('#ex-n').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; count = +b.dataset.n; app.querySelectorAll('#ex-n button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      $('#ex-go').addEventListener('click', () => {
        if (!chosen.size) { $('#ex-msg').textContent = 'Pick at least one chapter.'; return; }
        hist.lastChosen = [...chosen]; hist.lastCount = count; Store.save();
        const labs = U.shuffle(LABS.filter(l => chosen.has(l.id)));
        qs = [];
        for (let k = 0; qs.length < count && k < count * 4; k++) {
          const lab = labs[k % labs.length], gen = U.pick(lab.problems);
          try { const p = gen.gen(); p.type = gen.name; qs.push({ lab, p, given: null, ok: null }); } catch (err) { console.error(err); }
        }
        i = 0; ask();
      });
    }
    function ask() {
      const q = qs[i], p = q.p;
      const input = p.kind === 'choice' ? `<div class="choices">${p.choices.map((c, k) => `<button type="button" class="choice" data-i="${k}">${c}</button>`).join('')}</div>`
        : `<form class="ans" novalidate><input id="ex-ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${U.esc(p.ph || (p.kind === 'num' ? 'e.g. 2.5 or 6.02e23' : 'type your answer'))}" inputmode="${p.kind === 'num' ? 'decimal' : 'text'}" aria-label="Your answer">${p.unit ? `<span class="unit">${p.unit}</span>` : ''}<button class="btn primary" type="submit">Submit</button></form>`;
      const right = qs.filter(x => x.ok).length;
      app.innerHTML = `<div class="exam-top"><span class="eyebrow">Question ${i + 1} of ${qs.length}</span><span class="note">${right} right so far</span><button type="button" class="btn ghost" id="ex-quit">End test</button></div>
        <div class="exbar"><i style="width:${i / qs.length * 100}%"></i></div>
        <section class="panel-card exam-q"><div class="ptype">${chTag(q.lab)} · ${q.lab.title} · ${p.type}</div><div class="q">${p.q}</div>${input}<div class="fb" hidden></div>
          <div class="prow"><button type="button" class="btn ghost" id="ex-skip">Skip</button><button type="button" class="btn" id="ex-next" hidden>${i + 1 < qs.length ? 'Next question' : 'See results'}</button></div></section>`;
      const fb = app.querySelector('.fb'), nextB = app.querySelector('#ex-next');
      const done = (ok, given) => {
        q.ok = ok; q.given = given;
        const ts = Store.typeStat(q.lab.id, p.type); ts.a++; if (ok) ts.c++; recordSkill(q.lab.id, p.type, ok); Store.save();
        fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = `<div class="verdict">${ok ? 'Correct' : 'Incorrect'}</div>${ok ? '' : '<div class="note">The solution is in your results at the end.</div>'}`;
        app.querySelector('#ex-skip').hidden = true; nextB.hidden = false; nextB.focus();
        app.querySelectorAll('.choice, .ans input, .ans button').forEach(x => { x.disabled = true; });
      };
      if (p.kind === 'choice') app.querySelector('.choices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (!b || q.ok !== null) return; const ok = +b.dataset.i === p.answer; b.classList.add(ok ? 'right' : 'wrong'); done(ok, b.innerHTML); });
      else {
        const form = app.querySelector('form'), inp = form.querySelector('input');
        inp.focus();
        form.addEventListener('submit', e => { e.preventDefault(); if (q.ok !== null) return; const r = checkAnswer(p, inp.value); if (r === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = `<div class="verdict">Couldn't read that</div><div>${p.kind === 'num' ? 'Enter a number. Scientific notation works as 6.02e23.' : (p.hint || 'Check the format and try again.')}</div>`; return; } done(r, U.esc(inp.value)); });
      }
      app.querySelector('#ex-skip').addEventListener('click', () => { q.ok = false; q.given = '(skipped)'; Store.typeStat(q.lab.id, p.type).a++; recordSkill(q.lab.id, p.type, false); Store.save(); advance(); });
      nextB.addEventListener('click', advance);
      app.querySelector('#ex-quit').addEventListener('click', () => { qs = qs.slice(0, i + (q.ok !== null ? 1 : 0)); results(); });
    }
    function advance() { i++; if (i < qs.length) ask(); else results(); }
    function results() {
      if (!qs.length) { setup(); return; }
      const c = qs.filter(q => q.ok).length, byLab = {};
      qs.forEach(q => { const b = byLab[q.lab.id] || (byLab[q.lab.id] = { lab: q.lab, c: 0, n: 0 }); b.n++; if (q.ok) b.c++; });
      hist.list.push({ t: Date.now(), n: qs.length, c, ch: Object.values(byLab).map(b => b.lab).sort((a, b) => a.ch - b.ch).map(l => l.code || l.ch).join(', ') });
      if (hist.list.length > 30) hist.list.shift();
      Store.save();
      const pct = Math.round(c / qs.length * 100), missed = qs.filter(q => !q.ok);
      const grade = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Test results</p><h1>${c} of ${qs.length} correct · ${pct}%</h1><p class="lede">${pct >= 90 ? 'Excellent. You are ready for these chapters.' : pct >= 70 ? 'Solid. Review the misses below, then drill the weakest chapter.' : 'Keep going. Work through the solutions below, then practice the chapters with the lowest bars.'}</p></div><div class="grade-badge">${grade}</div></div>
        <section class="panel-card"><h2 class="mini-h">By chapter</h2>
          <div style="display:grid;gap:8px">${Object.values(byLab).sort((a, b) => a.c / a.n - b.c / b.n).map(b => `<a href="#${b.lab.id}" class="bar-row fam-${b.lab.fam}"><span>${chTag(b.lab)} · ${b.lab.title}</span><span class="meter"><i style="width:${b.c / b.n * 100}%"></i></span><span class="n">${b.c}/${b.n}</span></a>`).join('')}</div></section>
        ${missed.length ? `<section class="panel-card"><h2 class="mini-h">Review what you missed</h2><div style="display:grid;gap:14px">${missed.map(q => `<div class="review"><div class="ptype">${chTag(q.lab)} · ${q.p.type}</div><div class="q">${q.p.q}</div>
          <div>Your answer: <b>${q.given ?? '—'}</b></div><div>Correct: <b>${answerHTML(q.p)}</b></div>${q.p.explain ? `<div class="explain note">${q.p.explain}</div>` : ''}</div>`).join('')}</div></section>` : ''}
        <div class="btn-row"><button type="button" class="btn primary" id="ex-again">New test, same chapters</button><button type="button" class="btn" id="ex-setup">Change chapters</button></div>`;
      app.querySelector('#ex-again').addEventListener('click', () => { setup(); app.querySelector('#ex-go').click(); });
      app.querySelector('#ex-setup').addEventListener('click', setup);
      window.scrollTo(0, 0);
    }
    setup();
  },
});
