'use strict';
/* Lessons for Ch 11–19 */

lesson('gases', 11, [
  S('What a gas really is', `<b>Kinetic molecular theory</b>: a gas is tiny particles, far apart, flying in straight lines and bouncing off each other and the walls. Their average kinetic energy is set by temperature: hotter means faster.<br><br><b>Pressure</b> is the push of all those collisions on the walls. More collisions, or harder ones, mean more pressure.`,
    { ck: ['What causes gas pressure?', ['The weight of the gas', 'Particles colliding with the container walls', 'Attraction between particles', 'Heat leaking out'], 1, 'Every collision pushes on the wall. Pressure is that force spread over the wall\'s area.'] }),
  S('Pressure units', `Pressure has many units. Memorize this line: <span class="eqn">1 atm = 760 mmHg = 760 torr = 101.325 kPa = 14.7 psi</span>. Convert with dimensional analysis, as usual.`,
    { num: ['Convert <b>1.50 atm</b> to mmHg.', 1140, 'mmHg', '1.50 atm × 760 mmHg/atm = 1140 mmHg.'] }),
  S('Boyle\'s law: squeeze it, pressure rises', `At constant temperature, halving the volume crowds the particles, so they hit the walls twice as often and the pressure doubles. P and V are <b>inversely</b> related:<br><span class="eqn">P₁V₁ = P₂V₂</span>`,
    { ex: ['A gas at <b>1.0 atm</b> fills <b>6.0 L</b>. It is squeezed to <b>2.0 L</b>. New pressure?', 'P₁V₁ = P₂V₂, so P₂ = P₁V₁ / V₂.', 'P₂ = (1.0)(6.0) / 2.0.', '<b>3.0 atm</b>. One third the volume gives three times the pressure.'],
      num: ['A gas at <b>2.0 atm</b> in <b>5.0 L</b> expands to <b>10.0 L</b> at constant T. New pressure?', 1.0, 'atm', 'P₂ = (2.0)(5.0)/10.0 = 1.0 atm.'] }),
  S('Charles\'s law and why kelvin matters', `At constant pressure, heating a gas makes its particles hit harder, so it expands until the pressure balances. V and T are <b>directly</b> related: <span class="eqn">V₁/T₁ = V₂/T₂</span><br><br>T <b>must be in kelvin</b>. In °C, 0 would wrongly mean zero volume, and negative temperatures would give negative volumes. Kelvin starts at true zero.`,
    { num: ['A balloon holds <b>2.00 L at 27 °C</b>. What is its volume at <b>127 °C</b> (constant P)?', 2.667, 'L', 'Convert: 300 K and 400 K. V₂ = 2.00 × 400/300 = 2.67 L. Using °C (127/27) would give a wildly wrong 9.4 L.'] }),
  S('The ideal gas law', `Combine everything into one equation:<br><span class="eqn">PV = nRT</span>, with <span class="eqn">R = 0.08206 L·atm/(mol·K)</span><br>Use P in atm, V in liters, n in moles, T in kelvin. Solve for whichever one is missing. The combined gas law <span class="eqn">P₁V₁/T₁ = P₂V₂/T₂</span> handles "before and after" problems with the same gas.`,
    { ex: ['How many moles of gas are in <b>10.0 L at 2.00 atm and 300 K</b>?', 'n = PV / RT.', 'n = (2.00)(10.0) / (0.08206 × 300).', '<b>0.812 mol</b>.'],
      num: ['How many moles are in <b>22.4 L at 1.00 atm and 273 K</b>?', 1.0, 'mol', 'n = (1.00)(22.4)/(0.08206 × 273) = 1.00 mol. That is the molar volume at STP.'] }),
  S('STP and mixtures', `At <b>STP</b> (0 °C = 273 K, 1 atm), one mole of <i>any</i> ideal gas fills <b>22.4 L</b>. That makes a handy shortcut: moles = liters ÷ 22.4 at STP.<br><br>In a mixture, each gas pushes as if it were alone. <b>Dalton's law</b>: <span class="eqn">P<sub>total</sub> = P<sub>A</sub> + P<sub>B</sub> + …</span>`,
    { num: ['A tank holds N₂ at 0.80 atm and O₂ at 0.20 atm. What is the total pressure?', 1.0, 'atm', '0.80 + 0.20 = 1.00 atm. Partial pressures simply add.'] }),
]);

lesson('liquids-solids', 10, [
  S('Why liquids and solids exist', `Molecules attract each other with <b>intermolecular forces</b> (IMFs). Thermal energy tries to fling them apart. When attractions win, you get a liquid or solid; when motion wins, a gas.<br><br>So: <b>stronger IMFs mean a higher boiling point and melting point</b>, because you need more heat to pull the molecules apart.`,
    { ck: ['Substance A has stronger IMFs than substance B. Which has the higher boiling point?', ['A', 'B', 'Same'], 0, 'Stronger attractions take more energy to overcome, so A boils at a higher temperature.'] }),
  S('Properties that come from IMFs', `<ul><li><b>Surface tension</b>: molecules at the surface are pulled inward (water striders can walk on water).</li><li><b>Viscosity</b>: resistance to flow (honey has strong IMFs).</li><li><b>Evaporation and vapor pressure</b>: weaker IMFs let molecules escape easily, so the liquid evaporates fast and has a high vapor pressure.</li></ul>`,
    { ck: ['Liquid X evaporates faster than liquid Y at the same temperature. X has…', ['stronger IMFs', 'weaker IMFs'], 1, 'Molecules escape more easily when they are held less tightly.'] }),
  S('The three intermolecular forces', `<ol><li><b>Dispersion (London) forces</b>: in every molecule. Momentary uneven electron clouds create brief attractions. The only force in nonpolar molecules.</li><li><b>Dipole–dipole</b>: between polar molecules (δ⁺ end attracts δ⁻ end).</li><li><b>Hydrogen bonding</b>: an especially strong dipole force when H is bonded directly to <b>N, O or F</b>.</li></ol>To find the strongest IMF: H on N/O/F? → hydrogen bonding. Otherwise polar? → dipole–dipole. Otherwise → dispersion only.`,
    { ck: ['What is the strongest IMF in <b>NH₃</b>?', ['Dispersion', 'Dipole–dipole', 'Hydrogen bonding'], 2, 'NH₃ has H atoms bonded directly to N, so it hydrogen bonds.'] }),
  S('Bigger molecules, stronger dispersion', `Dispersion forces grow with the number of electrons, so larger, heavier molecules stick together better. Halogens show this beautifully: F₂ and Cl₂ are gases, Br₂ is a liquid, I₂ is a solid at room temperature.`,
    { ck: ['Which has the higher boiling point: <b>F₂ or I₂</b>?', ['F₂', 'I₂'], 1, 'Both are nonpolar, so only dispersion counts. I₂ has far more electrons, so its dispersion forces are stronger.'] }),
  S('Phase changes and energy', `Melting and boiling <b>absorb</b> energy (breaking attractions); freezing and condensing <b>release</b> it. During a phase change the temperature stays <b>flat</b>: all the energy goes into separating molecules, not speeding them up.<br><span class="eqn">q = n · ΔH<sub>fus</sub></span> (6.02 kJ/mol for water) for melting, <span class="eqn">q = n · ΔH<sub>vap</sub></span> (40.7 kJ/mol) for boiling.`,
    { num: ['How much heat (kJ) boils <b>36.0 g of water</b> at 100 °C? (18.02 g/mol, ΔH<sub>vap</sub> = 40.7 kJ/mol)', 81.31, 'kJ', '36.0 ÷ 18.02 = 2.00 mol × 40.7 kJ/mol = 81.3 kJ.'] }),
  S('Kinds of solids', `<ul><li><b>Molecular</b> solids: molecules held by IMFs (ice, sugar). Soft, low melting points.</li><li><b>Ionic</b> solids: ions in a lattice (NaCl). Hard, high melting points.</li><li><b>Metallic</b>: metal atoms in a sea of electrons. Conduct electricity, bendable.</li><li><b>Covalent network</b>: atoms bonded covalently in one giant structure (diamond, quartz). Extremely hard, very high melting points.</li></ul>`,
    { ck: ['Diamond is a…', ['molecular solid', 'ionic solid', 'metallic solid', 'covalent network solid'], 3, 'Every carbon is covalently bonded to four others in one continuous network.'] }),
]);

lesson('solutions', 11, [
  S('Solute, solvent and "like dissolves like"', `A solution has a <b>solvent</b> (the major part, often water) and one or more <b>solutes</b> dissolved in it. Polar solvents dissolve polar and ionic solutes; nonpolar solvents dissolve nonpolar solutes. That's why water dissolves salt but not oil.`,
    { ck: ['Cooking oil (nonpolar) dissolves best in…', ['water', 'hexane (nonpolar)', 'salt water'], 1, 'Like dissolves like: a nonpolar solute needs a nonpolar solvent.'] }),
  S('How much can dissolve?', `<b>Solubility</b> is the maximum amount that dissolves. An <b>unsaturated</b> solution can take more; a <b>saturated</b> one is at the limit; a <b>supersaturated</b> one holds more than the limit and is unstable.<br><br>Most solids dissolve better when hot. <b>Gases do the opposite</b>: they dissolve better when cold and under higher pressure. That's why warm soda goes flat.`,
    { ck: ['Why does an opened soda go flat faster when warm?', ['Gas solubility decreases as temperature rises', 'Sugar evaporates', 'Gas solubility increases as temperature rises'], 0, 'Warm liquid holds less dissolved CO₂, so the gas escapes.'] }),
  S('Mass percent', `<span class="eqn">mass % = mass of solute ÷ mass of solution × 100%</span><br>The solution mass is solute <b>plus</b> solvent.`,
    { num: ['10.0 g of salt dissolves in 90.0 g of water. Mass percent of salt?', 10.0, '%', '10.0 ÷ (10.0 + 90.0) × 100% = 10.0%.'] }),
  S('Molarity', `<span class="eqn">M = moles of solute ÷ liters of solution</span><br>To make a solution, you dissolve the solute and then add water <b>up to</b> the final volume. Molarity also works as a conversion factor between liters and moles.`,
    { ex: ['What is the molarity of <b>11.7 g NaCl</b> in <b>500. mL</b> of solution?', 'Moles: 11.7 g ÷ 58.44 g/mol = 0.200 mol.', 'Liters: 500. mL = 0.500 L.', 'M = 0.200 ÷ 0.500 = <b>0.400 M</b>.'],
      num: ['How many moles of solute are in <b>250 mL of 2.0 M</b> solution?', 0.5, 'mol', 'mol = M × L = 2.0 × 0.250 = 0.50 mol.'] }),
  S('Dilution', `Adding water spreads the same solute over more volume. Moles of solute stay the same, so:<br><span class="eqn">M₁V₁ = M₂V₂</span>`,
    { num: ['How many mL of <b>6.0 M HCl</b> do you need to make <b>300 mL of 1.0 M HCl</b>?', 50, 'mL', 'V₁ = M₂V₂/M₁ = (1.0)(300)/6.0 = 50 mL, then add water up to 300 mL.'] }),
  S('Solution stoichiometry', `In reactions between solutions, use molarity to turn volumes into moles, then follow the usual road map with mole ratios.`,
    { ex: ['What volume of <b>0.100 M NaOH</b> neutralizes <b>0.0050 mol HCl</b>? (1 : 1)', 'Moles NaOH needed = 0.0050 mol.', 'V = mol ÷ M = 0.0050 ÷ 0.100 = 0.050 L.', '<b>50 mL</b>.'],
      num: ['AgNO₃ + NaCl → AgCl + NaNO₃. How many moles of AgCl form from <b>20.0 mL of 0.500 M AgNO₃</b> (NaCl in excess)?', 0.01, 'mol', '0.0200 L × 0.500 M = 0.0100 mol AgNO₃ → 0.0100 mol AgCl (1 : 1).'] }),
  S('Colligative properties', `Dissolved particles <b>lower the freezing point</b> and <b>raise the boiling point</b> of a solvent. It depends only on how many particles there are, not what they are. Use <b>molality</b>, m = mol solute ÷ kg solvent:<br><span class="eqn">ΔT<sub>f</sub> = m·K<sub>f</sub></span>, <span class="eqn">ΔT<sub>b</sub> = m·K<sub>b</sub></span> (water: K<sub>f</sub> = 1.86, K<sub>b</sub> = 0.512 °C/m). Salt splits into ions, so it counts extra.`,
    { ck: ['Why do cities salt icy roads?', ['Salt melts ice by reacting with it', 'Dissolved salt lowers the freezing point of water', 'Salt raises the temperature of the road'], 1, 'Salt water freezes below 0 °C, so the ice melts at temperatures where pure water would stay frozen.'] }),
]);

lesson('acids-bases', 11, [
  S('What makes an acid or base', `Acids taste sour, turn litmus red and react with metals. Bases taste bitter, feel slippery and turn litmus blue.<br><br><b>Arrhenius definition:</b> an acid produces H⁺ (really H₃O⁺, hydronium) in water; a base produces OH⁻. HCl → H⁺ + Cl⁻; NaOH → Na⁺ + OH⁻.`,
    { ck: ['An Arrhenius base produces which ion in water?', ['H⁺', 'OH⁻', 'Cl⁻', 'Na⁺'], 1, 'Bases release hydroxide, OH⁻.'] }),
  S('Brønsted–Lowry: proton donors and acceptors', `A broader view: an <b>acid donates</b> an H⁺ (a proton) and a <b>base accepts</b> one. In NH₃ + H₂O ⇌ NH₄⁺ + OH⁻, water donates (acid) and ammonia accepts (base).<br><br>Remove H⁺ from an acid and you get its <b>conjugate base</b> (HCl → Cl⁻). Add H⁺ to a base and you get its <b>conjugate acid</b> (NH₃ → NH₄⁺).`,
    { ck: ['What is the conjugate base of <b>H₂O</b>?', ['H₃O⁺', 'OH⁻', 'O²⁻', 'H₂'], 1, 'Remove one H⁺ from H₂O and you are left with OH⁻.'] }),
  S('Strong and weak', `<b>Strong acids</b> ionize completely in water. Memorize the six: HCl, HBr, HI, HNO₃, H₂SO₄ and HClO₄. <b>Weak acids</b> (HF, acetic acid, …) ionize only a little, so most molecules stay intact. Strong bases include NaOH, KOH and Ca(OH)₂; NH₃ is a weak base.`,
    { ck: ['Which acid is strong?', ['HF', 'HC₂H₃O₂ (acetic acid)', 'HNO₃', 'H₂CO₃'], 2, 'Nitric acid is one of the six strong acids.'] }),
  S('Neutralization and titration', `Acid + base → water + salt. In a <b>titration</b>, you add base of known concentration to the acid until it is exactly neutralized (the <b>equivalence point</b>, often shown by an indicator changing color). At that point, mol H⁺ = mol OH⁻.`,
    { num: ['How many mL of <b>0.100 M NaOH</b> neutralize <b>25.0 mL of 0.100 M HCl</b>?', 25.0, 'mL', 'Same concentration and a 1 : 1 ratio means equal volumes: 25.0 mL.'] }),
  S('Water ionizes too', `Water molecules occasionally pass a proton between them: H₂O + H₂O ⇌ H₃O⁺ + OH⁻. At 25 °C:<br><span class="eqn">K<sub>w</sub> = [H₃O⁺][OH⁻] = 1.0 × 10⁻¹⁴</span><br>In pure water both are 1.0 × 10⁻⁷ M (neutral). If one goes up, the other must go down.`,
    { num: ['If [H₃O⁺] = <b>1.0 × 10⁻³ M</b>, what is [OH⁻]?', 1e-11, 'M', '[OH⁻] = 1.0 × 10⁻¹⁴ ÷ 1.0 × 10⁻³ = 1.0 × 10⁻¹¹ M.'] }),
  S('The pH scale', `Because concentrations span so many powers of ten, we use logs:<br><span class="eqn">pH = −log[H₃O⁺]</span>, <span class="eqn">pOH = −log[OH⁻]</span>, <span class="eqn">pH + pOH = 14</span><br>pH below 7 is acidic, 7 neutral, above 7 basic. Each step of 1 pH unit is a <b>factor of 10</b> in [H₃O⁺].`,
    { ex: ['What is the pH of <b>0.0010 M HCl</b>?', 'HCl is strong, so [H₃O⁺] = 0.0010 M = 1.0 × 10⁻³ M.', 'pH = −log(1.0 × 10⁻³).', '<b>pH = 3.00</b>.'],
      num: ['What is the pH of <b>0.010 M HCl</b>?', 2.0, '', '[H₃O⁺] = 1.0 × 10⁻² M, so pH = 2.00.', 0.01] }),
  S('Buffers, briefly', `A <b>buffer</b> resists changes in pH. It contains a weak acid <i>and</i> its conjugate base (like acetic acid + acetate). The base half absorbs added H⁺; the acid half absorbs added OH⁻. Your blood is buffered near pH 7.4. You will study buffers in depth in the Gen Chem Bridge (unit G2).`,
    { ck: ['A buffer is made of…', ['a strong acid and a strong base', 'a weak acid and its conjugate base', 'pure water', 'a strong acid and its conjugate base'], 1, 'Both halves of a weak conjugate pair must be present to absorb acid and base.'] }),
]);

lesson('equilibrium', 11, [
  S('What controls reaction speed', `Molecules must <b>collide</b>, with enough energy (the <b>activation energy</b>) and the right orientation. Rates go up with higher concentration (more collisions), higher temperature (harder, more frequent collisions), and a <b>catalyst</b>, which lowers the activation energy without being used up.`,
    { ck: ['A catalyst speeds up a reaction by…', ['raising the temperature', 'lowering the activation energy', 'adding more reactant', 'shifting the equilibrium'], 1, 'It provides an easier pathway with a lower energy barrier.'] }),
  S('Dynamic equilibrium', `Many reactions run both ways: A ⇌ B. At first the forward reaction is fast. As B builds up, the reverse speeds up. Eventually the <b>forward and reverse rates are equal</b>, and concentrations stop changing. That's <b>equilibrium</b>.<br><br>It is <i>dynamic</i>: molecules keep reacting both ways. And equal rates do <b>not</b> mean equal amounts.`,
    { ck: ['At equilibrium…', ['the reaction has stopped', 'the forward and reverse rates are equal', 'reactant and product amounts are equal', 'only products remain'], 1, 'Both reactions keep going at the same rate, so the amounts hold steady (but are not necessarily equal).'] }),
  S('The equilibrium constant K', `For aA + bB ⇌ cC + dD:<br><span class="eqn">K = [C]ᶜ[D]ᵈ / [A]ᵃ[B]ᵇ</span><br>Products over reactants, each raised to its coefficient. <b>Leave out pure solids and liquids</b>: their "concentration" never changes.`,
    { ck: ['Write K for <b>CaCO₃(s) ⇌ CaO(s) + CO₂(g)</b>.', ['K = [CaO][CO₂]/[CaCO₃]', 'K = [CO₂]', 'K = 1/[CO₂]', 'K = [CaCO₃]/[CaO]'], 1, 'Both solids drop out, leaving only the gas: K = [CO₂].'] }),
  S('What K tells you', `<ul><li><b>K ≫ 1</b>: at equilibrium there is mostly product (the reaction "goes").</li><li><b>K ≪ 1</b>: mostly reactant.</li><li><b>K ≈ 1</b>: a real mix of both.</li></ul>Compare the reaction quotient Q (same formula, current concentrations) with K: Q < K → it shifts right; Q > K → it shifts left.`,
    { ck: ['A reaction has <b>K = 1 × 10¹⁰</b>. At equilibrium…', ['reactants are favored', 'products are favored', 'there are equal amounts'], 1, 'A huge K means the numerator (products) dominates.'] }),
  S('Le Châtelier\'s principle', `Disturb a system at equilibrium and it <b>shifts to counteract the change</b>:<ul><li>Add a substance → shift away from it. Remove one → shift toward it.</li><li>Squeeze (raise pressure) → shift toward fewer moles of gas.</li><li>Heat it → shift in the endothermic direction (treat heat like a reactant or product).</li><li>A catalyst → no shift, only faster.</li></ul>`,
    { ck: ['N₂ + 3 H₂ ⇌ 2 NH₃. You add more N₂. Which way does it shift?', ['Left', 'Right', 'No shift'], 1, 'The system uses up some of the added N₂ by making more NH₃.'] }),
  S('Solubility equilibria', `An "insoluble" salt actually dissolves a tiny bit: AgCl(s) ⇌ Ag⁺ + Cl⁻. Its K is the <b>solubility product</b>, <span class="eqn">K<sub>sp</sub> = [Ag⁺][Cl⁻]</span>. If s mol/L dissolves, both ions equal s, so K<sub>sp</sub> = s² and s = √K<sub>sp</sub>.`,
    { num: ['K<sub>sp</sub> for a salt AB is <b>1.0 × 10⁻¹⁰</b>. What is its molar solubility s?', 1e-5, 'M', 's = √(1.0 × 10⁻¹⁰) = 1.0 × 10⁻⁵ M.'] }),
]);

lesson('redox', 10, [
  S('Redox is electron transfer', `In an oxidation–reduction (redox) reaction, electrons move from one substance to another.<br><b>OIL RIG</b>: <b>O</b>xidation <b>I</b>s <b>L</b>oss (of electrons), <b>R</b>eduction <b>I</b>s <b>G</b>ain. They always happen together: if one atom loses electrons, another gains them.`,
    { ck: ['Is <b>Na → Na⁺ + e⁻</b> oxidation or reduction?', ['Oxidation', 'Reduction'], 0, 'Sodium loses an electron, and loss is oxidation.'] }),
  S('Oxidation states', `Oxidation numbers are bookkeeping charges. Rules, in order:<ol><li>A free element is 0.</li><li>A monatomic ion equals its charge.</li><li>Group 1 = +1, group 2 = +2, F = −1.</li><li>H = +1 (−1 with metals), O = −2 (−1 in peroxides).</li><li>All of them add up to the overall charge.</li></ol>`,
    { ex: ['Find the oxidation state of S in <b>SO₄²⁻</b>.', 'Each O is −2; four of them give −8.', 'The total must equal the ion charge, −2: S + (−8) = −2.', '<b>S = +6</b>.'],
      num: ['What is the oxidation state of C in <b>CO₂</b>?', 4, '', 'Two O at −2 each = −4. C + (−4) = 0, so C = +4.', 0] }),
  S('Who is oxidized, who is reduced', `Compare oxidation numbers before and after. If it goes <b>up</b>, that atom was <b>oxidized</b>. If it goes <b>down</b>, it was <b>reduced</b>.<br><br>The substance that gets reduced is the <b>oxidizing agent</b> (it takes electrons); the substance that gets oxidized is the <b>reducing agent</b>.`,
    { ck: ['Zn + Cu²⁺ → Zn²⁺ + Cu. What is <b>oxidized</b>?', ['Zn', 'Cu²⁺', 'Zn²⁺', 'Cu'], 0, 'Zn goes from 0 to +2: it loses electrons, so it is oxidized (and is the reducing agent).'] }),
  S('Balancing redox: electrons must match', `Split the reaction into two <b>half-reactions</b>, one losing electrons and one gaining. Multiply them so the <b>electrons lost equal the electrons gained</b>, then add.<br>Al → Al³⁺ + 3e⁻ (×2) and Cu²⁺ + 2e⁻ → Cu (×3): 6 electrons each way, giving 2 Al + 3 Cu²⁺ → 2 Al³⁺ + 3 Cu.`,
    { ck: ['When balancing a redox reaction, what must be equal?', ['The masses of each half', 'Electrons lost and electrons gained', 'The number of ions on each side', 'The oxidation numbers'], 1, 'Electrons are not created or destroyed, so every electron lost must be gained by something.'] }),
  S('The activity series', `Metals differ in how easily they lose electrons. The <b>activity series</b> ranks them (Li, K, Ca, Na, Mg, Al, Zn, Fe, … H₂ … Cu, Ag, Au). A metal will give electrons to the <b>ions of any metal below it</b>. Zinc dissolves in Cu²⁺ solution, but copper does nothing in Zn²⁺ solution. Metals above H₂ react with acids to release hydrogen gas.`,
    { ck: ['Will copper metal react with a solution of Zn²⁺?', ['Yes', 'No'], 1, 'Copper is below zinc in the series, so it cannot push electrons onto Zn²⁺.'] }),
  S('Batteries, electrolysis and corrosion', `A <b>battery</b> separates a spontaneous redox reaction so electrons must flow through a wire. <b>Electrolysis</b> does the reverse: outside electricity forces a non-spontaneous reaction (plating metals, splitting water). <b>Corrosion</b>, like rusting, is the unwanted oxidation of a metal by oxygen.`,
    { ck: ['Rusting of iron is an example of…', ['reduction of iron', 'oxidation of iron', 'a physical change'], 1, 'Iron loses electrons to oxygen, forming iron oxide.'] }),
]);

lesson('nuclear', 9, [
  S('Unstable nuclei', `Some nuclei have an unstable mix of protons and neutrons. They release energy and particles to become more stable: <b>radioactivity</b>. Write a nuclide with mass number A on top and atomic number Z on the bottom: uranium-238 is ²³⁸₉₂U.`,
    { ck: ['In ²³⁸₉₂U, what does 92 tell you?', ['The mass number', 'The number of protons', 'The number of neutrons'], 1, 'The bottom number is Z, the protons. Neutrons = 238 − 92 = 146.'] }),
  S('Kinds of radiation', `<ul><li><b>Alpha (α)</b> = ⁴₂He nucleus. Heavy, stopped by paper, but very damaging if swallowed.</li><li><b>Beta (β⁻)</b> = an electron, ⁰₋₁e. Stopped by aluminum or wood.</li><li><b>Gamma (γ)</b> = high-energy light. Needs thick lead or concrete.</li><li><b>Positron (β⁺)</b> = ⁰₊₁e, an anti-electron.</li></ul>`,
    { ck: ['Which radiation is stopped by a sheet of paper?', ['Alpha', 'Beta', 'Gamma'], 0, 'Alpha particles are big and slow, so they lose their energy quickly.'] }),
  S('Balancing nuclear equations', `In a nuclear equation, the <b>mass numbers add up</b> the same on both sides, and so do the <b>atomic numbers</b>. Alpha decay lowers A by 4 and Z by 2. Beta decay leaves A the same and raises Z by 1 (a neutron becomes a proton).`,
    { ex: ['What forms when <b>U-238</b> undergoes alpha decay?', '²³⁸₉₂U → ⁴₂He + ?', 'Mass: 238 − 4 = 234. Atomic number: 92 − 2 = 90.', 'Z = 90 is thorium: <b>²³⁴₉₀Th</b>.'],
      ck: ['What does <b>C-14</b> become after beta decay?', ['B-14', 'N-14', 'C-13', 'N-15'], 1, 'A stays 14; Z goes from 6 to 7, which is nitrogen: N-14.'] }),
  S('Half-life', `The <b>half-life</b> is the time for half of a sample to decay. After 1 half-life, ½ is left; after 2, ¼; after n, <span class="eqn">(½)ⁿ</span>. Carbon-14's half-life of 5730 years lets scientists date once-living things.`,
    { num: ['You start with <b>100 g</b> of a radioactive isotope. How much remains after <b>3 half-lives</b>?', 12.5, 'g', '100 → 50 → 25 → 12.5 g. That is 100 × (½)³.'] }),
  S('Fission and fusion', `<b>Fission</b> splits a heavy nucleus (like U-235) into smaller ones, releasing neutrons that can split more nuclei in a chain reaction. Nuclear power plants run on this. <b>Fusion</b> joins light nuclei (hydrogen into helium); it powers the Sun. Both turn a little mass into a huge amount of energy: <span class="eqn">E = mc²</span>.`,
    { ck: ['The Sun\'s energy comes from…', ['fission of uranium', 'fusion of hydrogen into helium', 'chemical burning'], 1, 'In the Sun\'s core, hydrogen nuclei fuse into helium.'] }),
  S('Radiation in the real world', `Radiation can damage cells and DNA, so exposure is limited (distance, shielding and time). It also saves lives: radioactive tracers image organs, gamma rays kill cancer cells, and irradiation sterilizes medical tools.`,
    { ck: ['The three ways to reduce radiation exposure are…', ['distance, shielding, time', 'heat, cold, pressure', 'water, air, light'], 0, 'Stay far away, put material between you and the source, and limit how long you are near it.'] }),
]);

lesson('organic', 9, [
  S('Why carbon is special', `Carbon makes <b>four bonds</b> and bonds strongly to itself, so it can form long chains, branches and rings. That is why there are millions of carbon compounds, the subject of <b>organic chemistry</b>.`,
    { ck: ['How many bonds does carbon form in stable compounds?', ['2', '3', '4', '5'], 2, 'Carbon has 4 valence electrons and forms 4 bonds.'] }),
  S('Alkanes', `<b>Hydrocarbons</b> contain only C and H. <b>Alkanes</b> have only single bonds and the formula C<sub>n</sub>H<sub>2n+2</sub>. Names come from the chain length: meth (1), eth (2), prop (3), but (4), pent (5), hex (6), hept (7), oct (8), non (9), dec (10), plus "-ane".`,
    { ck: ['Name the alkane <b>C₅H₁₂</b>.', ['butane', 'pentane', 'pentene', 'hexane'], 1, '5 carbons is "pent"; all single bonds is "-ane": pentane.'] }),
  S('Alkenes and alkynes', `A C=C double bond makes an <b>alkene</b> (C<sub>n</sub>H<sub>2n</sub>, ending -ene); a C≡C triple bond makes an <b>alkyne</b> (C<sub>n</sub>H<sub>2n−2</sub>, ending -yne). For 4+ carbons, number the chain from the end closest to the multiple bond: CH₃CH=CHCH₃ is 2-butene.`,
    { ck: ['What is the formula of <b>2-butene</b>?', ['C₄H₁₀', 'C₄H₈', 'C₄H₆', 'C₂H₄'], 1, 'An alkene with n = 4 has 2n = 8 hydrogens: C₄H₈.'] }),
  S('Isomers', `<b>Isomers</b> have the same formula but different structures. C₄H₁₀ can be a straight chain (butane) or branched (isobutane, 2-methylpropane). Different structures mean different properties, like boiling point.`,
    { ck: ['Butane and isobutane are…', ['the same molecule', 'isomers', 'different elements'], 1, 'Same formula (C₄H₁₀), different arrangements: isomers.'] }),
  S('Functional groups', `A <b>functional group</b> is the reactive part of an organic molecule:<ul><li>–OH alcohol (ethanol)</li><li>–O– ether</li><li>–CHO aldehyde; –CO– ketone (acetone)</li><li>–COOH carboxylic acid (vinegar)</li><li>–COO– ester (fruit smells)</li><li>–NH₂ amine</li></ul>`,
    { ck: ['A molecule containing <b>–OH</b> bonded to carbon is an…', ['ether', 'alcohol', 'aldehyde', 'amine'], 1, 'The hydroxyl group –OH defines an alcohol.'] }),
  S('Organic molecules everywhere', `Fuels (alkanes), plastics (polymers: long chains of repeating units like polyethylene), medicines and the molecules of life are all organic. Polymers form when small <b>monomers</b> link into long chains. That idea returns in biochemistry with proteins and DNA.`,
    { ck: ['Polyethylene is made by linking many…', ['proteins', 'ethylene monomers', 'salt crystals'], 1, 'Many ethylene (C₂H₄) units join into a long polymer chain.'] }),
]);

lesson('biochem', 9, [
  S('The molecules of life', `Living things are built from four classes of biomolecules: <b>carbohydrates</b>, <b>lipids</b>, <b>proteins</b> and <b>nucleic acids</b>. Most are polymers built from smaller units.`,
    { ck: ['Which is <b>not</b> one of the four biomolecule classes?', ['Carbohydrates', 'Proteins', 'Minerals', 'Nucleic acids'], 2, 'The four are carbohydrates, lipids, proteins and nucleic acids.'] }),
  S('Carbohydrates', `Sugars and starches, built from <b>monosaccharides</b> like glucose (C₆H₁₂O₆). Two join into a disaccharide (sucrose); many join into polysaccharides (starch and glycogen for energy storage, cellulose for plant structure).`,
    { ck: ['Starch is a polymer of…', ['amino acids', 'glucose', 'fatty acids', 'nucleotides'], 1, 'Starch is a long chain of glucose units.'] }),
  S('Lipids', `Lipids don't dissolve in water. <b>Fats and oils</b> (triglycerides) are glycerol plus three fatty acids and store energy. <b>Phospholipids</b> form cell membranes. <b>Steroids</b> like cholesterol and testosterone are lipids too.`,
    { ck: ['A triglyceride is made of…', ['glycerol + 3 fatty acids', 'glucose + fructose', 'amino acids'], 0, 'One glycerol backbone with three fatty acid chains.'] }),
  S('Proteins', `Proteins are chains of <b>amino acids</b> (20 kinds) joined by <b>peptide bonds</b>. The order of amino acids decides how the chain folds into a 3-D shape, and the shape decides its job: enzymes, hemoglobin, collagen, antibodies.`,
    { ck: ['What determines a protein\'s shape and function?', ['Its amino acid sequence', 'Its color', 'The amount of water around it'], 0, 'The sequence controls the folding, and the folding controls the function.'] }),
  S('Nucleic acids', `DNA and RNA are chains of <b>nucleotides</b> (sugar + phosphate + base). DNA's bases pair up across the double helix: <b>A with T</b>, <b>G with C</b>. RNA uses U instead of T.`,
    { ck: ['In DNA, adenine (A) pairs with…', ['G', 'C', 'T', 'U'], 2, 'A pairs with T (and G with C).'] }),
  S('From DNA to protein', `<b>Transcription</b>: a DNA template is copied into messenger RNA (A→U, T→A, G→C, C→G). <b>Translation</b>: the ribosome reads the mRNA three bases at a time; each <b>codon</b> stands for one amino acid. AUG starts the chain; UAA, UAG and UGA stop it.`,
    { ck: ['How many mRNA bases make one codon?', ['1', '2', '3', '4'], 2, 'Three bases form one codon, which codes for one amino acid.'] }),
]);
