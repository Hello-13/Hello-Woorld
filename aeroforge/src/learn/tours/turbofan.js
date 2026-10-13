// Guided tour: GE Aerospace GE90-115B. See ../tours.js for the step format. Focus names are part
// names in src/models/turbofan.js and src/models/ge90/*.js (tests/turbofan.test.mjs checks them).
// Figures marked "modelled" come from the lab's cycle model at sea-level static take-off.

const range = (prefix, n, suffix = '') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}${suffix}`);

const BOOSTER = [...range('Booster rotor', 4), ...range('Booster stator', 3), 'Booster inlet guide vanes', 'Booster outlet guide vanes', 'Booster spool', 'Booster casing & splitter', 'Variable bleed valves'];
const HPC = ['HPC variable inlet guide vanes', ...range('HPC rotor', 9), ...range('HPC variable stator', 3), 'HPC stator 4', 'HPC stator 5', 'HPC stator 6', 'HPC stator 7', 'HPC stator 8', 'HPC outlet guide vanes', 'HP compressor spool', 'HPC casing', 'VSV actuators & unison rings'];
const COMBUSTOR = ['Dual annular combustor', 'Combustor domes & swirl cups', 'Fuel nozzles', 'Fuel manifolds', 'Igniters', 'Compressor rear frame'];
const HPT = ['HPT stage 1 nozzle', 'HPT stage 1 blades', 'HPT stage 2 nozzle', 'HPT stage 2 blades', 'HPT disks & cooling plates', 'HPT casing & shrouds', 'HPT active clearance control'];
const LPT = [...range('LPT stage', 6, ' blades'), ...range('LPT stage', 6, ' nozzle'), 'LP turbine rotor'];
const REVERSER = ['Thrust reverser translating sleeves', 'Thrust reverser cascades', 'Blocker doors & drag links', 'Thrust reverser actuators'];
const ACCESSORIES = ['Accessory gearbox', 'Inlet gearbox', 'Radial drive shaft', 'Transfer gearbox', 'Horizontal drive shaft', 'Air turbine starter', 'Main fuel pump', 'Hydromechanical unit (HMU)', 'Lube & scavenge pump', 'Integrated drive generator (IDG)', 'Engine-driven hydraulic pump', 'Permanent-magnet alternator', 'FADEC (electronic engine control)', 'Oil tank', 'Fuel/oil heat exchanger'];

export default [
  {
    title: 'Two streams of air',
    body: 'At take-off the GE90-115B swallows about 1.6 tonnes of air a second, and only about one kilogram in eight goes through the core. The other seven are pushed by the fan alone down the bypass duct and out of the fan nozzle at about 305 m/s. Accelerating a lot of air a little wastes less energy in the jet than accelerating a little air a lot, so the bypass stream makes roughly four fifths of the thrust (modelled).',
    key: 'Thrust F = ṁ_core·V₉ + ṁ_bypass·V₁₉ − ṁ·V₀, and propulsive efficiency η_p ≈ 2 / (1 + V_jet / V_flight).',
    focus: ['Fan blades', 'Fan outlet guide vanes', 'Booster casing & splitter', 'Inlet cowl', 'Core cowl & bifurcations', 'Thrust reverser translating sleeves', 'Core exhaust nozzle', 'Centre plug', 'Spinner'],
    view: { dir: [0.9, 0.35, 1.1] },
  },
  {
    title: 'The swept composite fan',
    body: '22 blades of carbon fibre in toughened epoxy, each about 1.2 m long and under 23 kg: light enough for a 3.25 m fan on a manageable disk. They are swept — the leading edge bows forward at mid-span and back towards the tip — which weakens the shock waves on the supersonic outer span, making the fan quieter and more efficient. A titanium sheath on every leading edge takes the bird, hail and sand strikes.',
    key: 'Tip speed U = πDN = π × 3.25 m × 2,355 rpm ÷ 60 ≈ 400 m/s — faster than sound, before even adding the inflow speed.',
    focus: ['Fan blades', 'Spinner', 'Fan disk'], view: { dir: [1, 0.25, 0.55] },
  },
  {
    title: 'Built to catch a blade',
    body: 'A fan blade that breaks off at full power carries about as much energy as a car at motorway speed. Many layers of Kevlar wound round the aluminium case stretch and hold it; to certify the engine, GE had to release a blade deliberately at take-off speed and show it stayed inside. Behind the fan, outlet guide vanes take the swirl out of the bypass air so it leaves straight.',
    key: 'Blade energy ½·m·(ωr)² ≈ ½ × 22 kg × (247 rad/s × 1 m)² ≈ 0.7 MJ — a 1.5-tonne car at 110 km/h.',
    focus: ['Fan containment case', 'Fan blades', 'Fan outlet guide vanes'], view: { dir: [0.7, 0.3, 1] },
  },
  {
    title: 'The booster and its bleed valves',
    body: 'Four booster stages on the fan shaft — the -115B added the fourth — supercharge the core air about 2.3-fold with the fan hub (modelled) before it turns down the gooseneck duct to the HP compressor. The booster always turns at fan speed while the core\'s needs change differently with power, so at low power or in rapid throttle changes the variable bleed valves open and dump booster air into the bypass duct to keep the booster from stalling.',
    key: 'Stall margin: opening bleed lowers the booster\'s exit pressure and moves its operating point away from the surge line.',
    focus: BOOSTER, explode: 0.3, view: { dir: [0.55, 0.45, 1] },
  },
  {
    title: 'Nine stages to 42 : 1',
    body: 'The HP compressor turns at N2 — 9,332 rpm at 100 %, four times fan speed — and multiplies the pressure about 18-fold, to 42 times ambient overall. The inlet guide vanes and the first stator rows are variable: unison rings swing every vane of a row at once. At low speed the front stages would otherwise meet the air at too steep an angle and stall, so the FADEC closes them; at high speed they open. Here the stator casing is lifted off the rotor.',
    key: 'Nine stages of ≈ 1.38 : 1 each: 1.38⁹ ≈ 18. Ideal compression heating T₃/T₂₅ = (p₃/p₂₅)^((γ−1)/γ).',
    focus: HPC, explode: 0.45, view: { dir: [0.35, 0.55, 1] },
  },
  {
    title: 'Burning at 42 atmospheres',
    body: 'Air leaves the compressor at about 930 K and 4.2 MPa (modelled). In the dual annular combustor, fuel nozzles feed two rings of swirl cups: the outer pilot ring burns alone at idle for low smoke and hydrocarbons, and the inner main ring joins at high power, keeping the flame lean and short to limit NOx. About 4.7 kg of kerosene a second heats the gas to about 1,680 K. Thermal view shows where the heat is.',
    key: 'Fuel–air ratio f = (c_p,t·T₄ − c_p,c·T₃) / (η_b·LHV − c_p,t·T₄) ≈ 0.025: one kilogram of fuel per 41 kg of core air.',
    focus: COMBUSTOR, mode: 'thermal', view: { dir: [0.4, 0.6, 1] },
  },
  {
    title: 'Turbine blades above their melting point',
    body: 'The first HP turbine vanes and blades sit in gas hotter than the roughly 1,600 K at which their nickel alloy melts. They survive because each is a single crystal with no grain boundaries to creep along, wrapped in a ceramic thermal-barrier coat and cooled from inside by compressor air that leaves through rows of tiny film-cooling holes. The two stages take about 100 MW from the gas (modelled) to drive the compressor.',
    key: 'HP spool work balance: c_p,c·(T₃ − T₂₅) = η_m·(1 + f)·c_p,t·(T₄ − T₄₅).',
    focus: HPT, explode: 0.3, view: { dir: [0.5, 0.45, 1] },
  },
  {
    title: 'The LP turbine turns the fan',
    body: 'Six LP turbine stages extract most of the remaining energy — about 90 MW at take-off (modelled) — and send it forward through the LP shaft, which runs inside the hollow HP spool to the fan 5 m away. Two spools let each turn at its best speed: the big fan at 2,355 rpm so its tips are not too supersonic, the small, highly loaded core four times faster. In X-ray you can follow both shafts.',
    key: 'LP spool work balance, per kg of core air: c_p·[BPR·(T₁₃ − T₂) + (T₂₅ − T₂)] = η_m·(1 + f)·c_p,t·(T₄₅ − T₅).',
    focus: [...LPT, 'LP shaft', 'HP shaft & CDP seal drum', 'Fan blades', 'Booster spool'], mode: 'xray', view: { dir: [0.2, 0.5, 1] },
  },
  {
    title: 'The thrust reverser',
    body: 'On landing, six hydraulic actuators drive the two translating sleeves aft. Drag links pull the blocker doors down into the bypass duct, and the trapped fan air escapes forward through the cascade vanes, which are now uncovered. Only the fan stream is reversed — the core keeps pushing forward — and the nacelle and reverser are Boeing\'s, not GE\'s.',
    key: 'Reverse thrust is momentum turned round: the fan stream\'s ṁ·V aimed forward pushes the aircraft back.',
    focus: REVERSER, demo: 'bay', view: { dir: [-0.35, 0.3, 1] },
  },
  {
    title: 'Accessories and the FADEC',
    body: 'A bevel gear on the HP shaft drives a radial shaft out through a fan-frame strut to gearboxes on the fan case. They power the fuel pump and hydromechanical unit, the oil pumps, the 777\'s generator and hydraulic pump, and the FADEC\'s own alternator; for starting, the air turbine starter drives the same path in reverse. The dual-channel FADEC reads the sensors and runs fuel, variable geometry and clearance control.',
    key: 'The thrust lever only sets a target N1; the FADEC meters fuel to hold it inside EGT, speed and pressure limits.',
    focus: ACCESSORIES, mode: 'systems', view: { dir: [0.55, -0.05, 1] },
  },
  {
    title: 'Follow the flow',
    body: 'Station planes carry the SAE numbering used in every engine manual: 2 fan face, 13 fan exit, 25 HPC inlet, 3 HPC exit, 4 combustor exit, 45 LPT inlet (where EGT is measured), 5 LPT exit, 9 and 19 the core and fan nozzles. Their labels show the lab\'s live temperature and pressure; bypass particles stay cool while the core gas glows after the combustor. Change throttle or altitude in the lab and watch them move.',
    key: 'Ideal Brayton efficiency η = 1 − (p₀/p₃)^((γ−1)/γ): about 66 % at a pressure ratio of 42.',
    demo: 'flow', view: { dir: [0.18, 0.2, 1], fill: 1.05, lift: 0.32 },
  },
];
