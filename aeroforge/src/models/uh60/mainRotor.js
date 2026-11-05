// UH-60M main rotor: one-piece titanium hub with one spherical elastomeric bearing per blade (the
// bearing's focal point is the flap, lead-lag and pitch hinge, 0.381 m from the shaft), spindles,
// blade cuffs with two quick-release pins, hydraulic lead-lag dampers with side reservoirs, pitch
// horns and adjustable pitch-control rods, droop stops and antiflap stops, the hub-mounted bifilar
// vibration absorber, the blade de-ice slip ring, distributor, harness and blade heater blankets,
// the rotating and stationary swashplates on their duplex bearing and uniball, rotating and
// stationary scissors, the swashplate guide, three two-stage primary servos and four wide-chord
// blades.
//
// Head frame: origin at the hub centre, y along the shaft (tilted 3° forward), blade 1 along +x.
// The rotor turns counter-clockwise seen from above (+y rotation): the advancing blade is on the right.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { loftRings, orientOutward, airfoilLoop, lathe } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pipe, place, unitRod, aimRod, aimFixed, scissor, canvasTex, DEICE } from './common.js';

export const HUB = { x: 0, y: 3.33, tilt: 3 * DEG };
const E = 0.381;          // hinge offset (elastomeric-bearing focal point), m (NASA TM-85890: 1.25 ft)
const R = 8.18;           // rotor radius, m
const CHORD = 0.58;       // wide-chord blade (estimate, see physics/rotor.js)
const TWIST = -18 * DEG;  // root-to-tip twist, referenced to 0.75 R
const HORN = { x: 0.5, y: -0.16, z: -0.27 };     // pitch-horn ball end (leading side, below the damper), hub coordinates
const LH = -HORN.z;                              // horn arm about the feathering axis
const PHI_H = Math.atan2(-HORN.z, HORN.x);        // link lead ahead of the blade (~28°)
const RS = Math.hypot(HORN.x, HORN.z);            // pitch-link radius on the rotating swashplate
const YS0 = -0.43;                                // rotating swashplate height below the hub
// The TM puts the three primary servos "on the upper deck above the cabin, forward of the main gear
// box": behind the shaft sits the tail take-off and to each side an input module, so all three stand
// on the forward arc. Their exact azimuths are not published; ±34° and 0° are approximate.
const SERVO_AZ = [34 * DEG, 0, -34 * DEG];
const RV = 0.47;          // servo clevis radius on the stationary swashplate
const RB = 0.56;          // servo lower rod-end radius (on its deck bracket)
const DECK_TOP = 2.315;   // top of the transmission deck plate the servo brackets stand on (drive.js)
const EYE_UP = 0.065;     // deck top → lower rod-end pin: 25 mm bracket plate, 40 mm clevis cheeks
const DY = 0.045;         // lead-lag damper line above the hub plane, so it clears the pitch-horn arm
const TOP_COVER = 2.73;   // main-module top cover (drive.js), where the swashplate guide is bolted
const SCISSOR_AZ = -135 * DEG;                    // stationary (anti-drive) scissors, aft right

/** Head-frame point → frame of the head's parent (the hover pose group). */
const headToAir = (p) => V3(p.x * Math.cos(HUB.tilt) + p.y * Math.sin(HUB.tilt), HUB.y - p.x * Math.sin(HUB.tilt) + p.y * Math.cos(HUB.tilt), p.z);
/** Parent-frame (air) point → head frame. */
const airToHead = (x, y, z) => { const dy = y - HUB.y; return V3(x * Math.cos(HUB.tilt) - dy * Math.sin(HUB.tilt), x * Math.sin(HUB.tilt) + dy * Math.cos(HUB.tilt), z); };

// ------------------------------------------------------------------------------------ blade
const LOOP = airfoilLoop(0.095, 22, 0, 1, 0.012);   // SC2110-class section, ~9.5 % thick
/** Section of the blade at radius r: chord, sweep, thickness blend, twist and anhedral. */
function stationAt(r) {
  const root = Math.max(0, Math.min(1, (1.6 - r) / 0.68));      // 1 at the cuff fitting → 0 at full section
  const tip = Math.max(0, (r - 7.61) / (R - 7.61));              // swept, tapered, anhedral tip
  return {
    root,
    chord: (CHORD * (1 - 0.62 * root)) * (1 - 0.4 * tip * tip),
    sweep: (r > 7.61 ? (r - 7.61) * Math.tan(20 * DEG) : 0) * 0.85,
    thick: 0.095 + root * 0.42,
    tw: TWIST * ((Math.max(r, 1.6) - 0.75 * R) / R),
    anh: -0.07 * tip * tip,
  };
}
/** Section point (chordwise X from the LE, thickness Y, both in metres) → feathering frame. */
function toFeather(r, st, X, Y) {
  const c = Math.cos(st.tw), s = Math.sin(st.tw);
  const zl = -0.25 * st.chord + X + st.sweep;   // feathering axis at quarter chord, LE toward −z
  return [r - E, Y * c - zl * s + st.anh, Y * s + zl * c];
}
function sectionPoints(r, st) {
  return LOOP.map(([xc, yt]) => {
    // blend the airfoil into an elliptical root fitting
    const ell = Math.sign(yt) * 0.5 * Math.sqrt(Math.max(0, 1 - (2 * xc - 1) ** 2)) * st.thick * 0.95;
    const ya = st.root > 0 ? (1 - st.root) * yt + st.root * ell : yt;
    return [xc * st.chord, ya * st.chord];
  });
}

/** Wide-chord main-rotor blade in its feathering frame: x radial from the hinge, LE toward −z. */
function bladeGeometry() {
  const stations = [0.92, 1.0, 1.12, 1.28, 1.45, 1.6];
  for (let r = 1.95; r < 7.55; r += 0.38) stations.push(r);
  for (let k = 0; k <= 7; k++) stations.push(7.61 + ((R - 7.61) * k) / 7);
  const rings = stations.map((r) => { const st = stationAt(r); return sectionPoints(r, st).map(([X, Y]) => toFeather(r, st, X, Y)); });
  const g = orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
  // trim tab at the trailing edge, ~0.7 R; tip balance-weight access cover; mooring/tie-down fitting
  const tab = new THREE.BoxGeometry(0.62, 0.005, 0.06).translate(5.85 - E, 0, 0.75 * CHORD + 0.025);
  return merge([g, tab]);
}

/**
 * Electro-thermal heater blanket bonded into the blade leading edge (r 1.6 → 7.6 m), 0.15 m of
 * chord wrapped round the nose, drawn 4 mm inside the section: under the skin and erosion strip,
 * as in service, so from outside only the strip shows; it reads in X-ray, Systems and Exploded.
 */
function heaterBlanketGeometry() {
  const rings = [];
  const band = LOOP.map(([xc]) => xc < 0.13);
  for (let r = 1.6; r <= 7.62; r += 0.4) {
    const st = stationAt(r), pts = sectionPoints(r, st);
    const ring = [];
    for (let j = 1; j < pts.length - 1; j++) {
      if (!band[j]) continue;
      // outward normal of the counter-clockwise loop: the tangent turned clockwise
      const tx = pts[j + 1][0] - pts[j - 1][0], ty = pts[j + 1][1] - pts[j - 1][1];
      const l = Math.hypot(tx, ty) || 1;
      ring.push(toFeather(r, st, pts[j][0] - (0.004 * ty) / l, pts[j][1] + (0.004 * tx) / l));
    }
    rings.push(ring);
  }
  return loftRings(rings, { closed: false });
}

function bladeMaterial() {
  // u runs root → tip, v around the section (LE at v ≈ 0.5): paint, nickel erosion strip, tip cap
  const uTip = (7.61 - 0.92) / (R - 0.92), uRoot = (1.3 - 0.92) / (R - 0.92);
  const map = canvasTex('uh60.blade', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1b1e1d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#232725'; ctx.fillRect(uTip * w, 0, w, h);
    ctx.fillStyle = '#7d8388'; ctx.fillRect(0, h * 0.46, w, h * 0.08);
    ctx.fillStyle = '#5a5f62'; ctx.fillRect(0, 0, uRoot * w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(uTip * w - 1, 0, 2, h);
  });
  const orm = canvasTex('uh60.bladeOrm', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(255,195,12)'; ctx.fillRect(0, 0, w, h);          // G roughness 0.76, B metal 0.05
    ctx.fillStyle = 'rgb(255,100,230)'; ctx.fillRect(0, h * 0.46, w, h * 0.08);
    ctx.fillStyle = 'rgb(255,150,200)'; ctx.fillRect(0, 0, uRoot * w, h);      // root fitting: satin, not mirror
  }, { srgb: false });
  return new THREE.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 });
}

/** Thin spherical shell (cap facing +x) about the focal point: radius rho, thickness t, polar angles a0…a1. */
function shell(rho, t, a0, a1, seg = 28) {
  const prof = [];
  const n = 4;
  for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; prof.push([rho * Math.sin(a), rho * Math.cos(a)]); }
  for (let k = n; k >= 0; k--) { const a = a0 + ((a1 - a0) * k) / n; prof.push([(rho + t) * Math.sin(a), (rho + t) * Math.cos(a)]); }
  prof.push(prof[0]);
  const g = orientOutward(lathe(prof, seg));
  g.rotateZ(-Math.PI / 2);               // lathe axis +y → +x (the blade axis)
  return g.translate(E, 0, 0);
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
  // Exploded view: everything lifts along the shaft in assembly order, so the stack reads bottom to
  // top: servos → guide and stationary scissors → uniball → stationary swashplate → duplex bearing →
  // rotating swashplate → rotating scissors → pitch rods → horns, spindles, dampers, cuffs,
  // bearings → droop stops → hub → harness → bifilar → slip ring → distributor (the main module
  // below rises only 0.3 m).
  const UPX = 2.1;
  const P = (name, info, objs, par = spin) => A.part(name, { system: 'Rotor system', ...info }, objs, par);
  // parts that turn with the rotor but whose callout should stay put: the part group sits in the
  // non-rotating head frame and a child group turns with the hub every frame
  const spinKids = [];
  const staticPart = (name, info) => {
    const part = P(name, info, [], head);
    const k = new THREE.Group();
    part.add(k);
    spinKids.push(k);
    return { part, k };
  };
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
  const onArms = (list, g) => { for (const i of blades) list.push(g.clone().rotateY((i * Math.PI) / 2)); };

  // ------------------------------------------------------------------ blades
  const bladeG = bladeGeometry();
  const bladeM = bladeMaterial();
  const bladeChains = [];
  for (const i of blades) {
    const holder = new THREE.Group();
    P(`Main rotor blade ${i + 1}`, {
      material: 'Composite (graphite/glass) spar, Nomex core, nickel erosion strip, heater mats', mass: 110,
      // each blade moves straight out along its own azimuth (the holder sits in the spinning frame)
      explode: [1.4 * Math.cos((i * Math.PI) / 2), UPX + 0.4, -1.4 * Math.sin((i * Math.PI) / 2)],
      desc: i === 0
        ? 'Wide-chord blade of the M model: its chord is 1.74 in (4.4 cm) wider than the original blade, and new high-lift airfoils with a swept, tapered tip and anhedral add about 470 lb (213 kg) of lift. 7.8 m long with −18° of twist; a trim tab at about 70 % radius and tip weights set its track and balance. (Spar material per NASA test reports: graphite/glass composite; earlier UH-60A/L blades used a titanium spar.)'
        : `One of four identical blades, 90° apart. At 258 rpm the tip moves at 221 m/s — Mach 0.65 in the hover and about Mach 0.88 on the advancing side at 150 kt.`,
    }, holder);
    const az = new THREE.Group(); az.rotation.y = (i * Math.PI) / 2;
    const hinge = new THREE.Group(); hinge.position.x = E;
    const lag = new THREE.Group(), flap = new THREE.Group(), feather = new THREE.Group();
    holder.add(az); az.add(hinge); hinge.add(lag); lag.add(flap); flap.add(feather);
    feather.add(mesh(bladeG, bladeM));
    const c = { i, az, hinge, lag, flap, feather };
    chains.push(c);
    bladeChains.push(c);
  }
  const blanketPart = P('Main rotor blade heater blankets', {
    system: 'Electrical', material: 'Electro-thermal heating elements bonded under the leading-edge erosion strip', mass: 4, count: 4, explode: [0, UPX + 0.75, 0],
    desc: 'A heater blanket runs along each blade\'s leading edge from about 1.6 m to 7.6 m radius. Its job is to melt the ice\'s bond to the blade, so the airflow throws the ice off evenly from all four blades instead of leaving one blade iced and the rotor out of balance. In service it lies under the erosion strip, so from outside you see only the strip.',
  }, []);
  const blanketG = heaterBlanketGeometry();
  const blanketM = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.7, metalness: 0.4 });   // under the skin: seen only in X-ray / Systems / Exploded
  for (const c of makeChains(blanketPart)) c.feather.add(mesh(blanketG, blanketM, { cast: false }));

  // ------------------------------------------------------------------ hub
  // one forging: a thick central body and four box-section arms; each arm's cheeks enclose an
  // elastomeric bearing (visible through the window between the top rails), the spindle exits
  // through the outboard bridge
  const cheek = (() => {
    const sh = new THREE.Shape();
    const x0 = 0.2, x1 = 0.53, y0 = -0.13, y1 = 0.15, rr = 0.07;
    sh.moveTo(x0, y0); sh.lineTo(x1 - rr, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + rr);
    sh.lineTo(x1, y1 - rr); sh.quadraticCurveTo(x1, y1, x1 - rr, y1); sh.lineTo(x0, y1); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });
  })();
  const hubParts = [
    place(lathe([[0.001, -0.2], [0.13, -0.2], [0.16, -0.15], [0.27, -0.13], [0.29, -0.1], [0.29, 0.12], [0.26, 0.15], [0.2, 0.17], [0.001, 0.17]], 40), [0, 0, 0]),
  ];
  for (let k = 0; k < 12; k++) {          // hub-to-shaft bolts on the top flange
    const a = (k / 12) * Math.PI * 2;
    hubParts.push(cyl(0.016, 0.016, 0.03, [0.17 * Math.cos(a), 0.18, 0.17 * Math.sin(a)], 'y', 8));
  }
  const arm = merge([
    cheek.clone().translate(0, 0, 0.12), cheek.clone().translate(0, 0, -0.16),
    box(0.05, 0.27, 0.32, [0.5, 0.01, 0]),                                       // outboard bridge
    box(0.3, 0.035, 0.07, [0.37, 0.135, 0.105]), box(0.3, 0.035, 0.07, [0.37, 0.135, -0.105]),   // top rails
    box(0.32, 0.035, 0.3, [0.37, -0.125, 0]),                                    // bottom plate
    box(0.08, 0.07, 0.11, [0.26, DY, -0.225]),                                   // damper lug on the cheek (leading side)
    cyl(0.03, 0.03, 0.1, [0.26, DY, -0.24], 'y', 10),                            // damper attachment bolt
  ]);
  onArms(hubParts, arm);
  P('Main rotor hub', {
    material: 'One-piece forged titanium hub', mass: 240, explode: [0, UPX + 0.6, 0], xrayWeight: 0.5,
    desc: 'A single titanium forging with four box-section arms. Each arm holds one elastomeric bearing, so the hub has no flapping or lagging hinge pins to lubricate — far fewer parts than a conventional fully articulated head. Twelve bolts clamp it to the rotor-shaft flange.',
  }, [mesh(merge(hubParts), MAT.hubTi())]);

  // spherical elastomeric bearings: 13 laminates (7 rubber, 6 steel shims) as spherical shells about
  // the focal point, between an inner member on the spindle and an outer housing bolted to the
  // inboard face of the hub arm's outboard bridge
  const rubber = [], steel = [], housing = [];
  const RHO0 = 0.058, LAYER = 0.0026, TH_MAX = 70 * DEG, HOLE = 0.048;
  for (let k = 0; k < 13; k++) {
    const rho = RHO0 + k * LAYER;
    const g = shell(rho, LAYER * 0.92, Math.asin(Math.min(0.99, HOLE / rho)), TH_MAX, 22);
    onArms(k % 2 ? steel : rubber, g);
  }
  const rhoOut = RHO0 + 13 * LAYER;
  onArms(housing, merge([
    shell(rhoOut, 0.012, Math.asin(HOLE / rhoOut), 76 * DEG, 28),                              // outer member (cup)
    cyl(0.112, 0.112, 0.014, [0.468, 0, 0], 'x', 28),                                           // mounting flange on the bridge
    shell(0.03, RHO0 - 0.031, 0, TH_MAX, 24),                                                   // inner member (ball segment)
    cyl(0.06, 0.06, 0.07, [0.36, 0, 0], 'x', 20),                                               // inner member body, inboard
  ]));
  for (let k = 0; k < 8; k++) {             // flange bolts
    const a = (k / 8) * Math.PI * 2;
    onArms(housing, cyl(0.009, 0.009, 0.03, [0.462, 0.098 * Math.cos(a), 0.098 * Math.sin(a)], 'x', 6));
  }
  const brg = staticPart('Elastomeric bearings', {
    material: 'Laminated natural rubber and steel shims (spherical), steel inner and outer members', mass: 18, count: 4, explode: [0, UPX + 0.25, 0], xrayWeight: 0.4,
    desc: 'Each bearing is a stack of thin rubber layers bonded between curved steel shims, all spherical shells centred on one focal point 1.25 ft (0.381 m) from the shaft. The rubber shears to let the blade flap, lead-lag and change pitch about that point, while the stack carries the blade\'s centrifugal pull — about 360 kN (≈ 37 tonnes-force) at 258 rpm — in compression against the hub. That one part replaces the three hinges of a conventional articulated head.',
    callout: true, anchor: [0, -0.05, 0.44],       // fixed point low on the starboard side, where the bearings pass
  });
  brg.k.add(mesh(merge(rubber), MAT.elastomer()), mesh(merge(steel), MAT.steel()), mesh(merge(housing), MAT.titanium()));

  // spindles (move with the blade): stem through the bearing, body through the bridge, flange
  const spindleG = merge([
    cyl(0.044, 0.044, 0.11, [0.43 - E, 0, 0], 'x', 18),                       // stem through the laminate stack
    cyl(0.066, 0.062, 0.27, [0.61 - E, 0, 0], 'x', 22),                       // spindle body through the bridge
    cyl(0.085, 0.085, 0.05, [0.735 - E, 0, 0], 'x', 22),                      // outboard flange (cuff joint)
    box(0.08, 0.05, 0.15, [0.77 - E, DY, -0.135]),                            // damper attachment lug, leading side
    cyl(0.022, 0.022, 0.08, [0.78 - E, DY, -0.2], 'y', 10),
  ]);
  const spindlePart = P('Blade spindles', {
    material: 'Titanium spindles', mass: 14, count: 4, explode: [0, UPX - 0.15, 0],
    desc: 'The spindle is the blade\'s axle. Its stem is held by the elastomeric bearing\'s inner member, and its body runs out through the hub arm to the flange where the blade cuff is pinned. It also carries the pitch horn and the outboard end of the lead-lag damper, so every pitch, flap and lag motion of the blade is a motion of its spindle.',
  }, []);
  for (const c of makeChains(spindlePart)) c.feather.add(mesh(spindleG, MAT.titanium()));

  const cuffG = merge([
    box(0.36, 0.045, 0.27, [0.9 - E, 0.075, 0]), box(0.36, 0.045, 0.27, [0.9 - E, -0.075, 0]),   // cuff clevis plates
    box(0.1, 0.19, 0.24, [0.775 - E, 0, 0]),                                                      // cuff block on the spindle flange
  ]);
  const pinG = merge([
    cyl(0.03, 0.03, 0.22, [0.84 - E, 0, 0.06], 'y', 14), cyl(0.03, 0.03, 0.22, [0.98 - E, 0, -0.06], 'y', 14),   // expandable pins
    cyl(0.04, 0.04, 0.02, [0.84 - E, 0.12, 0.06], 'y', 14), cyl(0.04, 0.04, 0.02, [0.98 - E, 0.12, -0.06], 'y', 14),
    new THREE.TorusGeometry(0.03, 0.006, 6, 14).translate(0.84 - E, 0.16, 0.06), new THREE.TorusGeometry(0.03, 0.006, 6, 14).translate(0.98 - E, 0.16, -0.06),   // pull rings
  ]);
  const cuffPart = P('Blade cuffs & quick-release pins', {
    material: 'Titanium cuff clevis, steel quick-release expandable pins', mass: 9, count: 4, explode: [0, UPX + 0.1, 0],
    desc: 'The cuff clamps the blade root between two plates and joins it to the spindle with two quick-release expandable pins that need no tools. Pull one pin and the blade can swing on the other, folding rearward and down along the tail cone so the helicopter fits a transport aircraft or a ship\'s hangar.',
  }, []);
  for (const c of makeChains(cuffPart)) c.feather.add(mesh(cuffG, MAT.titanium()), mesh(pinG, MAT.steel()));

  // clamp collar round the spindle body, a lug on its leading underside and an arm sloping down and
  // forward to the ball end, so the arm passes under the lead-lag damper at any pitch the head reaches
  const hornG = merge([
    cyl(0.076, 0.076, 0.04, [0.7 - E, 0, 0], 'x', 20),                     // between the droop/antiflap stops and the cuff flange
    box(0.04, 0.06, 0.06, [0.7 - E, -0.04, -0.06]),
    tube([0.7 - E, -0.045, -0.06], [HORN.x - E, HORN.y, HORN.z], 0.03, 12),
    cyl(0.036, 0.036, 0.06, [HORN.x - E, HORN.y, HORN.z], 'y', 12),
  ]);
  const hornPart = P('Pitch horns', {
    material: 'Forged steel horns', mass: 4, count: 4, explode: [0, UPX - 0.35, 0],
    desc: 'A lever on each spindle, ahead of the blade. Pushing its ball end up raises the leading edge: more pitch, more lift for that blade.',
  }, []);
  for (const c of makeChains(hornPart)) c.feather.add(mesh(hornG, MAT.steel()));

  // droop stops and antiflap stops (static on the hub, beneath/above each spindle)
  const stops = [];
  // the droop-stop ring is four arcs, one under each arm, leaving the diagonals free for the
  // rotating scissors' knees. The arcs and their pins lie against the underside of each arm's bottom
  // plate; each droop-stop block and antiflap stop is bolted to the outboard face of the arm's bridge,
  // under and over the spindle
  for (let k = 0; k < 4; k++) stops.push(new THREE.TorusGeometry(0.31, 0.022, 8, 10, 0.8).rotateZ(-0.4).rotateX(Math.PI / 2).rotateY((k * Math.PI) / 2).translate(0, -0.1645, 0));
  onArms(stops, merge([box(0.114, 0.05, 0.1, [0.579, -0.12, 0]), box(0.098, 0.04, 0.09, [0.571, 0.115, 0]), cyl(0.024, 0.024, 0.12, [0.33, -0.1665, 0], 'x', 8), cyl(0.012, 0.012, 0.13, [0.595, -0.12, 0], 'z', 8)]));
  P('Droop stops & flap restrainers', {
    material: 'Steel stops with centrifugal-weight latches, heated hinge pins', mass: 8, count: 4, explode: [0, UPX + 0.4, 0.0],
    desc: 'When the rotor is not turning the blades and spindles rest on hub-mounted droop stops, and upper antiflapping stops hold them down in wind; both engage as the rotor slows at shutdown, and centrifugal weights swing them clear at speed. Heaters in the droop-stop hinge pins run whenever blade de-ice is on so ice cannot jam them.',
  }, [mesh(merge(stops), MAT.steel())]);

  // lead-lag dampers (hub lug → spindle lug), aimed every frame. Built along +y, hub eye at 0 and
  // spindle eye at L0, with the pressurised reservoir and its indicator on the side (local +x).
  const DL0 = 0.515;
  // rod-end eye at height y on a linkage built along +y; its pin along local z, or x for the dampers
  const eye = (y, r = 0.026, ax = 'z') => [new THREE.TorusGeometry(r, 0.011, 6, 14).rotateY(ax === 'x' ? Math.PI / 2 : 0).translate(0, y, 0), cyl(0.012, 0.012, 0.05, [0, y, 0], ax, 8)];
  const damperG = merge([
    ...eye(0, 0.026, 'x'), cyl(0.03, 0.03, 0.04, [0, 0.045, 0], 'y', 12),
    cyl(0.05, 0.05, 0.25, [0, 0.19, 0], 'y', 18), cyl(0.056, 0.056, 0.03, [0, 0.08, 0], 'y', 18), cyl(0.056, 0.056, 0.03, [0, 0.3, 0], 'y', 18),
    cyl(0.02, 0.02, DL0 - 0.35, [0, (0.315 + DL0 - 0.035) / 2, 0], 'y', 10), cyl(0.03, 0.03, 0.03, [0, DL0 - 0.045, 0], 'y', 12), ...eye(DL0, 0.026, 'x'),
    cyl(0.03, 0.03, 0.12, [0.078, 0.2, 0], 'y', 14), box(0.04, 0.03, 0.03, [0.045, 0.15, 0]), box(0.04, 0.03, 0.03, [0.045, 0.25, 0]),   // reservoir on standoffs
    tube([0.078, 0.14, 0], [0.04, 0.11, 0], 0.007, 6),                                                                                    // fill line into the body
  ]);
  const indicatorG = cyl(0.031, 0.031, 0.025, [0.078, 0.272, 0], 'y', 14);
  const damperPart = staticPart('Lead-lag dampers', {
    material: 'Hydraulic dampers with side-mounted pressurised reservoirs, spherical rod ends', mass: 9, count: 4, explode: [0, UPX, 0],
    desc: 'One hydraulic damper per blade, from a lug on the hub arm to a lug on the spindle, restrains the lead-lag "hunting" of the blade; without them the in-plane blade motion could couple with the fuselage rocking on its gear in the destructive instability called ground resonance. They also absorb the rotor-head loads when the rotor starts. A pressurised reservoir on the side keeps each damper full: its indicator shows full gold when serviced.',
  }).k;
  const dampers = blades.map((i) => {
    const g = new THREE.Group();
    g.add(mesh(damperG, MAT.hydraulic()), mesh(indicatorG, MAT.yellow()));
    damperPart.add(g);
    const a = (i * Math.PI) / 2;
    const hubEnd = V3(0.26, DY, -0.24).applyAxisAngle(V3(0, 1, 0), a);
    // the side reservoir faces the blade's leading side, level, clear of the bifilar arms above
    return { i, g, hubEnd, local: V3(0.78 - E, DY, -0.2), lead: V3(0, 0, -1).applyAxisAngle(V3(0, 1, 0), a) };
  });

  // bifilar vibration absorber
  const bifBase = [cyl(0.21, 0.19, 0.08, [0, 0.21, 0], 'y', 28), cyl(0.12, 0.12, 0.1, [0, 0.29, 0], 'y', 24)];
  const bifMasses = [];
  // a static part frame (like the bearings) so its callout dot can sit on a mass instead of on the
  // slip ring above the shaft: the dot marks the top of the forward-left mass at rest, and the masses
  // pass under it when the rotor turns
  const bifPart = staticPart('Bifilar vibration absorber', {
    material: 'Steel arms and tuned tungsten-alloy masses on bifilar pins', mass: 100, explode: [0, UPX + 1.2, 0], xrayWeight: 0.5,
    desc: 'A four-arm plate on top of the hub with a tuned weight hanging from each arm on two pins (hence "bifilar"), free to swing in the plane of the rotor. Tuned to three cycles per revolution in the rotating hub (described as 3/rev in the literature), they cancel the in-plane rotating loads that would reach the fuselage as four-per-rev; the UH-60M\'s active vibration control cancels what remains in the cabin.',
    callout: true, anchor: [0.42, 0.29, -0.42],
  }).k;
  for (const i of blades) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const armG = box(0.36, 0.07, 0.11, [0.3, 0.24, 0]); armG.rotateY(a); bifBase.push(armG);
    const fork = box(0.1, 0.16, 0.2, [0.5, 0.22, 0]); fork.rotateY(a); bifBase.push(fork);
    const pivot = new THREE.Group();
    pivot.position.set(0.52 * Math.cos(a), 0.22, -0.52 * Math.sin(a));
    pivot.rotation.y = a;
    const massG = merge([cyl(0.09, 0.09, 0.24, [0.07, -0.02, 0], 'z', 22), cyl(0.06, 0.06, 0.3, [0.07, -0.02, 0], 'z', 16), cyl(0.018, 0.018, 0.2, [0.02, 0.02, 0.055], 'y', 8), cyl(0.018, 0.018, 0.2, [0.02, 0.02, -0.055], 'y', 8)]);
    pivot.add(mesh(massG, MAT.darkMetal()));
    bifPart.add(pivot);
    bifMasses.push(pivot);
  }
  bifPart.add(mesh(merge(bifBase), MAT.steel()));

  // ------------------------------------------------------------------ blade de-ice: slip ring, distributor, harness
  // The slip ring's stator is held still by its lead, which leaves the de-ice junction box on the
  // left roof beam, passes under the roof cross beam to the shaft axis below the main module and
  // comes up the hollow rotor shaft; its rotor and the distributor above it turn with the hub.
  const [jx, jy, jz] = DEICE.lead;
  const leadW = [[jx, jy, jz], [jx + 0.05, 2.06, jz + 0.03], [-0.5, 2.036, -0.3], [-0.3, 2.09, -0.15], [-0.13, 2.15, -0.04]];
  const leadH = [...leadW.map(([x, y, z]) => airToHead(x, y, z)), airToHead(-0.06, 2.18, 0), V3(0, -1.15, 0), V3(0, -0.6, 0), V3(0, 0.0, 0), V3(0, 0.335, 0)];
  P('Main rotor slip ring', {
    system: 'Electrical', material: 'Slip-ring assembly (brushes on rings), stationary lead in a standpipe through the shaft', mass: 9, explode: [0, UPX + 1.55, 0],
    desc: 'Carries de-ice power across the turning joint: brushes on the stationary side rub on rings that turn with the hub. Its stationary lead comes from the de-ice junction box on the cabin roof beam and runs up the centre of the hollow rotor shaft. The controller\'s commands pass through it to the distributor above.',
  }, [mesh(merge([cyl(0.1, 0.1, 0.07, [0, 0.375, 0], 'y', 24), cyl(0.104, 0.104, 0.012, [0, 0.35, 0], 'y', 24), cyl(0.104, 0.104, 0.012, [0, 0.39, 0], 'y', 24)]), MAT.casting()),
    mesh(pipe(leadH, 0.014, 6), MAT.wiring())], head);
  P('De-ice distributor', {
    system: 'Electrical', material: 'Rotating solid-state power distributor', mass: 5, explode: [0, UPX + 1.75, 0],
    desc: 'Turns with the rotor and switches power to the blade heater zones one after another, so only part of the rotor is heated at a time and the generators are not overloaded. The heater-on time lengthens as the outside air gets colder.',
  }, [mesh(merge([cyl(0.08, 0.08, 0.04, [0, 0.43, 0], 'y', 22), cyl(0.05, 0.08, 0.02, [0, 0.46, 0], 'y', 20)]), MAT.casting())]);
  const harness = [];
  for (const i of blades) {
    // down the hub arm, then a slack loop beside the antiflap stop to the spindle
    const pts = [V3(0.07, 0.45, 0), V3(0.14, 0.42, 0.02), V3(0.2, 0.33, 0.03), V3(0.25, 0.2, 0.0), V3(0.36, 0.165, 0), V3(0.52, 0.155, 0.01), V3(0.555, 0.135, 0.065), V3(0.56, 0.105, 0.068), V3(0.555, 0.09, 0.065)];
    harness.push(pipe(pts, 0.01, 5).rotateY((i * Math.PI) / 2));
    harness.push(box(0.05, 0.03, 0.04, [0.3, 0.19, 0]).rotateY((i * Math.PI) / 2));   // clamp block on the hub top
  }
  // along the spindle beside the antiflap stop, then over the cuff to the blade-root connector
  const cuffRun = merge([pipe([V3(0.555 - E, 0.09, 0.065), V3(0.62 - E, 0.085, 0.07), V3(0.68 - E, 0.085, 0.062), V3(0.72 - E, 0.108, 0.02), V3(0.76 - E, 0.113, 0.0), V3(0.86 - E, 0.113, 0), V3(0.99 - E, 0.113, 0)], 0.01, 5),
    cyl(0.026, 0.026, 0.05, [1.02 - E, 0.113, 0], 'x', 12)]);                   // blade-root connector
  const harnessPart = P('Main rotor de-ice harness', {
    system: 'Electrical', material: 'Shielded heater-power cables, blade-root connectors', mass: 6, count: 4, explode: [0, UPX + 0.85, 0],
    desc: 'From the distributor on top of the hub a cable runs down each hub arm, along the spindle and the cuff, to a connector at the blade root that feeds that blade\'s heater blanket. A slack loop where hub meets spindle lets the blade flap, lag and feather.',
  }, [mesh(merge(harness), MAT.wiring())]);
  for (const c of makeChains(harnessPart)) c.feather.add(mesh(cuffRun, MAT.wiring()));

  P('Main rotor shaft', {
    system: 'Drive system', material: 'Hollow steel shaft splined to the planetary carrier', mass: 85, explode: [0, 0.9, 0],
    desc: 'Driven at 258 rpm by the planet carrier of the main module\'s third (planetary) stage. It carries the rotor\'s full lift — about 100 kN at maximum weight — down into the transmission and the roof beams; it is hollow, and the de-ice slip ring\'s stationary lead runs up its centre.',
  }, [mesh(merge([cyl(0.095, 0.095, 0.82, [0, -0.32, 0], 'y', 24), cyl(0.13, 0.13, 0.05, [0, -0.08, 0], 'y', 24)]), MAT.steel())]);

  // ------------------------------------------------------------------ swashplates
  const rotRing = [orientOutward(lathe([[0.25, -0.025], [0.3, -0.025], [0.3, 0.025], [0.25, 0.025], [0.25, -0.025]], 36))];
  for (const i of blades) {
    const a = (i * Math.PI) / 2 + PHI_H;
    const armG = box(RS - 0.28, 0.045, 0.08, [(RS + 0.28) / 2, 0, 0]); armG.rotateY(a); rotRing.push(armG);
    const cl = cyl(0.028, 0.028, 0.07, [RS, 0, 0], 'y', 10); cl.rotateY(a); rotRing.push(cl);
    const cl2 = box(0.06, 0.05, 0.012, [RS, 0.04, 0.03]); cl2.rotateY(a); rotRing.push(cl2, box(0.06, 0.05, 0.012, [RS, 0.04, -0.03]).rotateY(a));   // clevis cheeks
  }
  for (const a of [Math.PI / 4 + Math.PI / 2, Math.PI / 4 - Math.PI / 2]) rotRing.push(box(0.06, 0.05, 0.06, [0.275, 0.045, 0]).rotateY(a));   // scissor lugs
  A.part('Rotating swashplate', {
    system: 'Rotor system', material: 'Aluminium-alloy ring', mass: 32, explode: [0, 1.3, 0],
    desc: 'Turns with the rotor. Its four arms carry the pitch control rods, so wherever the swashplate is high, the blade passing over it takes more pitch. It rides on the stationary plate through a duplex bearing, so the two tilt and slide as one unit while only this one turns.',
  }, [mesh(merge(rotRing), MAT.casting())], swashSpin);
  // duplex ball bearing between the plates: inner race on the stationary collar, outer race in the
  // rotating plate's bore, the ball row showing in the gap between the two plates
  const balls = [];
  for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2; balls.push(new THREE.SphereGeometry(0.014, 8, 6).translate(0.225 * Math.cos(a), -0.042, 0.225 * Math.sin(a))); }
  A.part('Swashplate duplex bearing', {
    system: 'Rotor system', material: 'Steel duplex angular-contact ball bearing', mass: 6, explode: [0, 1.12, 0],
    desc: 'The bearing between the two plates: its inner race sits on the stationary plate and its outer race in the rotating plate, so the rotating plate can spin at 258 rpm while copying every tilt and height change of the stationary one. About 0.5 m across.',
  }, [mesh(merge([orientOutward(lathe([[0.2, -0.06], [0.212, -0.06], [0.212, 0.0], [0.2, 0.0], [0.2, -0.06]], 36)), orientOutward(lathe([[0.238, -0.06], [0.25, -0.06], [0.25, 0.0], [0.238, 0.0], [0.238, -0.06]], 36))]), MAT.steel()), mesh(merge(balls), MAT.steel())], swash);
  const statRing = [orientOutward(lathe([[0.135, -0.12], [0.34, -0.12], [0.34, -0.06], [0.212, -0.06], [0.212, -0.04], [0.15, -0.04], [0.135, -0.06], [0.135, -0.12]], 36))];
  for (const a of SERVO_AZ) {
    statRing.push(box(RV - 0.3, 0.05, 0.09, [(RV + 0.3) / 2 + 0.02, -0.09, 0]).rotateY(a));
    statRing.push(box(0.06, 0.06, 0.012, [RV, -0.1, 0.03]).rotateY(a), box(0.06, 0.06, 0.012, [RV, -0.1, -0.03]).rotateY(a));   // servo clevis cheeks
  }
  statRing.push(box(0.12, 0.05, 0.08, [0.38, -0.09, 0]).rotateY(SCISSOR_AZ));
  A.part('Stationary swashplate', {
    system: 'Flight controls', material: 'Aluminium-alloy ring', mass: 28, explode: [0, 0.95, 0],
    desc: 'Does not turn. The three primary servos set exactly its three degrees of freedom — height for collective and two tilts for cyclic. It rides on the uniball, which lets it tilt in any direction while sliding along the guide, and the stationary scissors stop it from turning.',
  }, [mesh(merge(statRing), MAT.casting())], swash);
  // uniball: a spherical ball on a sleeve that slides up and down the guide (moves, never tilts)
  const uniPart = A.part('Uniball & sliding sleeve', {
    system: 'Flight controls', material: 'Steel spherical bearing (uniball) on a bronze-lined sleeve', mass: 7, explode: [0, 0.8, 0],
    desc: 'The swashplate\'s centre: a ball about 0.28 m across on a sleeve that slides up and down the guide around the shaft. The stationary plate tilts on the ball for cyclic and slides with the sleeve for collective.',
  }, [], head);
  const uni = new THREE.Group();
  uniPart.add(uni);
  const ballProf = [[0.127, -0.059]];
  for (let k = 0; k <= 8; k++) { const y = -0.059 + (0.118 * k) / 8; ballProf.push([Math.sqrt(0.14 * 0.14 - y * y), y]); }
  ballProf.push([0.127, 0.059], [0.127, -0.059]);
  uni.add(mesh(merge([orientOutward(lathe(ballProf, 28)), cyl(0.127, 0.127, 0.12, [0, 0, 0], 'y', 28, true)]), MAT.steel()));

  // pitch control rods (rotating swashplate → horn), aimed every frame. Built along +y: lower rod
  // end at 0, adjustment barrel with jam nuts in the middle, upper rod end at RL0.
  const RL0 = 0.25;
  const rodG = merge([
    ...eye(0, 0.024), cyl(0.0175, 0.0175, RL0 - 0.07, [0, RL0 / 2, 0], 'y', 10),
    cyl(0.0225, 0.0225, 0.08, [0, RL0 / 2, 0], 'y', 6), cyl(0.024, 0.024, 0.014, [0, RL0 / 2 - 0.05, 0], 'y', 6), cyl(0.024, 0.024, 0.014, [0, RL0 / 2 + 0.05, 0], 'y', 6),
    ...eye(RL0, 0.024),
  ]);
  const rodPart = P('Pitch control rods', {
    material: 'Steel tubes with spherical rod ends, adjustment barrels and jam nuts', mass: 3, count: 4, explode: [0, 1.6, 0],
    desc: 'The only link between the swashplate and its blade: every movement of the swashplate reaches a blade through one of these rods. Each is adjustable at its central barrel; lengthening or shortening one rod re-tracks that blade so all four fly in one cone.',
  }, []);
  const rods = blades.map((i) => { const m = mesh(rodG, MAT.steel()); rodPart.add(m); return { i, m }; });

  // rotating scissors (spin frame): shaft collar → rotating-swashplate lug, two links each, solved every frame
  const scPart = P('Rotating scissors', {
    material: 'Steel scissor links with spherical bearings, splined shaft collar', mass: 6, count: 2, explode: [0, 1.45, 0],
    desc: 'Hinged links that make the rotating swashplate turn with the shaft while still letting it slide up and down and tilt.',
  }, [mesh(merge([cyl(0.135, 0.135, 0.07, [0, -0.25, 0], 'y', 24), ...[Math.PI / 4 + Math.PI / 2, Math.PI / 4 - Math.PI / 2].map((a) => box(0.08, 0.06, 0.06, [0.16, -0.25, 0]).rotateY(a))]), MAT.steel())]);
  const rotSc = [Math.PI / 4 + Math.PI / 2, Math.PI / 4 - Math.PI / 2].map((a) => {
    const l1 = mesh(unitRod(10), MAT.steel()), l2 = mesh(unitRod(10), MAT.steel()), pin = mesh(cyl(0.026, 0.026, 0.06, [0, 0, 0], 'z', 10), MAT.steel());
    scPart.add(l1, l2, pin);
    return { a, l1, l2, pin, p0: V3(0.19 * Math.cos(a), -0.25, -0.19 * Math.sin(a)), lug: V3(0.275 * Math.cos(a), 0.06, -0.275 * Math.sin(a)) };
  });

  // swashplate guide and stationary scissors (head frame, not spinning): the guide's flange sits on
  // the main-module top cover (TOP_COVER), its tube reaching up to just below the rotating scissors
  const yCover = airToHead(-0.04, TOP_COVER, 0).y, yTop = -0.29;
  const ring = (r0, r1, h) => orientOutward(lathe([[r0, -h / 2], [r1, -h / 2], [r1, h / 2], [r0, h / 2], [r0, -h / 2]], 32));
  const toHead = new THREE.Matrix4().makeRotationZ(HUB.tilt).multiply(new THREE.Matrix4().makeTranslation(0, -HUB.y, 0));
  const yc = yCover + 0.03;     // tube foot, above the level flange's high edge
  const guideG = [cyl(0.12, 0.12, yTop - yc, [0, (yTop + yc) / 2, 0], 'y', 24, true), cyl(0.112, 0.112, yTop - yc, [0, (yTop + yc) / 2, 0], 'y', 24, true),
    ring(0.112, 0.15, 0.02).translate(0, yc + 0.0, 0),
    ring(0.112, 0.18, 0.02).translate(headToAir(V3(0, yCover, 0)).x, TOP_COVER + 0.011, 0).applyMatrix4(toHead)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; guideG.push(cyl(0.011, 0.011, 0.012, [headToAir(V3(0, yCover, 0)).x + 0.163 * Math.cos(a), TOP_COVER + 0.026, 0.163 * Math.sin(a)], 'y', 6).applyMatrix4(toHead)); }
  A.part('Swashplate guide', {
    system: 'Flight controls', material: 'Steel guide tube bolted to the main-module top cover', mass: 8, explode: [0, 0.62, 0],
    desc: 'A fixed tube around the rotor shaft, bolted to the top of the main module. The uniball sleeve slides on it, so the swashplate can only move up and down the shaft axis and tilt — never sideways.',
  }, [mesh(merge(guideG), MAT.steel())], head);
  const ssPart = A.part('Stationary scissors', {
    system: 'Flight controls', material: 'Steel anti-drive links with spherical bearings', mass: 4, explode: [0, 0.7, 0],
    desc: 'A two-link scissor from the stationary swashplate down to a lug on the main module. It stops the plate from being dragged round by the rotating one, yet folds and unfolds so the plate can still tilt in every direction and slide on the guide. The rotating scissors above do the opposite job.',
  }, [], head);
  const ssBase = V3(0.46 * Math.cos(SCISSOR_AZ), -0.86, -0.46 * Math.sin(SCISSOR_AZ));
  ssPart.add(mesh(box(0.08, 0.07, 0.07, [ssBase.x, ssBase.y - 0.02, ssBase.z]), MAT.casting()));
  const statSc = { l1: mesh(unitRod(10), MAT.steel()), l2: mesh(unitRod(10), MAT.steel()), pin: mesh(cyl(0.024, 0.024, 0.06, [0, 0, 0], 'y', 10), MAT.steel()) };
  ssPart.add(statSc.l1, statSc.l2, statSc.pin);
  const ssLug = V3(0.4 * Math.cos(SCISSOR_AZ), -0.09, -0.4 * Math.sin(SCISSOR_AZ));
  const ssBend = V3(Math.cos(SCISSOR_AZ), 0, -Math.sin(SCISSOR_AZ));

  // primary servos: a two-stage body aimed from its lower rod end (on a deck bracket, with the
  // input pilot-valve lever beside it) toward the stationary swashplate, and the ram that reaches it
  const servoPart = A.part('Primary servos', {
    system: 'Flight controls', material: 'Two-stage hydraulic actuators (No. 1 and No. 2 systems), deck brackets, input pilot-valve levers', mass: 54, count: 3, explode: [0, 0.48, 0],
    desc: 'Three servos push the stationary swashplate; the TM places them on the upper deck forward of the main gearbox (exact positions approximate here). Each has two independent stages — the first on the No. 1 hydraulic system, the second on No. 2 — that share only the mechanical input linkage. If a stage loses pressure a bypass valve opens so it cannot hydraulically lock the other, and the SVO OFF switch cannot shut one stage unless the other holds at least 2,350 psi.',
  }, [], head);
  const LB = 0.32;
  const bodyG = merge([
    ...eye(0, 0.03), box(0.12, 0.07, 0.11, [0, 0.06, 0]),                                     // lower rod end and valve manifold
    cyl(0.048, 0.048, LB - 0.08, [0, 0.06 + (LB - 0.08) / 2, 0], 'y', 16),                    // first-stage cylinder
    cyl(0.034, 0.034, LB - 0.1, [0.075, 0.07 + (LB - 0.1) / 2, 0], 'y', 14),                  // second-stage cylinder alongside
    cyl(0.055, 0.055, 0.03, [0, LB - 0.02, 0], 'y', 16), box(0.05, 0.05, 0.08, [-0.06, 0.07, 0]),   // gland nut; pilot-valve housing
  ]);
  const fixedG = [];
  // the deck brackets are built level in the airframe and taken into the (3°-tilted) head frame
  const airToHeadM = new THREE.Matrix4().makeRotationZ(HUB.tilt).multiply(new THREE.Matrix4().makeTranslation(0, -HUB.y, 0));
  const servos = SERVO_AZ.map((a) => {
    // lower rod-end pin EYE_UP above the deck plate, at radius RB in the head frame
    const ax = RB * Math.cos(a), az = -RB * Math.sin(a);
    const yb = (DECK_TOP + EYE_UP - HUB.y + ax * Math.sin(HUB.tilt)) / Math.cos(HUB.tilt);
    const base = V3(ax, yb, az), bw = headToAir(base);
    const tang = V3(-Math.sin(a), 0, -Math.cos(a));
    // deck bracket: a plate bolted on the deck with two clevis cheeks on it
    const plate = box(0.13, 0.025, 0.11, [0, 0, 0]).rotateY(a).translate(bw.x, DECK_TOP + 0.0135, bw.z).applyMatrix4(airToHeadM);
    const bolts = [];
    for (const [u, v] of [[0.045, 0.04], [0.045, -0.04], [-0.045, 0.04], [-0.045, -0.04]]) bolts.push(cyl(0.008, 0.008, 0.01, [u, 0, v], 'y', 6).rotateY(a).translate(bw.x, DECK_TOP + 0.031, bw.z).applyMatrix4(airToHeadM));
    fixedG.push(plate, ...bolts,
      box(0.05, 0.08, 0.012, [0, 0, 0]).rotateY(a).translate(base.x + tang.x * 0.04, base.y, base.z + tang.z * 0.04),
      box(0.05, 0.08, 0.012, [0, 0, 0]).rotateY(a).translate(base.x - tang.x * 0.04, base.y, base.z - tang.z * 0.04));
    // input pilot-valve lever: a short bellcrank on the manifold, its free end pointing forward to
    // where the deck rod from the mixing unit connects (clear of the pump modules beside the servos)
    const lv0 = base.clone().addScaledVector(tang, -0.06).add(V3(0, 0.07, 0)), lv1 = lv0.clone().add(V3(0.12, -0.03, 0));
    fixedG.push(tube(lv0, lv1, 0.012, 8), cyl(0.02, 0.02, 0.04, [lv1.x, lv1.y, lv1.z], 'y', 8));
    const g = new THREE.Group();
    g.add(mesh(bodyG, MAT.hydraulic()));
    const ram = mesh(unitRod(12), MAT.steel());
    servoPart.add(g, ram);
    return { a, g, ram, base, input: headToAir(lv1) };
  });
  servoPart.add(mesh(merge(fixedG), MAT.casting()));

  // ------------------------------------------------------------------ kinematics
  const st = { psi: 0, coll: 10 * DEG, lon: 0, lat: 0, cone: 3.5 * DEG, lag: 1.5 * DEG };
  const tmp = V3(), tmp2 = V3(), tmp3 = V3(), up = V3(0, 1, 0);
  const toSpin = (c, local, out) => {
    out.copy(local).applyMatrix4(c.feather.matrix).applyMatrix4(c.flap.matrix).applyMatrix4(c.lag.matrix).applyMatrix4(c.hinge.matrix).applyMatrix4(c.az.matrix);
    return out;
  };
  const hornLocal = V3(HORN.x - E, HORN.y, HORN.z);
  const qSwash = new THREE.Quaternion(), qPsi = new THREE.Quaternion(), qNeg = new THREE.Quaternion();
  /** Swashplate-local point (in the stationary plate frame) → head frame. */
  const swashToHead = (p, out) => out.copy(p).applyQuaternion(qSwash).add(swash.position);

  function update({ psi, coll, lon, lat, cone, lag }) {
    Object.assign(st, { psi, coll, lon, lat, cone, lag });
    spin.rotation.y = psi;
    for (const k of spinKids) k.rotation.y = psi;
    // swashplate: collective height and the tilt that produces the cyclic below (horn lead PHI_H)
    const s = LH * Math.sin(coll);
    const gx = (LH * (lat * Math.cos(PHI_H) - lon * Math.sin(PHI_H))) / RS;
    const gz = (-LH * (lon * Math.cos(PHI_H) + lat * Math.sin(PHI_H))) / RS;
    swash.position.set(0, YS0 + s, 0);
    swash.quaternion.setFromUnitVectors(up, tmp.set(-gx, 1, -gz).normalize());
    qSwash.copy(swash.quaternion);
    swashSpin.rotation.y = psi;
    uni.position.y = YS0 + s - 0.07;
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
      aimFixed(r.m, tmp, tmp2, RL0);
    }
    for (const d of dampers) {
      toSpin(bladeChains[d.i], d.local, tmp2);
      aimFixed(d.g, d.hubEnd, tmp2, DL0, d.lead);
    }
    // rotating scissors: plate lug (swashSpin frame) → head frame → spin frame
    qPsi.setFromAxisAngle(up, psi); qNeg.setFromAxisAngle(up, -psi);
    for (const sc of rotSc) {
      tmp3.copy(sc.lug).applyQuaternion(qPsi);
      swashToHead(tmp3, tmp).applyQuaternion(qNeg);
      scissor(sc.l1, sc.l2, sc.pin, sc.p0, tmp, 0.13, 0.13, tmp2.set(Math.cos(sc.a), 0, -Math.sin(sc.a)), 0.018);
    }
    swashToHead(ssLug, tmp);
    scissor(statSc.l1, statSc.l2, statSc.pin, ssBase, tmp, 0.22, 0.22, ssBend, 0.017);
    for (const sv of servos) {
      const x = RV * Math.cos(sv.a), z = -RV * Math.sin(sv.a);
      const lug = tmp.set(x, YS0 + s - 0.09 + gx * x + gz * z, z);
      aimFixed(sv.g, sv.base, lug, sv.base.distanceTo(lug));
      tmp2.copy(lug).sub(sv.base).normalize().multiplyScalar(LB).add(sv.base);
      aimRod(sv.ram, tmp2, lug, 0.024);
    }
    // bifilar masses swing in the rotor plane, three cycles per revolution (exaggerated amplitude)
    const k = 0.08 * Math.sin(3 * psi);
    for (const m of bifMasses) m.children[0].rotation.y = k;
  }
  update(st);
  return { head, spin, update, R, E, servoInputs: servos.map((s) => s.input), servoBases: servos.map((s) => headToAir(s.base)) };
}
