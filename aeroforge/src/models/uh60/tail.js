// UH-60M tail and upper fairings: the cambered tail pylon (its upper part leans 20° to port so the
// tail-rotor shaft is canted), the variable-incidence stabilator and its actuators, the 42°
// intermediate and 90° tail gearboxes, the pylon drive shaft, the bearingless four-blade tail
// rotor on two composite crossbeam spars, its pitch-change beam and servo, plus the transmission
// fairing, aft deck fairing and tail-drive-shaft cover on top of the fuselage.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { wingPanel, mirrorZ, loftRings, orientOutward, airfoilLoop } from '../../engine/geometry.js';
import { MAT, DEG, V3, merge, box, cyl, tube, pchip, unitRod, aimRod, TAIL, pylonLean, strobeMat } from './common.js';

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

export function buildTail({ A, P, air, roofY }) {
  const paint = MAT.paint();

  // ------------------------------------------------------------------ upper fairings
  const shaftX = -0.03;
  const trans = fairing([[-0.9, 0.38, 2.66], [-0.4, 0.44, 2.72], [0.0, 0.62, 2.74], [0.4, 0.72, 2.74], [1.0, 0.73, 2.71], [1.6, 0.7, 2.63], [2.2, 0.58, 2.49], [2.6, 0.35, 2.31]], roofY, {
    nu: 64, nv: 40, skip: (c) => c.y > 2.55 && Math.hypot(c.x - shaftX, c.z) < 0.48,
  });
  const well = cyl(0.48, 0.48, 0.2, [shaftX, 2.645, 0], 'y', 40, true);
  const wellLip = new THREE.TorusGeometry(0.48, 0.018, 6, 40).rotateX(Math.PI / 2).translate(shaftX, 2.745, 0);
  P('Transmission fairing', {
    system: 'Skin & fairings', skin: true, material: 'Kevlar/graphite composite cowls on quick-release hinges', mass: 55, explode: [0.3, 2.1, 0],
    desc: 'Streamlines the forward upper deck, the flight-control closet and the main gearbox. Its panels open as walkways for daily inspection of the rotor head.',
  }, [mesh(merge([trans, well, wellLip]), paint), mesh(well.clone(), MAT.interior())]);
  const aftF = fairing([[-3.6, 0.16, roofY(-3.6) + 0.12], [-3.0, 0.28, 2.45], [-2.4, 0.35, 2.6], [-1.5, 0.37, 2.66], [-0.9, 0.38, 2.67]], roofY, { nu: 30, nv: 28 });
  const grille = [];
  for (let k = 0; k < 7; k++) grille.push(box(0.025, 0.012, 0.42, [-1.48 + k * 0.05, 2.668, 0]));
  P('Aft deck fairing', {
    system: 'Skin & fairings', skin: true, material: 'Composite fairing with oil-cooler grille', mass: 22, explode: [-0.6, 2.1, 0],
    desc: 'Covers the oil cooler, APU and the start of the tail drive shaft between the engine nacelles; the grille on top lets the oil-cooler blower breathe.',
  }, [mesh(aftF, paint), mesh(merge(grille), MAT.black())]);
  const cover = fairing([[-8.45, 0.12, roofY(-8.45) + 0.12], [-6.0, 0.13, roofY(-6.0) + 0.15], [-3.6, 0.16, roofY(-3.6) + 0.12]], roofY, { nu: 50, nv: 16 });
  const igbFair = new THREE.SphereGeometry(1, 20, 14).scale(0.36, 0.2, 0.2).translate(TAIL.igb[0] + 0.05, TAIL.igb[1] + 0.02, 0);
  P('Tail drive shaft cover', {
    system: 'Skin & fairings', skin: true, material: 'Hinged aluminium/composite cover', mass: 14, explode: [-2.4, 1.0, 0],
    desc: 'A hinged cover over the tail drive shaft along the top of the tail cone, ending in the fairing over the 42° intermediate gearbox.',
  }, [mesh(merge([cover, igbFair]), paint)]);

  // ------------------------------------------------------------------ pylon
  const root = { le: [-8.05, 0, 1.62], chord: 2.0, t: 0.18 };
  const tip = { le: [-9.55, 0, 4.02], chord: 0.95, t: 0.15 };
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
  const tgbBulge = new THREE.SphereGeometry(1, 20, 14).scale(0.42, 0.26, 0.17).translate(TAIL.tgb[0] + 0.02, TAIL.tgb[1] + 0.02, TAIL.tgb[2] + 0.06);
  P('Tail pylon', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skins, cambered section, Kevlar leading edge', mass: 70, explode: [-2.9, 0.5, 0],
    desc: 'The swept vertical fin is cambered so that in forward flight it makes a side force that unloads the tail rotor. Above the tail cone it leans 20° to port, which tilts the tail-rotor shaft and lets the tail rotor help lift the tail.',
    callout: true, anchor: [-9.2, 3.0, pylonLean(3.0) - 0.12],
  }, [mesh(merge([pyl, tgbBulge]), paint)]);

  const spar = [];
  for (const cf of [0.18, 0.62]) {
    const a = V3(root.le[0] - cf * root.chord, root.le[2], 0), b = V3(tip.le[0] - cf * tip.chord, tip.le[2] - 0.05, 0);
    const pts = [];
    for (let k = 0; k <= 6; k++) { const p = a.clone().lerp(b, k / 6); p.z = pylonLean(p.y); pts.push(p); }
    for (let k = 0; k < 6; k++) spar.push(tube(pts[k], pts[k + 1], 0.03, 6));
  }
  spar.push(cyl(0.045, 0.045, 0.5, [-9.0, 1.95, 0.27], 'y', 12), cyl(0.045, 0.045, 0.5, [-9.75, 1.85, 0.2], 'y', 12));
  P('Pylon spars & fold hinge', {
    system: 'Structure', material: 'Aluminium spars, steel fold-hinge fittings', mass: 45, explode: [-2.9, 0.2, 0.6],
    desc: 'Two spars carry the tail-rotor thrust and gearbox loads down into the tail cone. A hinge at the joint lets the pylon fold alongside the tail cone so the aircraft fits inside a C-130 or C-17.',
  }, [mesh(merge(spar), MAT.primer())]);

  // ------------------------------------------------------------------ stabilator
  const sPivot = new THREE.Group();
  sPivot.position.set(-9.55, 1.66, 0);
  const sRoot = { le: [-9.24 + 9.55, 0, 0.14], chord: 1.05, t: 0.12 };
  const sTip = { le: [-9.32 + 9.55, 0, 2.19], chord: 0.8, t: 0.11 };
  const half = wingPanel({ root: sRoot, tip: sTip, stations: 4, camber: -0.02, n: 18, withChord: false });
  const stab = merge([half, mirrorZ(half), cyl(0.05, 0.05, 0.3, [0, 0, 0], 'z', 12)]);
  sPivot.add(mesh(stab, paint));
  P('Stabilator', {
    system: 'Flight controls', material: 'Aluminium/composite all-moving surface, 4.38 m span', mass: 50, explode: [-3.2, -0.6, 0],
    desc: 'An all-moving tailplane whose incidence is scheduled by computer: about 40° trailing edge down in the hover so the rotor downwash does not pitch the nose up, flattening out as airspeed builds. It also adds pitch stability in cruise.',
    callout: true, anchor: [-9.75, 1.72, 1.9],
  }, sPivot);
  P('Stabilator actuators', {
    system: 'Flight controls', material: 'Dual electromechanical jackscrew actuators', mass: 12, count: 2, explode: [-3.0, -0.2, 0.4],
    desc: 'Two electric actuators in series, each driven by its own stabilator amplifier; a fault in one is caught by the other and the pilot gets an aural warning.',
  }, [mesh(merge([tube([-9.15, 1.86, 0.08], [-9.48, 1.72, 0.1], 0.035, 10), tube([-9.15, 1.86, -0.08], [-9.48, 1.72, -0.1], 0.035, 10)]), MAT.hydraulic())]);

  // ------------------------------------------------------------------ gearboxes and pylon shaft
  const igb = V3(...TAIL.igb), tgb = V3(...TAIL.tgb), hub = V3(...TAIL.hub);
  const n = V3(0, Math.sin(TAIL.cant), Math.cos(TAIL.cant));
  const pyDir = tgb.clone().sub(igb).normalize();
  P('Intermediate gearbox (42°)', {
    system: 'Drive system', material: 'Aluminium case, spiral-bevel gears, splash lubricated', mass: 28, explode: [-2.6, 0.6, 0],
    desc: 'At the base of the pylon a pair of bevel gears turns the drive up the fin through about 42°. Self-contained with its own oil and a chip detector.',
  }, [mesh(merge([new THREE.SphereGeometry(0.16, 18, 14).translate(igb.x, igb.y, igb.z), cyl(0.09, 0.09, 0.22, [igb.x + 0.16, igb.y, 0], 'x', 14), tube(igb, igb.clone().addScaledVector(pyDir, 0.24), 0.09, 14)]), MAT.casting())]);
  P('Tail drive shaft, pylon section', {
    system: 'Drive system', material: 'Aluminium-alloy tube, flexible couplings', mass: 8, explode: [-2.8, 0.6, 0],
    desc: 'Climbs the inside of the pylon from the intermediate to the tail gearbox.',
  }, [mesh(merge([tube(igb.clone().addScaledVector(pyDir, 0.2), tgb.clone().addScaledVector(pyDir, -0.2), 0.045, 12)]), MAT.steel())]);
  P('Tail rotor gearbox (90°)', {
    system: 'Drive system', material: 'Aluminium case, bevel gears, pitch-change shaft through the output', mass: 38, explode: [-3.0, 0.9, -0.3],
    desc: 'Turns the drive 90° into the tail-rotor shaft and reduces it to 1,190 rpm — 4.6 times main-rotor speed — with the tail rotor\'s pitch-change shaft passing through its hollow output.',
  }, [mesh(merge([tube(tgb.clone().addScaledVector(n, -0.08), tgb.clone().addScaledVector(n, 0.2), 0.15, 18), tube(tgb, tgb.clone().addScaledVector(pyDir, -0.24), 0.1, 14)]), MAT.casting())]);
  P('Tail rotor servo', {
    system: 'Flight controls', material: 'Dual-stage hydraulic actuator', mass: 9, explode: [-3.0, 0.4, -0.5],
    desc: 'Driven by cables from the pedals, it moves the pitch-change shaft through the tail gearbox. Two stages: No. 2 hydraulic system normally, the backup pump if that fails.',
  }, [mesh(merge([tube([-9.72, 2.95, pylonLean(2.95)], [-9.82, 3.28, pylonLean(3.28)], 0.04, 12)]), MAT.hydraulic())]);

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
  const bladeG = trBladeGeometry();
  trPart('Tail rotor blades', {
    system: 'Rotor system', material: 'Graphite/glass skins over the crossbeam spars, nickel erosion strips', mass: 32, count: 4, explode: [-3.1, 1.1, 0],
    desc: 'Four blades, 3.35 m across, turning at 1,190 rpm. Thrust to starboard balances the main rotor\'s torque; because the shaft is canted 20° up, about a third of that thrust\'s sine — roughly 3 % of the weight — also lifts the tail.',
    callout: true, anchor: [0, 0.25, 0],
  }, (s) => {
    for (let i = 0; i < 4; i++) {
      const az = new THREE.Group(); az.rotation.y = (i * Math.PI) / 2;
      const f = new THREE.Group();
      az.add(f); s.add(az);
      f.add(mesh(bladeG, MAT.blade()));
      feathers.push(f);
    }
  });
  trPart('Tail rotor hub & crossbeam spars', {
    system: 'Rotor system', material: 'Two continuous graphite-epoxy crossbeam spars clamped between titanium hub plates', mass: 24, explode: [-3.1, 0.7, 0],
    desc: 'Bearingless: two flexible composite spars cross at the hub, each forming a pair of opposite blades. Flapping and pitch change come from the spars bending and twisting — no bearings, no lubrication.',
  }, (s) => {
    s.add(mesh(merge([box(0.9, 0.022, 0.1, [0, 0.03, 0]), box(0.1, 0.022, 0.9, [0, -0.03, 0]), cyl(0.15, 0.15, 0.03, [0, 0.065, 0], 'y', 24), cyl(0.15, 0.15, 0.03, [0, -0.065, 0], 'y', 24), cyl(0.06, 0.06, 0.38, [0, -0.2, 0], 'y', 16)]), MAT.titanium()));
  });
  const links = [];
  const spider = new THREE.Group();
  trPart('Tail rotor pitch-change beam & links', {
    system: 'Flight controls', material: 'Steel pitch beam (spider) and four pitch links', mass: 5, explode: [-3.1, 1.5, 0],
    desc: 'The pitch-change shaft pushes this spider in and out along the rotor axis; its four links twist the blades\' torque tubes together, changing all four pitches at once for yaw control.',
  }, (s) => {
    s.add(spider);
    spider.add(mesh(merge([cyl(0.04, 0.04, 0.08, [0, 0, 0], 'y', 12), ...[0, 1, 2, 3].map((i) => { const g = box(0.24, 0.02, 0.03, [0.12, 0, 0]); g.rotateY((i * Math.PI) / 2 - 0.35); return g; })]), MAT.steel()));
    for (let i = 0; i < 4; i++) { const m = mesh(unitRod(8), MAT.steel()); s.add(m); links.push({ i, m }); }
  });

  // ------------------------------------------------------------------ lights on the tail
  const strobe = strobeMat();
  P('Anti-collision & position lights', {
    system: 'Electrical', material: 'LED anti-collision beacons, position and formation lights', mass: 6, explode: [-2.0, 1.6, 0],
    desc: 'Red anti-collision beacons on the pylon tip and belly, red and green position lights on the cabin sides, a white tail light, and low-intensity green formation strips for flying in close formation at night.',
  }, [mesh(new THREE.SphereGeometry(0.05, 12, 8).translate(tip.le[0] - 0.45, 4.05, pylonLean(4.05)), strobe, { cast: false }),
    mesh(new THREE.SphereGeometry(0.035, 10, 8).translate(-10.02, 2.2, pylonLean(2.2)), MAT.navWhite(), { cast: false }),
    mesh(new THREE.SphereGeometry(0.045, 12, 8).translate(-0.8, 0.45, 0), strobe, { cast: false }),
    mesh(new THREE.SphereGeometry(0.04, 10, 8).translate(-1.05, 2.12, 1.12), MAT.navGreen(), { cast: false }),
    mesh(new THREE.SphereGeometry(0.04, 10, 8).translate(-1.05, 2.12, -1.12), MAT.navRed(), { cast: false }),
    mesh(merge([box(0.5, 0.05, 0.012, [-6.0, 1.75, 0.395]), box(0.5, 0.05, 0.012, [-6.0, 1.75, -0.395]), box(0.6, 0.012, 0.06, [-9.5, 3.4, pylonLean(3.4) + 0.09])]), MAT.formation(), { cast: false })]);

  const trSt = { phi: 0, pitch: 12 * DEG };
  const lead = 0.35;
  function update(phi, pitch) {
    trSt.phi = phi; trSt.pitch = pitch;
    for (const s of spins) s.rotation.y = phi;
    for (const f of feathers) f.rotation.x = pitch;
    spider.position.y = 0.11 + 0.075 * Math.sin(pitch);
    for (const l of links) {
      const a = (l.i * Math.PI) / 2;
      const ca = Math.cos(a - lead), sa = Math.sin(a - lead);
      const top = V3(0.24 * ca, spider.position.y, -0.24 * sa);
      // horn on the leading side of each blade root, rising with pitch
      const hl = V3(0.3, 0.075 * Math.sin(pitch) + 0.02, -0.075 * Math.cos(pitch)).applyAxisAngle(V3(0, 1, 0), a);
      aimRod(l.m, top, hl, 0.012);
    }
  }
  update(0, 12 * DEG);
  return { update, stabilator: sPivot, strobe, n };
}
