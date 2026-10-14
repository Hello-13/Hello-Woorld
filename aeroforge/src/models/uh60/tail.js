// UH-60M tail and upper fairings: the cambered tail pylon (its upper part leans 20° to port so the
// tail-rotor shaft is canted), the variable-incidence stabilator and its actuators, the 42°
// intermediate and 90° tail gearboxes, the pylon drive shaft, the bearingless four-blade tail
// rotor on two composite crossbeam spars, its pitch-change beam and servo, plus the transmission
// fairing, aft deck fairing and tail-drive-shaft cover on top of the fuselage.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { wingPanel, mirrorZ, loftRings, orientOutward, airfoilLoop, lathe } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pipe, pchip, unitRod, aimRod, TAIL, pylonLean, strobeMat, DEICE, TR_CTL } from './common.js';

/** Grid surface: fn(u, v) → Vector3 over u, v ∈ [0, 1]; skip(p) drops a quad. Normals computed. */
function gridSurface(nu, nv, fn, skip = null) {
  const pos = [], uv = [], idx = [];
  const P = [];
  for (let i = 0; i <= nu; i++) {
    const row = [];
    for (let j = 0; j <= nv; j++) {
      const p = fn(i / nu, j / nv);
      row.push(p);
      pos.push(p.x, p.y, p.z);
      uv.push(p.x, (j / nv) * 2);
    }
    P.push(row);
  }
  const id = (i, j) => i * (nv + 1) + j;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      if (skip) {
        const c = P[i][j].clone().add(P[i + 1][j + 1]).multiplyScalar(0.5);
        if (skip(c)) continue;
      }
      idx.push(id(i, j), id(i + 1, j), id(i, j + 1), id(i, j + 1), id(i + 1, j), id(i + 1, j + 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Half-superellipse fairing on the fuselage top: keys [[x, hw, top]], base from roofY. */
function fairing(keys, roofY, { e = 2.6, nu = 40, nv = 28, skip = null, baseDrop = 0.03 } = {}) {
  const xs = keys.map((k) => k[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const hwK = keys.map(([x, hw]) => [x, hw]), topK = keys.map(([x, , t]) => [x, t]);
  return gridSurface(nu, nv, (u, v) => {
    const x = x0 + (x1 - x0) * u;
    const a = v * Math.PI;        // 0 = right base → π/2 = crest → π = left base
    const hw = pchip(hwK, x), top = pchip(topK, x), base = roofY(x) - baseDrop;
    const c = Math.cos(a), s = Math.sin(a);
    return V3(x, base + (top - base) * Math.pow(Math.abs(s), 2 / e), hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / e));
  }, skip);
}

/** Keys [[x, half-width, crest]] of the aft deck fairing between the nacelles (crest at −3.6 from roofY). */
const aftKeys = (roofY) => [[-3.6, 0.17, roofY(-3.6) + 0.18], [-3.0, 0.28, 2.45], [-2.4, 0.35, 2.6], [-1.9, 0.43, 2.645], [-1.65, 0.47, 2.66], [-1.4, 0.47, 2.665], [-0.9, 0.45, 2.67]];
/**
 * Point on the aft deck fairing at station x and angle a (0 = right base, π/2 = crest, π = left base),
 * pushed `off` metres along the outward normal, and that normal: the same surface fairing() lofts.
 */
export function aftDeckPoint(roofY, x, a, off = 0) {
  const keys = aftKeys(roofY), e = 2.6;
  const at = (xx, aa) => {
    const hw = pchip(keys.map(([k, w]) => [k, w]), xx), top = pchip(keys.map(([k, , t]) => [k, t]), xx), base = roofY(xx) - 0.03;
    const c = Math.cos(aa), s = Math.sin(aa);
    return V3(xx, base + (top - base) * Math.pow(Math.abs(s), 2 / e), hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / e));
  };
  const p = at(x, a), tx = at(x + 0.01, a).sub(at(x - 0.01, a)), ta = at(x, a + 0.01).sub(at(x, a - 0.01));
  const n = tx.cross(ta).normalize();
  return { p: p.addScaledVector(n, off), n };
}

/** Tail-rotor blade in its feathering frame (x radial from the hub, LE toward −z). */
function trBladeGeometry() {
  const loop = airfoilLoop(0.095, 14, 0, 1, 0.01);
  const Rt = 1.676, c = 0.247;
  const rs = [0.3, 0.36, 0.44];
  for (let r = 0.55; r < Rt - 0.05; r += 0.18) rs.push(r);
  rs.push(Rt - 0.05, Rt);
  const rings = rs.map((r) => {
    const root = Math.max(0, Math.min(1, (0.44 - r) / 0.14));
    const chord = c * (1 - 0.45 * root);
    const tw = -18 * DEG * ((Math.max(r, 0.44) - 0.75 * Rt) / Rt);
    const thick = 0.095 + root * 0.3;
    const ct = Math.cos(tw), st = Math.sin(tw);
    return loop.map(([xc, yt]) => {
      const ya = root > 0 ? (1 - root) * yt + root * Math.sign(yt) * 0.5 * Math.sqrt(Math.max(0, 1 - (2 * xc - 1) ** 2)) * thick : yt;
      const zl = -0.25 * chord + xc * chord, yl = ya * chord;
      return [r, yl * ct - zl * st, yl * st + zl * ct];
    });
  });
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

const WELL = 0.58;

/** Pylon rear spar, [x, y] in the pylon mid-plane: from a foot fitting on the tail cone (on the line
 *  of 62 % root chord) it angles back to 88–90 % chord behind the pylon drive shaft, the cable
 *  quadrant and the servo, ending on the 90° gearbox. */
const REAR_SPAR = [[-8.843, 1.97], [-9.208, 2.3], [-9.585, 2.64], [-9.66, 2.76], [-9.755, 2.95], [-9.875, 3.15], [-9.96, 3.29]];
function rearSparAt(y) {
  let k = 0;
  while (k < REAR_SPAR.length - 2 && y > REAR_SPAR[k + 1][1]) k++;
  const [x0, y0] = REAR_SPAR[k], [x1, y1] = REAR_SPAR[k + 1];
  // on the fin's cambered mid-surface, about 1.2 cm to starboard of the lean line this far aft
  return V3(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0), y, pylonLean(y) + 0.012 * Math.min(1, Math.max(0, (y - 1.97) / 0.33)));
}

/**
 * Pylon drive shaft cover: a raised fairing along the straight pylon shaft line from inside the 42°
 * gearbox fairing to inside the 90° gearbox fairing. The shaft is straight while the pylon above the
 * tail cone is cambered and leans 20° to port, so the cover bulges out of the port face over the
 * shaft, its couplings and the gearbox housings; on the starboard side it stays inside the pylon,
 * clear of the servo and the cable quadrant behind the shaft. D-shaped section: semi-axis `a` out to
 * port, 3 cm to starboard, half-width a + 0.04 m along the chord.
 */
function pylonShaftCover() {
  const igb = V3(...TAIL.igb), tgb = V3(...TAIL.tgb), d = tgb.clone().sub(igb), L = d.length();
  d.normalize();
  const lat = V3(0, 0, 1).addScaledVector(d, -d.z).normalize(), chord = d.clone().cross(lat).normalize();
  const aAt = (t) => (t < 0.14 ? 0.11 : t < 0.2 ? 0.11 - ((t - 0.14) / 0.06) * 0.025 : t < 0.82 ? 0.085 : t < 0.87 ? 0.085 + ((t - 0.82) / 0.05) * 0.03 : 0.115);
  const rings = [];
  for (let k = 0; k <= 36; k++) {
    const t = 0.04 + (0.9 * k) / 36, a = aAt(t), b = a + 0.04, c = igb.clone().addScaledVector(d, t * L), ring = [];
    for (let j = 0; j < 20; j++) {
      const th = (j / 20) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const p = c.clone().addScaledVector(lat, ct * (ct < 0 ? a : 0.03)).addScaledVector(chord, st * b);
      ring.push([p.x, p.y, p.z]);
    }
    rings.push(ring);
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
}

export function buildTail({ A, P, air, roofY }) {
  const paint = MAT.paint();

  // ------------------------------------------------------------------ upper fairings
  const shaftX = -0.03;
  // wide over the input and accessory modules, narrowing quickly aft so the engine inlets stay open
  const trans = fairing([[-0.9, 0.45, 2.67], [-0.45, 0.46, 2.73], [-0.15, 0.66, 2.77], [0.2, 0.8, 2.79], [0.7, 0.84, 2.78], [1.2, 0.8, 2.72], [1.7, 0.7, 2.62], [2.2, 0.57, 2.49], [2.6, 0.35, 2.31]], roofY, {
    e: 3.0, nu: 64, nv: 40, skip: (c) => c.y > 2.6 && Math.hypot(c.x - shaftX, c.z) < WELL,
  });
  // the opening round the rotor shaft is wide enough for the swashplate and the tops of the three
  // primary servos that stand on the deck ahead of the gearbox
  const well = cyl(WELL, WELL, 0.17, [shaftX, 2.705, 0], 'y', 44, true);
  const wellLip = new THREE.TorusGeometry(WELL, 0.018, 6, 44).rotateX(Math.PI / 2).translate(shaftX, 2.79, 0);
  P('Transmission fairing', {
    system: 'Skin & fairings', skin: true, material: 'Kevlar/graphite composite cowls on quick-release hinges', mass: 55, explode: [2.4, 1.0, 0],
    desc: 'Streamlines the forward upper deck, the flight-control closet, the main gearbox and its input and accessory modules. Its panels open as walkways for daily inspection of the rotor head.',
  }, [mesh(merge([trans, well, wellLip]), paint), mesh(well.clone(), MAT.interior())]);
  // between the nacelles its flanks run into the cowls' inboard sides, closing the deck (no open
  // slot between the engines and the fairing, and the fuel lines pass from one to the other inside)
  const aftF = fairing(aftKeys(roofY), roofY, { nu: 36, nv: 28 });
  const grille = [];
  for (let k = 0; k < 7; k++) grille.push(box(0.025, 0.012, 0.42, [-1.48 + k * 0.05, 2.668, 0]));
  P('Aft deck fairing', {
    system: 'Skin & fairings', skin: true, material: 'Composite fairing with oil-cooler grille', mass: 22, explode: [-1.4, 1.2, 0],
    desc: 'Covers the oil cooler, APU and the start of the tail drive shaft between the engine nacelles; the grille on top lets the oil-cooler blower breathe.',
  }, [mesh(aftF, paint), mesh(merge(grille), MAT.black())]);
  const cover = fairing([[-8.45, 0.13, roofY(-8.45) + 0.18], [-6.0, 0.15, roofY(-6.0) + 0.2], [-3.6, 0.17, roofY(-3.6) + 0.18]], roofY, { nu: 50, nv: 16 });
  const igbFair = new THREE.SphereGeometry(1, 20, 14).scale(0.36, 0.2, 0.2).translate(TAIL.igb[0] + 0.05, TAIL.igb[1] + 0.02, 0);
  P('Tail drive shaft cover', {
    system: 'Skin & fairings', skin: true, material: 'Hinged aluminium/composite covers', mass: 16, explode: [-2.4, 1.8, 0],
    desc: 'A hinged cover over the tail drive shaft along the top of the tail cone, ending in the fairing over the 42° intermediate gearbox. From there the pylon drive shaft cover runs up the pylon over the last shaft section to the tail gearbox fairing; the operator\'s manual puts a VHF-FM antenna inside its leading-edge fairing. (Pylon cover shape approximate.)',
  }, [mesh(merge([cover, igbFair, pylonShaftCover()]), paint)]);

  // ------------------------------------------------------------------ pylon
  // GenHel (NASA CR-166309) planform: root chord 6 ft (1.83 m), tip 2.83 ft (0.86 m), quarter-chord
  // sweep 41° (≈ 44° at the leading edge, ≈ 30° at the trailing edge), NACA 0021 (mod) section. The
  // root sits inside the tail cone; the tip trailing edge is the aft end of the 15.26 m fuselage.
  const root = { le: [-7.32, 0, 1.62], chord: 1.83, t: 0.2 };
  const tip = { le: [-9.65, 0, 4.02], chord: 0.86, t: 0.17 };
  const pyl = wingPanel({ root, tip, stations: 10, camber: -0.03, n: 22, withChord: false });
  pyl.rotateX(-Math.PI / 2);                     // span z → y, camber toward +z (side force to starboard)
  const lean = (g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + pylonLean(p.getY(i)));
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  lean(pyl);
  const tgbBulge = new THREE.SphereGeometry(1, 20, 14).scale(0.42, 0.26, 0.22).translate(TAIL.tgb[0] + 0.02, TAIL.tgb[1] + 0.02, TAIL.tgb[2] + 0.035);   // round the 90° box's case
  P('Tail pylon', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skins, cambered NACA 0021 (mod) section, Kevlar leading edge', mass: 70, explode: [-2.9, 0.5, 0],
    desc: 'The swept vertical fin (41° at the quarter chord) is cambered so that in forward flight it makes a side force that unloads the tail rotor. Above the tail cone it leans 20° to port, which tilts the tail-rotor shaft and lets the tail rotor help lift the tail.',
    callout: true, anchor: [-8.9, 3.0, pylonLean(3.0) + 0.1],   // mid-fin, right face
  }, [mesh(merge([pyl, tgbBulge]), paint)]);

  // Front spar at 18 % chord; its foot forks round the last tail-shaft joint and the 42° gearbox's
  // input housing where they lie on top of the tail cone. The pylon drive shaft climbs from 36 % chord
  // at the 42° box to 71 % at the 90° box, so the rear spar, at 62 % chord at the root, angles back
  // behind the shaft, the cable quadrant and the servo (about 88 % chord) and ends on the 90° box.
  const spar = [];
  {
    const a = V3(root.le[0] - 0.18 * root.chord, root.le[2], 0), b = V3(tip.le[0] - 0.18 * tip.chord, tip.le[2] - 0.05, 0);
    const pts = [];
    for (let k = 0; k <= 6; k++) { const p = a.clone().lerp(b, k / 6); p.z = pylonLean(p.y); pts.push(p); }
    for (let k = 2; k < 6; k++) spar.push(tube(pts[k], pts[k + 1], 0.03, 6));
    const at = (y) => a.clone().lerp(b, (y - a.y) / (b.y - a.y));
    // the two legs stand on fittings on the tail cone's top frame, above the cable and harness runs
    // (the port leg closer in: the fin is cambered to starboard)
    for (const lz of [0.115, -0.103]) {
      const p0 = at(1.97), p1 = at(2.15);
      spar.push(tube(V3(p0.x, p0.y, lz), V3(p1.x, p1.y, lz), 0.014, 6), tube(V3(p1.x, p1.y, lz), pts[2], 0.014, 6), box(0.07, 0.016, 0.045, [p0.x - 0.01, p0.y - 0.006, lz]));
    }
  }
  for (let k = 0; k < REAR_SPAR.length - 1; k++) spar.push(tube(rearSparAt(REAR_SPAR[k][1]), rearSparAt(REAR_SPAR[k + 1][1]), k < 2 ? 0.022 : 0.019, 6));
  spar.push(box(0.08, 0.016, 0.1, [REAR_SPAR[0][0] - 0.01, REAR_SPAR[0][1] - 0.008, 0]));   // its foot fitting on the tail cone's top frame
  // fold-hinge knuckles on the right side of the pylon, just above its joint with the tail cone
  for (const y of [1.99, 2.21]) spar.push(cyl(0.028, 0.028, 0.09, [-8.47, y, 0.135], 'y', 12), box(0.1, 0.07, 0.012, [-8.53, y, 0.125]));
  P('Pylon spars & fold hinge', {
    system: 'Structure', material: 'Aluminium spars, steel fold-hinge fittings', mass: 45, explode: [-2.9, 0.2, 0.6],
    desc: 'Two spars carry the tail-rotor thrust and gearbox loads down into the tail cone: the front spar, whose foot forks round the tail drive shaft where it enters the 42° gearbox, and the rear spar, which angles back behind the pylon drive shaft and the tail-rotor controls to the 90° gearbox. A hinge at the joint lets the pylon fold alongside the tail cone so the aircraft fits inside a C-130 or C-17. (Spar layout approximate.)',
  }, [mesh(merge(spar), MAT.primer())]);

  // ------------------------------------------------------------------ stabilator
  const sPivot = new THREE.Group();
  sPivot.position.set(-9.4, 1.66, 0);            // pivot inside the end of the tail cone, under the pylon trailing edge
  // GenHel: span 14.38 ft (4.38 m), root chord 3.67 ft (1.12 m), tip 2.54 ft (0.77 m), NACA 0014
  const sRoot = { le: [0.35, 0, 0.14], chord: 1.12, t: 0.14 };
  const sTip = { le: [0.25, 0, 2.19], chord: 0.77, t: 0.14 };
  const half = wingPanel({ root: sRoot, tip: sTip, stations: 4, camber: -0.02, n: 18, withChord: false });
  const stab = merge([half, mirrorZ(half), cyl(0.05, 0.05, 0.3, [0, 0, 0], 'z', 12)]);
  sPivot.add(mesh(stab, paint));
  P('Stabilator', {
    system: 'Flight controls', material: 'Aluminium/composite all-moving surface, 4.38 m span', mass: 50, explode: [-3.2, -0.6, 0],
    desc: 'An all-moving tailplane whose incidence is scheduled by computer: about 40° trailing edge down in the hover so the rotor downwash does not pitch the nose up, flattening out as airspeed builds. It also adds pitch stability in cruise. On the M it folds for air transport (a brochure feature), so the aircraft fits a C-17 or C-5 with less disassembly.',
    callout: true, anchor: [-9.6, 1.72, 1.9],
  }, sPivot);
  P('Stabilator actuators', {
    system: 'Flight controls', material: 'Dual electromechanical jackscrew actuators', mass: 12, count: 2, explode: [-3.0, -0.2, 0.4],
    desc: 'Two electromechanical actuators in series, each commanded by one of the two digital flight control computers — on the M those computers replaced the A/L\'s separate stabilator amplifiers. A fault in one is caught by the other and the pilot gets an aural warning.',
  }, [mesh(merge([tube([-9.0, 1.84, 0.07], [-9.32, 1.72, 0.09], 0.035, 10), tube([-9.0, 1.84, -0.07], [-9.32, 1.72, -0.09], 0.035, 10)]), MAT.hydraulic())]);
  const hinge = [];
  for (const sd of [1, -1]) {
    hinge.push(cyl(0.012, 0.012, 0.62, [0.05, 0.075, 0.42 * sd], 'x', 8));
    for (const x of [0.28, -0.18]) hinge.push(box(0.1, 0.05, 0.06, [x, 0.07, 0.42 * sd]));
  }
  P('Stabilator fold hinges', {
    system: 'Flight controls', material: 'Steel hinge fittings and fold pins', mass: 3, count: 2, explode: [-3.2, -0.2, 0],
    desc: 'A folding stabilator is one of the UH-60M\'s listed improvements: hinges near each root let the outer panels fold, so the aircraft goes into a transport aircraft with less disassembly. (Fold line and fittings approximate; not published.)',
  }, [mesh(merge(hinge), MAT.steel())], sPivot);

  // ------------------------------------------------------------------ gearboxes and pylon shaft
  const igb = V3(...TAIL.igb), tgb = V3(...TAIL.tgb), hub = V3(...TAIL.hub);
  // the 42° box's case: round, with a flat mounting face 7 cm below the shaft line that sits on the
  // tail cone's top skin over its frames and longerons
  const igbCase = () => {
    const g = new THREE.SphereGeometry(0.16, 18, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.07) p.setY(i, -0.07);
    g.computeVertexNormals();
    return g;
  };
  const n = V3(0, Math.sin(TAIL.cant), Math.cos(TAIL.cant));
  const pyDir = tgb.clone().sub(igb).normalize();
  P('Intermediate gearbox (42°)', {
    system: 'Drive system', material: 'Aluminium case, spiral-bevel gears, oil-lubricated', mass: 28, explode: [-2.6, 0.6, 0],
    desc: 'At the base of the pylon a pair of bevel gears turns the drive up the fin through about 42° and reduces its speed. Self-contained with its own oil, it can run 30 minutes at cruise with all its oil lost.',
  }, [mesh(merge([igbCase().translate(igb.x, igb.y, igb.z), cyl(0.07, 0.07, 0.22, [igb.x + 0.16, igb.y, 0], 'x', 14), tube(igb, igb.clone().addScaledVector(pyDir, 0.24), 0.09, 14)]), MAT.casting())]);
  P('Tail drive shaft section 6', {
    system: 'Drive system', material: 'Dynamically balanced aluminium-alloy tube', mass: 6, explode: [-2.8, 0.6, 0],
    desc: 'The sixth and last section climbs the inside of the pylon from the intermediate to the tail gearbox, with a disc coupling at each end.',
  }, [mesh(merge([tube(igb.clone().addScaledVector(pyDir, 0.285), tgb.clone().addScaledVector(pyDir, -0.285), 0.045, 12)]), MAT.steel())]);   // between the couplings on the two gearbox flanges
  P('Tail rotor gearbox (90°)', {
    system: 'Drive system', material: 'Magnesium case, bevel gears, pitch-change shaft through the output', mass: 38, explode: [-3.0, 0.9, -0.3],
    desc: 'Turns the drive 90° into the tail-rotor shaft and reduces it to 1,190 rpm — 4.6 times main-rotor speed — with the tail rotor\'s pitch-change shaft passing through its hollow output. Its housing is magnesium; it carries the tail rotor, the tail-rotor servo below it works the pitch-change shaft through it, and like the 42° box it can run 30 minutes with no oil.',
  }, [mesh(merge([tube(tgb.clone().addScaledVector(n, -0.08), tgb.clone().addScaledVector(n, 0.2), 0.15, 18), tube(tgb, tgb.clone().addScaledVector(pyDir, -0.24), 0.1, 14)]), MAT.casting())]);
  // tail-rotor servo, mounted on the 90° gearbox as the operator's manual describes: a trunnion collar
  // at its upper end on a bracket from the underside of the gearbox's input housing; its output rod
  // reaches up into the box, and it hangs between the pylon shaft and the rear spar
  const sLo = V3(...TR_CTL.servoLo), sHi = V3(...TR_CTL.servoHi), sRod = V3(-9.98, 3.36, -0.38);
  const sparAt = rearSparAt;   // rear-spar axis (see the spars above), here behind the servo
  // bracket foot on the input housing's underside, nearest the servo's upper end
  const svBracket = (() => {
    const ax = tgb.clone().addScaledVector(pyDir, -0.22), d = sHi.clone().sub(ax);
    d.addScaledVector(pyDir, -d.dot(pyDir)).normalize();
    return ax.addScaledVector(d, 0.1);
  })();
  P('Tail rotor servo', {
    system: 'Flight controls', material: 'Dual-stage hydraulic actuator on a trunnion bracket on the tail gearbox', mass: 9, explode: [-3.0, 0.4, -0.5],
    desc: 'Driven by cables from the pedals through the quadrant below it, it moves the tail rotor\'s pitch-change shaft through the tail gearbox. Two stages: the first on the No. 1 hydraulic system, the second on the backup pump. It is mounted on the tail gear box, as the operator\'s manual describes: a trunnion collar at its upper end bolts to a bracket under the box\'s input housing, so the box reacts its loads, and its output rod reaches up into the box. It hangs between the pylon drive shaft and the rear spar (exact position approximate).',
  }, [mesh(merge([tube(sLo, sHi, 0.04, 12), tube(sHi, sRod, 0.012, 8), cyl(0.045, 0.045, 0.03, [sHi.x, sHi.y, sHi.z], 'y', 12).translate(0, -0.01, 0),
    tube(svBracket, sHi.clone().addScaledVector(sHi.clone().sub(svBracket).normalize(), -0.035), 0.016, 8), cyl(0.026, 0.026, 0.04, [svBracket.x, svBracket.y, svBracket.z], 'y', 10).translate(0, 0.01, 0),
    cyl(0.02, 0.02, 0.07, [sLo.x, sLo.y, sLo.z], 'x', 10)]), MAT.hydraulic())]);
  // gearbox chip/temperature sensors, sight gauges and filler caps
  const tc = tgb.clone().addScaledVector(n, 0.06), dn = V3(0, -Math.cos(TAIL.cant), Math.sin(TAIL.cant));
  P('Tail gearbox chip/temperature sensors & sight gauges', {
    system: 'Drive system', material: 'Fuzz burn-off chip detectors with bimetal temperature switches, oil sight gauges, filler caps', mass: 1, count: 4, explode: [-2.8, 1.25, 0.6],
    desc: 'The 42° and 90° gearboxes carry identical chip/temperature sensors: a magnetic plug with fuzz burn-off lights CHIP INT XMSN or CHIP TAIL XMSN for a real chip, and a bimetal strip closes at 140 °C to light the oil-temperature caution. A sight gauge on each box shows its oil level on the walk-round.',
  }, [mesh(merge([cyl(0.022, 0.022, 0.05, [igb.x - 0.06, igb.y - 0.03, 0.14], 'z', 10), cyl(0.026, 0.026, 0.02, [igb.x + 0.05, igb.y, 0.155], 'z', 14), cyl(0.03, 0.03, 0.03, [igb.x - 0.02, igb.y + 0.16, 0], 'y', 12),
    tube(tc.clone().addScaledVector(dn, 0.14), tc.clone().addScaledVector(dn, 0.2), 0.022, 10), cyl(0.026, 0.026, 0.02, [tc.x - 0.15, tc.y, tc.z], 'x', 14), tube(tc.clone().addScaledVector(dn, -0.14), tc.clone().addScaledVector(dn, -0.18), 0.03, 12)]), MAT.yellow())]);
  // tail rotor quadrant: where the two control cables meet the tail-rotor servo's input
  const qd = V3(...TR_CTL.quadrant);
  const sector = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16, 1, false, -0.6, 1.9).rotateX(Math.PI / 2).translate(qd.x, qd.y, qd.z);
  P('Tail rotor quadrant', {
    system: 'Flight controls', material: 'Aluminium cable quadrant on a pivot, tension spring, microswitches', mass: 2, explode: [-2.4, 0.2, -0.7],
    desc: 'The two tail-rotor cables end on this quadrant, which turns the servo\'s input. Spring tension keeps it working normally if one cable is cut, and microswitches then light TAIL ROTOR QUADRANT; if control is lost altogether, the spring sets the blades to a pitch that roughly balances cruise power. (Location approximate.)',
  }, [mesh(merge([sector, cyl(0.016, 0.016, 0.07, [qd.x, qd.y, qd.z], 'z', 10), box(0.04, 0.03, 0.03, [qd.x + 0.09, qd.y - 0.08, qd.z]), box(0.04, 0.03, 0.03, [qd.x - 0.02, qd.y - 0.11, qd.z]),
      tube(sparAt(qd.y).add(V3(0.018, 0, -0.005)), V3(qd.x, qd.y, qd.z - 0.042), 0.012, 8), cyl(0.024, 0.024, 0.012, [qd.x, qd.y, qd.z - 0.04], 'z', 10)]), MAT.casting()),   // pivot bracket forward from the rear spar
    // output link up to the servo's input lever, and the centring spring to the bracket
    mesh(merge([tube([qd.x, qd.y + 0.075, qd.z], sLo.clone().addScaledVector(sHi.clone().sub(sLo).normalize(), 0.06).add(V3(0, 0, 0.045)), 0.009, 6),
      cyl(0.014, 0.014, 0.03, [qd.x, qd.y + 0.075, qd.z], 'z', 8), tube([qd.x + 0.05, qd.y - 0.02, qd.z - 0.02], [qd.x + 0.13, qd.y, qd.z - 0.035], 0.007, 6)]), MAT.steel())]);

  // ------------------------------------------------------------------ tail rotor (non-rotating frame, spinning children)
  const trFrame = new THREE.Group();
  trFrame.position.copy(hub);
  trFrame.quaternion.setFromUnitVectors(V3(0, 1, 0), n);
  air.add(trFrame);
  const spins = [];
  const feathers = [];
  const trPart = (name, info, build) => {
    const part = A.part(name, info, [], trFrame);
    const s = new THREE.Group();
    part.add(s);
    spins.push(s);
    build(s);
    return part;
  };
  const qInv = trFrame.quaternion.clone().invert();
  const toTr = (p) => V3(...p).sub(hub).applyQuaternion(qInv);
  // the feed climbs the pylon beside the pylon drive shaft, 0.115 m to starboard of its axis
  // (closing in near the top, where the pylon thins; the tail-rotor servo and quadrant sit behind the shaft)
  const shaftSide = (t, off = 0.115) => [TAIL.igb[0] + (TAIL.tgb[0] - TAIL.igb[0]) * t, TAIL.igb[1] + (TAIL.tgb[1] - TAIL.igb[1]) * t, TAIL.igb[2] + (TAIL.tgb[2] - TAIL.igb[2]) * t + off];
  P('Tail rotor slip ring', {
    system: 'Electrical', material: 'Slip-ring assembly on the tail-rotor shaft, feed cable up the pylon', mass: 3, explode: [-2.9, 1.7, -0.4],
    desc: 'Carries de-ice power onto the turning tail-rotor shaft between the gearbox and the hub. The controller switches the tail-rotor power itself and sends it through here to all four blades at once, so unlike the main rotor the tail rotor needs no distributor. Its cable branches off the tail-cone harness and climbs the pylon.',
  }, [mesh(merge([cyl(0.068, 0.068, 0.06, [0, -0.13, 0], 'y', 20), cyl(0.074, 0.074, 0.01, [0, -0.15, 0], 'y', 20)]), MAT.casting()),
    mesh(pipe([toTr(DEICE.tailEnd), toTr([-8.64, 2.08, -0.05]), ...[[0.2], [0.4], [0.6], [0.75, 0.1], [0.88, 0.09]].map(([t, o]) => toTr(shaftSide(t, o))), toTr([-9.86, 3.42, -0.24]), toTr([-9.9, 3.49, -0.215]), V3(0.05, -0.13, 0.06)], 0.009, 5), MAT.wiring())], trFrame);
  const bladeG = trBladeGeometry();
  // root of each blade, feathering with it: a torque tube round the crossbeam spar (clear of it at
  // any pitch) whose pitch horn juts to the leading side, where the pitch link's upper end is pinned
  const HORN = [0.3, 0.025, -0.1];
  const torqueTube = lathe([[0.056, 0.19], [0.064, 0.19], [0.064, 0.31], [0.056, 0.31], [0.056, 0.19]], 18).rotateZ(-Math.PI / 2);   // a closed annulus along x
  const hornG = merge([torqueTube, tube([0.3, 0.004, -0.06], HORN, 0.011, 8), cyl(0.016, 0.016, 0.03, HORN, 'y', 10)]);
  trPart('Tail rotor blades', {
    system: 'Rotor system', material: 'Graphite/glass skins over the crossbeam spars, nickel erosion strips; torque tubes with pitch horns', mass: 32, count: 4, explode: [-3.1, 1.1, 0],
    desc: 'Four blades, 3.35 m across, turning at 1,190 rpm. Each blade root is a torque tube round its spar, with a pitch horn for the pitch link: turning the tube twists the spar to change pitch. Thrust to starboard balances the main rotor\'s torque; because the shaft is canted 20° up, sin 20° ≈ a third of that thrust (about 2.5 kN in a heavy hover) also lifts the tail: the operator\'s manual gives the tail rotor 2.5 % of the total lifting force in a hover.',
    callout: true, anchor: [0, 0.25, -0.3],     // just above the hub, over the blade roots
  }, (s) => {
    for (let i = 0; i < 4; i++) {
      const az = new THREE.Group(); az.rotation.y = (i * Math.PI) / 2;
      const f = new THREE.Group();
      az.add(f); s.add(az);
      f.add(mesh(bladeG, MAT.blade()), mesh(hornG, MAT.titanium()));
      feathers.push(f);
    }
  });
  trPart('Tail rotor hub & crossbeam spars', {
    system: 'Rotor system', material: 'Two continuous graphite-epoxy crossbeam spars clamped between titanium hub plates', mass: 24, explode: [-3.1, 0.7, 0],
    desc: 'Bearingless: two flexible composite spars cross at the hub, each forming a pair of opposite blades. Flapping and pitch change come from the spars bending and twisting — no bearings, no lubrication.',
  }, (s) => {
    // the two spars stacked crosswise, clamped between the hub plates by four bolts through the
    // crossing; the hub's shaft from the gearbox output ends on the lower plate
    const bolts = [];
    for (const [bx, bz] of [[0.033, 0.033], [-0.033, 0.033], [0.033, -0.033], [-0.033, -0.033]]) bolts.push(cyl(0.008, 0.008, 0.13, [bx, 0, bz], 'y', 8), cyl(0.014, 0.014, 0.008, [bx, 0.056, bz], 'y', 8), cyl(0.014, 0.014, 0.008, [bx, -0.056, bz], 'y', 8));
    s.add(mesh(merge([box(0.9, 0.022, 0.1, [0, 0.011, 0]), box(0.1, 0.022, 0.9, [0, -0.011, 0]), cyl(0.15, 0.15, 0.03, [0, 0.037, 0], 'y', 24), cyl(0.15, 0.15, 0.03, [0, -0.037, 0], 'y', 24), cyl(0.06, 0.06, 0.34, [0, -0.222, 0], 'y', 16), ...bolts]), MAT.titanium()));
  });
  const links = [];
  const spider = new THREE.Group();
  trPart('Tail rotor pitch-change beam & links', {
    system: 'Flight controls', material: 'Steel pitch beam (spider) and four pitch links', mass: 5, explode: [-3.1, 1.5, 0],
    desc: 'The pitch-change shaft, sliding through the hollow gearbox output and the hub centre, pushes this spider in and out along the rotor axis; its four links pull on the blades\' pitch horns, twisting their torque tubes together and changing all four pitches at once for yaw control.',
  }, (s) => {
    s.add(spider);
    spider.add(mesh(merge([cyl(0.04, 0.04, 0.08, [0, 0, 0], 'y', 12), cyl(0.018, 0.018, 0.13, [0, -0.085, 0], 'y', 10), ...[0, 1, 2, 3].map((i) => { const g = box(0.24, 0.02, 0.03, [0.12, 0, 0]); g.rotateY((i * Math.PI) / 2 + 0.35); return g; })]), MAT.steel()));
    for (let i = 0; i < 4; i++) { const m = mesh(unitRod(8), MAT.steel()); s.add(m); links.push({ i, m }); }
  });

  // ------------------------------------------------------------------ exterior lights
  const strobe = strobeMat();
  P('Anti-collision beacons', {
    system: 'Electrical', material: 'Red LED anti-collision beacons', mass: 2, count: 2, explode: [-2.0, 1.6, 0],
    desc: 'A red beacon on the pylon tip and one under the belly flash about once a second so other aircraft see the helicopter from any direction; they can be dimmed or switched to infrared for night-vision operations.',
  }, [mesh(new THREE.SphereGeometry(0.05, 12, 8).translate(tip.le[0] - 0.3, 4.05, pylonLean(4.05)), strobe, { cast: false }),
    mesh(new THREE.SphereGeometry(0.045, 12, 8).translate(-0.8, 0.45, 0), strobe, { cast: false })]);
  // the side lights on the outboard face of each main gear's upper support fitting (its box:
  // x 2.18–2.29, y 1.20–1.32, outboard face at |z| 1.33), in a small housing above the strut
  const navSide = (s) => [box(0.07, 0.045, 0.024, [2.245, 1.295, 1.341 * s]), new THREE.SphereGeometry(0.02, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(s * Math.PI / 2).translate(2.245, 1.295, 1.352 * s)];
  const [gHouse, gLens] = navSide(1), [rHouse, rLens] = navSide(-1);
  P('Position lights', {
    system: 'Electrical', material: 'Red, green and white navigation lights in small housings', mass: 1.5, count: 3, explode: [0.2, 0.3, 1.2],
    desc: 'Red on the left and green on the right, outboard of each main landing gear support, and white on the top of the tail pylon — where the operator\'s manual puts them — so other pilots can tell which way the helicopter is pointing at night. Infrared position lights sit close by for flying on night-vision goggles.',
  }, [mesh(new THREE.SphereGeometry(0.035, 10, 8).translate(tip.le[0] - tip.chord + 0.04, 3.97, pylonLean(3.97)), MAT.navWhite(), { cast: false }),
    mesh(merge([gHouse, rHouse]), MAT.paintDark()), mesh(gLens, MAT.navGreen(), { cast: false }), mesh(rLens, MAT.navRed(), { cast: false })]);
  P('Formation lights', {
    system: 'Electrical', material: 'Low-intensity electroluminescent strips (NVG compatible)', mass: 1, count: 3, explode: [-2.4, 0.8, 0.6],
    desc: 'Dim green strips on the tail cone sides and the pylon let pilots on night-vision goggles hold position in close formation without the glare of the navigation lights.',
  }, [mesh(merge([box(0.5, 0.05, 0.012, [-6.0, 1.75, 0.395]), box(0.5, 0.05, 0.012, [-6.0, 1.75, -0.395]), box(0.5, 0.06, 0.012, [-9.45, 3.4, pylonLean(3.4) + 0.1])]), MAT.formation(), { cast: false })]);

  const trSt = { phi: 0, pitch: 12 * DEG };
  const lead = -0.35;   // spider arms 20° ahead of each blade, so the links run out to the leading-side horns
  function update(phi, pitch) {
    trSt.phi = phi; trSt.pitch = pitch;
    for (const s of spins) s.rotation.y = phi;
    for (const f of feathers) f.rotation.x = pitch;
    spider.position.y = 0.11 + 0.075 * Math.sin(pitch);
    for (const l of links) {
      const a = (l.i * Math.PI) / 2;
      const ca = Math.cos(a - lead), sa = Math.sin(a - lead);
      const top = V3(0.24 * ca, spider.position.y, -0.24 * sa);
      // the horn's pin (HORN in the blade's feathering frame), turned with pitch and azimuth
      const hl = V3(HORN[0], HORN[1] * Math.cos(pitch) - HORN[2] * Math.sin(pitch), HORN[1] * Math.sin(pitch) + HORN[2] * Math.cos(pitch)).applyAxisAngle(V3(0, 1, 0), a);
      aimRod(l.m, top, hl, 0.012);
    }
  }
  update(0, 12 * DEG);
  return { update, stabilator: sPivot, strobe, n };
}
