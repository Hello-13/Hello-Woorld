// Guided tour: Hubble Space Telescope. See ../tours.js for the step format.
// Step bodies stay near 50–60 words so the card's controls fit at 1280 × 800; the detail lives in
// the part cards.

const BAY_DOORS = [
  'Bay 1 door (data management)', 'Bay 2 door (battery module 1)', 'Bay 3 door (battery module 2)', 'Bay 4 door (power control)',
  'Bay 5 door (communications)', 'Bay 6 door (reaction wheels 1–2)', 'Bay 7 door (mechanism control)', 'Bay 8 door (pointing control)',
  'Bay 9 door (reaction wheels 3–4)', 'Bay 10 door (SI C&DH)',
];
const NOBLS = [5, 6, 7, 8, 9, 10].map((k) => `New outer blanket layer (bay ${k})`);
const OPTICS = [
  'Primary mirror', 'Secondary mirror', 'Secondary mirror assembly', 'Secondary mirror spider', 'Secondary baffle',
  'Central baffle', 'Main baffle', 'Light shield internal baffles', 'Pick-off mirrors', 'Metering truss',
];
const DIUS = ['Data interface unit (bay 3)', 'Data interface unit (bay 7)', 'Data interface unit (bay 10)', 'Data interface unit (OTA equipment section)'];

export default [
  {
    title: 'A telescope above the air',
    body: 'Hubble\'s 2.4 m mirror is no bigger than the 1917 Hooker telescope\'s. What sets it apart is altitude: 13.2 m and 12 tonnes of spacecraft circling above the atmosphere every 95 minutes, where nothing blurs starlight and ultraviolet light gets through. Everything you see exists to keep one mirror pointed, powered, cool and clean.',
    key: 'Diffraction limit θ = 1.22 λ / D = 0.052″ at 500 nm — about 15 times sharper than 0.8″ ground seeing.',
  },
  {
    title: 'The optical path',
    body: 'Light enters the open aperture door, passes the light shield\'s baffle rings and strikes the 2.4 m primary. Its converging cone runs 4.9 m forward to the 0.3 m secondary, which sends it back through the 60 cm hole in the primary to a focus 1.5 m behind it. Baffles block every straight path to the focus.',
    key: 'f/24: a 57.6 m focal length folded into 6.4 m of tube.',
    focus: OPTICS, mode: 'xray', demo: 'bay', view: { dir: [0.18, 0.42, 1], fill: 0.95 },
  },
  {
    title: 'Two hyperbolic mirrors',
    body: 'Both mirrors are hyperboloids, a Ritchey–Chrétien design that cancels spherical aberration and coma over a wide field. The primary is ULE glass, two faceplates fused to an egg-crate core: 828 kg instead of 3.6 t. A beryllium reaction plate behind it carries heaters and 24 actuators; the truss holds the secondary 4.906 m away to 2.5 µm.',
    key: 'Design conics: K₁ = −1.0023 (primary), K₂ = −1.4960 (secondary).',
    focus: ['Primary mirror', 'Primary mirror egg-crate core', 'Primary mirror rear faceplate', 'Primary mirror mounts & actuators', 'Primary mirror heaters', 'Reaction plate', 'Secondary mirror', 'Secondary mirror assembly', 'Metering truss', 'OTA kinematic mounts'],
    mode: 'systems', explode: 0.55, view: { dir: [0.95, 0.5, 0.75], fill: 0.95 },
  },
  {
    title: 'The flaw, and the fix',
    body: 'The first images in 1990 were blurred: the primary had been polished, very precisely, to the wrong shape, 2.2 µm too flat at the edge, because a test lens sat 1.3 mm out of place. In 1993 COSTAR and the new WFPC2 camera corrected the beam; later instruments carry the fix, so COSTAR left in 2009.',
    key: 'Only about 15 % of a star\'s light fell within 0.1″; the design called for roughly 70–80 %.',
    focus: ['Primary mirror', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'Pick-off mirrors'], mode: 'xray', view: { dir: [-0.35, 0.5, 1], fill: 1.1 },
  },
  {
    title: 'The science instruments',
    body: 'Four instruments the size of telephone booths fill the axial bays behind the primary: STIS, NICMOS (dormant since 2008), ACS and COS, in COSTAR\'s old bay. Wide Field Camera 3 fills the radial bay, its white radiator part of the skin. Together they span 115 nm to 2.5 µm, and each can be swapped in orbit.',
    key: 'Four axial bays, one radial camera, three guidance sensors: all latched to the focal-plane structure.',
    focus: ['Space Telescope Imaging Spectrograph', 'Near Infrared Camera and Multi-Object Spectrometer', 'Advanced Camera for Surveys', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'WFC3 UVIS channel', 'WFC3 IR channel', 'WFC3 channel select mechanism', 'ACS Wide Field Channel', 'ACS Solar Blind Channel', 'ACS High Resolution Channel (inoperative)', 'STIS CCD', 'STIS MAMA detectors', 'STIS mode select mechanism', 'NICMOS dewar', 'COS optics select mechanism', 'COS far-UV detector', 'COS near-UV detector', 'Focal plane structure', 'WFC3 radiator', 'Pick-off mirrors'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.85, 0.5, 0.65], fill: 1.05 },
  },
  {
    title: 'Turning without thrusters',
    body: 'Hubble carries no thrusters and no propellant. Four reaction wheels in bays 6 and 9 turn it: spin a wheel faster one way and the telescope turns the other, about 90° in 15 minutes. Small disturbance torques build up wheel speed, so four magnetic torquer bars push against Earth\'s field to bleed it off.',
    key: 'Any three of the four skewed wheels can point the telescope; the fourth is a spare.',
    focus: ['Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Magnetic torquer bar 1', 'Magnetic torquer bar 2', 'Magnetic torquer bar 3', 'Magnetic torquer bar 4', 'Flight computer (80486)'],
    mode: 'systems', explode: 0.3, view: { dir: [0.45, 0.75, 0.9], fill: 1.0 },
  },
  {
    title: 'Pointing to 0.007″',
    body: 'Six gyroscopes in three rate sensor units feel every motion. Three star trackers fix the attitude to an arc-minute, enough to bring guide stars into the Fine Guidance Sensors, which lock on two of them 40 times a second. If the computer falls silent, safe-mode electronics in bay 8 turn the arrays to the Sun.',
    key: 'Held to 0.007″ for 24 hours: about the width of a human hair seen from 1.6 km.',
    focus: ['Rate sensor unit 1', 'Rate sensor unit 2', 'Rate sensor unit 3', 'Gyro electronics control units', 'Fixed-head star trackers', 'Fine Guidance Sensor 1', 'Fine Guidance Sensor 2', 'Fine Guidance Sensor 3', 'FGS 1 star selectors & interferometers', 'FGS 2 star selectors & interferometers', 'FGS 3 star selectors & interferometers', 'Fine guidance electronics', 'Pointing/safemode electronics assembly', 'Retrieval mode gyro assembly', 'Coarse sun sensors (aft)'],
    mode: 'systems', explode: 0.35, view: { dir: [-0.6, -0.35, 1], fill: 1.0 },
  },
  {
    title: 'Power',
    body: 'Two rigid SA3 wings of gallium-arsenide cells give about 5.3 kW, turning to face the Sun. Through the 36 minutes of shadow each orbit, six nickel–hydrogen batteries in bays 2 and 3 take over. Watch the antenna masts swing out as after release in 1990; the arrays are the 2002 SA3 wings, their fold simplified.',
    key: 'The batteries cycle every orbit — about 5,500 times a year — so each has its own charge controller.',
    focus: ['Solar array wing (+V2)', 'Solar array wing (−V2)', 'Solar array drive & mast (+V2)', 'Solar array drive & mast (−V2)', 'Solar array power harness', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Charge current controllers', 'Power control unit', 'Power distribution units', 'Solar array drive electronics', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)'],
    demo: 'deploy', view: { dir: [0.5, 0.8, 0.75], fill: 0.72 },
  },
  {
    title: 'Talking through a relay',
    body: 'Hubble never talks straight to the ground. Its two steerable high-gain antennas aim at NASA\'s Tracking and Data Relay Satellites in geostationary orbit, which pass the data to White Sands and on to Goddard. Two low-gain antennas, one at each end, hear commands from almost any attitude, and recorders hold the data between contacts.',
    key: 'The relay is 36,000 km away even though Hubble is only about 500 km up.',
    focus: ['High-gain antenna (+V3)', 'High-gain antenna (−V3)', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)', 'HGA gimbal (+V3)', 'HGA gimbal (−V3)', 'Low-gain antenna (forward)', 'Low-gain antenna (aft)', 'RF cables & waveguide', 'S-band single-access transmitters', 'Multiple-access transponders', 'Solid-state recorder 1 (bay 5)', 'Solid-state recorder 3 (bay 5)', 'Engineering/science tape recorder (bay 8)', 'Science instrument command & data handling unit', 'Data management unit', ...DIUS],
    mode: 'systems', view: { dir: [0.4, 0.95, 0.55], fill: 0.95 },
  },
  {
    title: 'The equipment ring',
    body: 'Behind the forward shell the spacecraft widens to 4.2 m: twelve trapezoidal slots holding about 90 % of the electronics. Ten are equipment bays behind hinged doors that double as radiators; two carry the aft trunnions and scuff plates. Every box is a replaceable unit, and the batteries sit on the side away from the Sun.',
    key: 'Clockwise from +V3, looking forward: bays 8, 9, 10, trunnion, 1, 2, 3, 4, trunnion, 5, 6, 7.',
    focus: ['Equipment section', 'Data management unit', 'Flight computer (80486)', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Charge current controllers', 'Oscillators (bay 2)', 'Power control unit', 'Power distribution units', 'S-band single-access transmitters', 'Multiple-access transponders', 'Solid-state recorder 1 (bay 5)', 'Solid-state recorder 3 (bay 5)', 'Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Mechanism control unit', 'Solar array drive electronics', 'Pointing/safemode electronics assembly', 'Retrieval mode gyro assembly', 'Engineering/science tape recorder (bay 8)', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Science instrument command & data handling unit', 'NASA standard spacecraft computer (NSSC-I)', 'Control unit / science data formatters', 'Gyro electronics control units', ...DIUS.slice(0, 3), 'Aft trunnion pins'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.5, 0.78, 0.55], fill: 1.05 },
  },
  {
    title: 'Keeping the optics stable',
    body: 'In sunlight the blankets bake; in shadow they fall far below freezing, about 15 times a day. Insulation wraps the spacecraft, bay doors act as radiators, and heaters hold the mirrors near 21 °C. Here the shadow-side shells read cooler, and inside the ghosted aft shroud the cold NICMOS dewar and WFC3 detectors are darkest.',
    key: 'A radiator sheds P = ε σ A T⁴ — in vacuum, radiation is the only way to dump heat.',
    focus: ['Light shield', 'Forward shell', ...BAY_DOORS, ...NOBLS, 'WFC3 radiator', 'NCS radiator', 'Aft shroud cooling system', 'NICMOS dewar', 'WFC3 IR channel', 'WFC3 UVIS channel', 'STIS CCD', 'ACS Wide Field Channel', 'Primary mirror', 'Primary mirror heaters'],
    mode: 'thermal', view: { dir: [-0.75, -0.2, 1], fill: 0.9 },
  },
  {
    title: 'Built to be serviced',
    body: 'Hubble is the only telescope built to be repaired by astronauts. Five Shuttle crews, 1993–2009, grappled it, stood it on berthing pins and worked along 69 m of handrails, opening J-hook doors with power tools. The last crew left a soft-capture ring so a future spacecraft can dock to boost it or steer it down.',
    key: '225 ft of handrails, 31 foot-restraint sockets, ten equipment-bay doors and nine more on the OTA equipment section.',
    focus: ['EVA handrails (aft shroud)', 'EVA handrails (equipment section)', 'EVA handrails (forward shell)', 'EVA handrails (light shield)', 'Foot-restraint sockets', 'Scuff plates', 'Grapple fixtures', 'Soft capture mechanism', 'Relative-navigation targets', 'Berthing pins', '+V2 aft shroud doors (STIS, NICMOS)', '−V2 aft shroud doors (COS, ACS)', '−V3 aft shroud doors (gyros, star trackers)', 'Radial bay doors (FGS)', 'OTA equipment section doors', ...BAY_DOORS],
    view: { dir: [-0.9, 0.45, 0.75], fill: 1.0 },
  },
];
