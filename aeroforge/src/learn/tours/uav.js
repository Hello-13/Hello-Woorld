// Guided tour: General Atomics MQ-9A Reaper. See ../tours.js for the step format.

const SIDES = (names) => names.flatMap((n) => [`${n} (starboard)`, `${n} (port)`]);
const SURFACES = SIDES(['Inboard flap', 'Outboard flap', 'Inboard aileron', 'Outboard aileron']);
const WING = [...SIDES(['Wing skin']), ...SURFACES];
const WING_BOX = [
  ...SIDES(['Main spar', 'Rear spar', 'Wing ribs', 'Inboard wing tank', 'Outboard wing tank', 'Tank closing rib', 'Flap & aileron hinges', 'Wing wiring']),
  'Wing carry-through box', 'Wing attach fittings', 'Wing root fairings',
  'Inboard flap servo (starboard)', 'Outboard flap servo (starboard)', 'Inboard aileron servo (starboard)', 'Outboard aileron servo (starboard)',
  'Forward fuselage frames', 'Centre & aft fuselage frames', 'Fuselage longerons', 'Nose gear well', 'Main gear wells', ...SIDES(['V-tail spar & ribs', 'V-tail root fittings']),
];
const ENGINE = [
  'TPE331 turbine case', 'Annular combustor liner', 'Three-stage axial turbine', 'Turbine nozzle rings', 'Main fuel manifolds & nozzles', 'Starting fuel manifold',
  'Igniter plugs', 'Ignition exciter', 'Exhaust outlet & Y-duct', 'Exhaust stacks', 'TPE331 compressor housing', 'Centrifugal impellers', 'Main shaft & bearings',
  'Inlet screen', 'Engine air inlet & plenum', 'Propeller reduction gearbox', 'Accessory drive case', 'Tachometer-generator', 'Starter-generator', 'Backup generator',
  'Fuel control unit', 'Engine-driven fuel pump', 'Mechanical fuel shutoff valve (MSOV)', 'Metered fuel line', 'Engine fuel heater', 'Fuel purge system',
  'Oil tank', 'Oil filter & chip detector', 'Oil pressure & temperature sensors', 'Engine oil lines', 'Oil cooler & scoop', 'Oil temperature control valve',
  'EGT thermocouple harness', 'Torque & speed pickups', 'DEEC engine control', 'Engine start module & SRL', 'Engine control servos', 'Engine control cables',
  'Engine mount truss', 'Firewall',
];
const PROPELLER = [
  'Three-blade propeller', 'Propeller hub & blade clamps', 'Pitch-change dome & feather spring', 'Spinner', 'Propeller shaft & flange', 'Propeller governor',
  'NTS & beta-pressure switch', 'Propeller reduction gearbox', 'Ventral fin', 'Tail bumper',
];
const LYNX = ['Lynx three-axis gimbal', 'AN/APY-8 Lynx SAR antenna', 'Lynx TWT amplifier & LNA', 'Lynx LN-200 IMU', 'Lynx radar electronics', 'Lynx RF & data cables', 'Lynx radome'];
const LINKS = [
  'Ku-band SATCOM antenna', 'SATCOM radome', 'SATCOM rotary joint & RF run', 'Ku-band SATCOM modem', 'C-band datalink transceiver', 'C-band LOS antennas',
  'Antenna coax runs', 'Iridium antenna & transceiver',
];
const AVIONICS = [
  'Flight control computers', 'Mission control module (payload computer)', 'Embedded GPS/INS', 'Air data computer', 'Air data lines', 'Pitot-static probes',
  'Outside air temperature probe', 'Angle-of-attack vane', 'IFF transponder', 'ARC-210 V/UHF radios', 'Avionics cooling fan', 'Avionics cooling ducts', 'Avionics floor',
  'Avionics bay harness', 'Main batteries', 'Main power feeders', 'Power distribution units', 'Generator control unit', 'Accessory bay equipment rack',
  'Ground power receptacle', 'Engine bay harness', 'Starter-generator', 'Starter-generator cooling duct', 'Backup generator',
];
const FUEL = [
  'Forward fuel cell', 'Header fuel cell', 'Aft fuel cell', ...SIDES(['Inboard wing tank', 'Outboard wing tank', 'Wing jet pumps', 'Wing transfer lines', 'Wing motive-fuel line', 'Wing fuel vents', 'ER fuel pod']),
  'Header tank pumps', 'Jet-pump selector valves', 'Jet-pump motive manifold', 'Fuselage jet pumps', 'Fuselage transfer lines', 'Fuselage tank vents',
  'Fuel quantity probes', 'Fuel sump drains', 'Gravity refuel ports', 'Fuel dump valve & outlet', 'Forward electric fuel heater',
  'Electrical fuel shutoff valve (FSOV)', 'Engine feed line',
];
const STORES = [
  ...SIDES(['Inboard pylon', 'Middle pylon', 'Outboard pylon', 'Store release hardware', 'GBU-12 Paveway II', 'M310 launcher', 'AGM-114 Hellfire pair']), 'Centreline station',
];
const CONTROLS = [
  ...SURFACES, ...SIDES(['Inboard flap servo', 'Outboard flap servo', 'Inboard aileron servo', 'Outboard aileron servo', 'Ruddervator', 'Ruddervator servo', 'Ruddervator hinges']),
  'Ventral rudder', 'Ventral rudder servo', 'Ventral rudder hinges', 'Flight control computers',
];
const GEAR = [
  'Nose gear oleo strut', 'Nose gear torque links', 'Nose gear steering actuator', 'Nose-wheel steering controller', 'Nose gear retraction actuator', 'Nose gear retract driver',
  'Nose gear uplock', 'Nose wheel & tyre',
  ...SIDES(['Main gear strut', 'Main gear trailing arm', 'Main gear shock absorber', 'Main gear retraction actuator', 'Main gear retract driver', 'Main gear uplock', 'Main wheel & brake', 'Brake servo']),
];

export default [
  {
    title: 'Built to stay up, not to go fast',
    body: 'The MQ-9A Reaper is an 11 m, 4.8-tonne aircraft designed to circle one area for a day or more while its sensors watch the ground. Almost everything you see follows from that: a 20 m wing, a fuel-sipping turboprop at the back, and a nose full of sensors and antennas instead of a cockpit.',
    key: 'For a propeller aircraft, endurance grows with η · C_L^1.5 / C_D: efficiency matters, speed does not.',
    view: { dir: [0.41, 0.866, 0.287], fill: 0.72 },   // high front quarter: all the labels clear of each other's dots
  },
  {
    title: 'A long, thin wing',
    body: 'Making lift leaves a wake of tip vortices whose drag falls as span grows. The Reaper’s wing has an aspect ratio near 17, closer to a glider’s than a fighter’s, so it reaches a lift-to-drag ratio around 20. In Pressure view the strongest suction (blue) runs along the leading edge from root to tip. Each wing has two flaps and two ailerons, each on its own servo.',
    key: 'Induced drag C_Di = C_L² / (π e AR): double the aspect ratio, halve the induced drag.',
    mode: 'pressure', focus: WING, view: { dir: [0.25, 1, 0.55], fill: 1.05 },
  },
  {
    title: 'Inside the wing and body',
    body: 'Two carbon-composite spars, ribs and the skins form a torsion box, pinned at its root to a carry-through box in the fuselage so the wings can come off for shipping. Fuel lives inside the box between the spars, in an inboard and an outboard tank divided by a sealed rib, right where the lift is. Behind the rear spar sit the hinge brackets, a servo for each of the four surfaces and their wiring. The fuselage is graphite skin on Nomex honeycomb over ring frames and four longerons; the V-tail spars pin into two frames over the engine bay.',
    key: 'Fuel in the wing relieves bending: the root moment depends on lift minus the weight carried outboard.',
    mode: 'systems', explode: 0.3, focus: WING_BOX, view: { dir: [0.35, 0.8, 0.75], fill: 0.62 },
  },
  {
    title: 'A turboprop at the back',
    body: 'A Honeywell TPE331-10GD makes up to 900 shp (671 kW) from an engine only 1.09 m long, mounted right ahead of the propeller. Air from a dorsal scoop enters behind the gearbox, is squeezed 10.55 times by two centrifugal impellers, burns in a reverse-flow annular combustor wrapped around the turbine, and drives three turbine stages on one shaft at 41,730 rpm. In this pusher the hot end faces forward, so a Y-duct turns the exhaust back out of two side stacks. The fuel control sits on top of the engine; servos in the accessory bay work its levers through cables.',
    key: 'Power required P = D · V / η_prop. At a 7,600 m loiter the Reaper needs only about 150 kW, a third of the ≈ 450 kW the TPE331 still gives up there (671 kW at sea level).',
    mode: 'xray', focus: ENGINE, view: { dir: [0.3, 0.08, 1], fill: 1.2 },
  },
  {
    title: 'Three blades, pushing',
    body: 'The McCauley propeller is 2.79 m across: three aluminium scimitar blades in a hub whose pitch-change piston, fed with oil by a Woodward governor, sets the blade angle that holds the rpm. Below flight idle the blades go into beta and then reverse pitch, the Reaper’s main brake on landing; if oil pressure is lost, a spring and counterweights feather them. The ventral fin reaches below the propeller arc, so on an over-rotation its bumper touches the runway first.',
    key: 'The 26.2 : 1 gearbox turns 41,730 engine rpm into 1,591 propeller rpm; even so the tips move at ≈ 233 m/s, Mach 0.68 at sea level.',
    mode: 'xray', focus: PROPELLER, view: { dir: [-1, 0.25, 0.7], fill: 1.1 },
  },
  {
    title: 'Watching in colour and in heat: MTS-B',
    body: 'Under the chin, Raytheon’s Multi-Spectral Targeting System B combines an infrared camera, a colour/monochrome daylight TV camera and an image-intensified TV camera for low light with a laser rangefinder/designator and a laser illuminator. Gyros stabilise the ball so the picture holds steady from many kilometres away while the aircraft bumps through the air.',
    key: 'A laser designator pulses in a set code; a laser-guided weapon steers only toward its own code.',
    focus: ['MTS-B EO/IR turret', 'MTS-B electronics unit'], view: { dir: [1, -0.25, 0.75] }, demo: 'laser',
  },
  {
    title: 'Seeing through cloud: Lynx radar',
    body: 'Cameras cannot see through cloud or smoke; radar can. The AN/APY-8 Lynx in the lower nose is a synthetic-aperture radar in two packages: a three-axis gimbal carrying a horn-fed dish, its transmitter tube and receiver amplifier and a fibre-optic IMU, and behind it an electronics assembly that forms the images. Recording echoes as the aircraft flies and combining them as if the antenna were hundreds of metres long, it reaches 0.1 m resolution.',
    key: 'Cross-range resolution δ ≈ λR / (2L), with λ ≈ 1.8 cm: the IMU on the dish must track its path to a fraction of λ, or the image blurs.',
    mode: 'xray', focus: LYNX, view: { dir: [0.9, 0.1, 1] },
  },
  {
    title: 'Flown from another continent',
    body: 'The bulge over the nose hides a Ku-band dish that tracks a geostationary satellite; a rotary joint lets it turn freely while its signal reaches the modem beside it. Through it a pilot and a sensor operator, often thousands of kilometres away, fly the mission. The delay is too long for a hand-flown landing, so a crew at the airfield takes off and lands on a short-delay C-band line-of-sight link, through upper and lower antennas cabled to their radio.',
    key: 'Up to geostationary orbit and back twice: 4 × 35,786 km ÷ c ≈ 0.48 s from the satellite hops alone; ground relays and processing take the control loop past a second.',
    mode: 'xray', focus: LINKS, view: { dir: [0.7, 0.45, 1] },
  },
  {
    title: 'Computers, air data and power',
    body: 'On a floor raised over the nose-gear well sit the computers that fly the aircraft: triple-redundant flight control computers with stall protection and a lost-link profile, GPS/inertial units, an air data computer fed by the pitot, static, temperature and angle-of-attack lines, radios and a separate payload computer. Their power comes from the far end: the starter-generator on the gearbox, regulated and switched in the accessory bay and carried forward on two separate feeders. A backup generator and the batteries keep the flight-critical bus alive if it fails.',
    key: 'P = V · I: 156 A at 28 V is 4.4 kW, and the Lynx radar alone averages 1.4 kW.',
    mode: 'systems', focus: AVIONICS, view: { dir: [-1, 1.25, 0.3], fill: 0.75 },   // from above and behind: the nose bay at the top, clear of the panels
  },
  {
    title: 'Fuel and time on station',
    body: 'About 1,800 kg of JP-8 fills seven tanks: forward, header and aft cells in the fuselage and two tanks in each wing. The engine draws only from the header cell at the centre of gravity. Its two pumps feed the engine and also drive a jet-pump manifold: solenoid valves send that fuel to the jet pump in the selected tank, whose suction refills the header. The feed runs through an electric heater and the shutoff valve at the firewall to the engine. GA-ASI’s ER pods add 1,200 kg more: try them in the Mission endurance lab.',
    key: 'Breguet endurance E = (η / c) · (L/D) · (1/V) · ln(W₀ / W₁).',
    mode: 'systems', focus: FUEL, view: { dir: [-1, 0.95, -0.75], fill: 0.72 },
  },
  {
    title: 'Seven stations',
    body: 'Six under-wing pylons and a centreline hardpoint carry 1,361 kg (3,000 lb) of stores on older GA-ASI figures, 1,701 kg (3,750 lb) on the Block 5 sheet. Shown: a GBU-12 laser-guided bomb on each inboard station and two Hellfire missiles on an M310 launcher on each middle station, each hung on two hooks 14 in apart with an umbilical and an arming solenoid. Every kilogram of stores is a kilogram of fuel not carried, and every pylon adds drag.',
    key: 'MTOW 4,760 kg = empty 2,223 kg + fuel + payload: weight is the currency of the mission.',
    explode: 0.25, focus: STORES, view: { dir: [1, 0.32, 0.6], fill: 1.0 }, demo: 'bay',
  },
  {
    title: 'Wheels and control surfaces',
    body: 'Trailing-arm main legs, each with its own shock absorber, brake servo and retraction actuator and driver, and a steerable oleo nose leg fold into wells in about 25 s. Electric servos drive the eight wing surfaces, the two ruddervators and the ventral rudder, so one failed actuator leaves the others working. Watch the demonstration: roll, then pitch, then yaw, the ruddervators moving together for pitch and apart for yaw.',
    key: 'Ruddervator mixing: δ_left,right = δ_pitch ± δ_yaw.',
    focus: [...CONTROLS, ...GEAR], view: { dir: [-1, 0.55, 0.8], fill: 0.72 }, demo: 'surfaces',
  },
];
