// Guided tour: UH-60M Black Hawk. See ../tours.js for the step format.

const HEAD = ['Main rotor hub', 'Elastomeric bearings', 'Blade spindles & cuffs', 'Pitch horns', 'Pitch control rods', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Bifilar vibration absorber', 'Rotating swashplate', 'Stationary swashplate', 'Primary servos', 'Rotating scissors', 'Swashplate guide & stationary scissors', 'Main rotor shaft', 'Blade de-ice slip ring & distributor'];
const BLADES = ['Main rotor blade 1', 'Main rotor blade 2', 'Main rotor blade 3', 'Main rotor blade 4'];
const TAILROTOR = ['Tail rotor blades', 'Tail rotor hub & crossbeam spars', 'Tail rotor pitch-change beam & links', 'Tail rotor gearbox (90°)', 'Tail rotor servo'];
const T700 = (side) => ['T700 cold section', 'T700 hot section', 'T700 power turbine', 'T700 accessory section', 'T700 fuel control & pump', 'T700 DECU & ignition'].map((n) => `${n} (${side})`);
const GEARBOX = ['Main module (main transmission)', 'Main bevel gear & combining pinions', 'Planetary reduction stage', 'Main transmission lubrication & chip detectors'];

export default [
  {
    title: 'A rotor is a spinning wing',
    body: 'Each of the four blades is a long, thin wing flying in a circle at 258 rpm. Together they act like a disc 16.36 m across that pushes air downward: at maximum weight the disc shoves about 3.6 tonnes of air through itself every second at 14 m/s (twice that, 28 m/s, far below it), and the reaction is the lift. Watch the downwash contract below the disc and spread along the ground.',
    key: 'Momentum theory: T = 2ρA·v², so the ideal hover power is T^1.5 / √(2ρA). A big disc (low disc loading) hovers on less power.',
    focus: [...BLADES, 'Main rotor hub'], view: { dir: [1, 0.55, 1.1], fill: 1.0 }, demo: 'flow',
  },
  {
    title: 'Collective and cyclic: the swashplate',
    body: 'The pilot never touches a blade. Three primary servos move the stationary swashplate; the rotating swashplate above it follows, and four pitch rods pass the motion to the blades. Raise it evenly (collective) and every blade takes more pitch; tilt it (cyclic) and each blade\'s pitch rises and falls once per turn, so the disc tilts and the thrust leans with it. Each servo has two stages on separate hydraulic systems (No. 1 and No. 2). Watch the demo roll, pitch and yaw.',
    key: 'θ(ψ) = θ₀ + A₁ cos ψ + B₁ sin ψ. The disc responds a quarter-turn after the pitch change, so the linkage puts the input 90° ahead.',
    focus: [...HEAD], view: { dir: [1, 0.35, 0.9], fill: 1.25 }, demo: 'surfaces',
  },
  {
    title: 'The hub: why blades flap and lead-lag',
    body: 'In forward flight the advancing blade meets faster air than the retreating one. Rather than roll the aircraft, each blade flaps up where it makes extra lift and down where it makes less. Flapping moves its centre of mass in and out, so it also speeds up and slows down in the plane (Coriolis) — the lead-lag the hydraulic dampers restrain. One laminated elastomeric bearing per blade allows flap, lag and pitch with no hinge pins at all.',
    key: 'The hinge (bearing focal point) sits 0.381 m from the shaft: the offset lets the hub pass pitch and roll moments to the airframe for crisp control.',
    // the hub forging is left out of the focus so it ghosts and the bearings inside it show
    focus: ['Elastomeric bearings', 'Blade spindles & cuffs', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Pitch horns'], explode: 0.5, view: { dir: [1, 0.35, 0.8], fill: 1.15 },
  },
  {
    title: 'Taming four-per-rev vibration',
    body: 'Four blades sweep past any point four times a revolution, so the airframe is shaken at 4 × 4.3 = 17.2 Hz. The bifilar absorber on top of the hub carries four tuned masses that swing on pins in the rotor plane; tuned to three cycles per revolution in the rotating hub, they take out the in-plane rotating loads first. What still reaches the cabin, the UH-60M cancels actively: accelerometers on the floors feed a controller that drives four force generators in the airframe, shaking it equal and opposite — the system that replaced the A/L\'s passive cabin absorbers.',
    key: 'An N-blade rotor passes only vibration at N/rev (and multiples) into the airframe: here 17.2 Hz. Passive bifilar at the source, active cancellation at the seats.',
    focus: ['Bifilar vibration absorber', 'Main rotor hub', 'Blade de-ice slip ring & distributor'], view: { dir: [0.6, 0.7, 1], fill: 1.4 },
  },
  {
    title: 'Torque, and why the tail rotor is canted',
    body: 'Spinning the rotor counter-clockwise (seen from above) twists the fuselage the other way. The tail rotor, 9.93 m behind the shaft, pushes the tail to starboard to cancel it; the pedals change its pitch to turn. Its shaft is canted 20° up, so it also lifts the tail — about 3 % of the weight — which widens the centre-of-gravity range. The bearingless rotor flaps and changes pitch by bending and twisting its two composite crossbeam spars. The pylon is ghosted here so the 42° and 90° gearboxes and the tail-rotor servo inside it show.',
    key: 'Hover at 9,979 kg: torque Q = P/Ω ≈ 70 kN·m, so the tail rotor needs Q / 9.93 m ≈ 7 kN of sideways thrust (≈ 9 % of the power).',
    focus: [...TAILROTOR, 'Intermediate gearbox (42°)', 'Tail drive shaft, pylon section'], view: { dir: [-0.35, 0.3, 1], fill: 1.25 }, demo: 'surfaces',
  },
  {
    title: 'From turbines to rotors: engines and gearbox',
    body: 'Each T700 is built from modules: a cold section (five axial and one centrifugal compressor stage), a hot section (annular combustor and two-stage gas-generator turbine) and a free power turbine whose shaft runs forward through the core. The engines drive forward at 20,900 rpm through output shafts to the input modules, where freewheel clutches let a failed engine drop out. In the main module both inputs meet one spiral-bevel bull gear, and a five-planet stage slows the drive to 258 rpm at the rotor shaft. The accessory modules keep generators and hydraulic pumps turning even in autorotation.',
    key: 'Overall reduction ≈ 81 : 1, limited to 3,400 shp through the main transmission.',
    focus: [...T700('right'), ...T700('left'), 'Engine output shaft (right)', 'Engine output shaft (left)', 'Input module (right)', 'Input module (left)', 'Accessory module (right)', 'Accessory module (left)', ...GEARBOX, 'Main rotor shaft', 'Rotor brake'],
    view: { dir: [0.9, 0.75, 1.0], fill: 1.1 },
  },
  {
    title: 'The tail drive: 9.9 m of spinning shaft',
    body: 'Off the back of the main module the tail take-off turns the tail drive shaft at about 4,100 rpm (estimate): past the rotor brake and the oil-cooler blower, then along the top of the tail cone in short sections joined by flexible couplings and carried on viscous-damped hanger bearings. At the base of the pylon the 42° intermediate gearbox turns the drive up the fin; at the top the 90° gearbox turns it into the tail-rotor shaft at 1,190 rpm.',
    key: 'The tail rotor turns 4.6 times as fast as the main rotor, and the two are geared together: their speeds can never drift apart.',
    focus: ['Tail drive shaft, forward sections', 'Tail drive shaft, tail cone sections', 'Viscous-damped hanger bearings', 'Transmission oil cooler & blower', 'Rotor brake', 'Intermediate gearbox (42°)', 'Tail drive shaft, pylon section', 'Tail rotor gearbox (90°)'],
    view: { dir: [0.15, 0.45, 1], fill: 1.0 },
  },
  {
    title: 'Engines that eat sand and hide their heat',
    body: 'Thermal view. Swirl vanes in each T700\'s inlet particle separator fling sand outward into a scroll that is blown overboard, so the compressor breathes clean air in desert landings. Behind the engines the IR suppressors mix cool air into the hot exhaust and turn it outboard and upward: with the cowlings ghosted, notice the suppressor ducts glow far less than the hot section and power turbine inside, and the cold section stays cooler still.',
    key: 'T700-GE-701D: 1,994 shp for 10 min, 1,716 shp continuous, 207 kg — about 9.6 shp per kilogram.',
    focus: ['T700 cold section (right)', 'T700 hot section (right)', 'T700 power turbine (right)', 'T700 cold section (left)', 'T700 hot section (left)', 'T700 power turbine (left)', 'Inlet particle separator (right)', 'Inlet particle separator (left)', 'Exhaust IR suppressor (right)', 'Exhaust IR suppressor (left)', 'Auxiliary power unit'],
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
    body: 'The Black Hawk was the first helicopter designed from the outset to crash-survival standards. In a hard impact the oleos\' crash stage and the drag beams absorb energy first (the tail gear has its own strut), then the crushable belly; the cabin roof beams hold the gearbox up, and the pilots\' armoured seats and the hanging troop seats stroke downward to limit spinal loads. The two fuel cells survive a 20 m drop test, and breakaway valves seal every line that tears loose.',
    key: 'Design goal: a livable space and no post-crash fire in a vertical impact of about 11.6 m/s (38 ft/s).',
    focus: ['Main gear oleo (right)', 'Main gear oleo (left)', 'Main gear drag beam (right)', 'Main gear drag beam (left)', 'Keel beams & crushable belly', 'Cabin frames & roof beams', 'Armoured crashworthy pilot seats', 'Troop seats', 'Crew chief & gunner seats', 'Fuel cell (right)', 'Fuel cell (left)', 'Fuel lines & breakaway valves'],
    // seen from the left front, the cockpit and its seat callout sit on the left of the screen, clear of the systems legend
    mode: 'systems', view: { dir: [1.1, 0.75, -0.5], fill: 1.0 },
  },
  {
    title: 'The glass cockpit',
    body: 'Two pilots sit side by side: the right seat is the pilot station and the left the copilot station, and either can be flown by the pilot in command. Four multifunction displays replace the old round gauges; a dual flight-management system and a digital automatic flight control system hold attitude, heading, altitude and even a coupled hover. The cyclic tilts the disc, the collective at the left hand sets total thrust, and the pedals set tail-rotor pitch; the mixing unit above the cabin blends them so one input does not upset another. Outside, cutters above and below the nose guard against wire strikes.',
    key: 'Wire strikes kill low-flying crews: the cutters above and below the cockpit are part of the cockpit\'s design, not an add-on.',
    // studio mode: the nose skin ghosts as an unfocused part and the lit displays stay visible
    focus: ['Instrument panel & multifunction displays', 'Centre console & flight-management CDUs', 'Overhead console', 'Cyclic sticks', 'Collective levers', 'Tail rotor pedals', 'Armoured crashworthy pilot seats'],
    view: { dir: [-0.6, 0.5, 0.4], fill: 1.1 },
  },
  {
    title: 'The cabin: 11 troops or a 4-tonne sling load',
    body: 'The cabin is 3.84 m long, 2.21 m wide and 1.37 m high, with sliding doors on both sides so a squad can get out in seconds. Two crew chiefs ride at the front facing out, at window gun mounts. Under the floor, at the centre of gravity, the cargo hook swings down out of its belly well and carries up to 4,082 kg — a howitzer or a vehicle — so the load hardly disturbs the trim.',
    key: 'Maximum take-off 9,979 kg internal, 10,660 kg with a sling load; empty about 5,675 kg.',
    focus: ['Troop seats', 'Crew chief & gunner seats', 'Window gun mounts', 'Cabin door (right)', 'Cabin door (left)', 'Cabin floor', 'External cargo hook', 'Gunner window (right)', 'Gunner window (left)'],
    view: { dir: [0.7, 0.12, 1.2], fill: 1.15 }, demo: 'bay',
  },
];
