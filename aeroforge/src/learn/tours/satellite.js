// Guided tour: GPS III. See ../tours.js for the step format. Camera directions are written for the
// hangar orientation (Earth deck up, arrays along world X) and mapped to the 'orbit' look, where the
// satellite hangs with its antennas toward the Earth.

import { viewDir } from '../../models/satellite.js';

const view = (dir, extra = {}) => ({ get dir() { return viewDir(dir); }, ...extra });

const HELICES = [1, 2, 3, 4].map((k) => `L-band helix, inner ${k}`).concat([1, 2, 3, 4, 5, 6, 7, 8].map((k) => `L-band helix, outer ${k}`));
const CLOCKS = ['Rubidium atomic clock 1', 'Rubidium atomic clock 2', 'Rubidium atomic clock 3'];
const WINGS = ['+Y', '−Y'].flatMap((t) => [`Solar array drive (${t})`, `Array yoke (${t})`, `Hold-down & release mechanisms (${t})`,
  `Solar panel 1 (${t}, inboard)`, `Solar panel 2 (${t}, middle)`, `Solar panel 3 (${t}, outboard)`]);
const THRUSTERS = ['+X+Y', '+X−Y', '−X+Y', '−X−Y'].map((c) => `Thruster cluster (${c})`);

export default [
  {
    title: 'How GPS finds you',
    body: 'A GPS receiver never transmits. It listens to satellites like this one, each broadcasting the time on its atomic clocks and its own position. Travel time multiplied by the speed of light gives the range to each satellite. Three ranges would fix a point in space, but a phone\'s clock is far too poor to time light, so its clock error is a fourth unknown: four satellites solve for x, y, z and time. GPS III is the newest generation of the roughly 31 operational GPS satellites, spread over six orbital planes tilted 55°.',
    key: 'Range = c × travel time. One nanosecond of timing error is 30 cm of range.',
    view: view([0.5, 0.32, 1], { fill: 1.0 }),
  },
  {
    title: 'An antenna shaped like the Earth',
    body: 'Twelve helical antennas in two rings broadcast every signal. From 20,180 km the Earth is a disc only 27.8° across, so the array forms a beam just that wide. The outer ring is fed with a phase offset that pushes power toward the edge of the disc, where users are about 5,600 km farther away than a user directly below, so everyone gets nearly the same signal strength.',
    key: 'Earth\'s angular radius from GPS orbit: sin ρ = 6,378 km / 26,560 km, so ρ = 13.9°.',
    focus: ['L-band antenna panel', 'Beam-forming network', ...HELICES], view: view([0.35, 0.6, 1], { fill: 1.15 }),
  },
  {
    title: 'L1, L2, L5 and M-code',
    body: 'The Mission Data Unit generates the ranging codes and the navigation message, three transmitters amplify them and a multiplexer combines them onto the antenna. GPS III broadcasts the civil C/A and L1C signals (L1C is shared with Galileo), L2C and the safety-of-life L5, plus the encrypted P(Y) and the jam-resistant military M-code. A receiver using two frequencies can measure and remove the ionosphere\'s delay, which depends on frequency.',
    key: 'Every signal is a multiple of 10.23 MHz: L1 = 154 ×, L2 = 120 ×, L5 = 115 ×.',
    focus: ['Mission Data Unit', 'L1 transmitter', 'L2 transmitter', 'L5 transmitter', 'L-band output multiplexer', 'Frequency synthesiser'],
    mode: 'xray', explode: 0.45, view: view([0.85, 0.35, 0.55]),
  },
  {
    title: 'Three atomic clocks',
    body: 'GPS is a clock in orbit. Each satellite carries three rubidium atomic frequency standards: one runs the payload and two are spares. Each locks a quartz oscillator to an atomic transition of rubidium-87 at 6.834 GHz and drifts only a few nanoseconds a day. The Space Force control segment measures that drift and uploads corrections, which the satellite broadcasts so receivers can remove it.',
    key: 'A clock 10 ns off puts a range 3 m off, so the clocks are the heart of the accuracy.',
    focus: [...CLOCKS, 'Clock baseplate', 'Frequency synthesiser'], mode: 'xray', explode: 0.55, view: view([0.75, 0.4, 0.75]),
  },
  {
    title: 'Relativity: +38.6 µs a day',
    body: 'Up here, gravity is weaker, so by general relativity the clocks run faster than clocks on the ground by about 45.8 µs a day. The satellite\'s 3.87 km/s orbital speed slows them by about 7.2 µs a day (special relativity). The net gain is about 38.6 µs a day, which would add roughly 11.6 km of range error every day. So the clocks are set before launch to tick slightly slow: 10.22999999543 MHz instead of 10.23 MHz. The orbital-transfer lab computes this for any altitude.',
    key: 'Δf/f = −4.465 × 10⁻¹⁰, so the clocks tick at 10.22999999543 MHz.',
    focus: CLOCKS, mode: 'systems', explode: 0.55, view: view([0.75, 0.4, 0.75]),
  },
  {
    title: 'Crosslinks, telemetry and other passengers',
    body: 'UHF crosslinks carry data and measure the distances between satellites. Two S-band antennas, one facing the Earth and one facing away, carry commands, telemetry and ranging with the ground. The satellite also hosts sensors of the US Nuclear Detonation Detection System, as GPS satellites have since the early 1980s. From SV09 on, a NASA laser retroreflector array of 48 corner cubes lets ground lasers measure the orbit to millimetres.',
    key: 'Laser ranging: distance = c × round-trip time ÷ 2, good to a few millimetres.',
    focus: ['UHF crosslink antenna', 'UHF crosslink transceiver', 'S-band antenna (Earth side)', 'S-band antenna (aft)', 'S-band transponder (A)', 'S-band transponder (B)', 'NDS sensor package', 'NDS processor', 'Laser retroreflector array'],
    explode: 0.3, view: view([0.45, 0.55, 1], { fill: 1.1 }),
  },
  {
    title: 'Power: two wings and two batteries',
    body: 'Two wings of three panels each turn sunlight into 4,480 W even at the end of the 15-year design life. Radiation in the GPS orbit slowly degrades the cells, so the arrays are sized for the final year. For launch the panels fold flat against the radiators. Twice a year the orbit passes through the Earth\'s shadow for up to about 56 minutes per orbit, and two nickel–hydrogen batteries carry the whole satellite through it.',
    key: 'Eclipse: the Earth blocks 27.8° of the 360° orbit, so 7.7 % of 11 h 58 min ≈ 55 min.',
    focus: [...WINGS, 'Battery 1', 'Battery 2', 'Power regulation unit'], view: view([0.35, 0.45, 1], { fill: 1.0 }), demo: 'deploy',
  },
  {
    title: 'Pointing at the Earth, steering in yaw',
    body: 'Infrared Earth sensors keep the antennas on the centre of the Earth, Sun sensors track the Sun, gyros fill the gaps, and four reaction wheels make the turns. The spacecraft yaws slowly about its Earth-pointing axis all orbit long, so the arrays\' rotation axis always stays perpendicular to the sunlight. Then the two array drives only need to turn the wings once per orbit.',
    key: 'The wings turn 360° per orbit, about 0.5° a minute; the wheels trade angular momentum instead of propellant.',
    focus: ['Reaction wheel 1', 'Reaction wheel 2', 'Reaction wheel 3', 'Reaction wheel 4', 'Earth sensor (A)', 'Earth sensor (B)', 'Sun sensors', 'Inertial reference unit', 'Spacecraft control processor', 'Wheel & thruster drive electronics'],
    mode: 'systems', explode: 0.6, view: view([0.6, 0.35, 0.9]),
  },
  {
    title: 'Keeping cool and warm',
    body: 'Space has no air to carry heat away, so the only way to get rid of it is to radiate it. Because of yaw steering, the two ±Y faces never see the Sun, and they are the radiators: quartz mirror tiles reject sunlight but radiate infrared well, and ammonia heat pipes spread the electronics\' heat across them. Multi-layer blankets cover the rest of the bus, and heaters keep the hydrazine above its 2 °C freezing point. The Thermal view shows the sunlit face near 120 °C and the shadowed face below −100 °C.',
    key: 'Radiated power P = εσAT⁴: 1 m² of radiator at 20 °C with ε = 0.8 sheds about 330 W.',
    mode: 'thermal', view: view([0.75, 0.35, 0.8]),
  },
  {
    title: 'Structure and propulsion',
    body: 'A carbon-fibre central cylinder carries the launch loads and holds the two propellant tanks stacked inside it, with hydrazine above and nitrogen tetroxide below. Shear webs and honeycomb panels form the box around it. Helium pushes the propellants to a 450 N-class apogee engine and to twelve small hydrazine thrusters. Hydrazine and NTO ignite on contact, so the engine needs no igniter and restarts reliably for every apogee burn.',
    key: 'Rocket equation: propellant = m₀ (1 − e^(−Δv / (I_sp g₀))).',
    focus: ['Central cylinder', 'Fuel tank (hydrazine)', 'Oxidiser tank (NTO)', 'Helium pressurant tank', 'Pressurant control panel', 'Propellant lines & valves', 'Liquid apogee engine', ...THRUSTERS, 'Launch-vehicle adapter ring'],
    mode: 'systems', explode: 0.8, view: view([0.65, 0.3, 0.9]),
  },
  {
    title: 'Getting to 20,180 km',
    body: 'Falcon 9 leaves GPS III in a transfer orbit already tilted to 55°, roughly 400 km by 20,200 km. At apogee the satellite fires its own engine, over several passes, to make the orbit circular. That takes about 1.4 km/s, roughly 1,400 of its 1,611 kg of propellant. The final orbit takes 11 h 58 min, half a sidereal day, so the satellite passes over the same ground track every day. Try it in the orbital-transfer lab, then open the orbit view and fly the transfer.',
    key: 'Circularising at apogee: Δv = v_circ − v_apogee = 3.87 − 2.47 ≈ 1.40 km/s.',
    focus: ['Liquid apogee engine', 'Fuel tank (hydrazine)', 'Oxidiser tank (NTO)', 'Engine heat shield'], mode: 'xray', explode: 0.35, view: view([0.6, 0.25, 1]),
  },
];
