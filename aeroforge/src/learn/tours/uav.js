// Guided tour: General Atomics MQ-9A Reaper. See ../tours.js for the step format.

const WING = ['Wing skin (starboard)', 'Wing skin (port)', 'Flap (starboard)', 'Flap (port)', 'Aileron (starboard)', 'Aileron (port)'];
const WING_BOX = ['Main spar (starboard)', 'Main spar (port)', 'Rear spar (starboard)', 'Rear spar (port)', 'Wing ribs (starboard)', 'Wing ribs (port)', 'Wing carry-through box', 'Wing fuel tank (starboard)', 'Wing fuel tank (port)'];
const ENGINE = ['TPE331 turbine section', 'TPE331 compressor section', 'Propeller reduction gearbox', 'Propeller drive shaft', 'Engine air inlet & plenum', 'Exhaust stacks', 'Oil cooler & scoop', 'Oil tank', 'DEEC engine control', 'Fuel control unit', 'Propeller governor', 'Ignition exciter', 'Starter-generator', 'Backup generator', 'Engine mount truss', 'Firewall'];
const AVIONICS = ['Flight control computers', 'Mission computer', 'Embedded GPS/INS', 'Air data computer', 'IFF transponder', 'C-band datalink transceiver', 'ARC-210 V/UHF radios', 'Ku-band SATCOM modem', 'Main batteries', 'MTS-B electronics unit', 'Lynx radar electronics', 'Avionics cooling system', 'Avionics shelf & nose-gear well'];
const FUEL = ['Wing fuel tank (starboard)', 'Wing fuel tank (port)', 'Fuselage fuel tank', 'Collector tank & boost pumps', 'Fuel lines & valves', 'Gravity refuel ports', 'Fuel vents'];
const STORES = ['Pylons (starboard)', 'Pylons (port)', 'Centreline station', 'GBU-12 Paveway II (starboard)', 'GBU-12 Paveway II (port)', 'M299 launcher (starboard)', 'M299 launcher (port)', 'AGM-114 Hellfire pair (starboard)', 'AGM-114 Hellfire pair (port)'];
const CONTROLS = ['Aileron (starboard)', 'Aileron (port)', 'Flap (starboard)', 'Flap (port)', 'Ruddervator (starboard)', 'Ruddervator (port)', 'Ventral rudder', 'Wing servos (starboard)', 'Wing servos (port)', 'Tail servos', 'Flight control computers'];

export default [
  {
    title: 'Built to stay up, not to go fast',
    body: 'The MQ-9A Reaper is an 11 m, 4.8-tonne aircraft designed to circle one area for a day or more while its sensors watch the ground. Almost everything you see follows from that: a 20 m wing, a fuel-sipping turboprop at the back, and a nose full of sensors and antennas instead of a cockpit.',
    key: 'For a propeller aircraft, endurance grows with η · C_L^1.5 / C_D: efficiency matters, speed does not.',
  },
  {
    title: 'A long, thin wing',
    body: 'Making lift leaves a wake of tip vortices whose drag falls as span grows. The Reaper’s wing has an aspect ratio near 17, closer to a glider’s than a fighter’s, so it reaches a lift-to-drag ratio around 20. Pressure view shows the suction (blue) spread along the whole span.',
    key: 'Induced drag C_Di = C_L² / (π e AR): double the aspect ratio, halve the induced drag.',
    mode: 'pressure', focus: WING, view: { dir: [0.25, 1, 0.55], fill: 1.05 },
  },
  {
    title: 'Inside the wing',
    body: 'Two carbon-composite spars, ribs and the skins form a torsion box, bolted to a carry-through box in the fuselage so the wings can come off for shipping. Fuel lives inside the box between the spars, right where the lift is, so the heaviest load is carried with the least bending.',
    key: 'Fuel in the wing relieves bending: the root moment depends on lift minus the weight carried outboard.',
    mode: 'systems', focus: WING_BOX, view: { dir: [0.2, 1, 0.5], fill: 1.05 },
  },
  {
    title: 'A turboprop at the back',
    body: 'A Honeywell TPE331-10GD makes up to 900 shp (671 kW). Air enters behind the gearbox, is squeezed by two centrifugal compressors, burns in a reverse-flow combustor and drives a three-stage turbine. Because the gearbox faces aft in this pusher, the exhaust leaves forward through two side stacks.',
    key: 'Power required P = D · V / η_prop. At loiter the Reaper needs only about 150 kW of its 671 kW.',
    mode: 'xray', focus: ENGINE, view: { dir: [0.35, 0.55, 1], fill: 1.0 },
  },
  {
    title: 'Three blades, pushing',
    body: 'The propeller sits behind the tail, about 2.6 m across (estimate). A pusher keeps the nose free for sensors and the propeller out of the camera’s view. The ventral fin hangs below the propeller arc, so on an over-rotation the fin’s bumper touches the runway, not the blades.',
    key: 'A reduction gearbox of about 26:1 turns ≈ 41,700 engine rpm into ≈ 1,590 propeller rpm.',
    focus: ['Three-blade propeller', 'Propeller hub & pitch control', 'Spinner', 'Ventral fin', 'Tail bumper', 'Tail cone'], view: { dir: [-1, 0.25, 0.7], fill: 1.1 },
  },
  {
    title: 'Watching in colour and in heat: MTS-B',
    body: 'Under the chin, Raytheon’s Multi-Spectral Targeting System B combines infrared, daylight and short-wave-infrared cameras with a laser rangefinder/designator and a laser illuminator. Gyros stabilise the ball so the picture holds steady from many kilometres away while the aircraft bumps through the air.',
    key: 'A laser designator pulses in a set code; a laser-guided weapon steers only toward its own code.',
    focus: ['MTS-B EO/IR turret', 'MTS-B electronics unit'], view: { dir: [1, -0.25, 0.75] }, demo: 'laser',
  },
  {
    title: 'Seeing through cloud: Lynx radar',
    body: 'Cameras cannot see through cloud or smoke; radar can. The AN/APY-8 Lynx in the lower nose is a synthetic-aperture radar: it records echoes as the aircraft flies, then combines them as if the antenna were hundreds of metres long, giving photo-like ground images down to about 10 cm.',
    key: 'Cross-range resolution δ ≈ λR / (2L): a longer synthetic aperture L gives a sharper image at range R.',
    mode: 'xray', focus: ['AN/APY-8 Lynx SAR antenna', 'Lynx radar electronics', 'Lynx radome'], view: { dir: [0.9, 0.1, 1] },
  },
  {
    title: 'Flown from another continent',
    body: 'The bulge over the nose hides a Ku-band dish that tracks a geostationary satellite. Through it a pilot and a sensor operator, often thousands of kilometres away, fly the mission. The delay is too long for a hand-flown landing, so a crew at the airfield takes off and lands on a short-delay C-band line-of-sight link.',
    key: 'Up to geostationary orbit and back twice: 4 × 35,786 km ÷ c ≈ 0.48 s, before any processing.',
    mode: 'xray', focus: ['Ku-band SATCOM antenna', 'SATCOM radome', 'Ku-band SATCOM modem', 'C-band datalink transceiver', 'C-band LOS antennas'], view: { dir: [0.7, 0.45, 1] },
  },
  {
    title: 'The avionics bay',
    body: 'Behind the sensors sit the computers that fly the aircraft: redundant flight control computers, two GPS/inertial units, air data, the mission computer, radios and an IFF transponder. GA-ASI describes the avionics as triple-redundant; nothing in it depends on one box working.',
    key: 'GPS corrects inertial drift; inertia keeps navigating when GPS is jammed.',
    mode: 'systems', explode: 0.35, focus: AVIONICS, view: { dir: [0.55, 0.9, 0.8] },
  },
  {
    title: 'Fuel and time on station',
    body: 'About 1,800 kg of JP-8 fills the wing bays, a fuselage tank at the centre of gravity and a small collector that always feeds the engine. That fuel is what buys the 27 hours; open the Mission endurance lab and see how much transit distance and stores cost in hours over the target.',
    key: 'Breguet endurance E = (η / c) · (L/D) · (1/V) · ln(W₀ / W₁).',
    mode: 'systems', focus: FUEL, view: { dir: [0.35, 1, 0.6], fill: 1.05 },
  },
  {
    title: 'Seven stations',
    body: 'Six under-wing pylons and a centreline station carry up to 1,361 kg of stores. Shown: a GBU-12 laser-guided bomb on each inboard station and two Hellfire missiles on each middle station. Every kilogram of stores is a kilogram of fuel not carried, and every pylon adds drag.',
    key: 'MTOW 4,760 kg = empty 2,223 kg + fuel + payload: weight is the currency of the mission.',
    explode: 0.25, focus: STORES, view: { dir: [0.6, 0.14, 1], fill: 0.85 },
  },
  {
    title: 'Wheels and control surfaces',
    body: 'Trailing-arm main legs and a steerable nose leg retract into the fuselage. Electric servos drive the ailerons, flaps, the two ruddervators and the ventral rudder. Watch the demonstration: roll, then pitch, then yaw, the ruddervators moving together for pitch and apart for yaw.',
    key: 'Ruddervator mixing: δ_left,right = δ_pitch ± δ_yaw.',
    focus: [...CONTROLS, 'Main gear leg (starboard)', 'Main gear leg (port)', 'Nose landing gear'], view: { dir: [-0.8, 0.6, 1] }, demo: 'surfaces',
  },
];
