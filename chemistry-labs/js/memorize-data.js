'use strict';
/* What to memorize, chapter by chapter. Each set belongs to a lab (by id).
   g(name, cue, items, opts): items are [prompt, answer, note?, alt?].
   An answer can be a string (HTML allowed) or FX('SO4^2-') for a formula (case-sensitive, charge typed either way).
   opts: both (also drill answer → prompt, asked with rcue), cs (forward answers are case-sensitive), self (always self-graded). */

const MEM = {};
const FX = raw => {
  const m = raw.match(/^(.*?)(?:\^(\d*)([+-])|([+-]))$/), alt = [];
  if (m) {
    const b = m[1], n = m[2] || '', s = m[3] || m[4];
    alt.push(b + n + s, b + s + n);
    if (!n || n === '1') alt.push(b + s, b + '1' + s, b + s + '1');
  }
  return { h: fmtF(raw), alt, f: true };
};
const g = (name, cue, items, o = {}) => ({ name, cue, items, ...o });
const memSet = (labId, groups) => { MEM[labId] = groups; };
const nuc = (a, z, s) => `<span class="nuc"><span>${a}</span><span>${z}</span></span>${s}`;

/* ---------------- Ch 2 ---------------- */
memSet('measurement', [
  g('Metric prefixes', 'What power of ten?', [
    ['giga- (G)', '10⁹', '1 Gm = 10⁹ m', ['1000000000']],
    ['mega- (M)', '10⁶', '1 Mm = 10⁶ m', ['1000000']],
    ['kilo- (k)', '10³', '1 km = 1000 m', ['1000']],
    ['deci- (d)', '10⁻¹', '1 dm = 0.1 m', ['0.1']],
    ['centi- (c)', '10⁻²', '1 cm = 0.01 m, so 100 cm = 1 m', ['0.01']],
    ['milli- (m)', '10⁻³', '1 mL = 0.001 L, so 1000 mL = 1 L', ['0.001']],
    ['micro- (µ)', '10⁻⁶', 'The symbol is the Greek letter mu', ['0.000001']],
    ['nano- (n)', '10⁻⁹', 'Wavelengths of visible light are measured in nm'],
    ['pico- (p)', '10⁻¹²', 'Atom sizes are often given in pm'],
  ]),
  g('Prefix symbols', 'Symbol?', [
    ['giga-', 'G'], ['mega-', 'M', 'Capital M is mega; lowercase m is milli'], ['kilo-', 'k', 'Lowercase k'], ['deci-', 'd'], ['centi-', 'c'], ['milli-', 'm'], ['micro-', 'µ', 'You can type u or mc', ['u', 'mc']], ['nano-', 'n'], ['pico-', 'p'],
  ], { cs: true }),
  g('Conversion factors', 'Fill in the value', [
    ['1 in = ? cm', '2.54 cm', 'Exact, by definition. It never limits sig figs.'],
    ['1 kg = ? lb', '2.205 lb'],
    ['1 lb = ? g', '453.59 g', 'Rounded: 453.6 g', ['453.6']],
    ['1 mi = ? km', '1.609 km'],
    ['1 m = ? in', '39.37 in'],
    ['1 L = ? qt', '1.057 qt'],
    ['1 gal = ? L', '3.785 L'],
    ['1 mL = ? cm³', '1 cm³', 'Exact. A cubic centimeter (cc) is a milliliter.', ['1cc', '1']],
    ['1 L = ? mL', '1000 mL'],
  ]),
  g('SI units and density', 'Answer', [
    ['SI base unit of mass', 'kilogram (kg)', 'Not the gram: the kilogram is the SI base unit'],
    ['SI base unit of length', 'meter (m)'],
    ['SI base unit of time', 'second (s)'],
    ['SI base unit of temperature', 'kelvin (K)'],
    ['Density formula', 'd = m/V', 'Mass divided by volume', ['m/v', 'density=mass/volume']],
    ['Density of water', '1.00 g/mL', 'Also 1.00 g/cm³. Objects denser than 1.00 g/mL sink in water.', ['1', '1.0', '1g/cm3', '1.00g/cm3']],
  ]),
  g('Significant figure rules', 'Do they count?', [
    ['Nonzero digits', 'Always significant'],
    ['Zeros between nonzero digits (1<b>0</b>5)', 'Always significant', '"Sandwiched" zeros'],
    ['Leading zeros (<b>0.00</b>45)', 'Never significant', 'They only locate the decimal point'],
    ['Trailing zeros after a decimal point (2.5<b>0</b>)', 'Significant'],
    ['Trailing zeros with no decimal point (25<b>0</b>)', 'Not significant (ambiguous)', 'Write 2.50 × 10² to show 3 sig figs'],
    ['Exact numbers (12 eggs, 1 in = 2.54 cm)', 'Unlimited sig figs'],
    ['Rule for × and ÷', 'Keep the fewest sig figs'],
    ['Rule for + and −', 'Keep the fewest decimal places'],
  ], { self: true }),
]);

/* ---------------- Ch 3 ---------------- */
memSet('matter-energy', [
  g('Energy and temperature', 'Fill in the value', [
    ['1 cal = ? J', '4.184 J', 'Exact, by definition'],
    ['1 Cal (food Calorie) = ? cal', '1000 cal', 'A capital-C Calorie is a kilocalorie', ['1kcal']],
    ['1 kWh = ? J', '3.60 × 10⁶ J', '', ['3.6e6']],
    ['SI unit of energy', 'joule (J)'],
    ['Specific heat of water', '4.184 J/(g·°C)', 'High compared with metals, which is why water heats slowly', ['4.184', '4.18', '4.184j/g°c', '4.184j/gc']],
    ['Heat equation', 'q = m · c · ΔT', 'heat = mass × specific heat × temperature change'],
    ['°C to K', 'K = °C + 273.15', '', ['k=c+273', 'k=c+273.15']],
    ['°C to °F', '°F = 1.8(°C) + 32', '', ['f=1.8c+32']],
    ['°F to °C', '°C = (°F − 32) / 1.8', '', ['c=f-32/1.8']],
  ]),
  g('Classifying matter', 'Name it', [
    ['Pure substance made of one kind of atom', 'element'],
    ['Pure substance of two or more elements in a fixed ratio', 'compound'],
    ['Mixture with the same composition throughout', 'homogeneous mixture (solution)'],
    ['Mixture with visibly different parts', 'heterogeneous mixture'],
    ['Definite shape and definite volume', 'solid'],
    ['Definite volume, takes the shape of its container', 'liquid'],
    ['No definite shape or volume', 'gas'],
    ['Change that makes a new substance (burning, rusting)', 'chemical change'],
    ['Change in state or form only (melting, cutting)', 'physical change'],
  ]),
  g('Energy and laws', 'Name it', [
    ['Energy of motion', 'kinetic energy'],
    ['Stored energy, from position or composition', 'potential energy'],
    ['Process that releases heat to the surroundings', 'exothermic'],
    ['Process that absorbs heat from the surroundings', 'endothermic'],
    ['Matter is neither created nor destroyed in a reaction', 'law of conservation of mass'],
    ['Energy is neither created nor destroyed', 'law of conservation of energy'],
  ]),
]);

/* ---------------- Ch 4 ---------------- */
const SYMBOLS = [['Hydrogen', 'H'], ['Helium', 'He'], ['Lithium', 'Li'], ['Beryllium', 'Be'], ['Boron', 'B'], ['Carbon', 'C'], ['Nitrogen', 'N'], ['Oxygen', 'O'], ['Fluorine', 'F'], ['Neon', 'Ne'],
  ['Sodium', 'Na', 'From Latin natrium'], ['Magnesium', 'Mg'], ['Aluminum', 'Al'], ['Silicon', 'Si'], ['Phosphorus', 'P'], ['Sulfur', 'S'], ['Chlorine', 'Cl'], ['Argon', 'Ar'], ['Potassium', 'K', 'From Latin kalium'], ['Calcium', 'Ca'],
  ['Chromium', 'Cr'], ['Manganese', 'Mn'], ['Iron', 'Fe', 'From Latin ferrum'], ['Cobalt', 'Co', 'Co is cobalt; CO is carbon monoxide'], ['Nickel', 'Ni'], ['Copper', 'Cu', 'From Latin cuprum'], ['Zinc', 'Zn'], ['Arsenic', 'As'], ['Selenium', 'Se'], ['Bromine', 'Br'], ['Krypton', 'Kr'],
  ['Strontium', 'Sr'], ['Silver', 'Ag', 'From Latin argentum'], ['Tin', 'Sn', 'From Latin stannum'], ['Antimony', 'Sb', 'From Latin stibium'], ['Iodine', 'I'], ['Xenon', 'Xe'], ['Barium', 'Ba'], ['Tungsten', 'W', 'From German wolfram'],
  ['Platinum', 'Pt'], ['Gold', 'Au', 'From Latin aurum'], ['Mercury', 'Hg', 'From Latin hydrargyrum'], ['Lead', 'Pb', 'From Latin plumbum'], ['Radon', 'Rn'], ['Uranium', 'U']];
memSet('atoms', [
  g('Subatomic particles', 'Answer', [
    ['Charge of a proton', '1+', '', ['+1', '+']],
    ['Charge of an electron', '1−', '', ['-1', '-']],
    ['Charge of a neutron', '0 (neutral)'],
    ['Mass of a proton or neutron', '≈ 1 amu', 'An electron is about 1/1836 of that', ['1']],
    ['Where the protons and neutrons are', 'nucleus'],
    ['The atomic number (Z) counts', 'protons'],
    ['Mass number (A) =', 'protons + neutrons', '', ['p+n']],
    ['Number of neutrons =', 'A − Z', 'mass number minus atomic number', ['a-z']],
    ['Atoms of one element with different numbers of neutrons', 'isotopes'],
    ['Positive ion (lost electrons)', 'cation'],
    ['Negative ion (gained electrons)', 'anion'],
  ]),
  g('The periodic table', 'Name it', [
    ['Group 1A (1)', 'alkali metals'],
    ['Group 2A (2)', 'alkaline earth metals'],
    ['Group 7A (17)', 'halogens'],
    ['Group 8A (18)', 'noble gases'],
    ['Groups 3–12 (B groups)', 'transition metals'],
    ['Elements along the staircase line', 'metalloids'],
    ['Horizontal rows', 'periods'],
    ['Vertical columns', 'groups (families)'],
  ]),
  g('Elements to know by heart', 'List them', [
    ['The seven diatomic elements', 'H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂', 'Mnemonic: "Have No Fear Of Ice Cold Beer"'],
    ['The six common metalloids', 'B, Si, Ge, As, Sb, Te'],
    ['The two elements that are liquid at room temperature', 'mercury (Hg) and bromine (Br)'],
  ], { self: true }),
  g('Element symbols', 'Symbol?', SYMBOLS, { both: true, rcue: 'Element name?', cs: true }),
]);

/* ---------------- Ch 5 ---------------- */
memSet('compounds', [
  g('Charges by group', 'Ion charge?', [
    ['Group 1A metals (Li, Na, K)', '1+', '', ['+1', '+']],
    ['Group 2A metals (Mg, Ca, Ba)', '2+', '', ['+2']],
    ['Aluminum', '3+', '', ['+3']],
    ['Group 5A nonmetals (N, P)', '3−', '', ['-3']],
    ['Group 6A nonmetals (O, S)', '2−', '', ['-2']],
    ['Group 7A halogens (F, Cl, Br, I)', '1−', '', ['-1', '-']],
    ['Zinc (always)', '2+', 'Zn²⁺: no Roman numeral needed', ['+2']],
    ['Silver (always)', '1+', 'Ag⁺: no Roman numeral needed', ['+1', '+']],
  ]),
  g('Metals with more than one charge', 'Formula?', [
    ['iron(II)', FX('Fe^2+')], ['iron(III)', FX('Fe^3+')], ['copper(I)', FX('Cu+')], ['copper(II)', FX('Cu^2+')], ['tin(II)', FX('Sn^2+')], ['tin(IV)', FX('Sn^4+')],
    ['lead(II)', FX('Pb^2+')], ['lead(IV)', FX('Pb^4+')], ['chromium(III)', FX('Cr^3+')], ['cobalt(II)', FX('Co^2+')], ['mercury(I)', FX('Hg2^2+'), 'A two-atom ion: Hg₂²⁺, not Hg⁺'], ['mercury(II)', FX('Hg^2+')],
  ], { both: true, rcue: 'Name?' }),
  g('Monatomic anions', 'Formula?', [
    ['fluoride', FX('F-')], ['chloride', FX('Cl-')], ['bromide', FX('Br-')], ['iodide', FX('I-')], ['oxide', FX('O^2-')], ['sulfide', FX('S^2-')], ['nitride', FX('N^3-')], ['phosphide', FX('P^3-')], ['hydride', FX('H-')],
  ], { both: true, rcue: 'Name?' }),
  g('Polyatomic ions', 'Formula with charge?', [
    ['ammonium', FX('NH4+'), 'The only common positive polyatomic ion (with hydronium)'],
    ['hydroxide', FX('OH-')],
    ['nitrate', FX('NO3-'), '-ate has one more O than -ite: nitrate NO₃⁻, nitrite NO₂⁻'],
    ['nitrite', FX('NO2-')],
    ['sulfate', FX('SO4^2-')],
    ['sulfite', FX('SO3^2-')],
    ['hydrogen sulfate (bisulfate)', FX('HSO4-'), 'Adding H⁺ raises the charge by one'],
    ['phosphate', FX('PO4^3-')],
    ['hydrogen phosphate', FX('HPO4^2-')],
    ['dihydrogen phosphate', FX('H2PO4-')],
    ['carbonate', FX('CO3^2-')],
    ['hydrogen carbonate (bicarbonate)', FX('HCO3-')],
    ['hypochlorite', FX('ClO-'), 'hypo-ite, -ite, -ate, per-ate: ClO⁻, ClO₂⁻, ClO₃⁻, ClO₄⁻'],
    ['chlorite', FX('ClO2-')],
    ['chlorate', FX('ClO3-')],
    ['perchlorate', FX('ClO4-')],
    ['permanganate', FX('MnO4-')],
    ['chromate', FX('CrO4^2-')],
    ['dichromate', FX('Cr2O7^2-')],
    ['cyanide', FX('CN-')],
    ['acetate', FX('C2H3O2-'), 'Also written CH₃COO⁻'],
    ['peroxide', FX('O2^2-')],
    ['hydronium', FX('H3O+')],
  ], { both: true, rcue: 'Name?' }),
  g('Greek prefixes', 'What number?', [
    ['mono-', '1'], ['di-', '2'], ['tri-', '3'], ['tetra-', '4'], ['penta-', '5'], ['hexa-', '6'], ['hepta-', '7'], ['octa-', '8'], ['nona-', '9'], ['deca-', '10'],
  ], { both: true, rcue: 'Prefix?' }),
  g('Naming rules', 'What is the rule?', [
    ['Acid from an <b>-ate</b> ion (sulfate)', '-ic acid (sulfuric acid)'],
    ['Acid from an <b>-ite</b> ion (sulfite)', '-ous acid (sulfurous acid)'],
    ['Binary acid (HCl in water)', 'hydro- + root + -ic acid (hydrochloric acid)'],
    ['Ionic compound with a metal that has more than one charge', 'Show the charge with a Roman numeral: iron(III) chloride'],
    ['Molecular compound (two nonmetals)', 'Greek prefixes for each count; drop mono- on the first element: dinitrogen tetroxide, carbon monoxide'],
    ['Hydrate CuSO₄·5H₂O', 'copper(II) sulfate pentahydrate'],
  ], { self: true }),
  g('Common names', 'Formula?', [
    ['water', FX('H2O')], ['ammonia', FX('NH3')], ['methane', FX('CH4')], ['hydrogen peroxide', FX('H2O2')],
  ], { both: true, rcue: 'Name?' }),
]);

/* ---------------- Ch 6 ---------------- */
memSet('composition', [
  g('The mole', 'Answer', [
    ['Avogadro\'s number', '6.022 × 10²³', 'Particles in one mole', ['6.022e23', '6.02e23']],
    ['Units of molar mass', 'g/mol'],
    ['Grams → moles', '÷ molar mass', '', ['/molarmass', 'dividebymolarmass']],
    ['Moles → grams', '× molar mass', '', ['xmolarmass', 'multiplybymolarmass']],
    ['Moles → particles', '× 6.022 × 10²³', '', ['x6.022e23']],
    ['Particles → moles', '÷ 6.022 × 10²³', '', ['/6.022e23']],
  ]),
  g('Molar masses worth knowing', 'Molar mass?', [
    ['H', '1.008 g/mol'], ['C', '12.01 g/mol'], ['N', '14.01 g/mol'], ['O', '16.00 g/mol', '', ['16']], ['H₂O', '18.02 g/mol'], ['CO₂', '44.01 g/mol'],
  ]),
  g('Composition', 'What is it?', [
    ['Mass percent of an element', '(mass of element ÷ mass of compound) × 100%'],
    ['Empirical formula', 'The simplest whole-number ratio of atoms (CH₂O for glucose)'],
    ['Molecular formula from empirical', 'Multiply the subscripts by n = molar mass ÷ empirical formula mass'],
    ['Steps from percent composition to empirical formula', 'Percent to mass (assume 100 g), mass to moles, divide by the smallest, multiply until whole'],
  ], { self: true }),
]);

/* ---------------- Ch 7 ---------------- */
memSet('reactions', [
  g('Solubility rules', 'Soluble or insoluble?', [
    ['Compounds of Li⁺, Na⁺, K⁺, NH₄⁺', 'Soluble, no exceptions'],
    ['Nitrates (NO₃⁻) and acetates (C₂H₃O₂⁻)', 'Soluble, no exceptions'],
    ['Chlorides, bromides, iodides', 'Soluble, except with Ag⁺, Hg₂²⁺, Pb²⁺'],
    ['Sulfates (SO₄²⁻)', 'Soluble, except with Sr²⁺, Ba²⁺, Pb²⁺, Ag⁺, Ca²⁺'],
    ['Hydroxides (OH⁻) and sulfides (S²⁻)', 'Insoluble, except with Li⁺, Na⁺, K⁺, NH₄⁺ (Ca²⁺, Sr²⁺, Ba²⁺: sulfides soluble, hydroxides slightly)'],
    ['Carbonates (CO₃²⁻) and phosphates (PO₄³⁻)', 'Insoluble, except with Li⁺, Na⁺, K⁺, NH₄⁺'],
  ], { self: true }),
  g('Reaction types', 'Which type?', [
    ['A + B → AB', 'synthesis (combination)'],
    ['AB → A + B', 'decomposition'],
    ['A + BC → AC + B', 'single displacement'],
    ['AB + CD → AD + CB', 'double displacement'],
    ['Fuel + O₂ → CO₂ + H₂O', 'combustion'],
    ['Acid + base → salt + water', 'neutralization (acid–base)'],
    ['Two aqueous solutions make a solid', 'precipitation'],
  ]),
  g('Reaction facts', 'Answer', [
    ['H₂CO₃ (carbonic acid) breaks down into', 'H₂O + CO₂', '', ['h2o+co2', 'co2+h2o']],
    ['Gas made by an acid and a carbonate', 'CO₂', '', ['co2']],
    ['Gas made by an acid and a sulfide', 'H₂S', '', ['h2s']],
    ['Ions that appear unchanged on both sides', 'spectator ions'],
    ['Four signs of a chemical reaction', 'color change, gas forms, solid (precipitate) forms, heat or light given off'],
  ]),
]);

/* ---------------- Ch 8 ---------------- */
memSet('stoichiometry', [
  g('Stoichiometry', 'Answer', [
    ['Where mole ratios come from', 'the coefficients of the balanced equation'],
    ['Path from grams of A to grams of B', 'g A → mol A → mol B → g B (÷ molar mass, × mole ratio, × molar mass)'],
    ['Limiting reactant', 'The reactant that runs out first; it sets how much product forms'],
    ['Excess reactant', 'The reactant left over when the reaction stops'],
    ['Theoretical yield', 'The most product possible, calculated from the limiting reactant'],
    ['Percent yield', '(actual yield ÷ theoretical yield) × 100%'],
    ['Sign of ΔH for an exothermic reaction', 'negative', '', ['-', 'negative(-)']],
  ], { self: true }),
]);

/* ---------------- Ch 9 ---------------- */
memSet('electrons', [
  g('Light', 'Answer', [
    ['Speed of light, c', '3.00 × 10⁸ m/s', '', ['3e8', '3.00e8', '3.0e8']],
    ['Planck\'s constant, h', '6.626 × 10⁻³⁴ J·s', '', ['6.626e-34', '6.63e-34']],
    ['Wavelength and frequency', 'c = λν', 'λ is lambda (wavelength), ν is nu (frequency)'],
    ['Energy of a photon', 'E = hν', 'Also E = hc/λ', ['e=hv', 'e=hnu', 'e=hf']],
    ['Longer wavelength means ___ energy', 'lower', 'Long waves: low frequency, low energy'],
    ['Visible light range', '≈ 400 (violet) to 750 nm (red)'],
    ['EM spectrum from low to high energy', 'radio, microwave, infrared, visible, ultraviolet, X-ray, gamma ray', 'Mnemonic: "Raging Martians Invaded Venus Using X-ray Guns"'],
  ]),
  g('Orbitals', 'Answer', [
    ['Max electrons in an s subshell', '2'], ['Max electrons in a p subshell', '6'], ['Max electrons in a d subshell', '10'], ['Max electrons in an f subshell', '14'],
    ['Orbitals in s, p, d, f', '1, 3, 5, 7'],
    ['Max electrons in shell n', '2n²'],
    ['Filling order', '1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p', 'Follow the diagonal arrows, or read the periodic table left to right'],
    ['Pauli exclusion principle', 'An orbital holds at most two electrons, with opposite spins'],
    ['Hund\'s rule', 'Put one electron in each equal-energy orbital before pairing'],
    ['Aufbau principle', 'Fill the lowest-energy orbitals first'],
    ['Valence electrons of a main-group element', 'its group number (A)'],
  ]),
  g('Periodic trends', 'Which way?', [
    ['Atomic radius increases', 'down a group and to the left'],
    ['Ionization energy increases', 'up a group and to the right'],
    ['Electronegativity increases', 'up a group and to the right (F is highest)'],
    ['Metallic character increases', 'down a group and to the left'],
    ['A cation compared with its atom is', 'smaller'],
    ['An anion compared with its atom is', 'larger'],
  ]),
]);

/* ---------------- Ch 10 ---------------- */
memSet('bonding', [
  g('VSEPR shapes', 'Molecular shape?', [
    ['2 electron groups, 0 lone pairs', 'linear', '180°, e.g. CO₂'],
    ['3 electron groups, 0 lone pairs', 'trigonal planar', '120°, e.g. BF₃'],
    ['3 electron groups, 1 lone pair', 'bent (<120°)', 'e.g. SO₂'],
    ['4 electron groups, 0 lone pairs', 'tetrahedral', '109.5°, e.g. CH₄'],
    ['4 electron groups, 1 lone pair', 'trigonal pyramidal', '≈107°, e.g. NH₃'],
    ['4 electron groups, 2 lone pairs', 'bent (≈104.5°)', 'e.g. H₂O'],
  ]),
  g('Bond angles', 'Bond angle?', [
    ['linear', '180°'], ['trigonal planar', '120°'], ['tetrahedral', '109.5°'], ['trigonal pyramidal', '≈107°'], ['bent (water)', '≈104.5°'],
  ]),
  g('Bond type from ΔEN', 'Bond type?', [
    ['ΔEN 0 to 0.4', 'pure (nonpolar) covalent'],
    ['ΔEN 0.4 to 2.0', 'polar covalent'],
    ['ΔEN 2.0 or more', 'ionic'],
  ]),
  g('Bonding facts', 'Answer', [
    ['Most electronegative element', 'fluorine (F)', 'EN = 4.0'],
    ['Electrons in a single, double, triple bond', '2, 4, 6'],
    ['Hydrogen wants how many electrons (duet)', '2'],
    ['Most atoms want how many electrons (octet)', '8'],
    ['A molecule is polar when', 'it has polar bonds and an asymmetric shape (dipoles do not cancel)'],
  ]),
]);

/* ---------------- Ch 11 ---------------- */
memSet('gases', [
  g('Gas constants', 'Answer', [
    ['STP', '0 °C (273 K) and 1 atm', '', ['0c1atm', '273k1atm']],
    ['Molar volume of a gas at STP', '22.4 L/mol', '', ['22.4', '22.4l']],
    ['Gas constant R (L·atm)', '0.08206 L·atm/(mol·K)', '', ['0.08206', '0.0821']],
    ['Temperature unit for every gas law', 'kelvin'],
  ]),
  g('Pressure units', '1 atm = ?', [
    ['1 atm in mmHg', '760 mmHg'], ['1 atm in torr', '760 torr'], ['1 atm in kPa', '101.325 kPa', '', ['101.3']], ['1 atm in psi', '14.7 psi'], ['1 atm in inHg', '29.92 inHg'],
  ]),
  g('Gas laws', 'Write the equation', [
    ['Boyle\'s law (constant T, n)', 'P₁V₁ = P₂V₂', 'Pressure and volume are inversely proportional'],
    ['Charles\'s law (constant P, n)', 'V₁/T₁ = V₂/T₂'],
    ['Gay-Lussac\'s law (constant V, n)', 'P₁/T₁ = P₂/T₂'],
    ['Avogadro\'s law (constant P, T)', 'V₁/n₁ = V₂/n₂'],
    ['Combined gas law', 'P₁V₁/T₁ = P₂V₂/T₂'],
    ['Ideal gas law', 'PV = nRT'],
    ['Dalton\'s law of partial pressures', 'P(total) = P(A) + P(B) + …', '', ['pt=pa+pb', 'ptotal=pa+pb']],
  ]),
  g('Kinetic molecular theory', 'Answer', [
    ['Average kinetic energy of gas particles is proportional to', 'kelvin temperature'],
    ['Collecting a gas over water: P(gas) =', 'P(total) − P(water vapor)'],
  ], { self: true }),
]);

/* ---------------- Ch 12 ---------------- */
memSet('liquids-solids', [
  g('Intermolecular forces', 'Answer', [
    ['IMFs from weakest to strongest', 'dispersion < dipole–dipole < hydrogen bonding < ion–dipole'],
    ['The IMF present in every molecule', 'dispersion (London) forces'],
    ['Hydrogen bonding requires', 'H bonded directly to N, O, or F'],
    ['Stronger IMFs mean a ___ boiling point', 'higher'],
    ['Stronger IMFs mean a ___ vapor pressure', 'lower'],
  ]),
  g('Phase changes', 'Name it', [
    ['solid → liquid', 'melting (fusion)'], ['liquid → solid', 'freezing'], ['liquid → gas', 'vaporization (boiling)'], ['gas → liquid', 'condensation'], ['solid → gas', 'sublimation'], ['gas → solid', 'deposition'],
  ], { both: true, rcue: 'Which change?' }),
  g('Phase change facts', 'Answer', [
    ['Heat of fusion of water', '6.02 kJ/mol', '', ['6.02']],
    ['Heat of vaporization of water (100 °C)', '40.7 kJ/mol', '', ['40.7']],
    ['Temperature during a phase change', 'stays constant', 'The heat breaks IMFs instead of raising temperature'],
    ['A liquid boils when', 'its vapor pressure equals the external pressure'],
    ['Water\'s unusual property', 'its solid (ice) is less dense than the liquid'],
  ]),
  g('Types of solids', 'Which type?', [
    ['NaCl', 'ionic solid'], ['Ice, dry ice, sugar', 'molecular solid'], ['Diamond, quartz (SiO₂)', 'network covalent solid'], ['Copper, iron', 'metallic solid'],
  ]),
]);

/* ---------------- Ch 13 ---------------- */
memSet('solutions', [
  g('Concentration', 'Formula?', [
    ['Molarity (M)', 'mol solute / L solution', '', ['mol/l']],
    ['Molality (m)', 'mol solute / kg solvent', '', ['mol/kg']],
    ['Mass percent', '(mass solute ÷ mass solution) × 100%'],
    ['Dilution', 'M₁V₁ = M₂V₂'],
  ]),
  g('Colligative properties', 'Answer', [
    ['Freezing point depression', 'ΔT<sub>f</sub> = m × K<sub>f</sub>', '', ['dtf=mkf']],
    ['Boiling point elevation', 'ΔT<sub>b</sub> = m × K<sub>b</sub>', '', ['dtb=mkb']],
    ['K<sub>f</sub> of water', '1.86 °C/m', '', ['1.86']],
    ['K<sub>b</sub> of water', '0.512 °C/m', '', ['0.512']],
    ['Colligative properties depend on', 'the number of solute particles, not their identity'],
  ]),
  g('Solubility', 'Answer', [
    ['"Like dissolves like" means', 'polar dissolves polar; nonpolar dissolves nonpolar'],
    ['Solubility of most solids as temperature rises', 'increases'],
    ['Solubility of a gas as temperature rises', 'decreases', 'Warm soda goes flat faster'],
    ['Solubility of a gas as its pressure rises', 'increases', 'Henry\'s law'],
    ['Holds more solute than it normally can', 'supersaturated'],
    ['Holds the maximum amount of solute', 'saturated'],
  ]),
]);

/* ---------------- Ch 14 ---------------- */
memSet('acids-bases', [
  g('Strong acids', 'Formula?', [
    ['hydrochloric acid', FX('HCl')], ['hydrobromic acid', FX('HBr')], ['hydroiodic acid', FX('HI')], ['nitric acid', FX('HNO3')], ['sulfuric acid', FX('H2SO4')], ['perchloric acid', FX('HClO4')],
  ], { both: true, rcue: 'Name?' }),
  g('Weak acids and bases', 'Formula?', [
    ['hydrofluoric acid', FX('HF'), 'HF is weak, even though HCl, HBr and HI are strong'], ['acetic acid', FX('HC2H3O2')], ['carbonic acid', FX('H2CO3')], ['phosphoric acid', FX('H3PO4')], ['nitrous acid', FX('HNO2')], ['ammonia (a weak base)', FX('NH3')],
  ], { both: true, rcue: 'Name?' }),
  g('Definitions', 'Answer', [
    ['The six strong acids', 'HCl, HBr, HI, HNO₃, H₂SO₄, HClO₄'],
    ['The strong bases', 'Group 1 hydroxides (LiOH, NaOH, KOH…) and Ca(OH)₂, Sr(OH)₂, Ba(OH)₂'],
    ['Arrhenius acid', 'Produces H⁺ (H₃O⁺) in water'],
    ['Arrhenius base', 'Produces OH⁻ in water'],
    ['Brønsted–Lowry acid', 'proton (H⁺) donor'],
    ['Brønsted–Lowry base', 'proton (H⁺) acceptor'],
    ['Conjugate base of an acid', 'The acid minus one H⁺'],
    ['Buffer', 'A weak acid with its conjugate base; resists pH change'],
  ], { self: true }),
  g('pH', 'Answer', [
    ['pH =', '−log[H₃O⁺]', '', ['-logh3o+', '-logh+']],
    ['pOH =', '−log[OH⁻]', '', ['-logoh-']],
    ['pH + pOH =', '14.00', 'At 25 °C', ['14']],
    ['K<sub>w</sub>', '1.0 × 10⁻¹⁴', '[H₃O⁺][OH⁻] at 25 °C', ['1e-14', '1.0e-14']],
    ['[H₃O⁺] from pH', '10<sup>−pH</sup>', '', ['10-ph']],
    ['pH of a neutral solution', '7'],
    ['Acids taste ___ and turn blue litmus ___', 'sour; red'],
    ['Bases taste ___ and feel ___', 'bitter; slippery'],
  ]),
  g('Acid reactions', 'Products?', [
    ['Acid + base', 'salt + water'],
    ['Acid + active metal', 'salt + H₂ gas'],
    ['Acid + carbonate', 'salt + water + CO₂'],
  ]),
]);

/* ---------------- Ch 15 ---------------- */
memSet('equilibrium', [
  g('Equilibrium constant', 'Answer', [
    ['K expression for aA + bB ⇌ cC + dD', '[C]<sup>c</sup>[D]<sup>d</sup> / [A]<sup>a</sup>[B]<sup>b</sup>', 'Products over reactants, each raised to its coefficient'],
    ['Left out of a K expression', 'pure solids and pure liquids'],
    ['K ≫ 1 means', 'products are favored'],
    ['K ≪ 1 means', 'reactants are favored'],
    ['Dynamic equilibrium', 'Forward rate equals reverse rate; concentrations stay constant'],
  ]),
  g('Q versus K', 'Which way does it shift?', [
    ['Q < K', 'right, toward products'],
    ['Q > K', 'left, toward reactants'],
    ['Q = K', 'no shift: at equilibrium'],
  ]),
  g('Le Châtelier\'s principle', 'Which way does it shift?', [
    ['Add a reactant', 'right, toward products'],
    ['Add a product', 'left, toward reactants'],
    ['Remove a product', 'right, toward products'],
    ['Increase pressure (decrease volume)', 'toward the side with fewer moles of gas'],
    ['Raise T, exothermic reaction', 'left (K decreases)'],
    ['Raise T, endothermic reaction', 'right (K increases)'],
    ['Add a catalyst', 'no shift (equilibrium is reached faster)'],
  ]),
  g('Rates', 'Answer', [
    ['Activation energy', 'The energy barrier reactants must get over to react'],
    ['What a catalyst does', 'Lowers the activation energy without being used up'],
    ['Four things that speed up a reaction', 'higher concentration, higher temperature, a catalyst, more surface area'],
  ], { self: true }),
]);

/* ---------------- Ch 16 ---------------- */
memSet('redox', [
  g('Oxidation and reduction', 'Answer', [
    ['Oxidation is', 'loss of electrons', '"OIL RIG": Oxidation Is Loss, Reduction Is Gain'],
    ['Reduction is', 'gain of electrons'],
    ['The oxidizing agent is', 'reduced (it gains electrons)'],
    ['The reducing agent is', 'oxidized (it loses electrons)'],
    ['Oxidation happens at the', 'anode', '"An Ox, Red Cat"'],
    ['Reduction happens at the', 'cathode'],
    ['Electrons in a battery flow from', 'anode to cathode'],
  ]),
  g('Oxidation number rules', 'Oxidation number?', [
    ['An element by itself (Fe, O₂)', '0'],
    ['A monatomic ion (Cl⁻, Fe³⁺)', 'its charge'],
    ['F in a compound', '−1', '', ['-1']],
    ['O in most compounds', '−2', 'Except in peroxides (H₂O₂), where it is −1', ['-2']],
    ['H with nonmetals', '+1', 'With metals (NaH) it is −1', ['1']],
    ['Group 1 metals in compounds', '+1', '', ['1']],
    ['Group 2 metals in compounds', '+2', '', ['2']],
    ['Sum of oxidation numbers in a neutral compound', '0'],
    ['Sum in a polyatomic ion', 'the ion\'s charge'],
  ]),
  g('Activity series', 'Answer', [
    ['Activity series, most to least active', 'Li K Ca Na Mg Al Mn Zn Cr Fe Ni Sn Pb H₂ Cu Ag Au'],
    ['A metal higher on the series will', 'reduce (displace) the ions of a metal below it'],
    ['Metals above H₂ in the series', 'dissolve in acid and release H₂ gas'],
  ], { self: true }),
]);

/* ---------------- Ch 17 ---------------- */
memSet('nuclear', [
  g('Radiation particles', 'Symbol?', [
    ['alpha particle (α)', nuc(4, 2, 'He')], ['beta particle (β)', nuc(0, '−1', 'e')], ['positron', nuc(0, '+1', 'e')], ['gamma ray (γ)', nuc(0, 0, 'γ')], ['neutron', nuc(1, 0, 'n')],
  ], { both: true, rcue: 'Which particle?', self: true }),
  g('What each decay does', 'Change in Z and A?', [
    ['alpha decay', 'A − 4, Z − 2'],
    ['beta decay', 'Z + 1, A unchanged', 'A neutron turns into a proton'],
    ['positron emission', 'Z − 1, A unchanged'],
    ['electron capture', 'Z − 1, A unchanged'],
    ['gamma emission', 'no change in Z or A'],
  ], { self: true }),
  g('Nuclear facts', 'Answer', [
    ['Most penetrating to least', 'gamma > beta > alpha', 'Alpha is stopped by paper; gamma needs lead'],
    ['Most ionizing to least', 'alpha > beta > gamma'],
    ['Fraction left after n half-lives', '(½)ⁿ', '', ['1/2^n', '0.5^n']],
    ['Half-life of carbon-14', '5730 years', '', ['5730']],
    ['Splitting a heavy nucleus', 'fission'],
    ['Joining light nuclei (powers the Sun)', 'fusion'],
    ['Conserved in a nuclear equation', 'mass number and atomic number (both sides add up)'],
  ]),
]);

/* ---------------- Ch 18 ---------------- */
memSet('organic', [
  g('Carbon-count prefixes', 'How many carbons?', [
    ['meth-', '1'], ['eth-', '2'], ['prop-', '3'], ['but-', '4'], ['pent-', '5'], ['hex-', '6'], ['hept-', '7'], ['oct-', '8'], ['non-', '9'], ['dec-', '10'],
  ], { both: true, rcue: 'Prefix?' }),
  g('Hydrocarbons', 'Answer', [
    ['Alkane general formula', 'C<sub>n</sub>H<sub>2n+2</sub>', 'Single bonds only (saturated)', ['cnh2n+2']],
    ['Alkene general formula', 'C<sub>n</sub>H<sub>2n</sub>', 'One C=C double bond', ['cnh2n']],
    ['Alkyne general formula', 'C<sub>n</sub>H<sub>2n−2</sub>', 'One C≡C triple bond', ['cnh2n-2']],
    ['Suffix for an alkane, alkene, alkyne', '-ane, -ene, -yne'],
    ['Formula of benzene', FX('C6H6')],
    ['Bonds a carbon atom always forms', '4'],
    ['Same formula, different structure', 'isomers'],
  ]),
  g('Functional groups', 'Which group?', [
    ['R–OH', 'alcohol', 'Name ends in -ol (ethanol)'],
    ['R–O–R', 'ether'],
    ['R–CHO (C=O at the end of the chain)', 'aldehyde', 'Name ends in -al (ethanal)'],
    ['R–CO–R (C=O inside the chain)', 'ketone', 'Name ends in -one (propanone)'],
    ['R–COOH', 'carboxylic acid', 'Name ends in -oic acid'],
    ['R–COO–R', 'ester', 'Name ends in -oate; fruity smells'],
    ['R–NH₂', 'amine'],
  ], { both: true, rcue: 'Structure?' }),
]);

/* ---------------- Ch 19 ---------------- */
memSet('biochem', [
  g('Building blocks', 'Monomer?', [
    ['carbohydrates (polysaccharides)', 'monosaccharides'],
    ['proteins', 'amino acids'],
    ['nucleic acids (DNA, RNA)', 'nucleotides'],
    ['fats (triglycerides)', 'glycerol + 3 fatty acids'],
  ], { both: true, rcue: 'Polymer or class?' }),
  g('DNA and RNA', 'Answer', [
    ['A pairs with ___ in DNA', 'T', '', ['t']],
    ['G pairs with', 'C', '', ['c']],
    ['A pairs with ___ in RNA', 'U', '', ['u']],
    ['Sugar in DNA', 'deoxyribose'],
    ['Sugar in RNA', 'ribose'],
    ['Three parts of a nucleotide', 'phosphate, sugar, base'],
    ['Start codon', 'AUG', 'Also codes for methionine'],
    ['Stop codons', 'UAA, UAG, UGA'],
    ['Number of bases in a codon', '3'],
    ['Number of common amino acids', '20'],
    ['DNA → mRNA', 'transcription'],
    ['mRNA → protein', 'translation'],
  ]),
  g('Biomolecule facts', 'Answer', [
    ['Bond that links amino acids', 'peptide bond'],
    ['Formula of glucose', FX('C6H12O6')],
    ['Sucrose is made of', 'glucose + fructose'],
    ['Protein primary structure', 'the sequence of amino acids'],
    ['Protein secondary structure', 'α-helix or β-sheet'],
    ['Saturated fats at room temperature', 'solid (no C=C bonds)'],
    ['Enzymes are', 'protein catalysts'],
  ]),
]);

/* ---------------- G1 ---------------- */
memSet('thermo', [
  g('Enthalpy', 'Answer', [
    ['ΔH < 0', 'exothermic'],
    ['ΔH > 0', 'endothermic'],
    ['Reverse a reaction: ΔH', 'changes sign'],
    ['Multiply a reaction by n: ΔH', 'is multiplied by n'],
    ['ΔH°f of an element in its standard state', '0'],
    ['ΔH°rxn from formation enthalpies', 'Σ n ΔH°f(products) − Σ n ΔH°f(reactants)'],
    ['ΔH from bond energies', 'Σ(bonds broken) − Σ(bonds formed)'],
    ['Standard state', '1 atm (or 1 bar), 1 M for solutions, usually 25 °C'],
  ]),
  g('Calorimetry and the first law', 'Answer', [
    ['Coffee-cup calorimeter: q<sub>rxn</sub> =', '−q<sub>solution</sub>', '', ['-qsolution', '-qsoln']],
    ['Coffee-cup calorimeter measures', 'ΔH (constant pressure)'],
    ['Bomb calorimeter measures', 'ΔE (constant volume)'],
    ['First law of thermodynamics', 'ΔE = q + w', '', ['de=q+w']],
    ['Work by an expanding gas', 'w = −PΔV'],
    ['State function', 'Depends only on the start and end states (ΔH, ΔE), not the path'],
  ]),
]);

/* ---------------- G2 ---------------- */
memSet('buffers', [
  g('Weak acid equations', 'Answer', [
    ['K<sub>a</sub> for HA ⇌ H⁺ + A⁻', '[H₃O⁺][A⁻] / [HA]'],
    ['pK<sub>a</sub> =', '−log K<sub>a</sub>', '', ['-logka']],
    ['K<sub>a</sub> × K<sub>b</sub> =', 'K<sub>w</sub> = 1.0 × 10⁻¹⁴', 'For a conjugate pair', ['kw', '1e-14']],
    ['pK<sub>a</sub> + pK<sub>b</sub> =', '14.00', '', ['14']],
    ['Henderson–Hasselbalch equation', 'pH = pK<sub>a</sub> + log([A⁻]/[HA])'],
    ['Percent ionization', '([H₃O⁺]<sub>eq</sub> ÷ [HA]<sub>0</sub>) × 100%'],
    ['The 5% rule', 'Ignore x in [HA]₀ − x if x is under 5% of [HA]₀'],
  ], { self: true }),
  g('Weak acid facts', 'Answer', [
    ['Larger K<sub>a</sub> (smaller pK<sub>a</sub>) means', 'a stronger acid'],
    ['K<sub>a</sub> of acetic acid', '1.8 × 10⁻⁵', '', ['1.8e-5']],
    ['K<sub>b</sub> of ammonia', '1.8 × 10⁻⁵', '', ['1.8e-5']],
    ['pH of a buffer when [A⁻] = [HA]', 'pH = pK<sub>a</sub>', '', ['pka']],
    ['A buffer works best within', 'pK<sub>a</sub> ± 1'],
    ['pH at the half-equivalence point', 'pH = pK<sub>a</sub>', '', ['pka']],
    ['pH at equivalence, weak acid + strong base', 'above 7', 'The conjugate base makes it basic', ['>7']],
  ]),
]);

/* ---------------- G3 ---------------- */
memSet('kinetics', [
  g('Integrated rate laws', 'Equation?', [
    ['Zero order', '[A] = −kt + [A]₀'],
    ['First order', 'ln[A] = −kt + ln[A]₀'],
    ['Second order', '1/[A] = kt + 1/[A]₀'],
  ], { self: true }),
  g('Straight-line plots', 'What gives a straight line?', [
    ['Zero order', '[A] vs. t'], ['First order', 'ln[A] vs. t'], ['Second order', '1/[A] vs. t'],
  ]),
  g('Half-lives', 'Half-life?', [
    ['Zero order', '[A]₀ / 2k'], ['First order', '0.693 / k', 'Independent of concentration', ['ln2/k']], ['Second order', '1 / (k[A]₀)'],
  ]),
  g('Units of k', 'Units?', [
    ['Zero order', 'M/s', '', ['m/s', 'ms-1']], ['First order', 's⁻¹', '', ['1/s']], ['Second order', 'M⁻¹s⁻¹', '', ['1/ms', 'm-1s-1']],
  ]),
  g('Rates and mechanisms', 'Answer', [
    ['Arrhenius equation', 'k = A e<sup>−Ea/RT</sup>'],
    ['Two-point Arrhenius', 'ln(k₂/k₁) = (E<sub>a</sub>/R)(1/T₁ − 1/T₂)'],
    ['R in the Arrhenius equation', '8.314 J/(mol·K)', '', ['8.314']],
    ['Rate law orders come from', 'experiment, not the coefficients (except for elementary steps)'],
    ['Rate-determining step', 'the slowest step of the mechanism'],
    ['A catalyst changes', 'the mechanism and lowers E<sub>a</sub>; not ΔH or K'],
  ], { self: true }),
]);

/* ---------------- G4 ---------------- */
memSet('gibbs', [
  g('Free energy', 'Answer', [
    ['Gibbs free energy equation', 'ΔG = ΔH − TΔS'],
    ['ΔG < 0', 'spontaneous'],
    ['ΔG = 0', 'at equilibrium'],
    ['ΔG° and K', 'ΔG° = −RT ln K'],
    ['K > 1 means ΔG° is', 'negative'],
    ['Crossover temperature', 'T = ΔH / ΔS', 'Convert ΔS to kJ/K first'],
    ['ΔG°f of an element in its standard state', '0'],
  ]),
  g('Spontaneity by sign', 'When is it spontaneous?', [
    ['ΔH −, ΔS +', 'at all temperatures'],
    ['ΔH +, ΔS −', 'never'],
    ['ΔH −, ΔS −', 'at low temperatures'],
    ['ΔH +, ΔS +', 'at high temperatures'],
  ]),
  g('Entropy', 'Answer', [
    ['Entropy order of states', 'solid < liquid < gas'],
    ['More moles of gas in the products: ΔS is', 'positive'],
    ['Second law of thermodynamics', 'ΔS<sub>universe</sub> > 0 for a spontaneous process'],
    ['Third law of thermodynamics', 'A perfect crystal at 0 K has S = 0'],
    ['Units of S°', 'J/(mol·K)', 'ΔH is in kJ: watch the units', ['j/molk']],
  ]),
]);

/* ---------------- G5 ---------------- */
memSet('electrochem', [
  g('Cell equations', 'Answer', [
    ['Standard cell potential', 'E°cell = E°cathode − E°anode', '', ['ecell=ecathode-eanode']],
    ['ΔG° from E°', 'ΔG° = −nFE°', '', ['dg=-nfe', 'g=-nfe']],
    ['Faraday constant F', '96,485 C/mol e⁻', '', ['96485', '96500']],
    ['Nernst equation at 25 °C', 'E = E° − (0.0592/n) log Q'],
    ['E° and K at 25 °C', 'E° = (0.0592/n) log K'],
    ['Charge from current and time', 'Q = I × t (coulombs = amps × seconds)'],
  ], { self: true }),
  g('Cell facts', 'Answer', [
    ['E°cell > 0 means', 'spontaneous (galvanic)'],
    ['Sign of the anode in a galvanic cell', 'negative (−)'],
    ['Sign of the anode in an electrolytic cell', 'positive (+)'],
    ['Electrons flow through the wire from', 'anode to cathode'],
    ['Anions in the salt bridge move toward the', 'anode'],
    ['Potential of the standard hydrogen electrode', '0.00 V', '', ['0', '0v']],
    ['More positive E°red means', 'a stronger oxidizing agent (more easily reduced)'],
    ['Multiplying a half-reaction by 2: E°', 'does not change', 'Potential is intensive'],
  ]),
]);

/* ---------------- G6 ---------------- */
memSet('quantum', [
  g('Quantum numbers', 'Allowed values?', [
    ['n (principal: size and energy)', '1, 2, 3, …'],
    ['l (angular momentum: shape)', '0 to n − 1'],
    ['m<sub>l</sub> (magnetic: orientation)', '−l to +l'],
    ['m<sub>s</sub> (spin)', '+½ or −½'],
  ], { self: true }),
  g('Subshell letters', 'Value of l?', [
    ['s', '0'], ['p', '1'], ['d', '2'], ['f', '3'],
  ], { both: true, rcue: 'Letter?' }),
  g('Counting', 'Formula?', [
    ['Orbitals in a subshell', '2l + 1', '', ['2l+1']],
    ['Orbitals in shell n', 'n²', '', ['n2', 'n^2']],
    ['Electrons in shell n', '2n²', '', ['2n2']],
  ]),
  g('Hybridization', 'Hybridization?', [
    ['2 electron groups', 'sp'], ['3 electron groups', 'sp²', '', ['sp2']], ['4 electron groups', 'sp³', '', ['sp3']], ['5 electron groups', 'sp³d', '', ['sp3d']], ['6 electron groups', 'sp³d²', '', ['sp3d2']],
  ], { both: true, rcue: 'How many electron groups?' }),
  g('Expanded-octet shapes', 'Molecular shape?', [
    ['5 groups, 0 lone pairs', 'trigonal bipyramidal'], ['5 groups, 1 lone pair', 'seesaw'], ['5 groups, 2 lone pairs', 'T-shaped'], ['5 groups, 3 lone pairs', 'linear (XeF₂)'],
    ['6 groups, 0 lone pairs', 'octahedral'], ['6 groups, 1 lone pair', 'square pyramidal'], ['6 groups, 2 lone pairs', 'square planar'],
  ]),
  g('Bonds and formal charge', 'Answer', [
    ['Formal charge', 'valence e⁻ − lone-pair e⁻ − ½(bonding e⁻)'],
    ['Best Lewis structure', 'Formal charges closest to zero; any negative charge on the more electronegative atom'],
    ['A double bond is', '1 σ + 1 π'],
    ['A triple bond is', '1 σ + 2 π'],
    ['Bond order (MO theory)', '½ (bonding e⁻ − antibonding e⁻)'],
    ['Paramagnetic means', 'has unpaired electrons (O₂ is paramagnetic)'],
  ], { self: true }),
]);
