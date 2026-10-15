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
 * The transparency as a smooth parametric surface: a parabolic cross-section from sill to sill
 * at every station, with dense, evenly spaced segments and normals taken from the analytic
 * surface so highlights travel across it continuously.
 */
// fraction of the canopy length (cosine parameter) over which the normals at each pinched tip ease
// into the fuselage's own: ≈ 0.7 m at each end, which keeps the turn between neighbouring rows
// under about 7° everywhere (≈ 4° over the body of the bubble)
const TIP_BLEND = 0.3;
function canopyGeometry(nu = 84, nv = 56) {
  const s0 = FR.CANOPY_S0, s1 = FR.CANOPY_S1;
  const pt = (u, v) => {
    // cosine spacing along the length rounds the ends without crowding the middle
    const s = s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    const a = FR.sillW(s);
    const ys = FR.upperA(s, a) - 0.018;
    const yt = FR.canopyTop(s);
    // the cross-section is a parabola from sill to sill (NAWDC front view: half-width 0.50 at a fifth of the depth below
    // the crown... 0.40 at half depth), parametrised so the spacing tightens toward the crown
    const w = Math.sin(Math.PI * (v - 0.5) * 0.9) / Math.sin(Math.PI * 0.45);
    return [X(s), ys + (yt - ys) * (1 - w * w), a * w];
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
      // outward: away from the sill midline below the point
      const sC = s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(Math.PI * uu));
      const out = new THREE.Vector3(0, p[1] - (FR.upperA(sC, FR.sillW(sC)) - 0.05), p[2]);
      if (n.dot(out) < 0) n.negate();
      // toward the two pinched tips the bubble melts into the fuselage: blend toward the skin's own
      // normal there, so neighbouring vertices never turn sharply and highlights fade out smoothly
      const w = FR.smooth(0, TIP_BLEND, u) * FR.smooth(0, TIP_BLEND, 1 - u);
      if (w < 1) {
        const sTip = s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(Math.PI * u));
        const zz = p[2], e2 = 0.01;
        const dydz = (FR.upperA(sTip, Math.abs(zz) + e2) - FR.upperA(sTip, Math.max(0, Math.abs(zz) - e2))) / (2 * e2);
        const dyds = (FR.upperA(sTip + e2, Math.abs(zz)) - FR.upperA(sTip - e2, Math.abs(zz))) / (2 * e2);
        const nf = new THREE.Vector3(dyds, 1, -dydz * Math.sign(zz || 1)).normalize();
        n.lerp(nf, 1 - w).normalize();
      }
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

// cockpit layout. The contents below were laid out on the pre-2025 stations and are carried as one rigid block,
// COCKPIT_SHIFT (−1.46 m in station, +0.10 m up), to the measured cockpit under the canopy (2.55 → 5.40, apex 4.2):
// in block coordinates the forward pressure bulkhead and instrument panel sit at s 4.45–4.9, the HUD combiner at
// s 4.98 (≈ 0.6 m ahead of the pilot's eye) and the design eye near s 5.56 — on the aircraft s 2.99–3.44, 3.52 and
// 4.10, under the canopy apex
const PANEL_S = 4.86, PANEL_TILT = -0.22;
const SEAT_S = 5.7;
const EYE = [5.56, 0.95];

/** A box on the instrument-panel face: (y, z) on the panel, size w × h, standing off by d. */
function onPanel(y, z, w, h, d = 0.035, depth = 0.02) {
  const g = new THREE.BoxGeometry(depth, h, w);
  g.rotateZ(PANEL_TILT);
  // the panel face leans back: its aft face moves aft as y rises
  const x = X(PANEL_S) - d + (y - 0.35) * Math.tan(-PANEL_TILT);
  return g.translate(x, y, z);
}

export const COCKPIT_SHIFT = { ds: -1.46, dy: 0.10 };

export function buildCockpit(ctx) {
  const P0 = ctx.P;
  let P = P0;
  const blk = new THREE.Group();
  blk.position.set(-COCKPIT_SHIFT.ds, COCKPIT_SHIFT.dy, 0);
  ctx.attitude.add(blk);

  // ------------------------------------------------------------------ canopy
  const can = mesh(canopyGeometry(), F.canopy(), { cast: false, receive: false });
  can.renderOrder = 2;
  P('Canopy', {
    system: 'Crew systems', skin: true, material: 'Monolithic polycarbonate (two 3/8 in sheets fusion-bonded), gold indium-tin-oxide coating', mass: 163,
    explode: [0, 4.2, 0], callout: true, anchor: [X(4.2), FR.canopyTop(4.2) + 0.005, 0],
    desc: 'A single frameless bubble, among the largest monolithic polycarbonate parts ever formed: Lockheed Martin gives about 140 × 45 × 27 in and 360 lb. On the jet it spans about 2.85 m from its tip to its aft end, 1.14 m wide and 0.7 m deep. Its thin gold indium-tin-oxide film conducts, so radar energy reflects off the canopy instead of entering the cockpit and bouncing off the pilot\'s helmet.',
  }, can);
  {
    const g = [];
    for (const side of [1, -1]) {
      const pts = [];
      for (let s = FR.CANOPY_S0 + 0.06; s <= FR.CANOPY_S1 - 0.04; s += 0.12) pts.push([s, FR.upperA(s, FR.sillW(s)) - 0.005, side * (FR.sillW(s) + 0.012)]);
      g.push(FR.pipe(pts, 0.022, 6, 60));
      // inflatable seal along the inside of the sill
      const seal = [];
      for (let s = FR.HOLE_S0 + 0.05; s <= FR.HOLE_S1 - 0.05; s += 0.15) seal.push([s, FR.upperA(s, FR.sillW(s)) - 0.03, side * (FR.sillW(s) - 0.03)]);
      g.push(FR.pipe(seal, 0.012, 5, 40));
    }
    P('Canopy sill frame & seals', {
      system: 'Crew systems', material: 'Titanium sill frame, inflatable pressure seal', mass: 45,
      explode: [0, 3.4, 0],
      desc: 'The transparency is bonded into a low sill frame with no bow frame across the pilot\'s view. When the canopy locks, a seal inflates against the sill to hold cockpit pressure; for ejection the whole canopy and frame are jettisoned by rocket motors.',
    }, mesh(merge(g), F.canopyFrame()));
    P = (n, i, o) => P0(n, i, o, blk);       // from here on: the cockpit block
    const a = [];
    a.push(FR.pipe([[6.62, 0.2, 0], [6.8, 0.58, 0]], 0.035, 8, 4));
    a.push(box(6.86, 0.6, 0, 0.12, 0.05, 0.26));
    for (const side of [1, -1]) a.push(FR.cylX(6.9, 0.56, side * 0.12, 0.08, 0.025, 0.025, 10));
    for (const side of [1, -1]) a.push(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10).rotateZ(Math.PI / 2 - 0.5).translate(X(6.75), 0.45, side * 0.32));
    P('Canopy actuator & jettison rockets', {
      system: 'Crew systems', material: 'Electro-mechanical actuator, aft hinge, solid-propellant jettison motors', mass: 15,
      explode: [0, 2.7, 0],
      desc: 'The canopy hinges at the back and an actuator behind the seat raises it for entry. In an ejection, small rocket motors throw the canopy clear a fraction of a second before the seat fires.',
    }, mesh(merge(a), F.canopyFrame()));
  }

  // ------------------------------------------------------------------ cockpit tub, consoles, panel, pedals
  {
    const g = [];
    g.push(box(5.67, -0.05, 0, 2.44, 0.04, 0.9));                                     // floor, s 4.45–6.9
    for (const side of [1, -1]) g.push(box(5.66, 0.17, side * 0.47, 2.3, 0.44, 0.03));   // tub side walls below the sills
    g.push(box(6.88, 0.2, 0, 0.03, 0.5, 0.9));                                         // aft wall
    P('Cockpit tub & floor', {
      system: 'Crew systems', material: 'Aluminium pressure tub', mass: 85,
      explode: [0, 0.85, 0],
      desc: 'The pressurised single-seat cockpit between the forward and aft pressure bulkheads, with the nose-gear well under its floor; pressure and conditioned air come from the environmental control system.',
    }, mesh(merge(g), F.panel()));
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const c = [box(5.62, 0.12, side * 0.4, 1.2, 0.34, 0.15)];
      const sw = [];
      for (const [s0, l] of [[5.25, 0.22], [5.55, 0.26], [5.88, 0.3]]) sw.push(box(s0, 0.296, side * 0.4, l, 0.012, 0.12));
      P(`${side > 0 ? 'Right' : 'Left'} console`, {
        system: 'Crew systems', material: 'Composite console, edge-lit control panels', mass: 18,
        explode: [0, 1.15, 0.75 * side],
        desc: side > 0
          ? 'Right-hand console: the side-stick at its forward end, with panels behind it for lights, oxygen and environmental controls (panel layout simplified).'
          : 'Left-hand console: the throttles at its forward end, with panels for engine start, fuel, the landing gear and the canopy (panel layout simplified).',
      }, [mesh(merge(c), F.panel()), mesh(merge(sw), F.boxLight())]);
      void R;
    }
    const pn = [];
    pn.push(new THREE.BoxGeometry(0.06, 0.42, 0.66).rotateZ(PANEL_TILT).translate(X(PANEL_S), 0.35, 0));   // main panel, y 0.14–0.56
    pn.push(onPanel(0.06, 0, 0.19, 0.2, 0, 0.06));                                                     // centre pedestal between the knees
    pn.push(box(4.72, 0.555, 0, 0.36, 0.03, 0.62));                                                    // glare shield
    P('Instrument panel & glare shield', {
      system: 'Crew systems', material: 'Machined aluminium panel, anti-glare coaming', mass: 30,
      explode: [0.6, 1.2, 0],
      desc: 'Carries the four multifunction displays and the integrated control panel. There are no round dials: the two up-front displays double as the standby flight instruments and fuel gauge.',
    }, mesh(merge(pn), F.panel()));
    const pd = [];
    for (const side of [1, -1]) {
      pd.push(new THREE.BoxGeometry(0.04, 0.22, 0.1).rotateZ(0.35).translate(X(4.78), 0.1, side * 0.17));
      pd.push(FR.cylX(4.7, 0.04, side * 0.17, 0.14, 0.012, 0.012, 6));
    }
    P('Rudder pedals', {
      system: 'Crew systems', material: 'Aluminium pedals on adjustable rails, toe brakes', mass: 6,
      explode: [0.9, 0.65, 0],
      desc: 'Yaw and toe-brake inputs go to the vehicle-management computers as electrical signals; the pedals adjust fore and aft to the pilot\'s leg length.',
    }, mesh(merge(pd), F.boxLight()));
  }

  // ------------------------------------------------------------------ ACES II ejection seat, by component
  {
    const S = SEAT_S;
    const tilt = 0.3;                                      // seat back leans 17° aft
    const along = (d, y0 = 0.06) => [X(S + 0.24) - Math.sin(tilt) * d, y0 + Math.cos(tilt) * d];   // point d up the seat back
    const g = [];
    g.push(new THREE.BoxGeometry(0.1, 0.95, 0.46).rotateZ(tilt).translate(X(S + 0.24), 0.52, 0));                // back
    for (const side of [1, -1]) g.push(box(S, 0.08, side * 0.245, 0.5, 0.2, 0.03));                                // seat-pan side frames
    const cush = [box(S + 0.02, 0.17, 0, 0.42, 0.06, 0.42), new THREE.BoxGeometry(0.06, 0.6, 0.4).rotateZ(tilt).translate(X(S + 0.16), 0.52, 0)];
    P('ACES II ejection seat', {
      system: 'Crew systems', material: 'Aluminium seat structure, cushions, harness', mass: 45,
      explode: [0, 2.0, 0], callout: true, anchor: [X(S + 0.32), 0.42, 0.28],
      desc: 'A third-generation zero-zero seat: it can save the pilot at zero height and zero airspeed. Pulling the centre handle between the pilot\'s legs starts the sequence — canopy jettison, catapult, rocket, then the parachute. The F-22 kept the existing ACES II after a new seat was dropped during development to save weight and cost.',
    }, [mesh(merge(g), F.seat()), mesh(merge(cush), F.cushion())]);
    const r = [];
    for (const side of [1, -1]) r.push(new THREE.BoxGeometry(0.06, 1.0, 0.045).rotateZ(tilt).translate(X(S + 0.33), 0.5, side * 0.255));
    P('Seat guide rails', {
      system: 'Crew systems', material: 'Steel guide rails on the aft cockpit structure, roller slippers on the seat', mass: 12,
      explode: [0, 2.0, 0.55],
      desc: 'Two rails fixed to the cockpit structure guide the seat straight up and out during the catapult stroke, so it leaves along a set line clear of the canopy sill.',
    }, mesh(merge(r), F.steel()));
    const [hx, hy] = along(0.86);
    const hb = [new THREE.BoxGeometry(0.2, 0.22, 0.36).rotateZ(tilt).translate(hx, hy, 0), new THREE.BoxGeometry(0.04, 0.16, 0.3).rotateZ(tilt).translate(hx - 0.1, hy, 0)];
    P('Seat headbox (drogue & main parachute)', {
      system: 'Crew systems', material: 'Headbox with drogue chute, main canopy and deployment mortar', mass: 14,
      explode: [0, 2.45, 0],
      desc: 'Behind the pilot\'s head: a drogue chute that steadies the seat at high speed, and the main parachute, deployed by a mortar once the seat has slowed. Which one opens when depends on the mode the sequencer picks.',
    }, mesh(merge(hb), F.cushion()));
    P('Seat survival kit', {
      system: 'Crew systems', material: 'Rigid seat-pan container: survival radio, water, first aid, life raft', mass: 15,
      explode: [0.3, 1.55, 0],
      desc: 'The seat pan is a survival kit the pilot sits on; after ejection it hangs below on a lanyard and carries a radio, water, medical supplies and a life raft for a water landing.',
    }, mesh(box(S, 0.07, 0, 0.44, 0.13, 0.44), F.yellow()));
    const [cx, cy] = along(0.36);
    const cat = [new THREE.CylinderGeometry(0.04, 0.045, 0.8, 14).rotateZ(tilt).translate(cx - 0.08, cy + 0.06, 0)];
    cat.push(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 16).rotateX(Math.PI / 2).translate(X(S + 0.3), 0.04, 0));   // under-seat rocket motor
    cat.push(new THREE.CylinderGeometry(0.03, 0.02, 0.06, 12).rotateZ(Math.PI / 2 - 0.6).translate(X(S + 0.28), -0.0, 0));   // nozzle
    P('Seat catapult & under-seat rocket', {
      system: 'Crew systems', material: 'Telescoping ballistic catapult, solid-propellant rocket motor', mass: 14,
      explode: [-0.35, 1.75, 0],
      desc: 'A gas-driven catapult tube behind the seat back fires first and pushes the seat up its rails; as it leaves them, a rocket motor under the seat burns to carry the pilot high enough for the parachute to open, even from the runway.',
    }, mesh(merge(cat), F.gun()));
    const [qx, qy] = along(0.42);
    P('Seat recovery sequencer', {
      system: 'Crew systems', material: 'Redundant digital electronic sequencer with crash-data recorder', mass: 3,
      explode: [0, 1.9, -0.7],
      desc: 'A fully redundant digital sequencer senses airspeed and altitude, picks one of three recovery modes and fires each stage — drogue, main parachute, seat separation — at the right moment; it also keeps a crash-data record.',
    }, mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05).rotateZ(tilt).translate(qx + 0.02, qy, -0.245), F.box()));
    const y = [FR.pipe([[S - 0.26, 0.12, -0.08], [S - 0.31, 0.21, 0], [S - 0.26, 0.12, 0.08]], 0.016, 6, 10), box(S - 0.22, 0.13, 0, 0.1, 0.03, 0.2)];
    P('Ejection handle', {
      system: 'Crew systems', material: 'Yellow-and-black loop handle on the seat-pan front', mass: 1,
      explode: [0.75, 1.75, 0],
      desc: 'The F-22 has a single ejection handle on the front of the seat between the pilot\'s legs; one pull starts the whole sequence, and the canopy is blown clear before the seat moves.',
    }, mesh(merge(y), F.yellow()));
  }

  // ------------------------------------------------------------------ life support: BRAG valve, ABOS, oxygen line from the OBOGS
  {
    const S = SEAT_S;
    const v = [box(S + 0.12, 0.25, -0.31, 0.15, 0.1, 0.08)];
    const h = [FR.pipe([[S + 0.06, 0.26, -0.3], [S + 0.02, 0.45, -0.26], [S - 0.05, 0.7, -0.17], [S - 0.14, 0.88, -0.05]], 0.012, 6, 20)];   // to the mask
    h.push(FR.pipe([[S + 0.06, 0.22, -0.3], [S - 0.05, 0.2, -0.22], [S - 0.08, 0.26, -0.14]], 0.014, 6, 10));                             // anti-g / vest
    h.push(FR.pipe([[6.48, 0.1, -0.42], [6.2, 0.2, -0.4], [5.95, 0.25, -0.35], [5.89, 0.25, -0.32]], 0.01, 6, 12));                        // OBOGS → BRAG
    P('BRAG valve & oxygen hoses', {
      system: 'Crew systems', material: 'Breathing regulator / anti-g valve, mask hose, garment hoses', mass: 3,
      explode: [0, 1.25, -0.95],
      desc: 'The breathing regulator / anti-g (BRAG) valve meters oxygen and pressure to the pilot\'s mask, pressure vest and anti-g garments. In 2012 the US Air Force found a defective BRAG valve was over-inflating the vest at high g and restricting breathing; the valve and vest were changed.',
    }, [mesh(merge(v), F.boxLight()), mesh(merge(h), F.black())]);
    const ab = [new THREE.CylinderGeometry(0.05, 0.05, 0.28, 14).translate(X(6.35), 0.18, -0.4), new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8).translate(X(6.35), 0.345, -0.4)];
    const al = [FR.pipe([[6.35, 0.36, -0.4], [6.3, 0.38, -0.38], [6.15, 0.28, -0.37], [6.0, 0.25, -0.35]], 0.008, 5, 10)];
    P('Automatic backup oxygen system (ABOS)', {
      system: 'Crew systems', material: 'High-pressure oxygen bottle, automatic switching valve', mass: 4,
      explode: [-0.2, 1.4, -1.05],
      desc: 'Fitted from 2012 after a series of hypoxia incidents: if the OBOGS supply fails, it switches the pilot to bottled oxygen automatically, without the pilot having to find and pull a handle (position approximate).',
    }, [mesh(merge(ab), F.oxygen()), mesh(merge(al), F.pipe())]);
  }

  // ------------------------------------------------------------------ gear handle, canopy and jettison controls
  {
    // lower left of the main panel, under the left SMFD (whose bezel ends at panel y 0.2175)
    const ghY = 0.17, ghZ = -0.27, lean = (ghY - 0.28) * Math.tan(-PANEL_TILT);
    const gh = [onPanel(ghY, ghZ, 0.05, 0.06, 0.035, 0.03)];
    gh.push(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6).rotateZ(Math.PI / 2 + PANEL_TILT).translate(X(PANEL_S) - 0.09 + lean, ghY + 0.01, ghZ));
    gh.push(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 14).rotateZ(Math.PI / 2 + PANEL_TILT).translate(X(PANEL_S) - 0.14 + lean, ghY + 0.02, ghZ));   // wheel-shaped knob
    P('Landing-gear handle', {
      system: 'Crew systems', material: 'Wheel-shaped knob on a lever, red warning light in the grip', mass: 1,
      explode: [0.7, 1.05, -0.6],
      desc: 'On the left of the main panel, below the left display. Its wheel-shaped knob can be told apart by feel; weight-on-wheels interlocks stop it raising the gear while the jet is on the ground, and a light in the grip shows when the gear disagrees with the handle (position approximate).',
    }, mesh(merge(gh), F.wheel()));
    const cj = [box(5.92, 0.3, -0.4, 0.18, 0.02, 0.1)];
    cj.push(box(4.98, 0.2, -0.42, 0.04, 0.05, 0.02));
    cj.push(FR.pipe([[4.97, 0.2, -0.41], [4.92, 0.24, -0.4], [4.92, 0.29, -0.4], [4.97, 0.33, -0.41]], 0.008, 5, 8));
    P('Canopy & emergency jettison controls', {
      system: 'Crew systems', material: 'Canopy open / close switch, canopy jettison T-handle, stores-jettison button', mass: 1,
      explode: [0.4, 1.45, -0.85],
      desc: 'The canopy switch on the left console raises and lowers it for entry; the yellow canopy-jettison handle blows it off with the jettison motors for a ground egress, and an emergency button jettisons any external stores (positions approximate).',
    }, [mesh(merge([cj[0]]), F.boxLight()), mesh(merge(cj.slice(1)), F.yellow())]);
  }

  // ------------------------------------------------------------------ pilot
  {
    const S = SEAT_S, s = [], hm = [];
    s.push(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12).rotateZ(0.32).translate(X(S + 0.04), 0.5, 0));  // torso
    for (const side of [1, -1]) {
      // hip → knee → heel ≈ 0.45 + 0.45 m, heel on the floor near the pedals
      s.push(FR.pipe([[S - 0.02, 0.22, side * 0.12], [S - 0.25, 0.3, side * 0.13], [S - 0.48, 0.34, side * 0.15], [S - 0.68, 0.18, side * 0.165], [S - 0.84, 0.04, side * 0.17]], 0.065, 8, 16));  // legs
      s.push(FR.pipe([[S + 0.07, 0.72, side * 0.2], [S - 0.13, 0.45, side * 0.27], [S - 0.42, 0.4, side * 0.37]], 0.045, 8, 12));    // arms to stick / throttles
    }
    hm.push(new THREE.SphereGeometry(0.15, 20, 14).translate(X(S - 0.02), 0.99, 0));
    const visor = new THREE.SphereGeometry(0.152, 18, 10, -Math.PI / 2 - 0.9, 1.8, Math.PI * 0.32, Math.PI * 0.3).rotateY(Math.PI).translate(X(S - 0.02), 0.99, 0);
    const mask = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 10).rotateZ(Math.PI / 2).translate(X(S - 0.16), 0.92, 0);
    P('Pilot', {
      system: 'Crew systems', material: 'Pressure-breathing / anti-g ensemble, helmet', mass: 100,
      explode: [0, 2.6, 0],
      desc: 'One pilot flies the whole mission, eyes about 0.6 m behind the HUD. An anti-g suit and pressure breathing help hold consciousness at the airframe\'s +9 g limit; oxygen comes from the on-board oxygen generating system.',
    }, [mesh(merge(s), F.suit()), mesh(merge(hm), F.helmet()), mesh(visor, F.visor()), mesh(mask, F.black())]);
  }

  // ------------------------------------------------------------------ HOTAS: side-stick and throttles
  {
    const sS = SEAT_S - 0.43;
    const g = [new THREE.CylinderGeometry(0.018, 0.022, 0.16, 10).translate(X(sS), 0.37, 0.4), box(sS, 0.46, 0.4, 0.06, 0.05, 0.05), box(sS, 0.295, 0.4, 0.1, 0.01, 0.08)];
    P('Side-stick controller', {
      system: 'Crew systems', material: 'Force-sensing grip', mass: 3,
      explode: [0, 1.6, 0.4],
      desc: 'A right-hand side-stick that barely moves: it senses the pilot\'s force and sends commands to the flight-control computers, with buttons for weapons and sensors under the fingers (hands on throttle and stick, HOTAS).',
    }, mesh(merge(g), F.black()));
    const tS = SEAT_S - 0.32;
    const t = [];
    for (const dz of [-0.035, 0.035]) t.push(new THREE.BoxGeometry(0.06, 0.12, 0.05).rotateZ(-0.3).translate(X(tS), 0.36, -0.4 + dz));
    t.push(box(tS, 0.3, -0.4, 0.3, 0.02, 0.14));
    P('Throttles', {
      system: 'Crew systems', material: 'Twin throttle grips', mass: 4,
      explode: [0, 1.6, -0.4],
      desc: 'Two throttles on the left console, one per F119. Pushing past the military-power detent lights the afterburners.',
    }, mesh(merge(t), F.black()));
  }

  // ------------------------------------------------------------------ HUD, ICP, up-front and multifunction displays
  {
    const body = [box(4.84, 0.61, 0, 0.24, 0.09, 0.24), box(4.84, 0.665, 0, 0.12, 0.02, 0.2)];
    const comb = new THREE.BoxGeometry(0.01, 0.2, 0.2).rotateZ(0.5).translate(X(4.98), 0.78, 0);
    const frame = [FR.pipe([[4.92, 0.67, -0.105], [4.99, 0.86, -0.105]], 0.008, 5, 2), FR.pipe([[4.92, 0.67, 0.105], [4.99, 0.86, 0.105]], 0.008, 5, 2)];
    P('Head-up display', {
      system: 'Crew systems', material: 'Projector unit under a holographic combiner glass', mass: 16,
      explode: [0.7, 1.75, 0],
      desc: 'A wide-field-of-view monochrome HUD that serves as a primary flight instrument: symbols focused at infinity are projected onto the combiner about 0.6 m in front of the pilot\'s eye, so flight data and targets overlay the outside world.',
    }, [mesh(merge([...body, ...frame]), F.panel()), mesh(comb, F.hud(), { cast: false })]);
    const icp = [onPanel(0.495, 0, 0.22, 0.09, 0.035, 0.05)];
    const keys = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) keys.push(onPanel(0.475 + r * 0.04, -0.08 + c * 0.04, 0.025, 0.025, 0.065, 0.012));
    const ufd = [onPanel(0.495, 0.17, 0.1, 0.076), onPanel(0.495, -0.17, 0.1, 0.076)];
    P('Integrated control panel & up-front displays', {
      system: 'Crew systems', material: 'Keypad panel, two 3 × 4 in colour LCDs', mass: 6,
      explode: [0.95, 1.5, 0],
      desc: 'Under the HUD, the integrated control panel (ICP) is the keypad for communication, navigation and autopilot entries. The two 3 × 4 in up-front displays beside it show cautions, warnings and CNI data, and double as the standby flight instruments and fuel gauge.',
    }, [mesh(merge([...icp, ...keys]), F.panel()), mesh(merge(ufd), F.displayAmber())]);
    const bez = [onPanel(0.33, 0, 0.23, 0.23, 0.03, 0.025)];
    P('Primary multifunction display', {
      system: 'Crew systems', material: '8 × 8 in colour active-matrix LCD with bezel keys', mass: 9,
      explode: [1.25, 1.2, 0],
      desc: 'The 8 × 8 in primary display under the ICP shows the fused tactical situation from every sensor: tracks, not raw radar returns, which is what sensor fusion means for the pilot.',
    }, [mesh(merge(bez), F.panel()), mesh(onPanel(0.33, 0, 0.203, 0.203, 0.045, 0.01), F.display())]);
    const sb = [], sd = [];
    for (const [yy, zz] of [[0.31, 0.235], [0.31, -0.235], [0.07, 0]]) {
      sb.push(onPanel(yy, zz, 0.185, 0.185, 0.03, 0.025));
      sd.push(onPanel(yy, zz, 0.159, 0.159, 0.045, 0.01));
    }
    P('Secondary multifunction displays', {
      system: 'Crew systems', material: 'Three 6.25 × 6.25 in colour LCDs', mass: 15, count: 3,
      explode: [1.25, 0.85, 0],
      desc: 'Three 6.25 × 6.25 in displays around the primary one (left, right, and low in the centre between the knees) show tactical detail, stores management and system pages; with the two up-front displays and the PMFD that makes six colour LCDs.',
    }, [mesh(merge(sb), F.panel()), mesh(merge(sd), F.display())]);
  }
  void EYE;
}
