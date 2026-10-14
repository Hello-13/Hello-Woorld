// General Atomics MQ-9A Reaper (Predator B): medium-altitude long-endurance remotely piloted
// aircraft. Built at real scale in metres. Axes: nose toward +x, y up, starboard wing toward +z,
// ground at y = 0 on the wheels; fuselage station s runs aft from the nose tip (x = 5.5 − s).
// See mq9/shape.js for the outer mould line, mq9/powerplant.js for the TPE331-10 installation and
// mq9/stores.js for the pylons and weapons. Layout follows the USAF and GA-ASI fact sheets and
// published photographs; internal positions and all component masses are estimates unless a
// part says otherwise.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { wingPanel, hingedMesh, lathe, loftRings, naca00 } from '../engine/geometry.js';
import { M, SKIN } from '../engine/materials.js';
import { decal, danger } from '../engine/decals.js';
import { decalTexture } from '../engine/surface.js';
import {
  X, prof, fusePoint, fuselageLoft, stationsWithBreaks, splitTris, merge, box, lru, cylX, tubeBetween, pipe, latheX,
  hoop, bulkhead, applyMat, WING, wsec, W_ROOT, W_TIP, wpt, sparGeo, ribGeo,
} from './mq9/shape.js';
import { ENGINE_Y, SHAFT_Y, PROP_X, STATIONS } from './mq9/powerplant.js';
import { buildPropulsion, FIREWALL_S } from './mq9/propulsion.js';
import { buildFuel, buildFuelLines } from './mq9/fuel.js';
import { buildLynx, buildAirData, buildLinks } from './mq9/sensors.js';
import { gbu12, hellfire, launcher, pylon, erPod, GBU_R, ER_R, LAUNCHER_TOP, LAUNCHER_BOX_TOP } from './mq9/stores.js';

const deg = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SN = (s) => (s > 0 ? 'starboard' : 'port');
const mirror = (g) => applyMat(g.clone(), new THREE.Matrix4().makeScale(1, 1, -1));

function materials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // MQ-9s wear a flat grey paint: keep the shared skin's panel maps but only a faint, rough clearcoat,
  // so small curved fairings never throw sharp sun glints
  const skin = SKIN.uav().clone();
  skin.clearcoat = 0.12;
  skin.clearcoatRoughness = 0.45;
  const skin2 = skin.clone();
  skin2.side = THREE.DoubleSide;
  return {
    skin, skinDouble: skin2,
    // radomes: same light grey paint over a dielectric shell; satin, never mirror-glossy
    radome: new THREE.MeshPhysicalMaterial({ color: 0xa8aeb4, roughness: 0.46, metalness: 0.02, clearcoat: 0.25, clearcoatRoughness: 0.38 }),
    dark: M.uavDark(),
    frame: std({ color: 0x9aa3ab, roughness: 0.5, metalness: 0.65 }),
    primer: std({ color: 0x7d8a6a, roughness: 0.6, metalness: 0.2 }),
    composite: std({ color: 0x2b2e33, roughness: 0.55, metalness: 0.15 }),
    fuel: std({ color: 0x3f5a72, roughness: 0.62, metalness: 0.05 }),
    lru: std({ color: 0x3a3f46, roughness: 0.5, metalness: 0.45 }),
    lruOlive: std({ color: 0x4f5643, roughness: 0.55, metalness: 0.25 }),
    harness: std({ color: 0xd2d0c4, roughness: 0.75, metalness: 0.0 }),
    pipe: std({ color: 0xb9bec3, roughness: 0.35, metalness: 0.85 }),
    hot: M.inconel(), titanium: M.titanium(), gun: M.gunmetal(), alu: M.aluminium(), darkMetal: M.darkMetal(),
    rubber: M.rubber(), intake: M.intake(), copper: M.copper(),
    // propeller blades: matte black paint over aluminium, yellow tip stripes; polished aluminium spinner
    blade: std({ color: 0x1c1e21, roughness: 0.72, metalness: 0.2 }),
    bladeTip: std({ color: 0xd9ad22, roughness: 0.6, metalness: 0.1 }),
    spinner: new THREE.MeshPhysicalMaterial({ color: 0xc9ced3, roughness: 0.22, metalness: 1.0, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
    dish: std({ color: 0xdfe2e3, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }),
    turret: std({ color: 0x8e959b, roughness: 0.42, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c161e, roughness: 0.12, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.14 }),
    olive: M.munition(), seeker: std({ color: 0xc9ccc6, roughness: 0.45, metalness: 0.15 }),
    yellow: std({ color: 0xd8a51f, roughness: 0.5, metalness: 0.1 }), brown: std({ color: 0x6a4527, roughness: 0.6, metalness: 0.1 }),
    navRed: M.navRed(), navGreen: M.navGreen(),
    beacon: std({ color: 0x3a0606, emissive: 0xff2a1a, emissiveIntensity: 0.4, roughness: 0.35 }),
    lamp: std({ color: 0xdedede, emissive: 0xfff3dc, emissiveIntensity: 0.4, roughness: 0.2 }),
    laser: M.laser().clone(),
    lead: std({ color: 0x5b5f63, roughness: 0.78, metalness: 0.35 }),
  };
}

/** Low-visibility US national insignia (star-and-bar) as an outline, the way it is painted on grey RPAs. */
const insignia = () => decalTexture('mq9.insignia', 512, 256, (ctx, w, h) => {
  const ink = 'rgba(58,64,70,0.9)';
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 9;
  const cx = w / 2, cy = h / 2, R = h * 0.36;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? R * 0.38 : R * 0.96, a = -Math.PI / 2 + (k * Math.PI) / 5;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.strokeRect(cx - R * 2.05, cy - R * 0.3, R * 1.1, R * 0.6);
  ctx.strokeRect(cx + R * 0.95, cy - R * 0.3, R * 1.1, R * 0.6);
});

/** Wide stencil (the shared stencil canvas is too narrow for "U.S. AIR FORCE"). */
const wideStencil = (text, ink) => decalTexture(`mq9.st.${text}`, 1024, 128, (ctx, w, h) => {
  ctx.fillStyle = ink;
  ctx.font = '700 84px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4, w * 0.94);
});

/** Exhaust staining: a soft streak that fades aft (u runs forward → aft). */
const sootStreak = () => decalTexture('mq9.soot', 512, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(28,24,22,0.55)'); g.addColorStop(0.35, 'rgba(36,32,30,0.32)'); g.addColorStop(1, 'rgba(40,36,34,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(w * 0.05, h / 2, w * 0.98, h * 0.42, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
});

/** Section angle from the keel (0) round to the side (π/2) of the point (s, y, z), either side. */
function secAngle(s, y, z) {
  const { top, bot, hw, yc } = prof(s);
  const u = Math.abs(z) / hw, v = (y - yc) / ((top - bot) / 2);
  return Math.atan2(Math.sign(v) * Math.abs(v) ** 1.2, u ** 1.2) + Math.PI / 2;
}

/**
 * Main-gear door opening (starboard; mirrored for port). Photographs of MQ-9As show one door per side: a narrow slot that runs
 * from the trunnion at the lower corner aft and inboard along the folded leg, widening at its aft end, where a shallow blister
 * covers the wheel. The inboard edge is the door's straight hinge line (hingePoint); the outer edge (MAIN_EDGE)
 * is the strip the folding leg and wheel actually cross in this model's retraction, with a margin. Every skin triangle between
 * the two is cut away, and the door covers the cut.
 */
// the hinge line (starboard): straight, and just outside the curved skin all along (0.4 cm at mid-length, 3.2 cm at the ends),
// so the door's edge lies on or above it and opening never sweeps any of the door into the skin beside it
const HINGE_A = [0.62915, 1.06647, 0.29392], HINGE_B = [-1.00238, 1.09435, 0.05626];
/** Point on the (starboard) hinge line at station s. */
function hingePoint(s) {
  const f = (X(s) - HINGE_A[0]) / (HINGE_B[0] - HINGE_A[0]);
  return [0, 1, 2].map((k) => HINGE_A[k] + (HINGE_B[k] - HINGE_A[k]) * f);
}
function hingeAngle(s) { const p = hingePoint(s); return secAngle(s, p[1], p[2]); }
// outer edge of the opening as [station, angle on the forward side, angle on the aft side] at each skin ring over the well: it
// covers every crossing of the swing with a 2.5 cm margin, falls going aft no faster than one ring column per ring (so the cut
// follows it exactly) and steps out once, at s 6.12, where the wider wheel end of the door begins
const MAIN_EDGE = [[4.87, 1.307, 1.307], [4.92, 1.307, 1.307], [4.97, 1.307, 1.307], [5.02, 1.27, 1.27], [5.07, 1.21, 1.21], [5.12, 1.15, 1.15],
  [5.17, 1.09, 1.09], [5.22, 1.03, 1.03], [5.27, 0.97, 0.97], [5.32, 0.91, 0.91], [5.37, 0.856, 0.856], [5.42, 0.856, 0.856], [5.47, 0.856, 0.856],
  [5.52, 0.856, 0.856], [5.57, 0.856, 0.856], [5.62, 0.812, 0.812], [5.67, 0.8, 0.8], [5.72, 0.79, 0.79], [5.77, 0.777, 0.777], [5.82, 0.767, 0.767],
  [5.87, 0.762, 0.762], [5.92, 0.754, 0.754], [5.97, 0.754, 0.754], [6.02, 0.754, 0.754], [6.07, 0.754, 0.754], [6.12, 0.754, 1.289], [6.17, 1.289, 1.289],
  [6.22, 1.289, 1.289], [6.27, 1.289, 1.289], [6.3, 1.287, 1.287], [6.32, 1.263, 1.263], [6.37, 1.227, 1.227], [6.42, 1.167, 1.167], [6.47, 1.107, 1.107],
  [6.5, 1.071, 1.071]];
/** Outer-edge angle of the main-gear opening at station s; on a ring, `aft` picks the value for the band behind it. */
function edgeAngle(s, aft = true) {
  let i = 0;
  while (i < MAIN_EDGE.length - 2 && s > MAIN_EDGE[i + 1][0] + 1e-4) i++;
  const a = MAIN_EDGE[i], b = MAIN_EDGE[i + 1];
  if (Math.abs(s - a[0]) < 1e-4) return aft ? a[2] : a[1];
  if (Math.abs(s - b[0]) < 1e-4) return aft ? b[2] : b[1];
  const f = Math.min(1, Math.max(0, (s - a[0]) / (b[0] - a[0])));
  return a[2] + (b[1] - a[2]) * f;
}

/** Conformal skin patch (doors, access panels) over stations s0..s1 and section angles th0..th1. */
function skinPatch(s0, s1, th0, th1, out = 0.004, ns = 6, nt = 6) {
  const rows = [];
  for (let i = 0; i <= ns; i++) {
    const s = s0 + ((s1 - s0) * i) / ns;
    const row = [];
    for (let j = 0; j <= nt; j++) row.push(fusePoint(s, th0 + ((th1 - th0) * j) / nt, -out));
    rows.push(row);
  }
  return loftRings(rows, { closed: false, uvMode: 'metric' });
}

/** Blade antenna: swept trapezoid, extruded. Base at the origin, standing up along +y. */
function bladeAntenna(h, c, th = 0.018) {
  const sh = new THREE.Shape();
  sh.moveTo(c / 2, 0); sh.lineTo(-c / 2, 0); sh.lineTo(-c / 2 + c * 0.55, h); sh.lineTo(c / 2 - c * 0.08, h); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }).translate(0, 0, -th / 2);
}

export function buildUAV() {
  const A = new Assembly();
  const air = new THREE.Group();
  air.name = 'MQ-9A airframe';
  A.root.add(air);                       // root.children[0]: the lab reads its position for force arrows
  const P = (name, info, objs, parent = air) => A.part(name, info, objs, parent);
  const role = (g, r) => { g.userData.part.thermalRole = r; return g; };
  const m = materials();
  const L = (geo, material, o) => mesh(geo, material, o);

  // ============================================================== fuselage skins
  // the skin is cut away under the gear doors (the main-gear openings, between hingePoint and MAIN_EDGE; the nose well s 1.92–3.125). The loft is finer around
  // and along the main slots, and each main door is shaped from the very skin it replaces, so it covers its cut-out exactly.
  const opening = (s, y, z, pos, t) => {
    if (s > 4.87 && s < 6.5) {
      // judged by the triangle's corners, which on these rings sit exactly on the hinge line and the outer edge: cut if all of
      // them lie between the two
      let inside = true;
      for (let j = t; j < t + 9; j += 3) {
        const q = 5.5 - pos[j], th = secAngle(q, pos[j + 1], pos[j + 2]);
        if (th < hingeAngle(q) - 1e-4 || th > edgeAngle(q, s > q) + 1e-4) inside = false;
      }
      if (inside) return z > 0 ? 'cutS' : 'cutP';
    }
    return s > 1.92 && s < 3.125 && secAngle(s, y, z) < 0.41 ? 'cutN' : null;          // the nose leg folds along the centreline
  };
  const slotBreaks = Array.from({ length: 33 }, (_, k) => +(4.87 + k * 0.05).toFixed(2));
  // over the main wells, the ring vertices nearest each door's hinge line and outer edge are moved onto them, so the cut
  // follows both exactly
  const onHinge = (s, r) => {
    if (s < 4.87 - 1e-6 || s > 6.5 + 1e-6) return null;
    for (const th of new Set([hingeAngle(s), edgeAngle(s, false), edgeAngle(s, true)])) {
      const j = Math.round(th / ((2 * Math.PI) / 96));
      r[j] = fusePoint(s, -Math.PI / 2 + th);
      r[96 - j] = fusePoint(s, -Math.PI / 2 - th);
    }
    return r;
  };
  const fl = fuselageLoft(stationsWithBreaks([0.95, 1.92, 2.05, 3.125, 4.0, ...slotBreaks, 6.3, 6.5, FIREWALL_S], 0.2), 96, onHinge);
  const panels = splitTris(fl, (cx, cy, cz, pos, t) => {
    const s = 5.5 - cx;
    const cut = opening(s, cy, cz, pos, t);
    if (cut) return cut;
    if (s < 2.05 && cy > prof(Math.max(0, s)).yc - 0.02) return 'radome';
    if (s < 0.95) return 'lynx';
    if (s < 4.0) return 'fwd';
    if (s < 6.3) return 'ctr';
    if (s < FIREWALL_S) return 'aft';
    return 'cowl';
  });
  P('SATCOM radome', {
    system: 'Skin & fairings', skin: true, material: 'Dielectric composite shell, painted', mass: 22, explode: [1.3, 2.1, -1.3],
    desc: 'The bulbous upper nose is a radome over the Ku-band satellite dish. It is transparent to the 12–18 GHz link signal, which is why the nose shape is set by a 0.7 m-class dish rather than by aerodynamics.',
  }, L(panels.get('radome'), m.radome));
  P('Lynx radome', {
    system: 'Skin & fairings', skin: true, material: 'Dielectric composite shell, painted', mass: 7, explode: [1.9, 0.5, -1.3],
    desc: 'Lower nose fairing over the AN/APY-8 Lynx radar antenna. Ku-band radar energy passes through it with little loss, so it carries no metal structure.',
  }, L(panels.get('lynx'), m.radome));
  const fwdSkin = P('Forward fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Graphite/epoxy skin on Nomex honeycomb panels', mass: 80, explode: [0.2, 1.95, -1.3],
    desc: 'Skin over the forward bay, the avionics bay and the nose-gear well. Like the whole fuselage it is “a composite structure of impregnated graphite skin and Nomex honeycomb stiffening panels” (NTSB), with light-alloy fittings where loads come in; access panels open the avionics racks from the sides.',
  }, L(panels.get('fwd'), m.skin));
  P('Centre fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Graphite/epoxy skin on Nomex honeycomb panels', mass: 55, explode: [0, 2.05, -1.3],
    desc: 'Skin around the wing carry-through, the fuel bays and the main-gear bays: the most heavily loaded part of the fuselage, where wing bending meets the body. Like the rest of the fuselage it is “a composite structure of impregnated graphite skin and Nomex honeycomb stiffening panels” (NTSB).',
  }, L(panels.get('ctr'), m.skin));
  const aftSkin = role(P('Aft fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Graphite/epoxy skin on Nomex honeycomb panels', mass: 30, explode: [0.1, 2.05, -1.3],
    desc: 'Skin over the aft fuel cell and the accessory bay, rising into the dorsal hump that carries the engine inlet and the V-tail roots. The NTSB lists five fuselage bays: avionics, fuel, accessory, landing gear and engine.',
  }, L(panels.get('aft'), m.skin)), 'tailcone');
  const cowl = role(P('Engine bay cowling', {
    system: 'Skin & fairings', skin: true, material: 'Graphite/Nomex panels with titanium-faced edges near the exhaust (est.)', mass: 30, explode: [-0.5, 2.05, -1.3],
    desc: 'Removable cowling round the engine bay aft of the firewall, deep enough for the 0.68 m-tall reduction gearbox and faired straight into the spinner. Panels near the exhaust stacks need heat-resistant facing; the rest come off for engine changes.',
  }, L(panels.get('cowl'), m.skin)), 'cowling');

  // ============================================================== fuselage structure
  // nose-gear well s 1.88–3.13 under a raised avionics floor; main-gear wells s 4.86–6.5 behind the fuselage tank
  const NW = [1.88, 3.13], NFLOOR = 1.49;
  const MW = [4.86, 6.5], MROOF = [1.5, 1.735], MSTEP = 5.3;
  // frames that cross a gear well are open at the bottom: the well walls and keel webs carry the load around the cut-out
  const openArc = { from: -0.45, to: Math.PI + 0.45, n: 30 };
  const inWell = (s) => (s > NW[0] && s < NW[1]) || (s > MW[0] && s < MW[1]);
  const fwdFrames = [hoop(0.95, { from: -Math.PI, to: 0, n: 20 }), ...[2.05, 2.6, 3.42, 3.9].map((s) => hoop(s, inWell(s) ? openArc : {}))];
  P('Forward fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 45, count: 5, xrayWeight: 0.4, explode: [0.4, 0.45, 0],
    desc: 'Frames that hold the nose shape and carry the radome, nose gear and avionics loads into the longerons. The lower arc at the front carries the Lynx radome ring; the two over the nose-gear well stop at the well walls (spacing estimated).',
  }, L(merge(fwdFrames), m.frame));
  // engine-bay frames are open below, where the lower access panels come off (estimated)
  // the V-tail spar frames (s 8.78, 9.31) are cut where the dorsal inlet duct and the exhaust pipes pass
  const arcs = (s, list, h) => list.map(([a, b]) => hoop(s, { h, from: a, to: b, n: Math.max(4, Math.round((36 * (b - a)) / (Math.PI * 2))) }));
  const PI = Math.PI, DUCT = 0.3;
  // the frame under the aft cell has a keel cut-out for the feed line and the IFF cable; the one at the oil cooler opens round its scoop
  const keelCut = (a) => ({ from: -PI / 2 + a, to: PI * 1.5 - a, n: 34 });
  const aftOpen = { 6.95: keelCut(0.16), 7.75: keelCut(0.34) };
  // the frames over the main wells are cut away up to just above the doors' upper edges, where the lower longerons run
  const mainWellArc = { from: 0.12, to: PI - 0.12, n: 24 };
  const aftFrames = [4.25, 5.25, 6.3, 6.95, 7.75, 10.3].map((s) => hoop(s, { h: s > 9 ? 0.035 : 0.045, ...(inWell(s) ? mainWellArc : s > 9 ? { from: -0.35, to: PI + 0.35, n: 30 } : aftOpen[s] ?? {}) }));
  aftFrames.push(...arcs(8.78, [[-PI / 2, PI / 2 - DUCT], [PI / 2 + DUCT, PI * 1.5]], 0.045));
  aftFrames.push(...arcs(9.31, [[-0.35, 0.66], [1.08, PI / 2 - 0.38], [PI / 2 + 0.38, PI - 1.08], [PI - 0.66, PI + 0.35]], 0.04));   // the duct is wider here, where it rises over the engine
  P('Centre & aft fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 44, count: 8, xrayWeight: 0.4, explode: [-0.3, 0.45, 0],
    desc: 'Frames at the wing spars, main-gear wells, accessory bay, V-tail spars and the aft end of the cowling. The frames at the front and rear spar positions take the wing’s lift into the body; the two V-tail spar frames carry the tail’s root fittings, the front one cut where the inlet duct passes, the rear one also for the exhaust pipes, and the rear one also takes the engine mount truss’s front-mount yoke; the two over the main-gear wells are open from the keel up to the longerons above the doors, the engine-bay ones are open below, and the two under the aft cell and at the oil cooler have keel cut-outs for the feed line, the cables and the cooler scoop (spacing estimated).',
  }, L(merge(aftFrames), m.frame));
  const longerons = [0.9, Math.PI - 0.9, -0.5, -Math.PI + 0.5].map((th) => {
    const pts = [];
    // the upper pair ends at the firewall, where the inlet duct, the exhaust pipes and the V-tail roots fill the top;
    // the lower pair steps up over the main-gear wells to run above the doors' upper edges
    const lift = (s) => (th < 0 ? smooth(4.5, 4.8, s) * (1 - smooth(6.52, 6.82, s)) * 0.62 : 0);
    // the upper pair starts at the s 2.05 frame behind the SATCOM radome (no carbon in the dish's view), the lower pair at the s 0.95 ring
    for (let s = th > 0 ? 2.05 : 0.95; s <= (th > 0 ? FIREWALL_S : 10.3) + 1e-6; s += 0.125) pts.push(fusePoint(s, th > -1 ? th + lift(s) : th - lift(s), 0.04));
    return pipe(pts, 0.012, 6, 160);
  });
  P('Fuselage longerons', {
    system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 30, count: 4, xrayWeight: 0.4, explode: [0, 0.6, 0],
    desc: 'Four longitudinal members tie the frames together and carry fuselage bending from the heavy nose sensors and the engine at the tail. The lower pair runs from the Lynx radome ring along the lower sides and steps up over the main-gear wells to pass above the doors, so the cut-outs do not sever them; the upper pair runs from the frame behind the SATCOM radome, keeping carbon out of the dish’s view, to the firewall (positions estimated).',
  }, L(merge(longerons), m.composite));
  P('Avionics floor', {
    system: 'Structure', material: 'Aluminium honeycomb panel (est.)', mass: 10, explode: [0.6, 0.35, 0],
    desc: 'A floor for the avionics racks, raised over the nose-gear well. Keeping the electronics above the well keeps them clear of runway spray; the sensor electronics and batteries sit below it beside the well.',
  }, L(merge([box(1.9, 0.014, 0.76, [X(2.45), NFLOOR, 0]), ...[1.75, 2.45, 3.15].map((s) => box(0.03, 0.04, 0.74, [X(s), NFLOOR - 0.027, 0]))]), m.primer));
  const NWB = 1.045;                                   // well walls stop just inside the skin
  const nwWall = (zc) => box(NW[1] - NW[0], NFLOOR - NWB, 0.01, [X((NW[0] + NW[1]) / 2), (NFLOOR + NWB) / 2, zc]);
  P('Nose gear well', {
    system: 'Structure', material: 'Composite well liner (est.)', mass: 5, explode: [0.6, -0.15, 0],
    desc: 'A boxed well, 1.25 m long, that the nose leg retracts aft into; its side walls carry the floor and the frames past the cut-out (size estimated).',
  }, L(merge([nwWall(0.19), nwWall(-0.19), box(0.01, NFLOOR - NWB, 0.38, [X(NW[0]), (NFLOOR + NWB) / 2, 0]), box(0.01, NFLOOR - NWB, 0.38, [X(NW[1]), (NFLOOR + NWB) / 2, 0])]), m.primer));
  // main-gear wells: keel wall, stepped roof (low under the wing box, high behind it), forward and aft walls
  const keelWall = (zc) => {
    const yb = (s) => prof(s).bot + 0.02;
    const sh = new THREE.Shape([
      new THREE.Vector2(X(MW[0]), yb(MW[0])), new THREE.Vector2(X(MW[1]), yb(MW[1])),
      new THREE.Vector2(X(MW[1]), MROOF[1]), new THREE.Vector2(X(MSTEP), MROOF[1]), new THREE.Vector2(X(MSTEP), MROOF[0]), new THREE.Vector2(X(MW[0]), MROOF[0]),
    ].reverse());
    return new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }).translate(0, 0, zc - 0.004);
  };
  // a cross wall at station s between the keel wall and the skin, below height roof (shape in z–y, extruded along x)
  const crossWall = (s, roof, zs) => {
    const pts = [new THREE.Vector2(0.05, roof)];
    for (let i = 0; i <= 24; i++) {
      const p = fusePoint(s, -Math.PI / 2 + (i / 24) * (Math.PI / 2), 0.02);
      if (p[1] <= roof && p[2] >= 0.05) pts.push(new THREE.Vector2(p[2], p[1]));
    }
    pts.push(new THREE.Vector2(0.05, prof(s).bot + 0.02));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.reverse()), { depth: 0.01, bevelEnabled: false, curveSegments: 1 });
    applyMat(g, new THREE.Matrix4().set(0, 0, 1, X(s) - 0.005, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    return zs > 0 ? g : mirror(g);
  };
  // roof plate between the keel wall and the skin at height y over stations s0..s1
  const roofPlate = (s0, s1, y, zs) => {
    const half = (s) => { const { top, bot, hw, yc } = prof(s); const t = Math.min(1, Math.abs((y - yc) / ((top - bot) / 2))); return hw * (1 - t ** 2.4) ** (1 / 2.4) - 0.025; };
    const zo = Math.min(half(s0), half(s1), y > 1.7 ? 0.232 : 9);     // the high roof stops at the upper longeron
    return box(s1 - s0, 0.01, zo - 0.045, [X((s0 + s1) / 2), y, ((zo + 0.045) / 2) * zs]);
  };
  const bays = [];
  for (const zs of [1, -1]) {
    bays.push(keelWall(0.044 * zs));
    bays.push(roofPlate(MW[0], MSTEP, MROOF[0], zs), roofPlate(MSTEP, MW[1], MROOF[1], zs));
    bays.push(crossWall(MW[0], MROOF[0], zs), crossWall(MW[1], MROOF[1], zs));
    bays.push(box(0.01, MROOF[1] - MROOF[0], 0.27, [X(MSTEP), (MROOF[0] + MROOF[1]) / 2, 0.18 * zs]));
  }
  P('Main gear wells', {
    system: 'Structure', material: 'Composite well liners on a keel web (est.)', mass: 14, count: 2, explode: [0, -0.3, 0],
    desc: 'Two boxed wells, 1.64 m long, take the folded main legs, one each side of a keel web that carries fuselage bending past the cut-outs: each strut lies low along its well, its knee hooked by the uplock on the keel web, and the wheel lies tilted at the aft end, over the door’s blister. The roof steps up behind the wing box; the fuselage-tank feed, the fuel lines and the harness run in the keel channel between the webs (layout estimated).',
  }, L(merge(bays), m.primer));

  // wing carry-through: the two spars continue across the body; the wings bolt to fittings at its ends
  const carry = [], fittings = [];
  for (const cf of [0.15, 0.69]) {
    const x = W_ROOT.le[0] - cf * W_ROOT.chord;
    const top = wpt(WING.zRoot, cf, 1, 0.01)[1], bot = wpt(WING.zRoot, cf, -1, 0.01)[1];
    carry.push(box(0.05, top - bot, 0.8, [x, (top + bot) / 2, 0]));
    for (const zs of [1, -1]) for (const yy of [top - 0.02, bot + 0.02]) fittings.push(box(0.09, 0.04, 0.07, [x, yy, 0.425 * zs]), cylX(x - 0.06, x + 0.06, 0.012, 0.012, yy, 0.425 * zs, 8));
  }
  const xa = W_ROOT.le[0] - 0.15 * W_ROOT.chord, xb = W_ROOT.le[0] - 0.69 * W_ROOT.chord;
  carry.push(box(xa - xb, 0.012, 0.78, [(xa + xb) / 2, wpt(WING.zRoot, 0.4, 1, 0.02)[1], 0]));
  carry.push(box(xa - xb, 0.012, 0.78, [(xa + xb) / 2, wpt(WING.zRoot, 0.4, -1, 0.02)[1], 0]));
  P('Wing carry-through box', {
    system: 'Structure', material: 'Carbon composite box (est.)', mass: 70, explode: [0, 0.75, 0],
    desc: 'Continues the two wing spars through the fuselage so the wings’ bending loads meet in the middle instead of passing through the fuselage skin. The wings come off at its ends for shipping: the USAF notes the aircraft can be taken apart and loaded into a single container.',
  }, L(merge(carry), m.composite));
  P('Wing attach fittings', {
    system: 'Structure', material: 'Machined titanium lugs and steel pins (est.)', mass: 10, count: 8, explode: [0, 0.95, 0],
    desc: 'Lugs and pins where each wing bolts to the carry-through box, at the top and bottom of both spars. Eight are shown; the real count is not public.',
  }, L(merge(fittings), m.titanium));
  // ============================================================== wings
  const zE = (z) => (z - W_ROOT.le[2]) / (W_TIP.le[2] - W_ROOT.le[2]);
  // trailing-edge surfaces per wing (NTSB: inboard and outboard flaps, inboard and outboard ailerons); split stations estimated
  const SURFS = [
    ['Inboard flap', 0.78, 2.62, 'flap', 4.5, 'The inboard of two flaps on each wing (the NTSB lists inboard and outboard flaps on the Predator B). Take-off is flown with 15° of flap, retracted to 0° after lift-off; pulling the ground-station flap lever fully aft drives them to a 45° mechanical stop (USAF investigation of a 2020 loss at Syracuse). Lowered, they raise the wing’s maximum lift, so the aircraft can approach slowly enough for ordinary runways.'],
    ['Outboard flap', 2.7, 4.55, 'flap', 4.5, 'Moves with the inboard flap but on its own servo, so one failed actuator leaves the others working; a small gap separates the two panels. Plain flaps like these simply hinge down at the trailing edge (split station estimated).'],
    ['Inboard aileron', 4.72, 6.98, 'ail', 4, 'The inboard of two ailerons on each wing (NTSB). Ailerons move opposite to those on the other wing to roll the aircraft; each has its own servo, so a jammed or failed actuator leaves three working.'],
    ['Outboard aileron', 7.06, 9.3, 'ail', 3.5, 'Far from the centreline, a small deflection of the outboard aileron gives a large rolling moment. Near the stall, wingtip airflow separates first, which is why the flight computers guard the tip-stall margin (split station estimated).'],
  ];
  const RIBS = [0.45, 1.1, 1.75, 2.4, 3.05, 3.7, 4.35, 5.0, 5.6, 6.2, 6.8, 7.4, 8.0, 8.6, 9.2, 9.85];
  // under-wing stations: [span z, pylon chord, pylon depth, name, mass estimate, description]; ratings
  // as given in the Wikipedia article text (inboard 1,500 lb, middle 600 lb, outboard 200 lb); its armament
  // list, citing USAF T.O. 1Q9(M)A-1, gives 1,500 / 750 / 150 lb
  const STN = [
    [2.4, 0.92, 0.24, 'Inboard', 24, 'Inboard wing station, rated 1,500 lb (680 kg): the heaviest, because the wing is deepest and stiffest here. It takes a 500 lb-class bomb such as the GBU-12 shown or an external fuel tank, or a launcher for a pair of Hellfires.'],
    [4.0, 0.72, 0.2, 'Middle', 17, 'Middle wing station, rated 600 lb (272 kg; the USAF technical order is reported as 750 lb): sized for an M310 two-rail launcher with two Hellfires, about 141 kg together, as shown. A release unit and four sway braces hold the store against gust and landing loads.'],
    [5.6, 0.5, 0.15, 'Outboard', 12, 'Outboard wing station, rated 200 lb (91 kg; the USAF technical order is reported as 150 lb), for light stores and pods (shown empty). Weight this far out bends the wing hardest, which is why the ratings fall toward the tip.'],
  ];
  const surf = { flap: [], ail: [], rv: [], rud: null };
  const storeParts = { gbu: [], hellfire: [], launcher: [], er: [] };
  const braceSets = [];                      // sway-brace bolts and pads, one mesh per stores fit: { mesh, when(fit) }
  const twistAt = (z) => WING.twist * zE(z);
  const twistGeo = (g, z) => {
    const s = wsec(z);
    return g.translate(-s.le[0], -s.le[1], 0).rotateZ(twistAt(z) * deg).translate(s.le[0], s.le[1], 0);
  };
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const wbox = wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0, c1: 0.74, stations: 14, twist: WING.twist, n: 28 });
    const fills = [[WING.zRoot, SURFS[0][1]], ...SURFS.slice(0, -1).map((sf, k) => [sf[2], SURFS[k + 1][1]]), [SURFS[3][2], W_TIP.le[2]]].map(([a, b]) =>
      wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0.74, c1: 1, eta0: zE(a), eta1: zE(b), stations: 1, twist: WING.twist, n: 28 }));
    const tipCap = twistGeo(wingPanel({
      root: W_TIP, tip: { le: [W_TIP.le[0] - 0.03, W_TIP.le[1] + 0.002, WING.semi], chord: W_TIP.chord - 0.05, t: W_TIP.t * 0.45 }, stations: 2, n: 28,
    }), W_TIP.le[2]);
    const wing = P(`Wing skin (${sn})`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon/epoxy skins, integral leading edge (est.)', mass: 125, explode: [0, 1.5, 1.9 * side],
      desc: 'A long, straight, high-aspect-ratio wing: 20.1 m span (published) over about 24 m² in this model, an aspect ratio near 17 (the wing area is not published, so both are model estimates). Induced drag falls with span squared, which is what buys the 27-hour endurance. USAF Reapers have little effective ice protection and avoid moderate icing; GA-ASI offers a de-ice/anti-ice kit for the MQ-9A Block 5, and the 79 ft extended wing has leading-edge de-ice provisions.',
    }, [wbox, ...fills, tipCap].map((g) => L(f(g), m.skin)));
    if (side < 0) wing.userData.part.desc = 'Port wing skin, mirror of the starboard one. The skins are bonded to the spars and ribs and also form the walls of the integral fuel bays (internal layout estimated). Each wing has three store stations and comes off at the carry-through box for shipping.';

    P(`Main spar (${sn})`, {
      system: 'Structure', material: 'Carbon-fibre spar caps on a composite web (est.)', mass: 62, explode: [0, 0.75, 1.9 * side],
      desc: 'The main bending member, near 15 % chord where the section is deep. At 1 g it carries roughly half the aircraft’s weight from the tip to the carry-through box.',
    }, L(f(sparGeo(0.42, 9.95, 0.15, { width: 0.04, steps: 14 })), m.composite));
    P(`Rear spar (${sn})`, {
      system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 24, explode: [0, 0.75, 1.9 * side],
      desc: 'Closes the torsion box at 69 % chord and carries the flap and aileron hinges. Two spars and the skins form a closed box that resists twisting.',
    }, L(f(sparGeo(0.42, 9.7, 0.69, { width: 0.025, steps: 14 })), m.composite));
    P(`Wing ribs (${sn})`, {
      system: 'Structure', material: 'Composite and machined aluminium at hardpoints (est.)', mass: 26, count: RIBS.length, xrayWeight: 0.3, explode: [0, 0.4, 1.9 * side],
      desc: 'Ribs keep the airfoil shape and stabilise the skins against buckling; the heavier ribs at 2.4, 4.0 and 5.6 m from the centreline carry the pylon loads. Holes between the spars save weight and let fuel flow from bay to bay (spacing and hole layout estimated).',
    }, L(f(merge(RIBS.map((z) => ribGeo(z, 0.012, 0.72, { holes: [0.3, 0.44, 0.58] })))), m.primer));

    // trailing-edge surfaces, each with a horn, its own servo and pushrod behind the rear spar, and three hinges
    const hp = (z) => { const p = wpt(z, 0.74, 0); return new THREE.Vector3(p[0], p[1], p[2] * side); };
    const servo = (z) => { const c = wpt(z, 0.715, 0); return box(0.04, 0.045, 0.2, [c[0], c[1], c[2]]); };
    const brk = [], branch = [];
    // a servo sits at mid-span of its surface unless a rib is there; then it moves to the middle of that rib bay
    const servoAt = (zm) => { if (!RIBS.some((r) => Math.abs(r - zm) < 0.13)) return zm; const i = RIBS.findIndex((r) => r > zm); return (RIBS[i - 1] + RIBS[i]) / 2; };
    for (const [name, z0, z1, kind, mass, desc] of SURFS) {
      const zm = (z0 + z1) / 2, zs = servoAt(zm);
      const hornG = merge([box(0.05, 0.035, 0.012, [wpt(zs, 0.785, -1, -0.012)[0], wpt(zs, 0.785, -1, -0.012)[1], zs])]);
      const g = f(merge([wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0.745, c1: 1, eta0: zE(z0 + 0.01), eta1: zE(z1 - 0.01), stations: 4, twist: WING.twist, n: 28 }), hornG]));
      const h = hingedMesh(g, m.skin, hp(z0), hp(z1));
      h.mesh.castShadow = true; h.mesh.receiveShadow = true;
      const isFlap = kind === 'flap';
      P(`${name} (${sn})`, {
        system: 'Flight controls', material: 'Composite with a machined control horn (est.)', mass, explode: [-0.7, 1.5, (isFlap ? 1.9 : 2.3) * side],
        desc,
      }, h.pivot);
      (isFlap ? surf.flap : surf.ail).push({ h, side });
      const pa = wpt(zs, 0.715, 0), pb = wpt(zs, 0.78, -1, -0.02);
      P(`${name} servo (${sn})`, {
        system: 'Flight controls', material: 'Electromechanical actuator and pushrod (est.)', mass: 2, explode: [-0.4, 1.0, (isFlap ? 1.6 : 2.0) * side],
        desc: isFlap
          ? 'An electric servo behind the rear spar drives its flap through a short pushrod to the horn under the surface. The MQ-9 flies by wire with electric actuators and has no hydraulic system (position and size estimated).'
          : 'The aileron’s own electric servo and pushrod, behind the rear spar at mid-span of the surface, commanded by the flight control computers (position and size estimated).',
      }, L(f(merge([servo(zs), tubeBetween(pa, pb, 0.006, 6)])), m.lruOlive));
      for (const z of [z0 + 0.14, zm + 0.12, z1 - 0.14]) {
        const a = wpt(z, 0.69, 0), b = wpt(z, 0.745, 0);
        brk.push(box(Math.abs(a[0] - b[0]) + 0.02, 0.03, 0.012, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.01, z]), cylX(b[0] - 0.006, b[0] + 0.006, 0.012, 0.012, b[1] - 0.01, z, 8));
      }
      branch.push(tubeBetween(wpt(zs - 0.12, 0.705, 0), wpt(zs - 0.08, 0.715, 0), 0.006, 5));
    }
    P(`Flap & aileron hinges (${sn})`, {
      system: 'Flight controls', material: 'Aluminium hinge brackets on the rear spar (est.)', mass: 2, count: 12, xrayWeight: 0.6, explode: [-0.55, 1.25, 1.9 * side],
      desc: 'Three brackets on the rear spar carry the hinge line of each of the four surfaces on this wing; the surfaces pivot about their leading edges, and each bracket takes part of the surface’s air load into the spar (bracket count and spacing estimated).',
    }, L(f(merge(brk)), m.alu));
    const harnessPts = [[0.45, 0.705], [1.5, 0.705], [3.0, 0.705], [4.5, 0.705], [6.0, 0.705], [7.0, 0.704], [7.8, 0.703], [8.6, 0.703], [9.25, 0.70], [9.6, 0.6], [9.85, 0.4], [9.95, 0.08], [10.01, 0.045]].map(([z, cf]) => wpt(z, cf, 0));
    // the radio antenna's coax leaves the bundle in the tip and runs out to the pod's inboard face
    const podAt = wpt(10.05, 0.45, 0);
    branch.push(pipe([wpt(9.85, 0.4, 0), wpt(9.97, 0.42, 0), [podAt[0] - 0.05, podAt[1], WING.semi - 0.028]], 0.006, 5, 12));
    P(`Wing wiring (${sn})`, {
      system: 'Electrical', material: 'Shielded harness in conduit (est.)', mass: 4, xrayWeight: 0.5, explode: [0, 1.0, 1.9 * side],
      desc: 'Power and signal runs along the rear spar, outside the fuel bays, with a branch to each of the four surface servos, then round the tip to the navigation light, with the coax for the wingtip V/UHF antenna leaving it for the antenna pod.',
    }, L(f(merge([pipe(harnessPts, 0.008, 5, 120), ...branch])), m.harness));
    const lens = new THREE.SphereGeometry(0.03, 12, 8).scale(1.4, 0.8, 1).translate(...wpt(10.0, 0.04, 0)).translate(0.02, 0, 0.03);
    P(`Navigation light (${sn})`, {
      system: 'Electrical', material: 'LED position light', mass: 0.5, explode: [0, 1.5, 2.1 * side],
      desc: side > 0 ? 'Green position light on the starboard wingtip, red on the port one: other pilots can tell which way the aircraft is heading at night.' : 'Red position light on the port wingtip. The MQ-9 flies in shared airspace, so it carries the same lights as a crewed aircraft.',
    }, L(f(lens), side > 0 ? m.navGreen : m.navRed, { cast: false }));
    const pod = latheX([[0.001, -0.4], [0.02, -0.33], [0.024, -0.1], [0.022, 0.05], [0.001, 0.12]], 12);
    pod.translate(wpt(10.05, 0.45, 0)[0], wpt(10.05, 0.45, 0)[1], WING.semi - 0.01);
    P(`Wingtip V/UHF antenna (${sn})`, {
      system: 'Communications', material: 'Dielectric fairing (shape approximate)', mass: 1, explode: [0, 1.5, 2.2 * side],
      desc: 'Block 5 aircraft carry VHF/UHF voice-radio antennas at the wingtips for the two ARC-210 radios, so ground forces and air traffic control can talk to the crew through the aircraft (fairing shape approximate).',
    }, L(f(pod), m.dark));

    // pylons and stores
    const stnInfo = [], rel = [];
    // sway-brace pads set on each store's shoulders (pylon frame; stores hang 1.2 cm under the hooks' line, yBot − 0.012)
    const onRound = (R, h) => () => { const zc = 0.062, yc = -h - 0.042 - R, y = yc + Math.sqrt(R * R - zc * zc); return { z: zc, y, nz: zc / R, ny: (y - yc) / R }; };
    const onLauncher = (h) => (dx) => (dx > 0 ? { z: 0.062, y: -h - 0.1 + LAUNCHER_BOX_TOP, nz: 0, ny: 1 } : { z: 0.046, y: -h - 0.1 + LAUNCHER_TOP, nz: 0, ny: 1 });
    STN.forEach(([z, chord, h, label, mass, desc], k) => {
      const le = wpt(z, 0.04, 0), yTop = wpt(z, 0.32, -1)[1] + 0.03;
      const pg = pylon(chord, h);
      rel.push(pg.release.translate(le[0], yTop, z));
      const sets = [
        [[onRound(GBU_R, h), (fit) => fit.gbu], [onRound(ER_R, h), (fit) => fit.er], [null, (fit) => !fit.gbu && !fit.er]],
        [[onLauncher(h), (fit) => fit.hellfire], [null, (fit) => !fit.hellfire]],
        [[null, () => true]],
      ][k].map(([contact, when]) => { const mesh = L(f(pg.braces(contact).translate(le[0], yTop, z)), m.darkMetal); braceSets.push({ mesh, when }); return mesh; });
      P(`${label} pylon (${sn})`, {
        system: 'Weapons', material: 'Aluminium pylon with bomb rack, release unit and sway braces (mass est.)', mass, explode: [0, -0.75, 1.9 * side],
        desc,
      }, [L(f(pg.skin.translate(le[0], yTop, z)), m.skin), L(f(pg.rack.translate(le[0], yTop, z)), m.darkMetal), ...sets]);
      stnInfo.push({ x: le[0] - chord * 0.45, yBot: yTop - h - 0.03, z });
    });
    P(`Store release hardware (${sn})`, {
      system: 'Weapons', material: 'Steel suspension hooks, umbilical connectors and arming solenoids (rack type not public)', mass: 6, count: 3, explode: [0, -0.45, 2.3 * side],
      desc: 'Under each wing pylon: two suspension hooks 14 in (0.356 m) apart, the standard spacing for 100–1,000 lb stores (MIL-STD-8591), which hold the store’s lugs until release; the electrical umbilical that powers and codes the weapon; and an arming solenoid that keeps the arming wire as the store falls away. The MQ-9’s rack type is not public.',
    }, L(f(merge(rel)), m.darkMetal));

    // GBU-12 on the inboard station
    const g = gbu12();
    const gb = stnInfo[0];
    const gy = gb.yBot - g.radius - 0.012, gx = gb.x;               // lugs on the two hooks
    const place = (geo) => f(geo.clone().translate(gx, gy, gb.z));
    storeParts.gbu.push(P(`GBU-12 Paveway II (${sn})`, {
      system: 'Weapons', material: 'Mk 82 steel bomb body, laser guidance kit', mass: 230, massSource: 'Published GBU-12 figure (≈ 230 kg)', explode: [0, -1.1, 2.1 * side],
      desc: 'A 500 lb-class Mk 82 bomb with a laser seeker and steering canards on the nose and folding wings at the tail: 3.27 m long, 0.27 m across. It steers toward laser energy reflected from a marked spot.',
      callout: side > 0, anchor: [gx - 1.6, gy + 0.13, gb.z * side],   // at the tail wings
    }, [L(place(g.body), m.olive), L(place(g.guidance), m.seeker), L(place(g.dome), m.glass), L(place(g.band), m.yellow)]));

    // GA-ASI ER kit: a fuel pod on the inboard station instead of the bomb (shown in the 'er' fit)
    const er = erPod();
    const ey = gb.yBot - er.radius - 0.012, ex = gb.x;
    const pp = (geo) => f(geo.clone().translate(ex, ey, gb.z));
    const erPart = P(`ER fuel pod (${sn})`, {
      system: 'Fuel', material: 'Aluminium/composite external tank (shape and structure not public)', mass: 45, explode: [0, -1.1, 2.1 * side],
      desc: 'GA-ASI’s extended-range kit hangs a fuel pod on each inboard station, raising the fuel load from 3,800 lb (1,724 kg) to 6,450 lb (2,926 kg), about 600 kg per pod, and endurance from 26 h to 34 h (GA-ASI Block 5 sheet). The inboard stations are the only ones rated for that weight, 1,500 lb each (pod size and shape estimated).',
    }, [L(pp(er.body), m.skin), L(pp(er.fittings), m.darkMetal)]);
    erPart.visible = false;
    storeParts.er.push(erPart);

    // two Hellfires on a two-rail launcher, middle station
    const md = stnInfo[1];
    const lg = launcher();
    const ly = md.yBot - 0.07, lx = md.x - 0.05;
    storeParts.launcher.push(P(`M310 launcher (${sn})`, {
      system: 'Weapons', material: 'Aluminium launcher with electronics assembly', mass: 43, massSource: 'Lockheed Martin M299 product card: 2-rail 42 kg (92 lb) empty; Marvin Engineering 96 lb', explode: [0, -0.9, 2.0 * side],
      desc: 'An M310 two-rail Hellfire launcher, the two-rail member of the M299/M310 family (the M299 itself has four rails). Its electronics pass the laser code and power to each missile before launch.',
    }, L(f(lg.clone().translate(lx, ly, md.z)), m.darkMetal)));
    const hf = hellfire();
    const hy = ly - 0.095 - 0.021 - hf.radius;
    const pair = (geo) => f(merge([-1, 1].map((k) => geo.clone().translate(lx - 0.02, hy, md.z + 0.12 * k))));
    storeParts.hellfire.push(P(`AGM-114 Hellfire pair (${sn})`, {
      system: 'Weapons', material: 'Steel/aluminium airframe, semi-active laser seeker', mass: 98, massSource: 'Published AGM-114 figure (45–49 kg each)', count: 2, explode: [0, -1.2, 2.0 * side],
      desc: 'Two laser-guided Hellfire missiles, each 1.63 m long and 0.18 m in diameter. The seeker under the nose dome homes on a laser spot with a matching pulse code.',
      callout: side < 0, anchor: [lx - 0.42, hy - 0.06, (md.z + 0.19) * side],   // the port pair: the outboard missile's lower flank
    }, [L(pair(hf.body), m.olive), L(pair(hf.dome), m.glass), L(pair(hf.band), m.yellow), L(pair(hf.motor), m.brown)]));
  }
  // wing root fairings (both sides)
  const rootF = [];
  for (const side of [1, -1]) {
    // rooted inside the fuselage (z 0.15) and thick enough to bury there, so no gap opens at the wing root
    const a = wsec(0.15), b = wsec(0.66);
    const g = wingPanel({ root: { ...a, chord: a.chord * 1.06, le: [a.le[0] + 0.045, a.le[1], a.le[2]], t: a.t * 1.25 }, tip: b, stations: 3, n: 28, withChord: false });
    rootF.push(side > 0 ? g : mirror(g));
  }
  P('Wing root fairings', {
    system: 'Skin & fairings', skin: true, material: 'Composite fillets (est.)', mass: 8, count: 2, explode: [0, 1.75, -1.3],
    desc: 'Fillets that blend the shoulder-mounted wing into the fuselage, cutting the interference drag where the two flows meet and covering the wing attach fittings.',
  }, rootF.map((g) => L(g, m.skin)));

  // centreline station
  const cl = [lru(0.62, 0.05, 0.13, [X(4.6), 0.995, 0], 0.02), box(0.04, 0.035, 0.03, [X(4.6) + 0.178, 0.96, 0]), box(0.04, 0.035, 0.03, [X(4.6) - 0.178, 0.96, 0])];
  P('Centreline station', {
    system: 'Weapons', material: 'Aluminium hardpoint fairing', mass: 6, explode: [0, -0.7, 0],
    desc: 'The seventh hardpoint, under the fuselage on the centreline (shown empty). The USAF technical order is reported as listing it “not used”. With the six wing stations the aircraft carries 3,000 lb (1,361 kg) of external stores on older GA-ASI figures, 3,750 lb (1,701 kg) on the Block 5 sheet.',
  }, L(merge(cl), m.darkMetal));

  // ============================================================== V-tail and ventral fin
  // V-tail roots on the dorsal hump; the semi-span is set so the tips stand at the published 3.81 m height
  const DIH = 47 * deg, VT_L = 2.455, VT_ROOT = [8.45, 1.96, 0.09];
  const vtRoot = { le: [0, 0, 0], chord: 1.3, t: 0.11 };
  const vtTip = { le: [-VT_L * Math.tan(25 * deg), 0, VT_L], chord: 0.62, t: 0.09 };
  const vtPoint = (eta, cf, side) => new THREE.Vector3(
    vtRoot.le[0] + (vtTip.le[0] - vtRoot.le[0]) * eta - cf * (vtRoot.chord + (vtTip.chord - vtRoot.chord) * eta), 0, VT_L * eta * side);
  const tailFrames = [];
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const frame = new THREE.Group();
    frame.position.set(X(VT_ROOT[0]), VT_ROOT[1], VT_ROOT[2] * side);
    frame.rotation.x = -DIH * side;
    air.add(frame);
    tailFrames.push(frame);
    const fixed = wingPanel({ root: vtRoot, tip: vtTip, c0: 0, c1: 0.7, stations: 6, n: 24 });
    const fill0 = wingPanel({ root: vtRoot, tip: vtTip, c0: 0.7, c1: 1, eta0: 0, eta1: 0.06, stations: 1, n: 24 });
    const fill1 = wingPanel({ root: vtRoot, tip: vtTip, c0: 0.7, c1: 1, eta0: 0.94, eta1: 1, stations: 1, n: 24 });
    const cap = wingPanel({ root: vtTip, tip: { le: [vtTip.le[0] - 0.02, 0, VT_L + 0.05], chord: vtTip.chord - 0.04, t: vtTip.t * 0.4 }, stations: 2, n: 24 });
    P(`V-tail skin (${sn})`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon/epoxy (est.)', mass: 18, explode: [0, -0.35, 0.85 * side],
      desc: 'One half of the V-tail, set about 47° above horizontal (estimated from photographs). Two surfaces do the work of a fin and a tailplane, saving weight and wetted area.',
    }, [fixed, fill0, fill1, cap].map((g) => L(f(g), m.skin)), frame);
    const hornP = vtPoint(0.13, 0.76, 1);
    const rvG = f(merge([wingPanel({ root: vtRoot, tip: vtTip, c0: 0.705, c1: 1, eta0: 0.065, eta1: 0.935, stations: 3, n: 24 }), box(0.05, 0.03, 0.012, [hornP.x, -0.045, hornP.z])]));
    const rH = hingedMesh(rvG, m.skin, vtPoint(0.065, 0.7, side), vtPoint(0.935, 0.7, side));
    rH.mesh.castShadow = true; rH.mesh.receiveShadow = true;
    P(`Ruddervator (${sn})`, {
      system: 'Flight controls', material: 'Composite (est.)', mass: 7, explode: [-0.6, -0.35, 0.85 * side],
      desc: 'Moving together, the two ruddervators pitch the aircraft like an elevator; moving oppositely they yaw it like a rudder. The flight computers mix the two commands.',
      callout: side > 0, anchor: [vtPoint(0.92, 0.85, 1).x, 0, VT_L * 0.92 * side],
    }, rH.pivot, frame);
    surf.rv.push({ h: rH, side });
    // the spars start, and the root rib sits, where the surface leaves the fuselage: clear of the dorsal inlet duct and the exhaust pipes below
    const vs = [sparGeo(0.09, VT_L - 0.05, 0.25, { width: 0.025, steps: 4, root: vtRoot, tip: vtTip, twist: 0 }), sparGeo(0.15, VT_L - 0.08, 0.66, { width: 0.02, steps: 4, root: vtRoot, tip: vtTip, twist: 0 })];
    for (const zz of [0.14, 0.65, 1.25, 1.85, VT_L - 0.03]) vs.push(ribGeo(zz, 0.02, 0.69, { root: vtRoot, tip: vtTip, twist: 0, th: 0.008 }));
    const vh = [];
    for (const eta of [0.15, 0.5, 0.85]) {
      const p0 = vtPoint(eta, 0.66, 1), p1 = vtPoint(eta, 0.705, 1);
      vh.push(box(Math.abs(p0.x - p1.x) + 0.02, 0.026, 0.012, [(p0.x + p1.x) / 2, -0.006, p0.z]), cylX(p1.x - 0.006, p1.x + 0.006, 0.01, 0.01, -0.006, p0.z, 8));
    }
    P(`Ruddervator hinges (${sn})`, {
      system: 'Flight controls', material: 'Aluminium hinge brackets on the rear spar (est.)', mass: 0.6, count: 3, xrayWeight: 0.6, explode: [-0.45, -0.2, 0.85],
      desc: 'Three brackets on the tail’s rear spar, at the root, middle and tip of the ruddervator, carry its hinge line; each takes part of the surface’s air load into the spar. The servo’s pushrod works a horn near the root (bracket positions estimated).',
    }, L(f(merge(vh)), m.alu), frame);
    P(`V-tail spar & ribs (${sn})`, {
      system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 9, explode: [0, 0, 0.55 * side],
      desc: 'Two spars and five ribs per tail surface. The root rib sits where the surface leaves the fuselage, and the spars’ roots are pinned through root fittings to the two V-tail spar frames, above the engine’s inlet duct and exhaust pipes (layout estimated).',
    }, L(f(merge(vs)), m.composite), frame);
    // root fittings: a clevis on the upper and lower cap of each spar root, straddling its spar frame, with a fore-and-aft bolt through each
    const rf = [];
    for (const [cf, zf, fs] of [[0.25, 0.07, 8.78], [0.66, 0.13, 9.31]]) {
      const x = X(fs) - frame.position.x, ht = naca00(cf, vtRoot.t) * vtRoot.chord - 0.02;
      for (const yy of [ht, -ht]) {
        for (const dx of [-0.021, 0.021]) rf.push(box(0.012, 0.022, 0.05, [x + dx, yy, zf]));
        rf.push(cylX(x - 0.032, x + 0.032, 0.008, 0.008, yy, zf, 8));
      }
    }
    P(`V-tail root fittings (${sn})`, {
      system: 'Structure', material: 'Machined aluminium or titanium lugs and steel pins (est.)', mass: 1.6, count: 4, explode: [0, -0.15, 0.4 * side],
      desc: 'Clevis fittings on the upper and lower caps of the front and rear spar roots straddle the two V-tail spar frames over the accessory bay and the engine, with a bolt through each clevis and the frame between its plates. They carry the tail’s bending and twisting into the fuselage, and sit outboard of the inlet duct and above the exhaust pipes that pass between the tail roots (layout estimated).',
    }, L(f(merge(rf)), m.titanium), frame);
  }
  const fin = new THREE.Group();
  // ventral fin under the engine section (root s 8.3–9.55, from photographs); its bumper stands below the propeller tips
  fin.position.set(X(8.3), 1.28, 0);
  fin.rotation.x = Math.PI / 2;
  air.add(fin);
  const vfRoot = { le: [0, 0, 0], chord: 1.25, t: 0.1 }, vfTip = { le: [-0.5, 0, 0.97], chord: 0.72, t: 0.08 };
  const vf = [
    // withChord: false: at zero sideslip the fin carries no load, so Pressure view paints it with the body Cp
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0, c1: 0.7, stations: 4, n: 22, withChord: false }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0, eta1: 0.2, stations: 1, n: 22, withChord: false }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0.9, eta1: 1, stations: 1, n: 22, withChord: false }),
  ];
  vf.push(sparGeo(0.08, 0.93, 0.3, { width: 0.02, steps: 3, root: vfRoot, tip: vfTip, twist: 0 }));
  P('Ventral fin', {
    system: 'Skin & fairings', skin: true, material: 'Composite (est.)', mass: 12, explode: [-0.25, 0, 0.75],
    desc: 'The lower arm of the Y-tail. It adds directional stability that a V-tail alone lacks and reaches below the propeller arc so the fin, not the blades, touches first on an over-rotation.',
  }, vf.map((g) => L(g, m.skin)), fin);
  const vfPoint = (eta, cf) => new THREE.Vector3(vfRoot.le[0] + (vfTip.le[0] - vfRoot.le[0]) * eta - cf * (vfRoot.chord + (vfTip.chord - vfRoot.chord) * eta), 0, vfTip.le[2] * eta);
  const rudHorn = vfPoint(0.25, 0.77);
  const rudG = merge([wingPanel({ root: vfRoot, tip: vfTip, c0: 0.705, c1: 1, eta0: 0.2, eta1: 0.9, stations: 2, n: 22, withChord: false }), box(0.05, 0.012, 0.03, [rudHorn.x, 0.042, rudHorn.z])]);
  const rh = [];
  for (const eta of [0.3, 0.8]) {
    const p0 = vfPoint(eta, 0.66), p1 = vfPoint(eta, 0.705);
    rh.push(box(Math.abs(p0.x - p1.x) + 0.02, 0.012, 0.026, [(p0.x + p1.x) / 2, 0, p0.z]), cylX(p1.x - 0.006, p1.x + 0.006, 0.01, 0.01, 0, p0.z, 8));
  }
  const rudH = hingedMesh(rudG, m.skin, vfPoint(0.2, 0.7), vfPoint(0.9, 0.7));
  rudH.mesh.castShadow = true;
  P('Ventral rudder', {
    system: 'Flight controls', material: 'Composite (est.)', mass: 3, explode: [-0.6, 0, 0.75],
    desc: 'A rudder on the trailing edge of the ventral fin: the NTSB describes “the ventral fin and rudder” as separate pieces of the 2006 wreckage and calls the V-tail surfaces “elevator surfaces”. It adds yaw authority for crosswind take-offs and landings.',
  }, rudH.pivot, fin);
  surf.rud = rudH;
  P('Ventral rudder hinges', {
    system: 'Flight controls', material: 'Aluminium hinge brackets (est.)', mass: 0.3, count: 2, xrayWeight: 0.6, explode: [-0.45, 0, 0.95],
    desc: 'Two brackets on the fin’s rear spar carry the ventral rudder’s hinge line (positions estimated).',
  }, L(merge(rh), m.alu), fin);
  const tipZ = vfTip.le[2] + 0.02;
  P('Tail bumper', {
    system: 'Landing gear', material: 'Replaceable composite/steel skid (est.)', mass: 2, explode: [-0.25, 0, 1.0],
    desc: 'A sacrificial skid under the ventral fin that takes any tail strike on take-off rotation or a flared landing, protecting the fin and the propeller above it.',
  }, L(merge([box(0.5, 0.05, 0.035, [vfTip.le[0] - 0.34, 0, tipZ])]), m.darkMetal), fin);

  // ============================================================== propulsion
  // TPE331-10 right ahead of the propeller, exhaust flange s 9.17 to propeller flange s 10.255; see mq9/propulsion.js
  const prop = buildPropulsion({ P, L, m, role });
  const { propSpin, hubSpin, domeSpin } = prop;

  // ============================================================== fuel system
  // seven internal tanks, jet-pump transfer into the header cell; see mq9/fuel.js
  const fuel = buildFuel({ P, L, m });
  buildFuelLines({ P, L, m }, fuel, prop);

  // ============================================================== flight-control electronics and tail servos
  const fcc = [-0.24, -0.08, 0.08].map((z) => lru(0.42, 0.2, 0.14, [X(2.175), NFLOOR + 0.107, z]));
  P('Flight control computers', {
    system: 'Flight controls', material: 'Redundant flight computers', mass: 12, count: 3, explode: [0.9, 0.9, -0.3],
    desc: 'Triple-redundant computers (GA-ASI, Block 5) fly the aircraft: a stability augmentation system and hold modes keep attitude, altitude and airspeed, and they mix the ruddervator commands. Stall protection pushes the nose down, to about −15°, as speed nears the stall. If the link is lost they fly an uploaded profile: a climb for 51 s at 105 kt, then preset waypoints (USAF and NTSB investigations).',
  }, L(merge(fcc), m.lru));
  A.root.updateMatrixWorld(true);
  const rvServoAt = [];                      // world positions of the ruddervator servos, for the tail harness
  for (const zs of [1, -1]) {
    // in the root of each tail surface, ahead of the rear spar, with a pushrod back to the ruddervator horn
    const c = vtPoint(0.1, 0.5, zs), horn = vtPoint(0.13, 0.735, zs);
    const fr = tailFrames[zs > 0 ? 0 : 1];
    rvServoAt.push(fr.localToWorld(c.clone()));
    P(`Ruddervator servo (${SN(zs)})`, {
      system: 'Flight controls', material: 'Electromechanical actuator and pushrod (est.)', mass: 3, explode: [-0.3, 0.5, 0.65],
      desc: 'Sits in the root of its tail surface and drives the ruddervator through a pushrod to a horn near the root. The flight computers send each servo the mixed pitch-and-yaw command (position estimated).',
    }, L(merge([lru(0.17, 0.04, 0.07, [c.x, 0, c.z]), tubeBetween([c.x - 0.085, 0, c.z], [horn.x + 0.01, 0.0, horn.z], 0.006, 6)]), m.lruOlive), fr);
  }
  const rudServo = vfPoint(0.25, 0.75);
  P('Ventral rudder servo', {
    system: 'Flight controls', material: 'Electromechanical actuator in the fin root (est.)', mass: 1.5, explode: [-0.4, -0.2, 0.9],
    desc: 'A small servo inside the root of the ventral fin works the ventral rudder through a short pushrod (position estimated).',
  }, L(merge([box(0.14, 0.03, 0.06, [-0.64, 0, 0.14]), tubeBetween([-0.71, 0, 0.14], [rudServo.x + 0.02, 0, rudServo.z], 0.006, 6)]), m.lruOlive), fin);

  // ============================================================== landing gear
  // Retraction kinematics are estimated (GA-ASI publishes none). Each leg swings about its trunnion into
  // its well; members whose ends move independently (actuators) are re-placed every frame by update().
  const Yup = new THREE.Vector3(0, 1, 0);
  const member = (r, material, seg = 10) => L(new THREE.CylinderGeometry(r, r, 1, seg, 1).translate(0, 0.5, 0), material);
  const placeMember = (mm, a, b) => {
    const d = b.clone().sub(a); const len = Math.max(1e-4, d.length());
    mm.position.copy(a); mm.quaternion.setFromUnitVectors(Yup, d.divideScalar(len)); mm.scale.set(1, len, 1);
  };
  /** Telescoping actuator: a barrel of length lB from the anchor end and a rod out to the moving end. */
  const makeActuator = (rB, rR, lB, material) => {
    const barrel = member(rB, material, 12), rod = member(rR, m.pipe, 10);
    return {
      meshes: [barrel, rod],
      set(a, b) {
        const d = b.clone().sub(a), n = d.clone().normalize(), lb = Math.min(lB, d.length() * 0.8);
        placeMember(barrel, a, a.clone().addScaledVector(n, lb));
        placeMember(rod, a.clone().addScaledVector(n, lb * 0.5), b);
      },
    };
  };
  const movers = [];                       // () => void, run after the legs and doors have moved

  // ---- nose gear: steerable oleo leg, retracts aft into the well under the avionics floor
  const NG = { s: 2.0, y: 1.12, stow: -(Math.PI / 2 + 0.2) };     // the tyre's arc reaches s 3.121, just short of the well's aft wall
  const noseLeg = new THREE.Group();
  noseLeg.position.set(X(NG.s), NG.y, 0);
  const ngStrut = [
    new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14).rotateX(Math.PI / 2),                 // trunnion
    tubeBetween([0, 0.01, 0], [0, -0.52, 0], 0.045, 14),                                       // outer cylinder
    tubeBetween([0, -0.5, 0], [0.025, -0.8, 0], 0.03, 12),                                     // sliding piston
    box(0.06, 0.05, 0.15, [0.03, -0.81, 0]),                                                   // fork crown
    box(0.05, 0.2, 0.018, [0.035, -0.91, 0.062]), box(0.05, 0.2, 0.018, [0.035, -0.91, -0.062]),
    new THREE.CylinderGeometry(0.035, 0.035, 0.065, 14).rotateX(Math.PI / 2).translate(0, 0, 0.1325),   // trunnion stub carrying the horn
    box(0.035, 0.1, 0.03, [0, 0.05, 0.15]),                                                     // actuator horn, outboard of the steering unit
  ];
  P('Nose gear oleo strut', {
    system: 'Landing gear', material: 'Steel oleo-pneumatic strut and fork', mass: 16, explode: [0, -0.85, 0],
    desc: 'The nose leg’s shock absorber: oil forced through an orifice and a gas spring soak up the landing and taxi loads. It pivots on a trunnion at the top and retracts aft into the well (layout and retraction estimated).',
  }, noseLeg);
  noseLeg.add(L(merge(ngStrut), m.alu));
  P('Nose gear torque links', {
    system: 'Landing gear', material: 'Forged aluminium scissor links', mass: 1.5, count: 2, explode: [-0.3, -0.5, 0.3],
    desc: 'A hinged scissor between the outer cylinder and the piston: the piston can slide but not turn, so steering torque reaches the wheel.',
  }, L(merge([tubeBetween([-0.035, -0.44, 0], [-0.078, -0.585, 0], 0.012, 6), tubeBetween([-0.078, -0.585, 0], [-0.02, -0.78, 0], 0.012, 6), cylX(-0.09, -0.066, 0.012, 0.012, -0.585, 0, 8)]), m.alu), noseLeg);
  P('Nose gear steering actuator', {
    system: 'Landing gear', material: 'Electric steering motor on a collar (est.)', mass: 2.5, explode: [0.3, -0.5, 0.45],
    desc: 'An electric servo on a collar turns the nose leg. The pilot steers through the rudder pedals and the wheel centres itself; differential braking helps on tight turns. When a nosewheel servo driver failed in May 2015 the wheel could neither centre nor follow the pedals, and the aircraft ran off the runway ($6.7 million damage, USAF investigation).',
  }, L(merge([new THREE.TorusGeometry(0.058, 0.014, 6, 20).rotateX(Math.PI / 2).translate(0, -0.1, 0), lru(0.06, 0.05, 0.12, [-0.07, -0.1, 0.05]), cylX(-0.16, -0.1, 0.022, 0.022, -0.1, 0.09, 10)]), m.lruOlive), noseLeg);
  // 0.28 m across: scaled against the fuselage depth in side views of USAF MQ-9As (AF 20-409 at Kunsan) and a GA-ASI MQ-9A (N428HK)
  const nwheel = [new THREE.TorusGeometry(0.095, 0.045, 12, 28), new THREE.CylinderGeometry(0.068, 0.068, 0.08, 20).rotateX(Math.PI / 2)];
  P('Nose wheel & tyre', {
    system: 'Landing gear', material: 'Aluminium wheel, tubeless tyre', mass: 5, explode: [0.2, -0.3, 0.45],
    desc: 'A single small nose wheel, about 0.28 m across: scaled from side views of USAF and GA-ASI MQ-9As it measures 0.27–0.30 m, and the size is not published, so take it as ±10 %. It takes only a small share of the weight but all of the steering loads.',
  }, [L(nwheel[0], m.rubber), L(nwheel[1], m.alu)], noseLeg).position.set(0.035, -0.98, 0);
  const lampG = merge([cylX(0.0, 0.04, 0.035, 0.03, 0, 0, 14), cylX(0.04, 0.045, 0.03, 0.03, 0, 0, 14)]);
  const lampPart = P('Landing & taxi light', {
    system: 'Electrical', material: 'LED lamp on the nose leg', mass: 1, explode: [0.35, -0.1, 0],
    desc: 'Lights the runway on approach and taxi and makes the aircraft visible to tower controllers; the pilot sees the runway through the nose camera.',
  }, [L(lampG, m.darkMetal)], noseLeg);
  lampPart.add(L(new THREE.CircleGeometry(0.028, 16).rotateY(Math.PI / 2).translate(0.046, 0, 0), m.lamp, { cast: false }));
  lampPart.position.set(0.05, -0.33, 0);
  // retraction actuator: from the well roof to the horn above the trunnion; it also braces the leg fore and aft when locked down
  const ngAct = makeActuator(0.024, 0.014, 0.32, m.darkMetal);
  // its line of action is at z 0.15, outboard of the steering unit (which reaches z 0.11), so the two never meet as the leg folds
  const ngAnchor = new THREE.Vector3(X(2.6), 1.42, 0.15), ngHorn = new THREE.Vector3(0, 0.08, 0.15);
  const ngBracket = merge([box(0.05, NFLOOR - 0.007 - 1.42 + 0.012, 0.012, [ngAnchor.x, (NFLOOR - 0.007 + 1.42 - 0.012) / 2, ngAnchor.z + 0.031]), box(0.05, NFLOOR - 0.007 - 1.42 + 0.012, 0.012, [ngAnchor.x, (NFLOOR - 0.007 + 1.42 - 0.012) / 2, ngAnchor.z - 0.031]),
    new THREE.CylinderGeometry(0.006, 0.006, 0.074, 8).rotateX(Math.PI / 2).translate(ngAnchor.x, ngAnchor.y, ngAnchor.z)]);   // clevis plates and pin
  P('Nose gear retraction actuator', {
    system: 'Landing gear', material: 'Electromechanical or electro-hydraulic actuator (type not public)', mass: 3, explode: [0, 0.35, 0.5],
    desc: 'Pushes on a horn above the trunnion to swing the leg aft and up; in this model it also braces the leg fore and aft when locked down. Its fixed end hangs from a clevis bracket under the avionics floor. The real linkage and actuator type are not published.',
  }, [...ngAct.meshes, L(ngBracket, m.darkMetal)]);
  movers.push(() => ngAct.set(ngAnchor, ngHorn.clone().applyQuaternion(noseLeg.quaternion).add(noseLeg.position)));
  P('Nose gear uplock', {
    system: 'Landing gear', material: 'Spring-loaded hook with an electric release (est.)', mass: 1, explode: [0.2, 0.45, 0],
    desc: 'Catches the retracted leg so it cannot drop in flight and releases it for extension; a spring hook on the actuator’s end-stop holds it down (estimated).',
  }, L(merge([box(0.05, 0.16, 0.04, [X(2.66), NFLOOR - 0.09, -0.04]), box(0.06, 0.02, 0.04, [X(2.66) - 0.02, NFLOOR - 0.17, -0.04])]), m.darkMetal));

  // on the well roof beside the port well wall, outboard of where the nose wheel stows (the tyre stows at z ±0.065)
  const ndrv = [X(2.88), NFLOOR - 0.04, -0.125];
  P('Nose gear retract driver', {
    system: 'Landing gear', material: 'Motor driver electronics on the well roof (est.)', mass: 1, explode: [0.25, 0.6, -0.35],
    desc: 'Drives the nose-gear retraction actuator on command from the ground station; like the mains it is all-electric. It sits on the well roof against the port wall, clear of the stowed nose wheel, with its lead forward past the uplock to the actuator (position estimated).',
  }, L(merge([lru(0.2, 0.06, 0.12, ndrv, 0.012), pipe([[ndrv[0] + 0.1, ndrv[1], ndrv[2]], [X(2.72), 1.45, -0.095], [X(2.62), 1.435, -0.08], [X(2.598), 1.428, -0.02], [ngAnchor.x + 0.012, 1.426, ngAnchor.z - 0.038]], 0.006, 5, 20)]), m.lru));
  const nsc = [X(2.3), NFLOOR - 0.035, -0.12];
  P('Nose-wheel steering controller', {
    system: 'Landing gear', material: 'Servo driver and steering controller (est.)', mass: 1, explode: [0.45, 0.55, -0.4],
    desc: 'Turns rudder-pedal commands from the ground station into drive for the steering servo and centres the wheel when the commands stop. Its failure in May 2015 left the nose wheel uncontrollable on the runway (USAF investigation; position estimated).',
  }, L(merge([lru(0.15, 0.06, 0.1, nsc, 0.012), pipe([[nsc[0] + 0.07, nsc[1] - 0.01, nsc[2]], [X(2.12), 1.36, -0.11], [X(NG.s + 0.03), 1.22, -0.112], [X(NG.s), 1.125, -0.112]], 0.006, 5, 14)]), m.lru));
  // the leg's own harness: from the trunnion end, where the steering controller's lead arrives, to the steering motor and the landing light
  P('Nose leg harness', {
    system: 'Electrical', material: 'Shielded harness clamped to the leg, with a flexible loop at the trunnion (est.)', mass: 0.5, xrayWeight: 0.5, explode: [0.4, -0.65, -0.35],
    desc: 'Rides on the nose leg: power and commands for the steering motor, power for the landing and taxi light, and the steering-position signal back to the controller. It leaves the airframe at the end of the trunnion, on the pivot axis, so retracting the leg twists the loop there instead of stretching it (routing estimated).',
  }, L(merge([
    pipe([[0, 0, -0.112], [0.03, -0.04, -0.095], [0.06, -0.1, -0.065], [0.058, -0.2, -0.048], [0.062, -0.27, -0.03], [0.068, -0.297, -0.012]], 0.005, 5, 24),
    pipe([[0.03, -0.04, -0.095], [-0.03, -0.055, -0.085], [-0.075, -0.065, -0.04], [-0.07, -0.073, 0.02]], 0.005, 5, 14),
  ]), m.harness), noseLeg);

  // ---- main gear: trailing-arm legs on trunnions at the lower corners of the body, retracting aft into the wells
  // Offsets from the trunnion with the leg down (x forward, starboard side; mirrored for port). Photographs show long, splayed
  // legs (about 40° from vertical, a track of about 2.4 m) and small wheels, about 0.38 m across; each leg folds aft and inboard
  // under one long door, the wheel ending at the door's blistered aft end. The leg turns as one rigid unit (strut, trailing arm,
  // shock absorber, brake and wheel) about a single fixed hinge axis, `hinge`, by `stow` radians. Axis and angle were searched
  // so that the leg and wheel pass outboard of that door hanging open from its straight inboard hinge, cross the skin only
  // inside its outline, fold clear of the keel web, roofs, frames, longeron and retract driver, and leave the wheel just above
  // the blister (kinematics estimated).
  const MG = { pivot: [4.95, 1.2, 0.31], knee: [0, -0.87, 0.74], axle: [-0.22, -1.01, 0.84], wheelOff: 0.06, hinge: [0.46367, -0.26307, -0.84605], stow: 1.80292 };
  const mainLegs = [], uplockAt = [];
  for (const side of [1, -1]) {
    const sd = SN(side);
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2] * side);
    const piv = new THREE.Group();
    piv.position.set(X(MG.pivot[0]), MG.pivot[1], MG.pivot[2] * side);
    const K = V(MG.knee), Ax = V(MG.axle);
    // mirroring a rotation through the x–y plane flips the axis' z and the sense of rotation
    const hingeAxis = V(MG.hinge).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(hingeAxis, MG.stow * side);
    // trunnion pin along the hinge axis, offset inboard so its outer end stays inside the skin
    const pin = tubeBetween([0, 0, 0], hingeAxis.clone().multiplyScalar(0.1).toArray(), 0.04, 14);
    const at = (t) => K.clone().multiplyScalar(t);
    P(`Main gear strut (${sd})`, {
      system: 'Landing gear', material: 'Titanium strut (PCC Structurals) and trunnion', mass: 18, explode: [0, -0.95, 0.75 * side],
      desc: 'The titanium main leg of GA-ASI’s heavy-weight trailing-arm gear (announced January 2012, fitted to Block 5): it pivots on a trunnion at the lower corner of the body, splays about 40° outward for a track near 2.4 m, and carries the trailing arm at its foot. GA-ASI gives 30 %+ more landing weight at a 10 ft/s sink rate and rejected-take-off braking at 11,700 lb (leg geometry from photographs; retraction path estimated).',
    }, piv);
    piv.add(L(merge([tubeBetween([0, 0, 0], K.toArray(), 0.05, 14), pin, box(0.05, 0.06, 0.05, at(0.32).toArray()), box(0.05, 0.06, 0.05, at(0.5).add(new THREE.Vector3(-0.07, 0, 0)).toArray())]), m.alu));
    P(`Main gear trailing arm (${sd})`, {
      system: 'Landing gear', material: 'Forged steel arm with axle', mass: 9, explode: [-0.3, -1.2, 0.9 * side],
      desc: 'Pivots at the foot of the strut and trails the wheel behind it, so bumps swing the wheel up and back into the shock absorber instead of jarring the strut.',
    }, L(merge([tubeBetween(K.toArray(), Ax.toArray(), 0.042, 12), new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10).rotateX(Math.PI / 2).translate(K.x, K.y, K.z), new THREE.SphereGeometry(0.045, 12, 8).translate(Ax.x, Ax.y, Ax.z)]), m.alu), piv);
    const s0 = at(0.5).add(new THREE.Vector3(-0.07, 0, 0)), s1 = K.clone().lerp(Ax, 0.6).add(new THREE.Vector3(0, 0.04, 0));
    P(`Main gear shock absorber (${sd})`, {
      system: 'Landing gear', material: 'Taylor Devices sealed shock absorber', mass: 5, explode: [-0.35, -0.8, 1.1 * side],
      desc: 'Runs from the strut to the trailing arm and absorbs the landing energy. Made by Taylor Devices and, GA-ASI says, maintenance-free: it needs no nitrogen servicing.',
    }, L(merge([tubeBetween(s0.toArray(), s0.clone().lerp(s1, 0.6).toArray(), 0.034, 12), tubeBetween(s0.clone().lerp(s1, 0.55).toArray(), s1.toArray(), 0.02, 10)]), m.darkMetal), piv);
    // the brake servo lies along the inboard side of the trailing arm, aft of the shock absorber's lower end (lerp 0.6); its
    // forward end takes the brake line coming down the leg, its aft end the short lead to the brake
    const armDir = Ax.clone().sub(K).normalize();
    const inb = new THREE.Vector3(0, 0.45, -side);
    inb.addScaledVector(armDir, -inb.dot(armDir)).normalize();
    const bs = K.clone().lerp(Ax, 0.8).addScaledVector(inb, 0.042 + 0.028);
    const servoG = lru(0.09, 0.056, 0.056, [0, 0, 0], 0.01).applyMatrix4(new THREE.Matrix4().makeBasis(armDir, inb.clone().cross(armDir), inb)).translate(bs.x, bs.y, bs.z);
    // down the front of the strut, round the inboard side of the trailing arm to the brake servo
    const brakeLine = [];
    for (let k = 0; k <= 6; k++) brakeLine.push(at(k / 6).add(new THREE.Vector3(0.055, 0.02, 0)).toArray());
    brakeLine.push(K.clone().lerp(Ax, 0.25).add(new THREE.Vector3(0.02, 0.01, -0.056 * side)).toArray(), K.clone().lerp(Ax, 0.45).add(new THREE.Vector3(0.0, 0.04, -0.06 * side)).toArray(), bs.clone().addScaledVector(armDir, -0.047).toArray());
    P(`Brake line & harness (${sd})`, {
      system: 'Landing gear', material: 'Flexible brake hose and sensor wiring (est.)', mass: 1, explode: [0.25, -0.9, 1.0 * side],
      desc: 'Runs down the leg to the brake servo on the trailing arm and carries the wheel-speed and weight-on-wheels signals back up; the automatic landing system uses them (routing estimated; brake actuation type not public).',
    }, L(pipe(brakeLine, 0.007, 5, 40), m.harness), piv);
    // wheel, tyre and brake (wheel frame: axle along z, outboard toward +z on the starboard side)
    const w = [new THREE.TorusGeometry(0.135, 0.055, 14, 32), merge([new THREE.CylinderGeometry(0.1, 0.1, 0.1, 24).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12).rotateX(Math.PI / 2).translate(0, 0, -0.02 * side)]), new THREE.CylinderGeometry(0.085, 0.085, 0.025, 20).rotateX(Math.PI / 2).translate(0, 0, -0.055 * side)];
    const wheel = P(`Main wheel & brake (${sd})`, {
      system: 'Landing gear', material: 'Parker Hannifin wheel and multi-disc brake, tubeless tyre', mass: 16, explode: [0, -0.15, 0.4 * side],
      desc: 'Parker Hannifin wheel and brake, about 0.38 m in diameter (estimated from photographs), with provisions for anti-lock braking. It retracts with its leg, rolling about 50° on the way up, and lies tilted at the aft end of the well, just above the door’s blister. The brakes work only with the gear down and are commanded from the ground station or the automatic landing system; reverse propeller pitch does most of the stopping (GA-ASI; USAF).',
    }, [L(w[0], m.rubber), L(w[1], m.alu), L(w[2], m.darkMetal)], piv);
    wheel.position.set(Ax.x, Ax.y, Ax.z + MG.wheelOff * side);
    // retraction actuator from the well's forward upper corner to a lug on the strut
    const act = makeActuator(0.032, 0.018, 0.3, m.darkMetal);
    const anchor = new THREE.Vector3(X(4.92), 1.45, 0.3 * side), lug = at(0.32);
    P(`Main gear retraction actuator (${sd})`, {
      system: 'Landing gear', material: 'Electrically driven actuator (type not public)', mass: 4, explode: [0.3, 0.4, 0.8 * side],
      desc: 'Pulls the strut aft and up into the well, a cycle of about 25 s, and holds it locked down for landing. To lower the gear the pilot moves the handle, waits for “Ready to lower landing gear” and presses the stick trigger; the sensor operator then confirms it with the MTS-B camera. In 2012 the trigger step was missed and an MQ-9 landed gear-up (USAF; geometry estimated).',
    }, act.meshes);
    movers.push(() => act.set(anchor, lug.clone().applyQuaternion(piv.quaternion).add(piv.position)));
    // uplock on the keel web, beside the folded leg's knee: its hook closes under the strut just above the trailing-arm pivot
    const kS = at(0.93).applyQuaternion(q).add(piv.position);
    const kw = 0.048 * side, hookIn = kS.z - 0.052 * side;
    uplockAt.push([kS.x, kS.y + 0.055, (kw + hookIn) / 2]);
    P(`Main gear uplock (${sd})`, {
      system: 'Landing gear', material: 'Spring-loaded hook with an electric release (est.)', mass: 1, explode: [0, 0.5, 0.6 * side],
      desc: 'Bolted to the keel web beside the folded leg, it hooks the strut just above the trailing-arm pivot when the leg is up, so the gear cannot drop in flight; an electric release opens it for extension (position estimated).',
    }, L(merge([box(0.09, 0.1, 0.008, [kS.x, kS.y + 0.01, kw + 0.004 * side]), box(0.05, 0.03, Math.abs(hookIn - kw), [kS.x, kS.y - 0.035, (kw + hookIn) / 2]), box(0.05, 0.03, 0.02, [kS.x, kS.y + 0.055, (kw + hookIn) / 2])]), m.darkMetal));
    P(`Brake servo (${sd})`, {
      system: 'Landing gear', material: 'Electromechanical brake servo (est.)', mass: 1.2, explode: [0.35, -1.1, 1.2 * side],
      desc: 'Each main brake has its own servo, so the crew can brake differentially to help steer. It rides on the trailing arm beside the wheel and folds with it. After a 2022 hard landing an MQ-9A needed new landing gear, retract drivers and brake servos (USAF investigation; position estimated).',
    }, L(merge([servoG, tubeBetween(bs.clone().addScaledVector(armDir, 0.044).toArray(), [Ax.x + 0.025, Ax.y + 0.07, Ax.z - 0.008 * side], 0.006, 5)]), m.lruOlive), piv);
    const drv = [X(5.16), MROOF[0] - 0.035, 0.25 * side];
    P(`Main gear retract driver (${sd})`, {
      system: 'Landing gear', material: 'Motor driver electronics on the well roof (est.)', mass: 1.5, explode: [0.1, 0.65, 0.75 * side],
      desc: 'Powers and controls the retraction actuator on command from the ground station: gear and brakes are moved by electric servos and drivers, not hydraulics (USAF investigations; position estimated).',
    }, L(merge([lru(0.2, 0.06, 0.12, drv, 0.012), pipe([[drv[0] + 0.1, drv[1], drv[2]], [X(4.95), 1.44, 0.29 * side], [anchor.x - 0.02, anchor.y - 0.01, anchor.z]], 0.006, 5, 10)]), m.lru));
    mainLegs.push({ piv, q });
  }
  // gear electrics: a branch from each main power feeder down behind the wing box to its retract driver, on to the trunnion where
  // the brake line starts; and a branch from the avionics bay harness under the floor to the nose retract driver and steering controller
  const lgh = [];
  const DOOR_ACT = [6.2, 1.22, 0.069];            // fixed end of each main-door actuator, on the keel web just ahead of the folded wheel (starboard; mirrored for port)
  for (const zs of [1, -1]) {
    const ul = uplockAt[zs > 0 ? 0 : 1];
    // feeder → down behind the wing box, inboard of the upper longeron → retract driver
    lgh.push(pipe([fusePoint(5.278, Math.PI / 2 - 0.5 * zs, 0.031), [X(5.278), 1.7, 0.2 * zs], [X(5.27), 1.6, 0.27 * zs], [X(5.255), 1.52, 0.285 * zs], [X(5.24), 1.496, 0.28 * zs]], 0.008, 5, 24));
    // driver → down the well's forward wall → the inboard end of the trunnion pin, where the brake line starts
    lgh.push(pipe([[X(5.063), 1.445, 0.215 * zs], [X(4.95), 1.42, 0.2 * zs], [X(4.885), 1.36, 0.2 * zs], [X(4.882), 1.27, 0.215 * zs], [X(4.886), 1.205, 0.229 * zs]], 0.007, 5, 24));
    // driver → inboard under the roof to the keel web, aft along it with a drop to the door actuator, then down to the uplock's release
    lgh.push(pipe([[X(5.16), 1.468, 0.19 * zs], [X(5.21), 1.472, 0.11 * zs], [X(5.32), 1.468, 0.056 * zs], [X(5.7), 1.458, 0.056 * zs], [X(5.9), 1.38, 0.056 * zs], [ul[0], ul[1] + 0.02, 0.058 * zs], [ul[0], ul[1] - 0.006, 0.06 * zs]], 0.006, 5, 40));
    lgh.push(pipe([[X(5.9), 1.38, 0.056 * zs], [X(6.05), 1.33, 0.056 * zs], [X(DOOR_ACT[0]), DOOR_ACT[1] + 0.05, 0.056 * zs], [X(DOOR_ACT[0]), DOOR_ACT[1] + 0.02, 0.058 * zs], [X(DOOR_ACT[0]), DOOR_ACT[1], DOOR_ACT[2] * zs]], 0.005, 5, 16));
  }
  // nose: from the avionics bay harness through the well's aft wall to the retract driver, and under the driver to the steering controller
  lgh.push(pipe([[X(3.35), 1.45, -0.29], [X(3.24), 1.425, -0.21], [X(3.12), 1.425, -0.13], [X(3.04), 1.44, -0.127], [X(2.985), 1.45, -0.125]], 0.006, 5, 20));
  lgh.push(pipe([[X(3.12), 1.425, -0.13], [X(3.02), 1.405, -0.15], [X(2.9), 1.4, -0.155], [X(2.7), 1.405, -0.16], [X(2.5), 1.42, -0.16], [X(2.385), 1.44, -0.13]], 0.006, 5, 30));
  // and from the driver's lead to the nose uplock's release
  lgh.push(pipe([[X(2.72), 1.45, -0.095], [X(2.7), 1.452, -0.06], [X(2.688), 1.452, -0.042]], 0.005, 5, 8));
  P('Landing gear harness', {
    system: 'Electrical', material: 'Shielded harness in the gear wells (est.)', mass: 2.5, xrayWeight: 0.5, explode: [0, -0.15, 1.15],
    desc: 'Feeds the all-electric gear: a branch from each main power feeder runs down behind the wing box to its retract driver, on down the well’s forward wall to the trunnion, where the brake line and weight-on-wheels wiring start, and aft along the keel web to the door actuator and the uplock’s electric release; the nose branch leaves the avionics bay harness and runs under the floor to the nose retract driver, the nose uplock and the steering controller. A 2014 MQ-9 could not lower its gear after a generator failure ran the batteries down (USAF investigation; routing estimated).',
  }, L(merge(lgh), m.harness));

  // gear doors: conformal skin patches over the cut-outs; the nose doors hinge on their outer edges, the main doors on their inboard edges
  const doors = [];
  const doorPart = (name, s0, s1, th0, th1, hingeOn, { nt = 6, ...info }) => {
    const g = skinPatch(s0, s1, th0, th1, 0.004, 6, nt);
    const th = hingeOn === 'outer' ? th1 : th0;
    const p0 = new THREE.Vector3(...fusePoint(s0, th)), p1 = new THREE.Vector3(...fusePoint(s1, th));
    const h = hingedMesh(g, m.skinDouble, p0, p1);
    h.mesh.castShadow = true;
    P(name, { system: 'Landing gear', skin: true, material: 'Composite doors (est.)', ...info }, h.pivot);
    return h;
  };
  for (const side of [1, -1]) {
    const sd = SN(side);
    // one door, made from the very skin cut away under it, offset just outside the skin and hinged on its straight inboard edge;
    // its aft end carries a shallow blister over the folded wheel (s 6.1–6.45; the stowed tyre lies 3–5 cm inside the skin there)
    const blister = (q, a) => (q > 6.1 && q < 6.45 && a > 0.45 && a < 1.05 ? 0.02 * Math.sin((Math.PI * (q - 6.1)) / 0.35) * Math.sin((Math.PI * (a - 0.45)) / 0.6) : 0);
    const surf = (q, a) => new THREE.Vector3(...fusePoint(q, -Math.PI / 2 + a * side, -(0.004 + blister(q, a))));
    const dg = panels.get(side > 0 ? 'cutS' : 'cutP').clone(), dp = dg.attributes.position, dn = dg.attributes.normal;
    for (let k = 0; k < dp.count; k++) {
      const q = 5.5 - dp.getX(k), a = secAngle(q, dp.getY(k), dp.getZ(k)), p = surf(q, a);
      const nn = surf(q + 0.002, a).sub(surf(q - 0.002, a)).cross(surf(q, a + 0.002).sub(surf(q, a - 0.002))).normalize().multiplyScalar(-side);
      dp.setXYZ(k, p.x, p.y, p.z); dn.setXYZ(k, nn.x, nn.y, nn.z);
    }
    // a short horn on the hinge line: up through the opening just outboard of the hinge, then inboard just above the skin, where the
    // door actuator pulls on it; opening the door swings it up and out, and it never crosses the gear's path
    const hh = hingePoint(DOOR_ACT[0]), ys = fusePoint(DOOR_ACT[0], -Math.PI / 2 + hingeAngle(DOOR_ACT[0]))[1] + 0.015, zv = hh[2] + 0.008;
    const hornTip = new THREE.Vector3(hh[0], ys, (zv - 0.031) * side);
    const horn = merge([box(0.014, ys - hh[1] + 0.006, 0.012, [hh[0], (ys + hh[1]) / 2, zv * side]), box(0.014, 0.012, 0.037, [hh[0], ys, (zv - 0.0155) * side])]);
    const hp0 = hingePoint(4.87), hp1 = hingePoint(6.5);
    const mainDoor = hingedMesh(merge([dg, horn]), m.skinDouble, new THREE.Vector3(hp0[0], hp0[1], hp0[2] * side), new THREE.Vector3(hp1[0], hp1[1], hp1[2] * side));
    mainDoor.mesh.castShadow = true;
    P(`Main gear door (${sd})`, {
      system: 'Landing gear', skin: true, material: 'Composite door with a moulded blister (est.)', mass: 4, explode: [0, -0.6, 0.55 * side],
      desc: 'One long door per side, as photographs of USAF and GA-ASI MQ-9As show (USAF 230430-F-UB655-0794, an MQ-9A taking off from a Wyoming highway in 2023; GA-ASI’s N428HK in Poland, USAF 5147992): it hangs open below the belly whenever the gear is down and is shut in flight. It covers a narrow slot (here about 0.25 m wide at the trunnion end and 0.14–0.21 m along the folded leg) that runs from the trunnion at the lower corner aft and inboard along the folded leg and widens at its aft end, where a shallow blister lies over the folded wheel, and it hinges on its straight inboard edge. The leg folds about a single fixed axis chosen so that leg and wheel come up through this one door, past it as it hangs open, with the wheel ending just above the blister. That fold rolls the wheel about 50° on the way up, so the door’s aft end here is about 0.4 m wide and wraps round the lower corner, wider than it looks in the photographs (perhaps 0.2–0.25 m). With the leg geometry seen in the photographs, no single fixed axis that folds the leg into the well gets the wheel through less than about 0.3 m, so the real gear may turn its wheel as it folds (hinge line, opening angle and widths estimated).',
    }, mainDoor.pivot);
    doors.push({ h: mainDoor, sign: -side, open: 2.0 });
    doors.push({ h: doorPart(`Nose gear door (${sd})`, 1.92, 3.125, -Math.PI / 2 + 0.002 * side, -Math.PI / 2 + 0.42 * side, 'outer', {
      mass: 1.5, explode: [0, -0.55, 0.35 * side], desc: 'One of a pair of nose-gear doors hinged along the outer edge of the well, linked to open with the leg.',
    }), sign: side, open: 1.45 });
    // door actuator: from a bracket on the keel web down to the horn on the door's hinge line
    const act = makeActuator(0.016, 0.009, 0.1, m.darkMetal);
    const anchor = new THREE.Vector3(X(DOOR_ACT[0]), DOOR_ACT[1], DOOR_ACT[2] * side);
    const lugClosed = hornTip;
    const p0 = mainDoor.pivot.position.clone();
    P(`Main gear door actuator (${sd})`, {
      system: 'Landing gear', material: 'Small linear actuator (est.)', mass: 1, explode: [0, -0.2, 0.45 * side],
      desc: 'An electric linear actuator from a bracket on the keel web, just ahead of the folded wheel, to a short horn on the door’s hinge line: pulling the horn up swings the door down and open before the leg moves, and pushing it shuts the door once the leg is up (position and type estimated).',
    }, act.meshes);
    movers.push(() => act.set(anchor, lugClosed.clone().sub(p0).applyQuaternion(mainDoor.pivot.quaternion).add(p0)));
  }

  // ============================================================== sensors
  // MTS-B EO/IR turret under the nose
  const turret = new THREE.Group();
  turret.position.set(X(1.08), 0.995, 0);
  const tAz = new THREE.Group();
  turret.add(tAz);
  tAz.add(L(merge([new THREE.CylinderGeometry(0.19, 0.19, 0.06, 28).translate(0, -0.03, 0), new THREE.CylinderGeometry(0.17, 0.19, 0.1, 28).translate(0, -0.1, 0)]), m.turret));
  const tEl = new THREE.Group();
  tEl.position.y = -0.36;
  tAz.add(tEl);
  tEl.add(L(new THREE.SphereGeometry(0.27, 40, 28), m.turret));
  const win = [];
  // apertures on the ball face (layout approximate): IR camera, daylight TV, image-intensified TV, laser rangefinder/designator, laser illuminator
  const onBall = (y, z, r, lift = 0.002) => {
    const n = new THREE.Vector3(Math.sqrt(Math.max(0, 0.27 * 0.27 - y * y - z * z)), y, z).normalize();
    return new THREE.CircleGeometry(r, 24).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)).translate(n.x * (0.27 + lift), n.y * (0.27 + lift), n.z * (0.27 + lift));
  };
  for (const [y, z, r] of [[0.07, 0.07, 0.085], [-0.06, 0.1, 0.055], [0.08, -0.12, 0.045], [-0.07, -0.06, 0.035], [-0.14, 0.02, 0.025]]) win.push(onBall(y, z, r));
  tEl.add(L(merge(win), m.glass, { cast: false }));
  const laserDot = L(onBall(-0.07, -0.06, 0.018, 0.004), m.laser, { cast: false });
  tEl.add(laserDot);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2a36, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.02, 40, 6, 1, true).translate(0, 20, 0).rotateZ(-Math.PI / 2), beamMat);
  beam.position.set(0.27, -0.07, -0.06);
  beam.userData.fx = true;
  beam.raycast = () => {};
  tEl.add(beam);
  P('MTS-B EO/IR turret', {
    system: 'Sensors', material: 'Gyro-stabilised gimbal, germanium and sapphire windows', mass: 105, explode: [0.9, -0.75, 0],
    desc: 'Raytheon’s Multi-Spectral Targeting System B: an infrared camera, a colour/monochrome daylight TV camera, an image-intensified (low-light) TV camera, a laser rangefinder/designator and a laser illuminator in one stabilised ball (USAF fact sheet), about 0.55 m across (size and mass estimated).',
    callout: true, anchor: [X(1.08) + 0.038, 0.752, 0.24],   // the starboard side of the ball, just above its equator
  }, turret);
  P('MTS-B electronics unit', {
    system: 'Sensors', material: 'Electronics unit', mass: 15, explode: [0.55, 0.3, 0.75],
    desc: 'Processes the turret’s video, drives the gimbal and fires the laser; the turret and this unit are bought and upgraded as a pair (location estimated).',
  }, L(lru(0.6, 0.17, 0.12, [X(2.4), 1.255, 0.26]), m.lruOlive));
  // Lynx SAR gimbal assembly, radar electronics and cables: see mq9/sensors.js
  const lynxG = buildLynx({ P, L, m });
  // the camera hangs from a bracket under the forward edge of the Lynx deck and looks through a lens barrel to the window in the nose tip
  P('Pilot nose camera', {
    system: 'Sensors', material: 'Fixed colour camera on a bracket, lens barrel to an optical window in the nose tip (position approximate)', mass: 3, explode: [1.9, 0.2, 0],
    desc: 'A fixed forward-looking camera gives the remote pilot a view ahead for take-off and landing, the only phases flown on the short-delay line-of-sight link. It hangs from a bracket under the radar deck and looks out through a window in the very tip of the nose (position approximate).',
  }, [L(merge([lru(0.12, 0.08, 0.08, [X(0.16), 1.36, 0]), cylX(X(0.1), X(0.006), 0.022, 0.022, 1.356, 0, 14), box(0.23, 0.014, 0.07, [X(0.245), 1.407, 0])]), m.darkMetal),
    L(new THREE.CircleGeometry(0.032, 18).rotateY(Math.PI / 2).translate(X(0.0) - 0.003, 1.355, 0), m.glass, { cast: false })]);
  const pitot = [];
  for (const zs of [1, -1]) {
    const base = fusePoint(0.62, zs > 0 ? -0.32 : Math.PI + 0.32);
    pitot.push(tubeBetween(base, [base[0] + 0.02, base[1] - 0.06, base[2] + 0.06 * zs], 0.012, 8));
    pitot.push(tubeBetween([base[0] + 0.02, base[1] - 0.06, base[2] + 0.06 * zs], [base[0] + 0.3, base[1] - 0.06, base[2] + 0.06 * zs], 0.007, 8));
  }
  P('Pitot-static probes', {
    system: 'Sensors', material: 'Heated stainless probes (position approximate)', mass: 1, count: 2, explode: [1.2, -0.3, 0],
    desc: 'Measure total and static pressure for airspeed and altitude. Two independent probes feed the redundant air-data system so one blocked probe cannot mislead the autopilot.',
  }, L(merge(pitot), m.pipe));

  const oatBase = fusePoint(3.0, -0.9);
  P('Outside air temperature probe', {
    system: 'Sensors', material: 'Platinum resistance probe in a vented housing (position approximate)', mass: 0.3, explode: [0.6, -0.4, 0.6],
    desc: 'Measures the outside air temperature, which the air data computer needs to turn indicated airspeed into true airspeed and to warn of icing conditions (position approximate).',
  }, L(merge([tubeBetween(oatBase, [oatBase[0] - 0.02, oatBase[1] - 0.06, oatBase[2] + 0.03], 0.009, 8), cylX(oatBase[0] - 0.05, oatBase[0] + 0.01, 0.012, 0.012, oatBase[1] - 0.06, oatBase[2] + 0.03, 8)]), m.pipe));

  // ============================================================== communications
  const MODEM = [X(1.7), NFLOOR + 0.107, -0.17], ADC = [X(1.7), NFLOOR + 0.067, 0.18], IFFP = [X(2.64), NFLOOR + 0.067, 0], CBAND = [X(3.26), NFLOOR + 0.117, -0.13];
  const dishG = new THREE.Group();
  dishG.position.set(X(1.15), 1.58, 0);
  const dishAz = new THREE.Group();
  dishG.add(dishAz);
  const dishTilt = new THREE.Group();
  dishTilt.rotation.z = -0.62;
  dishAz.add(dishTilt);
  const para = lathe(Array.from({ length: 10 }, (_, i) => { const r = 0.012 + (i / 9) * 0.355; return [r, (r * r) / 1.2]; }), 40);
  dishTilt.add(L(para, m.dish));
  dishTilt.add(L(merge([
    new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16).translate(0, 0.3, 0),
    tubeBetween([0.3, 0.075, 0], [0, 0.3, 0], 0.006, 5), tubeBetween([-0.15, 0.075, 0.26], [0, 0.3, 0], 0.006, 5), tubeBetween([-0.15, 0.075, -0.26], [0, 0.3, 0], 0.006, 5),
    new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16).translate(0, -0.04, 0),
  ]), m.darkMetal));
  dishG.add(L(merge([new THREE.CylinderGeometry(0.03, 0.05, 0.42, 12).translate(0, -0.24, 0), new THREE.CylinderGeometry(0.12, 0.12, 0.09, 20).translate(0, -0.455, 0)]), m.darkMetal));   // the pedestal stands on the ballast tray
  P('Ku-band SATCOM antenna', {
    system: 'Communications', material: 'Steerable reflector on a two-axis pedestal', mass: 30, explode: [1.45, 2.05, 0],
    desc: 'Tracks a geostationary satellite to carry control and sensor video beyond line of sight. The satellite hops alone add about half a second of delay (up to geostationary orbit and back twice, 4 × 35,786 km ÷ c ≈ 0.48 s); with the ground relays the control loop takes over a second, so crews in the US can fly aircraft overseas, but not land them.',
    callout: true, anchor: [X(1.15) + 0.18, 1.832, -0.045],   // the upper rim of the dish
  }, dishG);
  P('Ku-band SATCOM modem', {
    system: 'Communications', material: 'Modem and RF unit', mass: 8, explode: [1.0, 1.0, -0.4],
    desc: 'Encodes the command uplink and the high-rate sensor downlink for the satellite channel, next to the dish to keep the RF runs short (location estimated).',
  }, L(lru(0.3, 0.2, 0.28, MODEM), m.lru));
  P('Air data computer', {
    system: 'Avionics', material: 'Air data computer', mass: 3, explode: [1.0, 0.95, 0.45],
    desc: 'Turns the pitot and static pressures into airspeed, altitude and vertical speed for the flight computers.',
  }, L(lru(0.24, 0.12, 0.2, ADC), m.lru));
  P('Mission control module (payload computer)', {
    system: 'Avionics', material: 'Payload and weapons computer', mass: 9, explode: [0.75, 0.9, 0.55],
    desc: 'GA-ASI’s Block 5 has a separate payload computer, the Mission Control Module, which manages the sensors, weapons and data links apart from the flight-critical computers, so a payload fault cannot affect control.',
  }, L(lru(0.42, 0.2, 0.14, [X(2.175), NFLOOR + 0.107, 0.24]), m.lru));
  P('Embedded GPS/INS', {
    system: 'Avionics', material: 'Ring-laser-gyro inertial units with GPS receivers', mass: 10, count: 2, explode: [0.55, 1.0, 0],
    desc: 'Embedded GPS/inertial units give position, velocity and attitude (two shown; the count is estimated). The inertial half keeps navigating if GPS is jammed; the GPS half stops the inertial drift.',
  }, L(merge([lru(0.28, 0.16, 0.18, [X(2.64), NFLOOR + 0.087, 0.2]), lru(0.28, 0.16, 0.18, [X(2.64), NFLOOR + 0.087, -0.2])]), m.lru));
  P('IFF transponder', {
    system: 'Communications', material: 'Identification friend-or-foe / ATC transponder', mass: 4, explode: [0.45, 1.15, 0],
    desc: 'Answers air-traffic and military interrogations with the aircraft’s identity and altitude, the same as a crewed aircraft in controlled airspace.',
  }, L(lru(0.26, 0.12, 0.13, IFFP), m.lru));
  P('C-band datalink transceiver', {
    system: 'Communications', material: 'Line-of-sight datalink radio', mass: 10, explode: [0.3, 1.0, -0.55],
    desc: 'The line-of-sight C-band link used by the launch-and-recovery crew at the airfield: short delay for hand-flown take-offs and landings, but only to the radio horizon.',
  }, L(lru(0.26, 0.22, 0.22, CBAND), m.lru));
  P('ARC-210 V/UHF radios', {
    system: 'Communications', material: 'Two software-defined VHF/UHF radios', mass: 11, count: 2, explode: [0.3, 1.05, 0.55],
    desc: 'Two ARC-210 radios relay voice between the crew and air-traffic control or troops on the ground, through the wingtip antennas (Block 5 fit).',
  }, L(merge([lru(0.26, 0.12, 0.16, [X(3.26), NFLOOR + 0.067, 0.14]), lru(0.26, 0.12, 0.16, [X(3.26), NFLOOR + 0.192, 0.14])]), m.lruOlive));
  const cband = [bladeAntenna(0.2, 0.24).translate(X(2.5), prof(2.5).top - 0.01, 0), bladeAntenna(0.18, 0.22).rotateX(Math.PI).translate(X(3.3), prof(3.3).bot + 0.01, 0)];
  P('C-band LOS antennas', {
    system: 'Communications', material: 'Blade antennas (positions approximate)', mass: 2, count: 2, explode: [0.4, 0.5, 0],
    desc: 'Upper and lower blades so the line-of-sight link keeps contact whichever way the aircraft banks near the airfield.',
  }, L(merge(cband), m.dark));
  const gps = [3.0, 5.05].map((s) => lru(0.12, 0.025, 0.12, [X(s), prof(s).top + 0.005, 0], 0.04));
  P('GPS antennas', {
    system: 'Communications', material: 'Patch antennas', mass: 1, count: 2, explode: [0, 1.95, 0],
    desc: 'Top-mounted patch antennas see the sky for the two GPS receivers; anti-jam antennas can replace them (positions estimated).',
  }, L(merge(gps), M.offWhite()));
  const iff = [bladeAntenna(0.12, 0.14).translate(X(6.6), prof(6.6).top - 0.01, 0), bladeAntenna(0.11, 0.13).rotateX(Math.PI).translate(X(6.9), prof(6.9).bot + 0.01, 0)];
  P('IFF antennas', {
    system: 'Communications', material: 'Small blade antennas', mass: 1, count: 2, explode: [0, 1.0, 0],
    desc: 'Upper and lower transponder antennas so interrogators above and below can always reach the IFF set.',
  }, L(merge(iff), m.dark));
  // pitot, static, OAT and AoA lines to the air data computer; antenna cables; Iridium; ELT (mq9/sensors.js)
  buildAirData({ P, L, m }, ADC);
  buildLinks({ P, L, m }, { modem: MODEM, cband: CBAND, egi: [[X(2.64), NFLOOR + 0.087, 0.2], [X(2.64), NFLOOR + 0.087, -0.2]], iff: IFFP, floor: NFLOOR });
  const ball = [box(0.27, 0.008, 0.33, [X(1.105), 1.034, 0])];          // s 0.97–1.24, ending just ahead of the radar electronics
  for (let k = 0; k < 3; k++) ball.push(box(0.23, 0.0115, 0.28, [X(1.105), 1.044 + k * 0.012, 0]));
  for (const dx of [-0.1, 0.1]) for (const dz of [-0.11, 0.11]) ball.push(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6).translate(X(1.105) + dx, 1.06, dz));
  P('Nose ballast', {
    system: 'Structure', material: 'Lead plates bolted to the forward-bay floor (mass and size estimated)', mass: 36, count: 3, explode: [0.55, -0.85, 0],
    desc: 'Lead plates on the floor of the forward bay, under the SATCOM pedestal. With the 175 kg engine and the propeller at the tail, ballast in the nose keeps the centre of gravity ahead of the main wheels, and plates come and go as sensor fits change. The NTSB found “ballast from the forward fuselage bay” beyond the 2006 wreckage.',
  }, L(merge(ball), m.lead));

  // ============================================================== electrical
  // the starter-generator and backup generator are on the engine's accessory pads (mq9/propulsion.js);
  // the power electronics sit in the accessory bay between the aft fuel cell and the firewall
  role(P('Main batteries', {
    system: 'Electrical', material: 'Sealed rechargeable batteries (est.)', mass: 28, count: 2, explode: [0.3, -0.6, 0.45],
    desc: 'Run the flight-critical systems if the generators fail and power the avionics before engine start. They last only as long as the load is kept down: when the engine stopped in 2006 the Predator B shed the transponder and the Iridium link to stretch battery life, and in December 2014 an MQ-9 ran its batteries too low to lower the landing gear after a generator failure (type and capacity not published).',
  }, L(merge([lru(0.24, 0.17, 0.16, [X(3.26), 1.21, 0.18]), lru(0.24, 0.17, 0.16, [X(3.26), 1.21, -0.18])]), m.lruOlive)), 'battery');
  const PDU_S = 7.6, GCU_S = 7.95;
  P('Power distribution units', {
    system: 'Electrical', material: 'Solid-state power controllers', mass: 12, count: 2, explode: [0, 0.8, 0.6],
    desc: 'Switch and protect each electrical load, one unit per bus (flight data logs record “Bus 1” voltage), and shed non-essential loads automatically when a generator drops out. The Block 5 adds a redundant flight-critical bus fed by the backup generator.',
  }, L(merge([lru(0.22, 0.14, 0.16, [X(PDU_S), 1.62, 0.2]), lru(0.22, 0.14, 0.16, [X(PDU_S), 1.62, -0.2])]), m.lru));
  // harness runs, each its own part so a student can follow power and data from source to load
  const topRun = (s0, s1, side, inset = 0.02, step = 0.25) => { const pts = []; for (let q = s0; q <= s1 + 1e-6; q += step) pts.push(fusePoint(q, Math.PI / 2 - 0.5 * side, inset)); return pts; };
  const avh = [];
  for (const zs of [1, -1]) {
    avh.push(pipe(topRun(1.49, 3.45, zs), 0.012, 6, 60));
    // down the side just aft of the dish's sweep and ahead of the floor racks, outboard of the air data lines, to the radar bay
    avh.push(pipe([fusePoint(1.49, Math.PI / 2 - 0.5 * zs, 0.02), [X(1.5), 1.62, 0.335 * zs], [X(1.52), 1.43, 0.335 * zs], [X(1.545), 1.33, 0.28 * zs], [X(1.55), 1.3, 0.25 * zs]], 0.009, 5, 24));
    // drops to each rack: the outer and inner computers, the GPS/INS units, and the radios or the datalink transceiver
    for (const [q, y, z] of [[2.175, NFLOOR + 0.21, 0.24], [2.175, NFLOOR + 0.21, 0.08], [2.64, NFLOOR + 0.17, 0.2], zs > 0 ? [3.26, NFLOOR + 0.25, 0.14] : [3.26, NFLOOR + 0.226, 0.13]]) avh.push(tubeBetween(fusePoint(q, Math.PI / 2 - 0.5 * zs, 0.02), [X(q), y, z * zs], 0.007, 5));
    avh.push(pipe([fusePoint(3.35, Math.PI / 2 - 0.5 * zs, 0.02), [X(3.36), 1.6, 0.33 * zs], [X(3.34), 1.3, 0.25 * zs]], 0.009, 5, 16));
  }
  avh.push(pipe([[X(1.55), 1.3, -0.25], [X(1.25), 1.15, -0.24], [X(1.1), 1.045, -0.195], [X(1.08), 1.002, -0.18]], 0.009, 5, 16));   // past the ballast to the turret's slip ring
  // starboard: on aft from the radar drop to the MTS-B electronics unit, and the unit's gimbal and video cable forward to the turret
  avh.push(pipe([[X(1.55), 1.3, 0.25], [X(1.8), 1.285, 0.262], [X(2.098), 1.27, 0.262]], 0.009, 5, 16));
  avh.push(pipe([[X(2.098), 1.215, 0.25], [X(1.85), 1.19, 0.235], [X(1.4), 1.115, 0.222], [X(1.15), 1.04, 0.2], [X(1.08), 1.002, 0.18]], 0.008, 5, 30));
  avh.push(tubeBetween(fusePoint(1.7, Math.PI / 2 + 0.5, 0.02), [X(1.7), NFLOOR + 0.212, -0.2], 0.007, 5));            // SATCOM modem
  avh.push(pipe([fusePoint(3.3, Math.PI / 2 - 0.5, 0.02), [X(3.3), 1.64, 0.236], [X(3.3), 1.56, 0.226]], 0.006, 5, 12));   // the lower of the two ARC-210s
  avh.push(tubeBetween(fusePoint(2.92, Math.PI / 2 - 0.5, 0.02), [X(2.92), NFLOOR + 0.092, 0.11], 0.006, 5));          // Iridium transceiver
  // lower anti-collision beacon: from the starboard battery drop, aft past the battery and down under the forward cell to the light's base
  avh.push(pipe([[X(3.34), 1.3, 0.25], [X(3.4), 1.22, 0.27], [X(3.45), 1.1, 0.24], [X(3.55), 1.03, 0.12], [X(3.68), 1.012, 0.02], [X(3.7), prof(3.7).bot + 0.004, 0]], 0.006, 5, 30));
  avh.push(pipe([fusePoint(2.41, Math.PI / 2 + 0.5, 0.02), [X(2.41), 1.6, -0.34], [X(2.41), 1.45, -0.33], [X(2.41), 1.31, -0.27], [X(2.41), 1.279, -0.256]], 0.006, 5, 20));   // down behind the flight computers and through the floor to the cooling fan
  avh.push(pipe([[X(1.5), 1.57, -0.334], [X(1.35), 1.5, -0.34], [X(1.1), 1.43, -0.33], [X(0.95), 1.45, -0.33], [X(0.75), 1.47, -0.3], [X(0.45), 1.47, -0.22], [X(0.28), 1.43, -0.09], [X(0.222), 1.37, -0.01]], 0.006, 5, 44));   // from the port drop, forward over the radar deck to the nose camera
  P('Avionics bay harness', {
    system: 'Electrical', material: 'Shielded copper harness and data buses (est.)', mass: 18, xrayWeight: 0.5, explode: [0.3, 1.25, 0],
    desc: 'Runs along both sides of the avionics bay roof, dropping to each rack, the SATCOM modem, the Iridium set, the batteries, the radar, the MTS-B electronics unit and its turret, the cooling fan, the lower anti-collision beacon and, forward over the radar deck, the pilot’s nose camera. Port and starboard runs are kept apart so one chafed bundle cannot take out both channels (routing estimated).',
  }, L(merge(avh), m.harness));
  const feeders = [];
  for (const zs of [1, -1]) feeders.push(pipe([...topRun(3.45, 7.2, zs), [X(7.42), 1.74, 0.22 * zs], [X(PDU_S), 1.7, 0.2 * zs]], 0.012, 6, 80));
  // the upper anti-collision beacon's lead, over the IFF and Iridium coax to the light's base on the spine
  feeders.push(pipe([fusePoint(5.85, Math.PI / 2 - 0.5, 0.02), fusePoint(5.85, Math.PI / 2 - 0.22, 0.022), [X(5.85), prof(5.85).top - 0.018, 0.02], [X(5.85), prof(5.85).top - 0.004, 0]], 0.006, 5, 16));
  P('Main power feeders', {
    system: 'Electrical', material: 'Heavy-gauge power cables (est.)', mass: 16, count: 2, xrayWeight: 0.5, explode: [0, 1.45, 0],
    desc: 'Two independent power feeders from the distribution units, over the fuel cells and the gear wells to the avionics bay, one per bus, so a single chafed cable cannot take both buses down; a lead from the starboard one feeds the upper anti-collision beacon (routing estimated).',
  }, L(merge(feeders), m.harness));
  const sideRun = (s0, s1, th, inset = 0.04) => { const pts = []; for (let q = s0; q <= s1 + 1e-6; q += 0.2) pts.push(fusePoint(q, th, inset)); return pts; };
  const SG = [prop.sgBox[0], prop.sgBox[1] + 0.006, prop.sgBox[2] + 0.025];   // starter-generator terminal box, outboard face
  const ebh = [
    // starboard: PDU → DEEC → through the firewall → starter-generator, torque pickup and servos
    pipe([[X(PDU_S) - 0.11, 1.62, 0.2], ...sideRun(7.9, 8.7, 0.3), [X(8.75), 1.74, 0.23], ...sideRun(8.9, 9.3, 0.15), [X(9.45), 1.585, 0.262], [X(9.56), 1.53, 0.265], [X(9.63), 1.49, 0.268], SG], 0.012, 6, 80),

    pipe([fusePoint(8.5, 0.3, 0.04), [X(8.62), 1.8, 0.2], [X(8.7), 1.818, 0.1], [X(8.74), 1.82, 0.054]], 0.007, 5, 16),        // to the middle control servo's side
    pipe([fusePoint(9.3, 0.15, 0.04), [X(9.7), 1.84, 0.25], [X(9.84), ENGINE_Y + 0.17, 0.17]], 0.006, 5, 16),
    // port: GCU → ESM → through the firewall → exciter, backup generator, oil sensors and the other pickup
    pipe([[X(GCU_S) - 0.09, 1.61, -0.2], [X(8.05), 1.66, -0.26], ...sideRun(8.1, 8.7, Math.PI - 0.3), [X(8.75), 1.72, -0.22], ...sideRun(8.9, 9.1, Math.PI - 0.12), [X(9.2), 1.68, -0.305], [X(9.26), 1.6, -0.3], [X(9.29), 1.57, -0.28],
      [X(9.42), 1.56, -0.265], [X(9.52), 1.525, -0.235], [X(9.6), 1.48, -0.225], [X(9.648), 1.466, -0.216]], 0.011, 6, 80),   // to the backup generator's terminal box
    tubeBetween([X(9.36), 1.562, -0.262], [X(9.36), 1.609, -0.26], 0.006, 5),                                                        // up to the ignition exciter
    pipe([fusePoint(9.25, Math.PI - 0.12, 0.04), [X(9.7), 1.72, -0.29], [X(9.98), ENGINE_Y - 0.05, -0.292], [X(9.996), ENGINE_Y - 0.05, -0.29]], 0.006, 5, 20),   // oil pressure transmitter
    pipe([[X(9.996), ENGINE_Y - 0.05, -0.29], [X(10.03), ENGINE_Y - 0.1, -0.282], [X(10.058), ENGINE_Y - 0.13, -0.272]], 0.005, 5, 10),                      // and the oil temperature bulb
    pipe([fusePoint(9.25, Math.PI - 0.12, 0.04), [X(9.55), 1.86, -0.24], [X(9.84), ENGINE_Y + 0.17, -0.17]], 0.006, 5, 16),
    // the start module and the engine control, each a short drop from its side's run to the unit's outboard face
    pipe([fusePoint(8.66, Math.PI - 0.3, 0.04), [X(8.66), 1.7, -0.3], [X(8.66), 1.625, -0.284]], 0.006, 5, 10),
    pipe([fusePoint(8.66, 0.3, 0.04), [X(8.66), 1.72, 0.302], [X(8.66), 1.68, 0.299]], 0.006, 5, 10),
    // the chip detector on the gearbox sump, from the backup generator's terminal box forward of the generator, and the tachometer-generator
    pipe([[X(9.648), 1.466, -0.216], [X(9.585), 1.47, -0.2], [X(9.58), 1.47, -0.09], [X(9.662), 1.452, -0.066]], 0.005, 5, 16),
    pipe([[X(9.58), 1.47, -0.09], [X(9.6), 1.465, -0.02], [X(9.672), 1.45, 0.03], [X(9.688), 1.44, 0.03]], 0.005, 5, 14),            // and on, under the engine, to the tachometer-generator
    // the NTS valve and the beta-pressure switch on the gearbox's aft face: up the starboard side between the gearbox and the
    // cowling, round the face behind the housing, and across under the output shaft to the switch
    pipe([[X(9.45), 1.585, 0.262], [X(9.52), 1.7, 0.288], [X(9.85), 1.725, 0.29], [X(10.15), 1.72, 0.285], [X(10.232), 1.665, 0.22], [X(10.232), 1.615, 0.178]], 0.006, 5, 30),
    pipe([[X(10.235), 1.578, 0.15], [X(10.235), 1.56, 0.0], [X(10.235), 1.578, -0.15]], 0.005, 5, 12),
  ];
  P('Engine bay harness', {
    system: 'Electrical', material: 'Fire-resistant harness (est.)', mass: 8, xrayWeight: 0.5, explode: [0, 0.55, -1.0],
    desc: 'Carries power and signals from the distribution units and the generator control unit to the engine control, the start module and the control servos, then through the firewall to the starter-generator, the backup generator’s terminal box, the igniter exciter, the tachometer-generator, the torque pickups, the oil pressure and temperature sensors, the chip detector and, round the gearbox to its aft face, the NTS valve and beta-pressure switch, in fire-resistant sleeving because it runs beside the hot section (routing estimated).',
  }, L(merge(ebh), m.harness));
  const finServo = [X(8.3) - 0.64, 1.28 - 0.14, 0];
  const th = [];
  for (const [k, zs] of [[0, 1], [1, -1]]) {
    const sv = rvServoAt[k];
    th.push(pipe([fusePoint(8.3, Math.PI / 2 - 0.75 * zs, 0.04), fusePoint(8.62, Math.PI / 2 - 0.66 * zs, 0.065), [X(8.78), 1.922, 0.205 * zs], [X(8.95), 1.975, 0.16 * zs], [sv.x + 0.08, sv.y - 0.04, sv.z - 0.02 * zs], [sv.x, sv.y, sv.z]], 0.008, 5, 30));
  }
  th.push(pipe([fusePoint(8.3, Math.PI - 0.3, 0.052), fusePoint(8.36, Math.PI - 0.02, 0.04), fusePoint(8.45, Math.PI + 0.3, 0.04), fusePoint(8.6, -Math.PI + 0.9, 0.04), [X(8.8), prof(8.8).bot + 0.05, -0.03], [finServo[0] + 0.05, prof(8.9).bot + 0.01, 0], finServo], 0.007, 5, 24));
  P('Tail harness', {
    system: 'Electrical', material: 'Shielded harness (est.)', mass: 3, xrayWeight: 0.5, explode: [-0.6, 0.6, 0],
    desc: 'Power and command signals for the two ruddervator servos in the tail roots and the ventral rudder servo in the fin; the fin branch leaves the port engine-bay harness run in the accessory bay and runs down the side and along the keel into the fin root (routing estimated).',
  }, L(merge(th), m.harness));
  // fuel system electrics: from the starboard distribution unit aft under the shelf to the forward fuel heater and the FSOV; from the port
  // one forward over the aft cell and down the keel channel between the gear wells to the selector solenoids, both header pumps and the dump valve
  const fsh = [
    pipe([[X(7.6), 1.6, 0.282], [X(7.6), 1.54, 0.305], [X(7.63), 1.485, 0.25], [X(7.7), 1.48, 0.21], [X(8.5), 1.48, 0.2], [X(8.85), 1.482, 0.2], [X(8.898), 1.48, 0.2]], 0.007, 5, 40),
    pipe([[X(7.65), 1.481, 0.215], [X(7.58), 1.44, 0.18], [X(7.555), 1.408, 0.17]], 0.006, 5, 10),
    pipe([[X(7.55), 1.692, -0.17], [X(7.4), 1.74, -0.15], ...[7.2, 7.05, 6.6, 6.0, 5.6].map((q) => fusePoint(q, Math.PI / 2 + 0.3, 0.065)), [X(5.35), 1.752, -0.07],
      [X(5.278), 1.66, -0.022], [X(5.275), 1.4, -0.022], [X(5.2), 1.252, -0.022], [X(5.0), 1.25, -0.022], [X(4.88), 1.245, -0.02]], 0.007, 5, 90),
    pipe([[X(4.88), 1.245, -0.02], [X(4.845), 1.2, -0.04], [X(4.836), 1.16, -0.06]], 0.005, 5, 10),
  ];
  // the pumps and the dump valve sit inside the header cell; the harness ends at their sealed fittings in the cell's aft wall
  const hdrWall = fuel.pumpY + 0.065;
  for (const zs of [1, -1]) fsh.push(pipe([[X(4.88), 1.245, -0.02], [X(4.84), 1.21, 0.1 * zs], [X(4.8), 1.18, 0.16 * zs], [X(4.765), hdrWall + 0.005, 0.19 * zs], [X(4.752), hdrWall, 0.19 * zs]], 0.005, 5, 20));
  fsh.push(pipe([[X(4.8), 1.18, -0.16], [X(4.768), fuel.pumpY + 0.09, -0.125], [X(4.752), fuel.pumpY + 0.092, -0.09]], 0.004, 5, 10));
  // fuel quantity probes (fuel.js places them): the aft cell's from the port run over the cell; the header's from the keel channel
  // through a fitting high in the cell's aft wall; the forward cell's from the starboard power feeder overhead; and in each wing a
  // lead from the wing wiring through a sealed fitting in the rear spar to each probe's head
  fsh.push(pipe([fusePoint(7.05, Math.PI / 2 + 0.3, 0.065), [X(7.05), 1.75, -0.108], [X(7.05), 1.735, -0.1]], 0.005, 5, 10));
  fsh.push(pipe([[X(5.276), 1.48, -0.022], [X(5.1), 1.48, -0.022], [X(4.9), 1.478, -0.025], [X(4.8), 1.475, -0.07], [X(4.75), 1.476, -0.12], [X(4.5), 1.48, -0.12], [X(4.313), 1.485, -0.12]], 0.005, 5, 30));
  fsh.push(pipe([fusePoint(3.85, Math.PI / 2 - 0.5, 0.034), [X(3.85), 1.77, 0.17], [X(3.85), 1.736, 0.122]], 0.005, 5, 10));   // from the starboard feeder's surface
  for (const zs of [1, -1]) for (const z of [1.6, 3.4, 6.4]) {
    const pts = [wpt(z - 0.1, 0.705, 0), wpt(z - 0.06, 0.64, 1, 0.032), wpt(z - 0.02, 0.47, 1, 0.032), wpt(z - 0.011, 0.42, 1, 0.035)];
    fsh.push(pipe(pts.map((p) => [p[0], p[1], p[2] * zs]), 0.004, 5, 16));
  }
  P('Fuel system harness', {
    system: 'Electrical', material: 'Shielded harness, kept apart from the fuel lines it runs beside (est.)', mass: 2, xrayWeight: 0.5, explode: [0, 0.3, 1.25],
    desc: 'Powers the fuel system’s electrical units from the distribution units: aft under the equipment shelf to the forward fuel heater and the electrical shutoff valve at the firewall, and forward over the aft cell and down the keel channel between the gear wells to the six selector solenoids and to sealed fittings in the header cell’s aft wall for both header pumps and the dump valve inside it. Low-energy leads reach every fuel quantity probe: over the aft cell, through the header’s aft wall, down from the starboard feeder to the forward cell, and in each wing from the wing wiring through the rear spar. A fault on this circuit can starve the engine: in 2025 a chafed wire inside a fuel control fired the shutoff valve shut in flight and the aircraft was lost (USAF investigation; routing estimated).',
  }, L(merge(fsh), m.harness));
  P('Generator control unit', {
    system: 'Electrical', material: 'Voltage regulator and protection unit (est.)', mass: 4, explode: [0, 0.75, -0.75],
    desc: 'Regulates the starter-generator’s output and trips it off line if it misbehaves, so the distribution units can shed load and keep the flight-critical bus alive on the backup generator and batteries. In a 2015 loss the generator’s current fell from 156 A to zero before the batteries ran down (USAF investigation; position estimated).',
  }, L(lru(0.18, 0.12, 0.14, [X(GCU_S), 1.61, -0.2]), m.lru));
  const rack = [box(1.55, 0.01, 0.56, [X(8.125), 1.541, 0])];
  for (const zs of [1, -1]) rack.push(box(1.55, 0.03, 0.025, [X(8.125), 1.522, 0.27 * zs]), ...[7.4, 8.1, 8.87].map((q) => tubeBetween([X(q), 1.515, 0.27 * zs], fusePoint(q, zs > 0 ? -0.22 : Math.PI + 0.22, 0.02), 0.009, 6)));
  P('Accessory bay equipment rack', {
    system: 'Structure', material: 'Aluminium shelf on rails and side braces (layout estimated)', mass: 4, explode: [0, 0.35, 0],
    desc: 'The NTSB names five fuselage bays on the Predator B: avionics, fuel, accessory, landing gear and engine. This shelf in the accessory bay, between the aft fuel cell and the firewall and braced to the side frames, carries the power distribution units, the generator control unit, the engine control (DEEC) and the engine start module, with the fuel heater, oil lines and ground-power socket below it (layout estimated).',
  }, L(merge(rack), m.primer));
  const GPR = [X(PDU_S), 1.335, -0.285];
  P('Ground power receptacle', {
    system: 'Electrical', material: 'External power socket behind a flush door, with its cable to the bus (position estimated)', mass: 1.5, explode: [0, -0.2, -0.75],
    desc: 'Where the ground crew plugs in external power so the avionics, and the TPE331’s 24 V electrics (16.2 A maximum, Honeywell), can run before start without draining the batteries. A heavy cable takes it up to the distribution unit (position estimated).',
  }, [L(merge([lru(0.1, 0.06, 0.06, GPR), pipe([[GPR[0], GPR[1] + 0.03, GPR[2] + 0.02], [GPR[0] - 0.02, 1.45, -0.25], [X(PDU_S), 1.55, -0.21]], 0.0075, 6, 12)]), m.darkMetal), L(skinPatch(PDU_S - 0.05, PDU_S + 0.05, Math.PI + 0.62, Math.PI + 0.82, 0.003, 2, 2), m.dark)]);
  const beaconTop = L(merge([lru(0.1, 0.02, 0.07, [X(5.85), prof(5.85).top + 0.005, 0], 0.02)]), m.darkMetal);
  const lensTop = L(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.9, 1).translate(X(5.85), prof(5.85).top + 0.015, 0), m.beacon, { cast: false });
  const beaconBot = L(merge([lru(0.1, 0.02, 0.07, [X(3.7), prof(3.7).bot - 0.005, 0], 0.02)]), m.darkMetal);
  const lensBot = L(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.2, 0.9, 1).translate(X(3.7), prof(3.7).bot - 0.015, 0), m.beacon, { cast: false });
  P('Anti-collision beacons', {
    system: 'Electrical', material: 'LED beacons', mass: 1, count: 2, explode: [0, 0.5, 0],
    desc: 'Beacons above and below the fuselage make the aircraft visible to other traffic from any angle, as required in civil airspace (positions and colour approximate).',
  }, [beaconTop, lensTop, beaconBot, lensBot]);

  // ============================================================== environmental control
  P('Avionics cooling inlet', {
    system: 'Environmental control', skin: true, material: 'Flush ram-air inlet (position approximate)', mass: 1, explode: [0.35, -0.45, -0.95],
    desc: 'A flush inlet on the lower port side of the avionics bay takes in ram air for cooling; a flush shape adds almost no drag.',
  }, [L(skinPatch(2.1, 2.36, Math.PI + 0.48, Math.PI + 0.62, 0.003, 2, 2), m.intake), L(pipe([[X(2.15), 1.19, -0.34], [X(2.22), 1.21, -0.3], [X(2.27), 1.22, -0.26]], 0.03, 8, 12), m.alu)]);
  P('Avionics cooling fan', {
    system: 'Environmental control', material: 'Electric axial fan (est.)', mass: 3, explode: [0.35, -0.65, -0.7],
    desc: 'Pulls air through the bay on the ground, where there is no ram air; on a hot ramp it is what keeps the electronics inside their temperature limits (size estimated).',
  }, L(merge([cylX(X(2.45), X(2.25), 0.06, 0.06, 1.22, -0.255, 18), cylX(X(2.4), X(2.3), 0.035, 0.035, 1.22, -0.255, 12),
    ...[0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return box(0.012, 0.027, 0.006, [X(2.35), 1.22 + Math.cos(a) * 0.0475, -0.255 + Math.sin(a) * 0.0475], [a, 0, 0]); })]), m.alu));   // casing, motor hub, struts
  P('Avionics cooling ducts', {
    system: 'Environmental control', material: 'Aluminium and composite ducts (layout approximate)', mass: 4, explode: [0.55, -0.35, -0.55],
    desc: 'Duct the cooling air forward over the radar electronics’ finned, conduction-cooled side wall, up to the flight computers and aft to the C-band datalink transceiver. At altitude the air is cold but thin, so the ducts are sized for hot days on the ramp (layout approximate).',
  }, L(merge([
    pipe([[X(2.25), 1.22, -0.255], [X(2.0), 1.235, -0.255], [X(1.82), 1.215, -0.235], [X(1.72), 1.205, -0.2]], 0.033, 8, 24),   // forward past the well, blowing over the radar electronics' port cooling fins
    pipe([[X(2.15), 1.25, -0.27], [X(2.05), 1.36, -0.28], [X(2.0), 1.47, -0.25]], 0.025, 8, 12),
    pipe([[X(2.45), 1.22, -0.255], [X(2.6), 1.28, -0.27], [X(2.8), 1.36, -0.28], [X(2.88), 1.47, -0.285], [X(2.93), 1.56, -0.28], [X(3.05), 1.6, -0.225], [X(3.125), 1.61, -0.2]], 0.028, 8, 28),   // up through the floor to the C-band transceiver's front face
  ]), m.alu));
  const louvre = [skinPatch(2.9, 3.12, 0.3, 0.5, 0.003, 2, 3)];
  for (let k = 0; k < 4; k++) { const p = fusePoint(2.93 + k * 0.055, 0.4, -0.006); louvre.push(box(0.012, 0.012, 0.13, [p[0], p[1], p[2]], [0.35, 0, 0])); }
  P('Avionics cooling outlet', {
    system: 'Environmental control', skin: true, material: 'Louvred exhaust grille (position approximate)', mass: 0.5, explode: [0.3, 0.6, 0.9],
    desc: 'Warm air leaves the bay through a louvred grille on the upper starboard side, where the outside pressure is low enough to keep the air moving.',
  }, L(merge(louvre), m.dark));

  // ============================================================== skin details: access panels and fasteners
  const panelMat = m.skin.clone(); panelMat.color.multiplyScalar(0.93);
  /** Conformal access panel over s0..s1, th0..th1 with fastener heads at about `pitch` spacing along its edge. */
  const panel = (s0, s1, th0, th1, pitch = 0.075) => {
    const g = [skinPatch(s0, s1, th0, th1, 0.0025, 4, 4)];
    const pts = [];
    const ns = Math.max(2, Math.round((s1 - s0) / pitch));
    const len = Math.hypot(...[0, 1, 2].map((i) => fusePoint(s0, th1)[i] - fusePoint(s0, th0)[i]));
    const nt = Math.max(2, Math.round(len / pitch));
    for (let i = 0; i <= ns; i++) for (const t of [th0, th1]) pts.push([s0 + ((s1 - s0) * i) / ns, t]);
    for (let j = 1; j < nt; j++) for (const q of [s0, s1]) pts.push([q, th0 + ((th1 - th0) * j) / nt]);
    for (const [q, t] of pts) {
      const tt = t + (t === th0 ? 0.012 : t === th1 ? -0.012 : 0) * Math.sign(th1 - th0), qq = q + (q === s0 ? 0.012 : q === s1 ? -0.012 : 0);
      const a = new THREE.Vector3(...fusePoint(qq, tt, -0.003));
      const n = a.clone().sub(new THREE.Vector3(...fusePoint(qq, tt, 0.02))).normalize();
      g.push(new THREE.CylinderGeometry(0.0065, 0.0065, 0.002, 6).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yup, n)).translate(a.x, a.y, a.z));
    }
    return merge(g);
  };
  const avPanels = [], enPanels = [];
  for (const zs of [1, -1]) {
    const T = (t) => (zs > 0 ? t : Math.PI - t);
    avPanels.push(panel(1.95, 2.85, T(0.36), T(0.76)), panel(2.2, 3.1, T(-0.32), T(0.1)));
    enPanels.push(panel(9.08, 9.72, T(0.28), T(0.86)));
  }
  const lowPanel = panel(9.6, 10.2, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
  P('Avionics bay access panels', {
    system: 'Skin & fairings', skin: true, material: 'Removable composite panels on quarter-turn fasteners (layout estimated)', mass: 4, count: 4, xrayWeight: 0.6, explode: [0.3, 0.25, 1.6],
    desc: 'Removable panels on each side of the avionics bay: the upper ones open the racks above the floor, the lower ones the radar, turret and battery bay below it. Line units are swapped through them in minutes (layout and fastener count estimated).',
  }, L(merge(avPanels), panelMat));
  role(P('Engine bay access doors', {
    system: 'Skin & fairings', skin: true, material: 'Composite doors with titanium-faced edges (layout estimated)', mass: 4, count: 2, xrayWeight: 0.6, explode: [-0.2, 0.75, 1.6],
    desc: 'Upper engine access panels on both sides, between the V-tail roots and the exhaust stacks, for oil checks and inspections of the fuel control and accessories without removing the cowling. The NTSB found “the upper and lower engine access panels” still attached after the 2006 crash (layout estimated).',
  }, L(merge(enPanels), panelMat)), 'cowling');
  role(P('Lower engine access panel', {
    system: 'Skin & fairings', skin: true, material: 'Composite panel on quarter-turn fasteners (layout estimated)', mass: 2.5, xrayWeight: 0.6, explode: [-0.3, -1.2, 0.9],
    desc: 'A belly panel aft of the ventral fin that opens the lower engine bay: the accessory drive pads, starter-generator, oil filter and chip detector. The Seychelles investigation’s debris list included the “lower engine bay” (layout estimated).',
  }, L(lowPanel, panelMat)), 'cowling');

  // ============================================================== markings
  A.root.updateMatrixWorld(true);
  const firstMesh = (part) => { let r = null; part.traverse((o) => { if (!r && o.isMesh) r = o; }); return r; };
  const aftMesh = firstMesh(aftSkin), fwdMesh = firstMesh(fwdSkin), cowlMesh = firstMesh(cowl);
  for (const side of [1, -1]) {
    cowl.add(decal(cowlMesh, danger('PROPELLER'), { at: fusePoint(10.0, side > 0 ? 0.05 : Math.PI - 0.05), dir: [0, 0, side], size: [0.7, 0.22, 0.4], roughness: 0.5 }));
    aftSkin.add(decal(aftMesh, insignia(), { at: fusePoint(7.1, side > 0 ? 0.12 : Math.PI - 0.12), dir: [0, 0.1, side], size: [0.95, 0.48, 0.4] }));
    fwdSkin.add(decal(fwdMesh, wideStencil('U.S. AIR FORCE', 'rgba(52,58,64,0.88)'), { at: fusePoint(3.0, side > 0 ? 0.25 : Math.PI - 0.25), dir: [0, 0.25, side], size: [1.1, 0.14, 0.3] }));
    cowl.add(decal(cowlMesh, sootStreak(), { at: fusePoint(10.17, side > 0 ? 0.62 : Math.PI - 0.62), dir: [0, 0.75, 0.65 * side], size: [0.48, 0.16, 0.3], angle: side > 0 ? Math.PI : 0, roughness: 0.8 }));
  }

  A.finalize();

  // ============================================================== behaviour
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORES = {
    clean: { gbu: false, hellfire: false, er: false },
    hellfire: { gbu: false, hellfire: true, er: false },
    strike: { gbu: true, hellfire: true, er: false },
    er: { gbu: false, hellfire: false, er: true },
  };
  const state = { airborne: 0, airTarget: 0, throttle: 0.4, altitude: 7600, laser: false, roll: 0, pitch: 0, yaw: 0, propA: 0, stores: 'strike' };
  for (const b of braceSets) b.mesh.visible = b.when(STORES.strike);
  const qI = new THREE.Quaternion();
  let bayRestore = null;
  return {
    id: 'uav',
    designation: 'MQ-9A',
    name: 'REAPER',
    role: 'Medium-altitude long-endurance RPA',
    tagline: 'Medium altitude · long endurance · flown through a satellite link',
    summary: 'General Atomics’ MQ-9A Reaper is a 4.8-tonne remotely piloted aircraft built to stay over one area for a day or more. A long, thin wing and a 900 shp pusher turboprop trade speed for endurance, while a stabilised EO/IR turret and a synthetic-aperture radar watch the ground. Two crew fly it from a ground station, often a continent away, through a Ku-band satellite link.',
    specs: [
      ['Length', '11.0 m (36 ft)'], ['Wingspan', '20.1 m (66 ft)'], ['Height', '3.81 m (12.5 ft)'],
      ['Empty weight', '2,223 kg (4,900 lb)'], ['Max take-off weight', '4,760 kg (10,500 lb)'], ['Internal fuel', '≈ 1,800 kg (4,000 lb, 602 US gal, USAF) in seven tanks: forward, header and aft fuselage cells and two tanks in each wing; GA-ASI Block 5: 1,724 kg (3,800 lb)'], ['ER fuel pods', '2 on the inboard stations: 2,926 kg (6,450 lb) of fuel in all, 34 h endurance (GA-ASI Block 5)'],
      ['Payload', '1,701 kg (3,750 lb, USAF). GA-ASI: 386 kg (850 lb) internal + 1,361 kg (3,000 lb) external; Block 5 sheet: 1,701 kg external'], ['Engine', 'Honeywell TPE331-10GD turboprop (USAF; NASA lists a -10T, the NTSB a -10Y), 900 shp (671 kW); Honeywell rates the TPE331-10 at 940 shp; 1.09 m long, 175 kg dry, pressure ratio 10.55'], ['Reduction gearbox', '26.2 : 1, 41,730 engine rpm to 1,591 propeller rpm, output 0.09 m above the engine axis'],
      ['Propeller', 'McCauley 3GFR36C606 hub with three 110GFA-0 aluminium blades, 2.79 m (110 in), full-feathering and reversing'], ['Cruise speed', '313 km/h (169 kt); USAF quotes ≈ 370 km/h'],
      ['Max speed', '482 km/h (260 kt); GA-ASI quotes 444 km/h (240 KTAS)'], ['Ceiling', '15,240 m (50,000 ft, USAF and GA-ASI); current GA-ASI Block 5 sheet: 13,716 m (45,000 ft)'],
      ['Endurance', '27 h clean (GA-ASI); current Block 5 sheet: 26 h'], ['Range', '1,850 km (1,000 nmi, USAF)'],
      ['Stores stations', '7: six under-wing, one centreline'], ['Wing station ratings', '1,500 / 600 / 200 lb inboard / middle / outboard (USAF T.O. figures as reported: 1,500 / 750 / 150 lb)'], ['Electrical power', '45 kVA main, 4 kW backup (Block 5)'], ['Crew', '2 remote: pilot and sensor operator'],
    ],
    heroStats: [['27', 'h', 'Endurance'], ['15.2', 'km', 'Ceiling'], ['1,701', 'kg', 'Payload']],
    sources: 'USAF MQ-9 Reaper fact sheet (af.mil); GA-ASI MQ-9A and MQ-9A Block 5 specification sheets; NAVAIR MQ-9A product page; DOT&E annual reports FY2011 and FY2017; NASA Ikhana (Predator B) fact sheets; NTSB final report CHI06MA121 (Predator B, Nogales, 2006); USAF accident investigation reports on MQ-9A losses (Seychelles and Nevada 2012, 2015, 2018, 2020, 2025, as published and as reported by Air & Space Forces Magazine and Aerossurance); Honeywell TPE331-10 brochure N61-1491 (specifications, drive pads, installation drawing); McCauley 3GFR36C606/110GFA-0 propeller records; GA-ASI releases on the trailing-arm main gear (2012) and the Block 5 electrical system; Sandia National Laboratories, “Lynx: A high-resolution synthetic aperture radar” (OSTI 4263), and the GA-ASI Lynx datasheet; Lockheed Martin M299 and Marvin Engineering M299/M310 launcher data; MIL-STD-8591 (store suspension); Aerospace America (2016) on Reaper icing; Wikipedia articles on the MQ-9, TPE331, GBU-12 and AGM-114. Main-gear geometry (splay, track, wheel size) and the one-door-per-side arrangement are estimated from NASA, USAF and GA-ASI photographs. Internal layout, routing, retraction kinematics and component masses are estimates.',
    fleetTag: '27 h loiter',
    aero: true,
    root: A.root,
    parts: A.parts,
    // a raised front quarter: the planform reads, and the nose sensors' and the tail's labels stack
    // without covering one another's dots (anchors and this view were laid out together)
    view: { dir: [1.19, 1.05, 1], fill: 0.75 },
    displaySize: 11.5,
    thermalRange: [230, 560],
    state,
    // aircraft-frame points the endurance lab hangs its force arrows on (add root.children[0].position)
    cg: [X(4.55), 1.55, 0],
    propHub: [PROP_X, SHAFT_Y, 0],
    setAirborne(v) { state.airTarget = v ? 1 : 0; },
    setLaser(v) { state.laser = !!v; },
    setStick({ roll = 0, pitch = 0, yaw = 0 } = {}) { state.roll = roll; state.pitch = pitch; state.yaw = yaw; },
    /** Stores fit shown on the model: 'clean', 'hellfire' (4 × AGM-114), 'strike' (+ 2 × GBU-12) or 'er' (2 × ER fuel pods). */
    setStores(key) {
      const fit = STORES[key] || STORES.strike;
      state.stores = STORES[key] ? key : 'strike';
      for (const p of storeParts.gbu) p.visible = fit.gbu;
      for (const p of storeParts.hellfire) p.visible = fit.hellfire;
      for (const p of storeParts.launcher) p.visible = fit.hellfire;
      for (const p of storeParts.er) p.visible = fit.er;
      for (const b of braceSets) b.mesh.visible = b.when(fit);          // sway braces wound down onto the store, or in
    },
    /** Tour hook ('bay' demo): show the full strike fit while a step is on screen, then restore the lab's fit. */
    setBay(on) {
      if (on) { bayRestore = state.stores; this.setStores('strike'); } else if (bayRestore) { this.setStores(bayRestore); bayRestore = null; }
    },
    temperatureOf(info) {
      const amb = 288.15 - 0.0065 * Math.min(11000, state.altitude * state.airborne);
      const th = state.throttle;
      switch (info.thermalRole) {
        case 'exhaust': return amb + 420 + th * 260;
        case 'turbine': return amb + 260 + th * 200;
        case 'compressor': return amb + 60 + th * 110;
        case 'gearbox': return amb + 55 + th * 35;
        case 'oil': return amb + 60 + th * 25;
        case 'generator': return amb + 40 + th * 25;
        case 'battery': return amb + 12;
        case 'cowling': return amb + 30 + th * 40;   // skin over the engine and the exhaust stacks
        case 'tailcone': return amb + 18 + th * 20;
        default: break;
      }
      if (info.system === 'Avionics' || info.system === 'Flight controls' && /computer/i.test(info.name)) return amb + 28;
      if (info.system === 'Sensors') return amb + 18;
      if (info.system === 'Electrical') return amb + 14;
      return amb;
    },
    update(dt, t) {
      const step = dt * 0.4;
      state.airborne += Math.max(-step, Math.min(step, state.airTarget - state.airborne));
      const a = state.airborne;
      const g = smooth(0.05, 0.62, a);            // gear travel
      const d = smooth(0.62, 0.9, a);             // doors closing behind it
      noseLeg.rotation.z = NG.stow * g;
      // each main leg turns as one rigid unit about its fixed hinge axis: slerp from identity keeps that axis
      for (const ml of mainLegs) ml.piv.quaternion.slerpQuaternions(qI, ml.q, g);
      // the doors hang open whenever the gear is down and close behind the legs once they are up
      for (const dr of doors) dr.h.setAngle(dr.open * (1 - d) * dr.sign);
      for (const fn of movers) fn();
      // propeller: shown at a slow, alias-free rate (the real one turns ≈ 1,600 rpm)
      state.propA += dt * (5 + state.throttle * 22);
      propSpin.rotation.x = state.propA;
      hubSpin.rotation.x = state.propA;
    domeSpin.rotation.x = state.propA;
      // sensors: turret scan, Lynx sweep, SATCOM dish tracking
      tAz.rotation.y = Math.sin(t * 0.22) * 1.1;
      tEl.rotation.z = -0.3 - Math.sin(t * 0.15) * 0.2 - a * 0.45;
      lynxG.az.rotation.y = Math.sin(t * 0.5) * 0.6;
      lynxG.el.rotation.z = -0.4 - Math.sin(t * 0.31) * 0.22;     // 5°–60° below the horizon in service; −10° to −35° here
      lynxG.roll.rotation.x = Math.sin(t * 0.9) * 0.05;          // the inner gimbal holds the beam level as the aircraft rolls
      dishAz.rotation.y = Math.sin(t * 0.07) * 0.5;
      beamMat.opacity = state.laser ? 0.5 : 0;
      m.laser.emissiveIntensity = state.laser ? 6 : 0.8;
      // controls: ailerons antisymmetric, ruddervators mix pitch and yaw, flaps out during the transition
      const roll = state.roll, pitch = state.pitch, yaw = state.yaw;
      for (const { h } of surf.ail) h.setAngle(-roll * 18 * deg);
      // flaps out during the transition: 15° for take-off (USAF, 2020 Syracuse investigation), the 45° mechanical stop on the
      // approach (the landing setting itself is not public)
      const flap = (state.airTarget > 0.5 ? 15 : 45) * Math.sin(Math.PI * Math.min(1, Math.max(0, a)));
      for (const { h, side } of surf.flap) h.setAngle(flap * side * deg);
      for (const { h, side } of surf.rv) h.setAngle((-pitch * 15 * side + yaw * 12) * deg);
      surf.rud.setAngle(-yaw * 20 * deg);            // trailing edge to the same side as the ruddervators
      // anti-collision beacons: a soft pulse about once a second, steady when motion is reduced
      // (a gentle 0.8 Hz swell, never a hard strobe: bright, sharp flashes read as flicker on screen)
      const pulse = reduced ? 0.3 : (0.5 + 0.5 * Math.cos(t * Math.PI * 1.6)) ** 2;
      m.beacon.emissiveIntensity = 0.35 + pulse * 1.15;
      m.lamp.emissiveIntensity = a > 0.5 ? 0.25 : 1.1;
      const lift = smooth(0, 1, a);
      air.position.y = lift * 2.2 + Math.sin(t * 0.7) * 0.05 * lift;
      air.rotation.x = lift * (Math.sin(t * 0.21) * 0.05 + roll * 0.25);
      air.rotation.z = lift * (0.03 + pitch * 0.06);
    },
  };

  function applyOut(gm) {
    // tank loft rings are clamped flat on top; make sure triangles face outward
    const p = gm.attributes.position, idx = gm.index.array;
    let vol = 0;
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) { va.fromBufferAttribute(p, idx[i]); vb.fromBufferAttribute(p, idx[i + 1]); vc.fromBufferAttribute(p, idx[i + 2]); vol += va.dot(vb.cross(vc)); }
    if (vol < 0) for (let i = 0; i < idx.length; i += 3) { const tt = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tt; }
    gm.computeVertexNormals();
    return gm;
  }
}

