// Guided tour: GPS III. See ../tours.js for the step format. Camera directions are written in the
// satellite's body frame (x Sun side, y array axis, z toward the Earth) and turned into world
// directions for whichever display orientation is current: nadir up in the hangar and showroom,
// nadir toward the Earth (pitched toward the viewer) in the 'orbit' look.

import { displayDir, DISPLAY } from '../../models/satellite.js';

/** dir: body-frame camera direction (dirShow, if given, replaces it in the hangar and showroom);
 *  lift / liftOrbit raise the target (subject moves down the frame). */
const view = (dir, { fill, lift = 0, liftOrbit = lift, dirShow = dir } = {}) => ({
  get dir() { return displayDir(DISPLAY.orbit ? dir : dirShow); },
  get lift() { return DISPLAY.orbit ? liftOrbit : lift; },
  fill,
});

const range = (n) => Array.from({ length: n }, (_, k) => k + 1);
const EC = range(4).map((k) => `L-band helix, inner ${k}`).concat(range(8).map((k) => `L-band helix, outer ${k}`));
const MEC = range(4).map((k) => `M-code helix ${k}`);
const UHF = range(4).map((k) => `UHF crosslink element, inner ${k}`).concat(range(8).map((k) => `UHF crosslink element, outer ${k}`));
const JIB = range(8).map((k) => `JIB antenna ${k}`);
const CLOCKS = ['Rubidium atomic clock 1', 'Rubidium atomic clock 2', 'Rubidium atomic clock 3'];
const WINGS = ['+Y', '−Y'].flatMap((t) => [`Solar array drive (${t})`, `Array yoke (${t})`, `Frangibolt hold-downs (${t})`, `Root hinge (${t})`,
  `Panel hinge 1 (${t})`, `Panel hinge 2 (${t})`, `Panel hinge 3 (${t})`,
  `Solar panel 1 (${t}, inboard)`, `Solar panel 2 (${t}, middle)`, `Solar panel 3 (${t}, outboard)`]);
const CORNERS = ['+X+Y', '+X−Y', '−X+Y', '−X−Y'];
const THRUSTERS = CORNERS.flatMap((c) => [`Thruster cluster (${c})`, `22 N thruster (${c})`]);
const TANKS = ['Fuel tank (hydrazine)', 'Oxidiser tank (NTO)', 'Helium tank (A)', 'Helium tank (B)'];

export default [
  {
    title: 'How GPS finds you',
    body: 'A GPS receiver never transmits. It listens to satellites like this one, each broadcasting the time on its atomic clocks and its own position. Travel time multiplied by the speed of light gives the range to each satellite. Three ranges would fix a point in space, but a phone\'s clock is far too poor to time light, so its clock error is a fourth unknown: four satellites solve for x, y, z and time. GPS III is the newest generation of the roughly 31 operational GPS satellites, spread over six orbital planes tilted 55°.',
    key: 'Range = c × travel time. One nanosecond of timing error is 30 cm of range.',
    focus: ['L-band antenna panel', ...EC, 'Mission Data Unit', ...CLOCKS],
    view: view([1, 0.5, 0.32], { fill: 1.0 }),
  },
  {
    title: 'An antenna shaped like the Earth',
    body: 'Twelve tapered helices broadcast every navigation signal: four in the centre and a ring of eight, the layout Lockheed\'s patent drawing shows for the GPS III antenna deck. Twelve UHF crosslink elements are interleaved among them, and four extra M-code elements sit at one end. From 20,180 km the Earth is a disc only 27.8° across, so the array forms a beam just that wide. The ring is fed with a phase offset that pushes power toward the edge of the disc, where users are about 5,600 km farther away than a user directly below, so everyone gets nearly the same signal strength.',
    key: 'Earth\'s angular radius from GPS orbit: sin ρ = 6,378 km / 26,560 km, so ρ = 13.9°.',
    focus: ['L-band antenna panel', 'Beam-forming network', ...EC, ...MEC], view: view([0.45, 0.25, 1], { fill: 1.15 }),
  },
  {
    title: 'L1, L2, L5 and M-code',
    body: 'The Mission Data Unit generates the ranging codes and the navigation message. Four transmitters amplify them (L1, L2 and L5 for navigation; L3 for the detection system\'s data), and the output multiplexer filters and combines them onto the antenna. GPS III broadcasts the civil C/A signal, the new L1C (designed to be interoperable with Galileo\'s E1), L2C and the safety-of-life L5, plus the encrypted P(Y) and the jam-resistant military M-code. A receiver using two frequencies can measure and remove the ionosphere\'s delay, which depends on frequency.',
    key: 'Every signal is a multiple of 10.23 MHz: L1 = 154 ×, L2 = 120 ×, L5 = 115 ×, L3 = 135 ×.',
    focus: ['Mission Data Unit', 'L1 transmitter', 'L2 transmitter', 'L5 transmitter', 'L3 transmitter', 'L-band output multiplexer', 'L-band RF cables', 'Frequency synthesiser & distribution unit'],
    mode: 'xray', explode: 0.45, view: view([0.55, 0.85, 0.35], { fill: 1.25 }),
  },
  {
    title: 'Three atomic clocks',
    body: 'GPS is a clock in orbit. Each satellite carries three rubidium atomic frequency standards and a slot for a fourth, experimental one such as a hydrogen maser. Each locks a quartz oscillator to an atomic transition of rubidium-87 at 6.834 GHz and drifts only a few nanoseconds a day. One clock runs the payload while GPS III can run and monitor a second; the Space Force control segment measures the drift and uploads corrections, which the satellite broadcasts so receivers can remove it.',
    key: 'A clock 10 ns off puts a range 3 m off, so the clocks are the heart of the accuracy.',
    focus: [...CLOCKS, 'Fourth clock slot', 'Clock baseplate', 'Frequency synthesiser & distribution unit'], mode: 'xray', explode: 0.55, view: view([0.75, 0.75, 0.4], { fill: 1.2 }),
  },
  {
    title: 'Relativity: +38.6 µs a day',
    body: 'Up here, gravity is weaker, so by general relativity the clocks run faster than clocks on the ground by about 45.8 µs a day. The satellite\'s 3.87 km/s orbital speed slows them by about 7.2 µs a day (special relativity). The net gain is about 38.6 µs a day, which would add roughly 11.6 km of range error every day. So the clocks are set before launch to tick slightly slow: 10.22999999543 MHz instead of 10.23 MHz. The orbital-transfer lab computes this for any altitude.',
    key: 'Δf/f ≈ −4.46 × 10⁻¹⁰ (IS-GPS-200 gives −4.4647 × 10⁻¹⁰ for the nominal 26,560 km orbit radius).',
    focus: [...CLOCKS, 'Fourth clock slot'], mode: 'systems', explode: 0.55, view: view([0.75, 0.75, 0.4]),
  },
  {
    title: 'Crosslinks, telemetry and other passengers',
    body: 'UHF crosslinks carry data and measure the distances between satellites. Two S-band antennas, one facing the Earth and one facing away, carry commands, telemetry and ranging with the ground through a pair of uplink/downlink units. Eight spring-out "Jack-in-the-Box" monopoles form a further RF array. The satellite also hosts sensors of the US Nuclear Detonation Detection System, as GPS satellites have since 1980. SV09 and SV10 are the first GPS III satellites to carry a NASA laser retroreflector array of 48 corner cubes (two Block IIA satellites had one in the 1990s), so ground lasers can measure the orbit to millimetres.',
    key: 'Laser ranging: distance = c × round-trip time ÷ 2, good to a few millimetres.',
    focus: [...UHF, 'UHF feed network', 'Crosslink transponder (ECTS)', 'Thin communications unit', 'S-band antenna (Earth side)', 'S-band antenna (aft)', 'Uplink/downlink unit (A)', 'Uplink/downlink unit (B)', 'S-band RF cables',
      ...JIB, 'NDS optical sensors', 'NDS X-ray & dosimeter sensor', 'NDS processor', 'Laser retroreflector array'],
    explode: 0.3, view: view([0.7, 0.4, 0.9], { fill: 1.1 }),
  },
  {
    title: 'Power: two wings and two batteries',
    body: 'Two wings, shown here as three panels each, turn sunlight into 4,480 W even at the end of the 15-year design life. Radiation in the GPS orbit slowly degrades the cells, so the arrays are sized for the final year. For launch the panels fold flat against the radiators, and they stay folded through the apogee burns; only on station do the frangibolts release them. Twice a year the orbit passes through the Earth\'s shadow for up to about 56 minutes per orbit, and two batteries (nickel–hydrogen in the design papers) carry the whole satellite through it.',
    key: 'Eclipse: the Earth blocks 27.8° of the 360° orbit, so 7.7 % of 11 h 58 min ≈ 55 min.',
    focus: [...WINGS, 'Battery 1', 'Battery 2', 'Power regulation unit', 'Array drive electronics'], view: view([1, 0.35, 0.45], { fill: 1.0, dirShow: [1, -0.35, 0.45] }), demo: 'deploy',
  },
  {
    title: 'Pointing at the Earth, steering in yaw',
    body: 'Infrared Earth sensors keep the antennas on the centre of the Earth, coarse sun sensors find the Sun, Honeywell\'s fibre-optic gyro unit fills the gaps, and four reaction wheels make the turns, with magnetic torque rods for fine momentum control. The spacecraft yaws slowly about its Earth-pointing axis all orbit long, so the arrays\' rotation axis always stays perpendicular to the sunlight. Then the two array drives only need to turn the wings once per orbit.',
    key: 'The wings turn 360° per orbit, about 0.5° a minute; the wheels trade angular momentum instead of propellant.',
    focus: ['Reaction wheel 1', 'Reaction wheel 2', 'Reaction wheel 3', 'Reaction wheel 4', 'Reaction wheel drive electronics', 'Earth sensor (A)', 'Earth sensor (B)', 'Coarse sun sensors', 'Inertial measurement unit',
      'Magnetic torque rod (X)', 'Magnetic torque rod (Y)', 'Magnetic torque rod (Z)', 'On-board computer'],
    mode: 'systems', explode: 0.6, view: view([0.9, 0.6, 0.35], { liftOrbit: 0.2 }),
  },
  {
    title: 'Keeping cool and warm',
    body: 'Space has no air to carry heat away, so the only way to get rid of it is to radiate it. Because of yaw steering, the two ±Y faces never see the Sun, and they are the radiators: quartz mirror tiles reject sunlight but radiate infrared well, and ammonia heat pipes spread the electronics\' heat across them. Multi-layer blankets cover the rest of the bus, and heaters keep the hydrazine above its 2 °C freezing point. The Thermal view shows the sunlit face near 120 °C and the shadowed face below −100 °C.',
    key: 'Radiated power P = εσAT⁴: 1 m² of radiator at 20 °C with ε = 0.8 sheds about 330 W.',
    focus: ['Radiator panel (+Y)', 'Radiator panel (−Y)', 'Heat pipes (+Y radiator)', 'Heat pipes (−Y radiator)', 'Heaters & thermistors (+Y panel)', 'Heaters & thermistors (−Y panel)',
      'MLI blanket (+X)', 'MLI blanket (−X)', 'MLI blanket (Earth deck)', 'MLI blanket (aft deck)', 'Clock baseplate', 'Engine heat shield', 'Propulsion heaters & thermostats',
      'Solar panel 1 (+Y, inboard)', 'Solar panel 2 (+Y, middle)', 'Solar panel 3 (+Y, outboard)', 'Solar panel 1 (−Y, inboard)', 'Solar panel 2 (−Y, middle)', 'Solar panel 3 (−Y, outboard)'],
    mode: 'thermal', view: view([0.8, 0.75, 0.35]),
  },
  {
    title: 'Structure and propulsion',
    body: 'A carbon-fibre central cylinder carries the launch loads and holds the two composite propellant tanks (built by Orbital ATK) stacked inside it, hydrazine above and nitrogen tetroxide below (the order follows A2100 practice). Shear webs and honeycomb panels form the box around it. Helium from two pressure vessels passes isolation valves, a regulator and check valves, then pushes the propellants to the apogee engine (445 N class, an estimate), to 22 N thrusters for large manoeuvres and to 0.9 N thrusters for attitude and station-keeping. Hydrazine and NTO ignite on contact, so the engine needs no igniter and restarts reliably for every apogee burn.',
    key: 'Rocket equation: propellant = m₀ (1 − e^(−Δv / (I_sp g₀))).',
    focus: ['Central cylinder', ...TANKS, 'Pressurant control panel', 'Pyrotechnic isolation valves', 'Helium pressure regulator', 'Check valves', 'Helium pressurant lines', 'Fuel feed lines', 'Oxidiser feed line',
      'Thruster manifold', 'Latch valves & filter', 'Liquid apogee engine', 'Engine bipropellant valve', ...THRUSTERS, 'Launch-vehicle adapter ring'],
    mode: 'systems', explode: 0.8, view: view([0.9, 0.5, 0.3], { liftOrbit: 0.22 }),
  },
  {
    title: 'Getting to 20,180 km',
    body: 'Falcon 9 leaves GPS III in a transfer orbit already tilted to 55°, roughly 400 km by 20,200 km. At apogee the satellite fires its own engine, over several passes and with its wings still folded, to make the orbit circular. That takes about 1.4 km/s, roughly 1,330 of the 1,520 kg of propellant in the Space Force figures. Only then are the arrays and antennas deployed. The final orbit takes 11 h 58 min, half a sidereal day, so the satellite passes over the same ground track every day. Try it in the orbital-transfer lab, then open the orbit view and fly the transfer.',
    key: 'Circularising at apogee: Δv = v_circ − v_apogee = 3.87 − 2.47 ≈ 1.40 km/s.',
    focus: ['Liquid apogee engine', 'Engine bipropellant valve', 'Fuel tank (hydrazine)', 'Oxidiser tank (NTO)', 'Engine heat shield'], mode: 'xray', explode: 0.35, view: view([1, 0.3, -0.6], { liftOrbit: 0.15 }),
  },
];
