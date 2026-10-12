// Guided-tour content. Each step can focus parts (everything else is ghosted), choose a render
// mode, explode the assembly, aim the camera and run enter/exit actions on the vehicle or lab.
// `key` is the one idea to remember, usually an equation or a number with units.

export const TOURS = {
  fighter: [
    {
      title: 'A stealth fighter is shaped by radar',
      body: 'The AX-7 trades some aerodynamic freedom for a tiny radar cross-section. Every choice you will see in this tour — the outline, the intakes, the tails, internal weapons — exists to keep radar energy from bouncing straight back to the emitter.',
      key: 'Radar equation: detection range scales as σ^¼, so halving the cross-section σ cuts range by only 16 % — stealth needs reductions of 100× or more.',
    },
    {
      title: 'Planform alignment',
      body: 'Look at the edges in blueprint view: the wing leading edge, stabilators and fin edges all share the same few sweep angles. Reflections from parallel edges stack into a handful of narrow spikes, leaving the angles in between quiet. The chines carry the same line forward to the nose.',
      key: 'Leading edges here are swept 42°; the trailing edges echo them at −17°.',
      mode: 'blueprint', view: { dir: [0.05, 1, 0.12], fill: 0.85 },
    },
    {
      title: 'Radar and radome',
      body: 'The AESA array is fixed and tilted back, so its flat face never squares up to a threat radar; its beam is steered electronically by about 2,000 transmit/receive modules. The radome is a frequency-selective surface — transparent in the array\'s own band, reflective out of band.',
      key: 'Electronic steering moves the beam in microseconds instead of the ~1 s a mechanical dish needs.',
      focus: ['Radome', 'AESA radar array'], mode: 'xray', explode: 0.35, view: { dir: [1, 0.35, 0.8] },
    },
    {
      title: 'Caret intakes and S-ducts',
      body: 'Each swept, raked intake lip makes oblique shock waves that slow supersonic air efficiently. Behind the lip the duct curves inward and up, so the spinning fan — the brightest radar reflector on any jet — is out of sight from the front.',
      key: 'A normal shock at Mach 2 loses ~28 % of total pressure; two oblique shocks lose under 10 %.',
      focus: ['Right caret intake', 'Left caret intake'], view: { dir: [1, 0.15, 0.55] },
    },
    {
      title: 'Where lift comes from',
      body: 'Pressure view colours every lifting surface by pressure coefficient. Blue is suction, strongest just behind the leading edge on the upper surface; red is compression underneath. Lift is that pressure difference summed over the wing. Change angle of attack and Mach in the lab and watch it move.',
      key: 'L = ½ ρ V² S C_L, and thin-airfoil theory gives C_L ≈ 2πα per radian (less for a low-aspect wing).',
      mode: 'pressure', focus: ['Right wing', 'Left wing', 'Right stabilator', 'Left stabilator'], view: { dir: [0.6, 1, 0.75] },
    },
    {
      title: 'Control surfaces',
      body: 'All-moving stabilators pitch the jet, flaperons and ailerons roll it, and rudders on the canted fins yaw it. A fly-by-wire computer blends them — at high angle of attack the stabilators also move differentially to help the roll.',
      key: 'The airframe is slightly unstable in pitch on purpose — more agile — and the flight computer corrects it many times a second.',
      focus: ['Right wing', 'Left wing', 'Right stabilator', 'Left stabilator', 'Right vertical tail', 'Left vertical tail'],
      view: { dir: [-1, 0.6, 0.9] }, demo: 'surfaces',
    },
    {
      title: 'Thrust vectoring',
      body: 'The two-dimensional nozzles deflect the exhaust up to 20° up or down. When the jet is too slow or too nose-high for the tail to bite, thrust itself provides the pitching moment — that is what lets it point its nose beyond the stall.',
      key: 'Afterburner adds ~35 % thrust by burning fuel in the exhaust — at roughly triple the fuel flow.',
      focus: ['Right engine & TVC nozzle', 'Left engine & TVC nozzle'], view: { dir: [-1, 0.25, 0.55] }, demo: 'tvc',
    },
    {
      title: 'Internal weapons bay',
      body: 'Missiles ride inside to keep the outline clean. When a shot is taken the doors snap open, a pneumatic trapeze launcher pushes the missile out of the turbulent boundary layer, and the doors close again in about a second.',
      key: 'External stores can multiply a stealth jet\'s radar cross-section many times over.',
      focus: ['Main weapons bay'], view: { dir: [0.6, -0.55, 1] }, demo: 'bay',
    },
    {
      title: 'Heat is a signature too',
      body: 'Thermal view at Mach 2: even in −57 °C air the leading edges and radome reach around 115 °C from compression heating, and the afterburning nozzles glow far hotter. Infrared search-and-track sensors look for exactly this.',
      key: 'Stagnation temperature T₀ = T (1 + 0.2 M²): at Mach 2 and 217 K that is ≈ 390 K.',
      mode: 'thermal', view: { dir: [-0.9, 0.5, 1] }, demo: 'mach2',
    },
  ],

  rocket: [
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
  ],

  turbofan: [
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
  ],

  satellite: [
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
  ],

  uav: [
    {
      title: 'Built to stay up, not to go fast',
      body: 'KESTREL is designed for loiter: it can circle over one spot for more than a day while its sensors watch the ground. Almost every design choice — the long wing, the pusher turboprop, the slim fuselage — follows from that.',
      key: 'Endurance scales with (η/c)·(C_L^1.5 / C_D): efficiency, not speed.',
    },
    {
      title: 'A long, thin wing',
      body: 'Induced drag — the cost of making lift — falls as span grows. At aspect ratio 16.8 this wing reaches a lift-to-drag ratio near 20 at loiter speed. Pressure view shows the suction peak spread along the span.',
      key: 'Induced drag C_Di = C_L² / (π e AR).',
      mode: 'pressure', focus: ['Starboard wing', 'Port wing', 'Y-tail & ruddervators'], view: { dir: [0.3, 1, 0.6], fill: 1.1 },
    },
    {
      title: 'Pusher turboprop',
      body: 'Mounting the propeller at the back keeps the nose clear for sensors and the satellite dish. A turboprop is most efficient at moderate speed: the propeller turns about 80 % of the shaft power into thrust.',
      key: 'Power required P = D · V / η_prop; best endurance comes at the minimum-power speed.',
      focus: ['Turboprop & propeller'], view: { dir: [-1, 0.4, 0.8] },
    },
    {
      title: 'The sensor turret',
      body: 'A gyro-stabilised ball carries daylight and infrared cameras and a laser that both measures range and marks targets for guided weapons. Stabilisation keeps the image steady from kilometres away while the aircraft bumps through air.',
      key: 'The laser pulses at a coded rate so a weapon only follows its own spot.',
      focus: ['EO/IR sensor turret'], view: { dir: [1, -0.2, 0.7] }, demo: 'laser',
    },
    {
      title: 'Flying from another continent',
      body: 'Beyond radio line-of-sight the aircraft is flown through a geostationary satellite, via the Ku-band dish in the nose bulge. The round trip adds about 0.6 s of delay — too slow for a hand-flown landing, so take-off and landing use a local line-of-sight link.',
      key: 'Up to GEO and back: 4 × 35,786 km ÷ c ≈ 0.48 s, plus processing.',
      focus: ['Ku-band satcom antenna', 'Satcom radome'], mode: 'xray', view: { dir: [1, 0.5, 0.6] },
    },
    {
      title: 'Payload on the wings',
      body: 'Four hardpoints carry guided weapons or sensor pods. Every kilogram of stores is a kilogram of fuel left behind, so mission planners trade payload against time on station — try it in the endurance lab.',
      key: 'MTOW 4,760 kg = empty 2,223 kg + fuel + payload.',
      focus: ['Starboard stores', 'Port stores'], view: { dir: [0.6, -0.4, 1] },
    },
  ],
};
