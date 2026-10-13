// Guided tour: UH-60M Black Hawk. See ../tours.js for the step format.

const HEAD = ['Main rotor hub', 'Elastomeric bearings', 'Blade spindles & cuffs', 'Pitch horns', 'Pitch control rods', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Bifilar vibration absorber', 'Rotating swashplate', 'Stationary swashplate', 'Primary servos', 'Rotating scissors', 'Swashplate guide & stationary scissors', 'Main rotor shaft', 'Blade de-ice slip ring & distributor'];
const BLADES = ['Main rotor blade 1', 'Main rotor blade 2', 'Main rotor blade 3', 'Main rotor blade 4'];
const TAILROTOR = ['Tail rotor blades', 'Tail rotor hub & crossbeam spars', 'Tail rotor pitch-change beam & links', 'Tail rotor gearbox (90°)', 'Tail rotor servo'];

export default [
  {
    title: 'A rotor is a spinning wing',
    body: 'Each of the four blades is a long, thin wing flying in a circle at 258 rpm. Together they act like a disc 16.36 m across that pushes air downward: at maximum weight the disc shoves about 3.6 tonnes of air through itself every second at 14 m/s (twice that, 28 m/s, far below it), and the reaction is the lift. Watch the downwash contract below the disc and spread along the ground.',
    key: 'Momentum theory: T = 2ρA·v², so the ideal hover power is T^1.5 / √(2ρA). A big disc (low disc loading) hovers on less power.',
    focus: [...BLADES, 'Main rotor hub'], view: { dir: [1, 0.55, 1.1], fill: 1.0 }, demo: 'flow',
  },
  {
    title: 'Collective and cyclic: the swashplate',
    body: 'The pilot never touches a blade. Three primary servos move the stationary swashplate; the rotating swashplate above it follows, and four pitch rods pass the motion to the blades. Raise it evenly (collective) and every blade takes more pitch; tilt it (cyclic) and each blade\'s pitch rises and falls once per turn, so the disc tilts and the thrust leans with it. Watch the demo roll, pitch and yaw.',
    key: 'θ(ψ) = θ₀ + A₁ cos ψ + B₁ sin ψ. The disc responds a quarter-turn after the pitch change, so the linkage puts the input 90° ahead.',
    focus: [...HEAD], view: { dir: [1, 0.35, 0.9], fill: 1.25 }, demo: 'surfaces',
  },
  {
    title: 'The hub: why blades flap and lead-lag',
    body: 'In forward flight the advancing blade meets faster air than the retreating one. Rather than roll the aircraft, each blade flaps up where it makes extra lift and down where it makes less. Flapping moves its centre of mass in and out, so it also speeds up and slows down in the plane (Coriolis) — the lead-lag the hydraulic dampers restrain. One laminated elastomeric bearing per blade allows flap, lag and pitch with no hinge pins at all.',
    key: 'The hinge (bearing focal point) sits 0.381 m from the shaft: the offset lets the hub pass pitch and roll moments to the airframe for crisp control.',
    focus: ['Main rotor hub', 'Elastomeric bearings', 'Blade spindles & cuffs', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Pitch horns'], explode: 0.3, view: { dir: [0.8, 0.9, 1], fill: 1.3 },
  },
  {
    title: 'Taming four-per-rev vibration',
    body: 'Four blades sweep past any point four times a revolution, so the airframe is shaken at 4 × 4.3 = 17.2 Hz. The bifilar absorber on top of the hub carries four tuned masses that swing on pins in the rotor plane. Tuned to three cycles per revolution in the rotating hub, their motion cancels the forces that would arrive at the fuselage as four-per-rev.',
    key: 'An N-blade rotor passes only vibration at N/rev (and multiples) into the airframe: here 17.2 Hz.',
    focus: ['Bifilar vibration absorber', 'Main rotor hub', 'Blade de-ice slip ring & distributor'], view: { dir: [0.6, 0.7, 1], fill: 1.4 },
  },
  {
    title: 'Torque, and why the tail rotor is canted',
    body: 'Spinning the rotor counter-clockwise (seen from above) twists the fuselage the other way. The tail rotor, 9.93 m behind the shaft, pushes the tail to starboard to cancel it; the pedals change its pitch to turn. Its shaft is canted 20° up, so it also lifts the tail — about 3 % of the weight — which widens the centre-of-gravity range. The bearingless rotor flaps and changes pitch by bending and twisting its two composite crossbeam spars.',
    key: 'Hover at 9,979 kg: torque Q = P/Ω ≈ 70 kN·m, so the tail rotor needs Q / 9.93 m ≈ 7 kN of sideways thrust (≈ 9 % of the power).',
    focus: [...TAILROTOR, 'Tail pylon', 'Intermediate gearbox (42°)'], view: { dir: [-0.35, 0.3, 1], fill: 1.25 }, demo: 'surfaces',
  },
  {
    title: 'From turbines to rotors: the drive train',
    body: 'Each T700 drives forward at 20,900 rpm through an output shaft to an input module, where a freewheel clutch lets a failed engine drop out. The main module merges both inputs at a bevel ring gear and slows them in a planetary stage to 258 rpm. Off its back runs the tail drive shaft: past the rotor brake and oil-cooler blower, along the tail cone on hanger bearings, round the 42° and 90° gearboxes to the tail rotor at 1,190 rpm. Accessory modules keep generators and hydraulic pumps turning even in autorotation.',
    key: 'Overall reduction ≈ 81 : 1, limited to 3,400 shp through the main transmission.',
    focus: ['Main module (main transmission)', 'Input module (right)', 'Input module (left)', 'Accessory module (right)', 'Accessory module (left)', 'Engine output shaft (right)', 'Engine output shaft (left)', 'T700-GE-701D engine (right)', 'T700-GE-701D engine (left)', 'Rotor brake', 'Transmission oil cooler & blower', 'Tail drive shaft, forward sections', 'Tail drive shaft, tail cone sections', 'Viscous-damped hanger bearings', 'Intermediate gearbox (42°)', 'Tail drive shaft, pylon section', 'Tail rotor gearbox (90°)', 'Main rotor shaft'],
    mode: 'xray', view: { dir: [0.5, 1, 0.9], fill: 1.05 },
  },
  {
    title: 'Engines that eat sand and hide their heat',
    body: 'Thermal view. Swirl vanes in each T700\'s inlet particle separator fling sand outward into a scroll that is blown overboard, so the compressor breathes clean air in desert landings. Behind the engines the IR suppressors mix cool air into the hot exhaust and turn it outboard and upward: notice the suppressor ducts glow far less than the engine cores.',
    key: 'T700-GE-701D: 1,994 shp for 10 min, 1,716 shp continuous, 207 kg — about 9.6 shp per kilogram.',
    focus: ['T700-GE-701D engine (right)', 'T700-GE-701D engine (left)', 'Inlet particle separator (right)', 'Inlet particle separator (left)', 'Exhaust IR suppressor (right)', 'Exhaust IR suppressor (left)', 'Engine cowling (right)', 'Engine cowling (left)', 'Auxiliary power unit'],
    mode: 'thermal', view: { dir: [-0.6, 0.8, 1], fill: 1.15 },
  },
  {
    title: 'The stabilator',
    body: 'In the hover the rotor wake blasts straight down onto the tail. A fixed tailplane would be shoved down and pitch the nose up as the aircraft accelerates through the wake. So the whole stabilator pivots: computers park it about 40° trailing edge down at low speed, then flatten it as airspeed builds, where it gives the pitch stability a tailplane should. Set the airspeed slider in the lab and watch it move.',
    key: 'Schedule ≈ 40° trailing edge down below 30 kt → near level by 150 kt (plus corrections for collective, pitch rate and sideslip).',
    focus: ['Stabilator', 'Stabilator actuators', 'Tail pylon', 'Tail cone skin'], view: { dir: [-0.4, 0.25, 1], fill: 1.15 },
  },
  {
    title: 'Built to survive a crash',
    body: 'The Black Hawk was the first helicopter designed from the outset to crash-survival standards. In a hard impact the oleos\' crash stage and the drag beams absorb energy first, then the crushable belly; the cabin roof beams hold the gearbox up, and the pilots\' armoured seats and the hanging troop seats stroke downward to limit spinal loads. The two fuel cells survive a 20 m drop test, and breakaway valves seal every line that tears loose.',
    key: 'Design goal: a livable space and no post-crash fire in a vertical impact of about 11.6 m/s (38 ft/s).',
    focus: ['Main gear oleo (right)', 'Main gear oleo (left)', 'Main gear drag beam (right)', 'Main gear drag beam (left)', 'Keel beams & crushable belly', 'Cabin frames & roof beams', 'Armoured crashworthy pilot seats', 'Troop seats', 'Crew chief & gunner seats', 'Fuel cell (right)', 'Fuel cell (left)', 'Fuel lines & breakaway valves'],
    mode: 'systems', view: { dir: [0.8, 0.5, -1.2], fill: 1.0 },
  },
  {
    title: 'The glass cockpit',
    body: 'Two pilots sit side by side — the pilot in command on the right. Four multifunction displays replace the old round gauges; a dual flight-management system and a digital automatic flight control system hold attitude, heading, altitude and even a coupled hover. The cyclic tilts the disc, the collective at the left hand sets total thrust, and the pedals set tail-rotor pitch; the mixing unit behind the cockpit blends them so one input does not upset another.',
    key: 'Wire strikes kill low-flying crews: the cutters above and below the cockpit are part of the cockpit\'s design, not an add-on.',
    focus: ['Instrument panel & multifunction displays', 'Centre console & flight-management CDUs', 'Overhead console', 'Cyclic sticks', 'Collective levers', 'Tail rotor pedals', 'Armoured crashworthy pilot seats', 'Wire strike protection system', 'Mixing unit', 'Pilot-assist servos (SAS, trim, boost)'],
    mode: 'xray', view: { dir: [0.9, 0.6, 0.8], fill: 1.25 },
  },
  {
    title: 'The cabin: 11 troops or a 4-tonne sling load',
    body: 'The cabin is 3.84 m long, 2.21 m wide and 1.37 m high, with sliding doors on both sides so a squad can get out in seconds. Two crew chiefs ride at the front facing out, at window gun mounts. Under the floor, at the centre of gravity, the cargo hook carries up to 4,082 kg — a howitzer or a vehicle — so the load hardly disturbs the trim.',
    key: 'Maximum take-off 9,979 kg internal, 10,660 kg with a sling load; empty about 5,675 kg.',
    focus: ['Troop seats', 'Crew chief & gunner seats', 'Window gun mounts', 'Cabin door (right)', 'Cabin door (left)', 'Cabin floor', 'External cargo hook', 'Gunner window (right)', 'Gunner window (left)'],
    view: { dir: [0.7, 0.45, 1.2], fill: 1.15 }, demo: 'bay',
  },
];
