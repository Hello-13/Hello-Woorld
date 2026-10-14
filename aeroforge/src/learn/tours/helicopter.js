// Guided tour: UH-60M Black Hawk. See ../tours.js for the step format.

const SWASH = ['Rotating swashplate', 'Swashplate duplex bearing', 'Stationary swashplate', 'Uniball & sliding sleeve', 'Swashplate guide', 'Rotating scissors', 'Stationary scissors', 'Pitch control rods', 'Primary servos'];
const HEAD = ['Main rotor hub', 'Elastomeric bearings', 'Blade spindles', 'Blade cuffs & quick-release pins', 'Pitch horns', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Bifilar vibration absorber', ...SWASH, 'Main rotor shaft', 'Main rotor slip ring', 'De-ice distributor'];
const BLADES = ['Main rotor blade 1', 'Main rotor blade 2', 'Main rotor blade 3', 'Main rotor blade 4'];
const TAILROTOR = ['Tail rotor blades', 'Tail rotor hub & crossbeam spars', 'Tail rotor pitch-change beam & links', 'Tail rotor gearbox (90°)', 'Tail rotor servo', 'Tail rotor quadrant'];
const T700 = (side) => ['T700 cold section', 'T700 combustor', 'T700 gas-generator turbine', 'T700 power turbine', 'T700 accessory section', 'T700 fuel control & pump', 'T700 DECU & ignition'].map((n) => `${n} (${side})`);
const GEARBOX = ['Main module (main transmission)', 'Main bevel gear & combining pinions', 'Planetary reduction stage', 'Main transmission oil pumps', 'Main transmission oil filter', 'Transmission chip detectors'];
const INPUTS = ['right', 'left'].flatMap((s) => [`Input module (${s})`, `Input bevel gears (${s})`, `Freewheel unit (${s})`, `Accessory module (${s})`, `Engine output shaft (${s})`]);
const TAILDRIVE = [1, 2, 3, 4, 5, 6].map((k) => `Tail drive shaft section ${k}`);

export default [
  {
    title: 'A rotor is a spinning wing',
    body: 'Each of the four blades is a long, thin wing flying in a circle at 258 rpm. Together they act like a disc 16.36 m across that pushes air downward: at maximum weight the disc shoves about 3.6 tonnes of air through itself every second at 14 m/s (twice that, 28 m/s, far below it), and the reaction is the lift. Watch the downwash contract below the disc and spread along the ground.',
    key: 'Momentum theory: T = 2ρA·v², so the ideal hover power is T^1.5 / √(2ρA). A big disc (low disc loading) hovers on less power.',
    focus: [...BLADES, 'Main rotor hub'], view: { dir: [1, 0.55, 1.1], fill: 1.0 }, demo: 'flow',
  },
  {
    title: 'Collective and cyclic: the swashplate',
    body: 'The pilot never touches a blade. Three two-stage primary servos on the deck ahead of the gearbox push the stationary swashplate, which slides and tilts on a uniball around the guide; the rotating swashplate rides on it through a duplex bearing and turns with the rotor, and four adjustable pitch rods pass the motion to the blades. Raise the plates evenly (collective) and every blade takes more pitch; tilt them (cyclic) and each blade\'s pitch rises and falls once per turn, so the disc tilts and the thrust leans with it. Watch the demo roll, pitch and yaw.',
    key: 'Three servos set the swashplate\'s three degrees of freedom: height (collective) and two tilts (cyclic). θ(ψ) = θ₀ + A₁ cos ψ + B₁ sin ψ.',
    focus: [...HEAD], view: { dir: [1, 0.35, 0.9], fill: 1.25 }, demo: 'surfaces',
  },
  {
    title: 'Inside the swashplate',
    body: 'Exploded, the stack reads bottom to top: the servos, the guide bolted to the main module, the uniball sleeve that slides on it, the stationary plate, the duplex bearing, then the rotating plate and its pitch rods. Two kinds of scissors keep the plates honest: the stationary scissors stop the lower plate turning, the rotating scissors make the upper plate turn with the shaft — yet both fold so the plates can still slide and tilt. Each pitch rod has an adjustment barrel; changing one rod\'s length re-tracks that blade.',
    key: 'One bearing separates the turning world from the fixed one: everything above it spins at 258 rpm, everything below it stands still.',
    focus: [...SWASH], explode: 0.55, mode: 'xray', view: { dir: [1, 0.25, 0.75], fill: 1.0, lift: 0.1 },
  },
  {
    title: 'The hub: why blades flap and lead-lag',
    body: 'In forward flight the advancing blade meets faster air than the retreating one. Rather than roll the aircraft, each blade flaps up where it makes extra lift and down where it makes less. Flapping moves its centre of mass in and out, so it also speeds up and slows down in the plane (Coriolis) — the lead-lag the hydraulic dampers restrain. One laminated elastomeric bearing per blade, its rubber and steel shells all centred on one point, allows flap, lag and pitch with no hinge pins at all; two quick-release pins at each cuff let a blade fold back for transport.',
    key: 'The hinge (bearing focal point) sits 0.381 m from the shaft: the offset lets the hub pass pitch and roll moments to the airframe for crisp control.',
    // the hub forging is left out of the focus so it ghosts and the bearings inside it show; a light
    // explode lifts the hub clear of them
    focus: ['Elastomeric bearings', 'Blade spindles', 'Blade cuffs & quick-release pins', 'Lead-lag dampers', 'Droop stops & flap restrainers', 'Pitch horns'], explode: 0.35, view: { dir: [1, 0.3, 0.8], fill: 0.85, lift: 0.15 },
  },
  {
    title: 'Taming four-per-rev vibration',
    body: 'Four blades sweep past any point four times a revolution, so the airframe is shaken at 4 × 4.3 = 17.2 Hz. The bifilar absorber on top of the hub carries four tuned masses that swing on pins in the rotor plane; tuned to three cycles per revolution in the rotating hub, they take out the in-plane rotating loads first. What still reaches the cabin, the UH-60M cancels actively: accelerometers on the floors feed a controller that drives four force generators in the airframe, shaking it equal and opposite — the system that replaced the A/L\'s passive cabin absorbers.',
    key: 'An N-blade rotor passes only vibration at N/rev (and multiples) into the airframe: here 17.2 Hz. Passive bifilar at the source, active cancellation at the seats.',
    focus: ['Bifilar vibration absorber', 'Main rotor hub', 'Main rotor slip ring', 'De-ice distributor'], view: { dir: [0.6, 0.7, 1], fill: 1.4 },
  },
  {
    title: 'Keeping ice off the blades',
    body: 'Ice on a rotor blade destroys lift and, if it sheds unevenly, the rotor\'s balance. A heater blanket under each blade\'s leading edge melts the ice\'s bond so it flies off cleanly. Follow the power: from the controller and junction box on the cabin-roof beam a lead runs under the roof, into the bottom of the gearbox and up the hollow rotor shaft to the slip ring on top of the hub, where brushes pass it into the turning rotor. The distributor above switches the blades\' heater zones in turn, so the generators are not overloaded, and a cable runs down each hub arm and along the cuff to its blade. The tail rotor\'s four blades are heated all at once through their own slip ring, fed from the tail-cone harness. The controller times it all from the ice detector\'s icing rate and the outside air temperature.',
    key: 'Colder air → longer heater-on time; heavier icing → shorter off time. Blades are heated in cycles, never all at once.',
    // framed on the head and the roof below it, so the slip ring, distributor, harness and the lead
    // from the junction box read at a useful size; the blankets run out along the ghosted blades
    focus: ['Main rotor slip ring', 'De-ice distributor', 'Main rotor de-ice harness', 'Main rotor hub', 'Blade de-ice controller & junction box', 'Main rotor shaft'],
    mode: 'xray', view: { dir: [0.85, 0.55, -0.95], fill: 1.0 },
  },
  {
    title: 'Torque, and why the tail rotor is canted',
    body: 'Spinning the rotor counter-clockwise (seen from above) twists the fuselage the other way. The tail rotor, 9.93 m behind the shaft, pushes the tail to starboard to cancel it; the pedals change its pitch through cables, a spring-loaded quadrant and a two-stage servo. Its shaft is canted 20° up, so it also lifts the tail — about 2.5 % of the total lift in a hover — which widens the centre-of-gravity range. The bearingless rotor flaps and changes pitch by bending and twisting its two composite crossbeam spars. The pylon is ghosted here so the 42° and 90° gearboxes and the servo inside it show.',
    key: 'Hover at 9,979 kg: torque Q = P/Ω ≈ 70 kN·m, so the tail rotor needs Q / 9.93 m ≈ 7 kN of sideways thrust (≈ 9 % of the power).',
    focus: [...TAILROTOR, 'Intermediate gearbox (42°)', 'Tail drive shaft section 6'], view: { dir: [0.2, 0.55, 1], fill: 1.2 }, demo: 'surfaces',
  },
  {
    title: 'From turbines to rotors: engines and gearbox',
    body: 'Each T700 is built from modules: a cold section (five axial and one centrifugal compressor stage), a combustor and two-stage gas-generator turbine, and a free power turbine whose shaft runs forward through the core. The engines drive forward at 20,909 rpm through output shafts to the input modules, which also carry the front of each engine. Three reduction stages follow: the input bevels (22:80), where ramp-roller freewheels let a failed engine drop out; the combining bevel (17:81), where both engines meet one gear; and a five-planet stage that brings the drive to 258 rpm at the rotor shaft. The accessory modules keep generators and hydraulic pumps turning even in autorotation.',
    key: '3.64 × 4.76 × 4.68 = 81.04 : 1, from 20,909 rpm to 258 rpm; 3,400 shp through the main transmission.',
    focus: [...T700('right'), ...T700('left'), ...INPUTS, ...GEARBOX, 'Main rotor shaft', 'Rotor brake'],
    view: { dir: [0.9, 0.75, 1.0], fill: 1.1 },
  },
  {
    title: 'The tail drive: six shafts and two gearboxes',
    body: 'The upper face of the main bevel gear drives the tail take-off at 4,117 rpm. Six dynamically balanced aluminium shafts carry it aft: the first through the oil-cooler blower, which cools the gearbox whenever the rotor turns, then back over the transition section and along the top of the tail cone, carried on four viscous-damped hanger bearings. Flexible disc couplings at every joint take up the angles and the tail cone\'s bending, with no universal joints. At the base of the pylon the 42° gearbox turns the drive up the fin; at the top the 90° gearbox turns it into the tail-rotor shaft at 1,190 rpm.',
    key: 'The tail rotor turns 4.6 times as fast as the main rotor, and the two are geared together: their speeds can never drift apart.',
    focus: [...TAILDRIVE, 'Tail drive shaft disc couplings', 'Viscous-damped hanger bearings', 'Transmission oil cooler & blower', 'Rotor brake', 'Main rotor gust lock', 'Intermediate gearbox (42°)', 'Tail rotor gearbox (90°)'],
    view: { dir: [0.15, 0.45, 1], fill: 1.0 },
  },
  {
    title: 'Engines that eat sand and hide their heat',
    body: 'Thermal view. Swirl vanes in each T700\'s inlet particle separator fling sand outward into a scroll; a blower on the accessory gearbox sucks it out and dumps it overboard by the exhaust, so the compressor breathes clean air in desert landings. Behind the engines the M\'s upturned exhausts cool the gas through a grid of plates and turn it up into the rotor downwash: with the cowlings ghosted, notice the exhaust ducts glow far less than the hot section and power turbine inside, and the cold section stays cooler still.',
    key: 'T700-GE-701D: 1,994 shp for 10 min, 1,716 shp continuous, 207 kg — about 9.6 shp per kilogram.',
    focus: ['T700 cold section (right)', 'T700 combustor (right)', 'T700 gas-generator turbine (right)', 'T700 power turbine (right)', 'T700 cold section (left)', 'T700 combustor (left)', 'T700 gas-generator turbine (left)', 'T700 power turbine (left)', 'Inlet particle separator (right)', 'Inlet particle separator (left)', 'T700 IPS blower & scavenge duct (right)', 'T700 IPS blower & scavenge duct (left)', 'Upturned exhaust (right)', 'Upturned exhaust (left)', 'Auxiliary power unit'],
    mode: 'thermal', view: { dir: [-0.6, 0.8, 1], fill: 1.15 },
  },
  {
    title: 'Three hydraulic systems, no single failure',
    body: 'Systems view. Two pump modules on the accessory modules and an identical backup module on an AC motor feed three separate systems that share no fluid. No. 1 drives the first stage of every primary servo and of the tail-rotor servo, No. 2 the second stage of the primary servos and the boost and SAS actuators; if a system loses pressure, the logic modules shut off the leak and the backup pump takes its place automatically. Each primary servo\'s two stages share only the input linkage, and a bypass valve stops a dead stage locking the live one.',
    key: 'Backup pump: on automatically below 2,000 psi in either system, delivering 3,000 psi. The SVO OFF switch cannot shut a stage unless the other holds 2,350 psi.',
    focus: ['No. 1 hydraulic pump module (left)', 'No. 2 hydraulic pump module (right)', 'Backup hydraulic pump', 'Utility module', 'No. 1 transfer module', 'No. 2 transfer module', 'No. 1 system hydraulic lines', 'No. 2 system hydraulic lines', 'Backup system hydraulic lines', 'Hydraulic logic modules', 'Primary servos', 'Tail rotor servo', 'Boost servos', 'SAS actuators'],
    mode: 'systems', view: { dir: [0.75, 0.9, 0.55], fill: 1.0 },
  },
  {
    title: 'The stabilator',
    body: 'In the hover the rotor wake blasts straight down onto the tail. A fixed tailplane would be shoved down and pitch the nose up as the aircraft accelerates through the wake. So the whole stabilator pivots: computers park it about 40° trailing edge down at low speed, then flatten it as airspeed builds, where it gives the pitch stability a tailplane should. On the M it also folds at its roots for air transport. Set the airspeed slider in the lab and watch it move.',
    key: 'Schedule ≈ 40° trailing edge down below 30 kt → near level by 150 kt (plus corrections for collective, pitch rate and sideslip).',
    focus: ['Stabilator', 'Stabilator actuators', 'Stabilator fold hinges', 'Tail pylon', 'Tail cone skin'], view: { dir: [-0.4, 0.25, 1], fill: 1.15 },
  },
  {
    title: 'Built to survive a crash',
    body: 'The Black Hawk was the first helicopter designed from the outset to crash-survival standards. In a hard impact the oleos and drag beams absorb energy first — the lower oleo stage alone up to 10 ft/s, both stages together up to 39 ft/s — then the crushable belly; the roof beams hold the gearbox up, and the pilots\' armoured seats and the hanging troop seats stroke downward to limit spinal loads. The two fuel cells survive a 20 m drop test, and self-sealing breakaway valves close every line that tears loose.',
    key: 'Main gear: 10 ft/s on the lower stage, up to 39 ft/s (about 11.25 g) with both stages working.',
    focus: ['Main gear oleo (right)', 'Main gear oleo (left)', 'Main gear drag beam (right)', 'Main gear drag beam (left)', 'Keel beams & crushable belly', 'Main roof beams', 'Armoured crashworthy pilot seats', 'Troop seats', 'Crew chief & gunner seats', 'Fuel cell (right)', 'Fuel cell (left)', 'Fuel lines & breakaway valves'],
    // studio mode: everything else ghosts, and no legend covers the seat and fuel-cell labels
    view: { dir: [1.1, 0.75, -0.5], fill: 1.0 },
  },
  {
    title: 'The glass cockpit',
    body: 'Two pilots sit side by side: the right seat is the pilot station and the left the copilot station, and either can be flown by the pilot in command. Four multifunction displays replace the old round gauges; a dual flight-management system and a digital automatic flight control system hold attitude, heading, altitude and even a coupled hover. The cyclic tilts the disc, the collective at the left hand sets total thrust, and the pedals set tail-rotor pitch; the switches on their grips mean the hands never leave the controls. Armour wings slide aft beside each seat for getting in. Outside, nine passive cutters and deflectors guard the frontal area against wire strikes.',
    key: 'Wire strikes kill low-flying crews: nine cutters and deflectors — no motors, no explosives — cover the gaps from the tyres to the rotor.',
    // studio mode: the nose skin ghosts as an unfocused part and the lit displays stay visible
    focus: ['Instrument panel & multifunction displays', 'Centre console & flight-management CDUs', 'Overhead console', 'Cyclic sticks', 'Collective levers', 'Tail rotor pedals', 'Armoured crashworthy pilot seats', 'Sliding armour side panels', 'Windshield wipers'],
    view: { dir: [-0.6, 0.5, 0.4], fill: 1.1 },
  },
  {
    title: 'The cabin: 11 troops or a 4-tonne sling load',
    body: 'The cabin is 3.84 m long, 2.21 m wide and 1.37 m high, with sliding doors on both sides so a squad can get out in seconds. Two crew chiefs ride at the front facing out, at sliding gunner windows with gun mounts. Under the floor, at the centre of gravity, the cargo hook swings down out of its belly well and carries up to 4,082 kg — a howitzer or a vehicle — so the load hardly disturbs the trim; a hatch in the floor above it lets the crew watch the load or release it by hand.',
    key: 'Maximum take-off 9,979 kg internal, 10,660 kg with a sling load; empty about 5,675 kg.',
    focus: ['Troop seats', 'Crew chief & gunner seats', 'Window gun mounts', 'Cabin door (right)', 'Cabin door (left)', 'Cabin floor', 'External cargo hook', 'Cargo hook floor hatch & manual release', 'Gunner window (right)', 'Gunner window (left)', 'Stowage compartments'],
    view: { dir: [0.7, 0.12, 1.2], fill: 1.15 }, demo: 'bay',
  },
];
