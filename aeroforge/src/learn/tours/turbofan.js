// Guided tour: GE Aerospace GE90-115B. See ../tours.js for the step format. Focus names are part
// names in src/models/turbofan.js and src/models/ge90/*.js (tests/turbofan.test.mjs checks them).
// Figures marked "modelled" come from the lab's cycle model at sea-level static take-off.

const range = (prefix, n, suffix = '') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}${suffix}`);

const BOOSTER = [...range('Booster rotor', 4), ...range('Booster stator', 3), 'Booster inlet guide vanes', 'Booster outlet guide vanes', 'Booster spool', 'Booster casing & splitter', 'Variable bleed valves', 'VBV actuators'];
const HPC = ['HPC variable inlet guide vanes', ...range('HPC rotor', 9), ...range('HPC variable stator', 3), 'HPC stator 4', 'HPC stator 5', 'HPC stator 6', 'HPC stator 7', 'HPC stator 8', 'HPC outlet guide vanes', 'HP compressor spool', 'HPC casing', 'VSV actuators & unison rings', 'Borescope ports (HP compressor)'];
const COMBUSTOR = ['Dual annular combustor', 'Combustor domes & swirl cups', 'Fuel nozzles', 'Fuel manifolds', 'Igniters', 'Igniter leads', 'Compressor rear frame', 'Borescope ports (combustor)'];
const HPT = ['HPT stage 1 nozzle', 'HPT stage 1 blades', 'HPT stage 2 nozzle', 'HPT stage 2 blades', 'HPT disks & cooling plates', 'HPT casing & shrouds', 'HPT active clearance control', 'Borescope ports (HP turbine)'];
const LPT = [...range('LPT stage', 6, ' blades'), ...range('LPT stage', 6, ' nozzle'), 'LP turbine rotor'];
const REVERSER = ['Thrust reverser translating sleeves', 'Thrust reverser cascades', 'Blocker doors & drag links', 'Thrust reverser actuators', 'Thrust reverser hinge & latch beams', 'Thrust reverser hydraulic lines', 'Thrust reverser synchronising shafts', 'Thrust reverser control valve module'];
const ACCESSORIES = ['Accessory gearbox', 'Inlet gearbox', 'Radial drive shaft', 'Transfer gearbox', 'Horizontal drive shaft', 'Air turbine starter', 'Starter air valve', 'Starter duct', 'Main fuel pump', 'Fuel filter & bypass indicator', 'Hydromechanical unit (HMU)', 'Lube & scavenge pump', 'Main oil filter', 'Scavenge oil filter', 'Air/oil separator (deoiler)', 'Integrated drive generator (IDG)', 'Backup generator (VSCF/PMG)', 'Engine-driven hydraulic pump', 'Permanent-magnet alternator', 'AGB hand-cranking pad', 'FADEC (electronic engine control)', 'Oil tank', 'Fuel/oil heat exchanger', 'IDG fuel/oil cooler', 'Hydraulic pump lines', 'IDG feeder cables'];

export default [
  {
    title: 'Two streams of air',
    body: 'At take-off the GE90-115B swallows about 1.5 tonnes of air a second, and only one kilogram in eight goes through the core. The fan pushes the other seven down the bypass duct and out of the fan nozzle at about 325 m/s. Accelerating a lot of air a little wastes less energy than accelerating a little air a lot, so the bypass stream makes about 82 % of the thrust (modelled).',
    key: 'Thrust F = ṁ_core·V₉ + ṁ_bypass·V₁₉ − ṁ·V₀, and propulsive efficiency η_p ≈ 2 / (1 + V_jet / V_flight).',
    focus: ['Fan blades', 'Fan outlet guide vanes', 'Booster casing & splitter', 'Inlet cowl', 'Core cowl & bifurcations', 'Thrust reverser translating sleeves', 'Core exhaust nozzle', 'Centre plug', 'Spinner'],
    view: { dir: [0.9, 0.35, 1.1] },
  },
  {
    title: 'The swept composite fan',
    body: '22 blades of carbon fibre in toughened epoxy, each about 1.2 m long and under 23 kg. They are swept — the leading edge bows forward at mid-span and back towards the tip — which weakens the shock waves on the supersonic outer span, so the fan is quieter and more efficient. A titanium sheath on every leading edge takes the bird, hail and sand strikes.',
    key: 'Tip speed U = πDN = π × 3.25 m × 2,355 rpm ÷ 60 ≈ 400 m/s — faster than sound, before even adding the inflow speed.',
    focus: ['Fan blades', 'Spinner', 'Fan disk'], view: { dir: [1, 0.25, 0.55] },
  },
  {
    title: 'Built to catch a blade',
    body: 'A fan blade that breaks off at full power carries about as much energy as a car at motorway speed. The thick forged-aluminium case round the fan has to stop it, and GE proved that by releasing a blade at take-off speed. (A Kevlar wrap was only a stop-gap while the 777-300ER was certified in 2003.) Behind the fan, outlet guide vanes take the swirl out of the bypass air.',
    key: 'Blade energy ½·m·(ωr)² ≈ ½ × 22 kg × (247 rad/s × 1 m)² ≈ 0.7 MJ — a 1.5-tonne car at 110 km/h.',
    focus: ['Fan containment case', 'Fan case rub strip & acoustic liners', 'Fan blades', 'Fan outlet guide vanes'], view: { dir: [0.7, 0.3, 1] },
  },
  {
    title: 'The booster and its bleed valves',
    body: 'Four booster stages on the fan shaft, with the fan hub, raise the core air\'s pressure about 2.3-fold (modelled). The -115B added the fourth stage, and dropped an HP-compressor stage, to push more air through a core of the same size. At low power or in rapid throttle changes the booster pumps more than the core can swallow, so bleed valves open and dump the excess into the bypass duct.',
    key: 'Stall margin: opening bleed lowers the booster\'s exit pressure and moves its operating point away from the surge line.',
    focus: BOOSTER, explode: 0.3, view: { dir: [0.55, 0.45, 1] },
  },
  {
    title: 'Nine stages to 42 : 1',
    body: 'The HP compressor turns at N2 — 9,332 rpm at 100 %, four times fan speed — and multiplies the pressure about 18-fold, to 42 times ambient overall. The inlet guide vanes and first stator rows are variable: unison rings swing every vane of a row at once, and at low speed the FADEC closes them so the front stages do not stall. Here the stator casing is lifted off the rotor.',
    key: 'Nine stages of ≈ 1.38 : 1 each: 1.38⁹ ≈ 18. Ideal compression heating T₃/T₂₅ = (p₃/p₂₅)^((γ−1)/γ).',
    focus: HPC, explode: 0.45, view: { dir: [0.35, 0.55, 1] },
  },
  {
    title: 'Burning at 42 atmospheres',
    body: 'Air leaves the compressor at about 920 K and 4.2 MPa (modelled). Fuel nozzles feed two rings of swirl cups: the outer pilot ring burns alone at idle for low smoke, and the inner main ring joins at high power, keeping the flame lean and short to limit NOx. About 4.6 kg of fuel a second (ICAO databank) heats the gas to about 1,740 K. Thermal view shows where the heat is.',
    key: 'Burner energy balance: f = c̄_p·(T₄ − T₃) / (η_b·LHV − c̄_p·(T₄ − 298 K)) ≈ 0.024, one kilogram of fuel per 41 kg of core air.',
    focus: COMBUSTOR, mode: 'thermal', view: { dir: [0.4, 0.6, 1] },
  },
  {
    title: 'Turbine blades above their melting point',
    body: 'The first HP turbine vanes and blades sit in gas at about 1,740 K (modelled), some 150 K above the roughly 1,600 K at which their nickel alloy melts. They survive as single crystals with no grain boundaries to creep along, under a ceramic coat, cooled by compressor air that leaves through rows of film-cooling holes. The two stages take about 100 MW to drive the compressor.',
    key: 'HP spool work balance: c_p,c·(T₃ − T₂₅) = η_m·(1 + f)·c_p,t·(T₄ − T₄₅).',
    focus: HPT, explode: 0.3, view: { dir: [0.5, 0.45, 1] },
  },
  {
    title: 'The LP turbine turns the fan',
    body: 'Six LP turbine stages take about 90 MW at take-off (modelled) and send it forward through the LP shaft, which runs inside the hollow HP spool to the fan 5 m away. Two spools let each turn at its best speed: the big fan at 2,355 rpm so its tips are not too supersonic, the small core four times faster. In this exploded Systems view the LP shaft slides out beside the core.',
    key: 'LP spool work balance, per kg of core air: c_p·[BPR·(T₁₃ − T₂) + (T₂₅ − T₂)] = η_m·(1 + f)·c_p,t·(T₄₅ − T₅).',
    focus: [...LPT, 'LP shaft', 'HP shaft & CDP seal drum', 'Centre vent tube', 'Fan disk', 'Fan blades', 'Booster spool', 'HP compressor spool', 'HPT disks & cooling plates'], mode: 'systems', explode: 0.5, view: { dir: [0.25, 0.45, 1], fill: 0.95 },
  },
  {
    title: 'The thrust reverser',
    body: 'On landing, six hydraulic actuators, geared together by flexible shafts, drive the two translating sleeves aft. Drag links pull the blocker doors down into the bypass duct, and the trapped fan air escapes forward through the uncovered cascade vanes. Only the fan stream is reversed; the core keeps pushing forward. The nacelle and reverser are Boeing\'s, seen here from outside the half that is kept.',
    key: 'Reverse thrust is momentum turned round: the fan stream\'s ṁ·V aimed forward pushes the aircraft back.',
    focus: [...REVERSER, 'Fan cowl doors'], demo: 'bay', view: { dir: [-0.25, 0.35, -1] },
  },
  {
    title: 'Accessories and the FADEC',
    body: 'A bevel gear on the HP shaft drives a radial shaft out through a fan-frame strut to gearboxes on the fan case. Each pad turns at its own ratio to N2: the 777\'s main generator at 0.7947 ×, its hydraulic pump at 0.3783 ×, the backup generator at 2.4126 ×, plus the fuel and oil pumps and the FADEC\'s alternator. To start, the air turbine drives the same path backwards.',
    key: 'The thrust lever only sets a target N1; the dual-channel FADEC meters fuel to hold it inside EGT, speed and pressure limits.',
    focus: ACCESSORIES, mode: 'systems', view: { dir: [0.55, -0.05, 1] },
  },
  {
    title: 'Follow the flow',
    body: 'Station planes carry the SAE numbering used in every engine manual: 2 fan face, 13 fan exit, 25 HPC inlet, 3 HPC exit, 4 combustor exit, 45 LPT inlet (where EGT is measured), 5 LPT exit, 9 and 19 the core and fan nozzles. Labels show the lab\'s live temperature and pressure; bypass particles stay cool while the core gas glows. Try the cruise preset.',
    key: 'Ideal Brayton efficiency η = 1 − (p₀/p₃)^((γ−1)/γ): about 66 % at a pressure ratio of 42.',
    demo: 'flow', view: { dir: [0.18, 0.2, 1], fill: 1.05, lift: 0.32 },
  },
];
