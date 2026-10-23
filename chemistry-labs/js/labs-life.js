'use strict';
/* Organic & biochem: Ch 18 Organic Chemistry, Ch 19 Biochemistry */

/* ================= Ch 18: Organic chemistry ================= */
const CPREFIX = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
const HC_TYPES = { alkane: ['ane', 1], alkene: ['ene', 2], alkyne: ['yne', 3] };
/* Straight-chain hydrocarbon with at most one multiple bond, starting at carbon p */
function hydrocarbon(n, type, p = 1) {
  const order = HC_TYPES[type][1];
  if (n < 2) type = 'alkane';
  const bonds = Array.from({ length: Math.max(0, n - 1) }, (_, i) => (type !== 'alkane' && i === p - 1 ? order : 1));
  const H = Array.from({ length: n }, (_, i) => 4 - (bonds[i - 1] || 0) - (bonds[i] || 0));
  const sym = { 1: '–', 2: '=', 3: '≡' };
  const group = h => 'C' + (h ? 'H' + (h > 1 ? h : '') : '');
  const condensed = H.map((h, i) => group(h) + (i < n - 1 ? sym[bonds[i]] : '')).join('');
  const hTotal = H.reduce((a, b) => a + b, 0);
  const suf = HC_TYPES[type][0];
  const name = (type !== 'alkane' && n >= 4 ? p + '-' : '') + CPREFIX[n] + suf;
  const alts = [name];
  if (type !== 'alkane' && n >= 4) alts.push(`${CPREFIX[n]}-${p}-${suf}`);
  if (type !== 'alkane' && n < 4) alts.push(`1-${CPREFIX[n]}${suf}`);
  if (n === 2 && type === 'alkene') alts.push('ethylene');
  if (n === 2 && type === 'alkyne') alts.push('acetylene');
  if (n === 3 && type === 'alkene') alts.push('propylene');
  return { n, type, p, bonds, H, condensed, formula: `C${n > 1 ? n : ''}H${hTotal}`, name, alts };
}
function structureSVG(hc) {
  const step = 74, x0 = 46, y = 70, W = x0 * 2 + step * (hc.n - 1), Hh = 140;
  const parts = [];
  const line = (x1, y1, x2, y2) => parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--ink)" stroke-width="2"/>`);
  const atom = (x, yy, s, cls) => parts.push(`<text x="${x}" y="${yy}" text-anchor="middle" dominant-baseline="central" class="${cls}">${s}</text>`);
  for (let i = 0; i < hc.n - 1; i++) {
    const xa = x0 + i * step + 12, xb = x0 + (i + 1) * step - 12, b = hc.bonds[i];
    const offs = b === 1 ? [0] : b === 2 ? [-4, 4] : [-6, 0, 6];
    offs.forEach(o => line(xa, y + o, xb, y + o));
  }
  hc.H.forEach((h, i) => {
    const x = x0 + i * step;
    atom(x, y, 'C', 'sc');
    const slots = [];
    if (i === 0) slots.push('l'); if (i === hc.n - 1) slots.push('r');
    slots.push('u', 'd');
    if (hc.n === 1) slots.splice(0, slots.length, 'l', 'r', 'u', 'd');
    slots.slice(0, h).forEach(s => {
      const [dx, dy] = { l: [-34, 0], r: [34, 0], u: [0, -36], d: [0, 36] }[s];
      line(x + dx * 0.36, y + dy * 0.38, x + dx * 0.72, y + dy * 0.7);
      atom(x + dx, y + dy, 'H', 'sh');
    });
  });
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="Structural formula of ${hc.name}" style="max-width:none">
    <style>.sc{font:700 20px var(--body);fill:var(--ink)}.sh{font:400 16px var(--body);fill:var(--muted)}</style>${parts.join('')}</svg>`;
}
const FGROUPS = [
  { g: 'Alcohol', f: 'R–OH', end: '-ol', ex: 'CH3CH2OH', exn: 'ethanol (drinking alcohol)', note: 'The –OH can hydrogen bond, so alcohols boil much higher than alkanes of similar size.' },
  { g: 'Ether', f: 'R–O–R′', end: 'name both groups + ether', ex: 'CH3CH2OCH2CH3', exn: 'diethyl ether (early anesthetic)', note: 'An oxygen between two carbon groups. No O–H, so no hydrogen bonding between ether molecules.' },
  { g: 'Aldehyde', f: 'R–CHO', end: '-al', ex: 'CH3CHO', exn: 'ethanal (acetaldehyde)', note: 'C=O at the end of the chain. Many have strong smells, like cinnamaldehyde in cinnamon.' },
  { g: 'Ketone', f: 'R–CO–R′', end: '-one', ex: 'CH3COCH3', exn: 'propanone (acetone, nail polish remover)', note: 'C=O in the middle of the chain, bonded to two carbons.' },
  { g: 'Carboxylic acid', f: 'R–COOH', end: '-oic acid', ex: 'CH3COOH', exn: 'ethanoic acid (acetic acid, in vinegar)', note: 'Weak acids: the H on –COOH can be donated.' },
  { g: 'Ester', f: 'R–COO–R′', end: '-oate', ex: 'CH3CH2CH2COOCH2CH3', exn: 'ethyl butanoate (pineapple flavor)', note: 'Made from an acid + an alcohol. Responsible for many fruit smells.' },
  { g: 'Amine', f: 'R–NH2', end: '-amine', ex: 'CH3NH2', exn: 'methylamine', note: 'Organic relatives of ammonia; weak bases. Many smell fishy.' },
  { g: 'Haloalkane', f: 'R–X (X = F, Cl, Br, I)', end: 'halo- prefix', ex: 'CH3CH2Cl', exn: 'chloroethane', note: 'A halogen replaces a hydrogen. Used as solvents and refrigerants.' },
];
const FG_EXAMPLES = [['CH3CH2OH', 'Alcohol'], ['CH3CH2CH2OH', 'Alcohol'], ['CH3OH', 'Alcohol'], ['CH3OCH3', 'Ether'], ['CH3CH2OCH2CH3', 'Ether'], ['CH3CHO', 'Aldehyde'], ['HCHO', 'Aldehyde'], ['CH3CH2CHO', 'Aldehyde'], ['CH3COCH3', 'Ketone'], ['CH3CH2COCH3', 'Ketone'], ['CH3COOH', 'Carboxylic acid'], ['HCOOH', 'Carboxylic acid'], ['CH3CH2COOH', 'Carboxylic acid'], ['CH3COOCH2CH3', 'Ester'], ['HCOOCH3', 'Ester'], ['CH3NH2', 'Amine'], ['CH3CH2NH2', 'Amine'], ['CH3Cl', 'Haloalkane'], ['CH3CH2Br', 'Haloalkane']];
const ISOMERS = { 4: 2, 5: 3, 6: 5, 7: 9, 8: 18 };
const fmtOrg = s => s.replace(/(\d+)/g, '<sub>$1</sub>');

registerLab({
  id: 'organic', ch: 18, sym: 'Or', fam: 'life',
  title: 'Organic Molecules', chapter: 'Organic Chemistry',
  blurb: 'Build hydrocarbon chains bond by bond, watch the name and formula update, and learn to spot the functional groups.',
  ideas: [
    'Organic chemistry is the chemistry of carbon compounds. Carbon makes <b>4 bonds</b>, so it can form long chains, branches and rings.',
    '<b>Alkanes</b> have only single bonds: C<sub>n</sub>H<sub>2n+2</sub> (saturated). <b>Alkenes</b> have a C=C double bond: C<sub>n</sub>H<sub>2n</sub>. <b>Alkynes</b> have a C≡C triple bond: C<sub>n</sub>H<sub>2n−2</sub>.',
    'Chain-length prefixes: meth (1), eth (2), prop (3), but (4), pent (5), hex (6), hept (7), oct (8), non (9), dec (10). Endings: -ane, -ene, -yne.',
    'For 4 or more carbons, number the chain from the end nearest the multiple bond: CH<sub>3</sub>CH=CHCH<sub>2</sub>CH<sub>3</sub> is 2-pentene.',
    '<b>Isomers</b> share a molecular formula but differ in structure. Butane and isobutane are both C<sub>4</sub>H<sub>10</sub>.',
    '<b>Functional groups</b> set a molecule\'s behavior: alcohol –OH, ether –O–, aldehyde –CHO, ketone –CO–, carboxylic acid –COOH, ester –COO–, amine –NH<sub>2</sub>.',
  ],
  bench(el) {
    let n = 5, type = 'alkene', p = 2;
    el.innerHTML = `
      <div class="panel">
        <h3>Hydrocarbon builder</h3>
        <p class="sub">Set the chain length and bond type. Every carbon keeps exactly four bonds.</p>
        <div class="row">${UI.stepper('hc-n', 'Carbons', n)}<div class="stepper"><span class="lbl">Bond type</span><div class="seg" id="hc-t">${Object.keys(HC_TYPES).map(t => `<button type="button" data-t="${t}" aria-pressed="${t === type}">${t}</button>`).join('')}</div></div>${UI.stepper('hc-p', 'Position', p)}</div>
        <div id="hc-out" style="display:grid;gap:12px"></div>
      </div>
      <div class="panel">
        <h3>Functional groups</h3>
        <p class="sub">Swap a hydrogen for one of these groups and the molecule's properties change.</p>
        <div class="seg" id="fg-pick">${FGROUPS.map((g, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${g.g}</button>`).join('')}</div>
        <div id="fg-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    function draw() {
      const maxP = Math.max(1, Math.floor(n / 2));
      if (type !== 'alkane' && n < 2) n = 2;
      p = U.clamp(p, 1, maxP);
      $('#hc-n').textContent = n; $('#hc-p').textContent = type === 'alkane' || n < 4 ? '—' : p;
      el.querySelectorAll('#hc-t button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === type)));
      const hc = hydrocarbon(n, type, p), gen = { alkane: '2n+2', alkene: '2n', alkyne: '2n−2' }[type];
      $('#hc-out').innerHTML = `<div class="row" style="align-items:baseline;gap:16px"><span class="big-formula">${hc.name}</span><span class="readout">${fmtF(hc.formula)}</span></div>
        <div class="canvas-wrap scroll" style="padding:4px">${structureSVG(hc)}</div>
        ${UI.kv([['Condensed', fmtOrg(hc.condensed)], ['General formula', `C<sub>n</sub>H<sub>${gen}</sub>`], ['Molar mass', Chem.molarMass(hc.formula).toFixed(2) + ' g/mol'], ['Saturated?', type === 'alkane' ? 'yes' : 'no']])}
        ${type !== 'alkane' && n >= 4 ? `<p class="note">Number from the end closer to the ${type === 'alkene' ? 'double' : 'triple'} bond, so the position is ${p}, not ${n - p}.</p>` : ''}
        ${ISOMERS[n] && type === 'alkane' ? `<p class="note">${fmtF(hc.formula)} has ${ISOMERS[n]} structural isomers. This is the straight-chain one.</p>` : ''}`;
    }
    wireSteppers(el, (id, d) => { if (id === 'hc-n') n = U.clamp(n + d, 1, 10); if (id === 'hc-p') p += d; draw(); });
    $('#hc-t').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { type = b.dataset.t; draw(); } });
    function fg(i) {
      const g = FGROUPS[i];
      el.querySelectorAll('#fg-pick button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      $('#fg-out').innerHTML = `${UI.kv([['General form', g.f.replace(/(\d)/g, '<sub>$1</sub>')], ['Name ending', g.end], ['Example', `${fmtOrg(g.ex)}`], ['Its name', g.exn]])}<p class="note" style="margin-top:8px">${g.note}</p>`;
    }
    $('#fg-pick').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) fg(+b.dataset.i); });
    draw(); fg(0);
  },
  problems: [
    { name: 'Name the hydrocarbon', gen() {
      const type = U.pick(Object.keys(HC_TYPES)), n = U.ri(type === 'alkane' ? 1 : 2, 10), p = U.ri(1, Math.max(1, Math.floor(n / 2))), hc = hydrocarbon(n, type, p);
      return { kind: 'text', ph: 'e.g. 2-hexene', q: `Name this compound:<span class="eqline">${fmtOrg(hc.condensed)}</span>`, answer: hc.alts, display: hc.name,
        explain: `${n} carbon${n > 1 ? 's' : ''} → "${CPREFIX[n]}". ${type === 'alkane' ? 'Only single bonds → -ane.' : `A ${type === 'alkene' ? 'double' : 'triple'} bond → -${HC_TYPES[type][0]}.`}${type !== 'alkane' && n >= 4 ? ` Counting from the nearer end, it starts at carbon ${p}.` : ''} Name: <b>${hc.name}</b>.` };
    } },
    { name: 'Formula from name', gen() {
      const type = U.pick(Object.keys(HC_TYPES)), n = U.ri(type === 'alkane' ? 1 : 2, 10), p = U.ri(1, Math.max(1, Math.floor(n / 2))), hc = hydrocarbon(n, type, p);
      return { kind: 'counts', ph: 'e.g. C5H10', q: `What is the molecular formula of <b>${hc.name}</b>?`, answer: hc.formula,
        explain: `${CPREFIX[n]} = ${n} C. For an ${type}, H = ${{ alkane: '2n + 2', alkene: '2n', alkyne: '2n − 2' }[type]} = ${hc.formula.split('H')[1]}. Formula: <b>${fmtF(hc.formula)}</b>.` };
    } },
    { name: 'Alkane, alkene or alkyne', gen() {
      const type = U.pick(Object.keys(HC_TYPES)), n = U.ri(2, 10), hc = hydrocarbon(n, type, 1);
      return { ...mc(type, Object.keys(HC_TYPES)), q: `A straight-chain hydrocarbon (no rings, at most one multiple bond) has the formula <b style="font-size:1.2em">${fmtF(hc.formula)}</b>. What kind is it?`,
        explain: `With n = ${n}: alkane would be C${n}H${2 * n + 2}, alkene C${n}H${2 * n}, alkyne C${n}H${2 * n - 2}. This matches the <b>${type}</b>.` };
    } },
    { name: 'Functional group', gen() {
      const [f, g] = U.pick(FG_EXAMPLES), info = FGROUPS.find(x => x.g === g);
      return { ...mc(g, U.shuffle(FGROUPS.map(x => x.g).filter(x => x !== g)).slice(0, 3)), q: `Which functional group is in <b style="font-size:1.15em">${fmtOrg(f)}</b>?`,
        explain: `${g}: general form ${info.f}. ${info.note}` };
    } },
    { name: 'Counting isomers', gen() {
      const n = U.ri(4, 7), ans = String(ISOMERS[n]);
      return { ...mc(ans, ['1', '2', '3', '4', '5', '6', '9'].filter(x => x !== ans).sort(() => Math.random() - 0.5).slice(0, 3)), q: `How many structural isomers does the alkane <b>${fmtF(hydrocarbon(n, 'alkane').formula)}</b> have?`,
        explain: `Count every distinct way to connect ${n} carbons (straight chain plus branched versions): <b>${ans}</b>. Isomers have the same formula but different structures and properties.` };
    } },
  ],
});

/* ================= Ch 19: Biochemistry ================= */
const CODONS = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const AA = { F: ['Phe', 'phenylalanine'], L: ['Leu', 'leucine'], S: ['Ser', 'serine'], Y: ['Tyr', 'tyrosine'], C: ['Cys', 'cysteine'], W: ['Trp', 'tryptophan'], P: ['Pro', 'proline'], H: ['His', 'histidine'], Q: ['Gln', 'glutamine'], R: ['Arg', 'arginine'], I: ['Ile', 'isoleucine'], M: ['Met', 'methionine (start)'], T: ['Thr', 'threonine'], N: ['Asn', 'asparagine'], K: ['Lys', 'lysine'], V: ['Val', 'valine'], A: ['Ala', 'alanine'], D: ['Asp', 'aspartic acid'], E: ['Glu', 'glutamic acid'], G: ['Gly', 'glycine'], '*': ['Stop', 'stop codon'] };

function codeTableHTML() {
  const B = 'UCAG';
  const rows = [...B].map((b1, i) => `<tr><th>${b1}</th>${[...B].map((b2, j) => `<td>${[...B].map((b3, k) => { const a = CODONS[i * 16 + j * 4 + k]; return `${b1}${b2}${b3} ${AA[a][0]}`; }).join('<br>')}</td>`).join('')}</tr>`).join('');
  return `<details class="codetab"><summary>Show the genetic code</summary><div class="scroll"><table class="t" style="font-family:var(--mono);font-size:.78rem"><tr><th></th>${[...B].map(b => `<th>${b}</th>`).join('')}</tr>${rows}</table></div><p class="note">Row: first base. Column: second base. Then find the third base in the cell.</p></details>`;
}
const translateCodon = c => CODONS['UCAG'.indexOf(c[0]) * 16 + 'UCAG'.indexOf(c[1]) * 4 + 'UCAG'.indexOf(c[2])];
const DNA_PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' }, RNA_PAIR = { A: 'U', T: 'A', G: 'C', C: 'G' };
const randBases = (n, set = 'ATGC') => Array.from({ length: n }, () => set[U.ri(0, 3)]).join('');
const BIOMOLECULES = [
  ['glucose', 'Carbohydrate'], ['starch', 'Carbohydrate'], ['cellulose', 'Carbohydrate'], ['sucrose (table sugar)', 'Carbohydrate'], ['glycogen', 'Carbohydrate'], ['fructose', 'Carbohydrate'],
  ['a triglyceride (fat)', 'Lipid'], ['cholesterol', 'Lipid'], ['a phospholipid', 'Lipid'], ['a fatty acid', 'Lipid'], ['olive oil', 'Lipid'], ['testosterone', 'Lipid'],
  ['hemoglobin', 'Protein'], ['an enzyme such as amylase', 'Protein'], ['collagen', 'Protein'], ['insulin', 'Protein'], ['keratin (in hair)', 'Protein'],
  ['DNA', 'Nucleic acid'], ['messenger RNA', 'Nucleic acid'], ['transfer RNA', 'Nucleic acid'],
];
const BIO_INFO = {
  Carbohydrate: ['monosaccharides (simple sugars like glucose)', 'Energy (glucose, starch, glycogen) and structure (cellulose in plants). Formula often C<sub>n</sub>(H<sub>2</sub>O)<sub>n</sub>.'],
  Lipid: ['glycerol and fatty acids (fats are not true polymers: one glycerol holds 3 fatty acids)', 'Insoluble in water. Long-term energy storage, cell membranes (phospholipids) and hormones (steroids).'],
  Protein: ['amino acids, joined by peptide bonds', 'Enzymes, structure, transport, hormones. The amino acid sequence folds into a unique 3D shape.'],
  'Nucleic acid': ['nucleotides (sugar + phosphate + base)', 'Store and transmit genetic information. DNA bases A, T, G, C; RNA uses U instead of T.'],
};

registerLab({
  id: 'biochem', ch: 19, sym: 'Bi', fam: 'life',
  title: 'DNA to Protein', chapter: 'Biochemistry',
  blurb: 'Type a DNA strand and follow it through transcription to mRNA and translation to a protein, then mutate one base to see what changes.',
  ideas: [
    'The four classes of biomolecules: <b>carbohydrates</b>, <b>lipids</b>, <b>proteins</b> and <b>nucleic acids</b>.',
    'Proteins are chains of <b>amino acids</b> joined by peptide bonds. Their sequence determines how they fold and what they do.',
    'DNA is a double helix. Bases pair <b>A–T</b> and <b>G–C</b>, held by hydrogen bonds. RNA uses <b>U</b> in place of T.',
    '<b>Transcription:</b> DNA template → mRNA (A→U, T→A, G→C, C→G).',
    '<b>Translation:</b> the ribosome reads mRNA three bases at a time. Each <b>codon</b> codes for one amino acid. AUG = start (Met); UAA, UAG, UGA = stop.',
    'A single base change (point mutation) can do nothing (silent), swap one amino acid (missense), or cut the protein short (nonsense).',
  ],
  bench(el) {
    let dna = 'TACCGGTTTAAGCCTATT', note = '';
    el.innerHTML = `
      <style>
        .strand{display:flex;gap:2px;font-family:var(--mono);font-weight:600;font-size:1.05rem;min-width:max-content}
        .strand span{width:24px;text-align:center;padding:3px 0;border-radius:4px}
        .b-A{background:color-mix(in srgb,var(--c2) 22%,var(--raised))}.b-T,.b-U{background:color-mix(in srgb,var(--c1) 22%,var(--raised))}.b-G{background:color-mix(in srgb,var(--c3) 24%,var(--raised))}.b-C{background:color-mix(in srgb,var(--f-nuc) 20%,var(--raised))}
        .strand span.mut{outline:2.5px solid var(--ink)}
        .lbl-row{display:grid;grid-template-columns:110px auto;gap:10px;align-items:center}
        .codons{display:flex;gap:6px;flex-wrap:wrap}
        .codon{display:grid;justify-items:center;gap:2px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;background:var(--raised);min-width:62px}
        .codon .cb{font-family:var(--mono);font-weight:600}.codon .aa{font-weight:700}.codon.stop{border-color:var(--bad)}.codon.start{border-color:var(--good)}.codon.dead{opacity:.35}
      </style>
      <div class="panel">
        <h3>Transcription and translation</h3>
        <p class="sub">The strand you type is the DNA template. Only A, T, G and C count.</p>
        <div class="row">${UI.text('dn-in', 'DNA template strand (3′ → 5′)', dna, 'e.g. TACGGA…')}</div>
        <div class="btn-row"><button type="button" class="btn" id="dn-mut">Mutate one base</button><button type="button" class="btn ghost" id="dn-rand">Random gene</button><button type="button" class="btn ghost" id="dn-reset">Reset</button></div>
        <div id="dn-out" style="display:grid;gap:12px"></div>
      </div>
      <div class="panel">
        <h3>The four biomolecules</h3>
        <div class="seg" id="bm-pick">${Object.keys(BIO_INFO).map((k, i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}">${k}</button>`).join('')}</div>
        <div id="bm-out"></div>
      </div>`;
    const $ = s => el.querySelector(s);
    let lastMut = -1;
    function protein(mrna) { const out = []; let started = false, stopped = false; for (let i = 0; i + 2 < mrna.length; i += 3) { const c = mrna.slice(i, i + 3), a = translateCodon(c); const live = started && !stopped || (!started && a === 'M'); if (a === 'M' && !started) started = true; out.push({ c, a, live: live && !stopped }); if (started && a === '*') stopped = true; } return out; }
    function draw() {
      const clean = dna.toUpperCase().replace(/[^ATGC]/g, '');
      const coding = [...clean].map(b => DNA_PAIR[b]).join(''), mrna = [...clean].map(b => RNA_PAIR[b]).join('');
      const strand = (s, mark) => `<div class="strand">${[...s].map((b, i) => `<span class="b-${b}${i === mark ? ' mut' : ''}">${b}</span>`).join('')}</div>`;
      const cods = protein(mrna), chain = cods.filter(x => x.live && x.a !== '*').map(x => AA[x.a][0]);
      $('#dn-out').innerHTML = !clean ? '<div class="callout warn">Type some bases (A, T, G, C).</div>' : `
        <div class="scroll" style="display:grid;gap:6px">
          <div class="lbl-row"><span class="lbl">Template DNA</span>${strand(clean, lastMut)}</div>
          <div class="lbl-row"><span class="lbl">Partner DNA</span>${strand(coding)}</div>
          <div class="lbl-row"><span class="lbl">mRNA (5′ → 3′)</span>${strand(mrna, lastMut)}</div>
        </div>
        <div class="codons">${cods.map(x => `<div class="codon${x.a === '*' ? ' stop' : x.a === 'M' && x.live ? ' start' : ''}${x.live ? '' : ' dead'}"><span class="cb">${x.c}</span><span class="aa">${AA[x.a][0]}</span></div>`).join('')}</div>
        <div class="callout">${chain.length ? `<b>Protein:</b> ${chain.join('–')}${cods.some(x => x.live && x.a === '*') ? ' (stops at the stop codon)' : ' (no stop codon yet)'}` : 'No AUG start codon, so translation never begins. Faded codons are not read.'}</div>
        ${note ? `<div class="callout ${/nonsense/.test(note) ? 'bad' : /silent/.test(note) ? 'good' : 'warn'}">${note}</div>` : ''}`;
    }
    $('#dn-in').addEventListener('input', e => { dna = e.target.value; note = ''; lastMut = -1; draw(); });
    $('#dn-mut').addEventListener('click', () => {
      const clean = dna.toUpperCase().replace(/[^ATGC]/g, ''); if (clean.length < 6) return;
      const before = protein([...clean].map(b => RNA_PAIR[b]).join(''));
      const i = U.ri(3, Math.floor(clean.length / 3) * 3 - 1), old = clean[i], nb = U.pick('ATGC'.replace(old, '').split(''));
      dna = clean.slice(0, i) + nb + clean.slice(i + 1); lastMut = i; $('#dn-in').value = dna;
      const after = protein([...dna].map(b => RNA_PAIR[b]).join('')), k = Math.floor(i / 3), a0 = before[k]?.a, a1 = after[k]?.a;
      note = `Base ${i + 1} changed ${old} → ${nb}: codon ${before[k].c} → ${after[k].c}. ` + (a0 === a1 ? `Still ${AA[a1][0]}: a <b>silent</b> mutation.` : a1 === '*' ? `${AA[a0][0]} became a stop codon: a <b>nonsense</b> mutation that cuts the protein short.` : a0 === '*' ? `The stop codon became ${AA[a1][0]}, so the protein keeps growing.` : `${AA[a0][0]} became ${AA[a1][0]}: a <b>missense</b> mutation.`);
      draw();
    });
    $('#dn-rand').addEventListener('click', () => { let s = 'TAC'; for (let k = 0; k < U.ri(3, 6); k++) { let c; do c = randBases(3); while (['ATT', 'ATC', 'ACT'].includes(c)); s += c; } dna = s + U.pick(['ATT', 'ATC', 'ACT']); note = ''; lastMut = -1; $('#dn-in').value = dna; draw(); });
    $('#dn-reset').addEventListener('click', () => { dna = 'TACCGGTTTAAGCCTATT'; note = ''; lastMut = -1; $('#dn-in').value = dna; draw(); });
    function bm(k) {
      el.querySelectorAll('#bm-pick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      const [mono, role] = BIO_INFO[k];
      $('#bm-out').innerHTML = `${UI.kv([['Built from', mono], ['Examples', BIOMOLECULES.filter(b => b[1] === k).map(b => b[0]).slice(0, 4).join(', ')]])}<p class="note" style="margin-top:8px">${role}</p>`;
    }
    $('#bm-pick').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) bm(b.dataset.k); });
    draw(); bm('Carbohydrate');
  },
  problems: [
    { name: 'Complementary DNA', gen() {
      const s = randBases(U.ri(8, 12)), ans = [...s].map(b => DNA_PAIR[b]).join('');
      return { kind: 'text', ph: 'letters only, e.g. ATGC…', q: `Write the complementary DNA strand for <b style="font-family:var(--mono);letter-spacing:.08em">${s}</b>.`, answer: ans,
        check: r => { const v = r.toUpperCase().replace(/[^A-Z]/g, ''); return v ? v === ans : null; }, explain: `Pair A with T and G with C, base by base: <b style="font-family:var(--mono)">${ans}</b>.` };
    } },
    { name: 'Transcribe to mRNA', gen() {
      const s = randBases(U.ri(8, 12)), ans = [...s].map(b => RNA_PAIR[b]).join('');
      return { kind: 'text', ph: 'letters only, e.g. AUGC…', q: `Transcribe this DNA template strand into mRNA: <b style="font-family:var(--mono);letter-spacing:.08em">${s}</b>`, answer: ans,
        check: r => { const v = r.toUpperCase().replace(/[^A-Z]/g, ''); return v ? v === ans : null; }, explain: `A → U, T → A, G → C, C → G. RNA has U instead of T: <b style="font-family:var(--mono)">${ans}</b>.` };
    } },
    { name: 'Read a codon', gen() {
      let c, a; do { c = randBases(3, 'UCAG'); a = translateCodon(c); } while (a === '*' && Math.random() < 0.7);
      const right = `${AA[a][0]} (${AA[a][1]})`, others = U.shuffle(Object.keys(AA).filter(k => k !== a)).slice(0, 3).map(k => `${AA[k][0]} (${AA[k][1]})`);
      return { ...mc(right, others), q: `Using the genetic code, what does the mRNA codon <b style="font-family:var(--mono);font-size:1.2em">${c}</b> code for?${codeTableHTML()}`, explain: `${c} → <b>${right}</b>. ${a === '*' ? 'Stop codons (UAA, UAG, UGA) end translation.' : 'Look up the first base (row), second base (column), then third base.'}` };
    } },
    { name: 'Translate mRNA', gen() {
      const cods = ['AUG']; for (let k = 0; k < U.ri(2, 3); k++) { let c; do c = randBases(3, 'UCAG'); while (translateCodon(c) === '*'); cods.push(c); }
      const seq = cods.map(c => AA[translateCodon(c)][0]), ans = seq.join('-');
      return { kind: 'text', ph: 'e.g. Met-Gly-Ser', q: `Translate this mRNA into amino acids (three-letter codes, separated by dashes): <b style="font-family:var(--mono);letter-spacing:.06em">${cods.join(' ')}</b>${codeTableHTML()}`, answer: ans,
        check: r => { const v = r.toLowerCase().replace(/[^a-z]/g, ''); return v ? v === seq.join('').toLowerCase() : null; }, explain: cods.map((c, k) => `${c} → ${seq[k]}`).join(', ') + `. Protein: <b>${ans}</b>.` };
    } },
    { name: 'Classify the biomolecule', gen() {
      const [item, cls] = U.pick(BIOMOLECULES);
      return { ...mc(cls, Object.keys(BIO_INFO)), q: `Which class of biomolecule is <b>${item}</b>?`, explain: `${cls}s are built from ${BIO_INFO[cls][0]}. ${BIO_INFO[cls][1]}` };
    } },
    { name: 'Building blocks', gen() {
      const map = [['Proteins', 'Amino acids'], ['Starch and cellulose', 'Glucose'], ['DNA and RNA', 'Nucleotides'], ['Triglycerides (fats)', 'Glycerol and fatty acids']];
      const [poly, mono] = U.pick(map);
      return { ...mc(mono, map.map(m => m[1])), q: `What are <b>${poly.toLowerCase()}</b> built from?`, explain: `${poly} are made from <b>${mono.toLowerCase()}</b>. ${poly.startsWith('Tri') ? 'Fats are not true polymers: each has one glycerol and three fatty acids.' : 'Many small units join, releasing water each time (a condensation reaction).'}` };
    } },
  ],
});
