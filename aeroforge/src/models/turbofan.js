// TF-90 — fictional high-bypass two-spool turbofan in museum-cutaway form.
// Every rotor row is real lofted, twisted blade geometry; the LP spool (fan, booster, LPT)
// and HP spool (HPC, HPT) turn at independent N1 / N2 speeds.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { lathe, loftRings, airfoilLoop, ringArray, beam, rod, mergeGeometries, orientOutward } from '../engine/geometry.js';
import { M } from '../engine/materials.js';

const CUT = Math.PI * 1.5;   // keep 270°, remove the quadrant facing the viewer

/** One blade lofted from hub to tip; local frame: engine axis = +Y, blade radial along +X. */
function bladeGeometry({ rHub, rTip, chordHub, chordTip, staggerHub, staggerTip, tHub = 0.08, tTip = 0.04, camber = 0.05, y = 0, stations = 5, n = 10, sweep = 0 }) {
  const rings = [];
  for (let k = 0; k <= stations; k++) {
    const f = k / stations;
    const r = rHub + (rTip - rHub) * f;
    const chord = chordHub + (chordTip - chordHub) * f;
    const st = ((staggerHub + (staggerTip - staggerHub) * f) * Math.PI) / 180;
    const t = tHub + (tTip - tHub) * f;
    const loop = airfoilLoop(t, n, 0, 1, camber);
    const ca = -Math.cos(st), ct = Math.sin(st);        // chord direction: aft + tangential
    const na = Math.sin(st), nt = Math.cos(st);         // thickness direction
    rings.push(loop.map(([xc, yt]) => {
      const c = (xc - 0.5) * chord, h = yt * chord;
      const ax = y + c * ca + h * na - sweep * f;
      const tg = c * ct + h * nt;
      return [r, ax, tg];
    }));
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

function row(opts, count, material, temp) {
  const g = ringArray(bladeGeometry(opts), count, 'y');
  g.computeVertexNormals();
  const m = mesh(g, material);
  if (temp) m.userData.temp = temp;
  return m;
}

function cutLathe(profile, material, { seg = 72, caps = true, closed = true } = {}) {
  const prof = closed ? profile.concat([profile[0]]) : profile;
  const group = new THREE.Group();
  const full = mesh(lathe(prof, seg, 0, Math.PI * 2), material);
  const cut = mesh(lathe(prof, Math.round(seg * 0.75), 0, CUT), material);
  cut.visible = false;
  group.add(full, cut);
  const capMeshes = [];
  if (caps && closed) {
    const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(r, y)));
    const capGeo = new THREE.ShapeGeometry(shape);
    for (const phi of [0, CUT]) {
      const c = mesh(capGeo, M.section(), { cast: false });
      c.rotation.y = phi - Math.PI / 2;
      c.visible = false;
      group.add(c);
      capMeshes.push(c);
    }
  }
  group.userData.cutaway = { full, cut, caps: capMeshes };
  return group;
}

function setCut(group, on) {
  const c = group.userData.cutaway;
  if (!c) return;
  c.full.visible = !on;
  c.cut.visible = on;
  for (const m of c.caps) m.visible = on;
}

// Core flow path (axial y → hub / tip radius) for particles and blade sizing
const CORE_PATH = [
  [0.95, 0.5, 0.82], [0.4, 0.52, 0.74], [0.2, 0.42, 0.66], [-0.95, 0.46, 0.52], [-1.05, 0.46, 0.64], [-1.55, 0.46, 0.64],
  [-1.65, 0.46, 0.62], [-1.9, 0.46, 0.62], [-2.0, 0.44, 0.66], [-2.75, 0.42, 0.82], [-2.9, 0.38, 0.84], [-3.7, 0.04, 0.9],
];
function coreRadius(y) {
  if (y >= CORE_PATH[0][0]) return [CORE_PATH[0][1], CORE_PATH[0][2]];
  for (let i = 1; i < CORE_PATH.length; i++) {
    if (y >= CORE_PATH[i][0]) {
      const [y0, h0, t0] = CORE_PATH[i - 1], [y1, h1, t1] = CORE_PATH[i];
      const f = (y - y0) / (y1 - y0);
      return [h0 + (h1 - h0) * f, t0 + (t1 - t0) * f];
    }
  }
  const last = CORE_PATH[CORE_PATH.length - 1];
  return [last[1], last[2]];
}

export function buildTurbofan() {
  const A = new Assembly();
  const eng = new THREE.Group();            // lathe frame: axis +Y (intake forward)
  eng.rotation.z = -Math.PI / 2;            // → engine axis along world +X
  eng.position.y = 2.3;
  A.root.add(eng);
  const P = (name, info, objs) => A.part(name, info, objs, eng);

  // cycle temperatures are pushed in by the lab (station id → K)
  const T = { '2': 288, '13': 330, '3': 900, '4': 1750, '45': 1250, '5': 870, '9': 760 };
  const lerpT = (a, b, f) => () => T[a] + (T[b] - T[a]) * f;

  const cutGroups = [];

  // ----------------------------------------------------------------- nacelle
  const nacMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
  const inlet = cutLathe([[1.5, 1.3], [1.5, 1.6], [1.52, 2.3], [1.55, 2.55], [1.6, 2.64], [1.66, 2.64], [1.71, 2.56], [1.77, 2.2], [1.79, 1.6], [1.78, 1.3]], nacMat);
  cutGroups.push(inlet);
  const inletPart = P('Inlet cowl', {
    system: 'Nacelle', material: 'Aluminium lip, acoustic honeycomb liner', mass: 380, explode: [0, 2.8, 0], temp: 288,
    desc: 'Diffuses the incoming flow to about Mach 0.6 at the fan face. The lip is bleed-air heated to prevent icing.',
    callout: true, anchor: [0, 2.7, 1.8],
  }, inlet);
  inletPart.userData.part.stationTemp = '2';
  const fanCowl = cutLathe([[1.42, -0.4], [1.5, 0.3], [1.5, 1.3], [1.78, 1.3], [1.74, 0.6], [1.67, -0.1], [1.6, -0.4]], nacMat);
  cutGroups.push(fanCowl);
  P('Fan cowl & thrust reverser', {
    system: 'Nacelle', material: 'Carbon-fibre cowls, cascade reverser', mass: 640, explode: [0, -0.4, 0], temp: 300,
    desc: 'Translating sleeve exposes cascade vanes that turn the bypass flow forward on landing.',
  }, fanCowl);

  // ----------------------------------------------------------------- fan
  const spinner = mesh(lathe([[0.001, 2.28], [0.12, 2.22], [0.26, 2.05], [0.38, 1.8], [0.46, 1.55], [0.49, 1.3]], 48), M.spinner());
  const fanBlades = row({ rHub: 0.47, rTip: 1.485, chordHub: 0.42, chordTip: 0.66, staggerHub: 28, staggerTip: 62, tHub: 0.1, tTip: 0.035, camber: 0.07, y: 1.55, stations: 7, n: 14, sweep: 0.12 }, 22, M.titanium(), () => T['2'] + (T['13'] - T['2']) * 0.5);
  const fanDisk = mesh(lathe([[0.15, 1.75], [0.5, 1.75], [0.5, 1.3], [0.15, 1.3]].concat([[0.15, 1.75]]), 48), M.gunmetal());
  const fanSpin = new THREE.Group();
  fanSpin.add(spinner, fanBlades, fanDisk);
  const fanPart = P('Fan rotor', {
    system: 'LP spool', material: 'Hollow titanium wide-chord blades', mass: 1400, explode: [0, 4.6, 0],
    desc: '22 swept wide-chord blades, 3.0 m tip diameter. At take-off the tips run supersonic (~Mach 1.4 relative) — the source of the "buzz-saw" noise.',
    callout: true, anchor: [0, 1.5, 1.35],
  }, fanSpin);
  fanPart.userData.part.stationTemp = '13';

  // ----------------------------------------------------------------- fan frame: OGVs + splitter
  const ogv = row({ rHub: 0.97, rTip: 1.49, chordHub: 0.22, chordTip: 0.24, staggerHub: -12, staggerTip: -14, tHub: 0.08, tTip: 0.08, camber: -0.06, y: 0.55, stations: 2, n: 8 }, 44, M.aluminium(), () => T['13']);
  const struts = row({ rHub: 0.86, rTip: 1.5, chordHub: 0.5, chordTip: 0.5, staggerHub: 0, staggerTip: 0, tHub: 0.12, tTip: 0.12, y: 0.15, stations: 1, n: 8 }, 8, M.gunmetal(), () => T['13']);
  P('Fan frame & outlet guide vanes', {
    system: 'Structure', material: 'Composite OGVs, titanium frame', mass: 520, explode: [0, 2.0, 0], temp: 330,
    desc: 'Outlet guide vanes remove the swirl the fan puts into the bypass stream; struts carry engine loads to the pylon.',
  }, [ogv, struts]);

  // ----------------------------------------------------------------- core cowl
  const coreCowlMat = new THREE.MeshStandardMaterial({ color: 0xa7adb3, roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide });
  const coreCowl = cutLathe([[0.82, 0.95], [0.84, 0.97], [0.88, 0.95], [0.98, 0.1], [0.99, -1.0], [0.96, -1.9], [0.86, -2.9], [0.84, -2.92], [0.84, -2.8], [0.88, -2.0], [0.7, -1.95], [0.68, -1.0], [0.6, -0.9], [0.68, 0.1], [0.8, 0.5]], coreCowlMat);
  cutGroups.push(coreCowl);
  const coreCowlPart = P('Core cowl', {
    system: 'Nacelle', material: 'Titanium / Inconel casings', mass: 460, explode: [0, 0, 0],
    desc: 'Splits the flow: about 1 kg of air in 10.5 goes through the core, the rest bypasses it for quiet, efficient thrust.',
  }, coreCowl);
  coreCowlPart.userData.part.stationTemp = '3';

  // ----------------------------------------------------------------- LP compressor (booster)
  const lpcRows = [];
  [0.85, 0.65, 0.45].forEach((y, i) => {
    const [hub, tip] = coreRadius(y);
    lpcRows.push(row({ rHub: hub, rTip: tip - 0.01, chordHub: 0.11, chordTip: 0.1, staggerHub: 40, staggerTip: 55, tHub: 0.08, tTip: 0.06, camber: 0.05, y, stations: 2, n: 8 }, 54, M.titanium(), lerpT('13', '3', 0.08 + i * 0.04)));
  });
  const lpcDrum = mesh(lathe([[0.48, 0.95], [0.5, 0.35], [0.4, 0.3], [0.4, 0.95], [0.48, 0.95]], 48), M.gunmetal());
  const lpcSpin = new THREE.Group();
  lpcSpin.add(...lpcRows, lpcDrum);
  const lpcStators = [0.75, 0.55, 0.35].map((y, i) => {
    const [hub, tip] = coreRadius(y);
    return row({ rHub: hub + 0.01, rTip: tip, chordHub: 0.08, chordTip: 0.08, staggerHub: -30, staggerTip: -35, tHub: 0.08, tTip: 0.08, camber: -0.04, y, stations: 1, n: 6 }, 64, M.aluminium(), lerpT('13', '3', 0.1 + i * 0.04));
  });
  P('LP compressor (booster)', {
    system: 'LP spool', material: 'Titanium blisks', mass: 330, explode: [0, 1.0, 0],
    desc: 'Three booster stages on the fan shaft supercharge the core before the high-pressure compressor.',
    callout: true, anchor: [0, 0.65, 0.95],
  }, [lpcSpin, ...lpcStators]);

  // ----------------------------------------------------------------- HP compressor
  const hpcYs = Array.from({ length: 9 }, (_, i) => 0.15 - i * 0.13);
  const hpcRows = hpcYs.map((y, i) => {
    const [hub, tip] = coreRadius(y);
    return row({ rHub: hub, rTip: tip - 0.008, chordHub: 0.07, chordTip: 0.065, staggerHub: 38, staggerTip: 50, tHub: 0.08, tTip: 0.06, camber: 0.05, y, stations: 1, n: 6 }, 48 + i * 4, M.titanium(), lerpT('13', '3', 0.2 + (i / 8) * 0.8));
  });
  const hpcStators = hpcYs.map((y, i) => {
    const [hub, tip] = coreRadius(y - 0.065);
    return row({ rHub: hub + 0.008, rTip: tip, chordHub: 0.05, chordTip: 0.05, staggerHub: -28, staggerTip: -32, tHub: 0.08, tTip: 0.08, camber: -0.04, y: y - 0.065, stations: 1, n: 6 }, 60 + i * 4, M.aluminium(), lerpT('13', '3', 0.25 + (i / 8) * 0.75));
  });
  const hpDrum = mesh(lathe([[0.42, 0.22], [0.47, -1.0], [0.47, -1.95], [0.36, -1.95], [0.36, 0.22], [0.42, 0.22]], 48), M.inconel());
  hpDrum.userData.temp = lerpT('3', '4', 0.1);
  const hpcSpin = new THREE.Group();
  hpcSpin.add(...hpcRows);
  const hpcPart = P('HP compressor', {
    system: 'HP spool', material: 'Ti-6246 front stages, Inconel 718 rear', mass: 610, explode: [0, -0.2, 1.9],
    desc: 'Nine stages raise the pressure to the overall ratio (≈ 42 : 1 at take-off). Blades shrink stage by stage as the air densifies.',
    callout: true, anchor: [0, -0.4, 0.75],
  }, [hpcSpin, ...hpcStators]);
  hpcPart.userData.part.stationTemp = '3';

  // ----------------------------------------------------------------- combustor
  const burnerMat = M.burner().clone();
  const liner = mesh(lathe([[0.47, -1.02], [0.6, -1.0], [0.63, -1.1], [0.63, -1.52], [0.5, -1.56], [0.47, -1.5], [0.47, -1.02]], 64), new THREE.MeshStandardMaterial({ color: 0x8b7a6a, roughness: 0.4, metalness: 0.9, side: THREE.DoubleSide }));
  const flame = mesh(lathe([[0.5, -1.08], [0.6, -1.1], [0.6, -1.48], [0.5, -1.5], [0.5, -1.08]], 64), burnerMat, { cast: false });
  flame.scale.set(0.99, 1, 0.99);
  flame.userData.temp = () => T['4'];
  const nozzles = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    nozzles.push(rod([Math.sin(a) * 0.72, -0.98, Math.cos(a) * 0.72], [Math.sin(a) * 0.55, -1.06, Math.cos(a) * 0.55], 0.018, 6).toNonIndexed());
  }
  const fuel = mesh(mergeGeometries(nozzles), M.copper());
  const comb = P('Annular combustor', {
    system: 'Hot section', material: 'Ceramic-matrix composite liner', mass: 180, explode: [0, -0.6, 2.6],
    desc: 'Twenty lean-burn fuel injectors. Gas exits at the turbine inlet temperature — hotter than the melting point of the turbine alloy.',
    callout: true, anchor: [0, -1.3, 0.75],
  }, [liner, flame, fuel]);
  comb.userData.part.stationTemp = '4';

  // ----------------------------------------------------------------- HP turbine
  const ngv = row({ rHub: 0.47, rTip: 0.62, chordHub: 0.09, chordTip: 0.09, staggerHub: -55, staggerTip: -55, tHub: 0.18, tTip: 0.16, camber: -0.12, y: -1.6, stations: 1, n: 8 }, 40, M.heatTint(), () => T['4'] * 0.97);
  const hptRows = [-1.7, -1.86].map((y, i) => row({ rHub: 0.47, rTip: 0.615, chordHub: 0.07, chordTip: 0.065, staggerHub: 52, staggerTip: 58, tHub: 0.16, tTip: 0.12, camber: 0.12, y, stations: 1, n: 8 }, 70, M.heatTint(), lerpT('4', '45', 0.35 + i * 0.5)));
  const hptSpin = new THREE.Group();
  hptSpin.add(...hptRows);
  const hpt = P('HP turbine', {
    system: 'HP spool', material: 'Single-crystal CMSX-4, thermal-barrier coated', mass: 260, explode: [0, -1.2, 2.2],
    desc: 'Two stages of film-cooled single-crystal blades drive the HP compressor at ~13,000 rpm.',
  }, [ngv, hptSpin]);
  hpt.userData.part.stationTemp = '45';

  // ----------------------------------------------------------------- LP turbine
  const lptYs = [-2.05, -2.22, -2.39, -2.56, -2.72];
  const lptRows = lptYs.map((y, i) => {
    const [hub, tip] = coreRadius(y);
    return row({ rHub: hub, rTip: tip - 0.01, chordHub: 0.08, chordTip: 0.075, staggerHub: 48, staggerTip: 56, tHub: 0.12, tTip: 0.08, camber: 0.1, y, stations: 2, n: 8 }, 90 + i * 6, M.inconel(), lerpT('45', '5', 0.15 + (i / 4) * 0.85));
  });
  const lptStators = lptYs.map((y, i) => {
    const [hub, tip] = coreRadius(y + 0.08);
    return row({ rHub: hub + 0.01, rTip: tip, chordHub: 0.06, chordTip: 0.06, staggerHub: -45, staggerTip: -48, tHub: 0.12, tTip: 0.1, camber: -0.1, y: y + 0.08, stations: 1, n: 6 }, 80 + i * 6, M.inconel(), lerpT('45', '5', 0.1 + (i / 4) * 0.85));
  });
  const lptSpin = new THREE.Group();
  lptSpin.add(...lptRows);
  const lpt = P('LP turbine', {
    system: 'LP spool', material: 'Titanium-aluminide (TiAl) blades', mass: 540, explode: [0, -2.6, 0],
    desc: 'Five stages extract the work that drives the fan and booster through the LP shaft, at about a third of HP spool speed.',
    callout: true, anchor: [0, -2.4, 0.85],
  }, [lptSpin, ...lptStators]);
  lpt.userData.part.stationTemp = '5';

  // ----------------------------------------------------------------- shafts
  const lpShaft = mesh(lathe([[0.12, 1.75], [0.12, -3.0], [0.09, -3.0], [0.09, 1.75], [0.12, 1.75]], 24), M.titanium());
  const lptDisks = mesh(lathe([[0.12, -1.98], [0.43, -2.0], [0.43, -2.78], [0.12, -2.8], [0.12, -1.98]], 48), M.inconel());
  lptDisks.userData.temp = lerpT('45', '5', 0.5);
  const lpShaftSpin = new THREE.Group();
  lpShaftSpin.add(lpShaft, lptDisks);
  P('LP & HP shafts', {
    system: 'Rotating group', material: 'Maraging steel LP shaft, Inconel HP drum', mass: 410, explode: [0, -0.5, -2.4],
    desc: 'Two concentric spools: the LP shaft runs inside the hollow HP drum, each on its own bearings and at its own speed.',
  }, [lpShaftSpin, hpDrum]);

  // ----------------------------------------------------------------- exhaust
  const plug = mesh(lathe([[0.38, -2.78], [0.4, -2.9], [0.32, -3.3], [0.16, -3.65], [0.001, -3.8]], 48), M.inconel());
  plug.userData.temp = () => T['5'];
  const exhaust = P('Exhaust plug & core nozzle', {
    system: 'Hot section', material: 'Inconel 625', mass: 120, explode: [0, -2.8, 0],
    desc: 'The core nozzle expands the hot stream to ambient pressure; the centre plug keeps the flow attached.',
  }, plug);
  exhaust.userData.part.stationTemp = '9';

  // ----------------------------------------------------------------- accessory gearbox (fan-case mounted, port side)
  const agb = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(0.5, 0.9, 0.36), M.gunmetal());
  box.position.set(0, 1.0, -1.92);
  agb.add(box);
  [[0.12, 1.28, -2.18], [-0.12, 0.86, -2.18], [0.16, 0.7, -2.16]].forEach(([x, y, z]) => {
    const c = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 16), M.aluminium());
    c.rotation.x = Math.PI / 2;
    c.position.set(x, y, z);
    agb.add(c);
  });
  P('Accessory gearbox', {
    system: 'Accessories', material: 'Magnesium casing', mass: 150, explode: [0, 0, -1.2], temp: 360,
    desc: 'Driven off the HP spool by a radial tower shaft: fuel pump, hydraulic pumps, oil system and the starter-generator.',
  }, agb);

  // ----------------------------------------------------------------- spools
  const spinGroups = { n1: [fanSpin, lpcSpin, lptSpin, lpShaftSpin], n2: [hpcSpin, hptSpin] };

  // ----------------------------------------------------------------- engine stand (GSE yellow), world frame
  const stand = new THREE.Group();
  const sg = [];
  for (const z of [-0.95, 0.95]) sg.push(beam([2.2, 0.32, z], [-3.4, 0.32, z], 0.16, 0.16));
  for (const x of [1.9, -0.2, -3.1]) sg.push(beam([x, 0.32, -0.95], [x, 0.32, 0.95], 0.14, 0.14));
  for (const [x, top] of [[0.6, 0.5], [-1.6, 1.3]]) {
    for (const z of [-0.6, 0.6]) sg.push(beam([x, 0.32, z * 1.5], [x, top, z], 0.12, 0.12));
    sg.push(beam([x, top, -0.6], [x, top, 0.6], 0.12, 0.12));
  }
  const frame = mesh(mergeGeometries(sg.map((g) => g.toNonIndexed())), M.gse());
  stand.add(frame);
  for (const x of [2.0, -3.2]) for (const z of [-0.95, 0.95]) {
    const w = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), M.rubber());
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.14, z);
    const fork = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.16), M.darkMetal());
    fork.position.set(x, 0.24, z);
    stand.add(w, fork);
  }
  const standPart = A.part('Transport stand', {
    system: 'Ground support', material: 'Painted steel', mass: 900, explode: [0, -0.6, 0], temp: 293,
    desc: 'Ground-support cradle used to move the engine around the shop; the yokes pick up the fan-case and core mounts.',
  }, stand);

  // ----------------------------------------------------------------- flow particles (lathe frame)
  const FLOW = 1600;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(FLOW * 3);
  const fCol = new Float32Array(FLOW * 3);
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const flowMat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flow = new THREE.Points(fGeo, flowMat);
  flow.userData.fx = true;
  flow.userData.keepInModes = true;
  flow.frustumCulled = false;
  flow.visible = false;
  eng.add(flow);
  const seeds = Array.from({ length: FLOW }, (_, i) => ({
    core: i % 10 === 0 || i % 10 === 5,
    y: 3.2 - Math.random() * 8,
    th: Math.random() * Math.PI * 2,
    f: 0.08 + Math.random() * 0.84,
  }));
  const tempColor = (K) => {
    const t = Math.min(1, Math.max(0, (K - 250) / 1500));
    // cool cyan → amber → white-hot
    const c = new THREE.Color();
    if (t < 0.5) c.setRGB(0.25 + t * 1.3, 0.75 - t * 0.2, 1.0 - t * 1.6);
    else c.setRGB(1.0, 0.65 + (t - 0.5) * 0.7, 0.2 + (t - 0.5) * 1.4);
    return c;
  };
  const coreTemp = (y) => {
    if (y > 0.95) return T['2'];
    if (y > 0.25) return T['13'];
    if (y > -1.0) return T['13'] + (T['3'] - T['13']) * ((0.25 - y) / 1.25);
    if (y > -1.6) return T['3'] + (T['4'] - T['3']) * Math.min(1, (-1.0 - y) / 0.25);
    if (y > -1.95) return T['4'] + (T['45'] - T['4']) * ((-1.6 - y) / 0.35);
    if (y > -2.8) return T['45'] + (T['5'] - T['45']) * ((-1.95 - y) / 0.85);
    return T['9'] + (T['5'] - T['9']) * Math.max(0, 1 + (y + 2.8) / 2.5);
  };

  A.finalize();

  const state = { throttle: 0.6, n1: 0, n2: 0, cutaway: true, flow: false, a1: 0, a2: 0 };
  const applyCut = (on) => { state.cutaway = on; cutGroups.forEach((g) => setCut(g, on)); };
  applyCut(true);

  const vehicle = {
    id: 'turbofan',
    designation: 'TF-90',
    name: 'CYCLONE',
    role: 'High-bypass turbofan',
    tagline: 'Two-spool · bypass ratio 9.5 · overall pressure ratio 42',
    summary: 'A widebody-class engine shown as a museum cutaway. Of every 10.5 kg of air the fan moves, 1 kg enters the core, is compressed 42-fold, burned at 1,750 K and expanded through two turbines that drive everything upstream. The rest bypasses the core and makes most of the thrust.',
    specs: [
      ['Fan diameter', '3.0 m'], ['Length', '6.1 m'], ['Bypass ratio', '9.5 : 1'], ['Overall PR', '42 : 1'],
      ['Turbine inlet', '1,750 K'], ['Take-off thrust', '≈ 400 kN'], ['Cruise TSFC', '≈ 17.9 g/(kN·s)'], ['Dry mass', '≈ 7,200 kg'],
    ],
    fleetTag: 'OPR 42',
    root: A.root,
    parts: A.parts,
    view: { dir: [0.85, 0.42, 1.25], fill: 1.2 },
    displaySize: 9,
    thermalRange: [250, 1900],
    state,
    stationT: T,
    setStations(stations) { for (const s of stations) T[s.id] = s.T; },
    setCutaway: applyCut,
    setFlow(on) { state.flow = on; flow.visible = on; },
    temperatureOf(info) {
      if (info.stationTemp) return T[info.stationTemp];
      return info.temp;
    },
    update(dt, t) {
      const thr = state.throttle;
      // N1 ≈ 2,400 rpm and N2 ≈ 13,000 rpm at 100 %; shown slowed so blades remain readable
      const n1 = (0.18 + 0.82 * Math.sqrt(thr)) * 9.0;
      const n2 = (0.4 + 0.6 * Math.sqrt(thr)) * 16.0;
      state.a1 += n1 * dt;
      state.a2 += n2 * dt;
      for (const g of spinGroups.n1) g.rotation.y = state.a1;
      for (const g of spinGroups.n2) g.rotation.y = state.a2;
      burnerMat.emissiveIntensity = 0.6 + thr * 3.2 * ((T['4'] - 900) / 900);
      if (state.flow) {
        const speed = 0.4 + thr * 1.2;
        for (let i = 0; i < FLOW; i++) {
          const s = seeds[i];
          let v, r, K;
          if (s.core) {
            v = s.y > 0.95 ? 1.4 : s.y > -1.0 ? 0.7 : s.y > -1.6 ? 0.5 : s.y > -2.8 ? 1.6 : 3.0;
            const [hub, tip] = s.y > 0.95 ? [0.5, 0.82] : coreRadius(s.y);
            r = hub + (tip - hub) * s.f;
            K = coreTemp(s.y);
            if (s.y < -1.0 && s.y > -2.8) s.th += dt * 2.2;
          } else {
            v = s.y > 1.6 ? 1.6 : 2.4;
            if (s.y > 1.6) r = 0.55 + s.f * 0.93;
            else if (s.y > -0.4) { const hub = 0.86 + Math.min(0.12, Math.max(0, (0.95 - s.y)) * 0.12); r = hub + (1.47 - hub) * s.f; }
            else r = 1.0 + s.f * 0.42 - (-0.4 - s.y) * 0.04;
            K = s.y > 1.5 ? T['2'] : T['13'];
            if (s.y < 1.55 && s.y > 1.25) s.th += dt * 3;
          }
          s.y -= v * speed * dt;
          if (s.y < (s.core ? -5.2 : -4.2)) { s.y = 3.2; s.th = Math.random() * Math.PI * 2; }
          fPos[i * 3] = Math.sin(s.th) * r;
          fPos[i * 3 + 1] = s.y;
          fPos[i * 3 + 2] = Math.cos(s.th) * r;
          const fade = s.y < -0.5 ? Math.max(0, 1 + (s.y + 0.5) / (s.core ? 4.5 : 3.6)) : Math.min(1, (3.2 - s.y) * 2);
          const c = tempColor(K);
          fCol[i * 3] = c.r * fade; fCol[i * 3 + 1] = c.g * fade; fCol[i * 3 + 2] = c.b * fade;
        }
        fGeo.attributes.position.needsUpdate = true;
        fGeo.attributes.color.needsUpdate = true;
      }
    },
  };
  void standPart;
  return vehicle;
}
