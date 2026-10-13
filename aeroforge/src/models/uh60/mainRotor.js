// UH-60M main rotor: fully articulated titanium hub with one laminated elastomeric bearing per
// blade (the bearing's focal point is the flap, lead-lag and pitch hinge, 0.381 m from the shaft),
// hydraulic lead-lag dampers, pitch horns and control rods, droop stops and flap restrainers,
// the hub-mounted bifilar vibration absorber, de-ice slip ring, rotating and stationary
// swashplates on a uniball, scissors, three primary servos, and four wide-chord blades.
//
// Head frame: origin at the hub centre, y along the shaft (tilted 3° forward), blade 1 along +x.
// The rotor turns counter-clockwise seen from above (+y rotation): the advancing blade is on the right.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { loftRings, orientOutward, airfoilLoop } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, place, unitRod, aimRod, canvasTex } from './common.js';

export const HUB = { x: 0, y: 3.33, tilt: 3 * DEG };
const E = 0.381;          // hinge offset (elastomeric-bearing focal point), m
const R = 8.18;           // rotor radius, m
const CHORD = 0.58;       // wide-chord blade (estimate, see physics/rotor.js)
const TWIST = -18 * DEG;  // root-to-tip twist, referenced to 0.75 R
const HORN = { x: 0.47, y: -0.065, z: -0.25 };   // pitch-horn ball end (leading side), hub coordinates
const LH = -HORN.z;                              // horn arm about the feathering axis
const PHI_H = Math.atan2(-HORN.z, HORN.x);        // link lead ahead of the blade (~28°)
const RS = Math.hypot(HORN.x, HORN.z);            // pitch-link radius on the rotating swashplate
const YS0 = -0.43;                                // rotating swashplate height below the hub
const SERVO_AZ = [0, Math.PI, Math.PI / 2];       // forward, aft, lateral (left) primary servos
const RV = 0.4;

/** Wide-chord main-rotor blade in its feathering frame: x radial from the hinge, LE toward −z. */
function bladeGeometry() {
  const n = 22;
  const loop = airfoilLoop(0.095, n, 0, 1, 0.012);   // SC2110-class section, ~9.5 % thick
  const stations = [0.92, 1.0, 1.12, 1.28, 1.45, 1.6];
  for (let r = 1.95; r < 7.55; r += 0.38) stations.push(r);
  for (let k = 0; k <= 7; k++) stations.push(7.61 + ((R - 7.61) * k) / 7);
  const rings = stations.map((r) => {
    const root = Math.max(0, Math.min(1, (1.6 - r) / 0.68));      // 1 at the cuff fitting → 0 at full section
    const tip = Math.max(0, (r - 7.61) / (R - 7.61));              // swept, tapered, anhedral tip
    const chord = (CHORD * (1 - 0.62 * root)) * (1 - 0.4 * tip * tip);
    const sweep = (r > 7.61 ? (r - 7.61) * Math.tan(20 * DEG) : 0) * 0.85;
    const thick = 0.095 + root * 0.42;
    const tw = TWIST * ((Math.max(r, 1.6) - 0.75 * R) / R);
    const anh = -0.07 * tip * tip;
    const c = Math.cos(tw), s = Math.sin(tw);
    return loop.map(([xc, yt]) => {
      // blend the airfoil into an elliptical root fitting
      const ell = Math.sign(yt) * 0.5 * Math.sqrt(Math.max(0, 1 - (2 * xc - 1) ** 2)) * thick * 0.95;
      const ya = root > 0 ? (1 - root) * yt + root * ell : yt;
      const zl = -0.25 * chord + xc * chord + sweep;   // feathering axis at quarter chord
      const yl = ya * chord;
      // twist about the feathering axis (x): LE up for positive pitch
      return [r - E, yl * c - zl * s + anh, yl * s + zl * c];
    });
  });
  const g = orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
  // trim tab at the trailing edge, ~0.7 R
  const tab = new THREE.BoxGeometry(0.62, 0.005, 0.06).translate(5.85 - E, 0, 0.75 * CHORD + 0.025);
  return merge([g, tab]);
}

function bladeMaterial() {
  // u runs root → tip, v around the section (LE at v ≈ 0.5): paint, nickel erosion strip, tip cap
  const uTip = (7.61 - 0.92) / (R - 0.92), uRoot = (1.3 - 0.92) / (R - 0.92);
  const map = canvasTex('uh60.blade', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e3230'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#383d3a'; ctx.fillRect(uTip * w, 0, w, h);
    ctx.fillStyle = '#8f969b'; ctx.fillRect(0, h * 0.455, w, h * 0.09);
    ctx.fillStyle = '#6e7377'; ctx.fillRect(0, 0, uRoot * w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(uTip * w - 1, 0, 2, h);
  });
  const orm = canvasTex('uh60.bladeOrm', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(255,160,20)'; ctx.fillRect(0, 0, w, h);          // G roughness 0.63, B metal 0.08
    ctx.fillStyle = 'rgb(255,80,240)'; ctx.fillRect(0, h * 0.455, w, h * 0.09);
    ctx.fillStyle = 'rgb(255,100,220)'; ctx.fillRect(0, 0, uRoot * w, h);
  }, { srgb: false });
  return new THREE.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 });
}

/** Elastomeric bearing: alternating rubber and steel laminates along the blade axis. */
function bearing(rubber, steel) {
  for (let k = 0; k < 11; k++) {
    const x = 0.336 + k * 0.009;
    const r = 0.074 - Math.abs(k - 5) * 0.0025;
    (k % 2 ? steel : rubber).push(cyl(r, r, 0.009, [x, 0, 0], 'x', 20));
  }
  steel.push(cyl(0.078, 0.078, 0.014, [0.33, 0, 0], 'x', 20), cyl(0.078, 0.078, 0.014, [0.44, 0, 0], 'x', 20));
}

export function buildMainRotor({ A, parent }) {
  const head = new THREE.Group();
  head.position.set(HUB.x, HUB.y, 0);
  head.rotation.z = -HUB.tilt;                    // shaft leans 3° forward
  parent.add(head);
  const spin = new THREE.Group();
  head.add(spin);
  const swash = new THREE.Group();
  head.add(swash);
  const swashSpin = new THREE.Group();
  swash.add(swashSpin);
  const UPX = 2.6;                                // exploded view: the whole head rises this far
  const P = (name, info, objs, par = spin) => A.part(name, { system: 'Rotor system', ...info }, objs, par);
  const blades = [0, 1, 2, 3];
  const chains = [];                              // per part: four replicated blade chains
  const makeChains = (partGroup) => blades.map((i) => {
    const az = new THREE.Group(); az.rotation.y = (i * Math.PI) / 2;
    const hinge = new THREE.Group(); hinge.position.x = E;
    const lag = new THREE.Group(), flap = new THREE.Group(), feather = new THREE.Group();
    partGroup.add(az); az.add(hinge); hinge.add(lag); lag.add(flap); flap.add(feather);
    const c = { i, az, hinge, lag, flap, feather };
    chains.push(c);
    return c;
  });

  // ------------------------------------------------------------------ blades
  const bladeG = bladeGeometry();
  const bladeM = bladeMaterial();
  const bladeChains = [];
  for (const i of blades) {
    const holder = new THREE.Group();
    P(`Main rotor blade ${i + 1}`, {
      material: 'Composite (graphite/glass) spar, Nomex core, nickel erosion strip, heater mats', mass: 120, explode: [2.0, UPX + 0.4, 0],
      desc: i === 0
        ? 'Wide-chord blade of the M model: new high-lift airfoils and a swept, tapered tip with anhedral that lift about 230 kg more than the UH-60L blade. 7.8 m long with −18° of twist; heater mats in the leading edge de-ice it. (Spar material per NASA test reports: graphite/glass composite; earlier UH-60A/L blades used a titanium spar.)'
        : `One of four identical blades, 90° apart. At 258 rpm the tip moves at 221 m/s — Mach 0.65 in the hover and about Mach 0.88 on the advancing side at 150 kt.`,
    }, holder);
    const az = new THREE.Group(); az.rotation.y = (i * Math.PI) / 2;
    const hinge = new THREE.Group(); hinge.position.x = E;
    const lag = new THREE.Group(), flap = new THREE.Group(), feather = new THREE.Group();
    holder.add(az); az.add(hinge); hinge.add(lag); lag.add(flap); flap.add(feather);
    const m = mesh(bladeG, bladeM);
    feather.add(m);
    const c = { i, az, hinge, lag, flap, feather };
    chains.push(c);
    bladeChains.push(c);
  }

  // ------------------------------------------------------------------ hub
  const plate = (() => {
    const s = new THREE.Shape();
    const arm = 0.15, core = 0.2, tipR = 0.5;
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const rot = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      pts.push(rot(core, -arm), rot(tipR - 0.04, -arm), rot(tipR, -arm + 0.04), rot(tipR, arm - 0.04), rot(tipR - 0.04, arm), rot(core, arm));
    }
    s.moveTo(...pts[0]);
    for (const p of pts.slice(1)) s.lineTo(...p);
    s.closePath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const hole = new THREE.Path();
      const rot = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      const q = [rot(0.25, -0.085), rot(0.43, -0.085), rot(0.43, 0.085), rot(0.25, 0.085)];
      hole.moveTo(...q[0]); for (const p of q.slice(1)) hole.lineTo(...p); hole.closePath();
      s.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);   // shape x → x, shape y → −z
    return g;
  })();
  const hubParts = [place(plate.clone(), [0, 0.085, 0]), place(plate.clone(), [0, -0.127, 0])];
  hubParts.push(cyl(0.18, 0.18, 0.2, [0, 0, 0], 'y', 28));
  for (const i of blades) {
    const a = (i * Math.PI) / 2;
    const bridge = box(0.05, 0.24, 0.3, [0.475, 0, 0]);
    bridge.rotateY(a);
    hubParts.push(bridge);
    // damper lug on the leading side of each arm
    const lug = box(0.07, 0.06, 0.07, [0.22, 0, -0.2]); lug.rotateY(a); hubParts.push(lug);
  }
  P('Main rotor hub', {
    material: 'One-piece forged titanium hub', mass: 270, explode: [0, UPX + 0.5, 0],
    desc: 'A single titanium forging with four arms. Each arm holds one elastomeric bearing, so the hub has no flapping or lagging hinge pins to lubricate — about 60 % fewer parts than a conventional articulated head.',
    callout: true, anchor: [0, 0.35, 0],
  }, [mesh(merge(hubParts), MAT.titanium())]);

  const rubber = [], steel = [];
  for (const i of blades) {
    const r = [], s = [];
    bearing(r, s);
    for (const g of [...r, ...s]) g.rotateY((i * Math.PI) / 2);
    rubber.push(...r); steel.push(...s);
  }
  P('Elastomeric bearings', {
    material: 'Laminated natural rubber and steel shims', mass: 18, count: 4, explode: [0, UPX + 0.15, 0],
    desc: 'Each bearing is a stack of thin rubber layers bonded between curved steel shims. The rubber shears to let the blade flap, lead-lag and change pitch about one focal point 0.381 m from the shaft, while the stack carries the blade\'s ~30-tonne centrifugal pull in compression.',
  }, [mesh(merge(rubber), MAT.elastomer()), mesh(merge(steel), MAT.steel())]);

  // spindles & cuffs (move with the blade)
  const spindleParts = [
    cyl(0.07, 0.07, 0.05, [0.3 - E, 0, 0], 'x', 16),                         // inboard flange inside the arm window
    cyl(0.056, 0.05, 0.4, [0.5 - E, 0, 0], 'x', 16),                        // spindle through the bridge
    cyl(0.07, 0.07, 0.07, [0.7 - E, 0, 0], 'x', 16),
    box(0.3, 0.028, 0.2, [0.83 - E, 0.06, 0]), box(0.3, 0.028, 0.2, [0.83 - E, -0.06, 0]),   // cuff clevis
    cyl(0.02, 0.02, 0.15, [0.78 - E, 0, 0], 'y', 10), cyl(0.02, 0.02, 0.15, [0.9 - E, 0, 0], 'y', 10),  // blade (fold) pins
  ];
  const spindleG = merge(spindleParts);
  const spindlePart = P('Blade spindles & cuffs', {
    material: 'Titanium spindles, steel blade-retention pins', mass: 22, count: 4, explode: [0, UPX - 0.15, 0],
    desc: 'The spindle runs from the inner race of the elastomeric bearing out through the hub arm to the cuff that clamps the blade root with two pins; pulling one pin lets the blade fold back for shipping.',
  }, []);
  for (const c of makeChains(spindlePart)) c.feather.add(mesh(spindleG, MAT.titanium()));

  const hornG = merge([
    tube([0.55 - E, 0, -0.04], [HORN.x - E, HORN.y, HORN.z], 0.024, 10),
    cyl(0.03, 0.03, 0.05, [HORN.x - E, HORN.y, HORN.z], 'y', 12),
    box(0.06, 0.06, 0.12, [0.55 - E, 0, -0.06]),
  ]);
  const hornPart = P('Pitch horns', {
    material: 'Forged steel horns', mass: 4, count: 4, explode: [0, UPX - 0.35, 0],
    desc: 'A lever on each spindle, ahead of the blade. Pushing its ball end up raises the leading edge: more pitch, more lift for that blade.',
  }, []);
  for (const c of makeChains(hornPart)) c.feather.add(mesh(hornG, MAT.steel()));

  // droop stops and flap restrainers (static on the hub, beneath/above each spindle)
  const stops = [];
  for (const i of blades) {
    for (const g of [box(0.07, 0.04, 0.09, [0.29, -0.155, 0]), box(0.06, 0.035, 0.08, [0.29, 0.14, 0]), cyl(0.02, 0.02, 0.1, [0.29, -0.13, 0.05], 'z', 8)]) { g.rotateY((i * Math.PI) / 2); stops.push(g); }
  }
  P('Droop stops & flap restrainers', {
    material: 'Steel stops with centrifugal-weight latches', mass: 8, count: 4, explode: [0, UPX + 0.05, 0.0],
    desc: 'At low rotor speed spring-loaded stops hold the blades from drooping onto the tail cone or flapping up in gusts; above about 50 % rpm centrifugal weights swing them clear so the blades fly freely.',
  }, [mesh(merge(stops), MAT.steel())]);

  // lead-lag dampers (hub lug → spindle), rebuilt every frame
  const damperPart = P('Lead-lag dampers', {
    material: 'Hydraulic dampers with integral reservoirs', mass: 9, count: 4, explode: [0, UPX - 0.05, 0],
    desc: 'One hydraulic damper per blade restrains the lead-lag motion. Without them the in-plane blade motion could couple with the fuselage rocking on its gear in the destructive instability called ground resonance.',
  }, []);
  const dampers = blades.map((i) => {
    const body = mesh(unitRod(14), MAT.hydraulic());
    const rod = mesh(unitRod(10), MAT.steel());
    damperPart.add(body, rod);
    const a = (i * Math.PI) / 2;
    const hubEnd = V3(0.22, 0, -0.2).applyAxisAngle(V3(0, 1, 0), a);
    return { i, body, rod, hubEnd, local: V3(0.68 - E, 0, -0.1) };
  });

  // bifilar vibration absorber
  const bifBase = [cyl(0.15, 0.13, 0.08, [0, 0.16, 0], 'y', 24), cyl(0.1, 0.1, 0.1, [0, 0.25, 0], 'y', 20)];
  const bifMasses = [];
  const bifPart = P('Bifilar vibration absorber', {
    material: 'Steel arms and tuned tungsten-alloy masses on bifilar pins', mass: 110, explode: [0, UPX + 1.2, 0],
    desc: 'Four tuned masses hang from the arms on two pins each (hence "bifilar"), free to swing in the plane of the rotor. Tuned to three cycles per revolution in the rotating hub, they cancel the dominant four-per-rev vibration before it reaches the fuselage.',
    callout: true, anchor: [0, 0.32, 0],
  }, []);
  for (const i of blades) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const arm = box(0.34, 0.06, 0.09, [0.25, 0.2, 0]); arm.rotateY(a); bifBase.push(arm);
    const pivot = new THREE.Group();
    pivot.position.set(0.42 * Math.cos(a), 0.2, -0.42 * Math.sin(a));
    pivot.rotation.y = a;
    const massG = merge([cyl(0.075, 0.075, 0.17, [0.03, -0.01, 0], 'z', 18), cyl(0.016, 0.016, 0.2, [0, 0.02, 0.045], 'y', 8), cyl(0.016, 0.016, 0.2, [0, 0.02, -0.045], 'y', 8)]);
    pivot.add(mesh(massG, MAT.darkMetal()));
    bifPart.add(pivot);
    bifMasses.push(pivot);
  }
  bifPart.add(mesh(merge(bifBase), MAT.steel()));

  P('Blade de-ice slip ring & distributor', {
    system: 'Electrical', material: 'Slip-ring assembly and timer-distributor', mass: 14, explode: [0, UPX + 1.7, 0],
    desc: 'Carries de-ice power from the airframe into the turning rotor and switches it through the blade heater mats in sequence, shedding ice in small pieces. Main and tail rotor de-ice are standard on the UH-60M.',
  }, [mesh(merge([cyl(0.085, 0.09, 0.09, [0, 0.345, 0], 'y', 20), cyl(0.05, 0.075, 0.04, [0, 0.41, 0], 'y', 20)]), MAT.casting())]);

  P('Main rotor shaft', {
    system: 'Drive system', material: 'Steel shaft splined to the transmission output', mass: 90, explode: [0, UPX - 0.9, 0],
    desc: 'Driven at 258 rpm by the main module\'s planetary stage. It carries the rotor\'s full lift — about 100 kN at maximum weight — down into the transmission and the roof beams.',
  }, [mesh(merge([cyl(0.095, 0.095, 0.82, [0, -0.32, 0], 'y', 24), cyl(0.13, 0.13, 0.05, [0, -0.08, 0], 'y', 24)]), MAT.steel())]);

  // rotating scissors (drive the rotating swashplate)
  const sc = [];
  for (const a of [Math.PI / 4 + Math.PI / 2, Math.PI / 4 - Math.PI / 2]) {
    const d = V3(Math.cos(a), 0, -Math.sin(a));
    const p0 = V3(0, -0.16, 0).addScaledVector(d, 0.13), knee = V3(0, -0.27, 0).addScaledVector(d, 0.27), p1 = V3(0, YS0 + 0.02, 0).addScaledVector(d, 0.24);
    sc.push(tube(p0, knee, 0.02, 8), tube(knee, p1, 0.02, 8), cyl(0.026, 0.026, 0.05, [knee.x, knee.y, knee.z], 'y', 8));
  }
  P('Rotating scissors', {
    material: 'Steel scissor links with spherical bearings', mass: 6, count: 2, explode: [0, UPX - 0.6, 0],
    desc: 'Hinged links that make the rotating swashplate turn with the shaft while still letting it slide up and down and tilt.',
  }, [mesh(merge(sc), MAT.steel())]);

  // swashplates
  const rotRing = [cyl(0.3, 0.3, 0.05, [0, 0, 0], 'y', 32), cyl(0.2, 0.2, 0.07, [0, 0, 0], 'y', 24)];
  for (const i of blades) {
    const a = (i * Math.PI) / 2 + PHI_H;
    const arm = box(RS - 0.22, 0.045, 0.08, [(RS + 0.22) / 2, 0, 0]); arm.rotateY(a); rotRing.push(arm);
    const cl = cyl(0.028, 0.028, 0.07, [RS, 0, 0], 'y', 10); cl.rotateY(a); rotRing.push(cl);
  }
  A.part('Rotating swashplate', {
    system: 'Rotor system', material: 'Aluminium-alloy ring on a duplex bearing', mass: 32, explode: [0, UPX - 1.3, 0],
    desc: 'Turns with the rotor. Its four arms carry the pitch control rods, so wherever the swashplate is high, the blade passing over it takes more pitch.',
  }, [mesh(merge(rotRing), MAT.casting())], swashSpin);
  const statRing = [cyl(0.33, 0.33, 0.06, [0, -0.08, 0], 'y', 32), place(new THREE.SphereGeometry(0.13, 18, 12), [0, -0.04, 0])];
  for (const a of SERVO_AZ) {
    const lug = box(0.12, 0.05, 0.09, [RV - 0.03, -0.09, 0]); lug.rotateY(a); statRing.push(lug);
  }
  const g = box(0.12, 0.05, 0.08, [0.36, -0.09, 0]); g.rotateY(-Math.PI / 2); statRing.push(g);
  A.part('Stationary swashplate', {
    system: 'Flight controls', material: 'Aluminium-alloy ring on a uniball', mass: 28, explode: [0, UPX - 1.6, 0],
    desc: 'Does not turn. The three primary servos raise it together for collective and tilt it for cyclic; the uniball at its centre lets it tilt in any direction while sliding along the guide.',
    callout: true, anchor: [0, -0.06, -0.38],
  }, [mesh(merge(statRing), MAT.casting())], swash);

  // pitch control rods (rotating swashplate → horn), rebuilt every frame
  const rodPart = P('Pitch control rods', {
    material: 'Steel tubes with rod-end bearings and turnbuckles', mass: 3, count: 4, explode: [0, UPX - 0.95, 0],
    desc: 'Fixed-length rods: every movement of the swashplate reaches a blade through one of them. Adjusting their length at the turnbuckle is how the blades are tracked to fly in one plane.',
  }, []);
  const rods = blades.map((i) => { const m = mesh(unitRod(10), MAT.steel()); rodPart.add(m); return { i, m }; });

  // stationary scissors / swashplate guide (anti-rotation) and primary servos (head frame, not spinning)
  A.part('Swashplate guide & stationary scissors', {
    system: 'Flight controls', material: 'Steel guide tube and anti-rotation links', mass: 12, explode: [0, UPX - 1.9, 0],
    desc: 'A fixed tube around the shaft guides the uniball, and a scissor link on the right holds the stationary swashplate from turning while it moves.',
  }, [mesh(merge([cyl(0.12, 0.12, 0.42, [0, -0.78, 0], 'y', 20), tube([0.02, -0.98, 0.35], [0.03, -0.75, 0.42], 0.018), tube([0.03, -0.75, 0.42], [0.0, -0.6, 0.36], 0.018)]), MAT.steel())], head);
  const servoPart = A.part('Primary servos', {
    system: 'Flight controls', material: 'Dual-stage hydraulic actuators (No. 1 and No. 2 systems)', mass: 54, count: 3, explode: [0, UPX - 2.2, 0],
    desc: 'Forward, aft and lateral servos, each with two independent stages fed by separate hydraulic systems, so a single failure still leaves full control. Together they push against the whole rotor\'s control loads.',
    callout: true, anchor: [-0.42, -0.85, 0],
  }, [], head);
  const servos = SERVO_AZ.map((a) => {
    const body = mesh(unitRod(14), MAT.hydraulic());
    const ram = mesh(unitRod(10), MAT.steel());
    const base = mesh(box(0.12, 0.05, 0.12, [0, 0, 0]), MAT.casting());
    const anchor = V3(0.43 * Math.cos(a), -1.0, -0.43 * Math.sin(a));
    base.position.copy(anchor);
    servoPart.add(body, ram, base);
    return { a, body, ram, anchor };
  });

  // ------------------------------------------------------------------ kinematics
  const st = { psi: 0, coll: 10 * DEG, lon: 0, lat: 0, cone: 3.5 * DEG, lag: 1.5 * DEG };
  const tmp = V3(), tmp2 = V3(), up = V3(0, 1, 0);
  const toSpin = (c, local, out) => {
    out.copy(local).applyMatrix4(c.feather.matrix).applyMatrix4(c.flap.matrix).applyMatrix4(c.lag.matrix).applyMatrix4(c.hinge.matrix).applyMatrix4(c.az.matrix);
    return out;
  };
  const hornLocal = V3(HORN.x - E, HORN.y, HORN.z);

  function update({ psi, coll, lon, lat, cone, lag }) {
    Object.assign(st, { psi, coll, lon, lat, cone, lag });
    spin.rotation.y = psi;
    // swashplate: collective height and the tilt that produces the cyclic below (horn lead PHI_H)
    const s = LH * Math.sin(coll);
    const gx = (LH * (lat * Math.cos(PHI_H) - lon * Math.sin(PHI_H))) / RS;
    const gz = (-LH * (lon * Math.cos(PHI_H) + lat * Math.sin(PHI_H))) / RS;
    swash.position.set(0, YS0 + s, 0);
    swash.quaternion.setFromUnitVectors(up, tmp.set(-gx, 1, -gz).normalize());
    swashSpin.rotation.y = psi;
    for (const c of chains) {
      const ab = psi + (c.i * Math.PI) / 2;
      // pitch leads flap by 90°: θ(α) = θc + τlon sin α + τlat cos α ; β(α) = β0 − τlon cos α + τlat sin α
      c.feather.rotation.x = coll + lon * Math.sin(ab) + lat * Math.cos(ab);
      c.flap.rotation.z = cone - lon * Math.cos(ab) + lat * Math.sin(ab);
      c.lag.rotation.y = -lag;
      c.feather.updateMatrix(); c.flap.updateMatrix(); c.lag.updateMatrix(); c.hinge.updateMatrix(); c.az.updateMatrix();
    }
    // pitch rods: rotating-swashplate clevis (head frame → spin frame) up to the horn ball
    const cp = Math.cos(-psi), sp = Math.sin(-psi);
    for (const r of rods) {
      const c = bladeChains[r.i];
      const al = psi + (r.i * Math.PI) / 2 + PHI_H;
      const x = RS * Math.cos(al), z = -RS * Math.sin(al);
      const y = YS0 + s + gx * x + gz * z + 0.03;
      tmp.set(x * cp + z * sp, y, -x * sp + z * cp);       // rotate by −ψ about y into the spin frame
      toSpin(c, hornLocal, tmp2);
      aimRod(r.m, tmp, tmp2, 0.017);
    }
    for (const d of dampers) {
      const c = bladeChains[d.i];
      toSpin(c, d.local, tmp2);
      const mid = tmp.copy(d.hubEnd).lerp(tmp2, 0.6);
      aimRod(d.body, d.hubEnd, mid, 0.042);
      aimRod(d.rod, mid, tmp2, 0.016);
    }
    for (const sv of servos) {
      const x = RV * Math.cos(sv.a), z = -RV * Math.sin(sv.a);
      const lug = tmp.set(x, YS0 + s - 0.09 + gx * x + gz * z, z);
      const top = sv.anchor.clone().lerp(lug, 0.62);
      aimRod(sv.body, sv.anchor, top, 0.05);
      aimRod(sv.ram, top, lug, 0.022);
    }
    // bifilar masses swing in the rotor plane, three cycles per revolution (exaggerated amplitude)
    const k = 0.08 * Math.sin(3 * psi);
    for (const m of bifMasses) m.children[0].rotation.y = k;
  }
  update(st);
  return { head, spin, update, R, E };
}
