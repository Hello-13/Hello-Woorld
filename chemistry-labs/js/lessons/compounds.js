'use strict';
/* Ch 5 · Molecules and Compounds: formulas, ions, and the full naming system */

{
  // ---------- small SVG helpers ----------
  const arrow = (x1, y1, x2, y2, color = 'currentColor') => {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 8, w = 4.5;
    const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a), px = -Math.sin(a) * w, py = Math.cos(a) * w;
    return `<line x1="${x1}" y1="${y1}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" style="stroke:${color}" stroke-width="1.6"/>`
      + `<polygon points="${x2},${y2} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}" style="fill:${color}"/>`;
  };
  // a box with centered lines; result boxes are tinted and have bold titles
  const box = (x, y, w, h, lines, opt = {}) => {
    const { result = false, bold = result ? 1 : 0 } = opt;
    const fill = result ? 'fill:color-mix(in srgb, var(--accent) 16%, transparent)' : 'fill:none';
    const y0 = y + h / 2 - (lines.length - 1) * 8 + 4.5;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" style="${fill};stroke:${result ? 'var(--accent)' : 'currentColor'}" stroke-width="1.3"/>`
      + lines.map((t, i) => `<text x="${x + w / 2}" y="${y0 + i * 16}" text-anchor="middle" font-size="${i < bold ? 13 : 12}" ${i < bold ? 'font-weight="700"' : ''} fill="currentColor">${t}</text>`).join('');
  };
  const lbl = (x, y, t) => `<text x="${x}" y="${y}" font-size="12" text-anchor="middle" style="fill:var(--muted)">${t}</text>`;

  // ---------- figure: four kinds of pure substance ----------
  const kinds = `<svg viewBox="0 0 560 262" width="560" role="img" aria-label="Decision tree. One element: if it is bonded into molecules it is a molecular element, otherwise an atomic element. Two or more elements: if a metal or ammonium is present it is an ionic compound, otherwise a molecular compound."><g style="color:var(--ink)">
    ${box(120, 8, 320, 40, ['Pure substance: how many elements?'])}
    ${arrow(220, 48, 140, 92)}${arrow(340, 48, 420, 92)}${lbl(160, 70, 'one')}${lbl(410, 70, 'two or more')}
    ${box(20, 92, 240, 52, ['Bonded into molecules?', 'H₂ N₂ O₂ F₂ Cl₂ Br₂ I₂ P₄ S₈'])}
    ${box(300, 92, 240, 52, ['Metal or NH₄⁺ present?'])}
    ${arrow(100, 144, 75, 186)}${arrow(180, 144, 205, 186)}${arrow(380, 144, 355, 186)}${arrow(460, 144, 485, 186)}
    ${lbl(76, 166, 'no')}${lbl(206, 166, 'yes')}${lbl(354, 166, 'yes')}${lbl(486, 166, 'no')}
    ${box(12, 186, 126, 70, ['Atomic', 'element', 'He, Fe, Na'], { result: true, bold: 2 })}
    ${box(146, 186, 126, 70, ['Molecular', 'element', 'O₂, Cl₂, P₄'], { result: true, bold: 2 })}
    ${box(288, 186, 126, 70, ['Ionic', 'compound', 'NaCl, NH₄Cl'], { result: true, bold: 2 })}
    ${box(422, 186, 126, 70, ['Molecular', 'compound', 'H₂O, CO₂'], { result: true, bold: 2 })}
  </g></svg><figcaption>Two questions sort every pure substance. Metals and noble gases are atomic elements.</figcaption>`;

  // ---------- figure: ion charges by group ----------
  const cols = [['1A', '1+', ['Li', 'Na', 'K'], 'c'], ['2A', '2+', ['Mg', 'Ca', 'Ba'], 'c'], null, ['3A', '3+', ['Al'], 'c'], ['4A', '—', ['C', 'Si'], 'n'],
    ['5A', '3−', ['N', 'P'], 'a'], ['6A', '2−', ['O', 'S'], 'a'], ['7A', '1−', ['F', 'Cl', 'Br', 'I'], 'a'], ['8A', '0', ['He', 'Ne', 'Ar'], 'n']];
  const tone = { c: 'var(--accent)', a: 'var(--warn)', n: 'var(--muted)' };
  let gx = 10, groups = '';
  cols.forEach(c => {
    if (!c) {
      groups += `<rect x="${gx}" y="8" width="128" height="148" rx="6" style="fill:color-mix(in srgb, var(--accent) 8%, transparent);stroke:var(--accent)" stroke-width="1"/>
        <text x="${gx + 64}" y="26" font-size="12" text-anchor="middle" style="fill:var(--muted)">Transition</text>
        <text x="${gx + 64}" y="54" font-size="17" font-weight="700" text-anchor="middle" style="fill:var(--accent)">varies</text>
        <text x="${gx + 64}" y="80" font-size="12" text-anchor="middle" fill="currentColor">Fe²⁺ or Fe³⁺</text>
        <text x="${gx + 64}" y="96" font-size="12" text-anchor="middle" fill="currentColor">Cu⁺ or Cu²⁺</text>
        <text x="${gx + 64}" y="120" font-size="12" text-anchor="middle" fill="currentColor">fixed:</text>
        <text x="${gx + 64}" y="136" font-size="12" text-anchor="middle" fill="currentColor">Zn²⁺, Ag⁺</text>`;
      gx += 132; return;
    }
    const [g, q, els, t] = c;
    groups += `<rect x="${gx}" y="8" width="48" height="148" rx="6" style="fill:color-mix(in srgb, ${tone[t]} 10%, transparent);stroke:${tone[t]}" stroke-width="1"/>
      <text x="${gx + 24}" y="26" font-size="12" text-anchor="middle" style="fill:var(--muted)">${g}</text>
      <text x="${gx + 24}" y="54" font-size="20" font-weight="700" text-anchor="middle" style="fill:${tone[t]}">${q}</text>
      ${els.map((e, i) => `<text x="${gx + 24}" y="${80 + i * 16}" font-size="12" text-anchor="middle" fill="currentColor">${e}</text>`).join('')}`;
    gx += 52;
  });
  const charges = `<svg viewBox="0 0 560 190" width="560" role="img" aria-label="Ion charges by group: 1A is 1 plus, 2A is 2 plus, aluminum 3 plus, transition metals vary except zinc 2 plus and silver 1 plus, 5A is 3 minus, 6A is 2 minus, 7A is 1 minus, noble gases form no ions."><g style="color:var(--ink)">${groups}
    <text x="10" y="180" font-size="12" style="fill:var(--accent)">Metals lose electrons: cations (+)</text>
    <text x="550" y="180" font-size="12" text-anchor="end" style="fill:var(--warn)">Nonmetals gain electrons: anions (−)</text></g></svg>
    <figcaption>Main-group charges follow the group number. Most transition metals need a Roman numeral because their charge varies.</figcaption>`;

  // ---------- figure: criss-cross ----------
  const cross = `<svg viewBox="0 0 560 162" width="560" role="img" aria-label="Criss-cross: Al 3 plus and O 2 minus give Al2O3. Pb 4 plus and O 2 minus give Pb2O4, which reduces to PbO2."><g style="color:var(--ink)">
    <text x="70" y="66" font-size="30" font-weight="700" text-anchor="middle" fill="currentColor">Al</text><text x="70" y="24" font-size="18" font-weight="700" text-anchor="middle" style="fill:var(--accent)">3+</text>
    <text x="170" y="66" font-size="30" font-weight="700" text-anchor="middle" fill="currentColor">O</text><text x="170" y="24" font-size="18" font-weight="700" text-anchor="middle" style="fill:var(--warn)">2−</text>
    ${arrow(78, 30, 182, 78, 'var(--accent)')}${arrow(162, 30, 86, 78, 'var(--warn)')}
    <text x="135" y="118" font-size="28" font-weight="700" text-anchor="middle" style="fill:var(--accent)">Al₂O₃</text>
    <text x="135" y="148" font-size="13" text-anchor="middle" style="fill:var(--muted)">2(+3) + 3(−2) = 0 ✓</text>
    <line x1="280" y1="10" x2="280" y2="152" style="stroke:var(--muted)" stroke-dasharray="4 4"/>
    <text x="350" y="66" font-size="30" font-weight="700" text-anchor="middle" fill="currentColor">Pb</text><text x="350" y="24" font-size="18" font-weight="700" text-anchor="middle" style="fill:var(--accent)">4+</text>
    <text x="450" y="66" font-size="30" font-weight="700" text-anchor="middle" fill="currentColor">O</text><text x="450" y="24" font-size="18" font-weight="700" text-anchor="middle" style="fill:var(--warn)">2−</text>
    ${arrow(358, 30, 462, 78, 'var(--accent)')}${arrow(442, 30, 366, 78, 'var(--warn)')}
    <text x="362" y="118" font-size="22" text-anchor="middle" style="fill:var(--muted)">Pb₂O₄</text>
    ${arrow(400, 110, 452, 110)}<text x="426" y="100" font-size="12" text-anchor="middle" style="fill:var(--muted)">÷ 2</text>
    <text x="496" y="118" font-size="28" font-weight="700" text-anchor="middle" style="fill:var(--accent)">PbO₂</text>
    <text x="420" y="148" font-size="13" text-anchor="middle" style="fill:var(--muted)">1(+4) + 2(−2) = 0 ✓</text>
  </g></svg><figcaption>Each charge number drops down to become the other ion's subscript. Then reduce to the lowest ratio.</figcaption>`;

  // ---------- figure: the naming flowchart ----------
  const flow = `<svg viewBox="0 0 560 430" width="560" role="img" aria-label="Naming flowchart. 1: starts with H, an acid: -ide becomes hydro-ic acid, -ate becomes -ic acid, -ite becomes -ous acid. 2: metal or ammonium first, ionic: fixed-charge metals are named as is, others get a Roman numeral. 3: only nonmetals, molecular: use prefixes. Hydrates: add prefix plus hydrate.">
    <g style="color:var(--ink)">
    ${box(10, 10, 220, 50, ['1. Starts with H?', '(an acid, written in water)'], { bold: 1 })}
    ${arrow(230, 35, 262, 35)}${lbl(246, 28, 'yes')}
    ${box(262, 4, 290, 80, ['Acid', '-ide ion → hydro___ic acid', '-ate ion → ___ic acid', '-ite ion → ___ous acid'], { result: true })}
    ${arrow(120, 60, 120, 112)}${lbl(134, 92, 'no')}
    ${box(10, 112, 220, 50, ['2. Metal or NH₄⁺ first?'], { bold: 1 })}
    ${arrow(230, 137, 262, 137)}${lbl(246, 130, 'yes')}
    ${box(262, 112, 290, 50, ['Ionic. Is the charge fixed?', '(1A, 2A, Al, Zn, Ag, NH₄⁺)'], { bold: 1 })}
    ${arrow(332, 162, 332, 196)}${lbl(348, 184, 'yes')}${arrow(482, 162, 482, 196)}${lbl(496, 184, 'no')}
    ${box(262, 196, 140, 70, ['Name as is', 'CaCl₂', 'calcium chloride'], { result: true })}
    ${box(412, 196, 140, 70, ['Roman numeral', 'FeCl₃', 'iron(III) chloride'], { result: true })}
    ${arrow(120, 162, 120, 300)}${lbl(134, 236, 'no')}
    ${box(10, 300, 220, 50, ['3. Only nonmetals'], { bold: 1 })}
    ${arrow(230, 325, 262, 325)}
    ${box(262, 290, 290, 70, ['Molecular', 'prefixes + -ide, no mono first', 'N₂O₄: dinitrogen tetroxide'], { result: true })}
    ${box(10, 378, 542, 46, ['Ends in ·nH₂O? Name the rest, then add prefix + hydrate.', 'CuSO₄·5H₂O: copper(II) sulfate pentahydrate'], { bold: 1 })}
  </g></svg><figcaption>Decide the kind of compound first. Each kind has its own rule, and the rules never mix.</figcaption>`;

  const KINDS = ['Atomic element', 'Molecular element', 'Molecular compound', 'Ionic compound'];

  lesson('compounds', 55, [
    P('Compounds and their formulas'),
    S('Elements and compounds', `Sodium is a soft metal that reacts violently with water. Chlorine is a poisonous yellow-green gas. Combine them and you get <b>table salt</b>, which you sprinkle on food. That is the big idea of this chapter: a compound is a brand-new substance, not a blend of its ingredients.<ul><li>An <b>element</b> is a substance made of only one kind of atom: iron, oxygen, sodium.</li><li>A <b>compound</b> is a substance made of two or more elements <b>chemically combined in a fixed ratio</b>.</li></ul>Three facts follow:<ol><li>A compound's properties can be completely different from its elements' properties.</li><li>The ratio never changes. Every sample of methane (CH<sub>4</sub>) has exactly 4 H atoms for each C atom. This is the <b>law of constant composition</b>.</li><li>A compound can only be broken apart by a <b>chemical</b> change (passing electricity through water splits it into H<sub>2</sub> and O<sub>2</sub>). A <b>mixture</b>, like salt water, has a variable ratio and can be separated physically, by filtering or boiling.</li></ol>`,
      { ex: ['A sample of carbon dioxide contains <b>12.0 g C</b> and <b>32.0 g O</b>. A second sample contains <b>4.50 g C</b>. How much oxygen does it contain?', 'Constant composition: every sample of CO₂ has the same mass ratio of O to C.', 'Ratio from the first sample: 32.0 g O ÷ 12.0 g C = 2.667 g O per gram of C.', 'Second sample: 4.50 g C × 2.667 g O/g C = <b>12.0 g O</b>.'],
        ck: ['Which of these is a <b>compound</b>, not a mixture?', ['Table salt, NaCl', 'Salt water', 'Air', 'Iron filings stirred into sulfur powder'], 0, 'NaCl is sodium and chlorine chemically combined in a fixed 1 : 1 ratio. Salt water and air can have any proportions, and iron filings can be pulled out of sulfur with a magnet, so those are mixtures.'],
        num: ['A sample of water contains <b>1.00 g H</b> and <b>7.94 g O</b>. A second sample contains <b>3.50 g H</b>. How many grams of O does it contain?', 27.79, 'g', 'Water always has 7.94 g O per 1.00 g H. 3.50 g H × 7.94 = 27.8 g O.'] }),

    S('Reading a chemical formula', `A <b>chemical formula</b> tells you which elements are in a compound and how many atoms of each. Four rules read any formula:<ol><li>Each element has a symbol. Only the first letter is capital: <b>Co</b> is cobalt, but <b>CO</b> is carbon and oxygen.</li><li>A <b>subscript</b> (small number below the line) counts the atom <b>directly before it</b>. No subscript means 1. NH<sub>3</sub> is 1 N and 3 H.</li><li><b>Parentheses</b> group atoms that travel together. A subscript after the closing parenthesis <b>multiplies everything inside</b>.</li><li>To count an atom inside parentheses: (subscript inside) × (subscript outside).</li></ol>`,
      { exs: [['Count the atoms in <b>Ca<sub>3</sub>(PO<sub>4</sub>)<sub>2</sub></b>.', 'Ca: subscript 3, so 3 Ca.', 'P: 1 inside the parentheses × 2 outside = 2 P.', 'O: 4 inside × 2 outside = 8 O.', 'Total: 3 + 2 + 8 = <b>13 atoms</b>.'],
          ['How many oxygen atoms are in <b>Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></b>?', 'Oxygen appears only inside the parentheses: 4 O per SO₄.', 'The 3 outside means 3 groups: 4 × 3 = <b>12 O atoms</b>.']],
        trap: 'Ignoring the subscript outside the parentheses. In Mg(OH)<sub>2</sub> there are 2 O and 2 H, not 1 of each. The 2 multiplies the whole OH group.',
        cks: [['How many atoms in total are in <b>(NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub></b>?', ['15', '11', '13', '10'], 0, 'N: 1 × 2 = 2. H: 4 × 2 = 8. S: 1. O: 4. Total 2 + 8 + 1 + 4 = 15. Getting 11 means you forgot to multiply the H by 2.'],
          ['What does the formula <b>CO</b> describe?', ['One carbon atom bonded to one oxygen atom', 'The element cobalt', 'One carbon atom and two oxygen atoms', 'A mixture of carbon and oxygen'], 0, 'Two capital letters means two elements: C and O, one each (no subscripts). Cobalt is Co, with a lowercase o.']] }),

    S('Molecular and empirical formulas', `There are two kinds of formulas for the same compound:<ul><li>A <b>molecular formula</b> gives the <b>actual</b> number of each atom in one molecule. Glucose is C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>.</li><li>An <b>empirical formula</b> gives only the <b>simplest whole-number ratio</b>. Glucose's is CH<sub>2</sub>O.</li></ul>To get the empirical formula, divide every subscript by their <b>greatest common factor</b>, the largest number that divides all of them evenly. If no number above 1 divides them all (H<sub>2</sub>O, CO<sub>2</sub>), the empirical and molecular formulas are the same.<br><br>Different compounds can share one empirical formula: acetylene C<sub>2</sub>H<sub>2</sub> and benzene C<sub>6</sub>H<sub>6</sub> are both CH. In the lab, type formulas with ordinary numbers: CH2O.`,
      { exs: [['Find the empirical formula of <b>C<sub>6</sub>H<sub>12</sub>O<sub>6</sub></b>.', 'Subscripts: 6, 12, 6. The largest number that divides all three is 6.', 'Divide each by 6: C 6/6 = 1, H 12/6 = 2, O 6/6 = 1.', '<b>CH<sub>2</sub>O</b>'],
          ['Find the empirical formula of <b>C<sub>8</sub>H<sub>18</sub></b>.', 'Try the smallest subscript, 8: 18 ÷ 8 = 2.25. Not a whole number, so 8 fails.', 'Try 2: 8 ÷ 2 = 4 and 18 ÷ 2 = 9. Both whole.', 'Nothing larger divides both 4 and 9: <b>C<sub>4</sub>H<sub>9</sub></b>.']],
        trap: 'Dividing by the smallest subscript when it does not divide the others evenly. C<sub>8</sub>H<sub>18</sub> ÷ 8 gives CH<sub>2.25</sub>, which is not a formula. Subscripts must be whole numbers.',
        vid: ['Khan Academy', 'empirical molecular and structural formulas'],
        cks: [['What is the empirical formula of <b>C<sub>4</sub>H<sub>10</sub></b>?', ['C<sub>2</sub>H<sub>5</sub>', 'CH<sub>2.5</sub>', 'C<sub>4</sub>H<sub>10</sub>', 'CH<sub>3</sub>'], 0, 'Both subscripts divide by 2: C₂H₅. Dividing by 4 gives 2.5 H, which is not allowed.'],
          ['Which compound has the <b>same</b> empirical and molecular formula?', ['H<sub>2</sub>O', 'H<sub>2</sub>O<sub>2</sub>', 'C<sub>2</sub>H<sub>4</sub>', 'N<sub>2</sub>O<sub>4</sub>'], 0, 'H₂O has subscripts 2 and 1, which share no factor above 1. H₂O₂ reduces to HO, C₂H₄ to CH₂, and N₂O₄ to NO₂.'],
          ['What is the empirical formula of <b>P<sub>4</sub>O<sub>10</sub></b>?', ['P<sub>2</sub>O<sub>5</sub>', 'PO<sub>2.5</sub>', 'P<sub>4</sub>O<sub>10</sub>', 'PO<sub>5</sub>'], 0, '4 and 10 share a factor of 2: P₂O₅. 2 and 5 share nothing more.']] }),

    S('Four kinds of pure substance', `To sort substances you need two terms. On the periodic table, <b>metals</b> sit left of the staircase line (Na, Fe, Al) and <b>nonmetals</b> sit to the right (C, N, O, Cl), plus hydrogen. A <b>molecule</b> is two or more atoms bonded so tightly that they act as one particle.<table class="t"><tr><th>Kind</th><th>What it is</th><th>Examples</th></tr><tr><td><b>Atomic element</b></td><td>single atoms: most elements, including all metals and the noble gases</td><td>Fe, Na, He</td></tr><tr><td><b>Molecular element</b></td><td>one element bonded into molecules</td><td>H<sub>2</sub>, O<sub>2</sub>, P<sub>4</sub>, S<sub>8</sub></td></tr><tr><td><b>Ionic compound</b></td><td>metal (or NH<sub>4</sub><sup>+</sup>) + nonmetal; charged ions packed in a crystal</td><td>NaCl, NH<sub>4</sub>Cl</td></tr><tr><td><b>Molecular compound</b></td><td>nonmetals only; atoms share electrons to form molecules</td><td>H<sub>2</sub>O, CO<sub>2</sub></td></tr></table>Seven elements are <b>diatomic</b> (two atoms per molecule): H<sub>2</sub>, N<sub>2</sub>, O<sub>2</sub>, F<sub>2</sub>, Cl<sub>2</sub>, Br<sub>2</sub>, I<sub>2</sub>. An ionic compound has no molecules; its smallest repeating unit is called a <b>formula unit</b>.`,
      { fig: kinds,
        tip: 'The diatomics make a <b>7</b> on the periodic table: start at element number 7 (N), go right to O and F, then down to Cl, Br and I. Then add H.',
        exs: [['Classify <b>CaCl<sub>2</sub></b>.', 'Two elements, so it is a compound.', 'Ca is a metal (group 2A).', 'Metal + nonmetal: <b>ionic compound</b>.'],
          ['Classify <b>S<sub>8</sub></b>.', 'Only one element, sulfur.', 'The subscript 8 means eight S atoms bonded together into one molecule.', '<b>Molecular element</b>.']],
        trap: 'NH<sub>4</sub>Cl contains no metal, yet it is <b>ionic</b>. The ammonium ion NH<sub>4</sub><sup>+</sup> plays the role of a metal cation. Any compound containing NH<sub>4</sub> is ionic.',
        cks: [['Classify <b>KNO<sub>3</sub></b>.', KINDS, 3, 'K is a metal (group 1A), combined with nonmetals. Metal present means ionic. It is a compound, not an element, because it contains three elements.'],
          ['Classify <b>Cl<sub>2</sub></b>.', KINDS, 1, 'One element, bonded in pairs: a molecular element. It is not a compound, because a compound needs two or more different elements.'],
          ['Classify <b>C<sub>2</sub>H<sub>5</sub>OH</b> (ethanol).', KINDS, 2, 'C, H and O are all nonmetals, so ethanol is a molecular compound. The OH here is part of a molecule, not a hydroxide ion: there is no metal to make it ionic.']] }),

    P('Ions and ionic formulas'),
    S('Ions and their charges', `An atom is neutral: its protons (+) and electrons (−) are equal in number. An <b>ion</b> is an atom that has gained or lost electrons, so it carries a charge.<ul><li><b>Metals lose</b> electrons and become positive ions, called <b>cations</b>. Na loses 1 electron: Na<sup>+</sup>.</li><li><b>Nonmetals gain</b> electrons and become negative ions, called <b>anions</b>. Cl gains 1 electron: Cl<sup>−</sup>.</li></ul>Main-group atoms gain or lose just enough electrons to match the nearest noble gas, so the charge follows the group (see the figure). Most <b>transition metals</b> can form more than one charge; zinc (always 2+) and silver (always 1+) are exceptions.<br><br>Naming single-atom ions: a <b>cation</b> keeps the element's name (Na<sup>+</sup> is the sodium ion). An <b>anion</b> takes the element's stem + <b>-ide</b>: Cl<sup>−</sup> chloride, O<sup>2−</sup> oxide, S<sup>2−</sup> sulfide, N<sup>3−</sup> nitride, P<sup>3−</sup> phosphide.`,
      { fig: charges,
        tip: 'Ca<b>t</b>ion: the "t" looks like a plus sign. <b>A</b>nion: <b>A N</b>egative <b>ION</b>.',
        exs: [['Predict the ion that magnesium forms, and name it.', 'Mg is a metal in group 2A, so it loses 2 electrons.', 'Losing 2 negative electrons leaves a charge of 2+.', '<b>Mg<sup>2+</sup>, the magnesium ion</b>.'],
          ['Predict the ion that sulfur forms, and name it.', 'S is a nonmetal in group 6A, so it gains 2 electrons, matching the nearest noble gas, argon.', 'Gaining 2 electrons gives a charge of 2−.', 'Stem "sulf" + -ide: <b>S<sup>2−</sup>, sulfide</b>.']],
        trap: 'Getting the sign backwards. Electrons are negative, so <b>losing</b> them makes an ion <b>positive</b>. Metals lose and become +; nonmetals gain and become −.',
        vid: ['Tyler DeWitt', 'ions and ionic charges periodic table'],
        cks: [['What ion does <b>aluminum</b> form?', ['Al<sup>3+</sup>', 'Al<sup>3−</sup>', 'Al<sup>+</sup>', 'Al<sup>5−</sup>'], 0, 'Aluminum is a metal in group 3A: it loses 3 electrons, giving Al³⁺. Metals never form negative ions.'],
          ['What is the name of <b>N<sup>3−</sup></b>?', ['nitride', 'nitrogen', 'nitrate', 'nitrite'], 0, 'A single-atom anion takes the stem + -ide: nitride. Nitrate and nitrite are polyatomic ions that contain oxygen (NO₃⁻ and NO₂⁻).'],
          ['What charge does <b>bromine</b> take as an ion?', ['1−', '1+', '7−', '2−'], 0, 'Br is in group 7A, one electron short of a noble gas. It gains 1 electron: Br⁻. The 7 in 7A is the group number, not the charge.']] }),

    S('Writing ionic formulas: the criss-cross', `An ionic compound is always <b>electrically neutral</b>: total positive charge = total negative charge. The formula shows the smallest whole-number ratio of ions that balances, with the <b>cation written first</b> and no charges shown.<br><br>The <b>criss-cross method</b> finds that ratio fast:<ol><li>Write both ions with their charges.</li><li>Drop the number of each charge (no sign) down to become the <b>other</b> ion's subscript.</li><li><b>Reduce</b> the subscripts to the lowest whole-number ratio. A subscript of 1 is not written.</li><li>Check: (count × charge) adds up to zero.</li></ol>`,
      { fig: cross,
        exs: [['Write the formula for the compound of <b>Ca<sup>2+</sup></b> and <b>Cl<sup>−</sup></b>.', 'Criss-cross: the 2 from Ca goes to Cl, the 1 from Cl goes to Ca: Ca₁Cl₂.', 'Drop the 1. Nothing to reduce.', 'Check: 1(+2) + 2(−1) = 0. <b>CaCl<sub>2</sub></b>'],
          ['Write the formula for the compound of <b>Mg<sup>2+</sup></b> and <b>O<sup>2−</sup></b>.', 'Criss-cross gives Mg₂O₂.', 'Reduce 2 : 2 to 1 : 1.', 'Check: 1(+2) + 1(−2) = 0. <b>MgO</b>'],
          ['Write the formula for the compound of <b>potassium</b> and <b>nitrogen</b>.', 'First find the ions: K is 1A, so K⁺. N is 5A, so N³⁻.', 'Criss-cross: K₃N₁.', 'Check: 3(+1) + 1(−3) = 0. <b>K<sub>3</sub>N</b>']],
        trap: 'Forgetting to reduce. Mg<sup>2+</sup> and O<sup>2−</sup> criss-cross to Mg<sub>2</sub>O<sub>2</sub>, but ionic formulas are always the lowest ratio of ions: MgO.',
        vid: ['Tyler DeWitt', 'writing ionic formulas criss cross'],
        cks: [['Formula for <b>Na<sup>+</sup></b> and <b>S<sup>2−</sup></b>?', ['Na<sub>2</sub>S', 'NaS<sub>2</sub>', 'NaS', 'Na<sub>2</sub>S<sub>2</sub>'], 0, 'Two Na⁺ (+2 total) balance one S²⁻. NaS₂ swaps the subscripts: it has +1 and −4.'],
          ['Formula for <b>Sn<sup>4+</sup></b> and <b>O<sup>2−</sup></b>?', ['SnO<sub>2</sub>', 'Sn<sub>2</sub>O<sub>4</sub>', 'Sn<sub>4</sub>O<sub>2</sub>', 'SnO'], 0, 'Criss-cross gives Sn₂O₄, which reduces to SnO₂. Check: +4 + 2(−2) = 0.'],
          ['Formula for <b>aluminum</b> and <b>chlorine</b>?', ['AlCl<sub>3</sub>', 'Al<sub>3</sub>Cl', 'AlCl', 'AlCl<sub>2</sub>'], 0, 'Al³⁺ and Cl⁻: one Al (+3) needs three Cl (−1 each). Al₃Cl puts the 3 on the wrong ion.']] }),

    S('Polyatomic ions', `A <b>polyatomic ion</b> is a group of atoms bonded together that carries one overall charge and acts as a single unit. These you memorize (the Cards deck drills them):<table class="t"><tr><th>Charge</th><th>Ions</th></tr><tr><td>1+</td><td>ammonium NH<sub>4</sub><sup>+</sup></td></tr><tr><td>1−</td><td>hydroxide OH<sup>−</sup>, nitrate NO<sub>3</sub><sup>−</sup>, nitrite NO<sub>2</sub><sup>−</sup>, acetate C<sub>2</sub>H<sub>3</sub>O<sub>2</sub><sup>−</sup>, hydrogen carbonate HCO<sub>3</sub><sup>−</sup>, cyanide CN<sup>−</sup>, permanganate MnO<sub>4</sub><sup>−</sup>, perchlorate ClO<sub>4</sub><sup>−</sup>, chlorate ClO<sub>3</sub><sup>−</sup>, chlorite ClO<sub>2</sub><sup>−</sup>, hypochlorite ClO<sup>−</sup></td></tr><tr><td>2−</td><td>sulfate SO<sub>4</sub><sup>2−</sup>, sulfite SO<sub>3</sub><sup>2−</sup>, carbonate CO<sub>3</sub><sup>2−</sup>, chromate CrO<sub>4</sub><sup>2−</sup>, dichromate Cr<sub>2</sub>O<sub>7</sub><sup>2−</sup></td></tr><tr><td>3−</td><td>phosphate PO<sub>4</sub><sup>3−</sup></td></tr></table>Patterns cut the memorizing in half:<ul><li><b>-ite</b> has one fewer O than <b>-ate</b>, same charge. <b>per-…-ate</b> has one more O; <b>hypo-…-ite</b> one fewer than -ite.</li><li>Adding H<sup>+</sup> adds "hydrogen" and raises the charge by 1: CO<sub>3</sub><sup>2−</sup> → HCO<sub>3</sub><sup>−</sup> (also called bicarbonate), SO<sub>4</sub><sup>2−</sup> → HSO<sub>4</sub><sup>−</sup> hydrogen sulfate.</li></ul>`,
      { exs: [['You know sulfate is SO<sub>4</sub><sup>2−</sup>. What is sulfite?', '-ite means one fewer oxygen than -ate.', 'The charge stays the same.', '<b>SO<sub>3</sub><sup>2−</sup></b>'],
          ['You know chlorate is ClO<sub>3</sub><sup>−</sup>. Write perchlorate and hypochlorite.', 'per-…-ate: one more O than chlorate: ClO₄⁻.', 'hypo-…-ite: chlorite is ClO₂⁻, so hypochlorite has one fewer: ClO⁻.', '<b>ClO<sub>4</sub><sup>−</sup> and ClO<sup>−</sup></b>, both still 1−.']],
        tip: 'Learn the <b>-ate</b> form of each ion cold. Every -ite, per- and hypo- form follows from it by adding or removing one oxygen.',
        trap: '"-ate" does not mean three oxygens. Nitrate is NO<sub>3</sub><sup>−</sup> but sulfate is SO<sub>4</sub><sup>2−</sup> and phosphate is PO<sub>4</sub><sup>3−</sup>. Also, an <b>-ide</b> ending usually means a single atom (sulfide S<sup>2−</sup>), with hydroxide and cyanide as the common exceptions.',
        vid: ['Tyler DeWitt', 'polyatomic ions'],
        cks: [['What is the formula of <b>nitrite</b>?', ['NO<sub>2</sub><sup>−</sup>', 'NO<sub>3</sub><sup>−</sup>', 'N<sup>3−</sup>', 'NO<sub>2</sub><sup>2−</sup>'], 0, 'Nitrate is NO₃⁻; nitrite has one fewer O and the same 1− charge. N³⁻ is nitride.'],
          ['What is the name of <b>HCO<sub>3</sub><sup>−</sup></b>?', ['hydrogen carbonate', 'carbonate', 'hydrogen carbonite', 'hydrocarbonic'], 0, 'Carbonate (CO₃²⁻) plus H⁺ is hydrogen carbonate, also called bicarbonate. Adding the H raised the charge from 2− to 1−.'],
          ['What is the name of <b>PO<sub>4</sub><sup>3−</sup></b>?', ['phosphate', 'phosphide', 'phosphite', 'phosphorus'], 0, 'PO₄³⁻ is phosphate. Phosphide is the single-atom ion P³⁻, and phosphite would be PO₃³⁻.']] }),

    S('Formulas with polyatomic ions', `Charge balance works exactly the same way. Treat each polyatomic ion as one unbreakable block:<ul><li><b>Never change the subscripts inside</b> a polyatomic ion. SO<sub>4</sub> is always SO<sub>4</sub>.</li><li>If you need <b>more than one</b> of the ion, wrap it in parentheses and put the count outside: Ca(NO<sub>3</sub>)<sub>2</sub>.</li><li>If you need only <b>one</b>, no parentheses: NaNO<sub>3</sub>, CaSO<sub>4</sub>.</li><li>Reduce only the subscripts <b>outside</b> the ions.</li></ul>To type a formula in the lab, use plain numbers and real parentheses, cation first: Ca(NO3)2, (NH4)3PO4. Write acetate as C2H3O2.`,
      { exs: [['Write the formula for <b>calcium nitrate</b>.', 'Ions: Ca²⁺ and NO₃⁻.', 'One Ca²⁺ (+2) needs two NO₃⁻ (−1 each).', 'Two nitrate ions need parentheses: <b>Ca(NO<sub>3</sub>)<sub>2</sub></b>.'],
          ['Write the formula for <b>aluminum sulfate</b>.', 'Ions: Al³⁺ and SO₄²⁻.', 'Criss-cross: Al₂(SO₄)₃. 2 and 3 cannot be reduced.', 'Check: 2(+3) + 3(−2) = 0. <b>Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></b>'],
          ['Write the formula for <b>calcium carbonate</b>.', 'Ions: Ca²⁺ and CO₃²⁻.', 'Criss-cross gives Ca₂(CO₃)₂; reduce the outside subscripts 2 : 2 to 1 : 1.', 'One carbonate needs no parentheses: <b>CaCO<sub>3</sub></b>.'],
          ['Write the formula for <b>ammonium phosphate</b>.', 'Ions: NH₄⁺ and PO₄³⁻.', 'Three NH₄⁺ (+3) balance one PO₄³⁻ (−3).', 'Three ammonium ions need parentheses: <b>(NH<sub>4</sub>)<sub>3</sub>PO<sub>4</sub></b>.']],
        trap: 'Dropping the parentheses. Ca(NO<sub>3</sub>)<sub>2</sub> written as CaNO<sub>32</sub> or CaNO<sub>3</sub>2 means something else entirely. And never "reduce" inside an ion: CaCO<sub>3</sub> is not CaCO.',
        cks: [['Formula for <b>magnesium hydroxide</b>?', ['Mg(OH)<sub>2</sub>', 'MgOH<sub>2</sub>', 'MgOH', 'Mg<sub>2</sub>OH'], 0, 'Mg²⁺ needs two OH⁻. MgOH₂ would mean one O and two H; the parentheses make the 2 apply to the whole OH group.'],
          ['Formula for <b>iron(III) sulfate</b> (Fe<sup>3+</sup>)?', ['Fe<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub>', 'Fe<sub>3</sub>SO<sub>4</sub>', 'Fe(SO<sub>4</sub>)<sub>3</sub>', 'Fe<sub>2</sub>SO<sub>4</sub>'], 0, 'Fe³⁺ and SO₄²⁻ criss-cross to Fe₂(SO₄)₃: 2(+3) + 3(−2) = 0. Fe(SO₄)₃ would be +3 and −6.'],
          ['Formula for <b>sodium carbonate</b>?', ['Na<sub>2</sub>CO<sub>3</sub>', 'Na(CO<sub>3</sub>)<sub>2</sub>', 'NaCO<sub>3</sub>', 'Na<sub>2</sub>(CO<sub>3</sub>)<sub>2</sub>'], 0, 'Two Na⁺ balance one CO₃²⁻. Only one carbonate, so no parentheses.']] }),

    P('Naming ionic compounds'),
    S('Naming ionic compounds', `The name of an ionic compound is just <b>cation name + anion name</b>.<ul><li>Cation: the metal's name, or ammonium.</li><li>Anion: a single atom takes stem + <b>-ide</b> (chloride, oxide). A polyatomic ion keeps its own name (sulfate, nitrate).</li></ul><b>Subscripts never appear in an ionic name.</b> The charges already fix the ratio, so CaCl<sub>2</sub> is calcium chloride, never calcium dichloride. Greek prefixes belong only to molecular compounds.<br><br>This simple rule works for metals with only one possible charge: groups 1A and 2A, Al, Zn and Ag. Metals with more than one charge come next.`,
      { exs: [['Name <b>MgBr<sub>2</sub></b>.', 'Cation: Mg, group 2A, always 2+: magnesium.', 'Anion: Br⁻, single atom: bromide.', '<b>magnesium bromide</b> (no "di": subscripts are not named).'],
          ['Name <b>K<sub>2</sub>SO<sub>4</sub></b>.', 'Cation: potassium.', 'Anion: SO₄²⁻ is a polyatomic ion, sulfate. Keep its name.', '<b>potassium sulfate</b>'],
          ['Name <b>NH<sub>4</sub>NO<sub>3</sub></b>.', 'Split it into ions: NH₄⁺ and NO₃⁻.', 'NH₄⁺ is ammonium; NO₃⁻ is nitrate.', '<b>ammonium nitrate</b>']],
        trap: 'Mixing up <b>sulfide, sulfite and sulfate</b> (or nitride, nitrite, nitrate). Look at the formula: S alone is sulfide, SO<sub>3</sub> is sulfite, SO<sub>4</sub> is sulfate.',
        vid: ['Tyler DeWitt', 'naming ionic compounds'],
        cks: [['Name <b>CaCl<sub>2</sub></b>.', ['calcium chloride', 'calcium dichloride', 'calcium(II) chloride', 'calcium chlorine'], 0, 'Cation + anion, with no prefixes and no Roman numeral, because calcium is always 2+. "Chlorine" is the element; the ion is chloride.'],
          ['Name <b>Na<sub>3</sub>PO<sub>4</sub></b>.', ['sodium phosphate', 'sodium phosphide', 'trisodium phosphate', 'sodium(I) phosphate'], 0, 'PO₄³⁻ is phosphate (phosphide is P³⁻). The 3 is a subscript, and subscripts are not named in ionic compounds.'],
          ['Name <b>ZnS</b>.', ['zinc sulfide', 'zinc sulfate', 'zinc(II) sulfide', 'zinc sulfur'], 0, 'Zinc is always 2+, so no Roman numeral. S alone is sulfide; sulfate would be SO₄.']] }),

    S('Metals with more than one charge', `Iron forms Fe<sup>2+</sup> and Fe<sup>3+</sup>, so "iron chloride" could mean FeCl<sub>2</sub> or FeCl<sub>3</sub>, two different substances. For metals with more than one charge (most transition metals, plus tin and lead), the name must say which.<br><br>The <b>Stock system</b> writes the metal's charge as a <b>Roman numeral in parentheses</b> right after its name: FeCl<sub>2</sub> is iron(II) chloride; FeCl<sub>3</sub> is iron(III) chloride. The numeral is the <b>charge on one metal ion</b>, not how many metal atoms there are.<br><br>An older <b>common system</b> uses the Latin root + <b>-ous</b> for the lower charge and <b>-ic</b> for the higher:<table class="t"><tr><th>Stock</th><th>Common</th></tr><tr><td>iron(II) / iron(III)</td><td>ferrous / ferric</td></tr><tr><td>copper(I) / copper(II)</td><td>cuprous / cupric</td></tr><tr><td>tin(II) / tin(IV)</td><td>stannous / stannic</td></tr><tr><td>lead(II) / lead(IV)</td><td>plumbous / plumbic</td></tr></table>Type names as iron(III) chloride: Roman numerals, no space needed.`,
      { exs: [['Write the formula for <b>copper(II) nitrate</b>.', '(II) means Cu²⁺. Nitrate is NO₃⁻.', 'One Cu²⁺ needs two NO₃⁻.', '<b>Cu(NO<sub>3</sub>)<sub>2</sub></b>'],
          ['Write the formula for <b>lead(IV) oxide</b>.', '(IV) means Pb⁴⁺. Oxide is O²⁻.', 'Criss-cross: Pb₂O₄. Reduce 2 : 4 to 1 : 2.', '<b>PbO<sub>2</sub></b>'],
          ['Write the formula for <b>iron(III) oxide</b>.', '(III) means Fe³⁺. Oxide is O²⁻.', 'Criss-cross: Fe₂O₃. 2 and 3 do not reduce.', '<b>Fe<sub>2</sub>O<sub>3</sub></b> (this is rust).']],
        tip: '<b>-ous</b> is l<b>o</b>wer (both have an o). <b>-ic</b> is h<b>i</b>gher (both have an i). Ferrous Fe²⁺, ferric Fe³⁺.',
        trap: 'Reading the numeral as a count. Fe<sub>2</sub>O<sub>3</sub> is iron(III) oxide, not iron(II) oxide: there are two iron atoms, but each one is 3+.',
        vid: ['The Organic Chemistry Tutor', 'naming ionic compounds with transition metals'],
        cks: [['Formula for <b>tin(IV) chloride</b>?', ['SnCl<sub>4</sub>', 'Sn<sub>4</sub>Cl', 'SnCl<sub>2</sub>', 'Sn<sub>4</sub>Cl<sub>4</sub>'], 0, 'Sn⁴⁺ needs four Cl⁻ to balance: SnCl₄. Sn₄Cl reads the numeral as a count of tin atoms.'],
          ['Formula for <b>copper(I) oxide</b>?', ['Cu<sub>2</sub>O', 'CuO', 'CuO<sub>2</sub>', 'Cu<sub>2</sub>O<sub>2</sub>'], 0, 'Cu⁺ and O²⁻: two Cu⁺ balance one O²⁻. CuO is copper(II) oxide.'],
          ['What is the common name of the <b>Fe<sup>3+</sup></b> ion?', ['ferric', 'ferrous', 'ferrate', 'iron(II)'], 0, 'Fe³⁺ is the higher of iron\'s two charges, so it gets -ic: ferric. Ferrous is Fe²⁺.']] }),

    S('Finding the hidden charge', `To <b>name</b> a formula like Co<sub>2</sub>O<sub>3</sub>, you need the metal's charge, but the formula does not show it. Work backwards from the anion, whose charge you know:<ol><li><b>Total negative charge</b> = (number of anions) × (anion charge).</li><li>The metal ions must supply the same total positive charge.</li><li><b>Divide</b> by the number of metal ions to get the charge on each one.</li><li>Write that charge as a Roman numeral.</li></ol>`,
      { exs: [['Name <b>Co<sub>2</sub>O<sub>3</sub></b>.', 'Anions: 3 × (2−) = 6−.', 'So the 2 Co ions supply 6+: 6 ÷ 2 = 3+ each.', '<b>cobalt(III) oxide</b>'],
          ['Name <b>PbO<sub>2</sub></b>.', 'Anions: 2 × (2−) = 4−.', 'One Pb ion supplies all 4+: Pb⁴⁺.', '<b>lead(IV) oxide</b>. (Reading the subscripts backward would wrongly give Pb²⁺, because the formula was reduced.)'],
          ['Name <b>Fe<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></b>.', 'Anions: 3 sulfates × (2−) = 6−.', '2 Fe ions share 6+: 3+ each.', '<b>iron(III) sulfate</b>']],
        trap: 'Un-criss-crossing a reduced formula. PbO<sub>2</sub> came from Pb<sub>2</sub>O<sub>4</sub>, so "the 2 on O means Pb is 2+" is wrong. Always do the charge arithmetic.',
        tip: 'In the lab, answer a hidden-charge question with just the number: 3 (or 3+).',
        nums: [['What is the charge on each tin ion in <b>SnCl<sub>4</sub></b>? (Enter the number.)', 4, '+', '4 Cl⁻ give 4−, so the one Sn is 4+: tin(IV) chloride.', 0.01],
          ['What is the charge on each chromium ion in <b>Cr<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></b>?', 3, '+', '3 sulfates × (2−) = 6−. Two Cr share 6+, so each is 3+: chromium(III) sulfate.', 0.01]],
        cks: [['Name <b>SnO<sub>2</sub></b>.', ['tin(IV) oxide', 'tin(II) oxide', 'tin dioxide', 'tin(I) oxide'], 0, '2 × (2−) = 4−, carried by one Sn: Sn⁴⁺. Tin(II) is the un-criss-cross mistake, and "dioxide" uses a molecular prefix on an ionic compound.']] }),

    P('Molecular compounds and acids'),
    S('Naming molecular compounds', `Two nonmetals share electrons, and the same pair can combine several ways: CO and CO<sub>2</sub>; NO, NO<sub>2</sub>, N<sub>2</sub>O and N<sub>2</sub>O<sub>4</sub>. No charges fix the ratio, so the name must <b>count the atoms</b> with Greek prefixes:<table class="t"><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr><tr><td>mono</td><td>di</td><td>tri</td><td>tetra</td><td>penta</td></tr><tr><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr><tr><td>hexa</td><td>hepta</td><td>octa</td><td>nona</td><td>deca</td></tr></table><ol><li>First element: its name, with a prefix if there is more than one. <b>Never mono on the first element.</b></li><li>Second element: prefix + stem + <b>-ide</b>.</li><li>Drop the a or o of the prefix before "oxide": monoxide, tetroxide, pentoxide.</li></ol>The element further left on the periodic table usually goes first (Tro's order: C, P, N, H, S, I, Br, Cl, O, F). Molecular formulas are <b>never reduced</b>: N<sub>2</sub>O<sub>4</sub> and NO<sub>2</sub> are different molecules. A few keep common names: H<sub>2</sub>O water, NH<sub>3</sub> ammonia, CH<sub>4</sub> methane.`,
      { exs: [['Name <b>N<sub>2</sub>O<sub>4</sub></b>.', 'Both nonmetals: use prefixes.', 'First element: 2 N, dinitrogen.', 'Second: 4 O, tetra + oxide, drop the a: tetroxide.', '<b>dinitrogen tetroxide</b>'],
          ['Name <b>PCl<sub>5</sub></b>.', 'One P, and it comes first: no mono, just phosphorus.', 'Five Cl: pentachloride.', '<b>phosphorus pentachloride</b>'],
          ['Write the formula for <b>diphosphorus pentoxide</b>.', 'di = 2 P; pent(a) = 5 O.', 'Prefixes give the subscripts directly. Do not reduce.', '<b>P<sub>2</sub>O<sub>5</sub></b>']],
        tip: 'Shapes help: a <b>penta</b>gon has 5 sides, a <b>hexa</b>gon 6, an <b>octa</b>gon 8 (and an octopus 8 arms), a <b>deca</b>de 10 years.',
        trap: 'Using the wrong system. Prefixes are only for nonmetal + nonmetal. "Sodium monochloride" is wrong (ionic: sodium chloride), and so is "carbon(IV) oxide" (molecular: carbon dioxide). Decide the kind of compound first.',
        vid: ['The Organic Chemistry Tutor', 'naming molecular compounds covalent'],
        cks: [['Name <b>SF<sub>6</sub></b>.', ['sulfur hexafluoride', 'monosulfur hexafluoride', 'sulfur(VI) fluoride', 'sulfur heptafluoride'], 0, 'One S first, so no mono. Six F is hexa: sulfur hexafluoride. Roman numerals are only for ionic compounds.'],
          ['Formula for <b>dinitrogen trioxide</b>?', ['N<sub>2</sub>O<sub>3</sub>', 'NO<sub>3</sub>', 'N<sub>3</sub>O<sub>2</sub>', 'N<sub>2</sub>O<sub>4</sub>'], 0, 'di = 2 N, tri = 3 O. The prefixes are the subscripts.'],
          ['Name <b>CO</b>.', ['carbon monoxide', 'monocarbon monoxide', 'carbon oxide', 'carbon(II) oxide'], 0, 'No mono on the first element, but mono is needed on the second, with the o dropped before oxide: monoxide. "Carbon oxide" could be CO or CO₂.']] }),

    S('Naming acids', `An <b>acid</b> is a molecular compound that releases H<sup>+</sup> ions when dissolved in water. Its formula starts with H, followed by an anion, and is written with <b>(aq)</b> for "dissolved in water": HCl(aq). The name depends on the anion's ending:<table class="t"><tr><th>Anion ends in</th><th>Acid name</th><th>Example</th></tr><tr><td><b>-ide</b> (no oxygen)</td><td><b>hydro</b>___<b>ic</b> acid</td><td>Cl<sup>−</sup> chloride → HCl, hydrochloric acid</td></tr><tr><td><b>-ate</b></td><td>___<b>ic</b> acid</td><td>NO<sub>3</sub><sup>−</sup> nitrate → HNO<sub>3</sub>, nitric acid</td></tr><tr><td><b>-ite</b></td><td>___<b>ous</b> acid</td><td>NO<sub>2</sub><sup>−</sup> nitrite → HNO<sub>2</sub>, nitrous acid</td></tr></table>To write the formula, add enough H<sup>+</sup> to cancel the anion's charge: sulfate SO<sub>4</sub><sup>2−</sup> → H<sub>2</sub>SO<sub>4</sub>; phosphate PO<sub>4</sub><sup>3−</sup> → H<sub>3</sub>PO<sub>4</sub>. Sulfur and phosphorus use a longer stem: sulf<b>ur</b>ic, phosph<b>or</b>ic. Acetate gives acetic acid, HC<sub>2</sub>H<sub>3</sub>O<sub>2</sub>.`,
      { exs: [['Name <b>HBr(aq)</b>.', 'Anion: Br⁻, bromide. It ends in -ide.', '-ide → hydro + stem + ic.', '<b>hydrobromic acid</b>'],
          ['Name <b>H<sub>2</sub>SO<sub>4</sub>(aq)</b>.', 'Anion: SO₄²⁻, sulfate. It ends in -ate.', '-ate → stem + ic, with the sulfur stem: sulfuric.', '<b>sulfuric acid</b>'],
          ['Name <b>HClO<sub>2</sub>(aq)</b>.', 'Anion: ClO₂⁻, chlorite. It ends in -ite.', '-ite → stem + ous.', '<b>chlorous acid</b>'],
          ['Write the formula for <b>carbonic acid</b>.', '-ic acid comes from an -ate anion: carbonate, CO₃²⁻.', 'A 2− charge needs 2 H⁺.', '<b>H<sub>2</sub>CO<sub>3</sub></b>']],
        tip: 'I <b>ate</b> something <b>ic</b>ky, but the b<b>ite</b> was delici<b>ous</b>. -ate → -ic; -ite → -ous. Only -ide gets hydro-.',
        trap: 'Putting hydro- on an oxyacid. HNO<sub>3</sub> is nitric acid, not hydronitric. Hydro- appears only when the anion has no oxygen (an -ide ion).',
        vid: ['Tyler DeWitt', 'naming acids'],
        cks: [['Name <b>H<sub>2</sub>SO<sub>3</sub>(aq)</b>.', ['sulfurous acid', 'sulfuric acid', 'hydrosulfuric acid', 'hydrosulfurous acid'], 0, 'SO₃²⁻ is sulfite, and -ite becomes -ous: sulfurous acid. Sulfuric acid is H₂SO₄ (from sulfate). Hydrosulfuric is H₂S (from sulfide).'],
          ['Name <b>HF(aq)</b>.', ['hydrofluoric acid', 'fluoric acid', 'hydrofluorous acid', 'hydrogen fluorate'], 0, 'F⁻ is fluoride, an -ide ion with no oxygen: hydro + fluor + ic acid.'],
          ['Formula for <b>phosphoric acid</b>?', ['H<sub>3</sub>PO<sub>4</sub>', 'HPO<sub>4</sub>', 'H<sub>3</sub>PO<sub>3</sub>', 'H<sub>3</sub>P'], 0, '-ic comes from -ate: phosphate, PO₄³⁻. A 3− charge needs 3 H⁺. H₃PO₃ would be phosphorous acid (from phosphite) and H₃P has no oxygen at all.']] }),

    P('Putting it all together'),
    S('Formula mass', `The <b>formula mass</b> of a compound is the sum of the atomic masses of every atom in its formula, in atomic mass units (amu). It is the counting skill from the start of this lesson, with each count multiplied by a mass from the periodic table.<ol><li>Count each kind of atom (watch the parentheses).</li><li>Multiply each count by that element's atomic mass.</li><li>Add.</li></ol>Masses used here: H 1.008, C 12.01, N 14.01, O 16.00, Mg 24.31, Al 26.98, S 32.06, Cl 35.45, Ca 40.08, Cu 63.55. Next chapter, the same number becomes the <b>molar mass</b> in grams per mole, the key to almost every calculation after that.`,
      { exs: [['Find the formula mass of <b>H<sub>2</sub>O</b>.', 'Count: 2 H, 1 O.', '2(1.008) + 1(16.00) = 2.016 + 16.00 = 18.016.', 'Round to the hundredths place: <b>18.02 amu</b>.'],
          ['Find the formula mass of <b>Ca(NO<sub>3</sub>)<sub>2</sub></b>.', 'Count: 1 Ca; N 1 × 2 = 2; O 3 × 2 = 6.', 'Ca 40.08 + N 2(14.01) = 28.02 + O 6(16.00) = 96.00.', '40.08 + 28.02 + 96.00 = <b>164.10 amu</b>.']],
        trap: 'Forgetting the parentheses multiplier. Counting Ca(NO<sub>3</sub>)<sub>2</sub> as 1 N and 3 O gives 102.09, far too small. Count atoms first, then multiply by masses.',
        nums: [['Formula mass of <b>CO<sub>2</sub></b>?', 44.01, 'amu', '12.01 + 2(16.00) = 44.01 amu.', 0.002],
          ['Formula mass of <b>Mg(OH)<sub>2</sub></b>?', 58.326, 'amu', 'Mg 24.31 + O 2(16.00) + H 2(1.008) = 24.31 + 32.00 + 2.016 = 58.33 amu.', 0.002],
          ['Formula mass of <b>Al<sub>2</sub>(SO<sub>4</sub>)<sub>3</sub></b>?', 342.14, 'amu', 'Al 2(26.98) = 53.96; S 3(32.06) = 96.18; O 12(16.00) = 192.00. Total 342.14 amu.', 0.002]] }),

    S('Hydrates', `Some ionic compounds trap a fixed number of water molecules inside their crystals. These are <b>hydrates</b>, written with a raised dot: <span class="eqn">CuSO<sub>4</sub>·5H<sub>2</sub>O</span>The dot means "combined with", not "times". Heat a hydrate and the water leaves: blue CuSO<sub>4</sub>·5H<sub>2</sub>O turns into white <b>anhydrous</b> ("without water") CuSO<sub>4</sub>.<br><br><b>Naming:</b> name the ionic compound normally, Roman numeral and all, then add a prefix for the number of waters + <b>hydrate</b>: hemi (½), mono 1, di 2, tri 3, tetra 4, penta 5, hexa 6, hepta 7, octa 8, nona 9, deca 10.<br><br><b>Formula mass:</b> the waters count. Add every atom, including the 2 H and 1 O in each water.`,
      { exs: [['Name <b>CoCl<sub>2</sub>·6H<sub>2</sub>O</b>.', 'Ionic part: CoCl₂. Cobalt varies, so find its charge: 2 Cl⁻ = 2−, so Co²⁺: cobalt(II) chloride.', '6 waters: hexahydrate.', '<b>cobalt(II) chloride hexahydrate</b>'],
          ['Find the formula mass of <b>CuSO<sub>4</sub>·5H<sub>2</sub>O</b>.', 'Count: 1 Cu, 1 S, O 4 + 5 = 9, H 5 × 2 = 10.', '63.55 + 32.06 + 9(16.00) + 10(1.008) = 63.55 + 32.06 + 144.00 + 10.08.', '<b>249.69 amu</b>. (Adding 159.61 for CuSO₄ and 5 × 18.02 for the water gives 249.71; the small difference is only rounding.)']],
        trap: 'Leaving out the water, or treating the dot as multiplication. CuSO<sub>4</sub>·5H<sub>2</sub>O is not 159.61 and it is not 159.61 × 90.08. It is 159.61 + 5 waters.',
        vid: ['Tyler DeWitt', 'hydrates naming'],
        cks: [['Name <b>Na<sub>2</sub>CO<sub>3</sub>·10H<sub>2</sub>O</b>.', ['sodium carbonate decahydrate', 'disodium carbonate decahydrate', 'sodium carbonate hydrate', 'sodium carbonate nonahydrate'], 0, 'Sodium is fixed-charge, so no numeral and no prefix: sodium carbonate. Ten waters is deca: decahydrate. (Nona is 9.)']],
        nums: [['Formula mass of <b>CaCl<sub>2</sub>·2H<sub>2</sub>O</b>? (Ca 40.08, Cl 35.45)', 147.012, 'amu', 'Ca 40.08 + Cl 2(35.45) = 70.90 + H 4(1.008) = 4.032 + O 2(16.00) = 32.00. Total 147.01 amu. Forgetting the water gives 110.98.', 0.002]] }),

    S('The naming flowchart', `Every naming problem is two decisions: <b>what kind of compound is it</b>, then <b>which rule applies</b>. Read the formula from the left:<ol><li><b>Starts with H</b> and written (aq)? It is an <b>acid</b>: name it from the anion's ending.</li><li><b>Starts with a metal or NH<sub>4</sub><sup>+</sup>?</b> It is <b>ionic</b>: cation + anion, no prefixes. If the metal's charge can vary, find it and add a Roman numeral.</li><li><b>Only nonmetals?</b> It is <b>molecular</b>: prefixes for every count, -ide on the second element.</li><li><b>Ends in ·nH<sub>2</sub>O?</b> Name the rest, then add the hydrate.</li></ol>Going from a name to a formula, the clues run backwards: a Roman numeral or a metal means ionic (use charges), prefixes mean molecular (prefixes are the subscripts), and "acid" means balance H<sup>+</sup> against the anion.`,
      { fig: flow,
        exs: [['Name <b>Cr<sub>2</sub>O<sub>3</sub></b>.', 'Starts with a metal, Cr: ionic. Chromium\'s charge varies, so find it.', '3 × (2−) = 6−, over 2 Cr: 3+ each.', '<b>chromium(III) oxide</b>'],
          ['Name <b>N<sub>2</sub>O<sub>5</sub></b>.', 'N and O are both nonmetals: molecular, use prefixes.', '2 N: dinitrogen. 5 O: pentoxide.', '<b>dinitrogen pentoxide</b>'],
          ['Name <b>HNO<sub>2</sub>(aq)</b>.', 'Starts with H, in water: acid.', 'Anion NO₂⁻ is nitrite. -ite → -ous.', '<b>nitrous acid</b>'],
          ['Name <b>Ba(OH)<sub>2</sub></b>.', 'Starts with a metal, Ba (2A): ionic, fixed charge.', 'Cation barium, anion hydroxide. No prefix for the 2.', '<b>barium hydroxide</b>']],
        vid: ['Melissa Maribel', 'naming ionic and molecular compounds'],
        cks: [['Name <b>SO<sub>3</sub></b>.', ['sulfur trioxide', 'sulfite', 'sulfur(VI) oxide', 'sulfur oxide'], 0, 'With no charge shown and no cation, SO₃ is a neutral molecule of two nonmetals: sulfur trioxide. Sulfite is the ion SO₃²⁻, which always appears with a charge or a cation.'],
          ['Name <b>Fe(NO<sub>3</sub>)<sub>2</sub></b>.', ['iron(II) nitrate', 'iron(II) nitrite', 'iron dinitrate', 'iron(I) nitrate'], 0, 'Ionic, iron varies: 2 × (1−) = 2−, so Fe²⁺. NO₃⁻ is nitrate (nitrite is NO₂⁻). No prefixes in ionic names.']] }),

    S('Mixed practice: exam style', `Exams mix every kind of compound and ask in both directions. Before you answer, classify. Then run this checklist of the traps that cost the most points:<ul><li>Sulfide / sulfite / sulfate and nitride / nitrite / nitrate: look at the oxygens.</li><li>The Roman numeral is the <b>charge</b>, not a count.</li><li>Prefixes only for molecular; Roman numerals only for variable-charge metals.</li><li>Parentheses around a polyatomic ion that appears more than once.</li><li>Reduce ionic formulas; never reduce molecular ones.</li><li>Hydro- only on acids whose anion has no oxygen.</li></ul>`,
      { exs: [['Write the formula for <b>ammonium sulfate</b>.', 'Ionic: NH₄⁺ and SO₄²⁻.', 'Two NH₄⁺ balance one SO₄²⁻.', 'Two ammonium ions need parentheses: <b>(NH<sub>4</sub>)<sub>2</sub>SO<sub>4</sub></b>.'],
          ['Name <b>Cu<sub>2</sub>S</b>.', 'Ionic, copper varies. S alone is sulfide, 2−.', 'Two Cu share 2+: each is 1+.', '<b>copper(I) sulfide</b>'],
          ['Write the formula for <b>dinitrogen monoxide</b>.', 'Prefixes: molecular. di = 2 N, mono = 1 O.', 'Prefixes are the subscripts; nothing to balance.', '<b>N<sub>2</sub>O</b>']],
        cks: [['Formula for <b>aluminum nitrate</b>?', ['Al(NO<sub>3</sub>)<sub>3</sub>', 'AlNO<sub>3</sub>', 'Al<sub>3</sub>NO<sub>3</sub>', 'Al(NO<sub>2</sub>)<sub>3</sub>'], 0, 'Al³⁺ needs three NO₃⁻. Al(NO₂)₃ is aluminum nitrite.'],
          ['Name <b>Pb(SO<sub>4</sub>)<sub>2</sub></b>.', ['lead(IV) sulfate', 'lead(II) sulfate', 'lead disulfate', 'lead(IV) sulfite'], 0, '2 sulfates × (2−) = 4−, carried by one Pb: Pb⁴⁺. Lead(II) sulfate would be PbSO₄.'],
          ['Formula for <b>iron(III) hydroxide</b>?', ['Fe(OH)<sub>3</sub>', 'FeOH<sub>3</sub>', 'Fe<sub>3</sub>OH', 'Fe(OH)<sub>2</sub>'], 0, 'Fe³⁺ needs three OH⁻, in parentheses: Fe(OH)₃. Fe(OH)₂ is iron(II) hydroxide.']] }),
  ], {
    goals: ['Tell elements, compounds and mixtures apart, and classify any substance as an atomic element, molecular element, molecular compound or ionic compound',
      'Count the atoms in any formula, including parentheses, and reduce a molecular formula to its empirical formula',
      'Predict ion charges from the periodic table and write ionic formulas with the criss-cross method, including polyatomic ions',
      'Name ionic compounds, using Roman numerals and finding the hidden charge when the metal\'s charge varies',
      'Name molecular compounds with Greek prefixes and write their formulas',
      'Name binary acids and oxyacids and write their formulas',
      'Name hydrates and calculate formula masses, waters included'],
    need: [['atoms', 'Ch 4: protons and electrons, and where metals and nonmetals sit on the periodic table. The lesson re-teaches the parts you need.'], ['matter-energy', 'Ch 3: elements, compounds and mixtures (helpful, not required).']],
    vids: [['Tyler DeWitt', 'naming ionic compounds'], ['Tyler DeWitt', 'polyatomic ions'], ['The Organic Chemistry Tutor', 'naming ionic and molecular compounds'], ['Melissa Maribel', 'naming ionic and molecular compounds'], ['Tyler DeWitt', 'naming acids']],
    keep: ['Four kinds of substance: atomic element (Fe, He), molecular element (H₂ N₂ O₂ F₂ Cl₂ Br₂ I₂, P₄, S₈), ionic compound (metal or NH₄⁺ present), molecular compound (nonmetals only).',
      'Subscripts count the atom before them; a subscript after parentheses multiplies everything inside. Empirical formula: divide all subscripts by their greatest common factor.',
      'Charges: 1A 1+, 2A 2+, Al 3+, Zn 2+, Ag 1+; 5A 3−, 6A 2−, 7A 1−. Most transition metals vary.',
      'Ionic formula: criss-cross the charge numbers, then reduce. Keep polyatomic ions intact, in parentheses when more than one.',
      'Ionic name = cation + anion. Single-atom anions end in -ide. Never name the subscripts.',
      'Variable-charge metals: Roman numeral = charge on one ion. Find it from the anion: Co₂O₃ is 6− over 2 Co, so cobalt(III) oxide. -ous lower, -ic higher.',
      'Molecular: mono, di, tri, tetra, penta, hexa, hepta, octa, nona, deca. No mono on the first element; drop a/o before oxide. Never reduce.',
      'Acids: -ide → hydro___ic acid; -ate → ___ic acid; -ite → ___ous acid.',
      'Hydrates: ionic name + prefix + hydrate (CuSO₄·5H₂O, copper(II) sulfate pentahydrate). Include the water in the formula mass.',
      'Formula mass = sum of (count × atomic mass). H₂O 18.02, CO₂ 44.01.'],
  });
}
