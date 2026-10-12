# Chem Bench

Interactive labs for every chapter of an introductory chemistry course (organized to match Tro, *Introductory Chemistry*, Ch 2–17).

Open `index.html` in any browser. No install or build step. Progress is saved in your browser.

Each lab has three parts:

- **Bench**: interactive models you can change and watch respond.
- **Key ideas**: the chapter's rules and formulas, short enough to review in a minute.
- **Practice**: endless randomized problems with worked solutions. Filter by problem type to drill one skill. Ten correct answers marks a lab as mastered.

| Ch | Lab | Bench | Practice |
|----|-----|-------|----------|
| 2 | Measurement & Sig Figs | Sig fig inspector, unit converter | Count sig figs, rounding, × ÷ and + − rules, unit conversions |
| 3 | Matter & Energy | Heat calculator (q = mcΔT), temperature converter | Classify matter, physical vs chemical change, heat, temperature, energy units |
| 4 | Atoms & Isotopes | Atom/ion builder with Bohr model, atomic mass from isotopes | p/n/e counts, atomic mass, ion charges, isotope symbols |
| 5 | Compounds & Naming | Criss-cross ionic builder, molecular namer | Name ↔ formula (ionic, molecular), hidden charges, hydrates, empirical formulas, substance types |
| 6 | Moles & Composition | Molar mass calculator, grams ⇄ moles ⇄ particles | Molar mass, mole conversions, counting atoms, mass %, empirical & molecular formulas |
| 7 | Balancing & Reaction Types | Equation balancer with live atom tally, solubility checker | Balancing, reaction types, solubility, precipitates |
| 8 | Stoichiometry & Limiting Reactants | Limiting reactant scale with yield | Mole/gram conversions, limiting reactant, theoretical and percent yield |
| 9 | Electron Configurations | Clickable periodic table with orbital diagrams, light calculator | Configurations, valence and unpaired electrons, periodic trends, photon energy |
| 10 | Bonding & VSEPR | Rotating 3D VSEPR models, ΔEN bond-type scale | Valence electrons, molecular shape, bond type, polarity |
| 11 | Gas Laws | Particle piston simulator with Boyle/Charles/Gay-Lussac/Avogadro modes | Each gas law, ideal gas law, STP, pressure units, partial pressures |
| 12 | IMFs & Phase Changes | IMF identifier with boiling-point chart, water heating curve | Strongest IMF, boiling point comparisons, heats of fusion/vaporization |
| 13 | Solutions & Concentration | Solution maker and dilution with colored beakers | Molarity, dilution, mass %, freezing/boiling point changes |
| 14 | Acids, Bases & pH | pH scale explorer, strong acid/base titration curve | pH/pOH/[H₃O⁺], strong acids/bases, titration, conjugate pairs |
| 15 | Equilibrium & Le Châtelier | Ammonia equilibrium simulator (Q vs K) | Writing K, calculating K, Q vs K, Le Châtelier, Ksp |
| 16 | Oxidation & Reduction | Oxidation number calculator, activity series | Oxidation numbers, oxidized/reduced/agents, activity series |
| 17 | Radioactivity & Half-Life | Decay simulator, nuclear equation builder | Decay products, half-life amounts, carbon dating, identifying particles |

## Files

- `index.html`: page, styles, and script includes
- `js/core.js`: element data, formula parser, chemistry helpers, practice engine, router
- `js/labs-foundations.js`: Ch 2–3
- `js/labs-atoms.js`: Ch 4, 5, 6, 9, 10
- `js/labs-reactions.js`: Ch 7, 8, 15, 16
- `js/labs-states.js`: Ch 11–14, 17

To add a lab, call `registerLab({ id, ch, sym, fam, title, chapter, blurb, ideas, bench(el), problems })` in any lab file.
