// Guided tour: fighter. See ../tours.js for the step format.

export default [
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
];
