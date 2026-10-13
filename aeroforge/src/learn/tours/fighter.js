// Guided tour: Lockheed Martin / Boeing F-22A Raptor. See ../tours.js for the step format.
// Every focus name matches a part in src/models/f22/ exactly (tests/fighter.test.mjs checks it).
// Text is kept short (body ≈ 40 words, key idea ≈ 20) so each card fits without scrolling at 1280 × 800.
// Views were solved in the browser at 1280 × 800: no focused part falls under the tour card or the Systems /
// Thermal legend, and no callout dot lands on another callout's label (steps with right-side callouts look from the right).

const BOTH = (name) => [`${name} (right)`, `${name} (left)`];
// the outer mould line: skins, doors, moving surfaces, nozzles and the canopy
const EXTERIOR = [
  'Radome', 'Forward fuselage skin', 'Mid-fuselage upper skin', 'Intake trunk & lower fuselage skin', 'Aft fuselage upper skin', 'Aft fuselage lower skin',
  ...BOTH('Wing skin'), ...BOTH('Leading-edge flap'), ...BOTH('Flaperon'), ...BOTH('Aileron'), ...BOTH('Stabilator'), ...BOTH('Vertical tail'), ...BOTH('Rudder'),
  ...BOTH('Caret inlet cowl'), ...BOTH('Aft boom'), ...BOTH('Main bay door'), ...BOTH('Side bay door'), ...BOTH('Main gear door'), 'Nose gear doors',
  ...BOTH('Engine-change door'), ...BOTH('Countermeasure bay door'), 'Air-refuelling door', 'Gun-port door', 'Arresting hook door',
  ...BOTH('2-D vectoring nozzle'), 'Canopy',
];
const RIGHT_F119 = ['F119 fan', 'F119 HP compressor', 'F119 shafts & bearings', 'F119 annular combustor', 'F119 HP turbine', 'F119 LP turbine', 'F119 augmentor',
  '2-D vectoring nozzle', 'Accessory gearbox & AMAD', 'Engine fuel pump & metering unit', 'FADEC engine control', 'Ignition exciters & igniters'].map((n) => `${n} (right)`);

export default [
  {
    title: 'Shaped to beat radar',
    body: 'The F-22A was shaped first for a tiny radar cross-section. Seen from above, its wing and tail edges, nose chines, inlet lips and saw-toothed door edges all share a few angles, so reflections bunch into a few narrow spikes.',
    key: 'Detection range scales as σ^¼: a 10,000× smaller echo only cuts range 10×. Wing edges sweep 42° and −17°.',
    focus: EXTERIOR, mode: 'blueprint', view: { dir: [0, 1, 0.12], fill: 0.85 },
  },
  {
    title: 'Titanium and composites',
    body: 'About 40 % of the structural weight is titanium and a quarter composite. Machined titanium bulkheads carry the wings around the inlet ducts and weapons bay, the aft booms are electron-beam welded, and the wing boxes double as fuel tanks.',
    key: 'Ti-6Al-4V is as strong as many steels at 57 % of the density, and stays strong beside hot engines.',
    focus: [
      'Forward fuselage frames & bulkheads', 'Mid-fuselage titanium bulkheads', 'Engine-bay frames', 'Keel & weapons-bay longerons',
      'Upper longerons & canopy rails', ...BOTH('Aft boom'), ...BOTH('Wing box'), ...BOTH('Fin box'), ...BOTH('Stabilator torque box & spindle'),
    ],
    mode: 'systems', view: { dir: [0.5, 0.82, 0.29], fill: 0.8 },
  },
  {
    title: 'The AN/APG-77 radar',
    body: 'Behind a frequency-selective radome sits a fixed array of about 2,000 transmit/receive modules. Its beam is steered electronically, and the array is tilted back so its flat face never squares up to another radar. Liquid coolant carries away the heat.',
    key: 'Electronic steering moves the beam in microseconds; a mechanically scanned dish needs seconds.',
    focus: ['Radome', 'AN/APG-77 AESA array', 'APG-77 array mount & coolant manifold', 'APG-77 receiver / exciter & power supply', 'Common integrated processor (CIP 1)', 'Common integrated processor (CIP 2)'],
    mode: 'xray', explode: 0.3, view: { dir: [1, 0.35, 0.8] },
  },
  {
    title: 'Caret inlets, S-ducts',
    body: 'Each fixed caret inlet has two swept lips that make oblique shocks, slowing supersonic air with little loss, and a porous panel bleeds off the slow boundary layer. The duct then snakes up and inward for 7 m, hiding the fan from radar.',
    key: 'A single normal shock at Mach 2 wastes 28 % of total pressure; oblique shocks first recover over 90 %.',
    focus: ['Caret inlet cowl (right)', 'Inlet throat & boundary-layer bleed (right)', 'Serpentine inlet duct (right)', 'F119 fan (right)'],
    mode: 'xray', view: { dir: [0.58, 0.42, 0.69], fill: 0.9 },
  },
  {
    title: 'Inside the F119',
    body: 'Each F119-PW-100 is a twin-spool turbofan built for supercruise: three fan stages on one LP turbine stage, six compressor stages on one HP stage, the spools turning opposite ways. Its afterburner injects fuel from curved vanes that hide the turbine.',
    key: 'Thrust ≈ ṁ (V_exit − V_flight): 116 kN dry and 156 kN with afterburner, from a 2,270 kg engine.',
    focus: RIGHT_F119,
    mode: 'xray', explode: 0.8, view: { dir: [0.32, 0.34, 0.88], fill: 1.4 },
  },
  {
    title: 'Thrust vectoring',
    body: 'The two-dimensional nozzles swing the exhaust 20° up or down. When the jet is too slow or too nose-high for the stabilators to bite, thrust supplies the pitching moment, keeping the F-22 controllable beyond 60° angle of attack.',
    key: 'Moment = T·sinδ·arm: 20° on two 156 kN engines gives ≈ 107 kN at 7.5 m, ≈ 800 kN·m.',
    focus: [...BOTH('2-D vectoring nozzle'), ...BOTH('Nozzle actuators'), ...BOTH('Stabilator')],
    view: { dir: [-1, 0.25, 0.7] }, demo: 'tvc',
  },
  {
    title: 'Fly-by-wire controls',
    body: 'Leading-edge flaps, flaperons, ailerons, all-moving stabilators and rudders move on 4,000 psi hydraulic actuators, commanded by computers that keep the deliberately unstable airframe in check. There is no airbrake: the surfaces deflect against each other.',
    key: 'At 4,000 psi (27.6 MPa) a 5 cm piston pushes about 54 kN, a third more than at 3,000 psi.',
    focus: [...BOTH('Leading-edge flap'), ...BOTH('Flaperon'), ...BOTH('Aileron'), ...BOTH('Stabilator'), ...BOTH('Rudder'), ...BOTH('Leading-edge flap drive'),
      ...BOTH('Flaperon & aileron actuators'), ...BOTH('Stabilator actuator'), ...BOTH('Rudder actuator'), 'Vehicle management system computers', 'Hydraulic lines (system A)', 'Hydraulic lines (system B)'],
    mode: 'systems', view: { dir: [-0.37, 0.91, 0.21], fill: 0.9 }, demo: 'surfaces',
  },
  {
    title: 'Fuel is the heat sink',
    body: 'About 8,200 kg of fuel rides in fuselage tanks and the wing boxes. A stealthy jet has few cooling scoops, so avionics heat flows through a liquid PAO loop into the fuel, which carries it to the engines and burns.',
    key: 'Q = m c ΔT: warming 8,000 kg of fuel (c ≈ 2 kJ/kg·K) by 30 K absorbs about 480 MJ.',
    focus: ['Forward fuselage tank (F-1)', 'Centre fuselage tank (F-2)', 'Aft fuselage feed tank (F-3)', ...BOTH('Wing tank'), 'Fuel transfer pumps', 'Feed-tank boost pumps', 'Fuel transfer lines',
      ...BOTH('Engine feed line'), 'Air-refuelling receptacle', 'Refuelling manifold', 'Fuel–PAO heat exchangers', 'PAO liquid-cooling loop', 'PAO pump & reservoir'],
    mode: 'systems', view: { dir: [-0.5, 0.82, 0.29], fill: 0.8 },
  },
  {
    title: 'Heat is a signature',
    body: 'At Mach 2 and 12 km the air is −57 °C, yet compression heats the whole skin to about 100 °C (a little more at the radome and leading edges) and the nozzles glow far hotter: an infrared signature to hide.',
    key: 'Stagnation temperature T₀ = T (1 + 0.2 M²) ≈ 390 K at Mach 2; the skin recovers about 90 % of the rise.',
    focus: EXTERIOR, mode: 'thermal', view: { dir: [-0.56, 0.5, 0.66], fill: 1 }, demo: 'mach2',
  },
  {
    title: 'Landing gear',
    body: 'A steerable nose leg folds aft under the cockpit; two main legs fold up and aft into wells beneath the inlet ducts, their wheels turning flat. Folding braces lock each leg down, uplocks hold it up, and every door edge is serrated.',
    key: 'An oleo strut turns sink energy ½ m v² into heat: a 29 t jet landing at 3 m/s brings about 130 kJ.',
    focus: ['Nose gear shock strut', 'Nose-wheel steering unit', 'Nose gear torque links', 'Nose wheel & tyre', 'Nose gear drag brace & downlock', 'Nose gear retraction actuator', 'Nose gear doors',
      ...BOTH('Main gear shock strut'), ...BOTH('Main gear torque links'), ...BOTH('Main wheel & carbon brake'), ...BOTH('Main gear folding brace & downlock'),
      ...BOTH('Main gear retraction actuator'), ...BOTH('Main gear door'), ...BOTH('Main gear door actuator')],
    view: { dir: [1, 0.05, 0.8], fill: 0.8 },
  },
  {
    title: 'Weapons bays and gun',
    body: 'The main bay holds six AIM-120C AMRAAMs on LAU-142/A ejectors; each side bay swings an AIM-9X out on an LAU-141/A trapeze so its seeker sees the target first. An M61A2 20 mm cannon with 480 rounds sits in the right wing root.',
    key: 'External stores can multiply a stealth jet\'s radar cross-section many times over.',
    focus: ['Main weapons bay', ...BOTH('Main bay door'), 'AIM-120C AMRAAM ×3 (right main bay)', 'AIM-120C AMRAAM ×3 (left main bay)', ...BOTH('LAU-142/A AVEL launchers ×3'),
      'AIM-9X Sidewinder (right side bay)', 'AIM-9X Sidewinder (left side bay)', ...BOTH('LAU-141/A trapeze launcher'), ...BOTH('Side bay door'),
      ...BOTH('Countermeasure dispenser'), 'M61A2 20 mm cannon', 'Linear linkless ammunition system', 'Gun-port door'],
    view: { dir: [1, -0.12, 0.6], fill: 1.3 }, demo: 'bay',
  },
  {
    title: 'One pilot, fused sensors',
    body: 'One pilot sits on an ACES II zero-zero ejection seat under a frameless one-piece canopy, with the side-stick on the right and throttles on the left. A head-up display and six colour displays show one fused picture.',
    key: 'The canopy is 140 × 45 × 27 in (3.56 × 1.14 × 0.69 m) and 360 lb; its gold film reflects radar away.',
    focus: ['Canopy', 'Canopy sill frame & seals', 'Canopy actuator & jettison rockets', 'Cockpit tub & floor', 'Right console', 'Left console', 'Instrument panel & glare shield',
      'Rudder pedals', 'ACES II ejection seat', 'Pilot', 'Side-stick controller', 'Throttles', 'Head-up display', 'Integrated control panel & up-front displays',
      'Primary multifunction display', 'Secondary multifunction displays'],
    mode: 'xray', view: { dir: [0.8, 0.6, 1], fill: 0.9 },
  },
];
