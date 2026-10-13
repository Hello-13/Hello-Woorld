// Guided tour: Lockheed Martin / Boeing F-22A Raptor. See ../tours.js for the step format.
// Every focus name matches a part in src/models/f22/ exactly (tests/fighter.test.mjs checks it).

const BOTH = (name) => [`${name} (right)`, `${name} (left)`];

export default [
  {
    title: 'Shaped to beat radar',
    body: 'The F-22A Raptor — built by Lockheed Martin with Boeing, 195 built (187 production jets), in service since 2005 — was shaped first for a tiny radar cross-section. Seen from above, every major edge (wing and stabilator leading and trailing edges, the nose chines, the inlet lips, even the saw-toothed door edges) runs at one of a few shared angles, so their reflections stack into a handful of narrow spikes and the directions in between stay quiet.',
    key: 'Radar detection range scales as σ^¼: a 10,000× smaller cross-section σ only cuts range 10×, so stealth must remove almost all of the echo. Wing edges: 42° leading, −17° trailing.',
    mode: 'blueprint', view: { dir: [0.05, 1, 0.12], fill: 0.85 },
  },
  {
    title: 'A titanium and composite airframe',
    body: 'About 40 % of the structural weight is titanium alloy and about a quarter is bismaleimide / epoxy composite. Heavy machined titanium bulkheads carry the wings around the inlet ducts and over the weapons bay; the aft booms beside the hot engines are titanium pieces joined by electron-beam welds instead of fasteners; multi-spar wing boxes double as fuel tanks.',
    key: 'Ti-6Al-4V is as strong as many steels at 57 % of the density, and keeps that strength at engine-bay temperatures that soften aluminium.',
    focus: [
      'Forward fuselage frames & bulkheads', 'Mid-fuselage titanium bulkheads', 'Engine-bay frames', 'Keel & weapons-bay longerons',
      'Upper longerons & canopy rails', ...BOTH('Aft boom'), ...BOTH('Wing box'), ...BOTH('Fin box'), ...BOTH('Stabilator torque box & spindle'),
    ],
    mode: 'systems', view: { dir: [0.55, 0.85, 1] },
  },
  {
    title: 'The AN/APG-77 radar',
    body: 'Behind a frequency-selective radome — transparent in the radar\'s own X band, reflective outside it — sits a fixed active array of roughly 2,000 thumb-sized transmit/receive modules. The beam is steered electronically and changes frequency more than 1,000 times a second to be hard to detect; and the array is tilted back so its flat face never squares up to another radar. Liquid coolant carries away the heat the modules make; the common integrated processors fuse its tracks with every other sensor.',
    key: 'Electronic steering moves the beam in microseconds; a mechanically scanned dish takes seconds to sweep its search volume.',
    focus: ['Radome', 'AN/APG-77 AESA array', 'APG-77 array mount & coolant manifold', 'APG-77 receiver / exciter & power supply', 'Common integrated processors'],
    mode: 'xray', explode: 0.3, view: { dir: [1, 0.35, 0.8] },
  },
  {
    title: 'Caret inlets and serpentine ducts',
    body: 'Each fixed caret inlet has two swept lips that make oblique shock waves, slowing supersonic air to about Mach 0.5 for the engine with little loss. A gap and a porous bleed panel peel off the slow boundary-layer air from the fuselage. Behind the lip the duct snakes up and inward for about 7 m, so no line of sight reaches the spinning fan — normally the brightest radar reflector on a jet.',
    key: 'Slowing Mach 2 air through a single normal shock wastes 28 % of its total pressure; oblique shocks ahead of a weak final shock recover over 90 %.',
    focus: ['Caret inlet cowl (right)', 'Inlet throat & boundary-layer bleed (right)', 'Serpentine inlet duct (right)', 'F119 fan (right)'],
    mode: 'xray', view: { dir: [1, 0.22, 0.85] },
  },
  {
    title: 'Inside the F119',
    body: 'Each Pratt & Whitney F119-PW-100 is a twin-spool turbofan built for supercruise: a three-stage fan of blisks driven by one LP turbine stage, a six-stage compressor driven by one HP stage, the two spools spinning in opposite directions. The low bypass ratio (0.30) and hot core give high thrust per kilogram of air. A three-zone augmentor injects fuel from curved, radar-absorbent vanes that also hide the turbine.',
    key: 'Thrust ≈ ṁ (V_exit − V_flight): about 116 kN dry and 156 kN with afterburner per engine, from a 2,270 kg engine with an overall pressure ratio near 26.',
    focus: ['F119 fan (right)', 'F119 HP compressor (right)', 'F119 annular combustor (right)', 'F119 HP turbine (right)', 'F119 LP turbine (right)', 'F119 augmentor (right)', '2-D vectoring nozzle (right)', 'Accessory gearbox & AMAD (right)', 'FADEC engine control (right)', 'Engine mounts (right)'],
    mode: 'systems', explode: 0.8, view: { dir: [0.15, 0.55, 1], fill: 1.45 },
  },
  {
    title: 'Thrust vectoring',
    body: 'The rectangular two-dimensional nozzles swing the exhaust up to 20° up or down. When the jet is too slow or too nose-high for the stabilators to bite, thrust itself provides the pitching moment — that is what keeps the F-22 controllable at trimmed angles of attack beyond 60°. The flat nozzle also spreads the plume so it mixes and cools faster, shrinking the infrared signature.',
    key: 'Pitching moment = T · sin δ · arm: 20° of vector on two 156 kN engines is a side force of about 107 kN acting some 7.5 m behind the centre of gravity — about 800 kN·m.',
    focus: [...BOTH('2-D vectoring nozzle'), ...BOTH('Stabilator')],
    view: { dir: [-1, 0.25, 0.7] }, demo: 'tvc',
  },
  {
    title: 'Fly-by-wire flight controls',
    body: 'Full-span leading-edge flaps, flaperons, ailerons, all-moving stabilators and rudders on the canted fins are all driven by 4,000 psi hydraulic actuators on command from the vehicle-management computers. The jet is unstable in pitch on purpose for agility, so the computers correct it many times a second; there is no separate airbrake — ailerons up, flaperons down and rudders splayed outward do the job.',
    key: 'Hydraulic force = pressure × piston area: at 4,000 psi (27.6 MPa) a 5 cm piston pushes about 54 kN, a third more than at the usual 3,000 psi.',
    focus: [...BOTH('Leading-edge flap'), ...BOTH('Flaperon'), ...BOTH('Aileron'), ...BOTH('Stabilator'), ...BOTH('Rudder'), ...BOTH('Wing control actuators'), ...BOTH('Stabilator actuator'), 'Vehicle management system computers'],
    view: { dir: [-0.6, 0.9, 0.8] }, demo: 'surfaces',
  },
  {
    title: 'Fuel is the heat sink',
    body: 'About 8,200 kg (18,000 lb) of JP-8 rides inside: tanks in the fuselage behind the cockpit and over the inlet ducts, a feed tank ahead of the engines, and the wing boxes themselves. A stealthy jet cannot have many cooling scoops, so the avionics\' heat goes into a liquid PAO loop and from there into the fuel, which carries it to the engines and burns. A boom receptacle on the spine refuels it in flight.',
    key: 'Heat absorbed Q = m c ΔT: warming 8,000 kg of fuel (c ≈ 2 kJ/kg·K) by 30 K soaks up about 480 MJ.',
    focus: ['Forward fuselage tank (F-1)', 'Centre fuselage tank (F-2)', 'Aft fuselage feed tank (F-3)', ...BOTH('Wing tank'), 'Fuel feed & transfer lines', 'Air-refuelling receptacle', 'Fuel–PAO heat exchangers', 'PAO liquid-cooling loop', 'Environmental control system'],
    mode: 'systems', view: { dir: [0.45, 1, 0.75] },
  },
  {
    title: 'Heat is a signature too',
    body: 'Thermal view at Mach 2 and 12 km: the air outside is about −57 °C, yet compression heats the radome and leading edges to around 100–115 °C, and the afterburning nozzles glow far hotter. Infrared search-and-track sensors look for exactly this, which is why the F-22 cruises supersonic without afterburner and why its exhaust is flattened and shielded.',
    key: 'Stagnation temperature T₀ = T (1 + 0.2 M²): at Mach 2 and 217 K that is ≈ 390 K.',
    mode: 'thermal', view: { dir: [-0.9, 0.5, 1] }, demo: 'mach2',
  },
  {
    title: 'Landing gear',
    body: 'A tricycle gear: a steerable single-wheel nose leg that retracts aft into a well under the cockpit, and two main legs that fold into wells beneath the inlet ducts, their wheels turning flat as they go. Each main wheel has a carbon brake, and every door edge is serrated like the weapons-bay doors. An emergency tail hook between the engines can catch a runway cable.',
    key: 'An oleo strut turns the sink energy ½ m v² into heat by forcing oil through an orifice: a 29 t jet touching down at 3 m/s (10 ft/s) brings about 130 kJ.',
    focus: ['Nose gear strut & steering', 'Nose wheel & tyre', 'Nose gear doors', ...BOTH('Main gear strut'), ...BOTH('Main gear drag brace & retraction actuator'), ...BOTH('Main wheel & carbon brake'), ...BOTH('Main gear door'), 'Arresting hook'],
    view: { dir: [0.9, 0.1, 1], fill: 0.8 },
  },
  {
    title: 'Weapons bays and the gun',
    body: 'The main bay holds six AIM-120C AMRAAMs on LAU-142/A launchers that push each missile clear of the bay\'s turbulent air in a fraction of a second; each side bay swings an AIM-9X out on an LAU-141/A trapeze so its seeker can see the target first. The doors are open for under a second per shot. An M61A2 20 mm cannon with 480 rounds sits in the right wing root behind a door that opens only while it fires.',
    key: 'External stores can multiply a stealth jet\'s radar cross-section many times over — carrying them inside is what keeps the shape clean.',
    focus: ['Main weapons bay', ...BOTH('Main bay door'), 'AIM-120C AMRAAM ×3 (right main bay)', 'AIM-120C AMRAAM ×3 (left main bay)', ...BOTH('LAU-142/A AVEL launchers ×3'), 'AIM-9X Sidewinder (right side bay)', 'AIM-9X Sidewinder (left side bay)', ...BOTH('LAU-141/A trapeze launcher'), ...BOTH('Side bay door'), 'M61A2 20 mm cannon', 'Linear linkless ammunition system', 'Gun-port door'],
    view: { dir: [0.45, -0.3, 1], fill: 1.25 }, demo: 'bay',
  },
  {
    title: 'One pilot, fused sensors',
    body: 'A single pilot sits on an ACES II zero-zero ejection seat under a frameless one-piece canopy, flying with a force-sensing side-stick on the right and twin throttles on the left. The head-up display and six colour displays show one fused tactical picture rather than raw radar returns. The canopy\'s thin gold indium-tin-oxide film conducts, so radar bounces off it instead of entering the cockpit.',
    key: 'The canopy is about 3.56 m long, 1.14 m wide and 0.69 m deep (140 × 45 × 27 in) and weighs 163 kg (360 lb) — one of the largest polycarbonate parts ever formed.',
    focus: ['Canopy', 'Canopy frame & actuator', 'Cockpit tub & consoles', 'ACES II ejection seat', 'Pilot', 'Side-stick controller', 'Throttles', 'HUD & up-front controls', 'Multifunction displays'],
    mode: 'xray', view: { dir: [0.8, 0.6, 1], fill: 0.9 },
  },
];
