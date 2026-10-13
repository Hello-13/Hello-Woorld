// Guided tour: rocket. See ../tours.js for the step format.

export default [
  {
    title: 'Three cores, one launch',
    body: 'HELIOS-H straps two first-stage cores to a centre core: 27 engines at liftoff, about 1,400 tonnes. All of them light together, but the centre core throttles back so it still has propellant when the side boosters drop away.',
    key: 'Liftoff thrust 22.8 MN ÷ weight 13.6 MN → thrust-to-weight 1.68.',
  },
  {
    title: 'Tanks are most of the rocket',
    body: 'Each core is mostly two tanks: liquid oxygen on top of RP-1 kerosene. Oxygen is the bigger share — the engines burn about 2.3 kg of LOX for every kilogram of fuel — and it is so cold (90 K) that the tank skin frosts over on the pad.',
    key: 'About 94 % of a first stage\'s liftoff mass is propellant.',
    focus: ['Core stage', 'Side booster (starboard)', 'Side booster (port)'], mode: 'thermal', view: { dir: [1, 0.25, 1.2] },
  },
  {
    title: 'Engines and specific impulse',
    body: 'Nine engines per core sit on an octaweb. Specific impulse — thrust per unit propellant weight flow — rises from 282 s at sea level to 311 s in vacuum, because air pressure pushes back on the nozzle exit. Note the heat-tinted bells and the turbopump hardware on each engine.',
    key: 'Thrust F = ṁ g₀ I_sp, and I_sp grows as ambient pressure drops.',
    focus: ['Core engine cluster'], explode: 0.25, view: { dir: [1, -0.25, 1] },
  },
  {
    title: 'Staging',
    body: 'Carrying empty tanks to orbit wastes energy, so rockets throw them away. Each stage gets its own rocket-equation Δv, and the total adds up to far more than any single stage could reach. The exploded view shows the separation planes.',
    key: 'Tsiolkovsky: Δv = I_sp g₀ ln(m₀ / m_f) — orbit needs ≈ 9.4 km/s including gravity and drag losses.',
    explode: 0.7, view: { dir: [1.2, 0.3, 1.1], fill: 1.2 },
  },
  {
    title: 'A nozzle built for vacuum',
    body: 'The upper-stage engine\'s bell is enormous for its size: an expansion ratio near 165 : 1 squeezes extra velocity out of the exhaust where there is no air. At sea level the same nozzle would over-expand, the flow would separate and the bell would be torn apart.',
    key: 'Vacuum I_sp 348 s versus 311 s for the sea-level engines.',
    focus: ['Vacuum engine', 'Upper stage', 'Interstage'], explode: 0.45, view: { dir: [1, 0.1, 0.9] },
  },
  {
    title: 'The payload fairing',
    body: 'The fairing shields the spacecraft through maximum aerodynamic pressure — about 45 kPa on this ascent — then splits in two around 110 km, where dynamic pressure has fallen to a few pascals and the air no longer matters.',
    key: 'Dynamic pressure q = ½ ρ V² peaks about a minute after liftoff (max-Q).',
    focus: ['Fairing half A', 'Fairing half B', 'Payload'], explode: 0.55, view: { dir: [1, 0.35, 1] },
  },
  {
    title: 'Now fly it',
    body: 'Open the launch simulator in the lab and press Launch. Watch the staging events, the pitch-over and the sky fading to black as the Earth\'s curve appears below. Try a heavier payload or a different pitch kick and see whether it still reaches orbit.',
    key: 'Orbital velocity at 200 km is about 7.8 km/s — the Earth\'s rotation gives you the first 0.4 km/s for free when launching east.',
  },
];
