// Guided tour: turbofan. See ../tours.js for the step format.

export default [
  {
    title: 'Most of the thrust bypasses the core',
    body: 'For every kilogram of air that enters the core, about 9.5 kg flows around it. The big fan moves a lot of air a little faster, which is far more efficient than a small, fast jet — that is why airliners look the way they do.',
    key: 'Propulsive efficiency η_p ≈ 2 / (1 + V_jet / V_flight): slow jets waste less kinetic energy.',
    view: { dir: [0.9, 0.35, 1.2] },
  },
  {
    title: 'The fan',
    body: '22 hollow titanium blades, 3 m across. At take-off the tips move faster than sound relative to the air — the source of the buzz-saw noise you hear under an airliner\'s wing. The fan alone produces around four fifths of the take-off thrust.',
    key: 'Fan pressure ratio 1.55 — a gentle squeeze applied to a huge mass of air.',
    focus: ['Fan rotor', 'Inlet cowl'], view: { dir: [1, 0.3, 0.6] },
  },
  {
    title: 'Compressing 42 times',
    body: 'Three booster stages and nine high-pressure stages raise the pressure forty-two-fold. Each stage adds only a little, and the blades shrink stage by stage because the squeezed air takes up less room. The air leaves the compressor at around 900 K.',
    key: 'Ideal compressor temperature rise: T₃/T₂ = (p₃/p₂)^((γ−1)/γ).',
    focus: ['LP compressor (booster)', 'HP compressor'], explode: 0.3, view: { dir: [0.6, 0.45, 1] },
  },
  {
    title: 'The combustor',
    body: 'Twenty fuel injectors feed an annular combustor. Burning at nearly constant pressure raises the gas to 1,750 K — hotter than the melting point of the nickel alloys downstream. Thermal view shows how the heat is concentrated in the core.',
    key: 'Fuel–air ratio ≈ 0.027: one kilogram of fuel for every 37 kg of core air.',
    focus: ['Annular combustor', 'Plumbing & harnesses'], mode: 'thermal', view: { dir: [0.4, 0.6, 1] },
  },
  {
    title: 'Turbines that survive above their melting point',
    body: 'High-pressure turbine blades are grown as single crystals, wrapped in an off-white ceramic thermal-barrier coat and cooled by compressor air bled through internal passages. The turbines extract just enough work to drive everything upstream.',
    key: 'Work balance: the LPT supplies (1 + BPR) × c_p × ΔT across the fan.',
    focus: ['HP turbine', 'LP turbine'], explode: 0.25, view: { dir: [0.5, 0.4, 1] },
  },
  {
    title: 'Two spools, two speeds',
    body: 'The low-pressure shaft (fan, booster, LP turbine) runs inside the hollow high-pressure drum, each on its own bearings. Letting them spin at different speeds keeps every blade row near its best tip speed.',
    key: 'N1 ≈ 2,400 rpm and N2 ≈ 13,000 rpm at take-off.',
    focus: ['LP & HP shafts', 'Fan rotor', 'LP turbine', 'HP compressor', 'HP turbine'], mode: 'xray', view: { dir: [0.3, 0.5, 1] },
  },
  {
    title: 'Follow the flow',
    body: 'Flow particles and station planes trace the Brayton cycle: compress, heat at constant pressure, expand. Cool bypass air streams past in blue; core gas turns amber after the combustor. The T–s diagram in the lab is the same cycle in numbers.',
    key: 'Thermal efficiency rises with overall pressure ratio: η_ideal = 1 − (p₀/p₃)^((γ−1)/γ).',
    demo: 'flow', view: { dir: [0.18, 0.2, 1], fill: 1.05, lift: 0.32 },
  },
];
