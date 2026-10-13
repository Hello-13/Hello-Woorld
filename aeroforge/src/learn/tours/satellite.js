// Guided tour: GPS III. See ../tours.js for the step format. Camera directions are written in the
// satellite's body frame (x Sun side, y array axis, z toward the Earth) and turned into world
// directions for whichever display orientation is current: nadir up in the hangar and showroom,
// nadir toward the Earth (pitched toward the viewer) in the 'orbit' look. The +Y panel carries the
// navigation payload, the −Y panel the bus, network-communications and hosted-payload units.

import { displayDir, DISPLAY } from '../../models/gps3/display.js';

/** dir: body-frame camera direction (dirShow, if given, replaces it in the hangar and showroom);
 *  lift / liftOrbit raise the target (subject moves down the frame). */
const view = (dir, { fill, lift = 0, liftOrbit = lift, dirShow = dir } = {}) => ({
  get dir() { return displayDir(DISPLAY.orbit ? dir : dirShow); },
  get lift() { return DISPLAY.orbit ? liftOrbit : lift; },
  fill,
});

const range = (n) => Array.from({ length: n }, (_, k) => k + 1);
const both = (f) => ['+Y', '−Y'].flatMap(f);
const EC = range(4).map((k) => `L-band helix, inner ${k}`).concat(range(8).map((k) => `L-band helix, outer ${k}`));
const MEC = range(4).map((k) => `M-code helix ${k}`);
const UHF = range(4).map((k) => `UHF crosslink element, inner ${k}`).concat(range(8).map((k) => `UHF crosslink element, outer ${k}`));
const JIB = range(8).map((k) => `JIB antenna ${k}`);
const CLOCKS = ['Rubidium atomic clock 1', 'Rubidium atomic clock 2', 'Rubidium atomic clock 3', 'Digital rubidium clock (SV10)'];
const TX = ['L1 transmitter', 'L2 transmitter', 'L5 transmitter', 'L3 transmitter'];
const PANELS = both((t) => [`Solar panel 1 (${t}, inboard)`, `Solar panel 2 (${t}, outboard)`]);
const WINGS = both((t) => [`Solar array drive (${t})`, `Array yoke (${t})`, `Array harness (${t})`, `Frangibolt hold-downs (${t})`, `Root hinge (${t})`,
  `Panel hinge 1 (${t})`, `Panel hinge 2 (${t})`]).concat(PANELS);
const CORNERS = ['+X+Y', '+X−Y', '−X+Y', '−X−Y'];
const THRUSTERS = CORNERS.flatMap((c) => [`Thruster outrigger (${c})`, `Thruster cluster (${c})`, `22 N thruster (${c})`]);
const TANKS = ['Fuel tank (hydrazine)', 'Oxidiser tank (+X)', 'Oxidiser tank (−X)', 'Helium tank (+X)', 'Helium tank (−X)'];
const NCE = ['Crosslink transponder (ECTS A)', 'Crosslink transponder (ECTS B)', 'Thin communications unit (A)', 'Thin communications unit (B)', 'SUT (A)', 'SUT (B)', 'SSMA unit', 'STPX unit'];
const NDS = ['NDS optical sensor & sunshade', 'NDS X-ray & dosimeter sensor', 'HPE sensor', 'HPE S-band antenna', 'HPE receive antenna', ...range(4).map((k) => `NDS processor ${k}`)];

export default [
  {
    title: 'How GPS finds you',
    body: 'A GPS receiver never transmits. It listens to satellites like this one, each broadcasting the time on its atomic clocks and its own position. Travel time multiplied by the speed of light gives the range to each satellite. Three ranges would fix a point in space, but a phone\'s clock is far too poor to time light, so its clock error is a fourth unknown: four satellites solve for x, y, z and time. GPS III is the newest generation of the roughly 31 operational GPS satellites, spread over six orbital planes tilted 55°.',
    key: 'Range = c × travel time. One nanosecond of timing error is 30 cm of range.',
    focus: ['L-band antenna panel', ...EC, 'Mission Data Unit', ...CLOCKS.slice(0, 3)],
    view: view([1, 0.5, 0.32], { fill: 1.0 }),
  },
  {
    title: 'An antenna shaped like the Earth',
    body: 'Twelve black, tapered helices on the Earth deck broadcast every navigation signal: four in the centre and a ring of eight, the 4 + 8 layout of Lockheed\'s patent drawing for the GPS III antenna deck. Twelve white UHF crosslink elements are interleaved with them, and four M-code helices sit in a group at the −X end. From 20,180 km the Earth is a disc only 27.8° across, so the array forms a beam just that wide, with the ring fed a phase offset that pushes power toward the edge of the disc, where users are about 5,600 km farther away. SV01\'s published calibration puts the L1 phase centre 1.232 m above the centre of mass, and IGS orbit fits agreed with it to 2 mm.',
    key: 'Earth\'s angular radius from GPS orbit: sin ρ = 6,378 km / 26,560 km, so ρ = 13.9°.',
    focus: ['L-band antenna panel', 'Beam-forming network', ...EC, ...MEC], view: view([0.45, 0.25, 1], { fill: 1.15 }),
  },
  {
    title: 'The navigation payload panel',
    body: 'L3Harris\'s navigation payload fills the inner face of the +Y panel, laid out as Lockheed\'s expanded view shows. At the bottom, beside the clocks, the Mission Data Unit generates the ranging codes and the navigation message. Transmitters in the middle amplify them: L1, L2 and L5 for navigation, L3 for the detection system\'s data. At the top the multiplexer combines L1, L2 and L5 onto the antenna feed, while L3 passes through its own filter. The signals include the civil C/A, the new L1C (designed to be interoperable with Galileo\'s E1), L2C and the safety-of-life L5, plus the encrypted P(Y) and the jam-resistant military M-code. Two frequencies let a receiver measure and remove the ionosphere\'s delay, which scales with 1/f².',
    key: 'Every signal is a multiple of 10.23 MHz: L1 = 154 ×, L2 = 120 ×, L5 = 115 ×, L3 = 135 ×.',
    focus: ['Mission Data Unit', ...TX, 'L1/L2/L5 multiplexer', 'L3 filter', 'Signal filter (A)', 'Signal filter (B)', 'L-band RF cables', 'TFU (NPE panel)', 'Remote interface unit (NPE panel)'],
    mode: 'xray', explode: 0.45, view: view([0.55, 0.85, 0.35], { fill: 1.55 }),
  },
  {
    title: 'Three atomic clocks, and a slot for a fourth',
    body: 'GPS is a clock in orbit. Three rubidium atomic frequency standards sit on a temperature-controlled baseplate at the bottom of the payload panel, with a fourth position designed for new or experimental standards such as a hydrogen maser. Each locks a quartz oscillator to rubidium-87\'s 6.834 GHz hyperfine transition and drifts only a few nanoseconds a day. One clock drives the signals while GPS III can run and monitor a second, with redundant time-keeping loops, a first for GPS; short coaxial cables carry the reference to the Mission Data Unit. SV10, launched in April 2026, carries a demonstration Digital Rubidium Atomic Frequency Standard, shown here in the fourth slot (an inference).',
    key: 'A clock 10 ns off puts a range 3 m off, so the clocks are the heart of the accuracy.',
    focus: [...CLOCKS, 'Clock baseplate', 'Clock reference cables', 'Mission Data Unit'], mode: 'xray', explode: 0.55, view: view([0.75, 0.75, 0.4], { fill: 3.2 }),   // a small group: back off past the tour's 3-unit minimum to show the lower bus
  },
  {
    title: 'Relativity: +38.6 µs a day',
    body: 'Up here, gravity is weaker, so by general relativity the clocks run faster than clocks on the ground by about 45.8 µs a day. The satellite\'s 3.87 km/s orbital speed slows them by about 7.2 µs a day (special relativity). The net gain is about 38.6 µs a day, which would add roughly 11.6 km of range error every day. So the clocks are set before launch to tick slightly slow: 10.22999999543 MHz instead of 10.23 MHz. The orbital-transfer lab computes this for any altitude.',
    key: 'Δf/f ≈ −4.46 × 10⁻¹⁰ (IS-GPS-200 gives −4.4647 × 10⁻¹⁰ for the nominal 26,560 km orbit radius).',
    focus: [...CLOCKS, 'Clock baseplate'], mode: 'systems', explode: 0.55, view: view([0.75, 0.75, 0.4], { fill: 5.0 }),   // the clocks alone are a small group: frame them with the lower bus, as in step 4
  },
  {
    title: 'Crosslinks and talking to the ground',
    body: 'General Dynamics\' network communications element sits on the −Y panel: two UHF crosslink transponders (ECTS), two thin communications units, two SUTs, an SSMA and an STPX, chained in that order in Lockheed\'s block diagram (the paper does not expand the last three acronyms). The twelve white UHF elements on the Earth deck carry the crosslinks, which relay data and measure the distances between satellites. For commands and telemetry, two S-band uplink/downlink units reach the ground through a forward antenna on a mast about 1 m tall and an aft antenna facing away from the Earth, so the ground can reach the satellite in any attitude. Eight spring-out "Jack-in-the-Box" monopoles form a further RF array, and SV10 adds a Tesat laser terminal to try optical crosslinks ahead of GPS IIIF.',
    key: 'Crosslink ranging: distance = c × time; 40,000 km across the constellation takes light 0.13 s.',
    focus: [...NCE, ...UHF, 'UHF feed network', 'Uplink/downlink unit (A)', 'Uplink/downlink unit (B)', 'S-band RF cables', 'Forward TT&C S-band antenna', 'Aft TT&C S-band antenna',
      'Antenna mast (+X, −Y corner)', ...JIB, 'Optical communications terminal (SV10)'],
    mode: 'xray', explode: 0.3, view: view([0.75, -0.55, 0.6], { fill: 1.05 }),
  },
  {
    title: 'Passengers: the burst detector and a laser reflector',
    body: 'GPS satellites have carried sensors of the US Nuclear Detonation Detection System since 1980, in support of test-ban monitoring. On GPS III it is the Global Burst Detector, designed by Sandia and Los Alamos: its optical sensor looks out from under a white sunshade about 0.45 m tall at the −X/−Y corner of the Earth deck, other sensors and antennas stand elsewhere on the deck, and four processors sit on the −Y panel, reporting over the L3 link. That sunshade is the feature IGS analysts used to fix GPS III\'s body axes. SV09 and SV10 carry a NASA laser retroreflector of 48 corner cubes instead, so ground lasers can range the satellite to millimetres. The model shows a composite: the detector flew on SV01–SV08.',
    key: 'Laser ranging: distance = c × round-trip time ÷ 2, good to a few millimetres.',
    focus: [...NDS, 'Laser retroreflector array', 'L3 transmitter', 'L3 filter'],
    mode: 'xray', explode: 0.25, view: view([0.35, -0.75, 0.75], { fill: 1.1 }),
  },
  {
    title: 'Power: two wings and two batteries',
    body: 'Two wings of two panels each, 28.2 m² of ultra-triple-junction cells, deliver 4,480 W even at the end of the 15-year design life; radiation slowly damages the cells, so the array is sized for its last year. About 15 m tip to tip when open, each wing folds flat against a radiator for launch, held by eight frangibolts, and stays folded through the apogee burns. Follow the power: the panel harness crosses the hinges and runs down the yoke into the drive, whose slip rings pass it into the bus; the power harness carries it to the power regulation unit (SPRU) and the two nickel–hydrogen batteries on the −Y panel, which run the satellite through eclipses of up to about 56 minutes, twice a year.',
    key: 'Eclipse: the Earth blocks 27.8° of the 360° orbit, so 7.7 % of 11 h 58 min ≈ 55 min.',
    focus: [...WINGS, 'Battery 1', 'Battery 2', 'Power regulation unit (SPRU)', 'FBA unit', 'Array drive electronics', 'Power harness'],
    view: view([1, 0.35, 0.45], { fill: 1.0, dirShow: [1, -0.35, 0.45] }), demo: 'deploy',
  },
  {
    title: 'Pointing, yaw steering and the computer',
    body: 'Infrared Earth sensors keep the antennas on the centre of the Earth, four coarse sun-sensor heads near the aft corners find the Sun, and Honeywell\'s gyro unit carries attitude through eclipses and burns. Four Honeywell reaction wheels, grouped with the computer and the gyros on the −Y panel, make the turns; magnetic torque rods and the thrusters dump the momentum they build up. The spacecraft yaws slowly about its Earth-pointing axis all orbit, so the array axis stays perpendicular to the sunlight and each drive only has to turn its wing once per orbit. The on-board computer runs it all, reaching every unit through remote interface units and MIL-STD-1553B data buses.',
    key: 'The wings turn 360° per 718-minute orbit, about 0.5° a minute; the wheels trade angular momentum instead of propellant.',
    focus: ['Reaction wheel 1', 'Reaction wheel 2', 'Reaction wheel 3', 'Reaction wheel 4', 'Reaction wheel drive electronics', 'Inertial measurement unit', 'On-board computer',
      'Earth sensor (A)', 'Earth sensor (B)', 'Sun sensor detectors', 'Sun sensor electronics (A)', 'Sun sensor electronics (B)', 'Magnetic torque rod (X)', 'Magnetic torque rod (Y)', 'Magnetic torque rod (Z)',
      'Remote interface unit (A)', 'Remote interface unit (B)', 'Data harness (1553B)'],
    mode: 'systems', explode: 0.5, view: view([0.85, -0.65, 0.35], { liftOrbit: 0.2 }),
  },
  {
    title: 'Keeping cool and warm',
    body: 'Space has no air to carry heat away, so heat can only be radiated. Under yaw steering the two ±Y equipment panels never see the Sun, so they are the radiators: quartz mirror tiles absorb only about 8 % of sunlight but emit about 80 % of a black body\'s infrared, and ammonia heat pipes spread the boxes\' heat across them. Multi-layer blankets close the rest: silver on the Sun face and the antenna face, black on the shadow face and the aft end (the IGS box-wing model takes them to absorb 44 % and 94 % of sunlight). Heaters keep the hydrazine above its 2 °C freezing point. The Thermal view shows the sunlit face near 120 °C and the shadowed face below −100 °C.',
    key: 'Radiated power P = εσAT⁴: 1 m² of radiator at 20 °C with ε = 0.8 sheds about 330 W.',
    focus: ['NPE panel (+Y)', 'Bus/NCE/HPE panel (−Y)', 'Heat pipes (+Y panel)', 'Heat pipes (−Y panel)', 'Heaters & thermistors (+Y panel)', 'Heaters & thermistors (−Y panel)',
      'MLI blanket (+X)', 'MLI blanket (−X)', 'MLI blanket (Earth deck)', 'MLI blanket (aft deck)', 'MLI blanket (launch adapter)', 'Clock baseplate', 'Engine heat shield', 'Propulsion heaters & thermostats', ...PANELS],
    mode: 'thermal', view: view([0.8, 0.75, 0.35]),
  },
  {
    title: 'Structure and dual-mode propulsion',
    body: 'A box of composite panels (ATK, now Northrop Grumman) runs the full 3.4 m height and carries the launch loads into the separation ring. Inside it stands the A2100\'s one central hydrazine tank, 0.90 m across and 2 m long; the two nitrogen tetroxide tanks stand in the open bays of the ±X faces, between shear webs and closed only by insulation. Helium from two pressure vessels passes pyro isolation valves, a regulator and check valves to the tops of all three tanks. Hydrazine alone feeds the 22 N and 0.9 N thrusters on four outrigger brackets; with the oxidiser it feeds the apogee engine (100-lbf class; the A2100\'s LEROS 1c figures are used, 460 N and Isp 325 s). Hydrazine and NTO ignite on contact, so the engine needs no igniter.',
    key: 'Rocket equation: propellant = m₀ (1 − e^(−Δv / (I_sp g₀))).',
    focus: ['Core structure', 'Core frames & longerons', 'Shear web (+X, +Y side)', 'Shear web (+X, −Y side)', 'Shear web (−X, +Y side)', 'Shear web (−X, −Y side)', ...TANKS,
      'Pressurant control panel', 'Pyrotechnic isolation valves', 'Helium pressure regulator', 'Check valves', 'Pressure transducers', 'Helium pressurant lines', 'Fuel feed lines', 'Oxidiser feed lines',
      'Thruster manifold', 'Latch valves & filter', 'Liquid apogee engine', 'Engine bipropellant valve', 'Engine mount', ...THRUSTERS, 'Launch adapter section', 'Separation ring'],
    mode: 'systems', explode: 0.7, view: view([0.9, 0.5, 0.3], { liftOrbit: 0.22 }),
  },
  {
    title: 'Getting to 20,180 km',
    body: 'Falcon 9 leaves GPS III in a transfer orbit already tilted to 55°, roughly 400 km by 20,200 km. At apogee the satellite fires its own engine, over several passes and with its wings still folded, to make the orbit circular. That takes about 1.4 km/s: roughly 1,310 of the 1,520 kg of propellant in the Space Force figures, and about two and a half hours of firing in all at 460 N (estimate). Only then do the arrays and antennas deploy. The final orbit takes 11 h 58 min, half a sidereal day, so the satellite passes over the same ground track every day. Try it in the orbital-transfer lab, then open the orbit view and fly the transfer.',
    key: 'Circularising at apogee: Δv = v_circ − v_apogee = 3.87 − 2.47 ≈ 1.40 km/s.',
    focus: ['Liquid apogee engine', 'Engine bipropellant valve', 'Engine heat shield', 'Fuel tank (hydrazine)', 'Oxidiser tank (+X)', 'Oxidiser tank (−X)', 'Oxidiser feed lines', 'Fuel feed lines'],
    mode: 'xray', explode: 0.35, view: view([1, 0.3, -0.6], { liftOrbit: 0.15 }),
  },
];
