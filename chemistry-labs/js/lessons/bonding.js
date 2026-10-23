'use strict';
/* Ch 10 · Chemical Bonding */

{
  /* Lewis-structure drawing helper.
     atoms: [[x, y, 'Sym'], ...]; bonds: [[i, j, order], ...]; lps: [[i, angleDeg], ...] (0 = right, 90 = down);
     dots: [[i, angleDeg], ...] single electrons. Returns SVG elements to place inside a <g style="color:var(--ink)">. */
  const rad = d => d * Math.PI / 180;
  const reach = (sym, ang) => 15 + (sym.length > 1 ? 6 * Math.abs(Math.cos(rad(ang))) : 0);
  const breach = (sym, ang) => 10 + (sym.length > 1 ? 5 * Math.abs(Math.cos(rad(ang))) : 0);
  function lewis(atoms, bonds = [], lps = [], dots = []) {
    let s = '';
    bonds.forEach(([i, j, ord]) => {
      const [x1, y1, a] = atoms[i], [x2, y2, b] = atoms[j], L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      const r1 = breach(a, Math.atan2(uy, ux) * 180 / Math.PI), r2 = breach(b, Math.atan2(uy, ux) * 180 / Math.PI);
      const offs = ord === 1 ? [0] : ord === 2 ? [-3.5, 3.5] : [-6, 0, 6];
      offs.forEach(o => { s += `<line x1="${(x1 + ux * r1 - uy * o).toFixed(1)}" y1="${(y1 + uy * r1 + ux * o).toFixed(1)}" x2="${(x2 - ux * r2 - uy * o).toFixed(1)}" y2="${(y2 - uy * r2 + ux * o).toFixed(1)}" stroke="currentColor" stroke-width="1.8"/>`; });
    });
    const dot = (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" style="fill:var(--accent)"/>`;
    lps.forEach(([i, ang]) => {
      const [x, y, sym] = atoms[i], R = reach(sym, ang), dx = Math.cos(rad(ang)), dy = Math.sin(rad(ang)), cx = x + dx * R, cy = y + dy * R;
      s += dot(cx - dy * 4, cy + dx * 4) + dot(cx + dy * 4, cy - dx * 4);
    });
    dots.forEach(([i, ang]) => { const [x, y, sym] = atoms[i], R = reach(sym, ang); s += dot(x + Math.cos(rad(ang)) * R, y + Math.sin(rad(ang)) * R); });
    atoms.forEach(([x, y, sym]) => { s += `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">${sym}</text>`; });
    return s;
  }
  const bracket = (x1, y1, x2, y2, q) => `<path d="M${x1 + 6} ${y1} L${x1} ${y1} L${x1} ${y2} L${x1 + 6} ${y2}" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M${x2 - 6} ${y1} L${x2} ${y1} L${x2} ${y2} L${x2 - 6} ${y2}" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="${x2 + 4}" y="${y1 + 12}" font-size="15" font-weight="700" fill="currentColor">${q}</text>`;
  const label = (x, y, t) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="13" fill="currentColor">${t}</text>`;
  const svg = (w, h, aria, body, cap) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${aria}"><g style="color:var(--ink)">${body}</g></svg>${cap ? `<figcaption>${cap}</figcaption>` : ''}`;

  // Lewis symbols, Li to Ne
  const SIDES = [-90, 0, 90, 180];
  let sym = '';
  ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'].forEach((el, i) => {
    const n = i + 1, x = 40 + i * 68, lp = [], dt = [];
    SIDES.forEach((a, k) => { if (k < n - 4) lp.push([0, a]); else if (k < n) dt.push([0, a]); });
    sym += lewis([[x, 40, el]], [], lp, dt) + label(x, 86, n + 'A');
  });
  const symbolsFig = svg(560, 94, 'Lewis symbols for lithium through neon, with 1 to 8 dots', sym, 'One dot per valence electron. Place single dots on all four sides before pairing any. The dot count equals the A-group number.');

  // ionic: Na + Cl → Na+ [Cl]-
  const ionicFig = svg(480, 84, 'Sodium gives its one valence electron to chlorine, forming a sodium ion and a chloride ion with eight dots in brackets',
    lewis([[40, 50, 'Na']], [], [], [[0, 0]]) + `<text x="96" y="57" text-anchor="middle" font-size="20" fill="currentColor">+</text>` + lewis([[150, 50, 'Cl']], [], [[0, -90], [0, 90], [0, 0]], [[0, 180]])
    + `<path d="M64 40 Q 98 6 130 38" fill="none" style="stroke:var(--accent)" stroke-width="1.6"/><polygon points="133,43 124,36 133,33" style="fill:var(--accent)"/>`
    + `<line x1="198" y1="50" x2="236" y2="50" stroke="currentColor" stroke-width="2"/><polygon points="246,50 236,44 236,56" fill="currentColor"/>`
    + lewis([[290, 50, 'Na']]) + `<text x="306" y="42" font-size="15" font-weight="700" fill="currentColor">+</text>`
    + lewis([[390, 50, 'Cl']], [], [[0, -90], [0, 90], [0, 0], [0, 180]]) + bracket(360, 22, 420, 78, '−'),
    'Sodium transfers its one valence electron to chlorine. Brackets with the charge show that the ion\'s 8 electrons all belong to chlorine now.');

  // H2O, NH3, CH4
  const c3 = [90, 270, 450];
  const simpleFig = svg(540, 128, 'Lewis structures of water, ammonia and methane',
    lewis([[c3[0], 52, 'O'], [c3[0] - 42, 52, 'H'], [c3[0] + 42, 52, 'H']], [[0, 1, 1], [0, 2, 1]], [[0, -90], [0, 90]]) + label(c3[0], 120, 'H₂O: 2 bonds, 2 lone pairs')
    + lewis([[c3[1], 52, 'N'], [c3[1] - 42, 52, 'H'], [c3[1] + 42, 52, 'H'], [c3[1], 92, 'H']], [[0, 1, 1], [0, 2, 1], [0, 3, 1]], [[0, -90]]) + label(c3[1], 120, 'NH₃: 3 bonds, 1 lone pair')
    + lewis([[c3[2], 52, 'C'], [c3[2] - 42, 52, 'H'], [c3[2] + 42, 52, 'H'], [c3[2], 12, 'H'], [c3[2], 92, 'H']], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]) + label(c3[2], 120, 'CH₄: 4 bonds'),
    'Each line is a shared pair (2 electrons). Each pair of dots is a lone pair. O, N and C each end up with 8 electrons; each H has 2.');

  // CO2, HCN, CH2O
  const m3 = [95, 275, 455];
  const multiFig = svg(550, 124, 'Lewis structures: carbon dioxide with two double bonds, hydrogen cyanide with a triple bond, formaldehyde with a carbon-oxygen double bond',
    lewis([[m3[0] - 46, 58, 'O'], [m3[0], 58, 'C'], [m3[0] + 46, 58, 'O']], [[0, 1, 2], [1, 2, 2]], [[0, -90], [0, 90], [2, -90], [2, 90]]) + label(m3[0], 116, 'CO₂ (16 e⁻)')
    + lewis([[m3[1] - 46, 58, 'H'], [m3[1], 58, 'C'], [m3[1] + 44, 58, 'N']], [[0, 1, 1], [1, 2, 3]], [[2, 0]]) + label(m3[1], 116, 'HCN (10 e⁻)')
    + lewis([[m3[2], 60, 'C'], [m3[2], 18, 'O'], [m3[2] - 38, 86, 'H'], [m3[2] + 38, 86, 'H']], [[0, 1, 2], [0, 2, 1], [0, 3, 1]], [[1, 180], [1, 0]]) + label(m3[2], 116, 'CH₂O (12 e⁻)'),
    'A double bond is 2 shared pairs (4 electrons); a triple bond is 3 shared pairs (6 electrons).');

  // NH4+ and ClO3-
  const ionFig = svg(520, 126, 'Lewis structures of the ammonium ion and the chlorate ion, each in brackets with its charge',
    lewis([[120, 56, 'N'], [120, 16, 'H'], [120, 96, 'H'], [80, 56, 'H'], [160, 56, 'H']], [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]]) + bracket(60, 2, 180, 110, '+')
    + lewis([[380, 50, 'Cl'], [334, 50, 'O'], [426, 50, 'O'], [380, 94, 'O']], [[0, 1, 1], [0, 2, 1], [0, 3, 1]], [[0, -90], [1, 180], [1, -90], [1, 90], [2, 0], [2, -90], [2, 90], [3, 90], [3, 180], [3, 0]]) + bracket(306, 2, 454, 118, '−'),
    'NH₄⁺ has 8 electrons (5 + 4 − 1). ClO₃⁻ has 26 (7 + 18 + 1): three single bonds, a lone pair on Cl, and three on each O.');

  // NO3- resonance
  let res = '';
  [80, 280, 480].forEach((cx, k) => {
    const at = [[cx, 58, 'N'], [cx, 18, 'O'], [cx - 38, 82, 'O'], [cx + 38, 82, 'O']], out = [-90, 147.7, 32.3], bonds = [], lps = [];
    [1, 2, 3].forEach(i => {
      const dbl = i - 1 === k, th = out[i - 1]; bonds.push([0, i, dbl ? 2 : 1]);
      (dbl ? [th + 60, th - 60] : [th, th + 90, th - 90]).forEach(a => lps.push([i, a]));
    });
    res += lewis(at, bonds, lps) + bracket(cx - 62, 0, cx + 62, 112, '−');
    if (k < 2) res += `<text x="${cx + 100}" y="64" text-anchor="middle" font-size="20" fill="currentColor">↔</text>`;
  });
  const resFig = svg(560, 116, 'Three resonance structures of the nitrate ion, each with the double bond to a different oxygen', res,
    'The three resonance structures of NO₃⁻ differ only in where the double bond is drawn. The real ion is the average: three identical N–O bonds.');

  // VSEPR shapes
  const pos = (cx, ang, r) => [cx + Math.cos(rad(ang)) * r, 60 + Math.sin(rad(ang)) * r];
  const ball = (x, y, c) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${c ? 11 : 8}" style="fill:${c ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'color-mix(in srgb, var(--muted) 35%, transparent)'}" stroke="currentColor" stroke-width="1.2"/>`;
  const stick = (cx, x, y) => `<line x1="${cx}" y1="60" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="2"/>`;
  const wedge = (cx, x, y) => { const L = Math.hypot(x - cx, y - 60), nx = -(y - 60) / L * 5, ny = (x - cx) / L * 5; return `<polygon points="${cx},60 ${(x + nx).toFixed(1)},${(y + ny).toFixed(1)} ${(x - nx).toFixed(1)},${(y - ny).toFixed(1)}" fill="currentColor"/>`; };
  const dash = (cx, x, y) => { let s = ''; const L = Math.hypot(x - cx, y - 60), ux = (x - cx) / L, uy = (y - 60) / L; for (let t = 12; t < L; t += 5) { const w = 1 + 4 * t / L; s += `<line x1="${(cx + ux * t - uy * w).toFixed(1)}" y1="${(60 + uy * t + ux * w).toFixed(1)}" x2="${(cx + ux * t + uy * w).toFixed(1)}" y2="${(60 + uy * t - ux * w).toFixed(1)}" stroke="currentColor" stroke-width="1.3"/>`; } return s; };
  const lobe = (cx, ang) => { const [x, y] = pos(cx, ang, 26); return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="9" transform="rotate(${ang} ${x.toFixed(1)} ${y.toFixed(1)})" style="fill:color-mix(in srgb, var(--good) 30%, transparent);stroke:var(--good)" stroke-dasharray="3 2"/><circle cx="${(x - Math.sin(rad(ang)) * 4).toFixed(1)}" cy="${(y + Math.cos(rad(ang)) * 4).toFixed(1)}" r="2" style="fill:var(--good)"/><circle cx="${(x + Math.sin(rad(ang)) * 4).toFixed(1)}" cy="${(y - Math.cos(rad(ang)) * 4).toFixed(1)}" r="2" style="fill:var(--good)"/>`; };
  const shapes = [
    ['linear', '180°', [[0, 'p'], [180, 'p']], []],
    ['trigonal planar', '120°', [[-90, 'p'], [30, 'p'], [150, 'p']], []],
    ['tetrahedral', '109.5°', [[-90, 'p'], [150, 'p'], [70, 'w'], [20, 'd']], []],
    ['trigonal pyramidal', '≈107°', [[150, 'p'], [70, 'w'], [20, 'd']], [-90]],
    ['bent', '≈104.5°', [[150, 'p'], [30, 'p']], [-130, -50]],
  ];
  let sh = '';
  shapes.forEach(([name, ang, arms, lone], k) => {
    const cx = 56 + k * 112;
    lone.forEach(a => { sh += lobe(cx, a); });
    arms.filter(a => a[1] === 'd').forEach(([a]) => { const [x, y] = pos(cx, a, 40); sh += dash(cx, x, y) + ball(x, y); });
    arms.filter(a => a[1] !== 'd').forEach(([a, t]) => { const [x, y] = pos(cx, a, 40); sh += (t === 'w' ? wedge(cx, x, y) : stick(cx, x, y)) + ball(x, y); });
    sh += ball(cx, 60, true);
    const words = name.split(' ');
    words.forEach((w, i) => { sh += `<text x="${cx}" y="${124 + i * 15}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${w}</text>`; });
    sh += `<text x="${cx}" y="${124 + words.length * 15}" text-anchor="middle" font-size="12" fill="currentColor">${ang}</text>`;
  });
  const shapeFig = svg(560, 160, 'Five molecular shapes: linear, trigonal planar, tetrahedral, trigonal pyramidal with one lone pair, and bent with two lone pairs', sh,
    'Shaded lobes are lone pairs: they take up space but are not part of the shape\'s name. A solid wedge points toward you; a dashed wedge points away.');

  // dipoles: CO2 vs H2O
  const dip = (x1, y1, x2, y2) => { const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, tx = x1 + ux * 6, ty = y1 + uy * 6;
    return `<line x1="${x1}" y1="${y1}" x2="${(x2 - ux * 8).toFixed(1)}" y2="${(y2 - uy * 8).toFixed(1)}" style="stroke:var(--bad)" stroke-width="2"/><polygon points="${x2},${y2} ${(x2 - ux * 9 - uy * 5).toFixed(1)},${(y2 - uy * 9 + ux * 5).toFixed(1)} ${(x2 - ux * 9 + uy * 5).toFixed(1)},${(y2 - uy * 9 - ux * 5).toFixed(1)}" style="fill:var(--bad)"/><line x1="${(tx - uy * 5).toFixed(1)}" y1="${(ty + ux * 5).toFixed(1)}" x2="${(tx + uy * 5).toFixed(1)}" y2="${(ty - ux * 5).toFixed(1)}" style="stroke:var(--bad)" stroke-width="2"/>`; };
  const dTxt = (x, y, t) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" style="fill:var(--bad)">${t}</text>`;
  const dipFig = svg(540, 132, 'Carbon dioxide: two bond dipoles point in opposite directions and cancel, so it is nonpolar. Water: bent, so the two bond dipoles add to a net dipole toward oxygen, and it is polar.',
    lewis([[70, 50, 'O'], [130, 50, 'C'], [190, 50, 'O']], [[0, 1, 2], [1, 2, 2]]) + dTxt(70, 26, 'δ−') + dTxt(130, 26, 'δ+') + dTxt(190, 26, 'δ−')
    + dip(122, 78, 74, 78) + dip(138, 78, 186, 78) + label(130, 116, 'nonpolar: dipoles cancel')
    + lewis([[380, 34, 'O'], [342, 78, 'H'], [418, 78, 'H']], [[0, 1, 1], [0, 2, 1]]) + dTxt(380, 14, 'δ−') + dTxt(328, 100, 'δ+') + dTxt(432, 100, 'δ+')
    + dip(338, 61, 360, 35) + dip(422, 61, 400, 35) + dip(480, 98, 480, 40) + `<text x="490" y="74" font-size="12" style="fill:var(--bad)">net</text>` + label(380, 124, 'polar: dipoles add up'),
    'Each red arrow points toward the more electronegative atom, with a + on its tail. Lone pairs are left off here so you can see the arrows.');

  lesson('bonding', 50, [
    P('Why atoms bond'),
    S('Valence electrons as dots: Lewis symbols', `Why does sodium chloride exist as a hard crystal while water is a liquid made of separate molecules? The answer lies in how atoms bond, and bonding is all about <b>valence electrons</b>, the electrons in the outermost level (Ch 9). For main-group elements, the count equals the <b>A-group number</b>.<br><br>The chemist G. N. Lewis drew them as dots around the element symbol. This <b>Lewis symbol</b> (or electron-dot symbol) shows only the valence electrons:<ul><li>Write the symbol.</li><li>Put one dot on each of the four sides first.</li><li>Then pair them up. No side gets more than two.</li></ul>Single dots are <b>unpaired electrons</b>, available to form bonds. Pairs are <b>lone pairs</b>.`,
      { fig: symbolsFig,
        ex: ['Draw the Lewis symbol for <b>phosphorus</b>.', 'P is in group 5A: 5 valence electrons.', 'One dot on each of the four sides uses 4.', 'The 5th dot pairs up with one of them: <b>P with one pair and three single dots</b>, like nitrogen above it.'],
        num: ['How many dots go around <b>sulfur</b> in its Lewis symbol?', 6, 'dots', 'S is in group 6A, so 6 valence electrons, like oxygen: two pairs and two single dots.'],
        ck: ['How many <b>unpaired</b> dots does oxygen\'s Lewis symbol have?', ['0', '2', '4', '6'], 1, 'Oxygen has 6 dots: one on each side uses 4, and the last 2 pair up with two of them. Two pairs plus two singles, so 2 unpaired. Those two singles are why oxygen usually forms 2 bonds.'] }),
    S('The octet rule', `Noble gases barely react. Their outer level is full: 8 electrons (helium: 2). The <b>octet rule</b> says atoms tend to gain, lose or share electrons until they are surrounded by <b>8 valence electrons</b>, the same as a noble gas. Hydrogen is the exception: it wants only 2, a <b>duet</b>, like helium.<br><br>There are two ways to get there:<table class="t"><tr><th></th><th>Ionic bond</th><th>Covalent bond</th></tr><tr><td>Between</td><td>a metal and a nonmetal</td><td>two nonmetals</td></tr><tr><td>Electrons are</td><td><b>transferred</b></td><td><b>shared</b></td></tr><tr><td>Result</td><td>ions held by attraction</td><td>a molecule</td></tr><tr><td>Example</td><td>NaCl</td><td>H₂O</td></tr></table>Metals have few valence electrons and lose them easily. Nonmetals are close to an octet and tend to gain or share.`,
      { tip: 'Metal + nonmetal: transfer (ionic). Nonmetal + nonmetal: share (covalent). It is the same sorting you used to name compounds in Ch 5.',
        cks: [['Oxygen has 6 valence electrons. Which ion gives it an octet?', ['O²⁺', 'O²⁻', 'O⁶⁺', 'O⁻'], 1, 'Gaining 2 electrons makes 8. Two extra electrons give a 2− charge: O²⁻. Losing all 6 would leave only the 1s² core (2 electrons, not an octet), and that would cost far too much energy.'],
          ['Which pair of elements forms an <b>ionic</b> bond?', ['C and O', 'K and Br', 'N and H', 'Cl and Cl'], 1, 'Potassium is a metal and bromine a nonmetal, so K transfers an electron to Br. The other pairs are all nonmetals and share electrons.']] }),
    S('Ionic bonds in Lewis form', `In an ionic compound, the metal loses its valence electrons and the nonmetal gains them until both have octets. The Lewis structure shows the metal ion with <b>no dots</b> and the nonmetal ion with <b>8 dots in brackets</b>, with each charge written outside.<br><br>The total electrons lost must equal the total gained. That rule sets the formula, which is why ionic formulas balance the charges.`,
      { fig: ionicFig,
        exs: [['Draw the Lewis structure of <b>calcium chloride</b>.', 'Ca (group 2A) has 2 valence electrons to lose. Each Cl (7A) needs only 1.', 'So one Ca gives one electron to each of two Cl atoms.', '<b>Ca²⁺ 2[:Cl:]⁻</b> (each Cl with 8 dots in brackets). Formula: CaCl₂.'],
          ['Use electron transfer to find the formula of the compound of <b>aluminum and oxygen</b>.', 'Al (3A) loses 3 electrons: Al³⁺. O (6A) gains 2: O²⁻.', 'Find the smallest equal number lost and gained: 6. That takes 2 Al (2 × 3 = 6) and 3 O (3 × 2 = 6).', '<b>Al₂O₃</b>: 2 Al³⁺ and 3 [O]²⁻, each oxide with 8 dots.']],
        cks: [['What is the formula of the ionic compound formed by <b>magnesium and nitrogen</b>?', ['MgN', 'Mg₂N₃', 'Mg₃N₂', 'MgN₂'], 2, 'Mg loses 2 (Mg²⁺); N gains 3 (N³⁻). Six electrons: 3 Mg lose 6, 2 N gain 6. Mg₃N₂.'],
          ['In the Lewis structure of <b>K₂O</b>, how many dots are drawn around each K⁺?', ['0', '1', '7', '8'], 0, 'Each potassium gave away its only valence electron, so the K⁺ ion shows no dots. The oxide ion gets 8 dots in brackets.']] }),
    S('Covalent bonds: sharing pairs', `When two nonmetals meet, neither gives up electrons, so they <b>share</b>. Each shared pair is a <b>covalent bond</b>, drawn as a line (one line = 2 electrons). The shared pair counts toward the octet of <b>both</b> atoms.<ul><li>H₂: H–H. Each H shares one pair and has its duet.</li><li>Cl₂: each Cl brings 7 electrons, shares 1 pair, and keeps 3 <b>lone pairs</b> (pairs that are not shared).</li></ul>Atoms can share more than one pair:<table class="t"><tr><th>Bond</th><th>Pairs shared</th><th>Electrons</th><th>Example</th></tr><tr><td>single</td><td>1</td><td>2</td><td>H–H</td></tr><tr><td>double</td><td>2</td><td>4</td><td>O=O</td></tr><tr><td>triple</td><td>3</td><td>6</td><td>N≡N</td></tr></table>More shared pairs make a shorter, stronger bond: the N≡N triple bond is one reason N₂ in air is so unreactive.`,
      { tip: 'Each unpaired dot in a Lewis symbol is one bond the atom usually forms. "HONC 1234": H forms 1 bond, O 2, N 3, C 4. Halogens, like H, form 1.',
        vid: ['Tyler DeWitt', 'covalent bonding Lewis'],
        cks: [['How many electrons are shared in a <b>triple bond</b>?', ['3', '6', '8', '2'], 1, 'Three shared pairs × 2 electrons = 6. Answering 3 counts pairs, not electrons.'],
          ['How many bonds does a nitrogen atom usually form in a neutral molecule?', ['1', '2', '3', '5'], 2, 'N has 5 valence electrons: one lone pair and three unpaired. It forms 3 bonds to reach 8, as in NH₃ or N≡N.']] }),

    P('Drawing Lewis structures'),
    S('Step 1: count the valence electrons', `Every Lewis structure starts with the <b>total number of valence electrons</b>. Add the group numbers for every atom, then adjust for the charge on an ion:<ul><li><b>Negative</b> ion: <b>add</b> one electron per negative charge (it gained them).</li><li><b>Positive</b> ion: <b>subtract</b> one per positive charge (it lost them).</li></ul>Every dot and line you draw later must use exactly this many electrons.`,
      { exs: [['Total valence electrons in <b>CO₂</b>?', 'C: 1 × 4 = 4. O: 2 × 6 = 12.', 'Neutral molecule, so no adjustment: <b>16</b>.'],
          ['Total valence electrons in <b>NH₄⁺</b>?', 'N: 5. H: 4 × 1 = 4. Sum 9.', 'Positive charge: subtract 1. <b>8</b>.'],
          ['Total valence electrons in <b>SO₄²⁻</b>?', 'S: 6. O: 4 × 6 = 24. Sum 30.', '2− charge: add 2. <b>32</b>.']],
        trap: 'Getting the charge backward. A negative ion has <i>extra</i> electrons, so you add. Think: "minus sign, plus electrons".',
        vid: ['The Organic Chemistry Tutor', 'how to draw Lewis structures'],
        nums: [['Total valence electrons in <b>PCl₃</b>?', 26, 'e⁻', 'P: 5. Cl: 3 × 7 = 21. Total 26.'],
          ['Total valence electrons in <b>CO₃²⁻</b>?', 24, 'e⁻', 'C: 4. O: 3 × 6 = 18. Sum 22, plus 2 for the 2− charge: 24.'],
          ['Total valence electrons in <b>H₃O⁺</b>?', 8, 'e⁻', 'H: 3 × 1 = 3. O: 6. Sum 9, minus 1 for the + charge: 8.']] }),
    S('Skeleton, bonds, then lone pairs', `With the electron count in hand:<ol><li><b>Skeleton.</b> Put the least electronegative atom in the center (usually the one there is only one of). H is never central; neither is F. Carbon is usually central.</li><li><b>Bonds.</b> Connect each outer atom to the center with a single bond. Each bond uses 2 electrons.</li><li><b>Outer octets.</b> Give each outer atom lone pairs until it has 8 (H needs none: one bond is its duet).</li><li><b>Leftovers.</b> Put any remaining electrons on the central atom as lone pairs.</li><li><b>Check.</b> Count every electron (each line 2, each dot 1) against step 1, and check each atom's octet.</li></ol>`,
      { fig: simpleFig,
        exs: [['Draw <b>H₂O</b>.', 'Count: 2(1) + 6 = 8 electrons. O is central.', 'Two O–H bonds use 4. H atoms need nothing more.', '4 electrons are left: two lone pairs on O.', '<b>H–O–H with 2 lone pairs on O</b>. O has 4 + 4 = 8.'],
          ['Draw <b>PCl₃</b>.', 'Count: 5 + 3(7) = 26. P is central (less electronegative than Cl).', 'Three P–Cl bonds use 6 (20 left).', 'Each Cl gets 3 lone pairs: 18 electrons (2 left).', 'The last 2 go on P as one lone pair. <b>P has 3 bonds + 1 lone pair = 8</b>; each Cl has 8.']],
        cks: [['How many lone pairs are on the central atom in <b>NF₃</b> (26 valence electrons)?', ['0', '1', '2', '3'], 1, 'Three N–F bonds (6) + 3 lone pairs on each F (18) = 24. The remaining 2 go on N as 1 lone pair, just like PCl₃ and NH₃.'],
          ['Which atom goes in the center of <b>OF₂</b>?', ['O', 'F', 'Either'], 0, 'F is never central, and O is the less electronegative of the two. F–O–F.']] }),
    S('Multiple bonds', `Sometimes you run out of electrons before the central atom has an octet. Then move a lone pair from an outer atom into the bond, turning a single bond into a <b>double bond</b>. If the center is still short, do it again for another double bond or a <b>triple bond</b>.<br><br>This keeps the total electron count the same: you are only moving dots into the space between atoms, where both atoms can count them.`,
      { fig: multiFig,
        exs: [['Draw <b>CO₂</b> (16 electrons).', 'Skeleton O–C–O uses 4. Three lone pairs on each O use 12. Total 16, none left.', 'Check C: only 4 electrons (two single bonds). It needs 4 more.', 'Move one lone pair from each O into its bond.', '<b>O=C=O</b>, two lone pairs on each O. C has 8, each O has 8, 16 electrons in all.'],
          ['Draw <b>HCN</b> (10 electrons).', 'Skeleton H–C–N (C central) uses 4. N gets 3 lone pairs: 10 used.', 'C has only 4. Move two lone pairs from N into the C–N bond.', '<b>H–C≡N with one lone pair on N</b>. C: 2 + 6 = 8. N: 6 + 2 = 8.']],
        trap: 'Adding extra electrons to fix an octet. If you are short, never add dots: you must convert lone pairs into bonds, keeping the total from step 1.',
        cks: [['In the Lewis structure of <b>CH₂O</b> (12 electrons), what bond joins C and O?', ['single', 'double', 'triple'], 1, 'Single bonds to O and two H use 6; three lone pairs on O use the other 6. C then has only 6, so one O lone pair becomes a second C–O bond: C=O.'],
          ['What does the Lewis structure of <b>N₂</b> (10 electrons) look like?', ['N=N with two lone pairs on each N', 'N≡N with one lone pair on each N', 'N–N with three lone pairs on each N', 'N≡N with no lone pairs'], 1, 'Single bond plus three lone pairs each would need 14 electrons. With 10, the octets only work as a triple bond (6 shared) plus one lone pair on each N: 6 + 4 = 10.']] }),
    S('Polyatomic ions', `A polyatomic ion is a group of covalently bonded atoms with an overall charge, like NH₄⁺ or ClO₃⁻. Draw it with the same steps; just remember to adjust the electron count for the charge. Then put the whole structure in <b>square brackets</b> with the charge at the top right.`,
      { fig: ionFig,
        exs: [['Draw the <b>chlorate ion, ClO₃⁻</b>.', 'Count: 7 + 3(6) + 1 = 26. Cl is central.', 'Three Cl–O bonds use 6; three lone pairs on each O use 18. 24 used, 2 left.', 'Put the last 2 on Cl as a lone pair. Cl: 6 + 2 = 8.', '<b>[Cl with 3 single bonds to O and 1 lone pair]⁻</b>, in brackets with the 1− charge.'],
          ['Draw the <b>nitrite ion, NO₂⁻</b>.', 'Count: 5 + 2(6) + 1 = 18. N is central.', 'Two N–O bonds (4) + three lone pairs on each O (12) = 16. The last 2 go on N.', 'N has only 6 (2 bonds + 1 lone pair). Move one O lone pair in: N=O.', '<b>[O=N–O]⁻</b>, with 1 lone pair on N, 2 on the double-bonded O and 3 on the single-bonded O.']],
        cks: [['How many lone pairs are on the central N in <b>NO₂⁻</b>?', ['0', '1', '2', '3'], 1, 'From the worked example: the 17th and 18th electrons land on N as one lone pair. That lone pair will matter for its shape.'],
          ['How many bonds does N form in <b>NH₄⁺</b>, and how many lone pairs does it keep?', ['3 bonds, 1 lone pair', '4 bonds, 0 lone pairs', '4 bonds, 1 lone pair', '3 bonds, 0 lone pairs'], 1, '8 electrons: four N–H bonds use all 8. N has 4 bonds and no lone pair, which is why NH₄⁺ is a perfect tetrahedron.']] }),
    S('Resonance', `Some molecules have more than one valid Lewis structure. In the nitrate ion, NO₃⁻ (24 electrons), N needs one double bond, but it could go to any of the three oxygens. The three drawings are <b>resonance structures</b>, written with double-headed arrows (↔) between them.<br><br>The real ion is none of the drawings. It is a <b>resonance hybrid</b>, an average of them: experiments show all three N–O bonds are identical, between a single and a double bond in length and strength. The electrons are spread over the whole ion.<br><br>Think of a mule, the offspring of a horse and a donkey. It is not a horse half the time and a donkey the rest; it is one animal with traits of both. Resonance structures are just the limits of our drawing tool.`,
      { fig: resFig,
        cks: [['How many resonance structures does the carbonate ion, <b>CO₃²⁻</b>, have?', ['1', '2', '3', '4'], 2, 'CO₃²⁻ has the same pattern as NO₃⁻: 24 electrons, one C=O double bond and two C–O single bonds. The double bond can go to any of the 3 oxygens.'],
          ['Which statement about the N–O bonds in <b>NO₃⁻</b> is true?', ['One is double and two are single, and they swap back and forth', 'All three are identical, each between a single and a double bond', 'All three are double bonds', 'The double bond always stays on the top oxygen'], 1, 'The ion does not flip between structures. It is one hybrid in which all three bonds are the same, which experiments confirm.']],
        ex: ['Draw the resonance structures of <b>SO₂</b> (18 electrons).', 'S central. Two S–O bonds (4) + three lone pairs on each O (12) = 16. The last 2 go on S.', 'S has only 6. Move one lone pair from an O to make S=O.', 'The double bond could go to either oxygen, so there are two: <b>O=S–O ↔ O–S=O</b>, each with a lone pair on S.'] }),
    S('When the octet rule bends', `The octet rule is a guide, not a law. Three cases break it, and two of them appear in this lab:<ul><li><b>Boron</b> is often satisfied with <b>6</b> electrons. In BF₃ (24 electrons), three B–F bonds and three lone pairs on each F use all 24, leaving B with 6. You do not add a double bond here, because fluorine holds its electrons too tightly to share a second pair.</li><li><b>Beryllium</b> is often satisfied with <b>4</b>. In BeCl₂ (16 electrons), Cl–Be–Cl with three lone pairs on each Cl uses all 16.</li><li><b>Odd-electron</b> molecules can't pair everything. NO has 5 + 6 = 11 valence electrons, so one is always unpaired.</li></ul>Larger atoms in row 3 and below (S, P, Cl) can also hold more than 8 in some structures, but in this course you can draw them with octets.`,
      { cks: [['How many electrons surround boron in the Lewis structure of <b>BF₃</b>?', ['4', '6', '8', '10'], 1, 'Three single bonds give B 6 electrons, and all 24 electrons are used up. Boron is a known exception with an incomplete octet.'],
          ['Which molecule must have an <b>unpaired</b> electron?', ['NO₂', 'CO₂', 'SO₂', 'H₂O'], 0, 'NO₂ has 5 + 2(6) = 17 valence electrons, an odd number, so one must be unpaired. The others have 16, 18 and 8.']] }),

    P('Molecular shapes (VSEPR)'),
    S('VSEPR: electron groups spread out', `Lewis structures are flat drawings, but molecules are 3D. <b>VSEPR</b> (valence shell electron pair repulsion) theory predicts the shape: groups of electrons around the central atom <b>repel each other</b> and spread as far apart as possible.<br><br>An <b>electron group</b> is any of these on the central atom:<ul><li>a single bond, a double bond, or a triple bond (each counts as <b>one</b> group),</li><li>a lone pair.</li></ul>The number of groups fixes the <b>electron geometry</b>:<table class="t"><tr><th>Groups</th><th>Electron geometry</th><th>Angle</th></tr><tr><td>2</td><td>linear</td><td>180°</td></tr><tr><td>3</td><td>trigonal planar</td><td>120°</td></tr><tr><td>4</td><td>tetrahedral</td><td>109.5°</td></tr></table>Tie 2, 3 or 4 balloons together at their knots and they settle into exactly these arrangements.`,
      { fig: shapeFig,
        vid: ['Tyler DeWitt', 'VSEPR molecular geometry'],
        trap: 'Counting a double or triple bond as 2 or 3 groups. CO₂ has two double bonds, so C has 2 groups, not 4. The extra electrons in a multiple bond still point the same way.',
        cks: [['How many electron groups are on the C in <b>CO₂</b> (O=C=O), and what is the geometry?', ['4, tetrahedral', '2, linear', '3, trigonal planar', '2, bent'], 1, 'Each double bond is one group, and C has no lone pairs: 2 groups, linear, 180°.'],
          ['How many electron groups are on the C in <b>CH₂O</b>?', ['2', '3', '4', '5'], 1, 'Two C–H bonds plus one C=O double bond, and no lone pairs: 3 groups, trigonal planar, 120°.']] }),
    S('Lone pairs and molecular shape', `The <b>molecular geometry</b> (the shape) describes where the <b>atoms</b> are. Lone pairs take up space and push the bonds around, but they are invisible in the shape's name. So: count all groups for the electron geometry, then name the shape from the atoms only.<table class="t"><tr><th>Groups</th><th>Lone pairs</th><th>Shape (angle)</th><th>e.g.</th></tr><tr><td>2</td><td>0</td><td>linear (180°)</td><td>CO₂</td></tr><tr><td>3</td><td>0</td><td>trigonal planar (120°)</td><td>BF₃</td></tr><tr><td>3</td><td>1</td><td>bent (&lt;120°)</td><td>SO₂</td></tr><tr><td>4</td><td>0</td><td>tetrahedral (109.5°)</td><td>CH₄</td></tr><tr><td>4</td><td>1</td><td>trigonal pyramidal (≈107°)</td><td>NH₃</td></tr><tr><td>4</td><td>2</td><td>bent (≈104.5°)</td><td>H₂O</td></tr></table>Lone pairs push a little harder than bonds, which squeezes the bond angles below the ideal values.`,
      { exs: [['What is the shape of <b>NH₃</b>?', 'Lewis structure: 3 N–H bonds and 1 lone pair on N.', '4 groups → tetrahedral electron geometry.', 'One corner is a lone pair, so the atoms form a pyramid with N on top: <b>trigonal pyramidal, about 107°</b>.'],
          ['What is the shape of <b>H₂O</b>?', 'Lewis structure: 2 O–H bonds and 2 lone pairs on O.', '4 groups → tetrahedral electron geometry.', 'Two corners are lone pairs, so the three atoms make a V: <b>bent, about 104.5°</b>.']],
        trap: 'Calling water "linear" because the Lewis drawing H–O–H is straight. Lewis structures don\'t show shape. Count the groups: 4, so it is bent.',
        cks: [['What is the molecular shape of <b>NF₃</b>?', ['trigonal planar', 'trigonal pyramidal', 'tetrahedral', 'bent'], 1, '3 bonds + 1 lone pair on N = 4 groups. With one lone pair, the shape is trigonal pyramidal. Trigonal planar would need 3 groups and no lone pair, like BF₃.'],
          ['What is the molecular shape of <b>H₂S</b>?', ['linear', 'bent', 'trigonal pyramidal', 'tetrahedral'], 1, 'S is in the same group as O, so H₂S looks like H₂O: 2 bonds + 2 lone pairs = 4 groups, bent.']] }),
    S('Predicting shape from a formula', `Put the whole routine together:<ol><li>Count valence electrons (adjust for charge).</li><li>Draw the Lewis structure.</li><li>Count electron groups on the central atom (multiple bond = 1).</li><li>Note how many of them are lone pairs.</li><li>Read the shape and angle from the table.</li></ol>Steps 1 and 2 are not optional: the formula alone cannot tell you about lone pairs. BF₃ and NF₃ look alike on paper but have different shapes.`,
      { exs: [['Shape of <b>SO₃</b> (24 electrons)?', 'Lewis: S with one double and two single bonds to O; no lone pair on S (all 24 are used on the bonds and the O atoms).', '3 groups, 0 lone pairs.', '<b>Trigonal planar, 120°</b>.'],
          ['Shape of <b>ClO₃⁻</b> (26 electrons)?', 'Lewis: three Cl–O bonds and one lone pair on Cl.', '4 groups, 1 lone pair.', '<b>Trigonal pyramidal</b>, like NH₃.'],
          ['Shape of <b>BeCl₂</b> (16 electrons)?', 'Lewis: Cl–Be–Cl with no lone pairs on Be (an incomplete octet).', '2 groups, 0 lone pairs.', '<b>Linear, 180°</b>.']],
        cks: [['What is the molecular shape of <b>H₃O⁺</b>?', ['trigonal planar', 'trigonal pyramidal', 'tetrahedral', 'bent'], 1, '8 electrons: 3 O–H bonds and 1 lone pair on O. 4 groups with 1 lone pair: trigonal pyramidal.'],
          ['What is the molecular shape of <b>NO₃⁻</b>?', ['trigonal pyramidal', 'trigonal planar', 'tetrahedral', 'bent'], 1, '24 electrons: one N=O and two N–O bonds, no lone pair on N. 3 groups, 0 lone pairs: trigonal planar. Resonance does not change the count.'],
          ['What is the molecular shape of <b>SO₄²⁻</b>?', ['tetrahedral', 'trigonal pyramidal', 'square', 'trigonal planar'], 0, '32 electrons: four S–O bonds and no lone pair on S. 4 groups, 0 lone pairs: tetrahedral.']] }),

    P('Polarity'),
    S('Electronegativity', `When two different atoms share a pair, they don't share it equally. <b>Electronegativity</b> (EN) measures how strongly an atom pulls on shared electrons. It increases <b>up a group and to the right</b>, so fluorine is the most electronegative element. Metals have low values.<br><br>The values this lab uses (your textbook's table rounds them, for example F 4.0, O 3.5, H 2.1):<table class="t"><tr><th>Row</th><th>Electronegativity</th></tr><tr><td>1</td><td>H 2.20</td></tr><tr><td>2</td><td>Li 0.98, Be 1.57, B 2.04, C 2.55, N 3.04, O 3.44, F 3.98</td></tr><tr><td>3</td><td>Na 0.93, Mg 1.31, Al 1.61, Si 1.90, P 2.19, S 2.58, Cl 3.16</td></tr><tr><td>4</td><td>K 0.82, Ca 1.00, Br 2.96</td></tr><tr><td>5</td><td>I 2.66</td></tr></table>In a bond between different atoms, the more electronegative atom pulls the shared electrons closer and gets a partial negative charge, <b>δ−</b> ("delta minus"). The other atom is left partly positive, <b>δ+</b>.`,
      { tip: 'Picture a tug of war over the shared pair. The stronger puller (higher EN) drags the electrons toward itself and becomes δ−. "FONClBrISCH" lists the most electronegative nonmetals in rough order.',
        cks: [['In an H–Cl bond, which atom carries the partial negative charge (δ−)?', ['H', 'Cl', 'Neither'], 1, 'Cl (3.16) is more electronegative than H (2.20), so the shared pair sits closer to Cl.'],
          ['Which element is the most electronegative?', ['Chlorine', 'Oxygen', 'Nitrogen', 'Fluorine'], 3, 'Fluorine (3.98) tops the table: far up and to the right.']] }),
    S('Bond types from ΔEN', `Subtract the two electronegativities to get <b>ΔEN</b> (always positive). It places a bond on a spectrum:<table class="t"><tr><th>ΔEN</th><th>Bond type</th><th>Electrons</th></tr><tr><td>less than 0.4</td><td><b>pure (nonpolar) covalent</b></td><td>shared about equally</td></tr><tr><td>0.4 to 2.0</td><td><b>polar covalent</b></td><td>shared unequally</td></tr><tr><td>above 2.0</td><td><b>ionic</b></td><td>transferred</td></tr></table>A polar bond has a <b>dipole</b>: a positive end and a negative end. Draw it as an arrow pointing toward the δ− atom, with a small + crossing its tail.`,
      { exs: [['Classify the <b>H–Cl</b> bond.', 'ΔEN = |2.20 − 3.16| = 0.96.', 'Between 0.4 and 2.0: <b>polar covalent</b>, with δ− on Cl.'],
          ['Classify the bond between <b>Na and Cl</b>.', 'ΔEN = |0.93 − 3.16| = 2.23.', 'Above 2.0: <b>ionic</b>.'],
          ['Classify the <b>C–H</b> bond.', 'ΔEN = |2.55 − 2.20| = 0.35.', 'Below 0.4: <b>pure covalent</b>. This is why hydrocarbons like oil and wax are nonpolar.']],
        trap: 'The cutoffs are a rule of thumb, and some metal–nonmetal pairs fall below 2.0. Al–Cl has ΔEN = 1.55, so by these numbers it is polar covalent. When a question asks for the bond type from electronegativity, use the numbers; when Ch 5 asks "ionic or molecular compound?", metal + nonmetal still means ionic.',
        vid: ['Khan Academy', 'electronegativity and bond polarity'],
        cks: [['What kind of bond forms between <b>K and F</b>?', ['Pure covalent', 'Polar covalent', 'Ionic'], 2, 'ΔEN = 3.98 − 0.82 = 3.16, well above 2.0: ionic.'],
          ['What kind of bond forms between <b>C and O</b>?', ['Pure covalent', 'Polar covalent', 'Ionic'], 1, 'ΔEN = 3.44 − 2.55 = 0.89: between 0.4 and 2.0, polar covalent, with δ− on O.'],
          ['What kind of bond joins the two atoms in <b>Cl₂</b>?', ['Pure covalent', 'Polar covalent', 'Ionic'], 0, 'Identical atoms pull equally: ΔEN = 0, pure covalent.']] }),
    S('Polar and nonpolar molecules', `A molecule is <b>polar</b> when it has polar bonds whose dipoles <b>don't cancel</b>. That depends on shape:<ul><li>Bond dipoles that point in opposite directions with equal strength cancel, like two equal teams pulling a rope both ways. CO₂ is linear, so its two C=O dipoles cancel: <b>nonpolar</b>.</li><li>In bent H₂O, both O–H dipoles point partly the same way (toward O). They add up to a net dipole: <b>polar</b>.</li></ul>A quick test for the shapes in this chapter: the molecule is <b>nonpolar</b> if the central atom has <b>no lone pairs</b> and <b>all outer atoms are the same</b> (CO₂, BF₃, CH₄, CCl₄, SO₃). Otherwise it is <b>polar</b>: lone pairs on the center (NH₃, H₂O, SO₂) or different outer atoms (CHCl₃, HCN, CH₂O).<br><br>Polarity matters: polar water and nonpolar oil don't mix, and soap works because one end of a soap molecule is polar and the other nonpolar.`,
      { fig: dipFig,
        ex: ['Is <b>CCl₄</b> polar? Is <b>CHCl₃</b>?', 'Both are tetrahedral with no lone pairs on C. Each C–Cl bond is polar (ΔEN 0.61).', 'CCl₄: four identical C–Cl dipoles point to the corners of a tetrahedron and cancel: <b>nonpolar</b>.', 'CHCl₃: swap one Cl for an H, and the pulls no longer balance: <b>polar</b>.'],
        trap: 'Deciding from the bonds alone. CO₂ has polar bonds but is nonpolar. Always look at the shape.',
        vid: ['Crash Course Chemistry', 'polar and nonpolar molecules'],
        cks: [['Is <b>BF₃</b> polar or nonpolar?', ['Polar', 'Nonpolar'], 1, 'Trigonal planar with three identical B–F bonds and no lone pair on B: the three dipoles cancel at 120°.'],
          ['Is <b>NF₃</b> polar or nonpolar?', ['Polar', 'Nonpolar'], 0, 'The lone pair on N makes it trigonal pyramidal. The three N–F dipoles all tilt the same way and do not cancel. Compare BF₃: same formula pattern, different shape, different answer.'],
          ['Is <b>HCN</b> polar or nonpolar?', ['Polar', 'Nonpolar'], 0, 'It is linear like CO₂, but the two ends are different. C pulls a little harder than H, and N pulls harder than C, so both bond dipoles point toward the N end. They add instead of cancelling.']] }),

    P('Putting it together'),
    S('From formula to polarity: the full workup', `Exam questions often hand you a formula and ask for everything. Work in order, because each answer feeds the next:<ol><li>Total valence electrons.</li><li>Lewis structure (multiple bonds, resonance, brackets for ions).</li><li>Electron groups and lone pairs on the central atom.</li><li>Electron geometry, molecular shape, bond angle.</li><li>Bond polarity from ΔEN.</li><li>Molecular polarity from shape.</li></ol>`,
      { exs: [['Do the full workup for <b>SO₂</b>.', 'Electrons: 6 + 2(6) = 18.', 'Lewis: O=S–O ↔ O–S=O, with one lone pair on S (resonance).', 'Groups on S: 2 bonds + 1 lone pair = 3. Electron geometry trigonal planar.', 'Shape: <b>bent</b>, slightly under 120° (about 119°).', 'S–O: ΔEN = 3.44 − 2.58 = 0.86, polar covalent. Bent shape, so the dipoles do not cancel: <b>polar</b>.'],
          ['Do the full workup for <b>PCl₃</b>.', 'Electrons: 5 + 3(7) = 26.', 'Lewis: three P–Cl bonds, three lone pairs on each Cl, one lone pair on P.', 'Groups on P: 4, with 1 lone pair. Electron geometry tetrahedral; shape <b>trigonal pyramidal</b>, under 109.5°.', 'P–Cl: ΔEN = 3.16 − 2.19 = 0.97, polar covalent. Lone pair makes it lopsided: <b>polar</b>.']],
        num: ['How many total valence electrons are in <b>OF₂</b>?', 20, 'e⁻', 'O: 6. F: 2 × 7 = 14. Total 20: two O–F bonds (4), two lone pairs on O (4), three on each F (12).'],
        cks: [['What is the molecular shape of <b>OF₂</b>?', ['linear', 'bent', 'trigonal planar', 'tetrahedral'], 1, 'O has 2 bonds and 2 lone pairs: 4 groups, bent, like water.'],
          ['Is <b>SiH₄</b> polar or nonpolar?', ['Polar', 'Nonpolar'], 1, 'Tetrahedral, four identical Si–H bonds, no lone pairs on Si: any bond dipoles cancel. (Si–H is barely polar anyway: ΔEN 0.30.)']] }),
  ], {
    goals: ['Draw Lewis symbols for atoms and Lewis structures for ionic compounds', 'Count total valence electrons for any molecule or polyatomic ion', 'Draw Lewis structures with single, double and triple bonds, including polyatomic ions in brackets', 'Draw resonance structures and recognize octet exceptions (B, Be, odd electrons)', 'Predict electron geometry, molecular shape and bond angles with VSEPR', 'Classify a bond as pure covalent, polar covalent or ionic from ΔEN', 'Decide whether a molecule is polar or nonpolar from its bonds and shape'],
    need: [['electrons', 'Valence electrons, group numbers and the electronegativity trend (Ch 9).'], ['compounds', 'Ionic vs molecular compounds and common polyatomic ions (Ch 5).']],
    vids: [['Tyler DeWitt', 'Lewis structures'], ['The Organic Chemistry Tutor', 'VSEPR theory molecular geometry'], ['Melissa Maribel', 'Lewis structures'], ['Khan Academy', 'electronegativity'], ['Crash Course Chemistry', 'bonding models and Lewis structures']],
    keep: ['Lewis symbol: one dot per valence electron (A-group number), singly on four sides before pairing.', 'Octet rule: atoms reach 8 valence electrons (H: 2). Metals transfer to nonmetals (ionic); nonmetals share (covalent).', 'Total electrons: add group numbers; add 1 per − charge, subtract 1 per + charge.', 'Draw: least electronegative atom central (never H or F), single bonds, outer octets, leftovers on center, then make multiple bonds if the center is short.', 'Ions go in brackets with the charge. Resonance: same atoms, different double-bond position; the real thing is the average.', 'B can have 6 electrons, Be 4; odd-electron molecules have one unpaired.', 'VSEPR: 2 groups linear 180°, 3 trigonal planar 120°, 4 tetrahedral 109.5°. A multiple bond is one group.', 'With lone pairs: 3 groups/1 LP bent; 4/1 trigonal pyramidal ≈107°; 4/2 bent ≈104.5°.', 'ΔEN < 0.4 pure covalent, 0.4–2.0 polar covalent, > 2.0 ionic. δ− goes on the more electronegative atom.', 'Polar molecule: polar bonds that don\'t cancel. No lone pairs on the center + identical outer atoms = nonpolar.'],
  });
}
