// Guided tour: Hubble Space Telescope. See ../tours.js for the step format.

const BAY_DOORS = [
  'Bay 1 door (data management)', 'Bay 2 door (battery module 1)', 'Bay 3 door (battery module 2)', 'Bay 4 door (power control)',
  'Bay 5 door (communications)', 'Bay 6 door (reaction wheels 1–2)', 'Bay 7 door (mechanism control)', 'Bay 8 door (pointing control)',
  'Bay 9 door (reaction wheels 3–4)', 'Bay 10 door (SI C&DH)',
];
const OPTICS = [
  'Primary mirror', 'Secondary mirror', 'Secondary mirror assembly', 'Secondary mirror spider', 'Secondary baffle',
  'Central baffle', 'Main baffle', 'Light shield internal baffles', 'Pick-off mirrors', 'Metering truss',
];

export default [
  {
    title: 'A telescope above the air',
    body: 'Hubble\'s 2.4 m mirror is no bigger than the 1917 Hooker telescope on Mount Wilson. What makes it special is where it is: 13.2 m and 12 tonnes of spacecraft circling above the atmosphere every 95 minutes, where nothing blurs starlight and ultraviolet light is not absorbed. Everything you see exists to keep one mirror pointed, powered, cool and clean.',
    key: 'Diffraction limit θ = 1.22 λ / D = 0.052″ at 500 nm — about 15 times sharper than 0.8″ ground seeing.',
  },
  {
    title: 'The optical path',
    body: 'Light enters through the open aperture door, runs down the light shield past ten stray-light baffles and strikes the 2.4 m primary. The primary sends a converging cone 4.9 m forward to the 0.3 m secondary, which reflects it back through a hole in the primary to a focus 1.5 m behind it. The central and secondary baffles block every direct path from the sky to the focal plane, and small pick-off mirrors share the field among the instruments.',
    key: 'f/24: a 57.6 m focal length folded into 6.4 m of tube.',
    focus: OPTICS, mode: 'xray', demo: 'bay', view: { dir: [0.18, 0.42, 1], fill: 0.95 },
  },
  {
    title: 'Two hyperbolic mirrors',
    body: 'Hubble is a Ritchey–Chrétien telescope: both mirrors are hyperboloids, chosen so that spherical aberration and coma cancel across a wide field. The primary is Corning ULE glass, a front and rear faceplate fused to an egg-crate core so it weighs 828 kg instead of about 3.6 t. It hangs inside a titanium main ring; behind it a beryllium reaction plate carries the heaters that hold it near 21 °C and 24 actuators that can nudge its surface. The 48-strut graphite-epoxy metering truss holds the secondary 4.906 m away to within 2.5 µm.',
    key: 'Design conics: K₁ = −1.0023 (primary), K₂ = −1.497 (secondary).',
    focus: ['Primary mirror', 'Primary mirror egg-crate core', 'Primary mirror rear faceplate', 'Primary mirror mounts & actuators', 'Primary mirror heaters', 'Reaction plate', 'Secondary mirror', 'Secondary mirror assembly', 'Main ring', 'Metering truss'],
    mode: 'systems', explode: 0.55, view: { dir: [-0.55, 0.4, 1], fill: 1.0 },
  },
  {
    title: 'The flaw, and the fix',
    body: 'The first images in 1990 were blurred. The primary had been polished, very precisely, to the wrong shape: a lens in the null corrector used to test it sat 1.3 mm out of place, leaving the edge 2.2 µm too flat. In 1993 astronauts installed COSTAR, five pairs of small mirrors that put the correction into the beams of three instruments, and WFPC2, a camera with the correction built in. Every later instrument carries its own correction, so COSTAR came home in 2009 and the Cosmic Origins Spectrograph took its bay.',
    key: 'Only about 15 % of a star\'s light fell within 0.1″ — the planned figure was roughly 70–80 %.',
    focus: ['Primary mirror', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'Pick-off mirrors'], mode: 'xray', view: { dir: [-0.35, 0.5, 1], fill: 1.1 },
  },
  {
    title: 'The science instruments',
    body: 'Four instruments the size of telephone booths slide into axial bays behind the primary: STIS, NICMOS (dormant since 2008), ACS and COS. Wide Field Camera 3 fills the one radial bay, its curved white radiator forming part of the skin. Together they cover 115 nm in the far ultraviolet to 2.5 µm in the infrared. Each was designed to be pulled out and replaced by spacewalkers.',
    key: 'Four axial bays, one radial camera, three guidance sensors: all latched to the focal-plane structure.',
    focus: ['Space Telescope Imaging Spectrograph', 'Near Infrared Camera and Multi-Object Spectrometer', 'Advanced Camera for Surveys', 'Cosmic Origins Spectrograph', 'Wide Field Camera 3', 'WFC3 UVIS channel', 'WFC3 IR channel', 'ACS Wide Field Channel', 'ACS Solar Blind Channel', 'STIS detectors', 'STIS mode select mechanism', 'NICMOS dewar', 'COS optics select mechanism', 'COS far-UV detector', 'Focal plane structure', 'WFC3 radiator', 'Pick-off mirrors'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.85, 0.45, 0.7], fill: 1.0 },
  },
  {
    title: 'Pointing to 0.007″',
    body: 'Hubble has no thrusters. Four reaction wheels in bays 6 and 9 turn it — spin a wheel one way and the telescope turns the other — slewing about 90° in 15 minutes. Six gyroscopes in three rate sensor units sense the motion, three fixed-head star trackers bring the error below a minute of arc, and then two Fine Guidance Sensors lock on guide stars 40 times a second. Four magnetic torquer bars on the forward shell push against the Earth\'s field to unload the wheels.',
    key: 'Held to 0.007″ for 24 hours: about the width of a human hair seen from 1.6 km.',
    focus: ['Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Rate sensor unit 1', 'Rate sensor unit 2', 'Rate sensor unit 3', 'Gyro electronics control units', 'Fine Guidance Sensor 1', 'Fine Guidance Sensor 2', 'Fine Guidance Sensor 3', 'Fine guidance electronics', 'Fixed-head star trackers', 'Magnetic torquer bar 1', 'Magnetic torquer bar 2', 'Magnetic torquer bar 3', 'Magnetic torquer bar 4', 'Magnetometers', 'Coarse sun sensors (forward)', 'Coarse sun sensors (aft)', 'Pointing control electronics', 'Flight computer (80486)'],
    mode: 'systems', explode: 0.45, view: { dir: [0.35, 0.6, 1], fill: 1.0 },
  },
  {
    title: 'Power',
    body: 'Two rigid SA3 wings, each 7.1 × 2.6 m of gallium-arsenide cells, produce roughly 5 kW in sunlight and turn on their drives to face the Sun. For the 36 minutes of each orbit spent in Earth\'s shadow, six nickel–hydrogen batteries in bays 2 and 3 carry the load. Watch the arrays and antenna masts swing out and unfold as they did after release.',
    key: 'A 95-minute orbit spends up to 36 minutes in Earth\'s shadow, so the batteries cycle every orbit — about 5,500 times a year.',
    focus: ['Solar array wing (+V2)', 'Solar array wing (−V2)', 'Solar array drive & mast (+V2)', 'Solar array drive & mast (−V2)', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Power control unit', 'Power distribution units', 'Solar array drive electronics', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)'],
    demo: 'deploy', view: { dir: [0.5, 0.8, 0.75], fill: 0.72 },
  },
  {
    title: 'Talking through a relay',
    body: 'Hubble never talks straight to the ground. Its two steerable high-gain antennas aim at NASA\'s Tracking and Data Relay Satellites in geostationary orbit, which pass the data to White Sands, New Mexico, and on to the Space Telescope Operations Control Center at Goddard. Two low-gain antennas, one at each end, receive commands from almost any attitude. Solid-state recorders hold the data between contacts.',
    key: 'The relay is 36,000 km away even though Hubble is only about 500 km up.',
    focus: ['High-gain antenna (+V3)', 'High-gain antenna (−V3)', 'High-gain antenna mast (+V3)', 'High-gain antenna mast (−V3)', 'HGA gimbal (+V3)', 'HGA gimbal (−V3)', 'Low-gain antenna (forward)', 'Low-gain antenna (aft)', 'S-band transmitters & transponders', 'Solid-state recorder (bay 5)', 'Solid-state recorder (bay 8)', 'Science instrument command & data handling unit', 'Data management unit', 'Data interface units', 'Flight computer (80486)'],
    mode: 'systems', view: { dir: [0.75, 0.25, 1], fill: 1.0 },
  },
  {
    title: 'The equipment ring',
    body: 'Behind the forward shell the spacecraft widens to 4.2 m: a ring of twelve trapezoidal slots holding about 90 % of the electronics. Ten are equipment bays, each behind a hinged door that doubles as a radiator; two carry the launch trunnions. Every box is an orbital replacement unit with handles and connectors on its open face. The layout follows the heat: the batteries sit in bays 2 and 3, on the side that faces away from the Sun.',
    key: 'Clockwise from +V3, looking forward: bays 8, 9, 10, trunnion, 1, 2, 3, 4, trunnion, 5, 6, 7.',
    focus: ['Equipment section', 'Data management unit', 'Flight computer (80486)', 'Battery module 1 (bay 2)', 'Battery module 2 (bay 3)', 'Oscillators (bay 2)', 'Power control unit', 'Power distribution units', 'S-band transmitters & transponders', 'Solid-state recorder (bay 5)', 'Reaction wheel assembly 1', 'Reaction wheel assembly 2', 'Mechanism control unit', 'Solar array drive electronics', 'Pointing control electronics', 'Solid-state recorder (bay 8)', 'Reaction wheel assembly 3', 'Reaction wheel assembly 4', 'Science instrument command & data handling unit', 'Gyro electronics control units', 'Data interface units', 'Aft trunnion pins'],
    mode: 'systems', explode: 0.6, view: { dir: [-0.5, 0.78, 0.55], fill: 1.05 },
  },
  {
    title: 'Keeping the optics stable',
    body: 'In sunlight the outer blankets bake; in shadow they plunge far below freezing, about 15 times a day. Silvered-Teflon insulation wraps the spacecraft, the bay doors and instrument faces act as radiators, and heaters hold the optics near room temperature so the mirror spacing stays fixed to a few micrometres. Thermal view shows the split: the cold detectors inside NICMOS and WFC3 are the darkest spots.',
    key: 'A radiator sheds P = ε σ A T⁴ — in vacuum, radiation is the only way to dump heat.',
    mode: 'thermal', view: { dir: [0.5, 0.5, 1], fill: 0.95 },
  },
  {
    title: 'Built to be serviced',
    body: 'Hubble is the only telescope designed to be repaired by astronauts. Shuttle crews visited five times, from 1993 to 2009, grappling it with the robot arm, standing it on berthing pins in the payload bay and working along 69 m of handrails. Doors open with J-hooks and every latch and hinge has a hex fitting for a power tool. The last crew left a soft-capture ring on the aft bulkhead so a future spacecraft can dock — to boost it, or to guide it safely into the ocean.',
    key: '225 ft of handrails, 31 foot-restraint sockets, ten equipment-bay doors and ten more on the OTA equipment section.',
    focus: ['EVA handrails', 'Foot-restraint sockets', 'Grapple fixtures', 'Soft capture mechanism', 'Relative-navigation targets', 'Berthing pins', 'Aft shroud access doors', 'Radial bay doors (FGS)', 'OTA equipment section', ...BAY_DOORS],
    view: { dir: [-0.9, 0.45, 0.75], fill: 1.0 },
  },
];
