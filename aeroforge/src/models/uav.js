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
import { ENGINE_Y, SHAFT_Y, PROP_X, STATIONS, turbineGeo, compressorGeo, gearboxGeo, shaftGeo, exhaustGeo, bladesGeo, hubGeo, spinnerGeo } from './mq9/powerplant.js';
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
    rubber: M.rubber(), intake: M.intake(),
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
  const fwdFrames = [hoop(0.95, { from: -Math.PI, to: 0, n: 20 }), ...[2.05, 2.6, 3.15, 3.6].map((s) => hoop(s))];
  P('Forward fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 45, count: 5, explode: [0.4, 0.45, 0],
    desc: 'Ring frames that hold the nose shape and carry the radome, nose gear and avionics shelf loads into the longerons. The lower arc at the front carries the Lynx radome ring.',
  }, L(merge(fwdFrames), m.frame));
  const aftFrames = [4.25, 5.25, 6.3, 6.95, 8.25, 8.9, 9.55, 10.05].map((s) => hoop(s, { h: s > 9 ? 0.035 : 0.045 }));
  P('Centre & aft fuselage frames', {
    system: 'Structure', material: 'Composite and aluminium ring frames (est.)', mass: 48, count: 8, explode: [-0.3, 0.45, 0],
    desc: 'Frames at the wing spars, main-gear bays, engine mounts and tail roots. The frames at the front and rear spar positions take the wing’s lift into the body.',
  }, L(merge(aftFrames), m.frame));
  const longerons = [0.62, Math.PI - 0.62, -0.78, -Math.PI + 0.78].map((th) => {
    const pts = [];
    for (let s = 0.95; s <= 10.0; s += 0.45) pts.push(fusePoint(s, th, 0.04));
    return pipe(pts, 0.012, 6, 64);
  });
  P('Fuselage longerons', {
    system: 'Structure', material: 'Carbon-fibre composite (est.)', mass: 30, count: 4, explode: [0, 0.6, 0],
    desc: 'Four longitudinal members tie the frames together and carry fuselage bending from the heavy nose sensors and the engine at the tail through the wing attachment.',
  }, L(merge(longerons), m.composite));
  const shelf = [
    box(1.9, 0.014, 0.76, [X(2.45), 1.345, 0]),
    box(1.0, 0.3, 0.01, [X(2.4), 1.18, 0.19]), box(1.0, 0.3, 0.01, [X(2.4), 1.18, -0.19]),
    box(0.01, 0.3, 0.38, [X(1.9), 1.18, 0]), box(0.01, 0.3, 0.38, [X(2.9), 1.18, 0]),
  ];
  P('Avionics shelf & nose-gear well', {
    system: 'Structure', material: 'Aluminium honeycomb panel (est.)', mass: 14, explode: [0.6, 0.15, 0],
    desc: 'A floor for the avionics racks above a boxed well that the nose gear retracts into. Keeping the electronics above the well keeps them clear of runway spray.',
  }, L(merge(shelf), m.primer));
  // main-gear wells behind the wing box: roof, inner (keel) wall and aft wall on each side; the
  // front is closed by the fuselage tank's aft face and the outer wall is the fuselage side
  const BAY = [5.06, 6.28], ROOF = 1.42;
  const keelWall = (zc) => {
    const sh = new THREE.Shape([
      new THREE.Vector2(X(BAY[0]), prof(BAY[0]).bot + 0.02), new THREE.Vector2(X(BAY[1]), prof(BAY[1]).bot + 0.02),
      new THREE.Vector2(X(BAY[1]), ROOF), new THREE.Vector2(X(BAY[0]), ROOF),
    ]);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false }).translate(0, 0, zc - 0.005);
  };
  // aft wall: the section between the keel wall and the skin, below the roof (shape in z–y, extruded along x)
  const aftWall = (zs) => {
    const pts = [new THREE.Vector2(0.05, ROOF)];
    for (let i = 0; i <= 24; i++) {
      const p = fusePoint(BAY[1], -Math.PI / 2 + (i / 24) * (Math.PI / 2), 0.02);
      if (p[1] <= ROOF && p[2] >= 0.05) pts.push(new THREE.Vector2(p[2], p[1]));
    }
    pts.push(new THREE.Vector2(0.05, prof(BAY[1]).bot + 0.02));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.reverse()), { depth: 0.01, bevelEnabled: false, curveSegments: 1 });
    applyMat(g, new THREE.Matrix4().set(0, 0, 1, X(BAY[1]) - 0.005, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    return zs > 0 ? g : mirror(g);
  };
  const bays = [];
  for (const zs of [1, -1]) {
    const zOut = prof((BAY[0] + BAY[1]) / 2).hw - 0.03;
    bays.push(keelWall(0.045 * zs));
    bays.push(box(BAY[1] - BAY[0], 0.01, zOut - 0.045, [X((BAY[0] + BAY[1]) / 2), ROOF, ((zOut + 0.045) / 2) * zs]));
    bays.push(aftWall(zs));
  }
  P('Main gear wells', {
    system: 'Structure', material: 'Composite well liners on a keel web (est.)', mass: 12, count: 2, explode: [0, -0.3, 0],
    desc: 'Two boxed wells behind the wing box take the retracted main legs, one each side of a keel web that carries fuselage bending past the cut-outs; the feed line to the collector tank runs along the keel between them (layout estimated). The wells and their frames take the landing loads of the heavy-weight trailing-arm gear.',
  }, L(merge(bays), m.primer));

  // wing carry-through: the two spars continue across the body and take the wing attach fittings
  const carry = [];
  for (const cf of [0.15, 0.69]) {
    const x = W_ROOT.le[0] - cf * W_ROOT.chord;
    const top = wpt(WING.zRoot, cf, 1, 0.01)[1], bot = wpt(WING.zRoot, cf, -1, 0.01)[1];
    carry.push(box(0.05, top - bot, 0.86, [x, (top + bot) / 2, 0]));
    for (const zs of [1, -1]) for (const yy of [top - 0.02, bot + 0.02]) carry.push(box(0.09, 0.04, 0.06, [x, yy, 0.43 * zs]));
  }
  const xa = W_ROOT.le[0] - 0.15 * W_ROOT.chord, xb = W_ROOT.le[0] - 0.69 * W_ROOT.chord;
  carry.push(box(xa - xb, 0.012, 0.84, [(xa + xb) / 2, wpt(WING.zRoot, 0.4, 1, 0.012)[1], 0]));
  carry.push(box(xa - xb, 0.012, 0.84, [(xa + xb) / 2, wpt(WING.zRoot, 0.4, -1, 0.012)[1], 0]));
  P('Wing carry-through box', {
    system: 'Structure', material: 'Carbon composite box with titanium attach fittings (est.)', mass: 80, explode: [0, 0.75, 0],
    desc: 'Joins the two wings through the fuselage. The wings bolt to it at eight fittings, so they can come off for shipping the aircraft in a container.',
    callout: false,
  }, L(merge(carry), m.composite));
  P('Firewall', {
    system: 'Structure', material: 'Titanium sheet (est.)', mass: 9, explode: [0.15, 0.95, 0],
    desc: 'Fireproof bulkhead between the engine bay and the fuel and electronics ahead of it. Titanium keeps its strength at flame temperatures where aluminium would melt.',
  }, L(bulkhead(7.62), m.titanium));
  const mount = [new THREE.TorusGeometry(0.24, 0.012, 6, 36).rotateY(Math.PI / 2).translate(X(8.3), ENGINE_Y, 0)];
  for (const th of [0.75, Math.PI - 0.75, -0.75, -Math.PI + 0.75]) {
    const a = fusePoint(7.64, th, 0.05);
    const b = [X(8.3), ENGINE_Y + Math.sin(th) * 0.24, Math.cos(th) * 0.24];
    mount.push(tubeBetween(a, b, 0.012, 8));
    const b2 = [X(8.3), ENGINE_Y + Math.sin(th + (th > 0 ? 0.6 : -0.6)) * 0.24, Math.cos(th + (th > 0 ? 0.6 : -0.6)) * 0.24];
    mount.push(tubeBetween(a, b2, 0.01, 8));
  }
  for (const zs of [1, -1]) mount.push(tubeBetween(fusePoint(9.55, zs > 0 ? 0.3 : Math.PI - 0.3, 0.04), [X(9.45), ENGINE_Y + 0.12, 0.2 * zs], 0.012, 8));
  P('Engine mount truss', {
    system: 'Structure', material: 'Welded steel tube with elastomeric isolators (est.)', mass: 14, explode: [0, 1.15, 0],
    desc: 'A tubular truss from the firewall to a mount ring on the turbine case, with a rear brace at the gearbox. Rubber isolators keep engine vibration out of the airframe and the sensors.',
  }, L(merge(mount), m.darkMetal));

  // ============================================================== wings
  const zE = (z) => (z - W_ROOT.le[2]) / (W_TIP.le[2] - W_ROOT.le[2]);
  const FLAP = [0.78, 4.55], AIL = [4.72, 9.3];
  const TANK = [0.5, 8.4];
  const RIBS = [0.45, 1.1, 1.75, 2.4, 3.05, 3.7, 4.35, 5.0, 5.6, 6.2, 6.8, 7.4, 8.0, 8.6, 9.2, 9.85];
  // under-wing stations: [span z, pylon chord, pylon depth, name, mass estimate, description]; ratings
  // are the public figures (inboard 1,500 lb, middle 600 lb, outboard 200 lb)
  const STN = [
    [2.4, 0.92, 0.24, 'Inboard', 24, 'Inboard wing station, rated 1,500 lb (680 kg): the heaviest, because the wing is deepest and stiffest here. It takes a 500 lb-class bomb such as the GBU-12 shown or an external fuel tank; since 2020 it can also carry a pair of Hellfires, for eight missiles in all.'],
    [4.0, 0.72, 0.2, 'Middle', 17, 'Middle wing station, rated 600 lb (272 kg): sized for a two-rail M299 launcher with two Hellfires, about 135 kg together, as shown. A release unit and four sway braces hold the store against gust and landing loads.'],
    [5.6, 0.5, 0.15, 'Outboard', 12, 'Outboard wing station, rated 200 lb (91 kg), for light stores and pods (shown empty). Weight this far out bends the wing hardest, which is why the ratings fall toward the tip.'],
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
      desc: 'A long, straight, high-aspect-ratio wing: 20.1 m span over about 24 m², aspect ratio near 17. Induced drag falls with span squared, which is what buys the 27-hour endurance. The baseline MQ-9A wing has no ice protection; leading-edge de-ice provisions came with the longer wing of later versions.',
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
      desc: 'Ribs keep the airfoil shape and stabilise the skins against buckling; the heavier ribs at 2.4, 4.0 and 5.6 m from the centreline carry the pylon loads (spacing estimated).',
    }, L(f(merge(RIBS.map((z) => ribGeo(z, 0.012, 0.72)))), m.primer));

    const r0 = wsec(TANK[0]), r1 = wsec(TANK[1]);
    const tankG = twistGeo(wingPanel({ root: { ...r0, t: r0.t * 0.9 }, tip: { ...r1, t: r1.t * 0.9 }, c0: 0.165, c1: 0.675, stations: 10, twist: twistAt(TANK[1]) - twistAt(TANK[0]), withChord: false }), TANK[0]);
    P(`Wing fuel tank (${sn})`, {
      system: 'Fuel', material: 'Sealed integral bay / bladder (est.)', mass: 20, explode: [0, -0.35, 1.9 * side],
      desc: 'Fuel in the wing box between the spars, from the root to about 8.4 m out: ≈ 750 L per wing in this model (the real split is not published). Wing fuel sits where the lift is, so it relieves wing bending and barely moves the centre of gravity as it burns.',
      callout: side > 0, anchor: wpt(8.0, 0.42, 1, -0.04).map((v, i) => (i === 2 ? v * side : v)),
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
    P(`Wing servos (${sn})`, {
      system: 'Flight controls', material: 'Electromechanical actuators (est.)', mass: 6, count: 2, explode: [-0.4, 1.0, 1.9 * side],
      desc: 'Electric servo actuators behind the rear spar drive the flap and the aileron through short pushrods. The MQ-9 flies by wire with no hydraulic flight controls (actuator type per GA-ASI descriptions; sizes estimated).',
    }, L(f(merge([servo(2.7), horn(2.7), servo(7.0), horn(7.0)])), m.lruOlive));
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
      callout: side > 0, anchor: [gx - 1.4, gy + 0.12, gb.z * side],
    }, [L(place(g.body), m.olive), L(place(g.guidance), m.seeker), L(place(g.dome), m.glass), L(place(g.band), m.yellow)]));

    // two Hellfires on a two-rail launcher, middle station
    const md = stnInfo[1];
    const lg = launcher();
    const ly = md.yBot - 0.07, lx = md.x - 0.05;
    storeParts.launcher.push(P(`M299 launcher (${sn})`, {
      system: 'Weapons', material: 'Aluminium launcher with electronics assembly', mass: 35, explode: [0, -0.9, 2.0 * side],
      desc: 'An M299-family Hellfire launcher in a two-rail fit. Its electronics pass the laser code and power to each missile before launch (mass estimated).',
    }, L(f(lg.clone().translate(lx, ly, md.z)), m.darkMetal)));
    const hf = hellfire();
    const hy = ly - 0.095 - 0.021 - hf.radius;
    const pair = (geo) => f(merge([-1, 1].map((k) => geo.clone().translate(lx - 0.02, hy, md.z + 0.12 * k))));
    storeParts.hellfire.push(P(`AGM-114 Hellfire pair (${sn})`, {
      system: 'Weapons', material: 'Steel/aluminium airframe, semi-active laser seeker', mass: 98, massSource: 'Published AGM-114 figure (45–49 kg each)', count: 2, explode: [0, -1.2, 2.0 * side],
      desc: 'Two laser-guided Hellfire missiles, each 1.63 m long and 0.18 m in diameter. The seeker under the nose dome homes on a laser spot with a matching pulse code.',
      callout: side < 0, anchor: [lx - 0.6, hy - 0.1, (md.z + 0.12) * side],   // the port pair: its label falls clear of the nose sensors'
    }, [L(pair(hf.body), m.olive), L(pair(hf.dome), m.glass), L(pair(hf.band), m.yellow), L(pair(hf.motor), m.brown)]));
  }
  // wing root fairings (both sides)
  const rootF = [];
  for (const side of [1, -1]) {
    const a = wsec(0.34), b = wsec(0.62);
    const g = wingPanel({ root: { ...a, chord: a.chord * 1.04, le: [a.le[0] + 0.03, a.le[1], a.le[2]], t: a.t * 1.3 }, tip: b, stations: 2, n: 28, withChord: false });
    rootF.push(side > 0 ? g : mirror(g));
  }
  P('Wing root fairings', {
    system: 'Skin & fairings', skin: true, material: 'Composite fillets (est.)', mass: 8, count: 2, explode: [0, 1.75, -1.3],
    desc: 'Fillets that blend the wing into the fuselage side, cutting the interference drag where the two flows meet.',
  }, rootF.map((g) => L(g, m.skin)));

  // centreline station
  const cl = [lru(0.62, 0.05, 0.13, [X(4.6), 0.995, 0], 0.02), box(0.04, 0.035, 0.03, [X(4.6) + 0.178, 0.96, 0]), box(0.04, 0.035, 0.03, [X(4.6) - 0.178, 0.96, 0])];
  P('Centreline station', {
    system: 'Weapons', material: 'Aluminium hardpoint fairing', mass: 6, explode: [0, -0.7, 0],
    desc: 'The seventh store station, under the fuselage on the centreline (shown empty; public sources give no rating for it). With the six wing stations the aircraft carries up to 3,000 lb (1,361 kg) of external stores.',
  }, L(merge(cl), m.darkMetal));

  // ============================================================== V-tail and ventral fin
  const DIH = 47 * deg, VT_L = 2.75;
  const vtRoot = { le: [0, 0, 0], chord: 1.3, t: 0.11 };
  const vtTip = { le: [-VT_L * Math.tan(25 * deg), 0, VT_L], chord: 0.62, t: 0.09 };
  const vtPoint = (eta, cf, side) => new THREE.Vector3(
    vtRoot.le[0] + (vtTip.le[0] - vtRoot.le[0]) * eta - cf * (vtRoot.chord + (vtTip.chord - vtRoot.chord) * eta), 0, VT_L * eta * side);
  const tailFrames = [];
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const frame = new THREE.Group();
    frame.position.set(X(8.45), 1.745, 0.1 * side);
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
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0, c1: 0.7, stations: 4, n: 22 }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0, eta1: 0.2, stations: 1, n: 22 }),
    wingPanel({ root: vfRoot, tip: vfTip, c0: 0.7, c1: 1, eta0: 0.9, eta1: 1, stations: 1, n: 22 }),
  ];
  vf.push(sparGeo(0.32, 1.12, 0.3, { width: 0.02, steps: 3, root: vfRoot, tip: vfTip, twist: 0 }));
  P('Ventral fin', {
    system: 'Skin & fairings', skin: true, material: 'Composite (est.)', mass: 12, explode: [-0.25, 0, 0.75],
    desc: 'The lower arm of the Y-tail. It adds directional stability that a V-tail alone lacks and reaches below the propeller arc so the fin, not the blades, touches first on an over-rotation.',
  }, vf.map((g) => L(g, m.skin)), fin);
  const vfPoint = (eta, cf) => new THREE.Vector3(vfRoot.le[0] + (vfTip.le[0] - vfRoot.le[0]) * eta - cf * (vfRoot.chord + (vfTip.chord - vfRoot.chord) * eta), 0, vfTip.le[2] * eta);
  const rudG = wingPanel({ root: vfRoot, tip: vfTip, c0: 0.705, c1: 1, eta0: 0.2, eta1: 0.9, stations: 2, n: 22 });
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
  const tb = turbineGeo();
  role(P('TPE331 turbine section', {
    system: 'Propulsion', material: 'Nickel-alloy combustor and turbine, steel casing', mass: 60, explode: [0.35, 1.0, 0],
    desc: 'The reverse-flow annular combustor wraps around a three-stage axial turbine that drives the compressor and, through the gearbox, the propeller. Gas entering the turbine is around 1,000 °C at full power, typical for an engine of this class.',
    callout: true, anchor: [X(8.25), ENGINE_Y + 0.25, 0.22],
  }, [L(tb.hot, m.hot), L(tb.fittings, m.pipe)]), 'turbine');
  const cp = compressorGeo();
  role(P('TPE331 compressor section', {
    system: 'Propulsion', material: 'Titanium impellers, aluminium/steel housings', mass: 68, explode: [0, 1.0, 0],
    desc: 'Two centrifugal compressor stages in series raise the air to about 10:1 pressure ratio before it is ducted forward to the combustor. Centrifugal stages are short and rugged, ideal for a compact turboprop.',
  }, [L(cp.case, m.titanium), L(cp.screen, m.darkMetal)]), 'compressor');
  role(P('Propeller reduction gearbox', {
    system: 'Propulsion', material: 'Magnesium/aluminium case, steel gears', mass: 47, explode: [-0.45, 1.0, 0],
    desc: 'Steps the engine’s ≈ 41,700 rpm down to propeller speed (TPE331-10 installations run the propeller near 1,590 rpm, about 26:1). Its offset output puts the propeller shaft above the engine centreline.',
  }, L(gearboxGeo(), m.gun)), 'gearbox');
  const inlet = [
    lru(0.55, 0.1, 0.26, [X(7.6), 1.87, 0], 0.04),
    pipe([[X(7.45), 1.84, 0], [X(7.9), 1.82, 0], [X(8.5), 1.82, 0], [X(8.85), 1.8, 0], [X(9.1), 1.68, 0]], 0.05, 10, 40).translate(0, -1.82, 0).scale(1, 0.6, 1).translate(0, 1.82, 0),
    new THREE.TorusGeometry(0.2, 0.035, 8, 32).rotateY(Math.PI / 2).translate(X(9.15), ENGINE_Y, 0),
  ];
  P('Engine air inlet & plenum', {
    system: 'Propulsion', material: 'Composite duct, aluminium plenum (layout approximate)', mass: 7, explode: [0, 1.5, 0],
    desc: 'A dorsal ram-air scoop feeds a duct and an annular plenum around the inlet screen behind the gearbox, where the TPE331 draws its air (scoop position from photographs; duct routing estimated).',
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
    system: 'Propulsion', material: 'Aluminium tank', mass: 5, explode: [0, 0.75, -0.45],
    desc: 'Holds the engine and gearbox lubricating oil (a few litres; estimate). The same oil cools the gearbox bearings and drives the propeller pitch control.',
  }, L(merge([cylX(X(8.95), X(8.62), 0.06, 0.06, 1.43, -0.24, 16), cylX(X(8.7), X(8.66), 0.025, 0.025, 1.5, -0.24, 8)]), m.alu)), 'oil');
  role(P('Fuel control unit', {
    system: 'Propulsion', material: 'Engine-driven fuel pump and metering unit', mass: 6, explode: [0.3, 0.55, 0.55],
    desc: 'The engine-driven high-pressure pump and fuel metering unit at the end of the feed line. The DEEC trims how much fuel it meters to the combustor’s fuel nozzles (ten shown; count and position approximate).',
  }, L(merge([lru(0.16, 0.11, 0.1, [X(8.15), ENGINE_Y - 0.1, 0.26]), tubeBetween([X(8.15), ENGINE_Y - 0.04, 0.24], [X(8.4), ENGINE_Y + 0.02, 0.22], 0.008, 6)]), m.darkMetal)), 'compressor');
  P('Propeller governor', {
    system: 'Propulsion', material: 'Flyweight governor and oil pump on the gearbox', mass: 3, explode: [-0.6, 0.85, 0.3],
    desc: 'Holds propeller speed constant: flyweights sense rpm and meter gearbox oil to the pitch-change piston, coarsening the blades when the engine speeds up (position approximate).',
  }, L(cylX(X(9.65) - 0.1, X(9.65) - 0.01, 0.035, 0.035, 1.765, 0.1, 14), m.gun));
  role(P('Ignition exciter', {
    system: 'Propulsion', material: 'Capacitor-discharge ignition unit', mass: 2, explode: [0, 0.9, -0.5],
    desc: 'Fires the two igniter plugs in the combustor during start; once the flame is self-sustaining the exciter switches off.',
  }, L(lru(0.12, 0.06, 0.08, [X(8.8), ENGINE_Y + 0.2, -0.17]), m.lruOlive)), 'generator');
  P('Propeller drive shaft', {
    system: 'Propulsion', material: 'Steel shaft with flexible couplings', mass: 8, explode: [-1.0, 0.45, 0],
    desc: 'Carries up to 900 shp (671 kW) from the gearbox to the propeller flange through the tail cone, with flexible couplings for misalignment.',
  }, L(shaftGeo(), m.titanium));
  const propSpin = new THREE.Group();
  propSpin.position.set(PROP_X, SHAFT_Y, 0);
  const hubSpin = new THREE.Group();
  hubSpin.position.copy(propSpin.position);
  const blades = merge(bladesGeo(3));
  blades.computeVertexNormals();
  const propPart = P('Three-blade propeller', {
    system: 'Propulsion', material: 'Carbon-fibre composite blades (est.)', mass: 24, count: 3, explode: [-2.3, 0, 0],
    desc: 'A three-blade, variable-pitch pusher propeller about 2.6 m across (diameter estimated; the extended-range modification adds a fourth blade). Behind the wing and sensors it never blocks the view or disturbs the nose.',
    callout: true, anchor: [0, 0.9, 0.25],
  }, propSpin);
  propSpin.add(L(blades, m.blade));
  propPart.userData.part.anchor.set(PROP_X, SHAFT_Y + 0.9, 0.25);
  P('Propeller hub & pitch control', {
    system: 'Propulsion', material: 'Aluminium hub, oil-operated pitch change', mass: 20, explode: [-1.75, 0, 0],
    desc: 'Holds the blade roots and twists them: oil pressure moves a piston in the dome to change pitch, which keeps the engine at constant speed as power and airspeed change.',
  }, hubSpin);
  hubSpin.add(L(hubGeo(3), m.darkMetal));
  P('Spinner', {
    system: 'Skin & fairings', skin: true, material: 'Composite spinner', mass: 4, explode: [-2.85, 0, 0],
    desc: 'Fairs the hub into the tail cone so the flow into the propeller roots stays smooth.',
  }, L(spinnerGeo().translate(PROP_X, SHAFT_Y, 0), m.skin));
  P('DEEC engine control', {
    system: 'Propulsion', material: 'Digital electronic engine control unit', mass: 4, explode: [0.4, 0.75, 0.3],
    desc: 'The digital electronic engine control (developed by Honeywell and GA-ASI and first fitted to production Predator B aircraft) schedules fuel and propeller pitch for the commanded power, improving fuel economy.',
  }, L(lru(0.08, 0.2, 0.2, [X(7.5), 1.6, 0.2]), m.lruOlive));

  // ============================================================== fuel system
  const ftRings = [];
  for (const s of [3.4, 3.45, 3.7, 3.9, 4.1, 4.16, 4.4, 4.7, 4.98, 5.03]) {
    const yTop = s < 4.13 ? prof(s).top - 0.06 : 1.555;
    const shrink = s === 3.4 || s === 5.03 ? 0.055 : 0.03;
    const rr = [];
    for (let i = 0; i < 32; i++) {
      const p = fusePoint(s, -Math.PI / 2 + (i / 32) * Math.PI * 2, shrink);
      p[1] = Math.min(p[1], yTop - (shrink - 0.03));
      rr.push(p);
    }
    ftRings.push(rr);
  }
  const ftGeo = loftRings(ftRings, { capStart: true, capEnd: true, uvMode: 'metric' });
  P('Fuselage fuel tank', {
    system: 'Fuel', material: 'Crash-resistant bladder cell (est.)', mass: 28, explode: [0, -0.9, 0],
    desc: 'The main tank sits at the centre of gravity under and ahead of the wing box (≈ 670 L in this model). With the wing bays the modelled tanks hold ≈ 2,200 L, about 1,760 kg of JP-8: GA-ASI quotes 3,900 lb (1,769 kg), the USAF 4,000 lb (602 US gal).',

  }, L(applyOut(ftGeo), m.fuel));
  const coll = [lru(0.42, 0.2, 0.34, [X(6.55), 1.36, 0], 0.03), cylX(X(6.7), X(6.48), 0.035, 0.035, 1.24, 0.09, 10), cylX(X(6.7), X(6.48), 0.035, 0.035, 1.24, -0.09, 10)];
  P('Collector tank & boost pumps', {
    system: 'Fuel', material: 'Aluminium collector with electric boost pumps (est.)', mass: 9, count: 2, explode: [0, -0.5, 0.35],
    desc: 'All tanks feed a small collector (≈ 30 L here) that is kept full, so the engine never draws air when the aircraft banks or the main tanks run low. Two electric boost pumps push fuel to the engine-driven pump (arrangement estimated).',
  }, L(merge(coll), m.alu));
  const lines = [];
  for (const zs of [1, -1]) {
    // wing feeds pass over the main-gear well roofs (y 1.42) to the collector's front face
    lines.push(pipe([wpt(0.62, 0.6, -1, 0.03).map((v, i) => (i === 2 ? v * zs : v)), [X(5.4), 1.52, 0.3 * zs], [X(6.15), 1.475, 0.15 * zs], [X(6.36), 1.4, 0.1 * zs]], 0.013, 6, 24));
  }
  // fuselage tank to collector along the keel, between the two gear wells
  lines.push(pipe([[X(4.98), 1.09, 0], [X(5.6), 1.15, 0], [X(6.15), 1.22, 0], [X(6.36), 1.3, -0.04]], 0.013, 6, 24));
  lines.push(pipe([[X(6.77), 1.3, 0.05], [X(7.3), 1.42, 0.22], [X(7.9), 1.42, 0.24], [X(8.2), 1.45, 0.24]], 0.012, 6, 24));
  lines.push(box(0.06, 0.05, 0.05, [X(7.1), 1.39, 0.2]), box(0.06, 0.05, 0.05, [X(5.3), 1.18, -0.05]));
  P('Fuel lines & valves', {
    system: 'Fuel', material: 'Aluminium and stainless tube, motorised valves', mass: 10, explode: [0, -0.3, 0.6],
    desc: 'Feed lines from the wing and fuselage tanks to the collector and on to the engine fuel control, with shut-off and crossfeed valves the flight computers use to keep the aircraft balanced.',
  }, L(merge(lines), m.pipe));
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
  const fcc = [-0.27, -0.1, 0.07].map((z) => lru(0.42, 0.24, 0.15, [X(2.175), 1.474, z]));
  P('Flight control computers', {
    system: 'Flight controls', material: 'Redundant flight computers', mass: 12, count: 3, explode: [0.9, 0.9, -0.3],
    desc: 'Redundant computers fly the aircraft: they hold attitude, altitude and speed, mix ruddervator commands and can land automatically. GA-ASI describes the avionics as triple-redundant with a fault-tolerant flight control system.',

  }, L(merge(fcc), m.lru));
  A.root.updateMatrixWorld(true);
  const tailServo = [];
  for (const zs of [1, -1]) {
    tailServo.push(lru(0.18, 0.07, 0.09, [X(8.75), 1.76, 0.17 * zs]));
    const a = [X(8.8), 1.76, 0.17 * zs];
    const hinge = tailFrames[zs > 0 ? 0 : 1].localToWorld(vtPoint(0.12, 0.66, zs).clone());
    tailServo.push(tubeBetween(a, [hinge.x, hinge.y, hinge.z], 0.007, 6));
  }
  tailServo.push(lru(0.16, 0.06, 0.09, [X(9.05), 1.47, 0]));
  P('Tail servos', {
    system: 'Flight controls', material: 'Electromechanical actuators (est.)', mass: 8, count: 3, explode: [0, 0.85, 0.6],
    desc: 'One electric servo for each ruddervator and one for the ventral rudder, mounted in the aft fuselage and linked by pushrods (positions estimated).',
  }, L(merge(tailServo), m.lruOlive));

  // ============================================================== landing gear
  const noseLeg = new THREE.Group();
  noseLeg.position.set(X(1.95), 1.03, 0);
  const ng = [
    new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16).translate(0, -0.04, 0),
    tubeBetween([0, -0.02, 0], [0.02, -0.44, 0], 0.045, 14), tubeBetween([0.02, -0.44, 0], [0.03, -0.64, 0], 0.032, 12),
    tubeBetween([-0.04, -0.34, 0], [-0.06, -0.46, 0], 0.012, 6), tubeBetween([-0.06, -0.46, 0], [-0.02, -0.58, 0], 0.012, 6),
    box(0.06, 0.05, 0.16, [0.03, -0.66, 0]), box(0.05, 0.2, 0.025, [0.035, -0.76, 0.075]), box(0.05, 0.2, 0.025, [0.035, -0.76, -0.075]),
    tubeBetween([0, -0.12, 0], [0.55, -0.02, 0], 0.016, 8),
  ];
  const noseGear = P('Nose landing gear', {
    system: 'Landing gear', material: 'Steel oleo strut, steering collar, retraction actuator', mass: 28, explode: [0, -0.85, 0],
    desc: 'A steerable oleo-pneumatic nose leg that retracts aft into the well under the avionics shelf. Nosewheel steering lets the remote pilot taxi from the ground station.',
  }, noseLeg);
  noseLeg.add(L(merge(ng), m.alu));
  const nwheel = [new THREE.TorusGeometry(0.135, 0.065, 12, 28), new THREE.CylinderGeometry(0.1, 0.1, 0.1, 20).rotateX(Math.PI / 2)];
  P('Nose wheel & tyre', {
    system: 'Landing gear', material: 'Aluminium wheel, tubeless tyre', mass: 9, explode: [0.2, -0.3, 0.45],
    desc: 'A single nose wheel about 0.4 m in diameter (estimate). It takes only a small share of the weight but all of the steering loads.',
  }, [L(nwheel[0], m.rubber), L(nwheel[1], m.alu)], noseLeg).position.set(0.035, -0.83, 0);
  const lampG = merge([cylX(0.0, 0.04, 0.035, 0.03, 0, 0, 14), cylX(0.04, 0.045, 0.03, 0.03, 0, 0, 14)]);
  const lampPart = P('Landing & taxi light', {
    system: 'Electrical', material: 'LED lamp on the nose leg', mass: 1, explode: [0.35, -0.1, 0],
    desc: 'Lights the runway on approach and taxi and makes the aircraft visible to tower controllers; the pilot sees the runway through the nose camera.',
  }, [L(lampG.clone().translate(0, 0, 0), m.darkMetal)], noseLeg);
  const lampLens = L(new THREE.CircleGeometry(0.028, 16).rotateY(Math.PI / 2).translate(0.046, 0, 0), m.lamp, { cast: false });
  lampPart.add(lampLens);
  lampPart.position.set(0.05, -0.3, 0);

  const mainLegs = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(X(5.05), 1.1, 0.36 * side);
    const knee = [0.0, -0.55, 0.62 * side], axle = [-0.32, -0.82, 0.7 * side];
    const leg = [
      tubeBetween([0, 0, 0], knee, 0.055, 14), tubeBetween([0, 0.02, -0.05 * side], [0, 0.02, 0.08 * side], 0.06, 12),
      tubeBetween(knee, axle, 0.045, 12), tubeBetween([-0.02, -0.22, 0.25 * side], [-0.19, -0.68, 0.66 * side], 0.03, 10),
      tubeBetween([0.06, -0.02, 0.02 * side], [0.09, -0.32, 0.36 * side], 0.018, 8),     // retraction actuator
      box(0.08, 0.08, 0.1, [axle[0], axle[1], axle[2]]),
    ];
    const legPart = P(`Main gear leg (${sn(side)})`, {
      system: 'Landing gear', material: 'Steel strut, trailing arm, maintenance-free shock absorber', mass: 50, explode: [0, -0.95, 0.75 * side],
      desc: 'A trailing-arm main leg. GA-ASI’s heavy-weight trailing-arm gear (announced 2012) raised landing-weight capacity by over 30 % and uses a shock absorber that needs no nitrogen servicing. It retracts into the fuselage (retraction path approximate).',

    }, piv);
    piv.add(L(merge(leg), m.alu));
    const w = [new THREE.TorusGeometry(0.2, 0.08, 14, 32), new THREE.CylinderGeometry(0.15, 0.15, 0.13, 24).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20).rotateX(Math.PI / 2).translate(0, 0, -0.07 * side)];
    const wheel = P(`Main wheel & brake (${sn(side)})`, {
      system: 'Landing gear', material: 'Aluminium wheel, carbon/steel brake, tubeless tyre', mass: 22, explode: [0, -0.15, 0.4 * side],
      desc: 'Main wheel about 0.56 m in diameter with a multi-disc brake (sizes estimated). The brakes are commanded from the ground station or by the automatic landing system.',
    }, [L(w[0], m.rubber), L(merge([w[1]]), m.alu), L(w[2], m.darkMetal)], piv);
    wheel.position.set(axle[0], axle[1], axle[2] + 0.06 * side);
    const extended = new THREE.Vector3(axle[0], axle[1], axle[2]).normalize();
    const stowed = new THREE.Vector3(-1, 0.08, -0.12 * side).normalize();
    mainLegs.push({ piv, q: new THREE.Quaternion().setFromUnitVectors(extended, stowed) });
  }
  // gear doors: conformal skin patches hinged on their outer edge
  const doors = [];
  const doorPart = (name, s0, s1, th0, th1, info) => {
    const g = skinPatch(s0, s1, th0, th1);
    const e0 = fusePoint(s0, th1), e1 = fusePoint(s1, th1);
    const h = hingedMesh(g, m.skinDouble, new THREE.Vector3(...e0), new THREE.Vector3(...e1));
    h.mesh.castShadow = true;
    P(name, { system: 'Landing gear', skin: true, material: 'Composite doors (est.)', ...info }, h.pivot);
    return h;
  };
  for (const side of [1, -1]) {
    const th0 = -Math.PI / 2 + 0.03 * side, th1 = -Math.PI / 2 + 0.62 * side;
    doors.push({ h: doorPart(`Main gear door (${sn(side)})`, 5.05, 6.25, th0, th1, { mass: 4, explode: [0, -0.6, 0.55 * side], desc: 'Closes the main-gear bay in flight to keep the fuselage underside smooth; open whenever the leg is down (sequencing estimated).' }), side, open: 1.45 });
    doors.push({ h: doorPart(`Nose gear door (${sn(side)})`, 1.97, 2.85, -Math.PI / 2 + 0.02 * side, -Math.PI / 2 + 0.42 * side, { mass: 1.5, explode: [0, -0.55, 0.35 * side], desc: 'One of a pair of nose-gear doors hinged along the outer edge of the well.' }), side, open: 1.45 });
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
  // apertures on the ball face: IR, daylight TV, spotter, laser designator/rangefinder, illuminator
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
    desc: 'Raytheon’s Multi-Spectral Targeting System B: infrared, daylight and short-wave-IR cameras, a laser rangefinder/designator and a laser illuminator in one stabilised ball about 0.55 m across (size and mass estimated).',
    callout: true, anchor: [X(1.08) + 0.15, 0.4, 0.25],
  }, turret);
  P('MTS-B electronics unit', {
    system: 'Sensors', material: 'Electronics unit', mass: 15, explode: [0.55, 0.3, 0.75],
    desc: 'Processes the turret’s video, drives the gimbal and fires the laser; the turret and this unit are bought and upgraded as a pair (location estimated).',
  }, L(lru(0.6, 0.17, 0.12, [X(2.4), 1.255, 0.27]), m.lruOlive));
  // Lynx SAR
  const lynx = new THREE.Group();
  lynx.position.set(X(0.48), 1.24, 0);
  const lynxAz = new THREE.Group();
  lynx.add(lynxAz);
  lynxAz.add(L(merge([box(0.035, 0.21, 0.42, [0.1, 0, 0], [0, 0, -0.32]), box(0.05, 0.05, 0.36, [0.06, 0, 0])]), m.lruOlive));
  lynxAz.add(L(merge([box(0.03, 0.07, 0.03, [0.03, 0, 0.17]), box(0.03, 0.07, 0.03, [0.03, 0, -0.17]), new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16).translate(0, -0.06, 0)]), m.darkMetal));
  lynx.add(L(merge([tubeBetween([0, -0.1, 0], [X(0.95) - X(0.48), -0.12, 0], 0.025, 8), tubeBetween([0, -0.1, 0.08], [X(0.95) - X(0.48), -0.06, 0.16], 0.015, 6), tubeBetween([0, -0.1, -0.08], [X(0.95) - X(0.48), -0.06, -0.16], 0.015, 6)]), m.darkMetal));
  P('AN/APY-8 Lynx SAR antenna', {
    system: 'Sensors', material: 'Gimballed Ku-band antenna', mass: 30, explode: [2.2, -0.5, 0],
    desc: 'General Atomics’ Lynx synthetic-aperture radar (developed with Sandia National Laboratories) images the ground through cloud, smoke and darkness, down to about 10 cm resolution in spotlight mode, and tracks moving vehicles.',
    callout: true, anchor: [X(0.48) + 0.13, 1.34, 0.2],
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
    desc: 'Tracks a geostationary satellite to carry control and sensor video beyond line of sight. The round trip via a satellite 35,786 km up adds about half a second of delay, so crews in the US can fly aircraft overseas, but not land them.',
    callout: true, anchor: [X(1.15) + 0.25, 1.95, 0],
  }, dishG);
  P('Ku-band SATCOM modem', {
    system: 'Avionics', material: 'Modem and RF unit', mass: 8, explode: [1.0, 1.0, -0.4],
    desc: 'Encodes the command uplink and the high-rate sensor downlink for the satellite channel, next to the dish to keep the RF runs short (location estimated).',
  }, L(lru(0.3, 0.2, 0.28, [X(1.7), 1.455, -0.17]), m.lru));
  P('Air data computer', {
    system: 'Avionics', material: 'Air data computer', mass: 3, explode: [1.0, 0.95, 0.45],
    desc: 'Turns the pitot and static pressures into airspeed, altitude and vertical speed for the flight computers.',
  }, L(lru(0.24, 0.12, 0.2, [X(1.7), 1.415, 0.18]), m.lru));
  P('Mission computer', {
    system: 'Avionics', material: 'Mission computer', mass: 9, explode: [0.75, 0.9, 0.55],
    desc: 'Manages the payloads, weapons and data links. It is shown separate from the flight-critical computers, the usual way to keep a payload fault from affecting control (internal partitioning not public).',
  }, L(lru(0.42, 0.24, 0.15, [X(2.175), 1.474, 0.25]), m.lru));
  P('Embedded GPS/INS', {
    system: 'Avionics', material: 'Ring-laser-gyro inertial units with GPS receivers', mass: 10, count: 2, explode: [0.55, 1.0, 0],
    desc: 'Two embedded GPS/inertial units give position, velocity and attitude. The inertial half keeps navigating if GPS is jammed; the GPS half stops the inertial drift.',
  }, L(merge([lru(0.28, 0.16, 0.18, [X(2.64), 1.432, 0.2]), lru(0.28, 0.16, 0.18, [X(2.64), 1.432, -0.2])]), m.lru));
  P('IFF transponder', {
    system: 'Avionics', material: 'Identification friend-or-foe / ATC transponder', mass: 4, explode: [0.45, 1.15, 0],
    desc: 'Answers air-traffic and military interrogations with the aircraft’s identity and altitude, the same as a crewed aircraft in controlled airspace.',
  }, L(lru(0.26, 0.12, 0.13, [X(2.64), 1.412, 0]), m.lru));
  P('C-band datalink transceiver', {
    system: 'Avionics', material: 'Line-of-sight datalink radio', mass: 10, explode: [0.3, 1.0, -0.55],
    desc: 'The line-of-sight C-band link used by the launch-and-recovery crew at the airfield: short delay for hand-flown take-offs and landings, but only to the radio horizon.',
  }, L(lru(0.46, 0.24, 0.3, [X(3.12), 1.474, -0.19]), m.lru));
  P('ARC-210 V/UHF radios', {
    system: 'Communications', material: 'Two software-defined VHF/UHF radios', mass: 11, count: 2, explode: [0.3, 1.05, 0.55],
    desc: 'Two ARC-210 radios relay voice between the crew and air-traffic control or troops on the ground, through the wingtip antennas (Block 5 fit).',
  }, L(merge([lru(0.34, 0.12, 0.25, [X(3.12), 1.414, 0.2]), lru(0.34, 0.12, 0.25, [X(3.12), 1.544, 0.2])]), m.lruOlive));
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
    system: 'Electrical', material: 'Engine-driven DC starter-generator', mass: 22, explode: [-0.75, 0.6, 0.45],
    desc: 'Spins the engine for starting, then becomes the main generator. Block 5 aircraft have a higher-capacity unit to power added radios and links (rating not published).',
  }, L(merge([cylX(X(9.65), X(9.65) - 0.26, 0.085, 0.085, 1.64, 0.12, 20), box(0.08, 0.05, 0.06, [X(9.65) - 0.15, 1.73, 0.12])]), m.darkMetal)), 'generator');
  role(P('Backup generator', {
    system: 'Electrical', material: 'Engine-driven alternator', mass: 12, explode: [-0.75, 0.6, -0.45],
    desc: 'A second, independent generator sized to run every flight-critical system; with the battery it gives the Block 5 aircraft three independent power sources.',
  }, L(cylX(X(9.65), X(9.65) - 0.22, 0.07, 0.07, 1.64, -0.12, 18), m.darkMetal)), 'generator');
  role(P('Main batteries', {
    system: 'Electrical', material: 'Sealed rechargeable batteries (est.)', mass: 28, count: 2, explode: [0.3, -0.6, 0.45],
    desc: 'Keep the flight-critical systems running if both generators fail, and power the avionics before engine start (type and capacity not published).',
  }, L(merge([lru(0.36, 0.17, 0.16, [X(3.19), 1.2, 0.18]), lru(0.36, 0.17, 0.16, [X(3.19), 1.2, -0.18])]), m.lruOlive)), 'battery');
  P('Power distribution units', {
    system: 'Electrical', material: 'Solid-state power controllers', mass: 12, count: 2, explode: [0, 0.8, 0.6],
    desc: 'Switch and protect each electrical load and shed non-essential ones automatically when a generator drops out.',
  }, L(merge([lru(0.22, 0.14, 0.16, [X(7.15), 1.55, 0.2]), lru(0.22, 0.14, 0.16, [X(7.15), 1.55, -0.2])]), m.lru));
  const hr = [];
  const run = [];
  for (let s = 1.5; s <= 9.4; s += 0.5) run.push(fusePoint(s, Math.PI - 0.55, 0.07));
  hr.push(pipe(run, 0.016, 6, 80));
  const run2 = [];
  for (let s = 1.5; s <= 7.4; s += 0.5) run2.push(fusePoint(s, 0.55, 0.07));
  hr.push(pipe(run2, 0.013, 6, 60));
  hr.push(pipe([fusePoint(1.5, Math.PI - 0.55, 0.07), [X(1.2), 1.35, -0.2], [X(0.8), 1.2, 0]], 0.012, 6, 16));
  hr.push(pipe([fusePoint(9.0, Math.PI - 0.55, 0.07), [X(9.0), 1.7, 0], [X(8.8), 1.76, 0.12]], 0.01, 6, 12));
  P('Wiring harness', {
    system: 'Electrical', material: 'Shielded copper harness (est.)', mass: 65, explode: [0, 0.65, -0.65],
    desc: 'Main power and data runs from the generators and batteries forward to the avionics and sensors, and aft to the engine bay and tail servos, kept apart for redundancy.',
  }, L(merge(hr), m.harness));
  const beaconTop = L(merge([lru(0.1, 0.02, 0.07, [X(5.85), prof(5.85).top + 0.005, 0], 0.02)]), m.darkMetal);
  const lensTop = L(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.9, 1).translate(X(5.85), prof(5.85).top + 0.015, 0), m.beacon, { cast: false });
  const beaconBot = L(merge([lru(0.1, 0.02, 0.07, [X(3.7), prof(3.7).bot - 0.005, 0], 0.02)]), m.darkMetal);
  const lensBot = L(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.2, 0.9, 1).translate(X(3.7), prof(3.7).bot - 0.015, 0), m.beacon, { cast: false });
  P('Anti-collision beacons', {
    system: 'Electrical', material: 'LED beacons', mass: 1, count: 2, explode: [0, 0.5, 0],
    desc: 'Beacons above and below the fuselage make the aircraft visible to other traffic from any angle, as required in civil airspace (positions and colour approximate).',
  }, [beaconTop, lensTop, beaconBot, lensBot]);

  // ============================================================== environmental control
  const nacaFace = skinPatch(2.1, 2.36, Math.PI + 0.48, Math.PI + 0.62, 0.003, 2, 2);
  P('Avionics cooling system', {
    system: 'Environmental control', material: 'Ram-air inlet, electric fan and ducts (layout approximate)', mass: 9, explode: [0.35, -0.45, -0.75],
    desc: 'Ram air from a flush inlet, boosted by a fan on the ground, is ducted over the avionics racks. At altitude the air is cold but thin, so the fan and ducts are sized for hot days on the ramp.',
  }, [
    L(merge([cylX(X(2.45), X(2.25), 0.07, 0.07, 1.22, -0.27, 18), pipe([[X(2.25), 1.22, -0.27], [X(2.0), 1.3, -0.25], [X(1.8), 1.37, -0.05], [X(1.6), 1.38, 0.2]], 0.035, 8, 24), pipe([[X(2.45), 1.22, -0.27], [X(2.8), 1.32, -0.2], [X(3.3), 1.37, -0.05]], 0.03, 8, 24)]), m.alu),
    L(nacaFace, m.intake),
  ]);

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
  return {
    id: 'uav',
    designation: 'MQ-9A',
    name: 'REAPER',
    role: 'Medium-altitude long-endurance RPA',
    tagline: 'Medium altitude · long endurance · flown through a satellite link',
    summary: 'General Atomics’ MQ-9A Reaper is a 4.8-tonne remotely piloted aircraft built to stay over one area for a day or more. A long, thin wing and a 900 shp pusher turboprop trade speed for endurance, while a stabilised EO/IR turret and a synthetic-aperture radar watch the ground. Two crew fly it from a ground station, often a continent away, through a Ku-band satellite link.',
    specs: [
      ['Length', '11.0 m (36 ft)'], ['Wingspan', '20.1 m (66 ft)'], ['Height', '3.81 m (12.5 ft)'],
      ['Empty weight', '2,223 kg (4,900 lb)'], ['Max take-off weight', '4,760 kg (10,500 lb)'], ['Internal fuel', '≈ 1,800 kg (4,000 lb, 602 US gal)'],
      ['Payload', '1,701 kg: 386 kg internal, 1,361 kg external'], ['Engine', 'Honeywell TPE331-10GD turboprop, 900 shp (671 kW)'],
      ['Propeller', '3-blade variable-pitch pusher (≈ 2.6 m, estimate)'], ['Cruise speed', '313 km/h (169 kt); USAF quotes ≈ 370 km/h'],
      ['Max speed', '482 km/h (260 kt); GA-ASI quotes 444 km/h (240 KTAS)'], ['Ceiling', '15,240 m (50,000 ft)'],
      ['Endurance', '27 h clean (GA-ASI)'], ['Range', '1,850 km (1,000 nmi, USAF)'],
      ['Stores stations', '7: six under-wing, one centreline'], ['Crew', '2 remote: pilot and sensor operator'],
    ],
    heroStats: [['27', 'h', 'Endurance'], ['15.2', 'km', 'Ceiling'], ['1,701', 'kg', 'Payload']],
    sources: 'USAF MQ-9 Reaper fact sheet (af.mil); GA-ASI MQ-9A specification sheet; NAVAIR MQ-9A product page; DOT&E annual reports FY2011 and FY2017; NASA Ikhana (Predator B) fact sheets; GA-ASI releases on the trailing-arm main gear (2012) and Block 5 electrical system; Defense Update and Flight International on the Lynx AN/APY-8; Wikipedia articles on the MQ-9, TPE331, GBU-12 and AGM-114. Internal layout and component masses are estimates.',
    fleetTag: '27 h loiter',
    aero: true,
    root: A.root,
    parts: A.parts,
    view: { dir: [0.9, 0.5, 1.3], fill: 0.95 },
    displaySize: 11.5,
    thermalRange: [200, 900],
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
      noseLeg.rotation.z = -1.62 * g;
      noseLeg.visible = g < 0.985;
      for (const { piv, q } of mainLegs) { piv.quaternion.slerpQuaternions(qI, q, g); piv.visible = g < 0.985; }
      for (const dr of doors) dr.h.setAngle(dr.open * (1 - d) * dr.side);
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
      surf.rud.setAngle(yaw * 20 * deg);
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

function sn(side) { return SN(side); }
