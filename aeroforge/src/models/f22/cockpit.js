// F-22A cockpit: one-piece frameless canopy with its sill frame and actuator, the cockpit tub,
// ACES II ejection seat, pilot, side-stick and throttles (HOTAS), HUD with the up-front controls,
// and the six colour multifunction displays.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge } from './util.js';

const { X } = FR;


/**
 * The transparency as a smooth parametric surface: an elliptical cross-section from sill to sill
 * at every station, with dense, evenly spaced segments and normals taken from the analytic
 * surface so highlights travel across it continuously.
 */
function canopyGeometry(nu = 84, nv = 56) {
  const s0 = FR.CANOPY_S0, s1 = FR.CANOPY_S1;
  const pt = (u, v) => {
    // cosine spacing along the length rounds the ends without crowding the middle
    const s = s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    const a = FR.sillW(s);
    const ys = FR.upperA(s, a) - 0.018;
    const yt = FR.canopyTop(s);
    const phi = Math.PI * (v - 0.5);
    return [X(s), ys + (yt - ys) * Math.cos(phi), a * Math.sin(phi)];
  };
  const pos = [], nrm = [], uv = [], idx = [];
  const e = 1e-3;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv;
      const p = pt(u, v);
      pos.push(...p);
      uv.push(u, v);
      // analytic normal from central differences (clamped at the ends, where the surface pinches)
      const uu = Math.min(1 - e, Math.max(e, u));
      const pu0 = pt(uu - e, v), pu1 = pt(uu + e, v), pv0 = pt(uu, Math.max(0, v - e)), pv1 = pt(uu, Math.min(1, v + e));
      const du = new THREE.Vector3(pu1[0] - pu0[0], pu1[1] - pu0[1], pu1[2] - pu0[2]);
      const dv = new THREE.Vector3(pv1[0] - pv0[0], pv1[1] - pv0[1], pv1[2] - pv0[2]);
      const n = du.cross(dv).normalize();
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // make the winding agree with the outward normals (checked on a quad mid-canopy)
  const k0 = (((nu >> 1) * nv) + (nv >> 1)) * 6;
  const P0 = new THREE.Vector3(...pos.slice(idx[k0] * 3, idx[k0] * 3 + 3));
  const P1 = new THREE.Vector3(...pos.slice(idx[k0 + 1] * 3, idx[k0 + 1] * 3 + 3));
  const P2 = new THREE.Vector3(...pos.slice(idx[k0 + 2] * 3, idx[k0 + 2] * 3 + 3));
  const fn = P1.sub(P0).cross(P2.sub(P0));
  const n0 = new THREE.Vector3(...nrm.slice(idx[k0] * 3, idx[k0] * 3 + 3));
  if (fn.dot(n0) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); }
  return g;
}

const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);

export function buildCockpit(ctx) {
  const { P } = ctx;

  // ------------------------------------------------------------------ canopy
  const can = mesh(canopyGeometry(), F.canopy(), { cast: false, receive: false });
  can.renderOrder = 2;
  P('Canopy', {
    system: 'Crew systems', skin: true, material: 'Monolithic polycarbonate (two 3/8 in sheets fusion-bonded), gold indium-tin-oxide coating', mass: 163,
    explode: [0, 2.2, 0], callout: true, anchor: [X(5.4), 1.3, 0],
    desc: 'A single frameless bubble about 3.6 m long, among the largest monolithic polycarbonate parts ever formed (about 360 lb). Its thin gold indium-tin-oxide film conducts, so radar energy reflects off the canopy instead of entering the cockpit and bouncing off the pilot\'s helmet.',
  }, can);
  {
    const g = [];
    for (const side of [1, -1]) {
      const pts = [];
      for (let s = FR.CANOPY_S0 + 0.06; s <= FR.CANOPY_S1 - 0.04; s += 0.12) pts.push([s, FR.upperA(s, FR.sillW(s)) - 0.005, side * (FR.sillW(s) + 0.012)]);
      g.push(FR.pipe(pts, 0.022, 6, 60));
    }
    // aft hinge and the electro-mechanical actuator behind the seat
    g.push(FR.pipe([[6.62, 0.2, 0], [6.8, 0.58, 0]], 0.035, 8, 4));
    g.push(box(6.86, 0.6, 0, 0.12, 0.05, 0.26));
    P('Canopy frame & actuator', {
      system: 'Crew systems', material: 'Titanium sill frame, electro-mechanical actuator', mass: 60,
      explode: [0, 1.65, 0],
      desc: 'The transparency is bonded into a low sill frame with no bow frame across the pilot\'s view. The canopy hinges at the back and is raised by an actuator behind the seat; for ejection the frame is jettisoned by rocket motors.',
    }, mesh(merge(g), F.canopyFrame()));
  }

  // ------------------------------------------------------------------ cockpit tub
  {
    const g = [];
    g.push(box(5.3, -0.06, 0, 3.2, 0.04, 0.9));                                     // floor
    for (const side of [1, -1]) {
      g.push(box(5.55, 0.15, side * 0.43, 1.9, 0.36, 0.18));                         // side consoles
      g.push(box(5.35, 0.12, side * 0.5, 2.4, 0.36, 0.03));                          // tub walls (below the sills)
    }
    // instrument panel (tilted back) and glare shield
    const panel = new THREE.BoxGeometry(0.06, 0.46, 0.62).rotateZ(-0.22).translate(X(4.05), 0.2, 0);
    g.push(panel);
    g.push(box(4.0, 0.42, 0, 0.3, 0.04, 0.56));
    // rudder pedals
    for (const side of [1, -1]) g.push(new THREE.BoxGeometry(0.05, 0.22, 0.1).rotateZ(0.4).translate(X(4.3), 0.04, side * 0.16));
    P('Cockpit tub & consoles', {
      system: 'Crew systems', material: 'Aluminium tub, composite consoles', mass: 140,
      explode: [0, 1.0, 0],
      desc: 'The pressurised single-seat cockpit: floor, rudder pedals, side consoles and the instrument panel under a glare shield. Cockpit pressure and conditioned air come from the environmental control system.',
    }, mesh(merge(g), F.panel()));
  }

  // ------------------------------------------------------------------ ACES II ejection seat
  {
    const g = [], y = [];
    const back = new THREE.BoxGeometry(0.12, 0.95, 0.5).rotateZ(0.3).translate(X(6.12), 0.52, 0);
    g.push(back);
    g.push(box(5.88, 0.06, 0, 0.5, 0.16, 0.52));                                    // bucket
    g.push(new THREE.BoxGeometry(0.2, 0.22, 0.34).rotateZ(0.3).translate(X(6.3), 1.0, 0));   // headrest / parachute
    for (const side of [1, -1]) g.push(new THREE.BoxGeometry(0.08, 0.9, 0.05).rotateZ(0.3).translate(X(6.2), 0.5, side * 0.27));  // rails
    g.push(FR.cylX(6.32, 0.18, 0, 0.28, 0.05, 0.05, 10));                            // catapult / rocket
    y.push(FR.pipe([[5.62, 0.12, -0.12], [5.56, 0.22, 0], [5.62, 0.12, 0.12]], 0.018, 6, 10));   // ejection handle
    y.push(box(5.66, 0.16, 0, 0.12, 0.03, 0.4));
    const cush = [box(5.9, 0.17, 0, 0.42, 0.06, 0.42), new THREE.BoxGeometry(0.06, 0.6, 0.4).rotateZ(0.3).translate(X(6.04), 0.52, 0)];
    P('ACES II ejection seat', {
      system: 'Crew systems', material: 'Aluminium structure, rocket catapult, parachute', mass: 75,
      explode: [0, 2.3, 0], callout: true, anchor: [X(6.25), 1.08, 0.2],
      desc: 'A zero-zero seat: it can save the pilot even at zero height and zero airspeed. Pulling the handle fires a catapult and an under-seat rocket; the seat selects its parachute-deployment mode from airspeed and altitude.',
    }, [mesh(merge(g), F.seat()), mesh(merge(y), F.yellow()), mesh(merge(cush), F.cushion())]);
  }

  // ------------------------------------------------------------------ pilot
  {
    const s = [], hm = [];
    s.push(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12).rotateZ(0.32).translate(X(5.92), 0.5, 0));  // torso
    for (const side of [1, -1]) {
      s.push(FR.pipe([[5.85, 0.22, side * 0.12], [5.35, 0.3, side * 0.13], [4.95, 0.12, side * 0.14], [4.4, 0.06, side * 0.16]], 0.065, 8, 16));  // legs
      s.push(FR.pipe([[5.95, 0.72, side * 0.2], [5.75, 0.45, side * 0.27], [5.45, 0.4, side * 0.36]], 0.045, 8, 12));    // arms
    }
    hm.push(new THREE.SphereGeometry(0.15, 20, 14).translate(X(5.88), 0.99, 0));
    const visor = new THREE.SphereGeometry(0.152, 18, 10, -Math.PI / 2 - 0.9, 1.8, Math.PI * 0.32, Math.PI * 0.3).rotateY(Math.PI).translate(X(5.88), 0.99, 0);
    const mask = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 10).rotateZ(Math.PI / 2).translate(X(5.74), 0.92, 0);
    P('Pilot', {
      system: 'Crew systems', material: 'Pressure-breathing / anti-g ensemble, helmet', mass: 100,
      explode: [0, 2.85, 0],
      desc: 'One pilot flies the whole mission. An anti-g suit and pressure breathing help hold consciousness at the airframe\'s +9 g limit; oxygen comes from the on-board oxygen generating system.',
    }, [mesh(merge(s), F.suit()), mesh(merge(hm), F.helmet()), mesh(visor, F.visor()), mesh(mask, F.black())]);
  }

  // ------------------------------------------------------------------ HOTAS: side-stick and throttles
  {
    const g = [new THREE.CylinderGeometry(0.018, 0.022, 0.16, 10).translate(X(5.32), 0.4, 0.4), box(5.32, 0.49, 0.4, 0.06, 0.05, 0.05)];
    P('Side-stick controller', {
      system: 'Crew systems', material: 'Force-sensing grip', mass: 3,
      explode: [0, 1.5, 0.4],
      desc: 'A right-hand side-stick that barely moves: it senses the pilot\'s force and sends commands to the flight-control computers, with buttons for weapons and sensors under the fingers (hands on throttle and stick, HOTAS).',
    }, mesh(merge(g), F.black()));
    const t = [];
    for (const dz of [-0.035, 0.035]) t.push(new THREE.BoxGeometry(0.06, 0.12, 0.05).rotateZ(-0.3).translate(X(5.45), 0.4, -0.4 + dz));
    t.push(box(5.45, 0.34, -0.4, 0.3, 0.02, 0.14));
    P('Throttles', {
      system: 'Crew systems', material: 'Twin throttle grips', mass: 4,
      explode: [0, 1.5, -0.4],
      desc: 'Two throttles on the left console, one per F119. Pushing past the military-power detent lights the afterburners.',
    }, mesh(merge(t), F.black()));
  }

  // ------------------------------------------------------------------ HUD, up-front controls and displays
  {
    const body = [box(4.08, 0.48, 0, 0.2, 0.08, 0.24)];
    const comb = new THREE.BoxGeometry(0.01, 0.18, 0.2).rotateZ(0.55).translate(X(4.16), 0.62, 0);
    const icp = [box(4.0, 0.34, 0, 0.06, 0.1, 0.24)];
    const ufd = [];
    for (const side of [1, -1]) ufd.push(new THREE.BoxGeometry(0.02, 0.09, 0.12).rotateZ(-0.22).translate(X(4.02), 0.34, side * 0.2));
    P('HUD & up-front controls', {
      system: 'Crew systems', material: 'Holographic combiner, integrated control panel, two up-front displays', mass: 22,
      explode: [0.6, 1.4, 0],
      desc: 'The head-up display projects flight and targeting symbols focused at infinity on a glass combiner. Below it sit the integrated control panel for data entry and two small up-front displays for communication, navigation and warnings.',
    }, [mesh(merge([...body, ...icp]), F.panel()), mesh(comb, F.hud(), { cast: false }), mesh(merge(ufd), F.displayAmber())]);
    const scr = [];
    const at = (y, z, w, h) => new THREE.BoxGeometry(0.02, h, w).rotateZ(-0.22).translate(X(4.02) + (y - 0.2) * 0.22, y, z);
    scr.push(at(0.17, 0, 0.2, 0.2));                       // primary MFD, 8 × 8 in
    for (const side of [1, -1]) scr.push(at(0.19, side * 0.22, 0.16, 0.16));    // secondary MFDs, 6.25 × 6.25 in
    scr.push(at(-0.01, 0, 0.16, 0.16));
    P('Multifunction displays', {
      system: 'Crew systems', material: 'Colour active-matrix LCDs', mass: 26,
      explode: [0.9, 1.25, 0],
      desc: 'A large 8 × 8 in primary display shows the fused tactical picture from all sensors, with three 6.25 × 6.25 in secondary displays around it. Sensor fusion means the pilot sees tracks, not raw radar returns.',
    }, mesh(merge(scr), F.display()));
  }
}
