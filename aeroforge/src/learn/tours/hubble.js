// Guided tour: Hubble Space Telescope. See ../tours.js for the step format.
// Step bodies stay under about 265 characters and key ideas under about 85 (two lines) so the
// card's Back / Next row fits at 1280 × 800; the detail lives in the part cards. Systems-view steps
// frame their subject loosely (fill ≥ 1.2) and a little high (negative lift) so it stays clear of the
// Systems legend at the lower right.

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
    body: 'Hubble\'s 2.4 m mirror is no bigger than the 1917 Hooker telescope\'s. What sets it apart is altitude: 12 tonnes of spacecraft circling above the air every 95 minutes, where nothing blurs starlight and ultraviolet gets through. All of it keeps one mirror pointed, powered and cool.',
    key: 'θ = 1.22 λ / D = 0.052″ at 500 nm: about 15 times sharper than 0.8″ ground seeing.',
  },
  {
    title: 'The optical path',
    body: 'Light enters the open aperture door, passes the light shield\'s baffle rings and strikes the 2.4 m primary. Its cone converges 4.9 m forward onto the 0.3 m secondary, which sends it back through the 60 cm hole in the primary to a focus 1.5 m behind it. Baffles block every straight path.',
    key: 'f/24: a 57.6 m focal length folded into 6.4 m of tube.',
    focus: OPTICS, mode: 'xray', demo: 'bay', view: { dir: [0.18, 0.42, 1], fill: 0.95 },
  },
  {
    title: 'Two hyperbolic mirrors',
    body: 'Both mirrors are hyperboloids, a Ritchey–Chrétien design free of spherical aberration and coma. The primary is ULE glass, two faceplates fused to an egg-crate core: 828 kg, not 3.6 t. Heaters and 24 actuators sit behind it; the truss holds the secondary 4.906 m away to 2.5 µm.',
    key: 'Design conics: K₁ = −1.0023 (primary), K₂ = −1.4960 (secondary).',
    focus: ['Primary mirror', 'Primary mirror egg-crate core', 'Primary mirror rear faceplate', 'Primary mirror mounts & actuators', 'Primary mirror heaters', 'Reaction plate', 'Secondary mirror', 'Secondary mirror assembly', 'Metering truss', 'OTA kinematic mounts'],
    mode: 'systems', explode: 0.55, view: { dir: [0.95, 0.55, 0.8], fill: 1.3, lift: -0.3 },
  },
  {
    title: 'The flaw, and the fix',
    body: 'The first images in 1990 were blurred: the primary had been polished, very precisely, to the wrong shape, 2.2 µm too flat at the edge, because a test lens sat 1.3 mm out of place. In 1993 COSTAR and the new WFPC2 corrected the beam; later instruments carry the fix, so COSTAR left in 2009.',
    key: 'Only about 15 % of a star\'s light fell within 0.1″; the design called for roughly 70–80 %.',
    focus: ['Primary mirror', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'Pick-off mirrors'], mode: 'xray', view: { dir: [-0.35, 0.5, 1], fill: 1.1 },
  },
  {
    title: 'The science instruments',
    body: 'Four instruments the size of telephone booths fill the axial bays behind the primary: STIS, NICMOS (dormant since 2008), ACS, and COS in COSTAR\'s old bay. Wide Field Camera 3 fills the radial bay, its white radiator part of the skin. Together they span 115 nm to 2.5 µm.',
    key: 'Four axial bays, one radial camera, three guiders: each swappable in orbit.',
    focus: ['Space Telescope Imaging Spectrograph', 'Near Infrared Camera and Multi-Object Spectrometer', 'Advanced Camera for Surveys', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'WFC3 UVIS channel', 'WFC3 IR channel', 'WFC3 channel select mechanism', 'ACS Wide Field Channel', 'ACS Solar Blind Channel', 'ACS High Resolution Channel (inoperative)', 'STIS CCD', 'STIS MAMA detectors', 'STIS mode select mechanism', 'STIS low-voltage power supply (2009 repair)', 'ACS replacement CCD electronics (2009)', 'NICMOS dewar', 'COS optics select mechanism', 'COS far-UV detector', 'COS near-UV detector', 'Focal plane structure', 'WFC3 radiator', 'Pick-off mirrors'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.85, 0.5, 0.65], fill: 1.35, lift: -0.4 },
  },
  {
    title: 'Turning without thrusters',
    body: 'Hubble carries no thrusters and no propellant. Four reaction wheels in bays 6 and 9 turn it: spin a wheel faster one way and the telescope turns the other, 90° in about 15 minutes. Disturbance torques build up wheel speed; four magnetic torquer bars push on Earth\'s field to bleed it off.',
    key: 'Any three of the four skewed wheels can point the telescope; the fourth is a spare.',
    focus: ['Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Magnetic torquer bar 1', 'Magnetic torquer bar 2', 'Magnetic torquer bar 3', 'Magnetic torquer bar 4', 'Flight computer (80486)'],
    mode: 'systems', explode: 0.3, view: { dir: [0.45, 0.75, 0.9], fill: 1.3, lift: -0.25 },
  },
  {
    title: 'Pointing to 0.007″',
    body: 'Six gyroscopes in three rate sensor units feel every motion. Three star trackers fix the attitude to an arc-minute, enough to put guide stars in the Fine Guidance Sensors, which lock on two of them 40 times a second. If the computer falls silent, bay 8\'s safe-mode electronics turn the arrays to the Sun.',
    key: 'Held to 0.007″ for 24 hours: about the width of a human hair seen from 1.6 km.',
    focus: ['Rate sensor unit 1', 'Rate sensor unit 2', 'Rate sensor unit 3', 'Gyro electronics control units', 'Fixed-head star trackers', 'Fine Guidance Sensor 1', 'Fine Guidance Sensor 2', 'Fine Guidance Sensor 3', 'FGS 1 star selectors & interferometers', 'FGS 2 star selectors & interferometers', 'FGS 3 star selectors & interferometers', 'Fine guidance electronics', 'Pointing/safemode electronics assembly', 'Retrieval mode gyro assembly', 'Coarse sun sensors (aft)'],
    mode: 'systems', explode: 0.35, view: { dir: [-0.6, -0.35, 1], fill: 1.3, lift: -0.3 },
  },
  {
    title: 'Power',
    body: 'Two rigid SA3 wings of gallium-arsenide cells give about 5.3 kW, turning to face the Sun; six nickel–hydrogen batteries in bays 2 and 3 carry Hubble through 36 minutes of shadow each orbit. Watch the antenna masts swing out as in 1990 (the 2002 arrays\' fold is simplified).',
    key: 'The batteries cycle every orbit, about 5,500 times a year.',
    focus: ['Solar array wing (+V2)', 'Solar array wing (−V2)', 'Solar array drive & mast (+V2)', 'Solar array drive & mast (−V2)', 'Solar array power harness', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Charge current controllers', 'Power control unit', 'Power distribution units', 'Solar array drive electronics', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)'],
    demo: 'deploy', view: { dir: [0.5, 0.8, 0.75], fill: 0.72 },
  },
  {
    title: 'Talking through a relay',
    body: 'Hubble never talks straight to the ground. Two steerable high-gain antennas aim at NASA\'s geostationary Tracking and Data Relay Satellites, which relay to White Sands. Two low-gain antennas, one at each end, hear commands in almost any attitude; recorders hold data between contacts.',
    key: 'The relay is 36,000 km away; Hubble is only about 500 km up.',
    focus: ['High-gain antenna (+V3)', 'High-gain antenna (−V3)', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)', 'HGA gimbal (+V3)', 'HGA gimbal (−V3)', 'Low-gain antenna (forward)', 'Low-gain antenna (aft)', 'RF cables & waveguide', 'S-band single-access transmitters', 'Multiple-access transponders', 'Solid-state recorder 1 (bay 5)', 'Solid-state recorder 3 (bay 5)', 'Engineering/science tape recorder (bay 8)', 'Science instrument command & data handling unit', 'Data management unit', ...DIUS],
    mode: 'systems', view: { dir: [0.3, 0.6, 1], fill: 1.2 },
  },
  {
    title: 'The equipment ring',
    body: 'Behind the forward shell the spacecraft widens to 4.2 m: twelve trapezoidal slots hold about 90 % of the electronics. Ten are bays behind hinged doors that double as radiators; two carry the aft trunnions. Every box is a replaceable unit; the batteries sit on the side away from the Sun.',
    key: 'Clockwise from +V3, looking forward: 8, 9, 10, T, 1, 2, 3, 4, T, 5, 6, 7.',
    focus: ['Equipment section', 'Data management unit', 'Flight computer (80486)', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Charge current controllers', 'Oscillators (bay 2)', 'Power control unit', 'Power distribution units', 'S-band single-access transmitters', 'Multiple-access transponders', 'Solid-state recorder 1 (bay 5)', 'Solid-state recorder 3 (bay 5)', 'Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Mechanism control unit', 'Solar array drive electronics', 'Pointing/safemode electronics assembly', 'Retrieval mode gyro assembly', 'Engineering/science tape recorder (bay 8)', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Science instrument command & data handling unit', 'NASA standard spacecraft computer (NSSC-I)', 'Control unit / science data formatters', 'Gyro electronics control units', ...DIUS.slice(0, 3), 'Aft trunnion pins'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.5, 0.78, 0.55], fill: 1.2 },
  },
  {
    title: 'Keeping the optics stable',
    body: 'In sunlight the blankets bake; in shadow they fall far below freezing, about 15 times a day. Insulation wraps the spacecraft, bay doors and white panels act as radiators, and heaters hold the mirrors near 21 °C. Here the Sun-facing +V3 half of each shell reads hot, the shadow half cold.',
    key: 'A radiator sheds P = ε σ A T⁴: in vacuum, radiation is the only way to dump heat.',
    focus: ['Light shield', 'Forward shell', 'Aft shroud', ...BAY_DOORS, ...NOBLS, 'OTA equipment section doors', 'WFC3 radiator', 'NCS radiator', 'Aft shroud cooling system', '+V2 aft shroud doors (STIS, NICMOS)', '−V2 aft shroud doors (COS, ACS)', '−V3 aft shroud doors (gyros, star trackers)', 'Radial bay doors (FGS)', 'Aperture door'],
    mode: 'thermal', view: { dir: [-0.55, 0.12, 1], fill: 1.0 },
  },
  {
    title: 'Built to be serviced',
    body: 'Hubble is the only telescope built for astronauts to repair. Five Shuttle crews, 1993–2009, grappled it, stood it on berthing pins and worked along 69 m of handrails, opening J-hook doors. The last crew left a soft-capture ring so a future craft can dock to boost or de-orbit it.',
    key: '31 foot-restraint sockets; ten bay doors plus nine on the OTA equipment section.',
    focus: ['EVA handrails (aft shroud)', 'EVA handrails (equipment section)', 'EVA handrails (forward shell)', 'EVA handrails (light shield)', 'Foot-restraint sockets', 'Scuff plates', 'Grapple fixtures', 'Soft capture mechanism', 'Relative-navigation targets', 'Berthing pins', '+V2 aft shroud doors (STIS, NICMOS)', '−V2 aft shroud doors (COS, ACS)', '−V3 aft shroud doors (gyros, star trackers)', 'Radial bay doors (FGS)', 'OTA equipment section doors', ...BAY_DOORS],
    view: { dir: [-0.9, 0.45, 0.75], fill: 1.0 },
  },
];
