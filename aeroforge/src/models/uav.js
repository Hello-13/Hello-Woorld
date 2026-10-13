// General Atomics MQ-9A Reaper (Predator B): medium-altitude long-endurance remotely piloted
// aircraft. Built at real scale in metres. Axes: nose toward +x, y up, starboard wing toward +z,
// ground at y = 0 on the wheels; fuselage station s runs aft from the nose tip (x = 5.5 − s).
// See mq9/shape.js for the outer mould line, mq9/powerplant.js for the TPE331-10 installation and
// mq9/stores.js for the pylons and weapons. Layout follows the USAF and GA-ASI fact sheets and
// published photographs; internal positions and all component masses are estimates unless a
// part says otherwise.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { wingPanel, hingedMesh, lathe, loftRings } from '../engine/geometry.js';
import { M, SKIN } from '../engine/materials.js';
import { decal, danger } from '../engine/decals.js';
import { decalTexture } from '../engine/surface.js';
import {
  X, prof, fusePoint, fuselageLoft, stationsWithBreaks, splitTris, merge, box, lru, cylX, tubeBetween, pipe, latheX,
  hoop, bulkhead, applyMat, WING, wsec, W_ROOT, W_TIP, wpt, sparGeo, ribGeo,
} from './mq9/shape.js';
import {
  ENGINE_Y, SHAFT_Y, PROP_X, STATIONS, combustorGeo, turbineGeo, manifoldGeo, ignitersGeo, collectorGeo, compressorGeo, impellersGeo,
  mainShaftGeo, screenGeo, gearboxGeo, shaftGeo, exhaustGeo, bladesGeo, hubGeo, spinnerGeo,
} from './mq9/powerplant.js';
import { gbu12, hellfire, launcher, pylon } from './mq9/stores.js';

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
    blade: std({ color: 0x3b3f44, roughness: 0.45, metalness: 0.15 }),
    dish: std({ color: 0xdfe2e3, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }),
    turret: std({ color: 0x8e959b, roughness: 0.42, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c161e, roughness: 0.12, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.14 }),
    olive: M.munition(), seeker: std({ color: 0xc9ccc6, roughness: 0.45, metalness: 0.15 }),
    yellow: std({ color: 0xd8a51f, roughness: 0.5, metalness: 0.1 }), brown: std({ color: 0x6a4527, roughness: 0.6, metalness: 0.1 }),
    navRed: M.navRed(), navGreen: M.navGreen(),
    beacon: std({ color: 0x3a0606, emissive: 0xff2a1a, emissiveIntensity: 0.4, roughness: 0.35 }),
    lamp: std({ color: 0xdedede, emissive: 0xfff3dc, emissiveIntensity: 0.4, roughness: 0.2 }),
    laser: M.laser().clone(),
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
  const fl = fuselageLoft(stationsWithBreaks([0.95, 2.05, 4.0, 6.3, 9.55], 0.2), 48);
  const panels = splitTris(fl, (cx, cy) => {
    const s = 5.5 - cx;
    if (s < 2.05 && cy > prof(Math.max(0, s)).yc - 0.02) return 'radome';
    if (s < 0.95) return 'lynx';
    if (s < 4.0) return 'fwd';
    if (s < 6.3) return 'ctr';
    if (s < 9.55) return 'aft';
    return 'tail';
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
    system: 'Skin & fairings', skin: true, material: 'Carbon/epoxy sandwich panels (est.)', mass: 80, explode: [0.2, 1.95, -1.3],
    desc: 'Composite skin over the avionics bay and nose-gear well. The MQ-9 airframe is mostly composite with light-alloy fittings; access panels open the avionics racks from below and the sides.',
  }, L(panels.get('fwd'), m.skin));
  P('Centre fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Carbon/epoxy sandwich panels (est.)', mass: 55, explode: [0, 2.05, -1.3],
    desc: 'Skin around the wing carry-through, the fuselage fuel tank and the main-gear bays: the most heavily loaded part of the fuselage, where wing bending meets the body.',
  }, L(panels.get('ctr'), m.skin));
  const aftSkin = role(P('Engine bay cowling', {
    system: 'Skin & fairings', skin: true, material: 'Composite and titanium-faced panels (est.)', mass: 55, explode: [-0.2, 2.05, -1.3],
    desc: 'Removable cowling around the turboprop bay aft of the firewall. Panels near the exhaust stacks need heat-resistant facing; the rest hinge open for engine changes.',
  }, L(panels.get('aft'), m.skin)), 'cowling');
  role(P('Tail cone', {
    system: 'Skin & fairings', skin: true, material: 'Composite (est.)', mass: 14, explode: [-1.0, 1.7, -1.3],
    desc: 'Tapers the fuselage into the spinner so the pusher propeller works in smooth, attached flow; it houses the drive shaft and the accessory drives.',
  }, L(panels.get('tail'), m.skin)), 'tailcone');

  // ============================================================== fuselage structure
  // nose-gear well s 1.88–3.12 under a raised avionics floor; main-gear wells s 4.86–6.5 behind the fuselage tank
  const NW = [1.88, 3.12], NFLOOR = 1.49;
  const MW = [4.86, 6.5], MROOF = [1.5, 1.735], MSTEP = 5.3;
  // frames that cross a gear well are open at the bottom: the well walls and keel webs carry the load around the cut-out
  const openArc = { from: -0.45, to: Math.PI + 0.45, n: 30 };
  const inWell = (s) => (s > NW[0] && s < NW[1]) || (s > MW[0] && s < MW[1]);
  const fwdFrames = [hoop(0.95, { from: -Math.PI, to: 0, n: 20 }), ...[2.05, 2.6, 3.42, 3.9].map((s) => hoop(s, inWell(s) ? openArc : {}))];
  P('Forward fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 45, count: 5, explode: [0.4, 0.45, 0],
    desc: 'Frames that hold the nose shape and carry the radome, nose gear and avionics loads into the longerons. The lower arc at the front carries the Lynx radome ring; the two over the nose-gear well stop at the well walls (spacing estimated).',
  }, L(merge(fwdFrames), m.frame));
  // engine-bay frames are open below too, where the cowling is removable (estimated)
  const aftFrames = [4.25, 5.25, 6.3, 6.95, 8.43, 9.55, 10.05].map((s) => hoop(s, { h: s > 8 ? 0.035 : 0.045, ...(inWell(s) ? openArc : s > 8 && s < 9 ? { from: -0.2, to: Math.PI + 0.2, n: 30 } : {}) }));
  P('Centre & aft fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 44, count: 7, explode: [-0.3, 0.45, 0],
    desc: 'Frames at the wing spars, main-gear wells, engine mounts and tail roots. The frames at the front and rear spar positions take the wing’s lift into the body; those over the wells and the engine are open below (spacing estimated).',
  }, L(merge(aftFrames), m.frame));
  const longerons = [0.9, Math.PI - 0.9, -0.5, -Math.PI + 0.5].map((th) => {
    const pts = [];
    // the upper pair ends at the tail-root frame, where the V-tail roots and the gearbox fill the top of the section
    for (let s = 0.95; s <= (th > 0 ? 8.45 : 10.0) + 1e-6; s += 0.25) pts.push(fusePoint(s, th, 0.04));
    return pipe(pts, 0.012, 6, 80);
  });
  P('Fuselage longerons', {
    system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 30, count: 4, explode: [0, 0.6, 0],
    desc: 'Four longitudinal members tie the frames together and carry fuselage bending from the heavy nose sensors and the engine at the tail. The lower pair runs along the outer edges of the gear wells, above the door hinges (positions estimated).',
  }, L(merge(longerons), m.composite));
  P('Avionics floor', {
    system: 'Structure', material: 'Aluminium honeycomb panel (est.)', mass: 10, explode: [0.6, 0.35, 0],
    desc: 'A floor for the avionics racks, raised over the nose-gear well. Keeping the electronics above the well keeps them clear of runway spray; the sensor electronics and batteries sit below it beside the well.',
  }, L(merge([box(1.9, 0.014, 0.76, [X(2.45), NFLOOR, 0]), ...[1.75, 2.45, 3.15].map((s) => box(0.03, 0.04, 0.74, [X(s), NFLOOR - 0.027, 0]))]), m.primer));
  const NWB = 1.045;                                   // well walls stop just inside the skin
  const nwWall = (zc) => box(NW[1] - NW[0], NFLOOR - NWB, 0.01, [X((NW[0] + NW[1]) / 2), (NFLOOR + NWB) / 2, zc]);
  P('Nose gear well', {
    system: 'Structure', material: 'Composite well liner (est.)', mass: 5, explode: [0.6, -0.15, 0],
    desc: 'A boxed well, 1.24 m long, that the nose leg retracts aft into; its side walls carry the floor and the frames past the cut-out (size estimated).',
  }, L(merge([nwWall(0.19), nwWall(-0.19), box(0.01, NFLOOR - NWB, 0.38, [X(NW[0]), (NFLOOR + NWB) / 2, 0]), box(0.01, NFLOOR - NWB, 0.38, [X(NW[1]), (NFLOOR + NWB) / 2, 0])]), m.primer));
  // main-gear wells: keel wall, stepped roof (low under the wing box, high behind it), forward and aft walls
  const keelWall = (zc) => {
    const yb = (s) => prof(s).bot + 0.02;
    const sh = new THREE.Shape([
      new THREE.Vector2(X(MW[0]), yb(MW[0])), new THREE.Vector2(X(MW[1]), yb(MW[1])),
      new THREE.Vector2(X(MW[1]), MROOF[1]), new THREE.Vector2(X(MSTEP), MROOF[1]), new THREE.Vector2(X(MSTEP), MROOF[0]), new THREE.Vector2(X(MW[0]), MROOF[0]),
    ].reverse());
    return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false }).translate(0, 0, zc - 0.005);
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
    bays.push(keelWall(0.045 * zs));
    bays.push(roofPlate(MW[0], MSTEP, MROOF[0], zs), roofPlate(MSTEP, MW[1], MROOF[1], zs));
    bays.push(crossWall(MW[0], MROOF[0], zs), crossWall(MW[1], MROOF[1], zs));
    bays.push(box(0.01, MROOF[1] - MROOF[0], 0.27, [X(MSTEP), (MROOF[0] + MROOF[1]) / 2, 0.18 * zs]));
  }
  P('Main gear wells', {
    system: 'Structure', material: 'Composite well liners on a keel web (est.)', mass: 14, count: 2, explode: [0, -0.3, 0],
    desc: 'Two boxed wells, 1.64 m long, take the retracted main legs, one each side of a keel web that carries fuselage bending past the cut-outs. The roof steps up behind the wing box to make room for the upright wheel; the fuselage-tank feed runs along the keel between the wells (layout estimated).',
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
  P('Firewall', {
    system: 'Structure', material: 'Titanium sheet (est.)', mass: 9, explode: [0.15, 0.95, 0],
    desc: 'Fireproof bulkhead between the engine bay and the fuel and electronics ahead of it. Titanium keeps its strength at flame temperatures where aluminium would melt.',
  }, L(bulkhead(7.62), m.titanium));
  const XM = X(STATIONS.turbine1);              // mount ring at the compressor / combustor joint
  const mount = [new THREE.TorusGeometry(0.235, 0.012, 6, 36).rotateY(Math.PI / 2).translate(XM, ENGINE_Y, 0)];
  for (const th of [0.75, Math.PI - 0.75, -0.75, -Math.PI + 0.75]) {
    const a = fusePoint(7.64, th, 0.05);
    const b = [XM, ENGINE_Y + Math.sin(th) * 0.235, Math.cos(th) * 0.235];
    mount.push(tubeBetween(a, b, 0.012, 8));
    const b2 = [XM, ENGINE_Y + Math.sin(th + (th > 0 ? 0.6 : -0.6)) * 0.235, Math.cos(th + (th > 0 ? 0.6 : -0.6)) * 0.235];
    mount.push(tubeBetween(a, b2, 0.01, 8));
  }
  for (const zs of [1, -1]) mount.push(tubeBetween(fusePoint(8.43, zs > 0 ? 0.35 : Math.PI - 0.35, 0.04), [X(8.82), ENGINE_Y + 0.1, 0.2 * zs], 0.012, 8));
  P('Engine mount truss', {
    system: 'Structure', material: 'Welded steel tube with elastomeric isolators (est.)', mass: 14, explode: [0, 1.15, 0],
    desc: 'A tubular truss from the firewall to a mount ring at the compressor–combustor joint, with a rear brace from the aft frame to the gearbox. Rubber isolators keep engine vibration out of the airframe and the sensors (layout estimated).',
  }, L(merge(mount), m.darkMetal));

  // ============================================================== wings
  const zE = (z) => (z - W_ROOT.le[2]) / (W_TIP.le[2] - W_ROOT.le[2]);
  const FLAP = [0.78, 4.55], AIL = [4.72, 9.3];
  const TANK = [0.5, 8.4];
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
  const storeParts = { gbu: [], hellfire: [], launcher: [] };
  const twistAt = (z) => WING.twist * zE(z);
  const twistGeo = (g, z) => {
    const s = wsec(z);
    return g.translate(-s.le[0], -s.le[1], 0).rotateZ(twistAt(z) * deg).translate(s.le[0], s.le[1], 0);
  };
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const wbox = wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0, c1: 0.74, stations: 14, twist: WING.twist, n: 28 });
    const fills = [[WING.zRoot, FLAP[0]], [FLAP[1], AIL[0]], [AIL[1], W_TIP.le[2]]].map(([a, b]) =>
      wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0.74, c1: 1, eta0: zE(a), eta1: zE(b), stations: 1, twist: WING.twist, n: 28 }));
    const tipCap = twistGeo(wingPanel({
      root: W_TIP, tip: { le: [W_TIP.le[0] - 0.03, W_TIP.le[1] + 0.002, WING.semi], chord: W_TIP.chord - 0.05, t: W_TIP.t * 0.45 }, stations: 2, n: 28,
    }), W_TIP.le[2]);
    const wing = P(`Wing skin (${sn})`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon/epoxy skins, integral leading edge (est.)', mass: 125, explode: [0, 1.5, 1.9 * side],
      desc: 'A long, straight, high-aspect-ratio wing: 20.1 m span over about 24 m², aspect ratio near 17. Induced drag falls with span squared, which is what buys the 27-hour endurance. USAF Reapers have little effective ice protection and avoid moderate icing; GA-ASI offers a de-ice/anti-ice kit for the MQ-9A Block 5, and the 79 ft extended wing has leading-edge de-ice provisions.',
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
      system: 'Structure', material: 'Composite and machined aluminium at hardpoints (est.)', mass: 26, count: RIBS.length, explode: [0, 0.4, 1.9 * side],
      desc: 'Ribs keep the airfoil shape and stabilise the skins against buckling; the heavier ribs at 2.4, 4.0 and 5.6 m from the centreline carry the pylon loads. Holes between the spars save weight and let fuel flow from bay to bay (spacing and hole layout estimated).',
    }, L(f(merge(RIBS.map((z) => ribGeo(z, 0.012, 0.72, { holes: [0.3, 0.44, 0.58] })))), m.primer));

    const r0 = wsec(TANK[0]), r1 = wsec(TANK[1]);
    const tankG = twistGeo(wingPanel({ root: { ...r0, t: r0.t * 0.9 }, tip: { ...r1, t: r1.t * 0.9 }, c0: 0.165, c1: 0.675, stations: 10, twist: twistAt(TANK[1]) - twistAt(TANK[0]), withChord: false }), TANK[0]);
    P(`Wing fuel tank (${sn})`, {
      system: 'Fuel', material: 'Sealed integral bay / bladder (est.)', mass: 20, explode: [0, -0.35, 1.9 * side],
      desc: 'Fuel in the wing box between the spars, from the root to about 8.4 m out: ≈ 750 L per wing in this model (the real split is not published). Wing fuel sits where the lift is, so it relieves wing bending and barely moves the centre of gravity as it burns.',
      callout: side > 0, anchor: wpt(6.4, 0.42, 1, 0).map((v, i) => (i === 2 ? v * side : v)),
    }, L(f(tankG), m.fuel));

    // trailing-edge surfaces
    const hp = (z) => { const p = wpt(z, 0.74, 0); return new THREE.Vector3(p[0], p[1], p[2] * side); };
    const flapG = f(wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0.745, c1: 1, eta0: zE(FLAP[0] + 0.01), eta1: zE(FLAP[1] - 0.01), stations: 4, twist: WING.twist, n: 28 }));
    const fH = hingedMesh(flapG, m.skin, hp(FLAP[0]), hp(FLAP[1]));
    P(`Flap (${sn})`, {
      system: 'Flight controls', material: 'Composite (est.)', mass: 9, explode: [-0.7, 1.5, 1.9 * side],
      desc: 'Plain flap over the inboard trailing edge. Lowered for take-off and landing it raises the wing’s maximum lift so the aircraft can use ordinary runways.',
    }, fH.pivot);
    const ailG = f(wingPanel({ root: W_ROOT, tip: W_TIP, c0: 0.745, c1: 1, eta0: zE(AIL[0] + 0.01), eta1: zE(AIL[1] - 0.01), stations: 4, twist: WING.twist, n: 28 }));
    const aH = hingedMesh(ailG, m.skin, hp(AIL[0]), hp(AIL[1]));
    P(`Aileron (${sn})`, {
      system: 'Flight controls', material: 'Composite (est.)', mass: 8, explode: [-0.7, 1.5, 1.9 * side],
      desc: 'Outboard roll control, moving opposite to the other aileron. Far from the centreline, a small deflection gives a large rolling moment.',
    }, aH.pivot);
    for (const h of [fH, aH]) { h.mesh.castShadow = true; h.mesh.receiveShadow = true; }
    surf.flap.push({ h: fH, side }); surf.ail.push({ h: aH, side });

    const servo = (z) => { const c = wpt(z, 0.715, 0); return box(0.04, 0.045, 0.2, [c[0], c[1], c[2]]); };
    const horn = (z) => { const a = wpt(z, 0.715, 0), b = wpt(z, 0.77, -1, -0.01); return tubeBetween(a, b, 0.006, 6); };
    P(`Flap servo (${sn})`, {
      system: 'Flight controls', material: 'Electromechanical actuator and pushrod (est.)', mass: 3, explode: [-0.4, 1.0, 1.6 * side],
      desc: 'An electric servo behind the rear spar drives the flap through a short pushrod to a horn on its lower surface. The MQ-9 flies by wire with electric actuators, no hydraulic flight controls (position and size estimated).',
    }, L(f(merge([servo(2.7), horn(2.7)])), m.lruOlive));
    P(`Aileron servo (${sn})`, {
      system: 'Flight controls', material: 'Electromechanical actuator and pushrod (est.)', mass: 3, explode: [-0.4, 1.0, 2.2 * side],
      desc: 'The aileron’s own servo and pushrod, so a failure of one actuator leaves the other surfaces working (position and size estimated).',
    }, L(f(merge([servo(7.0), horn(7.0)])), m.lruOlive));
    const brk = [];
    for (const z of [1.1, 2.15, 3.3, 4.4, 4.9, 6.0, 7.2, 8.3, 9.15]) {
      const a = wpt(z, 0.69, 0), b = wpt(z, 0.745, 0);
      brk.push(box(Math.abs(a[0] - b[0]) + 0.02, 0.03, 0.012, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.01, z]), cylX(b[0] - 0.006, b[0] + 0.006, 0.012, 0.012, b[1] - 0.01, z, 8));
    }
    P(`Flap & aileron hinges (${sn})`, {
      system: 'Flight controls', material: 'Aluminium hinge brackets on the rear spar (est.)', mass: 1.5, count: 9, explode: [-0.55, 1.25, 1.9 * side],
      desc: 'Brackets on the rear spar carry the hinge line of the flap (four) and the aileron (five); the surfaces pivot about their leading edges (bracket count and spacing estimated).',
    }, L(f(merge(brk)), m.alu));
    const harnessPts = [[0.45, 0.705], [3.0, 0.705], [6.0, 0.705], [9.2, 0.705], [9.85, 0.4], [9.95, 0.08]].map(([z, cf]) => wpt(z, cf, 0));
    P(`Wing wiring (${sn})`, {
      system: 'Electrical', material: 'Shielded harness in conduit (est.)', mass: 4, explode: [0, 1.0, 1.9 * side],
      desc: 'Power and signal runs to the wing servos, the wingtip radio antenna and the navigation light, routed along the rear spar outside the fuel bay.',
    }, L(f(merge([pipe(harnessPts, 0.008, 5, 60), tubeBetween(wpt(2.7, 0.705, 0), wpt(2.75, 0.715, 0), 0.006, 5), tubeBetween(wpt(7.0, 0.705, 0), wpt(7.05, 0.715, 0), 0.006, 5)])), m.harness));
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
    const stnInfo = [];
    for (const [z, chord, h, label, mass, desc] of STN) {
      const le = wpt(z, 0.04, 0), yTop = wpt(z, 0.32, -1)[1] + 0.03;
      const pg = pylon(chord, h);
      P(`${label} pylon (${sn})`, {
        system: 'Weapons', material: 'Aluminium pylon with bomb rack, release unit and sway braces (mass est.)', mass, explode: [0, -0.75, 1.9 * side],
        desc,
      }, [L(f(pg.skin.translate(le[0], yTop, z)), m.skin), L(f(pg.rack.translate(le[0], yTop, z)), m.darkMetal)]);
      stnInfo.push({ x: le[0] - chord * 0.45, yBot: yTop - h - 0.03, z });
    }

    // GBU-12 on the inboard station
    const g = gbu12();
    const gb = stnInfo[0];
    const gy = gb.yBot - g.radius - 0.012, gx = gb.x - 0.05;
    const place = (geo) => f(geo.clone().translate(gx, gy, gb.z));
    storeParts.gbu.push(P(`GBU-12 Paveway II (${sn})`, {
      system: 'Weapons', material: 'Mk 82 steel bomb body, laser guidance kit', mass: 230, massSource: 'Published GBU-12 figure (≈ 230 kg)', explode: [0, -1.1, 2.1 * side],
      desc: 'A 500 lb-class Mk 82 bomb with a laser seeker and steering canards on the nose and folding wings at the tail: 3.27 m long, 0.27 m across. It steers toward laser energy reflected from a marked spot.',
      callout: side > 0, anchor: [gx + 1.3, gy, gb.z * side],   // the seeker end
    }, [L(place(g.body), m.olive), L(place(g.guidance), m.seeker), L(place(g.dome), m.glass), L(place(g.band), m.yellow)]));

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
      callout: side < 0, anchor: [lx - 0.62, hy - hf.radius, (md.z + 0.12) * side],   // the port pair: its label falls clear of the nose sensors'
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
  const DIH = 47 * deg, VT_L = 2.71;
  const vtRoot = { le: [0, 0, 0], chord: 1.3, t: 0.11 };
  const vtTip = { le: [-VT_L * Math.tan(25 * deg), 0, VT_L], chord: 0.62, t: 0.09 };
  const vtPoint = (eta, cf, side) => new THREE.Vector3(
    vtRoot.le[0] + (vtTip.le[0] - vtRoot.le[0]) * eta - cf * (vtRoot.chord + (vtTip.chord - vtRoot.chord) * eta), 0, VT_L * eta * side);
  const tailFrames = [];
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const frame = new THREE.Group();
    frame.position.set(X(8.45), 1.775, 0.09 * side);
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
    const rvG = f(wingPanel({ root: vtRoot, tip: vtTip, c0: 0.705, c1: 1, eta0: 0.065, eta1: 0.935, stations: 3, n: 24 }));
    const rH = hingedMesh(rvG, m.skin, vtPoint(0.065, 0.7, side), vtPoint(0.935, 0.7, side));
    rH.mesh.castShadow = true; rH.mesh.receiveShadow = true;
    P(`Ruddervator (${sn})`, {
      system: 'Flight controls', material: 'Composite (est.)', mass: 7, explode: [-0.6, -0.35, 0.85 * side],
      desc: 'Moving together, the two ruddervators pitch the aircraft like an elevator; moving oppositely they yaw it like a rudder. The flight computers mix the two commands.',
      callout: side > 0, anchor: [vtPoint(0.92, 0.85, 1).x, 0, VT_L * 0.92 * side],
    }, rH.pivot, frame);
    surf.rv.push({ h: rH, side });
    const vs = [sparGeo(0.05, VT_L - 0.05, 0.25, { width: 0.025, steps: 4, root: vtRoot, tip: vtTip, twist: 0 }), sparGeo(0.05, VT_L - 0.08, 0.66, { width: 0.02, steps: 4, root: vtRoot, tip: vtTip, twist: 0 })];
    for (const zz of [0.05, 0.7, 1.4, 2.1, 2.7]) vs.push(ribGeo(zz, 0.02, 0.69, { root: vtRoot, tip: vtTip, twist: 0, th: 0.008 }));
    P(`V-tail spar & ribs (${sn})`, {
      system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 9, explode: [0, 0, 0.55 * side],
      desc: 'Two spars and five ribs per tail surface, plugged into root fittings on the aft fuselage frames (layout estimated).',
    }, L(f(merge(vs)), m.composite), frame);
  }
  const fin = new THREE.Group();
  fin.position.set(X(8.95), 1.53, 0);
  fin.rotation.x = Math.PI / 2;
  air.add(fin);
  const vfRoot = { le: [0, 0, 0], chord: 1.05, t: 0.1 }, vfTip = { le: [-0.72, 0, 1.17], chord: 0.5, t: 0.08 };
  const vf = [
    // withChord: false: at zero sideslip the fin carries no load, so Pressure view paints it with the body Cp
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0, c1: 0.7, stations: 4, n: 22, withChord: false }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0, eta1: 0.2, stations: 1, n: 22, withChord: false }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0.9, eta1: 1, stations: 1, n: 22, withChord: false }),
  ];
  vf.push(sparGeo(0.32, 1.12, 0.3, { width: 0.02, steps: 3, root: vfRoot, tip: vfTip, twist: 0 }));
  P('Ventral fin', {
    system: 'Skin & fairings', skin: true, material: 'Composite (est.)', mass: 12, explode: [-0.25, 0, 0.75],
    desc: 'The lower arm of the Y-tail. It adds directional stability that a V-tail alone lacks and reaches below the propeller arc so the fin, not the blades, touches first on an over-rotation.',
  }, vf.map((g) => L(g, m.skin)), fin);
  const vfPoint = (eta, cf) => new THREE.Vector3(vfRoot.le[0] + (vfTip.le[0] - vfRoot.le[0]) * eta - cf * (vfRoot.chord + (vfTip.chord - vfRoot.chord) * eta), 0, vfTip.le[2] * eta);
  const rudG = wingPanel({ root: vfRoot, tip: vfTip, c0: 0.705, c1: 1, eta0: 0.2, eta1: 0.9, stations: 2, n: 22, withChord: false });
  const rudH = hingedMesh(rudG, m.skin, vfPoint(0.2, 0.7), vfPoint(0.9, 0.7));
  rudH.mesh.castShadow = true;
  P('Ventral rudder', {
    system: 'Flight controls', material: 'Composite (est.)', mass: 3, explode: [-0.6, 0, 0.75],
    desc: 'Predator-family aircraft carry a rudder on the ventral fin, and one is modelled here; public MQ-9A fact sheets do not describe it or how it is mixed with the ruddervators. A ventral rudder adds yaw authority for crosswind landings.',
  }, rudH.pivot, fin);
  surf.rud = rudH;
  const tipZ = vfTip.le[2] + 0.02;
  P('Tail bumper', {
    system: 'Landing gear', material: 'Replaceable composite/steel skid (est.)', mass: 2, explode: [-0.25, 0, 1.0],
    desc: 'A sacrificial skid under the ventral fin that takes any tail strike on take-off rotation or a flared landing, protecting the fin and the propeller above it.',
  }, L(merge([box(0.36, 0.05, 0.035, [vfTip.le[0] - 0.22, 0, tipZ])]), m.darkMetal), fin);

  // ============================================================== propulsion
  // TPE331-10GD, 1.10 m from the exhaust collector (s 7.88) to the gearbox face (s 8.98); see mq9/powerplant.js
  const XT0 = X(STATIONS.turbine0), XG = X(STATIONS.gear1);
  const cb = combustorGeo();
  role(P('TPE331 turbine case', {
    system: 'Propulsion', material: 'Steel case, nickel-alloy hot section', mass: 22, explode: [0.55, 1.05, 0],
    desc: 'The hot section of the Honeywell TPE331-10GD (900 shp). The whole engine, gearbox included, is only 1.09 m long and weighs 175 kg (385 lb) dry, because the reverse-flow combustor folds the gas path back around the turbine (published TPE331-10 figures; installed position estimated).',
    callout: true, anchor: [X(8.05), ENGINE_Y + 0.189, 0.109],   // on the case, 60° above the side
  }, L(cb.casing, m.hot)), 'turbine');
  role(P('Annular combustor liner', {
    system: 'Propulsion', material: 'Nickel-alloy liner with cooling holes', mass: 6, explode: [0.55, 0.55, 0.55],
    desc: 'Compressed air runs forward outside the liner, turns 180° into it, burns with the fuel and turns again into the first turbine nozzle. Folding the flow this way is what keeps the TPE331 short.',
  }, L(cb.liner, m.hot)), 'turbine');
  const tg = turbineGeo();
  role(P('Three-stage axial turbine', {
    system: 'Propulsion', material: 'Nickel-superalloy discs and blades', mass: 22, count: 3, explode: [0.55, 0.55, -0.55],
    desc: 'Three turbine stages on the single shaft extract the gas energy that drives both the two-stage compressor and, through the gearbox, the propeller. Each stage is a nozzle ring that turns the flow and a bladed disc that it spins (stage spacing estimated).',
  }, [L(tg.rotors, m.hot), L(tg.nozzles, m.darkMetal)]), 'turbine');
  role(P('Fuel manifold & nozzles', {
    system: 'Propulsion', material: 'Stainless manifold, atomising nozzles', mass: 3, count: 10, explode: [0.75, 1.3, 0.4],
    desc: 'A ring manifold feeds the atomising fuel nozzles that spray metered fuel into the combustor (ten shown; the real count is not given in public sources).',
  }, L(manifoldGeo(10), m.pipe)), 'turbine');
  role(P('Igniter plugs', {
    system: 'Propulsion', material: 'Surface-discharge igniters', mass: 0.6, count: 2, explode: [0.75, 1.3, -0.4],
    desc: 'Two igniter plugs light the combustor during the start; once the flame holds on its own they are switched off.',
  }, L(ignitersGeo(), m.darkMetal)), 'turbine');
  role(P('Exhaust collector', {
    system: 'Propulsion', material: 'Inconel', mass: 6, explode: [0.95, 0.8, 0],
    desc: 'An annular duct at the forward end of the engine gathers the turbine exhaust, at several hundred degrees, and hands it to the two side stacks.',
  }, L(collectorGeo(), m.hot)), 'exhaust');
  role(P('TPE331 compressor housing', {
    system: 'Propulsion', material: 'Aluminium and steel housings, diffusers and crossover ducts', mass: 30, explode: [0, 1.05, 0],
    desc: 'Houses the two centrifugal stages in series: crossover ducts carry the air from the first stage to the second, which raises it to roughly 10:1 pressure ratio (pressure ratio is typical of the TPE331-10 class, not a published figure).',
  }, L(compressorGeo(), m.titanium)), 'compressor');
  role(P('Centrifugal impellers', {
    system: 'Propulsion', material: 'Titanium impellers', mass: 9, count: 2, explode: [0, 0.55, 0.55],
    desc: 'Two centrifugal impellers on the main shaft fling the air outward into their diffusers. A centrifugal stage does the work of several axial stages in a short, rugged package.',
  }, L(impellersGeo(), m.titanium)), 'compressor');
  P('Main shaft & bearings', {
    system: 'Propulsion', material: 'Steel shaft, three rolling-element bearings', mass: 6, count: 3, explode: [0, 0.55, -0.55],
    desc: 'One shaft carries the turbine, both impellers and the gearbox input pinion, turning at about 41,700 rpm at 100 % speed (TPE331-10 figure); three bearings support it (positions estimated).',
  }, L(mainShaftGeo(), m.pipe));
  P('Inlet screen', {
    system: 'Propulsion', material: 'Stainless wire screen', mass: 1, explode: [-0.25, 0.8, 0],
    desc: 'A mesh drum between the gearbox and the first compressor stage that keeps runway debris out of the impellers.',
  }, L(screenGeo(), m.darkMetal));
  role(P('Propeller reduction gearbox', {
    system: 'Propulsion', material: 'Aluminium case, steel gears', mass: 50, explode: [-0.55, 1.05, 0],
    desc: 'Steps the engine’s ≈ 41,700 rpm down to ≈ 1,590 propeller rpm (about 26:1 on the TPE331-10). Its offset output puts the propeller shaft above the engine centreline, and its pads drive the generators, governor and fuel control.',
  }, L(gearboxGeo(), m.gun)), 'gearbox');
  const inlet = [
    lru(0.55, 0.1, 0.26, [X(7.6), 1.87, 0], 0.04),
    pipe([[X(7.45), 1.84, 0], [X(7.85), 1.826, 0], [X(8.3), 1.825, 0], [X(8.52), 1.8, 0], [X(8.6), 1.76, 0]], 0.05, 10, 40).translate(0, -1.825, 0).scale(1, 0.4, 1).translate(0, 1.825, 0),
    new THREE.TorusGeometry(0.19, 0.03, 8, 32).rotateY(Math.PI / 2).translate(X(8.62), ENGINE_Y, 0),
  ];
  P('Engine air inlet & plenum', {
    system: 'Propulsion', material: 'Composite duct, aluminium plenum (layout approximate)', mass: 7, explode: [0, 1.6, 0],
    desc: 'A dorsal ram-air scoop feeds a flat duct over the engine and an annular plenum around the inlet screen, just ahead of the gearbox, where the TPE331 draws its air (scoop position from photographs; duct routing estimated).',
  }, [L(merge(inlet), m.skin), L(box(0.004, 0.07, 0.22, [X(7.6) + 0.279, 1.875, 0]), m.intake)]);
  role(P('Exhaust stacks', {
    system: 'Propulsion', material: 'Inconel', mass: 6, count: 2, explode: [0.2, 0.35, 0],
    desc: 'The TPE331’s exhaust leaves the end opposite the gearbox, so in this pusher it exits forward and is turned out through a stack on each side. Little jet thrust is left: the propeller does the work.',
  }, L(exhaustGeo(), m.hot)), 'exhaust');
  role(P('Oil cooler & scoop', {
    system: 'Propulsion', material: 'Aluminium matrix cooler, composite scoop (position approximate)', mass: 9, explode: [0, -0.7, 0],
    desc: 'Engine and gearbox oil rejects its heat to ram air through a ventral scoop and cooler matrix. At 15 km the air is thin, so the cooler is sized for climbing slowly at high power.',
  }, [L(merge([lru(0.6, 0.09, 0.22, [X(7.3), 1.165, 0], 0.03), box(0.13, 0.13, 0.22, [X(7.2), 1.27, 0])]), m.skin), L(box(0.004, 0.06, 0.18, [X(7.0) + 0.004, 1.155, 0]), m.intake)]), 'oil');
  role(P('Oil tank', {
    system: 'Propulsion', material: 'Aluminium tank with filler and sight gauge', mass: 4, explode: [0, 0.75, -0.6],
    desc: 'Holds the engine and gearbox lubricating oil (a few litres; size and position estimated). The same oil cools the bearings, lubricates the gears and works the propeller pitch change.',
  }, L(merge([cylX(XG + 0.03, XG + 0.29, 0.04, 0.04, 1.6, -0.25, 16), cylX(XG + 0.22, XG + 0.25, 0.018, 0.018, 1.645, -0.25, 8)]), m.alu)), 'oil');
  const oilLines = [];
  for (const [dz, dy] of [[0, 0], [0.035, 0.02]]) {
    oilLines.push(pipe([[XG + 0.12, 1.56 + dy, -0.22 + dz], [X(8.6), 1.43 + dy, -0.24 + dz], [X(8.1), 1.42 + dy, -0.25 + dz], [X(7.7), 1.36 + dy, -0.2 + dz], [X(7.35), 1.29 + dy, -0.09 + dz]], 0.008, 6, 40));
  }
  role(P('Engine oil lines', {
    system: 'Propulsion', material: 'Stainless tube and fire-sleeved hose', mass: 2, count: 2, explode: [0, -0.3, -0.75],
    desc: 'Supply and return lines between the engine’s oil system and the ventral oil cooler, through the firewall in fire-resistant fittings (routing estimated).',
  }, L(merge(oilLines), m.pipe)), 'oil');
  const fcu = [
    lru(0.14, 0.07, 0.09, [XG - 0.08, 1.465, 0]),
    pipe([[XG - 0.02, 1.45, 0.03], [X(8.9), 1.4, 0.1], [X(8.6), 1.37, 0.12], [X(8.4), 1.365, 0.15], [X(8.26), 1.37, 0.1], [X(8.22), 1.36, 0.05]], 0.006, 6, 30),
  ];
  role(P('Fuel control unit', {
    system: 'Propulsion', material: 'Engine-driven fuel pump and metering unit', mass: 6, explode: [-0.4, 0.4, 0.75],
    desc: 'The engine-driven high-pressure pump and fuel metering unit on the gearbox, at the end of the feed line from the collector tank; a metered line takes the fuel forward to the combustor manifold. The DEEC trims how much it meters (position approximate).',
  }, L(merge(fcu), m.darkMetal)), 'compressor');
  P('Propeller governor', {
    system: 'Propulsion', material: 'Flyweight governor and oil pump on the gearbox', mass: 3, explode: [-0.75, 0.85, 0.3],
    desc: 'Holds propeller speed constant: flyweights sense rpm and meter gearbox oil to the pitch-change piston, coarsening the blades when the engine speeds up (position approximate).',
  }, L(cylX(XG - 0.1, XG - 0.01, 0.035, 0.035, 1.765, 0.1, 14), m.gun));
  role(P('Ignition exciter', {
    system: 'Propulsion', material: 'Capacitor-discharge ignition unit', mass: 2, explode: [0.3, 1.0, -0.7],
    desc: 'Charges a capacitor and fires the two igniter plugs during the start through shielded leads; once the flame is self-sustaining the exciter switches off.',
  }, L(merge([lru(0.12, 0.05, 0.07, [X(8.1), ENGINE_Y + 0.21, -0.17]), ...[0.7, -0.7].map((a) => pipe([[X(8.1), ENGINE_Y + 0.21, -0.17], [XT0 - 0.09, ENGINE_Y + Math.cos(a) * 0.255, Math.sin(a) * 0.255]], 0.004, 5, 8))]), m.lruOlive)), 'generator');
  const egt = [new THREE.TorusGeometry(0.226, 0.005, 5, 40).rotateY(Math.PI / 2).translate(XT0 - 0.025, ENGINE_Y, 0)];
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    egt.push(tubeBetween([XT0 - 0.025, ENGINE_Y + Math.cos(a) * 0.2, Math.sin(a) * 0.2], [XT0 - 0.025, ENGINE_Y + Math.cos(a) * 0.235, Math.sin(a) * 0.235], 0.005, 5));
  }
  egt.push(pipe([[XT0 - 0.025, ENGINE_Y + 0.15, 0.17], [X(7.75), 1.68, 0.21], [X(7.62), 1.65, 0.2], [X(7.54), 1.62, 0.2]], 0.005, 5, 20));
  role(P('EGT thermocouple harness', {
    system: 'Propulsion', material: 'Chromel-alumel thermocouples on a ring harness', mass: 1, count: 8, explode: [0.95, 0.55, 0.5],
    desc: 'Probes in the gas path average the exhaust gas temperature, the TPE331’s key limit; the DEEC uses it to stop the engine over-temperaturing (probe count and position estimated).',
  }, L(merge(egt), m.copper)), 'turbine');
  P('Torque & speed pickups', {
    system: 'Propulsion', material: 'Torque sensor and magnetic speed pickup', mass: 1, count: 2, explode: [-0.55, 1.35, 0.3],
    desc: 'Torque measured inside the gearbox and engine speed from a magnetic pickup are what the crew’s power gauges show: shaft power = torque × rpm (positions estimated).',
  }, L(merge([cylX(XG + 0.12, XG + 0.2, 0.022, 0.022, ENGINE_Y + 0.19, -0.04, 10), cylX(XG + 0.06, XG + 0.1, 0.015, 0.015, ENGINE_Y + 0.19, 0.04, 10)]), m.darkMetal));
  P('DEEC engine control', {
    system: 'Propulsion', material: 'Digital electronic engine control unit', mass: 4, explode: [0.4, 0.75, 0.6],
    desc: 'The digital electronic engine control (developed by Honeywell and GA-ASI and first fitted to production Predator B aircraft) schedules fuel and propeller pitch for the commanded power and guards the temperature and torque limits, ahead of the firewall where it stays cool.',
  }, L(lru(0.08, 0.2, 0.2, [X(7.5), 1.6, 0.2]), m.lruOlive));
  P('Propeller drive shaft', {
    system: 'Propulsion', material: 'Steel shaft with flexible couplings', mass: 9, explode: [-1.0, 0.45, 0],
    desc: 'Carries up to 900 shp (671 kW) from the gearbox output to the propeller flange through the tail cone, with flexible couplings at both ends for misalignment (shaft length depends on the installation, estimated here).',
  }, L(shaftGeo(), m.titanium));
  const brg = [cylX(X(9.55) - 0.03, X(9.55) + 0.03, 0.06, 0.06, SHAFT_Y, 0, 18)];
  for (const a of [0.6, Math.PI - 0.6, -Math.PI / 2]) brg.push(tubeBetween([X(9.55), SHAFT_Y + Math.sin(a) * 0.06, Math.cos(a) * 0.06], fusePoint(9.55, a, 0.045), 0.01, 6));
  P('Shaft support bearing', {
    system: 'Propulsion', material: 'Sealed ball bearing in a braced housing', mass: 2, explode: [-1.3, 0.75, 0],
    desc: 'Holds the long drive shaft in the middle so it cannot whirl at propeller speed; three braces tie the housing to the fuselage frame (estimated).',
  }, L(merge(brg), m.darkMetal));
  const propSpin = new THREE.Group();
  propSpin.position.set(PROP_X, SHAFT_Y, 0);
  const hubSpin = new THREE.Group();
  hubSpin.position.copy(propSpin.position);
  const blades = merge(bladesGeo(3));
  blades.computeVertexNormals();
  P('Three-blade propeller', {
    system: 'Propulsion', material: 'Carbon-fibre composite blades (est.)', mass: 24, count: 3, explode: [-2.3, -1.0, 0],
    desc: 'A three-blade, variable-pitch pusher propeller about 2.6 m across (diameter estimated; the extended-range modification adds a fourth blade). Behind the wing and sensors it never blocks the view or disturbs the nose.',
    callout: true, anchor: [PROP_X + 0.03, SHAFT_Y - 0.38, -0.5],   // mid-blade, lower port quadrant of the disc
  }, propSpin);
  propSpin.add(L(blades, m.blade));
  P('Propeller hub & pitch control', {
    system: 'Propulsion', material: 'Aluminium hub, oil-operated pitch change', mass: 20, explode: [-1.75, -1.0, 0],
    desc: 'Holds the blade roots and twists them: oil pressure moves a piston in the dome to change pitch, which keeps the engine at constant speed as power and airspeed change.',
  }, hubSpin);
  hubSpin.add(L(hubGeo(3), m.darkMetal));
  P('Spinner', {
    system: 'Skin & fairings', skin: true, material: 'Composite spinner', mass: 4, explode: [-2.85, -1.0, 0],
    desc: 'Fairs the hub into the tail cone so the flow into the propeller roots stays smooth.',
  }, L(spinnerGeo().translate(PROP_X, SHAFT_Y, 0), m.skin));

  // ============================================================== fuel system
  // fuselage tank s 3.42–4.80, inset to clear the frames, longerons and the harness along the top
  const FT = [3.42, 4.8];
  const ftRings = [];
  for (const s of [3.42, 3.47, 3.7, 3.9, 4.1, 4.16, 4.4, 4.6, 4.75, 4.8]) {
    const yTop = s < 4.13 ? prof(s).top - 0.1 : 1.53;
    const shrink = s === FT[0] || s === FT[1] ? 0.085 : 0.06;
    const rr = [];
    for (let i = 0; i < 32; i++) {
      const p = fusePoint(s, -Math.PI / 2 + (i / 32) * Math.PI * 2, shrink);
      p[1] = Math.min(p[1], yTop - (shrink - 0.06));
      rr.push(p);
    }
    ftRings.push(rr);
  }
  const ftGeo = loftRings(ftRings, { capStart: true, capEnd: true, uvMode: 'metric' });
  P('Fuselage fuel tank', {
    system: 'Fuel', material: 'Crash-resistant bladder cell (est.)', mass: 26, explode: [0, -0.9, 0],
    desc: 'The main fuselage tank sits at the centre of gravity under and ahead of the wing box, so burning it barely moves the balance (≈ 480 L in this model; with the wing tanks the model holds ≈ 2,010 L, about 90 % of the published total). The USAF gives 4,000 lb (602 US gal) of fuel and GA-ASI 3,900 lb (1,769 kg); the current GA-ASI Block 5 sheet lists 3,800 lb (1,724 kg). The split between wing and fuselage tanks is not published.',
  }, L(applyOut(ftGeo), m.fuel));
  const FQ = []; // fuel quantity probes: capacitance tubes in every tank
  for (const s of [3.85, 4.55]) FQ.push(tubeBetween([X(s), prof(s).bot + 0.1, 0.12], [X(s), 1.5, 0.12], 0.012, 8));
  P('Collector tank', {
    system: 'Fuel', material: 'Aluminium collector tank with flapper valves (est.)', mass: 6, explode: [0, -0.5, 0.35],
    desc: 'Every tank feeds this small collector (≈ 25 L here), which is kept full so the engine never draws air when the aircraft banks or the main tanks run low (arrangement estimated).',
  }, L(lru(0.34, 0.2, 0.34, [X(6.73), 1.33, 0], 0.03), m.alu));
  P('Boost pumps', {
    system: 'Fuel', material: 'Electric centrifugal pumps (est.)', mass: 3, count: 2, explode: [0, -0.75, 0.6],
    desc: 'Two electric boost pumps on the collector push fuel to the engine-driven pump, so the high-pressure pump never starves at altitude; either one alone can feed the engine (arrangement estimated).',
  }, L(merge([1, -1].map((zs) => merge([cylX(X(6.86), X(6.6), 0.035, 0.035, 1.3, 0.205 * zs, 12), cylX(X(6.6), X(6.56), 0.02, 0.02, 1.3, 0.205 * zs, 8)]))), m.darkMetal));
  const wingFeeds = [], valves = [];
  for (const zs of [1, -1]) {
    // from the wing tank's inboard end, over the high roof of the main-gear well, down to the collector
    wingFeeds.push(pipe([wpt(0.62, 0.6, -1, 0.03).map((v, i) => (i === 2 ? v * zs : v)), [X(5.12), 1.62, 0.36 * zs], [X(5.3), 1.77, 0.17 * zs], [X(6.2), 1.775, 0.13 * zs], [X(6.5), 1.62, 0.1 * zs], [X(6.56), 1.4, 0.09 * zs]], 0.013, 6, 48));
    valves.push(lru(0.07, 0.05, 0.05, [X(6.25), 1.775, 0.13 * zs]), cylX(X(6.25) - 0.02, X(6.25) + 0.02, 0.018, 0.018, 1.815, 0.13 * zs, 10));
  }
  P('Wing feed lines', {
    system: 'Fuel', material: 'Aluminium tube with flexible joints at the wing root', mass: 3, count: 2, explode: [0, 0.35, 0.9],
    desc: 'Carry fuel from each wing tank across the wing joint, over the main-gear wells and down to the collector (routing estimated).',
  }, L(merge(wingFeeds), m.pipe));
  P('Fuselage tank feed line', {
    system: 'Fuel', material: 'Aluminium tube', mass: 1.5, explode: [0, -0.6, -0.4],
    desc: 'Runs from the fuselage tank’s sump along the keel, between the two gear wells, to the collector (routing estimated).',
  }, L(pipe([[X(4.78), 1.1, 0], [X(5.6), 1.13, 0], [X(6.3), 1.17, 0], [X(6.5), 1.21, 0], [X(6.56), 1.27, 0]], 0.013, 6, 40), m.pipe));
  P('Engine feed line', {
    system: 'Fuel', material: 'Stainless tube, fire-sleeved through the firewall', mass: 2, explode: [0, -0.4, 0.8],
    desc: 'Takes boosted fuel from the collector aft through the firewall and along the engine bay to the engine-driven fuel control on the gearbox (routing estimated).',
  }, L(pipe([[X(6.9), 1.3, 0.1], [X(7.2), 1.36, 0.2], [X(7.5), 1.4, 0.24], [X(7.75), 1.42, 0.23], [X(8.3), 1.42, 0.22], [X(8.6), 1.45, 0.24], [X(8.9), 1.45, 0.2], [X(8.99), 1.47, 0.06]], 0.012, 6, 60), m.pipe));
  P('Fuel shut-off valve', {
    system: 'Fuel', material: 'Motorised ball valve at the firewall', mass: 1, explode: [0.2, -0.6, 0.9],
    desc: 'Closes the engine feed at the firewall when the engine is shut down or in an engine-bay fire, so no fuel feeds the fire (position estimated).',
  }, L(merge([lru(0.07, 0.06, 0.06, [X(7.56), 1.4, 0.24]), cylX(X(7.56) - 0.02, X(7.56) + 0.02, 0.02, 0.02, 1.45, 0.24, 10)]), m.darkMetal));
  valves.push(lru(0.07, 0.05, 0.05, [X(6.25), 1.17, 0]));
  P('Transfer & crossfeed valves', {
    system: 'Fuel', material: 'Motorised valves (est.)', mass: 1.5, count: 3, explode: [0, 0.3, -0.7],
    desc: 'Motorised valves on each tank’s feed let the flight computers choose which tank feeds the collector, to keep the aircraft balanced side to side and fore and aft as fuel burns (positions estimated).',
  }, L(merge(valves), m.darkMetal));
  for (const zs of [1, -1]) for (const z of [1.5, 4.0, 6.5]) FQ.push(tubeBetween(wpt(z, 0.42, 1, 0.025).map((v, i) => (i === 2 ? v * zs : v)), wpt(z, 0.42, -1, 0.025).map((v, i) => (i === 2 ? v * zs : v)), 0.01, 6));
  P('Fuel quantity probes', {
    system: 'Fuel', material: 'Capacitance probes', mass: 1, count: 8, explode: [0, 1.1, 0],
    desc: 'Capacitance probes in every tank: fuel and air have different dielectric constants, so each probe’s capacitance tells how deep the fuel is around it. The readings give fuel remaining and the centre of gravity (counts estimated).',
  }, L(merge(FQ), m.alu));
  const drain = (p) => new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10).translate(p[0], p[1], p[2]);
  P('Fuel sump drains', {
    system: 'Fuel', material: 'Flush poppet drain valves', mass: 0.4, count: 4, explode: [0, -1.0, 0],
    desc: 'Drain valves at each tank’s low point, opened before flight to check for water and sediment, which sink below the fuel (positions estimated).',
  }, L(merge([drain([X(3.55), prof(3.55).bot - 0.002, 0]), drain([X(6.73), prof(6.73).bot - 0.002, 0]), ...[1, -1].map((zs) => drain(wpt(1.2, 0.5, -1, -0.002).map((v, i) => (i === 2 ? v * zs : v))))]), m.darkMetal));
  const caps = [];
  for (const zs of [1, -1]) caps.push(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 16).translate(...wpt(3.2, 0.42, 1, -0.002).map((v, i) => (i === 2 ? v * zs : v))));
  caps.push(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 16).translate(X(3.75), fusePoint(3.75, Math.PI / 2 - 0.45)[1] + 0.001, fusePoint(3.75, Math.PI / 2 - 0.45)[2]));
  P('Gravity refuel ports', {
    system: 'Fuel', material: 'Flush filler caps', mass: 1.5, count: 3, explode: [0, 1.7, 0],
    desc: 'Flush filler caps on each wing and the fuselage top for gravity refuelling at austere sites (positions estimated).',
  }, L(merge(caps), m.darkMetal));
  const vents = [];
  for (const zs of [1, -1]) {
    vents.push(pipe([wpt(8.3, 0.6, 1, 0.03), wpt(8.8, 0.55, 0, 0), wpt(9.1, 0.5, -1, 0.02)].map((p) => [p[0], p[1], p[2] * zs]), 0.008, 5, 16));
    vents.push(box(0.12, 0.012, 0.05, wpt(9.1, 0.5, -1, -0.002).map((v, i) => (i === 2 ? v * zs : v))));
  }
  P('Fuel vents', {
    system: 'Fuel', material: 'Vent lines to flush under-wing outlets (est.)', mass: 1, count: 2, explode: [0, -0.1, 2.6],
    desc: 'Vent lines let air into the tanks as fuel is used and let fuel expand in the heat on the ramp without straining the tanks.',
  }, L(merge(vents), m.pipe));

  // ============================================================== flight-control electronics and tail servos
  const fcc = [-0.24, -0.08, 0.08].map((z) => lru(0.42, 0.2, 0.14, [X(2.175), NFLOOR + 0.107, z]));
  P('Flight control computers', {
    system: 'Flight controls', material: 'Redundant flight computers', mass: 12, count: 3, explode: [0.9, 0.9, -0.3],
    desc: 'Redundant computers fly the aircraft: they hold attitude, altitude and speed, mix ruddervator commands and can land automatically. GA-ASI describes a triple-redundant flight control system on the Block 5.',
  }, L(merge(fcc), m.lru));
  A.root.updateMatrixWorld(true);
  for (const zs of [1, -1]) {
    const a = [X(9.33), 1.68, 0.15 * zs];
    const hinge = tailFrames[zs > 0 ? 0 : 1].localToWorld(vtPoint(0.12, 0.66, zs).clone());
    P(`Ruddervator servo (${SN(zs)})`, {
      system: 'Flight controls', material: 'Electromechanical actuator and pushrod (est.)', mass: 3, explode: [-0.3, 0.9, 0.65 * zs],
      desc: 'Drives its ruddervator through a pushrod to a horn near the root. The flight computers send each servo the mixed pitch-and-yaw command (position estimated).',
    }, L(merge([lru(0.18, 0.07, 0.09, a), tubeBetween([a[0] - 0.05, a[1], a[2]], [hinge.x, hinge.y, hinge.z], 0.007, 6)]), m.lruOlive));
  }
  const rudServo = vfPoint(0.25, 0.75);
  P('Ventral rudder servo', {
    system: 'Flight controls', material: 'Electromechanical actuator in the fin root (est.)', mass: 1.5, explode: [-0.4, -0.2, 0.9],
    desc: 'A small servo inside the root of the ventral fin works the ventral rudder through a short pushrod (position estimated).',
  }, L(merge([box(0.14, 0.03, 0.06, [-0.52, 0, 0.16]), tubeBetween([-0.46, 0, 0.16], [rudServo.x + 0.02, 0, rudServo.z], 0.006, 6)]), m.lruOlive), fin);

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
  const NG = { s: 2.0, y: 1.12, stow: -(Math.PI / 2 + 0.2) };
  const noseLeg = new THREE.Group();
  noseLeg.position.set(X(NG.s), NG.y, 0);
  const ngStrut = [
    new THREE.CylinderGeometry(0.035, 0.035, 0.2, 14).rotateX(Math.PI / 2),                 // trunnion
    tubeBetween([0, 0.01, 0], [0, -0.52, 0], 0.045, 14),                                       // outer cylinder
    tubeBetween([0, -0.5, 0], [0.025, -0.74, 0], 0.03, 12),                                    // sliding piston
    box(0.06, 0.05, 0.17, [0.03, -0.75, 0]),                                                   // fork crown
    box(0.05, 0.2, 0.022, [0.035, -0.85, 0.08]), box(0.05, 0.2, 0.022, [0.035, -0.85, -0.08]),
    box(0.035, 0.1, 0.03, [0, 0.05, 0.06]),                                                     // actuator horn
  ];
  P('Nose gear oleo strut', {
    system: 'Landing gear', material: 'Steel oleo-pneumatic strut and fork', mass: 16, explode: [0, -0.85, 0],
    desc: 'The nose leg’s shock absorber: oil forced through an orifice and a gas spring soak up the landing and taxi loads. It pivots on a trunnion at the top and retracts aft into the well (layout and retraction estimated).',
  }, noseLeg);
  noseLeg.add(L(merge(ngStrut), m.alu));
  P('Nose gear torque links', {
    system: 'Landing gear', material: 'Forged aluminium scissor links', mass: 1.5, count: 2, explode: [-0.3, -0.5, 0.3],
    desc: 'A hinged scissor between the outer cylinder and the piston: the piston can slide but not turn, so steering torque reaches the wheel.',
  }, L(merge([tubeBetween([-0.035, -0.44, 0], [-0.078, -0.585, 0], 0.012, 6), tubeBetween([-0.078, -0.585, 0], [-0.02, -0.72, 0], 0.012, 6), cylX(-0.09, -0.066, 0.012, 0.012, -0.585, 0, 8)]), m.alu), noseLeg);
  P('Nose gear steering actuator', {
    system: 'Landing gear', material: 'Electric steering motor on a collar (est.)', mass: 2.5, explode: [0.3, -0.5, 0.45],
    desc: 'Turns the nose leg so the remote pilot (or the automatic system) can steer on the ground. Steering is electric on this model; the real actuator type is not public.',
  }, L(merge([new THREE.TorusGeometry(0.058, 0.014, 6, 20).rotateX(Math.PI / 2).translate(0, -0.1, 0), lru(0.06, 0.05, 0.12, [-0.07, -0.1, 0.05]), cylX(-0.16, -0.1, 0.022, 0.022, -0.1, 0.09, 10)]), m.lruOlive), noseLeg);
  const nwheel = [new THREE.TorusGeometry(0.135, 0.065, 12, 28), new THREE.CylinderGeometry(0.1, 0.1, 0.1, 20).rotateX(Math.PI / 2)];
  P('Nose wheel & tyre', {
    system: 'Landing gear', material: 'Aluminium wheel, tubeless tyre', mass: 9, explode: [0.2, -0.3, 0.45],
    desc: 'A single nose wheel about 0.4 m in diameter (estimate). It takes only a small share of the weight but all of the steering loads.',
  }, [L(nwheel[0], m.rubber), L(nwheel[1], m.alu)], noseLeg).position.set(0.035, -0.92, 0);
  const lampG = merge([cylX(0.0, 0.04, 0.035, 0.03, 0, 0, 14), cylX(0.04, 0.045, 0.03, 0.03, 0, 0, 14)]);
  const lampPart = P('Landing & taxi light', {
    system: 'Electrical', material: 'LED lamp on the nose leg', mass: 1, explode: [0.35, -0.1, 0],
    desc: 'Lights the runway on approach and taxi and makes the aircraft visible to tower controllers; the pilot sees the runway through the nose camera.',
  }, [L(lampG, m.darkMetal)], noseLeg);
  lampPart.add(L(new THREE.CircleGeometry(0.028, 16).rotateY(Math.PI / 2).translate(0.046, 0, 0), m.lamp, { cast: false }));
  lampPart.position.set(0.05, -0.33, 0);
  // retraction actuator: from the well roof to the horn above the trunnion; it also braces the leg fore and aft when locked down
  const ngAct = makeActuator(0.024, 0.014, 0.32, m.darkMetal);
  const ngAnchor = new THREE.Vector3(X(2.6), 1.42, 0.06), ngHorn = new THREE.Vector3(0, 0.08, 0.06);
  P('Nose gear retraction actuator', {
    system: 'Landing gear', material: 'Electromechanical or electro-hydraulic actuator (type not public)', mass: 3, explode: [0, 0.35, 0.5],
    desc: 'Pushes on a horn above the trunnion to swing the leg aft and up; in this model it also braces the leg fore and aft when locked down. The real linkage and actuator type are not published.',
  }, ngAct.meshes);
  movers.push(() => ngAct.set(ngAnchor, ngHorn.clone().applyQuaternion(noseLeg.quaternion).add(noseLeg.position)));
  P('Nose gear uplock', {
    system: 'Landing gear', material: 'Spring-loaded hook with an electric release (est.)', mass: 1, explode: [0.2, 0.45, 0],
    desc: 'Catches the retracted leg so it cannot drop in flight and releases it for extension; a spring hook on the actuator’s end-stop holds it down (estimated).',
  }, L(merge([box(0.05, 0.16, 0.04, [X(2.66), NFLOOR - 0.09, -0.04]), box(0.06, 0.02, 0.04, [X(2.66) - 0.02, NFLOOR - 0.17, -0.04])]), m.darkMetal));

  // ---- main gear: trailing-arm legs, retracting aft into the wells
  // offsets from the trunnion with the leg down (x forward, starboard side; mirrored for port)
  const MG = { pivot: [4.97, 1.22, 0.17], knee: [0, -0.8, 0.6], axle: [-0.25, -0.94, 0.71], stow: [6.15, 1.41, 0.105] };
  const mainLegs = [];
  for (const side of [1, -1]) {
    const sd = SN(side);
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2] * side);
    const piv = new THREE.Group();
    piv.position.set(X(MG.pivot[0]), MG.pivot[1], MG.pivot[2] * side);
    const K = V(MG.knee), Ax = V(MG.axle);
    const stowDir = new THREE.Vector3(X(MG.stow[0]) - piv.position.x, MG.stow[1] - piv.position.y, (MG.stow[2] - MG.pivot[2]) * side).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(Ax.clone().normalize(), stowDir);
    const hingeAxis = new THREE.Vector3(q.x, q.y, q.z).normalize();
    const pin = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 14).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yup, hingeAxis));
    const at = (t) => K.clone().multiplyScalar(t);
    P(`Main gear strut (${sd})`, {
      system: 'Landing gear', material: 'High-strength steel strut and trunnion', mass: 18, explode: [0, -0.95, 0.75 * side],
      desc: 'The main leg of GA-ASI’s heavy-weight trailing-arm gear (announced 2012, fitted to Block 5): it pivots on a trunnion in the well and carries the trailing arm at its foot. The new gear raised landing-weight capacity by more than 30 % (retraction path estimated).',
    }, piv);
    piv.add(L(merge([tubeBetween([0, 0, 0], K.toArray(), 0.05, 14), pin, box(0.05, 0.06, 0.05, at(0.32).toArray()), box(0.05, 0.06, 0.05, at(0.5).add(new THREE.Vector3(-0.07, 0, 0)).toArray())]), m.alu));
    P(`Main gear trailing arm (${sd})`, {
      system: 'Landing gear', material: 'Forged steel arm with axle', mass: 9, explode: [-0.3, -1.2, 0.9 * side],
      desc: 'Pivots at the foot of the strut and trails the wheel behind it, so bumps swing the wheel up and back into the shock absorber instead of jarring the strut.',
    }, L(merge([tubeBetween(K.toArray(), Ax.toArray(), 0.042, 12), new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10).rotateX(Math.PI / 2).translate(K.x, K.y, K.z), new THREE.SphereGeometry(0.045, 12, 8).translate(Ax.x, Ax.y, Ax.z)]), m.alu), piv);
    const s0 = at(0.5).add(new THREE.Vector3(-0.07, 0, 0)), s1 = K.clone().lerp(Ax, 0.6).add(new THREE.Vector3(0, 0.04, 0));
    P(`Main gear shock absorber (${sd})`, {
      system: 'Landing gear', material: 'Sealed oil–spring shock absorber', mass: 5, explode: [-0.35, -0.8, 1.1 * side],
      desc: 'Runs from the strut to the trailing arm and absorbs the landing energy. GA-ASI describes it as maintenance-free, with no nitrogen to service.',
    }, L(merge([tubeBetween(s0.toArray(), s0.clone().lerp(s1, 0.6).toArray(), 0.034, 12), tubeBetween(s0.clone().lerp(s1, 0.55).toArray(), s1.toArray(), 0.02, 10)]), m.darkMetal), piv);
    const brakeLine = [];
    for (let k = 0; k <= 6; k++) brakeLine.push(at(k / 6).add(new THREE.Vector3(0.055, 0.02, 0)).toArray());
    brakeLine.push(K.clone().lerp(Ax, 0.5).add(new THREE.Vector3(0.0, 0.05, 0)).toArray(), Ax.clone().add(new THREE.Vector3(0.0, 0.07, -0.02 * side)).toArray());
    P(`Brake line & harness (${sd})`, {
      system: 'Landing gear', material: 'Flexible brake hose and sensor wiring (est.)', mass: 1, explode: [0.25, -0.9, 1.0 * side],
      desc: 'Runs down the leg to the wheel brake and carries the wheel-speed and weight-on-wheels signals back up; the automatic landing system uses them (routing estimated; brake actuation type not public).',
    }, L(pipe(brakeLine, 0.007, 5, 40), m.harness), piv);
    const w = [new THREE.TorusGeometry(0.2, 0.08, 14, 32), merge([new THREE.CylinderGeometry(0.15, 0.15, 0.13, 24).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12).rotateX(Math.PI / 2).translate(0, 0, -0.02 * side)]), new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20).rotateX(Math.PI / 2).translate(0, 0, -0.07 * side)];
    const wheel = P(`Main wheel & brake (${sd})`, {
      system: 'Landing gear', material: 'Aluminium wheel, carbon/steel brake, tubeless tyre', mass: 22, explode: [0, -0.15, 0.4 * side],
      desc: 'Main wheel about 0.56 m in diameter with a multi-disc brake (sizes estimated). The brakes are commanded from the ground station or by the automatic landing system; the wheel turns upright as it enters the well (estimated).',
    }, [L(w[0], m.rubber), L(w[1], m.alu), L(w[2], m.darkMetal)], piv);
    wheel.position.set(Ax.x, Ax.y, Ax.z + 0.065 * side);
    // retraction actuator from the well's forward upper corner to a lug on the strut
    const act = makeActuator(0.032, 0.018, 0.3, m.darkMetal);
    const anchor = new THREE.Vector3(X(4.92), 1.45, 0.3 * side), lug = at(0.32);
    P(`Main gear retraction actuator (${sd})`, {
      system: 'Landing gear', material: 'Actuator (type not public)', mass: 4, explode: [0.3, 0.4, 0.8 * side],
      desc: 'Pulls the strut aft and up into the well and holds it locked down for landing (geometry and actuator type estimated).',
    }, act.meshes);
    movers.push(() => act.set(anchor, lug.clone().applyQuaternion(piv.quaternion).add(piv.position)));
    // uplock on the well roof, where the stowed trailing arm comes to rest
    const kS = K.clone().applyQuaternion(q).add(piv.position);
    const roof = 5.5 - kS.x > MSTEP ? MROOF[1] : MROOF[0];
    P(`Main gear uplock (${sd})`, {
      system: 'Landing gear', material: 'Spring-loaded hook with an electric release (est.)', mass: 1, explode: [0, 0.5, 0.6 * side],
      desc: 'Hooks the trailing arm when the leg is up so the gear cannot drop in flight; the release opens it for extension (position estimated).',
    }, L(merge([box(0.06, roof - kS.y - 0.04, 0.04, [kS.x, (roof + kS.y + 0.04) / 2, kS.z]), box(0.07, 0.02, 0.05, [kS.x - 0.02, kS.y + 0.05, kS.z])]), m.darkMetal));
    mainLegs.push({ piv, wheel, q, qw: q.clone().invert() });
  }

  // gear doors: conformal skin patches; the nose doors hinge on their outer edges, the main doors on the keel
  const doors = [];
  const doorPart = (name, s0, s1, th0, th1, hingeOn, info) => {
    const g = skinPatch(s0, s1, th0, th1);
    const th = hingeOn === 'outer' ? th1 : th0;
    const p0 = new THREE.Vector3(...fusePoint(s0, th)), p1 = new THREE.Vector3(...fusePoint(s1, th));
    const h = hingedMesh(g, m.skinDouble, p0, p1);
    h.mesh.castShadow = true;
    P(name, { system: 'Landing gear', skin: true, material: 'Composite doors (est.)', ...info }, h.pivot);
    return h;
  };
  for (const side of [1, -1]) {
    const sd = SN(side);
    const mainDoor = doorPart(`Main gear door (${sd})`, 4.9, 6.46, -Math.PI / 2 + 0.035 * side, -Math.PI / 2 + 1.02 * side, 'keel', {
      mass: 5, explode: [0, -0.6, 0.55 * side],
      desc: 'A long door hinged along the keel that closes the main-gear well in flight to keep the underside smooth. It opens before the leg moves and closes after it is up (sequencing estimated).',
    });
    doors.push({ h: mainDoor, sign: -side, open: 1.5 });
    doors.push({ h: doorPart(`Nose gear door (${sd})`, 1.92, 3.08, -Math.PI / 2 + 0.02 * side, -Math.PI / 2 + 0.42 * side, 'outer', {
      mass: 1.5, explode: [0, -0.55, 0.35 * side], desc: 'One of a pair of nose-gear doors hinged along the outer edge of the well, linked to open with the leg.',
    }), sign: side, open: 1.45 });
    // door actuator: keel wall to a lug on the door's inner face
    const act = makeActuator(0.016, 0.009, 0.16, m.darkMetal);
    const anchor = new THREE.Vector3(X(5.7), 1.36, 0.06 * side);
    const lugClosed = new THREE.Vector3(...fusePoint(5.7, -Math.PI / 2 + 0.3 * side, 0.012));
    const p0 = mainDoor.pivot.position.clone();
    P(`Main gear door actuator (${sd})`, {
      system: 'Landing gear', material: 'Small linear actuator (est.)', mass: 1, explode: [0, -0.2, 0.45 * side],
      desc: 'Opens and closes the main-gear door in sequence with the leg (position and type estimated).',
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
    callout: true, anchor: [X(1.08) + 0.27, 0.635, 0],   // the front of the ball
  }, turret);
  P('MTS-B electronics unit', {
    system: 'Sensors', material: 'Electronics unit', mass: 15, explode: [0.55, 0.3, 0.75],
    desc: 'Processes the turret’s video, drives the gimbal and fires the laser; the turret and this unit are bought and upgraded as a pair (location estimated).',
  }, L(lru(0.6, 0.17, 0.12, [X(2.4), 1.255, 0.26]), m.lruOlive));
  // Lynx SAR
  const lynx = new THREE.Group();
  lynx.position.set(X(0.48), 1.24, 0);
  const lynxAz = new THREE.Group();
  lynx.add(lynxAz);
  lynxAz.add(L(merge([box(0.035, 0.21, 0.42, [0.1, 0, 0], [0, 0, -0.32]), box(0.05, 0.05, 0.36, [0.06, 0, 0])]), m.lruOlive));
  lynxAz.add(L(merge([box(0.03, 0.07, 0.03, [0.03, 0, 0.17]), box(0.03, 0.07, 0.03, [0.03, 0, -0.17]), new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16).translate(0, -0.06, 0)]), m.darkMetal));
  lynx.add(L(merge([tubeBetween([0, -0.1, 0], [X(0.95) - X(0.48), -0.12, 0], 0.025, 8), tubeBetween([0, -0.1, 0.08], [X(0.95) - X(0.48), -0.06, 0.16], 0.015, 6), tubeBetween([0, -0.1, -0.08], [X(0.95) - X(0.48), -0.06, -0.16], 0.015, 6)]), m.darkMetal));
  P('AN/APY-8 Lynx SAR antenna', {
    system: 'Sensors', material: 'Gimballed Ku-band antenna', mass: 30, explode: [1.35, 0, 0],
    desc: 'General Atomics’ Lynx synthetic-aperture radar (developed with Sandia National Laboratories) images the ground through cloud, smoke and darkness, down to about 10 cm resolution in spotlight mode, and tracks moving vehicles.',
    callout: true, anchor: [X(0.48) + 0.03, 1.34, 0.2],
  }, lynx);
  P('Lynx radar electronics', {
    system: 'Sensors', material: 'Radar electronics unit', mass: 22, explode: [0.9, -0.15, 0.6],
    desc: 'Transmitter, receiver and the image-forming processor. Lynx’s antenna, gimbal and electronics together weigh about 52 kg.',
  }, L(lru(0.36, 0.18, 0.44, [X(1.65), 1.2, 0]), m.lruOlive));
  P('Pilot nose camera', {
    system: 'Sensors', material: 'Fixed colour camera behind an optical window (position approximate)', mass: 3, explode: [1.9, 0.2, 0],
    desc: 'A fixed forward-looking camera gives the remote pilot a view ahead for take-off and landing, the only phases flown on the short-delay line-of-sight link.',
  }, [L(lru(0.12, 0.08, 0.08, [X(0.16), 1.36, 0]), m.darkMetal), L(new THREE.CircleGeometry(0.032, 18).rotateY(Math.PI / 2).translate(X(0.0) - 0.003, 1.355, 0), m.glass, { cast: false })]);
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
  dishG.add(L(merge([new THREE.CylinderGeometry(0.03, 0.05, 0.42, 12).translate(0, -0.24, 0), new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20).translate(0, -0.43, 0)]), m.darkMetal));
  P('Ku-band SATCOM antenna', {
    system: 'Communications', material: 'Steerable reflector on a two-axis pedestal', mass: 30, explode: [1.45, 2.05, 0],
    desc: 'Tracks a geostationary satellite to carry control and sensor video beyond line of sight. The satellite hops alone add at least half a second of delay (35,786 km up and down, twice); with the ground relays the control loop takes over a second, so crews in the US can fly aircraft overseas, but not land them.',
    callout: true, anchor: [X(1.15) + 0.35, 1.85, 0.15],
  }, dishG);
  P('Ku-band SATCOM modem', {
    system: 'Communications', material: 'Modem and RF unit', mass: 8, explode: [1.0, 1.0, -0.4],
    desc: 'Encodes the command uplink and the high-rate sensor downlink for the satellite channel, next to the dish to keep the RF runs short (location estimated).',
  }, L(lru(0.3, 0.2, 0.28, [X(1.7), NFLOOR + 0.107, -0.17]), m.lru));
  P('Air data computer', {
    system: 'Avionics', material: 'Air data computer', mass: 3, explode: [1.0, 0.95, 0.45],
    desc: 'Turns the pitot and static pressures into airspeed, altitude and vertical speed for the flight computers.',
  }, L(lru(0.24, 0.12, 0.2, [X(1.7), NFLOOR + 0.067, 0.18]), m.lru));
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
  }, L(lru(0.26, 0.12, 0.13, [X(2.64), NFLOOR + 0.067, 0]), m.lru));
  P('C-band datalink transceiver', {
    system: 'Communications', material: 'Line-of-sight datalink radio', mass: 10, explode: [0.3, 1.0, -0.55],
    desc: 'The line-of-sight C-band link used by the launch-and-recovery crew at the airfield: short delay for hand-flown take-offs and landings, but only to the radio horizon.',
  }, L(lru(0.26, 0.22, 0.28, [X(3.26), NFLOOR + 0.117, -0.16]), m.lru));
  P('ARC-210 V/UHF radios', {
    system: 'Communications', material: 'Two software-defined VHF/UHF radios', mass: 11, count: 2, explode: [0.3, 1.05, 0.55],
    desc: 'Two ARC-210 radios relay voice between the crew and air-traffic control or troops on the ground, through the wingtip antennas (Block 5 fit).',
  }, L(merge([lru(0.26, 0.12, 0.25, [X(3.26), NFLOOR + 0.067, 0.15]), lru(0.26, 0.12, 0.25, [X(3.26), NFLOOR + 0.192, 0.15])]), m.lruOlive));
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

  // ============================================================== electrical
  role(P('Starter-generator', {
    system: 'Electrical', material: 'Engine-driven starter-generator', mass: 22, explode: [-0.75, 0.6, 0.45],
    desc: 'Spins the engine for starting, then becomes the main generator. Block 5 aircraft have a higher-capacity unit to power the added radios and links: NAVAIR lists 11 kW / 45 kVA for the Block 5, with a redundant flight-critical bus, and GA-ASI’s Block 5 sheet gives 45 kVA main power.',
  }, L(merge([cylX(X(STATIONS.gear1), X(STATIONS.gear1) - 0.26, 0.085, 0.085, 1.58, 0.135, 20), box(0.08, 0.03, 0.06, [X(STATIONS.gear1) - 0.15, 1.68, 0.135])]), m.darkMetal)), 'generator');
  role(P('Backup generator', {
    system: 'Electrical', material: 'Engine-driven alternator', mass: 12, explode: [-0.75, 0.6, -0.45],
    desc: 'A second, independent generator able to run every flight-critical system: the GA-ASI Block 5 sheet gives 4 kW of backup power. With the battery it gives the Block 5 aircraft three independent power sources.',
  }, L(cylX(X(STATIONS.gear1), X(STATIONS.gear1) - 0.22, 0.07, 0.07, 1.58, -0.135, 18), m.darkMetal)), 'generator');
  role(P('Main batteries', {
    system: 'Electrical', material: 'Sealed rechargeable batteries (est.)', mass: 28, count: 2, explode: [0.3, -0.6, 0.45],
    desc: 'Keep the flight-critical systems running if both generators fail, and power the avionics before engine start (type and capacity not published).',
  }, L(merge([lru(0.24, 0.17, 0.16, [X(3.26), 1.21, 0.18]), lru(0.24, 0.17, 0.16, [X(3.26), 1.21, -0.18])]), m.lruOlive)), 'battery');
  P('Power distribution units', {
    system: 'Electrical', material: 'Solid-state power controllers', mass: 12, count: 2, explode: [0, 0.8, 0.6],
    desc: 'Switch and protect each electrical load and shed non-essential ones automatically when a generator drops out.',
  }, L(merge([lru(0.22, 0.14, 0.16, [X(7.15), 1.55, 0.2]), lru(0.22, 0.14, 0.16, [X(7.15), 1.55, -0.2])]), m.lru));
  // harness runs, each its own part so a student can follow power and data from source to load
  const topRun = (s0, s1, side, inset = 0.02, step = 0.25) => { const pts = []; for (let q = s0; q <= s1 + 1e-6; q += step) pts.push(fusePoint(q, Math.PI / 2 - 0.5 * side, inset)); return pts; };
  const avh = [];
  for (const zs of [1, -1]) {
    avh.push(pipe(topRun(1.3, 3.45, zs), 0.012, 6, 60));
    avh.push(pipe([fusePoint(1.3, Math.PI / 2 - 0.5 * zs, 0.02), [X(1.35), 1.55, 0.3 * zs], [X(1.55), 1.3, 0.25 * zs]], 0.009, 5, 16));
    for (const [q, y, z] of [[2.175, NFLOOR + 0.21, 0.24], [2.64, NFLOOR + 0.17, 0.2], [3.26, NFLOOR + 0.25, 0.16]]) avh.push(tubeBetween(fusePoint(q, Math.PI / 2 - 0.5 * zs, 0.02), [X(q), y, z * zs], 0.007, 5));
    avh.push(pipe([fusePoint(3.35, Math.PI / 2 - 0.5 * zs, 0.02), [X(3.36), 1.6, 0.33 * zs], [X(3.34), 1.3, 0.25 * zs]], 0.009, 5, 16));
  }
  avh.push(pipe([[X(1.55), 1.3, -0.25], [X(1.2), 1.12, -0.12], [X(1.08), 1.03, -0.05]], 0.009, 5, 16));
  P('Avionics bay harness', {
    system: 'Electrical', material: 'Shielded copper harness and data buses (est.)', mass: 18, explode: [0.3, 1.25, 0],
    desc: 'Runs along both sides of the avionics bay roof, dropping to each rack, the batteries, the radar and the turret. Port and starboard runs are kept apart so one chafed bundle cannot take out both channels (routing estimated).',
  }, L(merge(avh), m.harness));
  const feeders = [];
  for (const zs of [1, -1]) {
    feeders.push(pipe([...topRun(3.45, 6.95, zs), [X(7.1), 1.7, 0.2 * zs], [X(7.15), 1.63, 0.2 * zs]], 0.012, 6, 80));
  }
  P('Main power feeders', {
    system: 'Electrical', material: 'Heavy-gauge power cables (est.)', mass: 16, count: 2, explode: [0, 1.45, 0],
    desc: 'Two independent power feeders from the distribution units, over the fuel tank and the gear wells to the avionics bay, one per bus: the Block 5 has a redundant flight-critical bus (routing estimated).',
  }, L(merge(feeders), m.harness));
  const sideRun = (s0, s1, th, inset = 0.04) => { const pts = []; for (let q = s0; q <= s1 + 1e-6; q += 0.2) pts.push(fusePoint(q, th, inset)); return pts; };
  const ebh = [
    pipe([[X(7.2), 1.62, 0.2], [X(7.4), 1.64, 0.2], [X(7.54), 1.62, 0.2]], 0.012, 6, 16),
    pipe([[X(7.54), 1.62, 0.2], [X(7.7), 1.66, 0.28], ...sideRun(7.9, 8.9, 0.3), [X(9.05), 1.62, 0.2]], 0.012, 6, 60),
    pipe([[X(7.4), 1.62, -0.2], [X(7.7), 1.66, -0.28], ...sideRun(7.9, 8.9, Math.PI - 0.3), [X(9.05), 1.62, -0.2]], 0.01, 6, 60),
    pipe([fusePoint(8.1, Math.PI - 0.3, 0.04), [X(8.1), ENGINE_Y + 0.21, -0.2]], 0.007, 5, 8),
  ];
  P('Engine bay harness', {
    system: 'Electrical', material: 'Fire-resistant harness (est.)', mass: 8, explode: [0, 0.55, -1.0],
    desc: 'Carries power and signals through the firewall to the engine control, igniter exciter, generators and engine sensors, in fire-resistant sleeving because it runs beside the hot section (routing estimated).',
  }, L(merge(ebh), m.harness));
  const th = [
    pipe([fusePoint(8.9, 0.3, 0.04), [X(9.15), 1.69, 0.22], [X(9.25), 1.68, 0.17]], 0.008, 5, 12),
    pipe([fusePoint(8.9, Math.PI - 0.3, 0.04), [X(9.15), 1.69, -0.22], [X(9.25), 1.68, -0.17]], 0.008, 5, 12),
    pipe([fusePoint(8.9, Math.PI - 0.3, 0.04), [X(9.15), 1.52, -0.2], [X(9.35), 1.47, -0.07], [X(9.46), 1.42, -0.01]], 0.007, 5, 16),
  ];
  P('Tail harness', {
    system: 'Electrical', material: 'Shielded harness (est.)', mass: 3, explode: [-0.6, 0.6, 0],
    desc: 'Power and command signals for the two ruddervator servos and the ventral rudder servo in the fin root (routing estimated).',
  }, L(merge(th), m.harness));
  P('Generator control unit', {
    system: 'Electrical', material: 'Voltage regulator and protection unit (est.)', mass: 4, explode: [0, 0.75, -0.75],
    desc: 'Regulates the generators’ output and trips a faulty one off line, so the distribution units can shed load and keep the flight-critical bus alive (position estimated).',
  }, L(lru(0.18, 0.12, 0.14, [X(7.4), 1.62, -0.2]), m.lru));
  P('Ground power receptacle', {
    system: 'Electrical', material: 'External power socket behind a flush door (position estimated)', mass: 1, explode: [0, -0.2, -0.75],
    desc: 'Where the ground crew plugs in external power, so the avionics can run and be checked before engine start without draining the batteries (position estimated).',
  }, [L(lru(0.1, 0.06, 0.06, [X(7.15), 1.3, -0.265]), m.darkMetal), L(skinPatch(7.1, 7.2, Math.PI + 0.65, Math.PI + 0.85, 0.003, 2, 2), m.dark)]);
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
  }, L(merge([cylX(X(2.45), X(2.25), 0.06, 0.06, 1.22, -0.255, 18), cylX(X(2.4), X(2.3), 0.035, 0.035, 1.22, -0.255, 12)]), m.alu));
  P('Avionics cooling ducts', {
    system: 'Environmental control', material: 'Aluminium and composite ducts (layout approximate)', mass: 4, explode: [0.55, -0.35, -0.55],
    desc: 'Duct the cooling air forward to the radar electronics, up to the flight computers and aft to the radios. At altitude the air is cold but thin, so the ducts are sized for hot days on the ramp.',
  }, L(merge([
    pipe([[X(2.25), 1.22, -0.255], [X(2.0), 1.3, -0.25], [X(1.8), 1.37, -0.05], [X(1.6), 1.38, 0.2]], 0.033, 8, 24),
    pipe([[X(2.15), 1.25, -0.27], [X(2.05), 1.36, -0.28], [X(2.0), 1.47, -0.25]], 0.025, 8, 12),
    pipe([[X(2.45), 1.22, -0.255], [X(2.6), 1.3, -0.27], [X(2.75), 1.45, -0.28], [X(2.85), 1.56, -0.28], [X(3.08), 1.6, -0.25]], 0.028, 8, 24),
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
    enPanels.push(panel(8.18, 8.95, T(0.3), T(0.85)));
  }
  P('Avionics bay access panels', {
    system: 'Skin & fairings', skin: true, material: 'Removable composite panels on quarter-turn fasteners (layout estimated)', mass: 4, count: 4, explode: [0.3, 0.25, 1.6],
    desc: 'Removable panels on each side of the avionics bay: the upper ones open the racks above the floor, the lower ones the radar, turret and battery bay below it. Line units are swapped through them in minutes (layout and fastener count estimated).',
  }, L(merge(avPanels), panelMat));
  role(P('Engine bay access doors', {
    system: 'Skin & fairings', skin: true, material: 'Composite doors with titanium-faced edges (layout estimated)', mass: 4, count: 2, explode: [-0.2, 0.6, 1.6],
    desc: 'Hinged doors over the upper engine bay for daily oil checks and inspections without removing the cowling (layout estimated).',
  }, L(merge(enPanels), panelMat)), 'cowling');

  // ============================================================== markings
  A.root.updateMatrixWorld(true);
  const firstMesh = (part) => { let r = null; part.traverse((o) => { if (!r && o.isMesh) r = o; }); return r; };
  const aftMesh = firstMesh(aftSkin), fwdMesh = firstMesh(fwdSkin);
  for (const side of [1, -1]) {
    aftSkin.add(decal(aftMesh, danger('DANGER · PROPELLER'), { at: fusePoint(9.2, side > 0 ? 0.05 : Math.PI - 0.05), dir: [0, 0, side], size: [0.75, 0.24, 0.4], roughness: 0.5 }));
    aftSkin.add(decal(aftMesh, insignia(), { at: fusePoint(7.1, side > 0 ? 0.12 : Math.PI - 0.12), dir: [0, 0.1, side], size: [0.95, 0.48, 0.4] }));
    fwdSkin.add(decal(fwdMesh, wideStencil('U.S. AIR FORCE', 'rgba(52,58,64,0.88)'), { at: fusePoint(3.0, side > 0 ? 0.25 : Math.PI - 0.25), dir: [0, 0.25, side], size: [1.1, 0.14, 0.3] }));
    aftSkin.add(decal(aftMesh, sootStreak(), { at: fusePoint(8.55, side > 0 ? -0.05 : Math.PI + 0.05), dir: [0, -0.05, side], size: [1.3, 0.3, 0.4], angle: side > 0 ? Math.PI : 0, roughness: 0.8 }));
  }

  A.finalize();

  // ============================================================== behaviour
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORES = {
    clean: { gbu: false, hellfire: false },
    hellfire: { gbu: false, hellfire: true },
    strike: { gbu: true, hellfire: true },
  };
  const state = { airborne: 0, airTarget: 0, throttle: 0.4, altitude: 7600, laser: false, roll: 0, pitch: 0, yaw: 0, propA: 0, stores: 'strike' };
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
      ['Empty weight', '2,223 kg (4,900 lb)'], ['Max take-off weight', '4,760 kg (10,500 lb)'], ['Internal fuel', '≈ 1,800 kg (4,000 lb, 602 US gal, USAF); GA-ASI Block 5: 1,724 kg (3,800 lb)'],
      ['Payload', '1,701 kg (3,750 lb, USAF). GA-ASI: 386 kg (850 lb) internal + 1,361 kg (3,000 lb) external; Block 5 sheet: 1,701 kg external'], ['Engine', 'Honeywell TPE331-10GD turboprop, 900 shp (671 kW); 1.09 m long, 175 kg dry'],
      ['Propeller', '3-blade variable-pitch pusher (≈ 2.6 m, estimate)'], ['Cruise speed', '313 km/h (169 kt); USAF quotes ≈ 370 km/h'],
      ['Max speed', '482 km/h (260 kt); GA-ASI quotes 444 km/h (240 KTAS)'], ['Ceiling', '15,240 m (50,000 ft, USAF and GA-ASI); current GA-ASI Block 5 sheet: 13,716 m (45,000 ft)'],
      ['Endurance', '27 h clean (GA-ASI); current Block 5 sheet: 26 h'], ['Range', '1,850 km (1,000 nmi, USAF)'],
      ['Stores stations', '7: six under-wing, one centreline'], ['Wing station ratings', '1,500 / 600 / 200 lb inboard / middle / outboard (USAF T.O. figures as reported: 1,500 / 750 / 150 lb)'], ['Electrical power', '45 kVA main, 4 kW backup (Block 5)'], ['Crew', '2 remote: pilot and sensor operator'],
    ],
    heroStats: [['27', 'h', 'Endurance'], ['15.2', 'km', 'Ceiling'], ['1,701', 'kg', 'Payload']],
    sources: 'USAF MQ-9 Reaper fact sheet (af.mil); GA-ASI MQ-9A and MQ-9A Block 5 specification sheets; NAVAIR MQ-9A product page; DOT&E annual reports FY2011 and FY2017; NASA Ikhana (Predator B) fact sheets; GA-ASI releases on the trailing-arm main gear (2012) and the Block 5 electrical system; Honeywell TPE331-10 data (via Wikipedia); Lockheed Martin M299 and Marvin Engineering M299/M310 launcher data; Defense Update and Flight International on the Lynx AN/APY-8; Aerospace America (2016) on Reaper icing; Wikipedia articles on the MQ-9, TPE331, GBU-12 and AGM-114. Internal layout, retraction kinematics and component masses are estimates.',
    fleetTag: '27 h loiter',
    aero: true,
    root: A.root,
    parts: A.parts,
    view: { dir: [0.9, 0.5, 1.3], fill: 0.95 },
    displaySize: 11.5,
    thermalRange: [230, 560],
    state,
    // aircraft-frame points the endurance lab hangs its force arrows on (add root.children[0].position)
    cg: [X(4.55), 1.55, 0],
    propHub: [PROP_X, SHAFT_Y, 0],
    setAirborne(v) { state.airTarget = v ? 1 : 0; },
    setLaser(v) { state.laser = !!v; },
    setStick({ roll = 0, pitch = 0, yaw = 0 } = {}) { state.roll = roll; state.pitch = pitch; state.yaw = yaw; },
    /** Stores fit shown on the model: 'clean', 'hellfire' (4 × AGM-114) or 'strike' (+ 2 × GBU-12). */
    setStores(key) {
      const fit = STORES[key] || STORES.strike;
      state.stores = STORES[key] ? key : 'strike';
      for (const p of storeParts.gbu) p.visible = fit.gbu;
      for (const p of storeParts.hellfire) p.visible = fit.hellfire;
      for (const p of storeParts.launcher) p.visible = fit.hellfire;
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
      for (const ml of mainLegs) { ml.piv.quaternion.slerpQuaternions(qI, ml.q, g); ml.wheel.quaternion.slerpQuaternions(qI, ml.qw, g); }
      for (const dr of doors) dr.h.setAngle(dr.open * (1 - d) * dr.sign);
      for (const fn of movers) fn();
      // propeller: shown at a slow, alias-free rate (the real one turns ≈ 1,600 rpm)
      state.propA += dt * (5 + state.throttle * 22);
      propSpin.rotation.x = state.propA;
      hubSpin.rotation.x = state.propA;
      // sensors: turret scan, Lynx sweep, SATCOM dish tracking
      tAz.rotation.y = Math.sin(t * 0.22) * 1.1;
      tEl.rotation.z = -0.3 - Math.sin(t * 0.15) * 0.2 - a * 0.45;
      lynxAz.rotation.y = Math.sin(t * 0.5) * 0.6;
      dishAz.rotation.y = Math.sin(t * 0.07) * 0.5;
      beamMat.opacity = state.laser ? 0.5 : 0;
      m.laser.emissiveIntensity = state.laser ? 6 : 0.8;
      // controls: ailerons antisymmetric, ruddervators mix pitch and yaw, flaps out during the transition
      const roll = state.roll, pitch = state.pitch, yaw = state.yaw;
      for (const { h } of surf.ail) h.setAngle(-roll * 18 * deg);
      const flap = 18 * Math.sin(Math.PI * Math.min(1, Math.max(0, a)));
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

