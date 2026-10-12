// KESTREL MQ-X — fictional medium-altitude long-endurance (MALE) remotely piloted aircraft.
// High-aspect-ratio NACA 0015 wing, Y-tail, pusher turboprop, satcom radome and a
// gimballed EO/IR sensor turret with laser designator.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { loftRings, orientOutward, mirrorZ, wingPanel, wingPoint, hingedMesh, lathe, ogiveProfile, rod, interpKeys, mergeGeometries } from '../engine/geometry.js';
import { M } from '../engine/materials.js';

const X = (s) => 5.5 - s;
const W = [[0, 0.04], [0.6, 0.4], [1.5, 0.55], [3, 0.53], [6, 0.45], [8.5, 0.35], [10.4, 0.22], [11, 0.1]];
const HT = [[0, 0.04], [0.6, 0.45], [1.4, 0.72], [2.4, 0.74], [4, 0.55], [6, 0.5], [8.5, 0.4], [10.4, 0.28], [11, 0.12]];
const HB = [[0, 0.04], [0.6, 0.28], [1.5, 0.42], [4, 0.45], [6, 0.42], [8.5, 0.32], [10.4, 0.2], [11, 0.1]];
const Y0 = [[0, -0.08], [2, 0], [11, 0.06]];

function ring(s, n = 22) {
  const w = interpKeys(W, s), ht = interpKeys(HT, s), hb = interpKeys(HB, s), y0 = interpKeys(Y0, s);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const e = 2 / 2.4;
    pts.push([X(s), y0 + (sn >= 0 ? ht : hb) * Math.sign(sn) * Math.pow(Math.abs(sn), e), w * Math.sign(c) * Math.pow(Math.abs(c), e)]);
  }
  return pts;
}
const segment = (s0, s1, steps) => {
  const rings = [];
  for (let i = 0; i <= steps; i++) rings.push(ring(s0 + ((s1 - s0) * i) / steps));
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true }));
};

function store(length, r, finSpan, finCount = 4, noseLen = 0.4) {
  const nose = lathe(ogiveProfile(r, noseLen, length - noseLen, 10), 20);
  const body = new THREE.CylinderGeometry(r, r * 0.85, length - noseLen, 20);
  body.translate(0, (length - noseLen) / 2, 0);
  const parts = [nose.toNonIndexed(), body.toNonIndexed()];
  for (let k = 0; k < finCount; k++) {
    const f = new THREE.BoxGeometry(0.01, length * 0.14, finSpan);
    f.translate(0, length * 0.1, r + finSpan / 2);
    f.rotateY((k / finCount) * Math.PI * 2 + Math.PI / 4);
    parts.push(f.toNonIndexed());
  }
  const g = mergeGeometries(parts);
  g.rotateZ(-Math.PI / 2);
  g.translate(-length / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildUAV() {
  const A = new Assembly();
  const air = new THREE.Group();
  A.root.add(air);
  const P = (name, info, objs) => A.part(name, info, objs, air);

  // ----------------------------------------------------------------- fuselage
  P('Satcom radome', {
    system: 'Communications', material: 'Quartz/epoxy radome', mass: 40, explode: [2.4, 0.4, 0],
    desc: 'Houses the 0.76 m Ku-band satellite dish — the beyond-line-of-sight link that lets crews fly from another continent.',
    callout: true, anchor: [X(1.3), 0.85, 0],
  }, mesh(segment(0, 2.3, 14), M.offWhite()));
  const dish = mesh(lathe(Array.from({ length: 9 }, (_, i) => { const r = (i / 8) * 0.36; return [r, (r * r) / 0.5]; }), 32), M.aluminium());
  dish.material = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
  dish.rotation.z = Math.PI / 2 - 0.6;
  dish.position.set(X(1.2), 0.3, 0);
  P('Ku-band satcom antenna', { system: 'Communications', material: 'Aluminium reflector', mass: 18, explode: [1.6, 0.9, 0], desc: 'Steerable dish tracking a geostationary relay; ~0.6 s round-trip latency shapes how the aircraft is flown.' }, dish);
  P('Forward fuselage', {
    system: 'Structure', material: 'Carbon/epoxy monocoque', mass: 210, explode: [0.9, 0, 0],
    desc: 'Avionics bays, nose gear well and the sensor-turret mount.',
  }, mesh(segment(2.3, 5.2, 10), M.uavGrey()));
  P('Centre & aft fuselage', {
    system: 'Structure', material: 'Carbon/epoxy, Kevlar fuel cells', mass: 420, explode: [0, 0, 0],
    desc: 'Wing carry-through, 1,800 kg of internal fuel and the engine bay. Long and slender to keep wetted-area drag low.',
  }, mesh(segment(5.2, 11, 12), M.uavGrey()));

  // ----------------------------------------------------------------- wing
  const wRoot = { le: [0.75, 0.34, 0.35], chord: 1.55, t: 0.15 };
  const wTip = { le: [0.45, 0.34 + 9.7 * Math.tan(0.026), 10.05], chord: 0.72, t: 0.12 };
  const surf = { flap: [], ail: [], rv: [] };
  for (const side of [1, -1]) {
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const box = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0, c1: 0.74, stations: 10, twist: -2.5 }));
    const tipFill = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.74, c1: 1, eta0: 0.95, eta1: 1, stations: 1 }));
    const gapFill = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.74, c1: 1, eta0: 0, eta1: 0.04, stations: 1 }));
    const wing = P(side > 0 ? 'Starboard wing' : 'Port wing', {
      system: 'Airframe', material: 'Carbon spar caps, foam-core skins', mass: 260, explode: [0, 0.4, 2.2 * side],
      desc: '20.1 m span, aspect ratio 16.8. The long, thick wing gives a lift-to-drag ratio near 20 at loiter speed.',
      callout: side > 0, anchor: [-0.2, 0.5, 6.5 * side],
    }, [mesh(box, M.uavGrey()), mesh(tipFill, M.uavGrey()), mesh(gapFill, M.uavGrey())]);
    const flap = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.74, c1: 1, eta0: 0.04, eta1: 0.46, stations: 3 }));
    const fH = hingedMesh(flap, M.uavDark(), mz(wingPoint(wRoot, wTip, 0.04, 0.74)), mz(wingPoint(wRoot, wTip, 0.46, 0.74)));
    const ail = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.74, c1: 1, eta0: 0.48, eta1: 0.95, stations: 3 }));
    const aH = hingedMesh(ail, M.uavDark(), mz(wingPoint(wRoot, wTip, 0.48, 0.74)), mz(wingPoint(wRoot, wTip, 0.95, 0.74)));
    wing.add(fH.pivot, aH.pivot);
    surf.flap.push({ h: fH, side }); surf.ail.push({ h: aH, side });
    const nav = mesh(new THREE.SphereGeometry(0.05, 10, 8), side > 0 ? M.navGreen() : M.navRed(), { cast: false });
    nav.position.set(wTip.le[0] - 0.25, wTip.le[1], 10.08 * side);
    wing.add(nav);

    // pylons & stores
    const pylons = [];
    const stores = [];
    for (const [z, kind] of [[2.7, 'bomb'], [4.9, 'missile']]) {
      const py = mesh(new THREE.BoxGeometry(0.7, 0.28, 0.06), M.uavDark());
      py.position.set(0.15, 0.08, z * side);
      pylons.push(py);
      const g = kind === 'bomb' ? store(3.0, 0.17, 0.2, 4, 0.55) : store(1.65, 0.09, 0.14, 4, 0.25);
      const m = mesh(g, kind === 'bomb' ? M.munition() : M.missile());
      m.position.set(0.25, kind === 'bomb' ? -0.17 : -0.08, z * side);
      m.rotation.x = Math.PI / 4;
      stores.push(m);
    }
    P(side > 0 ? 'Starboard stores' : 'Port stores', {
      system: 'Weapons', material: 'Pylons with BRU-class ejector racks', mass: 400, explode: [0, -1.4, 0.6 * side],
      desc: 'Inboard: 230 kg-class laser/GPS guided bomb. Outboard: 50 kg-class laser-guided missile. 1,360 kg external payload in total.',
      callout: side > 0, anchor: [0.4, -0.45, 2.7 * side],
    }, [...pylons, ...stores]);
  }

  // ----------------------------------------------------------------- Y-tail
  const tRoot = { le: [-3.85, 0, 0.0], chord: 1.15, t: 0.11 };
  const tTip = { le: [-3.85 - 2.3 * Math.tan(0.42), 0, 2.3], chord: 0.6, t: 0.09 };
  const tail = new THREE.Group();
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(0, 0.28, 0.15 * side);
    g.rotation.x = -0.72 * side;
    const fixed = wingPanel({ root: tRoot, tip: tTip, c0: 0, c1: 0.68, stations: 3 });
    const rv = wingPanel({ root: tRoot, tip: tTip, c0: 0.68, c1: 1, eta0: 0.06, eta1: 0.94, stations: 2 });
    const fill = wingPanel({ root: tRoot, tip: tTip, c0: 0.68, c1: 1, eta0: 0, eta1: 0.06, stations: 1 });
    const fill2 = wingPanel({ root: tRoot, tip: tTip, c0: 0.68, c1: 1, eta0: 0.94, eta1: 1, stations: 1 });
    const flip = (geo) => (side > 0 ? geo : mirrorZ(geo));
    g.add(mesh(flip(fixed), M.uavGrey()), mesh(flip(fill), M.uavGrey()), mesh(flip(fill2), M.uavGrey()));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const h = hingedMesh(flip(rv), M.uavDark(), mz(wingPoint(tRoot, tTip, 0.06, 0.68)), mz(wingPoint(tRoot, tTip, 0.94, 0.68)));
    g.add(h.pivot);
    surf.rv.push({ h, side });
    tail.add(g);
  }
  const ventral = new THREE.Group();
  ventral.position.set(0, -0.15, 0);
  ventral.rotation.x = Math.PI / 2;
  ventral.add(mesh(wingPanel({ root: { le: [-3.9, 0, 0], chord: 1.05, t: 0.1 }, tip: { le: [-4.4, 0, 1.15], chord: 0.55, t: 0.08 }, stations: 2 }), M.uavGrey()));
  tail.add(ventral);
  P('Y-tail & ruddervators', {
    system: 'Flight controls', material: 'Carbon composite', mass: 70, explode: [-1.6, 0.6, 0],
    desc: 'Two 45° ruddervators mix pitch and yaw; the ventral fin protects the propeller on rotation and adds directional stability.',
    callout: true, anchor: [-4.6, 1.6, 1.4],
  }, tail);

  // ----------------------------------------------------------------- powerplant
  const propSpin = new THREE.Group();
  propSpin.position.set(X(11.08), 0.05, 0);
  const blades = [];
  for (let k = 0; k < 3; k++) {
    const b = wingPanel({ root: { le: [0.13, 0, 0.16], chord: 0.26, t: 0.13 }, tip: { le: [0.06, 0, 1.3], chord: 0.11, t: 0.07 }, stations: 6, twist: -24, camber: 0.04 });
    b.rotateZ(Math.PI / 2 - 0.75);      // blade chord mostly tangential at ~43° root pitch
    b.rotateX((k / 3) * Math.PI * 2);
    blades.push(b.toNonIndexed());
  }
  const bladeMesh = mesh(mergeGeometries(blades), new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.55, metalness: 0.3 }));
  bladeMesh.geometry.computeVertexNormals();
  const tipPaint = mesh(new THREE.TorusGeometry(1.24, 0.012, 4, 64), new THREE.MeshBasicMaterial({ color: 0xffc640, transparent: true, opacity: 0.0 }));
  tipPaint.rotation.y = Math.PI / 2;
  tipPaint.userData.fx = true;
  const spinner = mesh(lathe(ogiveProfile(0.17, 0.42, 0, 10), 24), M.uavDark());
  spinner.rotation.z = Math.PI / 2;
  propSpin.add(bladeMesh, spinner, tipPaint);
  const intake = mesh(new THREE.BoxGeometry(0.7, 0.12, 0.32), M.intake());
  intake.position.set(X(7.3), 0.47, 0);
  const exhausts = [1, -1].map((s) => {
    const e = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 12, 1, true), M.darkMetal());
    e.rotation.x = Math.PI / 2;
    e.position.set(X(9.8), 0.1, 0.27 * s);
    return e;
  });
  const prop = P('Turboprop & propeller', {
    system: 'Propulsion', material: '670 kW turboprop, carbon propeller blades', mass: 210, explode: [-2.0, 0, 0],
    desc: 'Pusher layout keeps the sensor view clean. Propeller efficiency ≈ 80 %; fuel burn ≈ 0.33 kg per kW·h.',
    callout: true, anchor: [X(11.0), 0.9, 0],
  }, [propSpin, intake, ...exhausts]);
  prop.userData.part.thermalRole = 'engine';

  // ----------------------------------------------------------------- EO/IR turret
  const turret = new THREE.Group();
  turret.position.set(X(1.65), -0.43, 0);
  const az = new THREE.Group();
  turret.add(az);
  az.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 24), M.uavDark()));
  const el = new THREE.Group();
  el.position.y = -0.3;
  az.add(el);
  const ball = mesh(new THREE.SphereGeometry(0.27, 32, 20), new THREE.MeshStandardMaterial({ color: 0x3c4146, roughness: 0.4, metalness: 0.4 }));
  el.add(ball);
  for (const [y, z, r] of [[0.06, 0.08, 0.075], [-0.05, -0.07, 0.06], [0.08, -0.1, 0.04]]) {
    const w = mesh(new THREE.CircleGeometry(r, 20), M.glass(), { cast: false });
    w.position.set(0.268, y, z);
    w.rotation.y = Math.PI / 2;
    el.add(w);
  }
  const laser = mesh(new THREE.CircleGeometry(0.025, 12), M.laser(), { cast: false });
  laser.position.set(0.272, -0.1, 0.06);
  laser.rotation.y = Math.PI / 2;
  el.add(laser);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.02, 30, 6, 1, true).translate(0, 15, 0).rotateZ(-Math.PI / 2), beamMat);
  beamMesh.position.copy(laser.position);
  beamMesh.userData.fx = true;
  el.add(beamMesh);
  P('EO/IR sensor turret', {
    system: 'Sensors', material: 'Stabilised gimbal, germanium & sapphire windows', mass: 110, explode: [0.6, -1.4, 0],
    desc: 'Day TV, mid-wave infrared and a laser designator/rangefinder on a gyro-stabilised gimbal that holds a target steady from 7 km slant range.',
    callout: true, anchor: [X(1.65), -0.85, 0.25],
  }, turret);

  // ----------------------------------------------------------------- gear & lights
  const gear = [];
  const nose = new THREE.Group();
  nose.position.set(X(2.6), -0.4, 0);
  nose.add(mesh(rod([0, 0, 0], [0, -0.66, 0], 0.04), M.aluminium()));
  const nw = mesh(new THREE.TorusGeometry(0.14, 0.06, 10, 20), M.rubber());
  nw.position.y = -0.68;
  nose.add(nw);
  gear.push(nose);
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(-0.2, 0.15, 0.55 * s);
    g.add(mesh(rod([0, 0, 0], [-0.1, -1.18, 0.95 * s], 0.05), M.aluminium()));
    const w = mesh(new THREE.TorusGeometry(0.17, 0.08, 10, 20), M.rubber());
    w.position.set(-0.1, -1.18, 0.98 * s);
    g.add(w);
    gear.push(g);
  }
  const strobe = mesh(new THREE.SphereGeometry(0.05, 10, 8), M.strobe().clone(), { cast: false });
  strobe.position.set(X(7.5), 0.52, 0);
  P('Landing gear & lighting', {
    system: 'Utilities', material: 'Steel / aluminium', mass: 95, explode: [0, -1.0, 0],
    desc: 'Tricycle gear for conventional runway take-off; anti-collision strobe and nav lights for shared airspace.',
  }, [...gear, strobe]);

  A.finalize();

  const state = { airborne: 0, airTarget: 0, throttle: 0.55, turretAz: 0, laser: false, roll: 0, pitch: 0, strobeT: 0, propA: 0 };
  return {
    id: 'uav',
    designation: 'MQ-X',
    name: 'KESTREL',
    role: 'MALE remotely piloted aircraft',
    tagline: 'Medium altitude · long endurance · satellite-linked',
    summary: 'A 4.8-tonne persistent-surveillance aircraft built for loiter, not speed. The long thick wing and slow pusher turboprop trade dash performance for more than a day on station, with a stabilised EO/IR turret watching the ground the whole time.',
    specs: [
      ['Length', '11.0 m'], ['Wingspan', '20.1 m'], ['Aspect ratio', '16.8'], ['MTOW', '4,760 kg'],
      ['Fuel', '1,800 kg'], ['External stores', '1,360 kg'], ['Ceiling', '15,200 m'], ['Endurance', '27 h (clean)'],
    ],
    fleetTag: '27 h loiter',
    root: A.root,
    parts: A.parts,
    view: { dir: [0.9, 0.55, 1.3], fill: 0.95 },
    displaySize: 11.5,
    thermalRange: [200, 900],
    state,
    setAirborne(v) { state.airTarget = v ? 1 : 0; },
    setLaser(v) { state.laser = v; },
    temperatureOf(info) {
      if (info.thermalRole === 'engine') return 450 + state.throttle * 350;
      const amb = 288 - 0.0065 * 7600 * state.airborne;
      if (info.system === 'Sensors') return amb + 12;
      return amb;
    },
    update(dt, t) {
      state.airborne += Math.sign(state.airTarget - state.airborne) * Math.min(Math.abs(state.airTarget - state.airborne), dt * 0.5);
      const a = state.airborne;
      state.propA += dt * (4 + state.throttle * 30);
      propSpin.rotation.x = state.propA;
      tipPaint.material.opacity = Math.min(0.5, state.throttle * 0.6);
      state.turretAz = Math.sin(t * 0.25) * 1.2;
      az.rotation.y = state.turretAz;
      el.rotation.z = -0.35 - Math.sin(t * 0.17) * 0.25 - a * 0.5;
      beamMat.opacity = state.laser ? 0.55 + Math.sin(t * 30) * 0.1 : 0;
      laser.material.emissiveIntensity = state.laser ? 6 : 1.5;
      const deg = Math.PI / 180;
      for (const { h } of surf.ail) h.setAngle(-state.roll * 18 * deg);
      for (const { h, side } of surf.flap) h.setAngle(((1 - a) * 12 * side) * deg);
      for (const { h, side } of surf.rv) h.setAngle(-state.pitch * 15 * side * deg);
      for (const g of gear) g.visible = a < 0.98;
      for (const g of gear) g.scale.y = 1 - a * 0.95;
      state.strobeT += dt;
      strobe.material.emissiveIntensity = (state.strobeT % 1.5) < 0.07 ? 8 : 0;
      air.position.y = a * 2.2 + Math.sin(t * 0.7) * 0.06 * a;
      air.rotation.x = a * Math.sin(t * 0.21) * 0.06 + state.roll * 0.3 * a;
      air.rotation.z = a * 0.04;
    },
  };
}
