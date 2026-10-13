'use strict';
/* "Watch it" content: particle-level storyboards and live simulations, keyed by lab id.
   Each atom keeps its id from step to step, so the same atom can be followed as bonds break and form. */

/* Push a molecule's atoms away from their center and drop its bonds (bonds breaking) */
function explode(part, k = 2.2, dx = 0, dy = 0) {
  const cx = part.atoms.reduce((s, a) => s + a.x, 0) / part.atoms.length, cy = part.atoms.reduce((s, a) => s + a.y, 0) / part.atoms.length;
  return { atoms: part.atoms.map(a => ({ ...a, x: cx + (a.x - cx) * k + dx, y: cy + (a.y - cy) * k + dy })) };
}
/* An ion with water molecules around it. Cations get oxygen pointing in; anions get hydrogens pointing in. */
function hydrated(id, el, x, y, q, waters, angles, r) {
  const cation = q.includes('+');
  r = r || (cation ? 7.6 : 10);
  return [A(id, el, x, y, { q, r: el === 'Na' ? 2.6 : 3.9 }), ...waters.map((w, i) => {
    const th = angles[i] * Math.PI / 180, wx = x + r * Math.cos(th), wy = y + r * Math.sin(th);
    return M('H2O', wx, wy, w, cation ? th - Math.PI / 2 : th + Math.PI / 2);
  })];
}
const W6 = [[32, 17], [46, 17], [60, 17], [39, 30], [53, 30], [67, 30]];

const STORIES = {
  'matter-energy': { title: 'Physical vs. chemical change, molecule by molecule', frames: () => {
    const ice = W6.map(([x, y], i) => M('H2O', x, y, 'w' + i, 0));
    const liq = [[24, 32, 0.8], [40, 38, -1.2], [55, 28, 2], [72, 36, -0.5], [36, 22, 3], [62, 41, 1.4]].map(([x, y, r], i) => M('H2O', x, y, 'w' + i, r));
    const apart = liq.map((m, i) => explode(m, 2.4, (i % 3 - 1) * 2, i < 3 ? -4 : 2));
    const h2 = W6.map((_, i) => M('H2', 14 + (i % 3) * 11, 16 + Math.floor(i / 3) * 16, ['w' + i + '.1', 'w' + i + '.2']));
    const o2 = [0, 1, 2].map(j => M('O2', 72, 12 + j * 13, ['w' + (2 * j) + '.0', 'w' + (2 * j + 1) + '.0']));
    return [
      F('Ice: every particle is an H₂O molecule (one oxygen, two hydrogens), locked in a repeating pattern.', [ice, T('t', 50, 45, 'ice · H₂O(s)', { size: 2.6, color: '--muted' })]),
      F('<b>Melting is a physical change.</b> The molecules move and tumble past each other, but each one is still H₂O.', [liq, T('t', 50, 47, 'liquid water · H₂O(l)', { size: 2.6, color: '--muted' })]),
      F('Run electricity through water and something different happens: the bonds <i>inside</i> each molecule break.', [apart, T('t', 50, 47, 'bonds breaking', { size: 2.6, color: '--c2' })], { hold: 2000 }),
      F('<b>That is a chemical change.</b> The atoms regroup into hydrogen gas and oxygen gas, new substances with new properties: 2 H₂O → 2 H₂ + O₂.', [h2, o2, T('a', 25, 45, 'H₂ (g)', { size: 3 }), T('b', 72, 47, 'O₂ (g)', { size: 3 })]),
    ];
  } },

  atoms: { title: 'Building atoms from protons, neutrons and electrons', frames: () => {
    const cx = 50, cy = 25, lab = (s) => T('lab', 50, 3.5, s, { size: 2.7, weight: 600 });
    return [
      F('Hydrogen: one proton in the nucleus and one electron around it. One proton (Z = 1) is what makes it hydrogen.', [nucleus('h', 1, 0, cx, cy), Ring('r1', cx, cy, 10), E('e1', cx, cy, 10, 0, 1.1), lab('Hydrogen-1 · 1 p⁺ · 0 n · 1 e⁻')]),
      F('Add a neutron. It is still hydrogen, just heavier: H-2 (deuterium). Same element, different mass number: an <b>isotope</b>.', [nucleus('h', 1, 1, cx, cy), Ring('r1', cx, cy, 10), E('e1', cx, cy, 10, 0, 1.1), lab('Hydrogen-2 · 1 p⁺ · 1 n · 1 e⁻')]),
      F('Two protons make <b>helium</b>, whatever the neutron count. Two electrons balance the +2 charge of the nucleus.', [nucleus('h', 2, 2, cx, cy), Ring('r1', cx, cy, 10), E('e1', cx, cy, 10, 0, 1.1), E('e2', cx, cy, 10, Math.PI, 1.1), lab('Helium-4 · 2 p⁺ · 2 n · 2 e⁻')]),
      F('Lithium has 3 protons. The first shell holds only 2 electrons, so the third starts a new outer shell: its <b>valence electron</b>.', [nucleus('h', 3, 4, cx, cy), Ring('r1', cx, cy, 10), Ring('r2', cx, cy, 18), E('e1', cx, cy, 10, 0, 1.1), E('e2', cx, cy, 10, Math.PI, 1.1), E('e3', cx, cy, 18, 0.5, 0.6), lab('Lithium-7 · 3 p⁺ · 4 n · 3 e⁻')]),
      F('Lithium loses that outer electron easily. Now 3 protons and 2 electrons: the <b>Li⁺ ion</b>, charge +1. Metals form cations this way.', [nucleus('h', 3, 4, cx, cy), Ring('r1', cx, cy, 10), E('e1', cx, cy, 10, 0, 1.1), E('e2', cx, cy, 10, Math.PI, 1.1), A('e3', 'e', 95, 6, { o: 0.35 }), lab('Li⁺ · 3 p⁺ · 4 n · 2 e⁻ → charge +1'), T('q', 61, 14, '+1', { size: 4, color: '--c2' })]),
    ];
  } },

  compounds: { title: 'How an ionic bond forms', frames: () => {
    const slots = [0, 1, 2, 3, 5, 6, 7].map(k => k * Math.PI / 4);
    const clDots = (cx, cy) => slots.map((a, i) => A('c' + i, 'e', cx + 6.5 * Math.cos(a), cy + 6.5 * Math.sin(a)));
    const lattice = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
      const i = r * 7 + c, isNa = (r + c) % 2 === 0, id = i === 0 ? 'na' : i === 1 ? 'cl' : 'L' + i;
      lattice.push(A(id, isNa ? 'Na' : 'Cl', 26 + c * 8, 11 + r * 8.8, { r: isNa ? 2.6 : 3.9 }));
    }
    return [
      F('Sodium has 1 valence electron. Chlorine has 7. Each would be more stable with a full outer shell of 8.', [A('na', 'Na', 28, 25), E('e1', 28, 25, 7, 0, 0.8), A('cl', 'Cl', 70, 25), clDots(70, 25), T('t1', 28, 41, 'Na · 1 valence e⁻', { size: 2.6 }), T('t2', 70, 41, 'Cl · 7 valence e⁻', { size: 2.6 })]),
      F('Sodium <b>transfers</b> its electron to chlorine. Sodium loses one electron; chlorine gains one.', [A('na', 'Na', 28, 25), A('e1', 'e', 63.5, 25), A('cl', 'Cl', 70, 25), clDots(70, 25), Ar('a', 36, 17, 61, 19, { color: '--c2' }), T('t1', 28, 41, 'loses 1 e⁻', { size: 2.6 }), T('t2', 70, 41, 'gains 1 e⁻', { size: 2.6 })], { hl: ['e1'] }),
      F('Now they are ions: Na⁺ (smaller, it lost its outer shell) and Cl⁻ (larger). Opposite charges attract. That attraction is the <b>ionic bond</b>.', [A('na', 'Na', 44, 25, { q: '+', r: 2.6 }), A('cl', 'Cl', 57, 25, { q: '−', r: 3.9 }), T('t3', 50, 40, 'Na⁺  +  Cl⁻  →  NaCl', { size: 3 })]),
      F('Trillions of ions stack into a repeating <b>crystal lattice</b>: table salt. NaCl means a 1 : 1 ratio of ions, not a single molecule.', [lattice, T('t4', 50, 47, 'Na⁺ (purple) and Cl⁻ (green) alternate in every direction', { size: 2.3, color: '--muted' })]),
      F('Other charges need other ratios. <b>Criss-cross</b> Al³⁺ and O²⁻: each charge becomes the other ion\'s subscript → Al₂O₃. Check: 2(+3) + 3(−2) = 0.', [T('al', 36, 7, 'Al³⁺', { size: 5 }), T('o', 64, 7, 'O²⁻', { size: 5 }), Ar('x1', 40, 11, 58, 19, { color: '--c2' }), Ar('x2', 60, 11, 42, 19, { color: '--c2' }), T('res', 50, 24, 'Al₂O₃', { size: 5, color: '--c2' }),
        A('o1', 'O', 26, 38, { q: '2−', r: 3.6 }), A('a1', 'Al', 38, 38, { q: '3+', r: 2.6 }), A('o2', 'O', 50, 38, { q: '2−', r: 3.6 }), A('a2', 'Al', 62, 38, { q: '3+', r: 2.6 }), A('o3', 'O', 74, 38, { q: '2−', r: 3.6 })]),
    ];
  } },

  composition: { title: 'What a mole actually is', frames: () => {
    const dozen = Array.from({ length: 12 }, (_, i) => A('c' + i, 'C', 30 + (i % 6) * 8, 21 + Math.floor(i / 6) * 9));
    const many = Array.from({ length: 60 }, (_, i) => A('c' + i, 'C', 8 + (i % 15) * 6, 21 + Math.floor(i / 15) * 6.5, { r: 1.7 }));
    const box = (id, x, s, c) => [Box(id, x, 18, 24, 13, { fill: c, alpha: 0.16, stroke: c }), T(id + 't', x + 12, 24.5, s, { size: 3.4 })];
    return [
      F('"Dozen" is a counting word: 12 of anything. Chemists need a counting word too, because atoms are far too small to count one by one.', [dozen, T('t', 50, 8, '1 dozen = 12', { size: 4.5, display: true })]),
      F('That word is the <b>mole</b>: 6.022 × 10²³ particles (Avogadro\'s number). A mole of anything is 602,200,000,000,000,000,000,000 of it.', [many, T('t', 50, 8, '1 mole = 6.022 × 10²³', { size: 4.5, display: true })]),
      F('The useful part: one mole weighs its formula mass <b>in grams</b>. 12.01 g of carbon and 18.02 g of water each contain exactly one mole of particles.', [A('c0', 'C', 28, 25, { r: 4 }), M('H2O', 72, 23, 'w'), T('a', 28, 38, '1 mol C = 12.01 g', { size: 3.2 }), T('b', 72, 38, '1 mol H₂O = 18.02 g', { size: 3.2 }), T('t', 50, 8, 'molar mass = grams per mole', { size: 3.4, color: '--muted' })]),
      F('So the road map is always: <b>grams ⇄ moles ⇄ particles</b>. Divide by molar mass to get moles; multiply by 6.022 × 10²³ to count particles.', [box('g', 4, 'grams', '--c2'), box('m', 38, 'moles', '--c1'), box('p', 72, 'particles', '--c3'),
        Ar('a1', 29, 21.5, 37, 21.5), Ar('a2', 37, 28, 29, 28), Ar('a3', 63, 21.5, 71, 21.5), Ar('a4', 71, 28, 63, 28),
        T('l1', 33, 13, '÷ g/mol', { size: 2.4, mono: true }), T('l2', 33, 36, '× g/mol', { size: 2.4, mono: true }), T('l3', 67, 13, '× 6.022×10²³', { size: 2.4, mono: true }), T('l4', 67, 36, '÷ 6.022×10²³', { size: 2.4, mono: true })]),
    ];
  } },

  reactions: { title: 'In a reaction, atoms rearrange and none are lost', frames: () => reactionFrames() },

  stoichiometry: { title: 'Seeing the limiting reactant', frames: () => {
    const nPos = [[13, 11], [13, 24], [13, 37]], hPos = [[33, 9], [44, 9], [33, 24], [44, 24], [33, 39], [44, 39]];
    const start = [nPos.map(([x, y], i) => M('N2', x, y, 'n' + i)), hPos.map(([x, y], i) => M('H2', x, y, 'h' + i))];
    const Hs = hPos.flatMap((_, i) => ['h' + i + '.0', 'h' + i + '.1']), Ns = ['n0.0', 'n0.1', 'n1.0', 'n1.1'];
    const nh3 = [[65, 16], [84, 16], [65, 36], [84, 36]].map(([x, y], k) => M('NH3', x, y, [Ns[k], Hs[3 * k], Hs[3 * k + 1], Hs[3 * k + 2]]));
    return [
      F('Start with <b>3 N₂</b> and <b>6 H₂</b>. The balanced equation N₂ + 3 H₂ → 2 NH₃ says each N₂ needs three H₂.', [start, T('a', 13, 47, '3 N₂', { size: 2.8 }), T('b', 38.5, 47, '6 H₂', { size: 2.8 }), T('eq', 75, 24, 'N₂ + 3 H₂ → 2 NH₃', { size: 3, color: '--muted' })]),
      F('React them. The <b>hydrogen runs out first</b>: 6 H₂ make 4 NH₃ and use only 2 of the N₂.', [nh3, M('N2', 13, 37, 'n2'), T('c', 74.5, 47, '4 NH₃ formed', { size: 2.8 }), T('d', 13, 28, 'left over', { size: 2.4, color: '--c2' })], { hl: ['n2.0', 'n2.1'] }),
      F('So <b>H₂ is the limiting reactant</b> and N₂ is in excess. The theoretical yield (4 NH₃) comes from the limiting reactant, never from the one left over.', [nh3, M('N2', 13, 37, 'n2'), T('c', 74.5, 47, '4 NH₃ formed', { size: 2.8 }), T('d', 13, 28, 'excess N₂', { size: 2.4, color: '--c2' }), T('s', 50, 4, 'limiting reactant = the one that runs out first', { size: 2.8, color: '--c1' })]),
    ];
  } },

  electrons: { title: 'Where atomic light comes from', frames: () => {
    const cx = 28, cy = 25, R = [0, 7, 13, 19], LY = [0, 42, 22, 13];
    const base = [A('nuc', 'p', cx, cy, { r: 2.3, lab: '+' }), [1, 2, 3].map(n => Ring('r' + n, cx, cy, R[n])), [1, 2, 3].map(n => [Box('L' + n, 60, LY[n], 26, 0.35, { fill: '--muted', alpha: 0.9 }), T('Lt' + n, 89, LY[n], 'n = ' + n, { size: 2.3, align: 'left', mono: true, weight: 400 })]), T('en', 73, 4, 'energy levels', { size: 2.4, color: '--muted' })];
    const at = (n, speed) => [E('e', cx, cy, R[n], 0, speed), A('dot', 'e', 73, LY[n], { r: 1.3 })];
    return [
      F('An electron normally sits in the lowest energy level it can, n = 1: the <b>ground state</b>.', [base, at(1, 1.3)]),
      F('Energy arrives (heat, electricity, or light) and the atom absorbs it.', [base, at(1, 1.3), Ph('in', 4, 4, cx - 5, cy - 5, '#7c5cff')], { hold: 1800 }),
      F('The electron <b>jumps up</b> to a higher level, n = 3: an <b>excited state</b>. Only exact energy amounts work, because the levels are fixed.', [base, at(3, 0.55), Ar('j', 66, 40, 66, 15, { color: '--c1', dashed: true })]),
      F('It falls back to n = 2 and releases the energy as a photon of <b>red light (656 nm)</b>. The photon\'s energy equals the gap between the levels.', [base, at(2, 0.8), Ar('j', 66, 15, 66, 20, { color: '#e8463a' }), Ph('o1', cx + 6, cy - 9, 52, 3, '#e8463a'), T('w1', 52, 7, '656 nm', { size: 2.3, align: 'left', color: '#e8463a' })]),
      F('Falling from n = 2 to n = 1 is a bigger gap, so the photon carries more energy: 122 nm ultraviolet, invisible to us. Each element\'s gaps are unique, so each glows its own <b>line spectrum</b>.', [base, at(1, 1.3), Ar('j', 66, 22, 66, 40, { color: '#8e7cc3' }), Ph('o2', cx + 6, cy + 9, 52, 47, '#8e7cc3', { wl: 4 }), T('w2', 53, 44, '122 nm UV', { size: 2.3, align: 'left', color: '#8e7cc3' })]),
    ];
  } },

  bonding: { title: 'Covalent bonds: sharing electrons', frames: () => {
    const O = [50, 21], Ha = [44.5, 27.5], Hb = [55.5, 27.5];
    return [
      F('Two hydrogen atoms, each with one electron. Hydrogen is stable with 2 electrons, so neither is satisfied alone.', [A('a', 'H', 24, 25, { r: 2.6 }), E('e1', 24, 25, 6, 0, 1), A('b', 'H', 76, 25, { r: 2.6 }), E('e2', 76, 25, 6, Math.PI, 1)]),
      F('As they approach, each nucleus starts attracting the other atom\'s electron.', [A('a', 'H', 42, 25, { r: 2.6 }), E('e1', 42, 25, 6, 0, 1), A('b', 'H', 58, 25, { r: 2.6 }), E('e2', 58, 25, 6, Math.PI, 1)], { hold: 1800 }),
      F('The two electrons are now <b>shared</b> between both nuclei, so each H counts 2. A shared pair of electrons is a <b>covalent bond</b>: H–H.', [A('a', 'H', 46, 25, { r: 2.6 }), A('b', 'H', 54, 25, { r: 2.6 }), B('a', 'b'), A('e1', 'e', 50, 23.3), A('e2', 'e', 50, 26.7), T('t', 50, 40, 'H–H · one shared pair = one covalent bond', { size: 2.6 })]),
      F('Oxygen has 6 valence electrons and needs 2 more to reach 8. Two hydrogen atoms each bring 1.', [A('o', 'O', ...O, { r: 3.2 }), ...[[47.5, 15.2], [52.5, 15.2], [44.2, 19.5], [44.2, 23.5], [55.8, 19.5], [55.8, 23.5]].map(([x, y], i) => A('d' + (i + 1), 'e', x, y)), A('a', 'H', 26, 38, { r: 2.6 }), E('e1', 26, 38, 5.5, 0, 1), A('b', 'H', 74, 38, { r: 2.6 }), E('e2', 74, 38, 5.5, Math.PI, 1)]),
      F('Two shared pairs make two O–H bonds. Oxygen\'s two <b>lone pairs</b> push the hydrogens down, so water is <b>bent</b> (104.5°), not straight. That shape makes water polar.', [A('o', 'O', ...O, { r: 3.2 }), A('a', 'H', ...Ha, { r: 2.6 }), A('b', 'H', ...Hb, { r: 2.6 }), B('o', 'a'), B('o', 'b'),
        A('d3', 'e', 48.0, 25.4), A('e1', 'e', 46.4, 23.9), A('d5', 'e', 52.0, 25.4), A('e2', 'e', 53.6, 23.9), A('d1', 'e', 45.4, 17.3), A('d4', 'e', 47.3, 15.6), A('d2', 'e', 52.7, 15.6), A('d6', 'e', 54.6, 17.3),
        T('t', 50, 40, 'H₂O · 2 bonding pairs + 2 lone pairs → bent', { size: 2.6 })]),
    ];
  } },

  'liquids-solids': { title: 'States of matter, particle by particle', live: statesSim },

  solutions: { title: 'How salt dissolves in water', frames: () => {
    const ions = [[14, 20], [22, 20], [30, 20], [14, 28], [22, 28], [30, 28]].map(([x, y], i) => { const na = i % 2 === 0; return A('i' + i, na ? 'Na' : 'Cl', x, y, { q: na ? '+' : '−', r: na ? 2.6 : 3.9 }); });
    const wpos = [[52, 10, 0.4], [66, 14, -1], [80, 9, 2], [92, 18, 1], [56, 24, -2], [72, 27, 0.7], [86, 31, -0.3], [50, 38, 2.6], [64, 41, -1.4], [78, 43, 1.1], [92, 42, 0.2], [60, 32, 1.8]];
    const waters = wpos.map(([x, y, r], i) => M('H2O', x, y, 'w' + i, r));
    const near = [...ions.filter((_, i) => i !== 2 && i !== 5)];
    const approach = [hydrated('i2', 'Na', 30, 20, '+', ['w0', 'w1'], [-60, -5]), hydrated('i5', 'Cl', 30, 28, '−', ['w4', 'w7'], [15, 70]), wpos.slice(2).map(([x, y, r], k) => [2, 3, 5, 6, 8, 9, 10, 11].includes(k + 2) ? M('H2O', x - 10, y, 'w' + (k + 2), r) : null)];
    const pulled = [hydrated('i2', 'Na', 48, 12, '+', ['w0', 'w1', 'w2', 'w3'], [0, 90, 180, 270]), hydrated('i5', 'Cl', 60, 36, '−', ['w4', 'w7', 'w5', 'w6'], [45, 135, 225, 315]), [8, 9, 10, 11].map(k => M('H2O', wpos[k][0] + 4, wpos[k][1] - 26 * (k % 2), 'w' + k, wpos[k][2]))];
    const spread = [
      hydrated('i0', 'Na', 13, 12, '+', ['w8', 'w9'], [30, 210]), hydrated('i1', 'Cl', 33, 38, '−', ['w10', 'w11'], [-30, 150]),
      hydrated('i2', 'Na', 50, 13, '+', ['w0', 'w1'], [0, 180]), hydrated('i3', 'Cl', 68, 37, '−', ['w2', 'w3'], [20, 200]),
      hydrated('i4', 'Na', 86, 13, '+', ['w4', 'w5'], [60, 240]), hydrated('i5', 'Cl', 15, 37, '−', ['w6', 'w7'], [-60, 120]),
    ];
    return [
      F('A tiny salt crystal (Na⁺ and Cl⁻ ions) drops into water. Water molecules are polar: the O end is slightly negative, the H ends slightly positive.', [ions, waters]),
      F('Water molecules crowd the crystal\'s edge. Their <b>O ends point at Na⁺</b> and their <b>H ends point at Cl⁻</b>: opposite charges attract.', [near, approach]),
      F('The tug wins. Ions are pulled off the crystal and each is wrapped in a shell of water molecules (<b>hydration</b>).', [near, pulled]),
      F('Dissolved: every ion is surrounded by water and spread evenly through the solution. Free-moving ions are why salt water conducts electricity. Polar water pulls apart ionic and polar solutes: <b>like dissolves like</b>.', [spread]),
    ];
  } },

  'acids-bases': { title: 'Strong acid vs. weak acid', frames: () => {
    const sP = [[17, 14], [33, 20], [15, 31], [31, 38]], wP = [[67, 14], [83, 20], [65, 31], [81, 38]];
    const head = [Box('div', 49.6, 2, 0.5, 46, { fill: '--line', alpha: 1 }), T('L', 25, 4, 'Strong acid · HCl', { size: 2.8 }), T('R', 75, 4, 'Weak acid · HF', { size: 2.8 })];
    const intactS = sP.map(([x, y], i) => M('HCl', x, y, 's' + i)), intactW = wP.map(([x, y], i) => M('HF', x, y, 'f' + i));
    const ionS = sP.map(([x, y], i) => [A('s' + i + '.0', 'H', x - 7, y - 3, { q: '+', r: 1.7 }), A('s' + i + '.1', 'Cl', x + 2, y, { q: '−', r: 3.9 })]);
    const split = (i, [x, y]) => [A('f' + i + '.0', 'H', x - 7, y - 3, { q: '+', r: 1.7 }), A('f' + i + '.1', 'F', x + 2, y, { q: '−', r: 2.9 })];
    return [
      F('Same number of acid molecules on each side, about to meet water.', [head, intactS, intactW]),
      F('<b>Strong acid:</b> every HCl ionizes into H⁺ and Cl⁻ (the H⁺ rides on water as H₃O⁺). <b>Weak acid:</b> only a few HF molecules do.', [head, ionS, intactW.filter((_, i) => i !== 1), split(1, wP[1])]),
      F('Weak-acid ionization is an <b>equilibrium</b>, HF ⇌ H⁺ + F⁻. Molecules keep splitting and re-forming, but at any moment most HF is intact.', [head, ionS, intactW.filter((_, i) => i !== 3), split(3, wP[3]), T('eq', 75, 47, 'HF ⇌ H⁺ + F⁻', { size: 2.8, color: '--c2' })]),
      F('Same concentration, very different [H₃O⁺]. The strong acid releases far more H⁺, so its pH is lower: 0.10 M HCl is pH 1.0, while 0.10 M HF is about pH 2.1.', [head, ionS, intactW.filter((_, i) => i !== 3), split(3, wP[3]), T('pl', 25, 47, '0.10 M HCl → pH 1.0', { size: 2.6, mono: true }), T('pr', 75, 47, '0.10 M HF → pH ≈ 2.1', { size: 2.6, mono: true })]),
    ];
  } },

  equilibrium: { title: 'Dynamic equilibrium: both directions never stop', live: equilibriumSim },

  redox: { title: 'Electrons on the move: zinc and copper', frames: () => {
    const zy = [8, 14.8, 21.6, 28.4, 35.2, 42], strip = Box('strip', 16, 3, 8, 44, { fill: '--muted', alpha: 0.18, stroke: '--muted' });
    const zn = (skip = []) => zy.map((y, i) => skip.includes(i) ? null : A('z' + i, 'Zn', 20, y, { r: 3.1 }));
    const cu0 = [[56, 12], [72, 28], [46, 33], [82, 14]].map(([x, y], i) => A('c' + i, 'Cu', x, y, { q: '2+', r: 2.7 }));
    const sol = Box('sol', 30, 3, 68, 44, { fill: '--c1', alpha: 0.08 });
    return [
      F('A zinc strip dips into a blue solution of copper(II) ions, Cu²⁺.', [sol, strip, zn(), cu0, T('t', 64, 47, 'Cu²⁺(aq)', { size: 2.6, color: '--muted' })]),
      F('Zinc is higher on the activity series, so a zinc atom gives up <b>two electrons</b> to a Cu²⁺ ion that bumps into the strip.', [sol, strip, zn(), A('c0', 'Cu', 27.5, 21.6, { q: '2+', r: 2.7 }), cu0.slice(1), A('e1', 'e', 22, 19.5), A('e2', 'e', 22, 23.7)], { hl: ['z2'] }),
      F('The electrons move from Zn to Cu²⁺.', [sol, strip, zn(), A('c0', 'Cu', 27.5, 21.6, { q: '2+', r: 2.7 }), cu0.slice(1), A('e1', 'e', 26.2, 18.6), A('e2', 'e', 26.2, 24.6), Ar('a', 21, 13, 27, 15, { color: '--c2' })], { hl: ['e1', 'e2'], hold: 1800 }),
      F('Zinc lost electrons: it is <b>oxidized</b> to Zn²⁺ and dissolves. Copper gained them: it is <b>reduced</b> to Cu metal and sticks to the strip. <b>OIL RIG</b>: oxidation is loss, reduction is gain.', [sol, strip, zn([2]), A('z2', 'Zn', 44, 22, { q: '2+', r: 2.6 }), A('c0', 'Cu', 20, 21.6, { r: 3.1 }), cu0.slice(1),
        T('ox', 64, 43, 'Zn → Zn²⁺ + 2e⁻  (oxidation)', { size: 2.4, mono: true, weight: 400 }), T('rd', 64, 47.5, 'Cu²⁺ + 2e⁻ → Cu  (reduction)', { size: 2.4, mono: true, weight: 400 })]),
      F('It keeps going: copper builds up on the strip, zinc ions fill the solution, and the blue color fades. Overall: Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s).', [sol, strip, zn([2, 4, 0]), A('z2', 'Zn', 44, 27, { q: '2+', r: 2.6 }), A('z4', 'Zn', 62, 34, { q: '2+', r: 2.6 }), A('z0', 'Zn', 76, 10, { q: '2+', r: 2.6 }), A('c0', 'Cu', 20, 21.6, { r: 3.1 }), A('c2', 'Cu', 20, 35.2, { r: 3.1 }), A('c1', 'Cu', 20, 8, { r: 3.1 }), A('c3', 'Cu', 84, 30, { q: '2+', r: 2.7 }),
        T('ov', 64, 46, 'Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s)', { size: 2.5, mono: true })]),
    ];
  } },

  nuclear: { title: 'Alpha and beta decay up close', frames: () => {
    const u = nucleus('u', 10, 12, 32, 26, 2.05, 2.15);
    const alphaIds = ['u.16', 'u.17', 'u.18', 'u.19'], rest = { atoms: u.atoms.filter(a => !alphaIds.includes(a.id)) };
    const alpha = (cx, cy) => ({ atoms: alphaIds.map((id, k) => ({ ...u.atoms.find(a => a.id === id), x: cx + (k % 2 ? 2.1 : -2.1), y: cy + (k < 2 ? -2.1 : 2.1) })) });
    const n1 = u.atoms.find(a => a.id === 'u.1');
    const restP = { atoms: rest.atoms.map(a => (a.id === 'u.1' ? { ...a, el: 'p' } : a)) };
    return [
      F('A uranium-238 nucleus (drawn with far fewer particles). With 92 protons pushing each other apart, it is unstable.', [u, T('l', 34, 6, 'U-238 · 92 p⁺ · 146 n', { size: 2.6 })]),
      F('It ejects an <b>alpha particle</b>: 2 protons and 2 neutrons bound together, which is a helium-4 nucleus.', [rest, alpha(50, 25), T('l', 34, 6, 'U-238 · 92 p⁺ · 146 n', { size: 2.6 })], { hl: alphaIds, hold: 1800 }),
      F('The alpha flies off. The nucleus lost 4 in mass number and 2 in atomic number: uranium has become <b>thorium-234</b>.', [rest, alpha(88, 20), T('l', 34, 6, 'Th-234 · 90 p⁺ · 144 n', { size: 2.6 }), T('al', 88, 12, 'α = ⁴₂He', { size: 3 }), T('eq', 50, 46, '²³⁸₉₂U → ²³⁴₉₀Th + ⁴₂He', { size: 3.2 })]),
      F('<b>Beta decay</b> is different: inside the nucleus, one neutron turns into a proton…', [restP, alpha(88, 20), T('l', 34, 6, 'Th-234', { size: 2.6 }), A('beta', 'e', n1.x, n1.y, { r: 1.3 })], { hl: ['u.1'], hold: 1800 }),
      F('…and shoots out an electron, the <b>beta particle</b>. One more proton means Z goes up by 1 while A stays the same: thorium-234 becomes protactinium-234.', [restP, T('l', 34, 6, 'Pa-234 · 91 p⁺ · 143 n', { size: 2.6 }), A('beta', 'e', 88, 40, { r: 1.3 }), T('bl', 88, 33, 'β⁻ = ⁰₋₁e', { size: 3 }), T('eq', 50, 46, 'n → p⁺ + e⁻', { size: 3.2 })]),
    ];
  } },
};

/* Methane combustion, used by Ch 7 and the home page */
function reactionFrames() {
  const mI = ['m.C', 'm.H1', 'm.H2', 'm.H3', 'm.H4'], aI = ['a.O1', 'a.O2'], bI = ['b.O1', 'b.O2'];
  const cnt = s => T('cnt', 50, 47, s, { size: 2.5, mono: true, color: '--muted', weight: 400 });
  const loose = [['m.C', 'C', 24, 25], ['m.H1', 'H', 15, 14], ['m.H2', 'H', 33, 12], ['m.H3', 'H', 31, 38], ['m.H4', 'H', 13, 36], ['a.O1', 'O', 45, 9], ['a.O2', 'O', 55, 18], ['b.O1', 'O', 47, 40], ['b.O2', 'O', 57, 32]].map(([id, el, x, y]) => A(id, el, x, y));
  const products = [M('CO2', 80, 25, ['m.C', 'a.O1', 'b.O1']), M('H2O', 60, 12, ['a.O2', 'm.H1', 'm.H2']), M('H2O', 60, 38, ['b.O2', 'm.H3', 'm.H4'])];
  return [
    F('Methane (CH₄) meets oxygen (O₂). Count the atoms going in: 1 C, 4 H, 4 O.', [M('CH4', 20, 25, mI), M('O2', 47, 14, aI), M('O2', 47, 36, bI), T('p', 34, 25, '+', { size: 4, color: '--muted' }), cnt('in: 1 C · 4 H · 4 O')]),
    F('A spark gives the energy to <b>break bonds</b>. The atoms come apart, but none of them is destroyed.', [loose, cnt('in: 1 C · 4 H · 4 O')], { hold: 2000 }),
    F('<b>New bonds form</b>, making carbon dioxide and water. Follow any atom: it is still there, just with new partners.', [products, cnt('out: 1 C · 4 H · 4 O')]),
    F('Same atoms in, same atoms out. That conservation of mass is why every equation must balance: CH₄ + 2 O₂ → CO₂ + 2 H₂O.', [products, Ar('arr', 36, 25, 48, 25, { color: '--muted' }), T('eq', 50, 47, 'CH₄ + 2 O₂ → CO₂ + 2 H₂O', { size: 3.2 }), T('in', 22, 25, '1 C · 4 H · 4 O', { size: 2.5, mono: true, weight: 400, color: '--muted' })]),
  ];
}

/* Mount a lab's "Watch it" section. Returns a cleanup function, or null when the lab has none. */
function mountStory(section, labId) {
  const st = STORIES[labId];
  if (!st || !section) { if (section) section.hidden = true; return null; }
  section.querySelector('h2 .story-title').textContent = st.title;
  const body = section.querySelector('.story-body');
  try { return st.live ? st.live(body) : Storyboard(body, st.frames()); } catch (err) { console.error(err); section.hidden = true; return null; }
}
