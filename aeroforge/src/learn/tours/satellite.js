// Guided tour: satellite. See ../tours.js for the step format.

export default [
  {
    title: 'A spacecraft is a power, heat and pointing problem',
    body: 'SENTINEL-4 exists to point a telescope at the ground and send pictures home. Everything else — arrays, radiators, wheels, tanks — keeps it powered, at the right temperature and pointed precisely while it circles the Earth every 95 minutes.',
    key: 'Orbital period T = 2π √(a³ / μ): 95 min at 520 km.',
  },
  {
    title: 'Solar power',
    body: 'Each wing unfolds four panels of triple-junction cells that turn about 30 % of sunlight into electricity — roughly 9.8 kW at launch, slowly degrading with radiation. A drive motor turns each wing to keep facing the Sun; batteries carry the craft through the eclipse on every orbit.',
    key: 'Sunlight in orbit delivers 1,361 W/m² — about 40 % more than at the ground.',
    focus: ['Solar array wing (starboard)', 'Solar array wing (port)'], view: { dir: [0.5, 0.6, 1.3], fill: 1.1 }, demo: 'deploy',
  },
  {
    title: 'Thermal control',
    body: 'With no air to carry heat away, the sunlit side bakes while the shaded side radiates into 3 K space. Gold multi-layer insulation blankets isolate the inside; mirrored radiators reject heat from the electronics. Thermal view shows the split.',
    key: 'Radiated power P = ε σ A T⁴ — the only way to dump heat in vacuum.',
    mode: 'thermal', view: { dir: [0.8, 0.4, 1] },
  },
  {
    title: 'Pointing with reaction wheels',
    body: 'Four wheels in a pyramid let the spacecraft turn without using propellant: spin a wheel one way and the body turns the other, because angular momentum is conserved. Star trackers measure the attitude to a few arc-seconds.',
    key: 'Any three of the four wheels give full three-axis control; the fourth is a spare.',
    focus: ['Reaction wheels', 'Star trackers & omni antennas', 'Central thrust tube'], explode: 0.75, view: { dir: [1, 0.6, 0.8] },
  },
  {
    title: 'The telescope',
    body: 'A 1-metre telescope folds a long focal length into a short barrel with three mirrors. From 500 km it resolves objects about 30 cm across. The angled sunshade blocks stray light when imaging near the day–night line.',
    key: 'Diffraction limit θ ≈ 1.22 λ / D: 0.67 µrad at 550 nm for a 1 m mirror.',
    focus: ['Imaging telescope'], explode: 0.4, view: { dir: [1, 0.25, 0.4] },
  },
  {
    title: 'Propulsion and the Δv budget',
    body: 'Two titanium tanks hold 1,800 kg of hydrazine-family propellant for a 445 N engine. That fixed budget sets how far the craft can raise its orbit — try it in the orbital-transfer lab, then open the orbit view.',
    key: 'Propellant m_p = m₀ (1 − e^(−Δv / (I_sp g₀))).',
    focus: ['Propellant tanks', 'Apogee engine & RCS'], explode: 0.75, view: { dir: [-1, 0.4, 0.7] },
  },
];
