// One Falcon Heavy first-stage core: the centre core (with interstage, stage-separation and
// booster-attach hardware) or a side booster (with its composite nose cone and the booster halves
// of the attach fittings). Built in the core's own frame (axis on y, y = 0 at the nozzle exit
// plane); the caller positions the group.
//
// Each core is broken into its systems the way a cutaway poster shows them: monocoque LOX tank over
// a skin-and-stringer RP-1 tank with three bulkheads; heated-helium pressurisation from COPVs on a
// common manifold; the double-wall LOX transfer tube, distribution manifold, RP-1 feed lines and
// prevalves; separate fill, drain and vent valves to the T-0 umbilical plate; the Octaweb with nine
// Merlin 1D broken into chambers, turbopumps, gas generators, exhaust ducts and propellant ducts
// and valves, their TVC actuators and RP-1 hydraulic lines, chill bleeds, controllers and TEA-TEB
// supply; flight computers, navigation, flight safety, power, telemetry, cameras, wiring and
// antennas; recovery hardware (grid fins with their hydraulic power unit, hinged A-frame legs with
// telescoping helium pistons, crush cores and lock-out collets, nitrogen thrusters). Counts and
// placements that are not published are marked as estimates in each part's desc.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { latticePanel, loftRings, rod, beam, lathe, ogiveProfile, hingedMesh } from '../../engine/geometry.js';
import { R, Y, ENGINE_RING, T0_Y, polar } from './dims.js';
import { merge, barrel, dome, domeY, pipe, hoop, post, block, bottle, radialYaw, perforatedDisc, bar } from './util.js';
import { merlinBell, merlinNozzle, merlinChamber, merlinKit, pintleInjector, placeAll } from './merlin.js';
import { FM, stagePaint, tankMaterial } from './materials.js';

const D = Y.domeDepth;
const OUTER = Array.from({ length: 8 }, (_, k) => 22.5 + k * 45);     // outer engine azimuths (deg)
const RELIGHT = [112.5, 292.5];                                         // outer engines that relight with the centre one (estimate)
const LEGS = [45, 135, 225, 315];
const tangentYaw = (a) => (-(a + 90) * Math.PI) / 180;                  // kit +x → counter-clockwise tangent
const aftDomeY = (r) => domeY(R - 0.01, Y.engSectionTop, D, -1, r);
const smooth = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
/** [x, y, z] at radius r, azimuth a (deg), height y. */
const at = (r, a, y) => { const [x, z] = polar(r, a); return [x, y, z]; };
/** Engine-frame point → core frame for the engine at azimuth a (null: the centre engine). */
const engineFrame = (a) => (a == null ? { x: 0, z: 0, yaw: 0 } : { x: polar(ENGINE_RING, a)[0], z: polar(ENGINE_RING, a)[1], yaw: tangentYaw(a) });
const toCore = (a, [lx, ly, lz]) => {
  const f = engineFrame(a), c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.x + lx * c + lz * s, ly, f.z - lx * s + lz * c];
};
/** Points round an arc at radius r and height y from azimuth a0 to a1 (deg), n steps. */
const arc = (r, y, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => at(r, a0 + ((a1 - a0) * i) / n, y));

// landing-leg geometry: the deployed stance matches the published ≈ 18 m (60 ft) span; leg length,
// hinge and piston fittings are estimates sized from photographs (see the 'landing legs' desc)
const LEG = {
  hingeR: R + 0.1, hingeY: 1.5,   // hinge on the engine-section skirt
  len: 8.0,                       // stowed from y 1.45 to 9.45
  deployDeg: 115,                 // deployed: 25° below horizontal, foot pads ≈ 9.15 m from the axis (≈ 18.3 m across), ≈ 1.9 m below the nozzle exits
  // foot pad (radius) and its centre [short of the tip, out from the hinge line]: folded into the
  // tip for ascent, swung to the end of the leg for landing
  foot: { r: 0.2, stowed: [0.9, 0.0], landed: [0.25, 0.15] },
  pistonB: [R + 0.13, 3.4],       // piston's stage fitting [r, y] at the top of the engine section
  pistonL: [6.6, 0.1],            // piston's leg fitting: distance along the leg, offset outward (inside the leg's fairing)
  tube: [3.0, 3.0, 3.0],          // nested piston sections (outer, middle, inner)
};

const pistonB = (a) => at(LEG.pistonB[0], a, LEG.pistonB[1]);

// Octaweb centre hub (layout estimated): an open ring wide enough for the centre engine's turbopump
// and its RP-1 inlet (out to r ≈ 0.67 m on the pump side) to pass up through it, and inboard of the
// outer engines' inner TVC actuators (r ≈ 0.89 m). Two spokes clear of the powerhead carry the centre
// engine's gimbal mount; two clevis brackets carry the upper ends of its TVC actuators.
const HUB = { r: 0.76, tube: 0.06, y: 2.08, spokes: [207.5, 297.5], clevis: [125, 235] };

/**
 * The engine section is identical on all three cores (nine Merlins and their plumbing, the TEA-TEB
 * supply, the leg-deployment helium and the engine controllers), so its geometry is built once and
 * shared by the three cores' meshes.
 */
let ENGINE_GEO = null;
function engineGeometry() {
  if (ENGINE_GEO) return ENGINE_GEO;
  const midKit = merlinKit({ level: 'mid' });
  const fullKit = merlinKit({ level: 'full' });
  const bellGeo = merlinBell(28);
  const placeFor = (kit, a) => {
    const f = engineFrame(a);
    const o = {};
    for (const key of Object.keys(kit)) o[key] = placeAll(kit[key], f.x, 0, f.z, f.yaw);
    return o;
  };
  const ring = { bells: [], pump: [], gg: [], duct: [], line: [], valve: [], ign: [], act: [] };
  const tvcLines = [], bleeds = [];
  for (const a of OUTER) {
    const [x, z] = polar(ENGINE_RING, a);
    const b = bellGeo.clone(); b.translate(x, 0, z); ring.bells.push(b);
    const e = placeFor(midKit, a);
    for (const key of ['pump', 'gg', 'duct', 'line', 'valve', 'ign', 'act']) ring[key].push(...e[key]);
    tvcLines.push(...e.tvc); bleeds.push(...e.bleed);
  }
  const ce = placeFor(fullKit, null);
  tvcLines.push(...ce.tvc); bleeds.push(...ce.bleed);
  // TEA-TEB tank and the lines to the three relight engines
  const teaTop = at(1.58, 112.5, 2.84);
  const ig = (a) => toCore(a, [-0.3, 2.36, 0.1]);
  const relight = [
    pipe([teaTop, at(1.5, 108, 2.7), ig(112.5)], 0.01, { seg: 4, tubular: 10 }),
    pipe([teaTop, at(1.35, 110, 2.6), at(0.9, 115, 2.32), at(0.55, 140, 2.34), ig(null)], 0.01, { seg: 4, tubular: 16 }),
    pipe([teaTop, at(1.52, 118, 2.4), ...arc(1.52, 2.15, 125, 270, 10), at(1.4, 275, 2.25), ig(292.5)], 0.01, { seg: 4, tubular: 40 }),
  ];
  // pneumatic helium bottles and the leg-deployment lines to the base of each piston
  const pb = [22.5, 202.5].map((a) => new THREE.SphereGeometry(0.12, 16, 10).translate(...at(1.58, a, 2.7)));
  const legHe = [];
  // the run round the bay passes over the fill & drain valves and inboard of the RP-1 fill risers
  // (see the fill & drain valves below)
  const heY = () => 2.95;
  const heArc = (a0, a1) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 3));
    return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return at(1.45, a, heY(a)); });
  };
  for (const [b, legs] of [[22.5, [45, 315]], [202.5, [135, 225]]]) {
    for (const la of legs) {
      const dlt = ((la - b + 540) % 360) - 180, side = Math.sign(dlt);
      const a1 = b + dlt - side * 6;
      legHe.push(pipe([at(1.58, b, 2.82), at(1.45, b + side * 4, 2.95), ...heArc(b + side * 8, a1), at(R - 0.01, a1, 2.95), at(R + 0.05, b + dlt - side * 3, 3.1), pistonB(la)], 0.0115, { seg: 4, tubular: 56, tension: 0.1 }));
    }
  }
  const ec = OUTER.map((a) => unit(1.64, a + 8, 1.8, 0.16, 0.2, 0.12));
  ec.push(unit(HUB.r - 0.06, 180, 1.7, 0.16, 0.2, 0.12));
  // mounts: a standoff from each outer controller to the engine-section wall; the centre engine's
  // hangs from a strap under the Octaweb's centre hub ring
  const ecb = OUTER.map((a) => unit(1.755, a + 8, 1.8, 0.1, 0.14, 0.11));
  ecb.push(block(-(HUB.r - 0.03), 1.91, 0, 0.06, 0.26, 0.08), block(-(HUB.r - 0.06), 1.795, 0, 0.12, 0.03, 0.1));
  ENGINE_GEO = {
    bells: merge(ring.bells), pump: merge(ring.pump), gg: merge(ring.gg), duct: merge(ring.duct),
    lines: merge([...ring.line, ...ring.ign]), valves: merge(ring.valve), act: merge(ring.act),
    chamber: merlinChamber(48), inj: merge(pintleInjector()), nozzle: merlinNozzle(56),
    cePump: merge(ce.pump), ceGG: merge(ce.gg), ceDuct: merge(ce.duct), ceLines: merge([...ce.line, ...ce.ign]), ceValves: merge(ce.valve), ceAct: merge(ce.act),
    tvc: merge(tvcLines), bleed: merge(bleeds), tea: merge([bottle(...at(1.58, 112.5, 2.62), 0.12, 0.42, 14)]), relight: merge(relight),
    pb: merge(pb), legHe: merge(legHe), ec: merge(ec), ecb: merge(ecb),
  };
  return ENGINE_GEO;
}

/**
 * Stowed landing leg in leg frame: x tangential, y along the leg (0 → len), z radial outward. A
 * Block 5 leg is widest and deepest at the hinge and tapers to a narrow rounded tip that lies flat
 * on the tank (no end face: the last rings close the shell smoothly). Section: a flattened lens, flat
 * inner face against the stage, rounded outer fairing. The foot pad folds into the tip.
 */
function legGeometry(len) {
  const rings = [];
  const M = 14;
  // a straight taper (1.02 m wide, 0.36 m deep at the hinge → 0.44 × 0.2 m) over all but the last
  // 0.3 m, then a blunt semicircular nose
  const tR = 1 - 0.3 / len;
  const ts = [];
  for (let i = 0; i <= 16; i++) ts.push((tR * i) / 16);
  for (let j = 1; j <= 6; j++) ts.push(tR + (1 - tR) * Math.sin((j / 6) * (Math.PI / 2)));
  for (const t of ts) {
    const y = t * len;
    const u = Math.min(t, tR) / tR;
    const k = t <= tR ? 1 : Math.sqrt(Math.max(0, 1 - ((t - tR) / (1 - tR)) ** 2));
    const w = Math.max(0.03, (1.02 - 0.58 * u) * k);
    const th = Math.max(0.012, (0.36 - 0.16 * u) * k);
    const ring = [];
    for (let j = 0; j < M; j++) {
      const a = (j / M) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      const z = cz > 0 ? cz * th : cz * 0.06 * k;
      ring.push([cx * w * 0.5, y, z + 0.06]);
    }
    rings.push(ring);
  }
  return loftRings(rings, { capStart: true, capEnd: true });
}

/** A small box mounted at radius r, azimuth a, height y, facing outward (w tangential, d radial). */
const unit = (r, a, y, w, h, d) => { const [x, z] = polar(r, a); return block(x, y, z, w, h, d, radialYaw(a)); };
/**
 * Standoff bracket for a box built with unit(r, a, y, w, h, d): a web from the box's outer face to a
 * doubler plate whose outer face sits at radius wall.
 */
const wallBracket = (r, a, y, w, h, d, wall) => {
  const ro = r + d / 2, pw = Math.min(0.3, w * 0.8);
  return [unit((ro + wall - 0.03) / 2 + 0.005, a, y, Math.min(0.12, w * 0.4), h * 0.55, wall - 0.03 - ro + 0.01), unit(wall - 0.015, a, y, pw, h + 0.06, 0.03)];
};
/** A flat panel on the skin at azimuth a with a row of fastener heads round its edge. */
function accessPanel(a, y, w, h, out) {
  out.panel.push(unit(R + 0.008, a, y, w, h, 0.012));
  const n = Math.max(3, Math.round(w / 0.12)), m = Math.max(3, Math.round(h / 0.12));
  const add = (dt, dy) => { const aa = a + ((dt * 180) / (Math.PI * R)); out.bolt.push(unit(R + 0.016, aa, y + dy, 0.022, 0.022, 0.01)); };
  for (let i = 0; i <= n; i++) { const dt = -w / 2 + 0.03 + ((w - 0.06) * i) / n; add(dt, h / 2 - 0.03); add(dt, -h / 2 + 0.03); }
  for (let j = 1; j < m; j++) { const dy = -h / 2 + 0.03 + ((h - 0.06) * j) / m; add(-w / 2 + 0.03, dy); add(w / 2 - 0.03, dy); }
}

/**
 * Build one core. kind: 'centre' | 'booster'. prefix names the parts ('Centre core', 'Side booster A').
 * paint: stage paint options. explodeBase: [x, y, z] added to every part's exploded offset.
 * attachSide: +1 for the booster on +x, −1 for the one on −x (its inboard face is the other way).
 * Returns handles the vehicle uses for animation and temperatures, including setLegs(k).
 */
export function buildCore(A, parent, { kind, prefix, explodeBase = [0, 0, 0], paint = {}, attachSide = 0 }) {
  const centre = kind === 'centre';
  const P = (name, info, objs) => {
    const e = info.explode || [0, 0, 0];
    return A.part(`${prefix} ${name}`, { ...info, explode: [e[0] + explodeBase[0], e[1] + explodeBase[1], e[2] + explodeBase[2]] }, objs, parent);
  };
  const out = { parts: [], fins: [], tanks: {} };
  const k = centre ? 1.18 : 1;                   // centre core: thicker tank walls, heavier structure
  // the T-0 umbilical plate faces the ground equipment: the tail service mast outboard of each
  // side booster, the transporter-erector (−z) for the centre core
  const t0Az = centre ? 270 : attachSide > 0 ? 0 : 180;
  const thermal = centre ? 'engineC' : 'engineB';

  // ------------------------------------------------------------------ paint and tank skins
  const span = [Y.heatShield, Y.s1Top];
  const vOf = (y) => (y - span[0]) / (span[1] - span[0]);
  const seamYs = [Y.engSectionTop, 7.4, 11.2, 15.0, Y.commonDome, 21.4, 25.0, 28.6, 32.2, 35.8, Y.loxTop];
  const paintMap = stagePaint(`${prefix}`, {
    seams: seamYs.map(vOf), soot: paint.soot ?? 0.12, streaks: paint.streaks ?? 20, seed: paint.seed ?? 5,
    word: { text: 'SPACEX', v0: vOf(20.5), v1: vOf(30.5), u: 0.583, size: 90 },
  });
  const skinMat = tankMaterial(paintMap, span[1] - span[0]);
  const tankBarrel = (y0, y1) => barrel(R, y0, y1, { v0y: span[0], v1y: span[1], rings: Math.max(2, Math.round((y1 - y0) / 4)) });
  // internal ring frames at the barrel-section welds (they also give Blueprint its station lines)
  const frameYs = [Y.engSectionTop, 7.4, 11.2, 15.0, 21.4, 25.0, 28.6, 32.2, 35.8, Y.loxTop, 41.4, Y.s1Top - 0.05];
  const frames = (y0, y1) => merge(frameYs.filter((y) => y >= y0 && y <= y1).map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 })));
  const frameMat = FM.aluDark();

  const lox = P('LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195, friction-stir welded monocoque barrel sections', mass: Math.round(4300 * k),
    desc: `Upper tank: ≈ 287 t of liquid oxygen, densified to −207 °C (66 K) so more fits in the same volume. It is a monocoque — the pressurised skin carries the load without stringers. Above its forward dome a ≈ 3.5 m forward skirt carries ${centre ? 'the avionics ring, the forward booster attach fittings and the interstage' : 'the avionics ring, the booster\'s half of the forward attach and the forward section'} (skirt length estimated).`,
    callout: !centre && attachSide > 0, anchor: [R + 0.02, 23.5, 0.3],
    explode: [0, 1.2, -6.5],
  }, [mesh(tankBarrel(Y.commonDome, Y.s1Top), skinMat), mesh(frames(Y.commonDome + 0.1, Y.s1Top), frameMat)]);
  lox.userData.part.thermalRole = 'lox';
  const rp1 = P('RP-1 tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195 skin on internal stringers', mass: Math.round(2500 * k),
    desc: 'Lower tank: ≈ 124 t of RP-1, a refined kerosene, chilled to about −7 °C. LOX and RP-1 burn at a mixture ratio of ≈ 2.33 by mass, so the denser oxidiser fills the longer tank. Propellant is ≈ 95 % of a fuelled core.',
    explode: [0, -0.6, -6.5],
  }, [mesh(tankBarrel(Y.engSectionTop, Y.commonDome), skinMat), mesh(frames(Y.engSectionTop, Y.commonDome), frameMat)]);
  rp1.userData.part.thermalRole = 'rp1';
  const str = [];
  for (let i = 0; i < 36; i++) {
    const a = i * 10 + 5;
    const [x, z] = polar(R - 0.045, a);
    str.push(block(x, (Y.engSectionTop + Y.commonDome) / 2, z, 0.05, Y.commonDome - Y.engSectionTop - 0.1, 0.035, radialYaw(a)));
  }
  const st = P('RP-1 tank stringers', {
    system: 'Structure', count: 36, xrayWeight: 0.35, material: 'Aluminium-lithium stringers welded to the skin', mass: Math.round(260 * k),
    desc: 'The RP-1 tank is skin-and-stringer: longitudinal stiffeners inside the wall stop it buckling under the weight of the full LOX tank above and the thrust below, even when pressure is low. The LOX tank above is a plain monocoque. Stringer count estimated.',
    explode: [0, -0.6, -4.2],
  }, mesh(merge(str), frameMat));
  st.userData.part.thermalRole = 'rp1';
  P('engine section skin', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skin panels with thermal protection coating', mass: Math.round(450 * k),
    desc: 'Aft skirt around the Octaweb. It carries the landing-leg hinges, the T-0 umbilical plate and the aft attach fittings; the hold-down clamps grip its base on the pad.',
    explode: [0, -1.6, -6.5],
  }, mesh(tankBarrel(Y.heatShield, Y.engSectionTop), skinMat));
  // access panels between the legs, below the T-0 plate and the aft attach fittings and clear of the raceway
  const apAz = [20, 68, 112, 160, 200, 248, 292, 340];
  const ap = { panel: [], bolt: [] };
  for (const a of apAz) accessPanel(a, 1.98, 0.45, 0.4, ap);
  P('engine-section access panels', {
    system: 'Skin & fairings', skin: true, count: apAz.length, material: 'Bolted aluminium access panels', mass: apAz.length * 3,
    desc: `Bolted panels between the legs let technicians reach the engine bay — valves, controllers, the TEA-TEB tank and the helium bottles — between flights; ${apAz.length} shown, count and positions taken from photographs.`,
    explode: [0, -1.6, -7.4],
  }, [mesh(merge(ap.panel), skinMat), mesh(merge(ap.bolt), FM.aluDark())]);

  // ------------------------------------------------------------------ bulkheads
  const fd = P('forward dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead (domes are aluminium, barrels Al-Li)', mass: Math.round(330 * k),
    desc: 'Ellipsoidal dome capping the LOX tank. The LOX vent and relief valve sits at its crown. Dome depth estimated.',
    explode: [0, 1.0, 0],
  }, mesh(dome(R - 0.01, Y.loxTop, D, 1), FM.domeAlu()));
  fd.userData.part.thermalRole = 'lox';
  const cd = P('common dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead', mass: Math.round(380 * k),
    desc: 'One bulkhead separates the LOX above from the RP-1 below, saving the length and mass of a separate intertank. Shown bulging into the RP-1 tank, so the weight and pressure of the LOX load it in tension; its exact curvature is not published. It must also insulate: −207 °C LOX on one side, −7 °C RP-1 on the other.',
    callout: centre, anchor: [R * 0.7, Y.commonDome - 0.4, 0.4], explode: [0, 0.4, 0],
  }, mesh(dome(R - 0.01, Y.commonDome, D, -1), FM.domeAlu()));
  cd.userData.part.thermalRole = 'lox';
  const ad = P('aft dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead with feed-line outlets', mass: Math.round(330 * k),
    desc: 'Closes the bottom of the RP-1 tank above the engine bay. The LOX transfer tube passes through its centre and nine RP-1 outlets around it feed the engines.',
    explode: [0, -0.4, 0],
  }, mesh(dome(R - 0.01, Y.engSectionTop, D, -1), FM.domeAlu()));
  ad.userData.part.thermalRole = 'rp1';

  // ------------------------------------------------------------------ pressurant system
  const copvGeo = [], strutGeo = [];
  for (const a of [30, 150, 270]) {
    const [x, z] = polar(1.05, a);
    copvGeo.push(bottle(x, 37.2, z, 0.3, 1.7, 20));
    const [wx, wz] = polar(R - 0.02, a);
    strutGeo.push(rod([x, 37.9, z], [wx, 38.4, wz], 0.03, 6), rod([x, 36.5, z], [wx, 36.0, wz], 0.03, 6));
  }
  const copv = P('helium COPVs', {
    system: 'Fuel', count: 3, material: 'Carbon-overwrapped aluminium-liner pressure vessels, struts', mass: 3 * 70,
    desc: 'Composite-overwrapped bottles of high-pressure helium submerged in the LOX, where the cold packs more gas into each bottle. Helium keeps the tanks pressurised as propellant drains, so the pumps never starve and the thin walls stay stiff. The first-stage bottle count and layout are not published; three are shown.',
    callout: centre, anchor: [1.2, 36.8, 0.85], explode: [0, 1.6, 2.2],
  }, [mesh(merge(copvGeo), FM.copv()), mesh(merge(strutGeo), FM.steelLine())]);
  copv.userData.part.thermalRole = 'lox';
  // one manifold joins the bottles; the fill line comes up the wall from the T-0 plate
  const fillAz = t0Az + 12.5;
  const man0 = [hoop(1.05, 0.016, 36.18, { seg: 48, tube: 4 })];
  for (const a of [30, 150, 270]) man0.push(post(...polar(1.05, a), 36.18, 36.36, 0.02, 6));
  man0.push(pipe([at(1.05, fillAz + 18, 36.18), at(1.5, fillAz + 4, 35.9), at(1.71, fillAz, 35.4), at(1.71, fillAz, Y.commonDome + 0.5),
    at(1.71, fillAz, Y.commonDome - 0.5), at(1.71, fillAz, 3.85), at(R - 0.06, fillAz, 3.55), at(R - 0.03, fillAz, T0_Y + 0.18)], 0.014, { seg: 4, tubular: 90, tension: 0.05 }));
  P('helium COPV manifold & fill line', {
    system: 'Fuel', material: 'Stainless manifold ring, stubs and fill line', mass: 18,
    desc: 'A ring manifold under the bottles ties all three COPVs into one pressurisation system; it is filled from the ground through the T-0 plate during the count. On CRS-7 (2015) a strut holding one of these bottles in a second-stage LOX tank failed and the vehicle was lost. Routing estimated.',
    explode: [0, 1.2, 3.2],
  }, mesh(merge(man0), FM.steelLine()));
  const hxAz = 330;                     // between the RP-1 feed lines of the 292.5° and 337.5° engines
  const [hxx, hxz] = polar(1.2, hxAz);
  const hx = P('helium heat exchanger', {
    system: 'Fuel', material: 'Stainless-steel coil heat exchanger', mass: 35,
    desc: 'Cold helium from the bottles is warmed here by engine heat before it goes back to the tank tops; warm gas fills more ullage per kilogram. Position in the engine bay estimated.',
    explode: [0, -1.0, 4.4],
  }, [mesh(block(hxx, 2.78, hxz, 0.4, 0.24, 0.28, radialYaw(hxAz)), FM.inconel()), mesh(hoop(0.11, 0.03, 2.78, { x: hxx, z: hxz, seg: 16, tube: 6 }), FM.steelLine())]);
  hx.userData.part.temp = 330;
  // helium lines: bottle → down the inside wall → heat exchanger → back up to the LOX and RP-1 ullage
  const [cx, cz] = polar(1.05, 270), [px, pz] = polar(1.7, hxAz - 8), [qx, qz] = polar(1.7, hxAz + 8);
  const press = [
    // (each riser leaves the aft dome inside the Octaweb's upper ring, then drops to the exchanger)
    pipe([[cx, 36.4, cz], [px * 0.9, 35.5, pz * 0.9], [px, 30, pz], [px, Y.commonDome + 0.3, pz], [px, Y.commonDome - 0.4, pz], [px, Y.engSectionTop + 0.2, pz],
      at(1.58, hxAz - 7, 3.5), at(1.4, hxAz - 5, 3.22), at(1.3, hxAz - 4, 3.0), at(1.27, hxAz - 4, 2.88)], 0.035, { seg: 6, tubular: 90 }),
    pipe([at(1.27, hxAz + 4, 2.88), at(1.3, hxAz + 4, 3.0), at(1.4, hxAz + 5, 3.22), at(1.58, hxAz + 7, 3.5), [qx, Y.engSectionTop + 0.3, qz], [qx, Y.commonDome - 0.5, qz],
      [qx, Y.commonDome + 0.4, qz], [qx, Y.loxTop - 0.2, qz], [qx * 0.7, Y.loxTop + 0.5, qz * 0.7]], 0.03, { seg: 6, tubular: 90 }),
    // RP-1 ullage feed: a branch off the riser into the top of the fuel tank, under the common dome
    pipe([[qx, Y.commonDome - 1.2, qz], [qx * 0.9, Y.commonDome - 1.0, qz * 0.9], [qx * 0.82, Y.commonDome - 0.95, qz * 0.82]], 0.025, { seg: 6, tubular: 8 }),
    // diffusers: perforated cans that spread the incoming gas so it does not jet onto the propellant
    post(qx * 0.82, qz * 0.82, Y.commonDome - 1.1, Y.commonDome - 0.85, 0.055, 10),
    post(qx * 0.7, qz * 0.7, Y.loxTop + 0.42, Y.loxTop + 0.66, 0.06, 10),
  ];
  P('pressurisation lines', {
    system: 'Fuel', material: 'Stainless steel helium lines, ullage diffusers', mass: 110,
    desc: 'Helium runs from the bottles in the LOX tank down the inside of the wall to the heat exchanger, then back up to the tops of both tanks — under the forward dome and under the common dome — where diffusers spread it into the ullage to hold the pressure as the propellant drains. Routing simplified.',
    explode: [0, 0.8, 4.0],
  }, mesh(merge(press), FM.steelLine()));

  // ------------------------------------------------------------------ propellant feed system
  const dcTop = domeY(R, Y.commonDome, D, -1, 0);
  const dcBottom = domeY(R, Y.engSectionTop, D, -1, 0);
  const inner = [
    post(0, 0, dcBottom - 0.4, dcTop + 0.05, 0.22, 20),
    lathe([[0.22, dcTop - 0.05], [0.45, dcTop + 0.12], [0.5, dcTop + 0.2]], 24),              // sump / anti-vortex inlet
  ];
  const outerWall = [post(0, 0, dcBottom + 0.06, dcTop - 0.06, 0.255, 24), hoop(0.258, 0.03, 10.6, { seg: 24, tube: 6 }), hoop(0.258, 0.03, 5.6, { seg: 24, tube: 6 })];
  const spacers = [];
  for (let y = dcBottom + 0.6; y < dcTop - 0.4; y += 2.0) spacers.push(hoop(0.238, 0.014, y, { seg: 20, tube: 4 }));
  const dc = P('double-wall LOX transfer tube', {
    system: 'Fuel', material: 'Aluminium inner line inside an outer wall, spacer rings in the annulus', mass: 180,
    desc: 'Carries LOX from the bottom of the LOX tank straight through the middle of the RP-1 tank to the engine bay. It is double-walled: the gap between the walls keeps the 66 K oxygen from chilling the 266 K kerosene around it (which could freeze) and from boiling off itself. Inner line Ø0.44 m; wall gap and spacer pitch estimated.',
    callout: centre, anchor: [0.25, 12.8, 0.25], explode: [0, 0, 2.6],
  }, [mesh(merge(inner), FM.steelLine()), mesh(merge(outerWall), FM.aluDark()), mesh(merge(spacers), FM.gold())]);
  dc.userData.part.thermalRole = 'lox';

  const loxInlet = (a) => toCore(a, [0.36, 2.5, 0]);
  const rpInlet = (a) => toCore(a, [0.61, 2.45, 0]);
  const man = [hoop(0.85, 0.09, 2.62, { seg: 48, tube: 10 })];                                 // LOX distribution ring
  for (const a of OUTER) {
    const [ix, iz] = polar(0.85, a);
    const [lx, , lz] = loxInlet(a);
    man.push(pipe([[ix, 2.62, iz], [(ix + lx) / 2, 2.62, (iz + lz) / 2], [lx, 2.52, lz]], 0.07, { seg: 8, tubular: 10 }));
  }
  man.push(pipe([[0, dcBottom - 0.3, 0], [0.2, 2.6, 0.2], [0.6, 2.62, 0.6]], 0.16, { seg: 12, tubular: 10 }));
  man.push(pipe([[0, dcBottom - 0.3, 0], [0.15, 2.45, 0], [0.36, 2.52, 0]], 0.08, { seg: 10, tubular: 8 }));      // to the centre engine
  const mf = P('LOX distribution manifold', {
    system: 'Fuel', xrayWeight: 0.5, material: 'Stainless steel ring manifold and feed legs', mass: 140,
    desc: 'Below the aft dome the transfer tube splits into a ring that feeds the eight outer turbopumps, plus a short leg to the centre engine. Ring shape and routing estimated; the real layout is not published.',
    explode: [0, -1.2, 2.6],
  }, mesh(merge(man), FM.steelLine()));
  mf.userData.part.thermalRole = 'lox';
  const rpl = [];
  for (const a of [...OUTER, null]) {
    const [fx, fy, fz] = a == null ? at(0.75, -30, aftDomeY(0.75) + 0.05) : at(1.05, a + 6, aftDomeY(1.05) + 0.05);
    const [rx, , rz] = rpInlet(a);
    rpl.push(pipe([[fx, fy, fz], [(fx + rx) / 2, 2.75, (fz + rz) / 2], [rx, 2.47, rz]], 0.06, { seg: 8, tubular: 10 }));
  }
  const rf = P('RP-1 feed lines', {
    system: 'Fuel', count: 9, xrayWeight: 0.5, material: 'Aluminium and stainless lines with flex joints', mass: 120,
    desc: 'Nine lines from outlets in the aft dome to each engine\'s fuel-pump inlet. RP-1 is also tapped off at high pressure from each pump to drive that engine\'s steering actuators. Routing estimated.',
    explode: [0, -1.0, 3.2],
  }, mesh(merge(rpl), FM.steelLine()));
  rf.userData.part.thermalRole = 'rp1';
  const pv = [];
  for (const a of [...OUTER, null]) {
    const [lx, , lz] = loxInlet(a), [rx, , rz] = rpInlet(a);
    pv.push(post(lx, lz, 2.5, 2.62, 0.095, 12), post(rx, rz, 2.47, 2.57, 0.08, 12));
  }
  const pvp = P('prevalves', {
    system: 'Fuel', count: 18, xrayWeight: 0.5, material: 'Pneumatically actuated isolation valves', mass: 18 * 6,
    desc: 'One LOX and one RP-1 prevalve at each engine inlet hold the propellant above the turbopumps until start, and can isolate a shut-down engine — part of what makes engine-out survivable.',
    explode: [0, -1.4, 3.6],
  }, mesh(merge(pv), FM.gold()));
  pvp.userData.part.thermalRole = 'lox';

  // fill, drain and vent valves: ground lines enter at the T-0 plate; the vents sit at the tank tops
  const lfd = P('LOX fill & drain valve', {
    system: 'Fuel', material: 'Stainless valve body and line into the LOX manifold', mass: 22,
    desc: 'LOX loads from the T-0 plate through this valve into the feed manifold and up the transfer tube. On Falcon Heavy first-stage LOX loading starts about 45 minutes before liftoff (NASA\'s countdown for Psyche, 2023; 35 minutes on Falcon 9). Because the densified LOX keeps boiling off, it is topped up until the last minutes. Line routing simplified.',
    explode: [0, -0.8, 4.8],
  }, mesh(merge([
    // from the plate's lower port down beside the skin, outboard of the Octaweb's upper ring and
    // under the Y-ring, then in under the harness ring to the valve and the LOX manifold
    pipe([at(R - 0.05, t0Az + 12.5, T0_Y - 0.18), at(1.745, t0Az + 12.5, 2.98), at(1.745, t0Az + 12.3, 2.8), at(1.55, t0Az + 11, 2.72), at(1.2, t0Az + 9, 2.68), at(0.98, t0Az + 6, 2.64)], 0.06, { seg: 8, tubular: 28 }),
    unit(1.55, t0Az + 11, 2.72, 0.2, 0.2, 0.2),
  ]), FM.steelLine()));
  lfd.userData.part.thermalRole = 'lox';
  const rfd = P('RP-1 fill & drain valve', {
    system: 'Fuel', material: 'Stainless valve body and line into the aft dome', mass: 18,
    desc: 'RP-1 loads through this valve into the bottom of the fuel tank from the T-0 plate; on Falcon Heavy first-stage RP-1 loading starts about 50 minutes before liftoff, just ahead of the LOX. The same path drains the stage after a scrub.',
    explode: [0, -0.6, 5.4],
  }, mesh(merge([
    // the same way down and in from the other lower port, then up into the aft dome inside the upper ring
    pipe([at(R - 0.05, t0Az - 12.5, T0_Y - 0.18), at(1.745, t0Az - 12.5, 2.98), at(1.745, t0Az - 12.3, 2.82), at(1.55, t0Az - 10, 2.78), at(1.37, t0Az - 10, 2.84),
      at(1.35, t0Az - 10, aftDomeY(1.35) + 0.05)], 0.05, { seg: 8, tubular: 28 }),
    unit(1.55, t0Az - 10, 2.78, 0.18, 0.16, 0.18),
  ]), FM.steelLine()));
  rfd.userData.part.thermalRole = 'rp1';
  const ventTop = Y.loxTop + D;
  const lvv = P('LOX vent & relief valve', {
    system: 'Fuel', material: 'Stainless vent and relief valve, vent duct to an overboard port', mass: 16,
    desc: 'At the crown of the forward dome. While the LOX boils off on the pad it vents the vapour overboard (the plume streaming off the stage in launch videos) and relieves the tank if ullage pressure rises too far.',
    explode: [0, 2.2, 1.2],
  }, mesh(merge([
    post(0, 0, ventTop - 0.05, ventTop + 0.25, 0.12, 12), post(0, 0, ventTop + 0.25, ventTop + 0.32, 0.18, 12),
    pipe([[0.15, ventTop + 0.28, 0], at(1.2, 15, ventTop + 0.1), at(R - 0.06, 20, Y.loxTop + 0.55)], 0.05, { seg: 8, tubular: 12 }),
    unit(R + 0.01, 20, Y.loxTop + 0.55, 0.16, 0.16, 0.04),
  ]), FM.steelLine()));
  lvv.userData.part.thermalRole = 'lox';
  const rvv = P('RP-1 vent valve', {
    system: 'Fuel', material: 'Stainless vent valve and overboard port', mass: 8,
    desc: 'Relieves the fuel tank\'s ullage just under the common dome, where the helium pressurant collects above the RP-1. Position estimated.',
    explode: [0, 0.2, 2.4],
  }, mesh(merge([unit(1.68, 200, Y.commonDome - 0.55, 0.2, 0.2, 0.16), rod(at(1.68, 200, Y.commonDome - 0.55), at(R + 0.02, 200, Y.commonDome - 0.55), 0.035, 8)]), FM.steelLine()));
  rvv.userData.part.thermalRole = 'rp1';
  const [t0x, t0z] = polar(R + 0.04, t0Az);
  const t0 = [unit(R + 0.04, t0Az, T0_Y, 1.25, 0.7, 0.08)];
  for (const dy of [-0.18, 0.18]) for (const dt of [-0.4, -0.13, 0.13, 0.4]) {
    const a = t0Az + (dt * 180) / (Math.PI * R);
    t0.push(unit(R + 0.1, a, T0_Y + dy, 0.12, 0.12, 0.06));
  }
  P('T-0 umbilical plate', {
    system: 'Fuel', material: 'Quick-disconnect plate: LOX, RP-1, helium, nitrogen, TEA-TEB, power and data', mass: 45,
    desc: centre
      ? 'Where the ground lines plug into the centre core until liftoff: LOX, RP-1, helium, gaseous nitrogen, TEA-TEB igniter fluid, power and data through quick-disconnects that release at T-0 (Spaceflight Now, 2010, for Falcon 9). Shown facing the transporter-erector; the routing of the centre core\'s base umbilicals is not published.'
      : 'Where the tail service mast plugs into the side booster until liftoff: LOX, RP-1, helium, gaseous nitrogen, TEA-TEB, power and data through quick-disconnects that release at T-0, then the mast swings back under a hood.',
    explode: [t0x * 0.8, -1.0, t0z * 0.8],
  }, mesh(merge(t0), FM.aluDark()));
  // gaseous-nitrogen purge: a ring in the engine bay fed from the T-0 plate
  // (just inside the skin, outboard of the Octaweb's corner posts and webs; nozzles between the posts)
  // (below the side boosters' aft attach fittings)
  const purge = [hoop(1.795, 0.0125, 2.3, { seg: 96, tube: 4 }), pipe([at(R - 0.03, t0Az - 4.07, T0_Y - 0.18), at(1.8, t0Az - 4.07, 2.9), at(1.797, t0Az - 4.3, 2.32)], 0.0125, { seg: 4, tubular: 12 })];
  for (let i = 0; i < 12; i++) purge.push(post(...polar(1.79, i * 30 + 7.5), 2.24, 2.29, 0.012, 5));
  P('GN₂ purge manifold', {
    system: 'Environmental control', material: 'Stainless purge ring with nozzles', mass: 6,
    desc: 'Gaseous nitrogen from the ground (one of the supplies at the T-0 plate) flushes the closed engine bay before ignition, keeping out oxygen boiled off from the LOX and moist Florida air. Use inferred from the ground-supply list; layout estimated.',
    explode: [0, -1.6, 4.2],
  }, mesh(merge(purge), FM.steelLine()));

  // ------------------------------------------------------------------ Octaweb thrust structure
  const ow = [];
  const oct = (r, y) => Array.from({ length: 8 }, (_, i) => { const [x, z] = polar(r, i * 45); return [x, y, z]; });
  // the lower ring is set out to a 1.75 m vertex radius, clear of the outboard TVC actuators' lower ends
  for (const [y, h, rv] of [[1.45, 0.2, 1.75], [3.05, 0.16, 1.7]]) {
    const v = oct(rv, y);
    for (let i = 0; i < 8; i++) ow.push(bar(v[i], v[(i + 1) % 8], 0.12, h));
  }
  oct(1.7, 0).forEach(([x, , z], i) => ow.push(block(x, 2.25, z, 0.14, 1.6, 0.14, radialYaw(i * 45)), bar([x, 3.05, z], [x * 1.04, 3.24, z * 1.04], 0.1, 0.1)));   // corner posts, square to the axis
  for (const a of OUTER) {
    const [x, z] = polar(ENGINE_RING, a);
    const [ix, iz] = polar(HUB.r, a);
    ow.push(bar([ix, 2.08, iz], at(ENGINE_RING - 0.11, a, 2.08), 0.12, 0.18));   // radial web to the side of the engine mount
    for (const s of [-22.5, 22.5]) {
      const [vx, vz] = polar(1.7, a + s);
      ow.push(bar([x, 2.15, z], [vx, 2.4, vz], 0.1, 0.12));                // corner webs from the pad's top to the octagon, over the turbopump
    }
    // gimbal mount pad, square to its engine, on a boss over the gimbal block (as at the centre)
    ow.push(block(x, 2.09, z, 0.26, 0.12, 0.26, radialYaw(a)), post(x, z, Y.engineTop - 0.005, 2.035, 0.1, 16));
  }
  // attachment ring at the dome-to-barrel junction (the tank's Y-ring)
  ow.push(hoop(R - 0.04, 0.04, 3.3, { seg: 64, tube: 6 }));
  // centre hub (see HUB): the ring, the centre engine's gimbal mount on two spokes, actuator clevises
  ow.push(hoop(HUB.r, HUB.tube, HUB.y, { seg: 40, tube: 8 }));
  ow.push(post(0, 0, HUB.y - 0.05, HUB.y + 0.07, 0.15, 20), post(0, 0, Y.engineTop - 0.005, HUB.y - 0.045, 0.1, 16));   // gimbal mount plate and boss
  const spoke = (a, r0, r1, y, w, h) => unit((r0 + r1) / 2, a, y, w, h, r1 - r0);   // radial bar, w tangential × h high
  for (const a of HUB.spokes) ow.push(spoke(a, 0.12, HUB.r - 0.04, HUB.y, 0.08, 0.09));
  for (const a of HUB.clevis) ow.push(spoke(a, 0.47, HUB.r - 0.04, 2.155, 0.09, 0.09));
  P('Octaweb', {
    system: 'Structure', xrayWeight: 0.4, material: 'Bolted aluminium thrust structure (Block 5)', mass: Math.round(1150 * k),
    desc: 'Octagonal thrust structure: eight Merlins on a ring around a ninth. It carries ≈ 7.6 MN of sea-level thrust into the tank wall at the aft Y-ring and makes engine-out tolerable — any one engine can shut down and the others gimbal to compensate. Its centre hub is an open ring, so the centre engine\'s turbopump and feed lines pass up through it; the centre engine hangs from a mount on two spokes (hub layout estimated).',
    callout: centre, anchor: [1.75, 2.6, 0.5], explode: [0, -2.2, 0],
  }, mesh(merge(ow), FM.aluDark()));

  const holes = [[0, 0, 0.37], ...OUTER.map((a) => [...polar(ENGINE_RING, a), 0.37])];
  const boots = [], clampRings = [];
  for (const [x, z] of [[0, 0], ...OUTER.map((a) => polar(ENGINE_RING, a))]) {
    const b = lathe([[0.37, Y.heatShield - 0.05], [0.28, Y.heatShield - 0.13], [0.19, Y.throat - 0.12]], 24);
    b.translate(x, 0, z);
    boots.push(b);
    clampRings.push(hoop(0.355, 0.012, Y.heatShield - 0.06, { x, z, seg: 24, tube: 4 }), hoop(0.195, 0.012, Y.throat - 0.11, { x, z, seg: 20, tube: 4 }));
  }
  const hs = P('heat shield & engine boots', {
    system: 'Thermal control', xrayWeight: 0.35, material: 'High-temperature composite heat shield, flexible fabric engine boots with clamp rings (materials not published)', mass: 520,
    desc: 'Closes the bottom of the engine bay against the radiant heat of 27 plumes and the re-entry burn. Flexible boots, clamped round each nozzle, seal the gap while it gimbals. The Block 5 shield is built to be reused; on a Falcon 9 in February 2021 hot gas got through a damaged boot and an engine shut down early.',
    explode: [0, -3.2, 0],
  }, [mesh(perforatedDisc(R - 0.005, holes, Y.heatShield, 0.06, 96), FM.heatShield()), mesh(merge(boots), FM.boot()), mesh(merge(clampRings), FM.steelLine())]);
  hs.userData.part.thermalRole = 'heatshield';
  const hold = [0, 90, 180, 270].map((a) => { const [x, z] = polar(R - 0.12, a); return block(x, Y.heatShield + 0.12, z, 0.34, 0.26, 0.34, radialYaw(a)); });
  P('hold-down fittings', {
    system: 'Structure', count: 4, material: 'Machined aluminium fittings on the engine-section ring', mass: 4 * 30,
    desc: 'Four hard points at the base of the engine section that the pad\'s hydraulic hold-down clamps grip. The whole thrust of nine engines bears on them until the computers confirm every engine is healthy and the clamps release.',
    explode: [0, -2.6, -1.0],
  }, mesh(merge(hold), FM.aluDark()));

  // ------------------------------------------------------------------ Merlin 1D engines
  const EG = engineGeometry();
  const O = (name, info, objs) => {
    const p = P(name, { system: 'Propulsion', count: 8, xrayWeight: 0.3, ...info }, objs);
    if (info.hot) p.userData.part.thermalRole = thermal;
    return p;
  };
  O('outer Merlin 1D thrust chambers & nozzles', {
    material: 'Milled copper-alloy liner in an Inconel jacket, regeneratively cooled chamber and nozzle', mass: 8 * 190, hot: true,
    desc: centre
      ? 'Eight of the centre core\'s nine engines, each 845 kN at sea level and 914 kN in vacuum and ≈ 467 kg with its TVC actuators. The centre core throttles them back shortly after liftoff so it still has propellant when the side boosters separate. Merlin 1D throttles from 845 kN to 482 kN (≈ 57 %, Falcon User\'s Guide).'
      : 'Eight Merlin 1D on the Octaweb ring, 845 kN each at sea level (7.6 MN per core with the centre engine) and ≈ 467 kg each with TVC. Each bell expands the exhaust 16 : 1; fuel flowing through channels in the copper liner cools the chamber and nozzle before it is burned.',
    explode: [0, -4.2, 0],
  }, mesh(EG.bells, FM.nozzle()));
  O('outer Merlin 1D turbopumps', {
    material: 'Single shaft: LOX impeller, RP-1 impeller, turbine', mass: 8 * 70,
    desc: 'Each engine\'s own turbopump: one shaft carries the LOX impeller, the RP-1 impeller and the turbine that drives them, raising both propellants to injection pressure. The 1D\'s pump speed and power are not published (the Merlin 1C\'s ran at 36,000 rpm and ≈ 10,000 hp).',
    explode: [0, -3.4, 1.6],
  }, mesh(EG.pump, FM.pump()));
  O('outer Merlin 1D gas generators', {
    material: 'Inconel combustors', mass: 8 * 12, hot: true,
    desc: 'Small fuel-rich combustors that burn a few per cent of the propellants to spin each turbine. On 2 October 2020 a Falcon 9 aborted at T-2 s because a gas-generator port was blocked with masking lacquer; the engines were swapped and the mission flew a month later.',
    explode: [0, -3.0, 2.2],
  }, mesh(EG.gg, FM.inconel()));
  O('outer Merlin 1D turbine exhaust ducts', {
    material: 'Inconel ducts', mass: 8 * 10, hot: true,
    desc: 'Dump the sooty, fuel-rich turbine gas overboard through the heat shield beside each nozzle — the open part of the open gas-generator cycle, and the dark stream visible beside each Merlin plume.',
    explode: [0, -4.8, 1.0],
  }, mesh(EG.duct, FM.inconel()));
  O('outer Merlin 1D propellant ducts & valves', {
    material: 'Stainless ducts; main LOX and fuel valves, GG valve, mixture-ratio trim valve, TEA-TEB igniter lines', mass: 8 * 30,
    desc: 'Each engine\'s pump-discharge ducts to the injector and cooling jacket, its main oxidiser and fuel valves, gas-generator valve and dual TEA-TEB igniter lines. The mixture ratio is set mainly by the sizing of these lines; a servo-driven butterfly valve on the fuel side trims it.',
    explode: [0, -3.8, 2.8],
  }, [mesh(EG.lines, FM.steelLine()), mesh(EG.valves, FM.gold())]);
  P('outer-engine TVC actuators', {
    system: 'Flight controls', count: 16, xrayWeight: 0.5, material: 'Hydraulic actuators powered by high-pressure RP-1, gimbal blocks',
    mass: 16 * 14,
    desc: 'Two actuators per engine gimbal the nozzle a few degrees in pitch and yaw to steer; with all eight outer engines gimballing, the stage can roll too. Their working fluid is RP-1 tapped from the engine\'s own fuel pump.',
    explode: [0, -2.6, 1.4],
  }, mesh(EG.act, FM.steelLine()));

  // the centre engine, broken out into its components
  {
    const E = (name, info, objs) => {
      const p = P(name, { system: 'Propulsion', xrayWeight: 0.45, ...info }, objs);
      if (info.hot) p.userData.part.thermalRole = thermal;
      return p;
    };
    const who = centre ? 'Centre engine of the centre core' : 'Centre engine of the side booster';
    const inj = mesh(EG.inj, FM.gold());
    inj.userData.xrayWeight = 1;                  // reads through the chamber wall in X-ray
    E('Merlin 1D thrust chamber & pintle injector', {
      material: 'Milled copper-alloy liner, Inconel jacket; pintle injector, faceplate, LOX dome and fuel manifold inside', mass: 140, hot: true,
      desc: `${who}. RP-1 and LOX meet at a single pintle injector — a central post whose sleeve sprays fuel across a sheet of oxidiser, which gives inherent combustion stability (the same idea first flew on the Apollo Lunar Module descent engine). They burn at about 9.7 MPa and roughly 3,600 K.`,
      explode: [0, -2.3, 4.6],
    }, [mesh(EG.chamber, FM.copper()), inj]);
    E('Merlin 1D nozzle', {
      material: 'Regeneratively cooled channel-wall nozzle', mass: 110, hot: true,
      desc: 'Expands the exhaust 16 : 1 to a ≈ 0.92 m exit. Sized for sea level: a bigger bell would over-expand at liftoff and the flow would separate from the wall.',
      explode: [0, -3.3, 4.6],
    }, mesh(EG.nozzle, FM.nozzle()));
    E('Merlin 1D turbopump', {
      material: 'Single shaft: LOX impeller, RP-1 impeller, turbine', mass: 120,
      desc: 'One shaft carries the LOX impeller (top), the RP-1 impeller and the turbine (bottom), so a single bearing system and a single turbine drive both pumps. The 36,000 rpm and ≈ 10,000 hp often quoted are for the Merlin 1C\'s Barber-Nichols pump; the 1D, with more than twice the thrust, has no published figure.',
      anchor: [0.5, 1.5, 0.2], explode: [1.0, -1.9, 4.6],
    }, [mesh(EG.cePump, FM.pump())]);
    E('Merlin 1D gas generator', {
      material: 'Inconel combustor', mass: 18, hot: true,
      desc: 'Burns a few per cent of the propellants, fuel-rich and therefore cool enough for the turbine blades, to drive the turbine. In this open cycle the turbine gas is dumped overboard instead of entering the main chamber — simpler and lighter than staged combustion, at the cost of a few seconds of Isp.',
      explode: [1.3, -2.5, 5.3],
    }, mesh(EG.ceGG, FM.inconel()));
    E('Merlin 1D turbine exhaust duct', {
      material: 'Inconel', mass: 12, hot: true,
      desc: 'Carries the sooty, fuel-rich turbine exhaust out through the heat shield — the dark stream visible beside each Merlin plume.',
      explode: [1.7, -3.0, 4.6],
    }, mesh(EG.ceDuct, FM.inconel()));
    E('Merlin 1D valves & TEA-TEB igniter', {
      material: 'Main valves, GG valve, mixture-ratio trim valve and servo, stainless ducts and igniter lines', mass: 30,
      desc: centre
        ? 'Main oxidiser and fuel valves, the gas-generator valve, a servo-motor butterfly valve that trims the mixture ratio, and the dual-redundant ignition lines: a slug of pyrophoric TEA-TEB, which ignites on contact with LOX, lights the gas generator and the chamber.'
        : 'Main valves, GG valve, mixture-ratio trim valve and the dual TEA-TEB ignition lines. This is one of the three engines per core that relight for the boost-back, entry and landing burns, so its igniters fire up to four times a flight.',
      explode: [-1.0, -1.9, 4.6],
    }, [mesh(EG.ceLines, FM.steelLine()), mesh(EG.ceValves, FM.gold())]);
    E('Merlin 1D gimbal & TVC actuators', {
      system: 'Flight controls', count: 2, material: 'Gimbal bearing block, hydraulic actuators (RP-1 working fluid)', mass: 40,
      desc: 'The centre engine gimbals too: it is the Merlin that usually relights alone for the landing burn, so it must steer.',
      explode: [-0.8, -1.3, 5.3],
    }, mesh(EG.ceAct, FM.steelLine()));
  }
  P('TVC hydraulic supply & return lines', {
    system: 'Hydraulics', count: 36, xrayWeight: 0.6, material: 'Stainless high-pressure lines, Ø ≈ 20 mm', mass: 9 * 3,
    desc: 'Merlin needs no separate hydraulic system: each turbopump supplies high-pressure RP-1 to its two TVC actuators, and the fluid returns to the pump\'s low-pressure inlet, so there is no hydraulic fluid to run out. Two lines per actuator; routing estimated.',
    explode: [0, -2.2, 2.4],
  }, mesh(EG.tvc, FM.steelLine()));
  P('engine-chill bleed valves & lines', {
    system: 'Propulsion', count: 9, xrayWeight: 0.5, material: 'Bleed valves and overboard lines', mass: 9 * 2,
    desc: 'About seven minutes before launch the engines begin "engine chill": bleed valves open and LOX flows through each turbopump and overboard through the heat shield, so the hardware is already cold when subcooled propellant arrives at start and does not suffer cold shock.',
    explode: [0, -2.9, 3.0],
  }, mesh(EG.bleed, FM.steelLine()));

  // engine-bay equipment: TEA-TEB supply, pneumatic helium bottles, engine controllers
  P('TEA-TEB ignition tank', {
    system: 'Propulsion', material: 'Stainless pressure vessel', mass: 25,
    desc: 'Holds the pyrophoric triethylaluminium-triethylborane that lights the engines. Spaceflight Now (2010) listed igniter fluid among the ground supplies at the T-0 plate, which suggests the liftoff starts draw it from the ground and this tank serves the in-flight relights; current Block 5 practice is not published. Its green flash shows in the exhaust at every ignition. Tank position estimated.',
    explode: [0, -1.4, 4.2],
  }, mesh(EG.tea, FM.steelLine()));
  P('TEA-TEB relight lines', {
    system: 'Propulsion', count: 3, material: 'Stainless lines, Ø ≈ 10 mm', mass: 4,
    desc: 'Three engines per core relight for the boost-back, entry and landing burns: the centre engine and two outer ones. Each restart needs a fresh slug of TEA-TEB from the tank. Which two outer engines are the relight engines is not published; they are shown opposite each other.',
    explode: [0, -1.8, 4.8],
  }, mesh(EG.relight, FM.steelLine()));
  P('pneumatic helium bottles', {
    system: 'Recovery', count: 2, material: 'Composite-overwrapped high-pressure helium bottles', mass: 2 * 12,
    desc: 'Supply the high-pressure helium that deploys the landing legs and works the engine-bay pneumatic valves. Bottle count and position estimated.',
    explode: [0, -0.8, 5.0],
  }, mesh(EG.pb, FM.copv()));
  P('leg-deployment helium lines', {
    system: 'Recovery', count: 4, xrayWeight: 1, material: 'Stainless high-pressure lines, Ø ≈ 12 mm', mass: 4 * 1.5,
    desc: 'Run from the two engine-bay helium bottles through the skirt to the base of each leg\'s telescoping piston. Opening the valve drives the pistons out and swings the legs down in the last seconds before touchdown. Routing estimated.',
    explode: [0, -1.2, 5.6],
  }, mesh(EG.legHe, FM.steelLine()));
  P('engine controllers', {
    system: 'Avionics', count: 9, material: 'Radiation-tolerant engine computers', mass: 9 * 4,
    desc: 'Each Merlin has its own controller made of three computers that vote, each with two processors checking each other (the flight software is C++ on Linux). It runs start-up, throttle and shutdown sequences and reports health to the flight computers, which can shut an engine down and re-plan around it. The eight outer ones stand off the engine-section wall beside their engines; the centre engine\'s hangs under the Octaweb hub. Positions estimated.',
    explode: [0, -1.8, 2.0],
  }, [mesh(EG.ec, FM.avionics()), mesh(EG.ecb, FM.aluDark())]);

  // ------------------------------------------------------------------ forward structure
  let finY;
  if (centre) {
    const inter = P('interstage', {
      system: 'Separation', skin: true, material: 'Carbon-fibre face sheets on aluminium honeycomb under the Block 5 black thermal layer', mass: 2100,
      desc: 'Composite shroud 4.5 m long (Espace & Exploration), fixed to the forward end of the first-stage tank. It covers the Merlin Vacuum nozzle, carries the grid fins, cold-gas thrusters and the stage-separation system at its forward end, and stays with the centre core at separation. Block 5 left it black (an uninsulated, heat-tolerant layer for re-entry) in place of the painted interstage of earlier Falcons; the first Falcon Heavy\'s centre core in 2018 still had a white-painted one.',
      explode: [0, 2.0, 0],
    }, [mesh(barrel(R, Y.s1Top, Y.interTop, { rings: 3 }), FM.blackTPS()), mesh(barrel(R - 0.03, Y.s1Top, Y.interTop), FM.compositeInner())]);
    inter.userData.part.thermalRole = 'ambient';
    const door = { panel: [], bolt: [] };
    accessPanel(150, 44.3, 0.6, 0.8, door);
    P('interstage access door', {
      system: 'Skin & fairings', skin: true, material: 'Bolted composite door', mass: 6,
      desc: 'Lets technicians reach the Merlin Vacuum nozzle, the separation system and the interstage equipment once the stages are mated. Position taken from photographs.',
      explode: [0, 2.0, 1.2],
    }, [mesh(merge(door.panel), FM.blackTPS()), mesh(merge(door.bolt), FM.aluDark())]);
    const latch = [];
    for (const a of [0, 120, 240]) {
      // a hook latch closed over a fitting on the second stage's aft ring, with its pneumatic release actuator
      latch.push(unit(R - 0.12, a, Y.interTop - 0.18, 0.3, 0.36, 0.16), unit(R - 0.05, a, Y.interTop - 0.02, 0.22, 0.06, 0.08));
      latch.push(rod(at(1.55, a + 4, Y.interTop - 0.3), at(1.62, a + 4, Y.interTop - 0.12), 0.03, 8));
    }
    latch.push(hoop(R - 0.06, 0.05, Y.interTop - 0.05, { seg: 96, tube: 6 }));
    P('stage-separation latches', {
      system: 'Separation', count: 3, material: 'Reusable mechanical latches with redundant pneumatic release actuators, separation ring', mass: 120,
      desc: 'Three mechanical latches between the top of the interstage and the base of the second-stage fuel tank hold the stages together (the original Falcon 9 had twelve attachment points). After the first-stage engines shut down, high-pressure helium opens them through redundant actuators — no explosives, so the actual flight hardware can be tested before flight.',
      explode: [0, 2.9, 0],
    }, mesh(merge(latch), FM.aluDark()));
    const push = [];
    for (const a of [60, 180, 300]) {
      const [x, z] = polar(R - 0.2, a);
      push.push(post(x, z, Y.interTop - 0.55, Y.interTop - 0.02, 0.07, 12), post(x, z, Y.interTop - 0.75, Y.interTop - 0.55, 0.11, 12));
    }
    P('stage-separation pneumatic pushers', {
      system: 'Separation', count: 3, material: 'Helium-preloaded pneumatic pushers, ≈ 0.5 m stroke', mass: 60,
      desc: 'The same helium circuit preloads the pushers, which shove the stages apart once the latches let go. The Falcon User\'s Guide gives four pushers including a redundant centre pusher that further cuts the chance of the stages touching again; the centre pusher\'s mounting is not published, so only the three on the ring are drawn (their positions estimated).',
      explode: [0, 3.5, 0],
    }, mesh(merge(push), FM.steelLine()));
    const sepHe = [bottle(...at(1.42, 330, 46.6), 0.15, 0.6, 14), hoop(1.5, 0.012, 47.1, { seg: 64, tube: 4 }),
      pipe([at(1.42, 330, 46.92), at(1.47, 332, 47.06), at(1.5, 336, 47.1)], 0.012, { seg: 4, tubular: 6 })];
    for (const a of [0, 120, 240]) sepHe.push(pipe([at(1.5, a + 4, 47.1), at(1.55, a + 4, Y.interTop - 0.3)], 0.012, { seg: 4, tubular: 4 }));
    for (const a of [60, 180, 300]) sepHe.push(pipe([at(1.5, a, 47.1), at(1.52, a, Y.interTop - 0.65), at(1.53, a, Y.interTop - 0.66)], 0.012, { seg: 4, tubular: 4 }));
    P('stage-separation helium bottle & lines', {
      system: 'Separation', material: 'Composite-overwrapped helium bottle, stainless ring line', mass: 14,
      desc: 'The high-pressure helium circuit that releases the latches and preloads the pushers: one bottle and a ring line round the inside of the interstage\'s forward end. The system is all-pneumatic, which keeps the separation shock benign and leaves almost no debris. Bottle size and position estimated.',
      explode: [0, 2.5, 1.4],
    }, mesh(merge(sepHe), FM.steelLine()));
    finY = Y.interTop - 0.45;
  } else {
    const fsec = P('forward section', {
      system: 'Structure', skin: true, material: 'Carbon composite, black thermal paint', mass: 420,
      desc: 'Short composite section on top of the LOX tank\'s forward skirt, in the black interstage finish. It carries the grid fins, cold-gas thrusters and the nose cone. Length (2 m) estimated.',
      explode: [0, 2.0, 0],
    }, [mesh(barrel(R, Y.s1Top, Y.adapterTop, { rings: 2 }), FM.blackTPS()), mesh(barrel(R - 0.03, Y.s1Top, Y.adapterTop), FM.compositeInner())]);
    fsec.userData.part.thermalRole = 'ambient';
    const nose = P('nose cone', {
      system: 'Skin & fairings', skin: true, material: 'Carbon-composite sandwich, white paint', mass: 520,
      desc: 'Aerodynamic composite nose that replaces the interstage on a side booster: it turns the booster into a clean body of revolution beside the centre core. Length estimated from photographs.',
      explode: [0, 4.2, 0],
    }, mesh(lathe(ogiveProfile(R, Y.noseTip - Y.adapterTop, Y.adapterTop, 26), 72), FM.whiteComposite()));
    nose.userData.part.thermalRole = 'fairing';
    finY = Y.adapterTop - 0.18;
  }

  // ------------------------------------------------------------------ grid fins (hinged, stowed)
  // A Block 5 fin: a thick cast frame round a fine diagonal lattice (cells ≈ 6 cm), 11 cm deep. Stowed
  // it lies almost flush on the interstage, hung from a hinge fitting at its top edge: a housing on
  // the skin with two lugs that straddle the frame, and the actuator shaft through them.
  const FIN = { w: 1.22, h: 1.52, depth: 0.11, frame: 0.07, gap: 0.03 };
  const finGeo = latticePanel(FIN.w, FIN.h, 0.065, 0.011, FIN.depth, FIN.frame);
  finGeo.translate(0, -FIN.h / 2 - 0.02, 0);
  const finR = R + FIN.gap + FIN.depth / 2;                // hinge line: the fin's mid-depth, just off the skin
  const finGroup = [];
  const finActs = [];
  for (const a of LEGS) {
    const hinge = new THREE.Group();
    const [x, z] = polar(finR, a);
    hinge.position.set(x, finY, z);
    hinge.rotation.y = radialYaw(a);
    const m = mesh(finGeo, FM.titanium());
    hinge.add(m);
    finGroup.push(hinge);
    out.fins.push(m);
    const dAz = (0.58 * 180) / (Math.PI * R);              // lugs just outside the frame's top corners
    finActs.push(unit(R + 0.1, a, finY + 0.17, 0.5, 0.2, 0.2));                             // actuator housing on the skin
    for (const s of [-1, 1]) finActs.push(unit(R + 0.09, a + s * dAz, finY + 0.01, 0.07, 0.2, 0.18));   // hinge lugs
    finActs.push(rod(at(finR, a - dAz * 1.1, finY), at(finR, a + dAz * 1.1, finY), 0.03, 8));            // hinge / actuator shaft
    finActs.push(rod(at(R - 0.25, a, finY + 0.17), at(R + 0.05, a, finY + 0.17), 0.05, 8));              // shaft into the stage
  }
  const gf = P('grid fins', {
    system: 'Recovery', count: 4, xrayWeight: 0.5, material: 'Single-piece cast and machined titanium', mass: 4 * 180,
    desc: 'Stowed flat for ascent, the four lattice fins swing out moments after separation and steer the falling stage through re-entry. Each Block 5 fin, about 1.2 × 1.5 m, is one titanium casting — Musk called it the largest single-piece titanium casting in the world — and needs no paint or heat shielding, unlike the aluminium fins it replaced in 2017.',
    callout: centre, anchor: at(R + 0.3, 45, finY + 0.15), explode: [0, 2.4, 0],
  }, finGroup);
  gf.userData.part.thermalRole = 'ambient';
  P('grid-fin actuators', {
    system: 'Hydraulics', count: 4, material: 'Closed-loop hydraulic actuators in aerodynamic housings', mass: 4 * 35,
    desc: 'Each fin hangs from a compact hinge fitting at its top edge — two lugs on a housing bolted to the skin — and rotates on a hydraulic actuator inside the housing. Block 5 uses a closed-loop hydraulic system; early Falcon 9 grid fins vented their hydraulic fluid overboard and could run out.',
    explode: [0, 2.7, 0],
  }, mesh(merge(finActs), FM.black()));
  // the unit sits 20° off the outboard side on a side booster (mirrored between A and B), clear of
  // the inboard face, the 90° / 270° thruster pods and the fin roots
  const hpuAz = !centre && attachSide > 0 ? 340 : 200, hpuY = finY - 0.95, ringY = finY - 0.35;
  // motor-pump in the middle, reservoir and accumulator either side, each on its own wall bracket
  const hR = 1.62, rsA = hpuAz + 10, acA = hpuAz - 10, wallIn = R - 0.03;   // inner face of the composite wall
  const hpu = [
    post(...polar(hR, hpuAz), hpuY - 0.2, hpuY + 0.2, 0.11, 14),                              // motor-pump
    bottle(...at(hR + 0.01, rsA, hpuY), 0.1, 0.42, 12),                                        // reservoir
    new THREE.SphereGeometry(0.11, 14, 10).translate(...at(hR, acA, hpuY + 0.05)),             // accumulator
    ...wallBracket(hR, hpuAz, hpuY, 0.2, 0.36, 0.22, wallIn), ...wallBracket(hR + 0.01, rsA, hpuY, 0.16, 0.3, 0.2, wallIn),
    ...wallBracket(hR, acA, hpuY + 0.05, 0.16, 0.16, 0.22, wallIn),
    hoop(1.68, 0.02, ringY, { seg: 72, tube: 4 }),                                             // pressure / return lines
    // pressure: pump outlet → (relief valve) → ring; the accumulator tees into it
    pipe([at(hR, hpuAz, hpuY + 0.19), at(1.64, hpuAz, hpuY + 0.4), at(1.67, hpuAz, ringY - 0.06), at(1.68, hpuAz, ringY)], 0.022, { seg: 6, tubular: 10 }),
    pipe([at(hR, acA, hpuY + 0.14), at(1.63, acA + 3, hpuY + 0.27), at(1.635, hpuAz - 1, hpuY + 0.31)], 0.018, { seg: 6, tubular: 8 }),
    // return: ring → reservoir top; suction: reservoir → pump inlet
    pipe([at(1.68, rsA, ringY), at(1.665, rsA, hpuY + 0.42), at(hR + 0.01, rsA, hpuY + 0.18)], 0.02, { seg: 6, tubular: 8 }),
    pipe([at(hR + 0.01, rsA, hpuY - 0.12), at(hR + 0.005, hpuAz + 5, hpuY - 0.14), at(hR, hpuAz, hpuY - 0.12)], 0.022, { seg: 6, tubular: 8 }),
  ];
  for (const a of LEGS) hpu.push(pipe([at(1.68, a, ringY), at(1.66, a, finY - 0.05), at(R - 0.25, a, finY + 0.17)], 0.022, { seg: 6, tubular: 8 }));
  // the relief valve sits on the pressure line and dumps back into the return line beside it
  const relief = [unit(1.645, hpuAz, hpuY + 0.42, 0.075, 0.09, 0.075), pipe([at(1.645, hpuAz, hpuY + 0.42), at(1.66, hpuAz + 5, hpuY + 0.44), at(1.665, rsA, hpuY + 0.42)], 0.012, { seg: 4, tubular: 6 })];
  P('grid-fin hydraulic power unit', {
    system: 'Hydraulics', material: 'Electric motor-pump, reservoir, accumulator, pressure relief valve and lines on wall brackets', mass: 55,
    desc: 'Block 5\'s closed-loop hydraulics: a motor-driven pump draws from a reservoir that takes the returned fluid, an accumulator on the pressure line covers peak demand, and lines run round the inside of the skin to the four fin actuators. After a pump stall cost a landing on CRS-16 (December 2018), a pressure relief valve (gold) was added on the pump\'s pressure line, venting back to the return. Unit layout estimated.',
    explode: [0, 2.6, 1.6],
  }, [mesh(merge(hpu), FM.steelLine()), mesh(merge(relief), FM.gold())]);

  // ------------------------------------------------------------------ landing legs (hinged A-frames)
  // Each leg hinges at the base of the engine section; a nested telescoping piston from a fitting
  // at the top of the skirt to a point near the foot is the A-frame's diagonal. setLegs(k) swings
  // the legs from stowed (0) to the landing stance (1) and extends the pistons with them.
  const legGeo = legGeometry(LEG.len);
  legGeo.translate(0, LEG.hingeY - 0.05, 0);         // starts at the hinge, so it swings clear of the skirt
  const footGeo = new THREE.CylinderGeometry(LEG.foot.r - 0.03, LEG.foot.r, 0.06, 20);
  const legPivots = [], legStatic = [], pistons = [], collets = [], feet = [];
  const thd = (LEG.deployDeg * Math.PI) / 180;
  const pistonParts = { tubes: [], crush: [], colletMeshes: [] };
  for (const a of LEGS) {
    const r = new THREE.Vector3(...at(1, a, 0));                 // radial unit vector
    const tng = new THREE.Vector3(-r.z, 0, r.x);                 // counter-clockwise tangent
    const H = new THREE.Vector3(r.x * LEG.hingeR, LEG.hingeY, r.z * LEG.hingeR);
    // shell in the core frame: leg frame x → tangent, z → radial, then moved so its inner face sits on the skin
    const g = legGeo.clone();
    g.rotateY(radialYaw(a));
    g.translate(r.x * (R + 0.01), 0, r.z * (R + 0.01));
    const hm = hingedMesh(g, FM.legBlack(), H, H.clone().sub(tng));        // positive angle swings the tip outward
    // foot pad: folded into the leg's tip for ascent (its face along the leg), swung to lie flat on
    // the ground in the landing stance
    const footAt = ([back, outL]) => new THREE.Vector3(r.x * (LEG.hingeR + outL), LEG.hingeY + LEG.len - back, r.z * (LEG.hingeR + outL)).sub(H);
    const axis = H.clone().sub(tng).sub(H).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(axis, -thd);     // world up seen from the stowed leg
    const foot = new THREE.Group();
    const pStowed = footAt(LEG.foot.stowed), pLanded = footAt(LEG.foot.landed);
    foot.position.copy(pStowed);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const qStowed = new THREE.Quaternion().setFromUnitVectors(yAxis, r);  // face radial: flush in the tip
    const qLanded = new THREE.Quaternion().setFromUnitVectors(yAxis, up);
    foot.quaternion.copy(qStowed);
    foot.add(mesh(footGeo, FM.black()));
    hm.pivot.add(foot);
    feet.push({ foot, qStowed, qLanded, pStowed, pLanded });
    legPivots.push(hm);
    legStatic.push(unit(LEG.hingeR, a, LEG.hingeY, 0.7, 0.3, 0.3));                     // hinge fitting on the skirt
    // piston: three nested sections in a frame at its stage fitting B, +y toward the leg fitting
    const B = new THREE.Vector3(...pistonB(a));
    const L0 = H.clone().addScaledVector(new THREE.Vector3(0, 1, 0), LEG.pistonL[0]).addScaledVector(r, LEG.pistonL[1]);
    const grp = new THREE.Group();
    grp.position.copy(B);
    const [t1, t2, t3] = LEG.tube;
    const tube = (rad, len, mat) => { const gg = new THREE.CylinderGeometry(rad, rad, len, 14); return mesh(gg, mat); };
    const m1 = tube(0.075, t1, FM.steelLine()); m1.position.y = t1 / 2;
    const m2 = tube(0.06, t2, FM.alu());
    const m3 = tube(0.045, t3, FM.steelLine());
    const eye = mesh(new THREE.SphereGeometry(0.07, 12, 8), FM.aluDark());
    const crush = mesh(new THREE.CylinderGeometry(0.062, 0.062, 1.0, 14).translate(0, 0.75, 0), FM.crushCore());
    crush.userData.xrayWeight = 1;
    grp.add(m1, m2, m3, eye, crush);
    pistonParts.tubes.push(grp);
    const cgrp = new THREE.Group();
    cgrp.position.copy(B);
    const col = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 16), FM.gold());
    cgrp.add(col);
    pistonParts.colletMeshes.push(cgrp);
    pistons.push({ B, L0, H, axis: hm.axis, grp, m2, m3, eye, cgrp, col });
    legStatic.push(unit(LEG.pistonB[0] - 0.02, a, LEG.pistonB[1], 0.24, 0.22, 0.12));   // piston clevis on the skirt
  }
  const legs = P('landing legs', {
    system: 'Recovery', count: 4, xrayWeight: 0.5, material: 'Carbon fibre over aluminium honeycomb under Block 5 black thermal protection; hinge fittings; foot pads', mass: 4 * 500,
    desc: 'Four A-frame legs, carbon fibre with aluminium honeycomb, together under 2,100 kg. They lie folded against the stage for ascent and swing down on helium-driven pistons in the last seconds of the landing burn to a stance about 18 m (60 ft) across, the span SpaceX gives; Block 5 added a black thermal-protection layer and legs that can be stowed again after landing. Stowed, each leg tapers to a narrow rounded tip lying flat on the tank with its foot pad folded inside; the telescoping piston runs hidden behind it. Leg length (≈ 8.0 m here) and the deployed angle (25° below horizontal) are estimates chosen to give that span.',
    callout: !centre && attachSide > 0, anchor: [polar(R + 0.35, 45)[0], 8.0, polar(R + 0.35, 45)[1]], explode: [0, -1.6, 0],
  }, [...legPivots.map((h) => h.pivot), mesh(merge(legStatic), FM.black())]);
  legs.userData.part.thermalRole = 'ambient';
  P('leg telescoping pistons', {
    system: 'Recovery', count: 4, xrayWeight: 0.5, material: 'Nested telescoping pneumatic pistons; aluminium-honeycomb crush core in the outer cylinder', mass: 4 * 45,
    desc: 'SpaceX describes the leg as a nested, telescoping piston on an A-frame: high-pressure helium extends the three nested sections, swinging the leg out, and the piston then becomes the strut the stage lands on. A crush core of aluminium honeycomb inside (shown in X-ray) absorbs a hard landing — on one 2016 landing it crushed and left the stage leaning. Attach points and the crush core\'s position estimated from photographs.',
    explode: [0, -1.6, 1.0],
  }, pistonParts.tubes);
  P('leg lock-out collets', {
    system: 'Recovery', count: 4, material: 'Collet locks at the piston joints', mass: 4 * 3,
    desc: 'Lock each piston at full extension so the leg cannot fold under the landing load. On Jason-3 (17 January 2016) the stage touched down softly on the drone ship, but one collet failed to latch, the leg folded and the stage tipped over and exploded.',
    explode: [0, -1.2, 1.4],
  }, pistonParts.colletMeshes);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), L = new THREE.Vector3();
  out.legK = 0;
  /** Swing the legs: 0 stowed, 1 landing stance. */
  out.setLegs = (kk) => {
    out.legK = kk;
    const th = thd * smooth(kk);
    for (let i = 0; i < legPivots.length; i++) {
      legPivots[i].setAngle(th);
      const fk = smooth(Math.max(0, (kk - 0.45) / 0.55)), ft = feet[i];
      ft.foot.quaternion.slerpQuaternions(ft.qStowed, ft.qLanded, fk);
      ft.foot.position.lerpVectors(ft.pStowed, ft.pLanded, fk);
      const p = pistons[i];
      L.copy(p.L0).sub(p.H).applyAxisAngle(p.axis, th).add(p.H);
      dir.subVectors(L, p.B);
      const len = dir.length();
      dir.divideScalar(len);
      p.grp.quaternion.setFromUnitVectors(up, dir);
      p.cgrp.quaternion.copy(p.grp.quaternion);
      p.m3.position.y = len - LEG.tube[2] / 2;
      p.m2.position.y = len / 2;
      p.eye.position.y = len;
      p.col.position.y = len / 2 + LEG.tube[1] / 2 - 0.1;
    }
  };
  out.setLegs(0);

  // ------------------------------------------------------------------ attitude control
  const cgY = centre ? 46.6 : Y.s1Top + 1.0;
  const cg = [], n2 = [], n2l = [], n2r = [];
  const n2Y = 42.05;                     // below the battery packs in the forward skirt
  for (const a of [90, 270]) {
    cg.push(unit(R + 0.12, a, cgY, 0.5, 0.62, 0.26));
    for (const dy of [-0.18, 0.18]) for (const dt of [-0.14, 0.14]) {
      const [nx, nz] = polar(R + 0.27, a + (dt * 180) / (Math.PI * R));
      cg.push(post(nx, nz, cgY + dy - 0.05, cgY + dy + 0.05, 0.035, 8));
    }
    n2.push(new THREE.SphereGeometry(0.33, 18, 12).translate(...at(1.2, a + 10, n2Y)));
    n2l.push(pipe([at(1.2, a + 10, n2Y + 0.3), at(1.62, a + 6, n2Y + 0.7), at(1.74, a + 4, Y.s1Top + 0.2), at(1.75, a + 2, cgY - 0.6), at(R - 0.04, a, cgY)], 0.022, { seg: 6, tubular: 20 }));
    n2r.push(post(...polar(1.2, a + 10), n2Y + 0.3, n2Y + 0.42, 0.05, 10));          // pressure regulator on the tank outlet
  }
  P('cold-gas thrusters', {
    system: 'Attitude control', count: 2, material: 'Nitrogen thruster pods (four nozzles each)', mass: 2 * 40,
    desc: `Pods of nitrogen cold-gas thrusters flip the stage after separation and hold its attitude outside the atmosphere, where the grid fins have no air to work with. ${centre ? 'They sit high on the interstage beside the grid fins, as far from the centre of mass as possible for the most leverage (height estimated from webcast imagery).' : 'Height estimated from photographs.'}`,
    explode: [0, 2.0, 1.2],
  }, mesh(merge(cg), FM.black()));
  P('nitrogen tanks', {
    system: 'Attitude control', count: 2, material: 'Composite-overwrapped N₂ tanks and feed lines', mass: 2 * 40,
    desc: 'High-pressure nitrogen for the thrusters, in the LOX tank\'s forward skirt; a regulator (gold) on each tank outlet drops it to thruster pressure before the line runs up to its pod. Placement estimated.',
    explode: [0, 2.6, 2.0],
  }, [mesh(merge(n2), FM.copv()), mesh(merge(n2l), FM.steelLine()), mesh(merge(n2r), FM.gold())]);

  // ------------------------------------------------------------------ avionics, power, wiring, antennas
  const fwdY = Y.fwdAvionics;
  const rw = [];
  // midway between the 45° and 135° legs (clear of the stowed legs' roots); its foot stops above the
  // pad hold-down clamps. Azimuth estimated.
  const rwA = 90, rwBottom = Y.heatShield + 0.95;
  rw.push(unit(R + 0.07, rwA, (rwBottom + Y.s1Top) / 2, 0.26, Y.s1Top - rwBottom, 0.14));
  for (let y = 2.5; y < Y.s1Top; y += 2.4) rw.push(unit(R + 0.04, rwA, y, 0.36, 0.08, 0.1));
  P('raceway', {
    system: 'Electrical', material: 'Composite cable tray cover under Block 5 black thermal protection', mass: 140,
    desc: 'External tunnel that carries power, data and flight-safety cables up the outside of the tanks between the engine bay and the forward avionics, so no wiring has to pass through the propellant. Block 5 gave it, like the legs, a black thermal-protection layer. Shown midway between two landing legs; its exact azimuth on each core is estimated.',
    callout: !centre && attachSide > 0, anchor: at(R + 0.16, rwA, 30.0), explode: [0, 0, 1.6],
  }, mesh(merge(rw), FM.racewayBlack()));
  // engine-bay harness ring radius at azimuth a: inboard of the corner posts, and of the fill & drain
  // lines coming down beside the T-0 plate
  const harnessR = (a) => {
    const d = Math.abs(((a + 22.5) % 45) - 22.5), dT = Math.abs(((a - t0Az + 540) % 360) - 180);
    return 1.55 + 0.11 * smooth(d / 15) * smooth(dT / 24);
  };
  const wh = [
    hoop(1.6, 0.025, fwdY - 0.22, { seg: 64, tube: 4 }),
    // engine-bay ring: it ducks inboard of the eight Octaweb corner posts
    pipe(Array.from({ length: 64 }, (_, i) => at(harnessR(i * 5.625), i * 5.625, 2.9)), 0.025, { seg: 4, tubular: 128, closed: true }),
    pipe([at(R + 0.06, rwA, Y.s1Top - 0.25), at(R - 0.05, rwA, Y.s1Top - 0.4), at(1.62, rwA, fwdY - 0.1), at(1.6, rwA - 4, fwdY - 0.22)], 0.03, { seg: 6, tubular: 10 }),
    pipe([at(R + 0.06, rwA, rwBottom + 0.1), at(R - 0.02, rwA + 4, 2.6), at(1.7, rwA + 8, 2.75), at(1.66, rwA + 12, 2.9)], 0.03, { seg: 6, tubular: 10 }),   // round the Octaweb corner post
  ];
  for (const a of OUTER) wh.push(pipe([at(harnessR(a + 8), a + 8, 2.9), at(1.64, a + 8, 1.9)], 0.015, { seg: 4, tubular: 4 }));
  // the centre engine's controller: in over the LOX manifold beside the TEA-TEB relight line, then
  // down past the Octaweb hub to the box hanging under it
  wh.push(pipe([at(1.66, 104, 2.9), at(1.4, 103, 2.72), at(0.95, 108, 2.44), at(0.6, 135, 2.44), at(0.52, 157, 2.32), at(0.55, 170, 2.1), at(0.6, 177, 1.86), at(HUB.r - 0.1, 180, 1.8)], 0.015, { seg: 4, tubular: 24 }));
  for (const a of [15, 75, 135, 195, 255, 315]) wh.push(pipe([at(1.6, a, fwdY - 0.22), at(1.52, a, fwdY - 0.12)], 0.015, { seg: 4, tubular: 4 }));
  for (const a of [45, 225]) wh.push(pipe([at(1.6, a, fwdY - 0.22), at(1.52, a, fwdY - 0.07)], 0.015, { seg: 4, tubular: 4 }));          // S-band transmitters
  for (const a of [45, 165, 285]) wh.push(pipe([at(1.6, a + 5, fwdY - 0.22), at(1.64, a + 5, fwdY + 0.05), at(1.53, a + 4, fwdY + 0.29)], 0.015, { seg: 4, tubular: 8 }));   // battery packs
  P('wiring harnesses', {
    system: 'Electrical', material: 'Shielded cable bundles', mass: 180,
    desc: 'Cable bundles leave the raceway through the skin at both ends: a ring in the forward skirt ties the computers, navigation, flight-safety, S-band transmitters and battery packs together, and a ring in the engine bay drops a harness to each engine controller — the centre engine\'s runs in over the LOX manifold. Routing simplified.',
    explode: [0, 0, 2.0],
  }, mesh(merge(wh), FM.cable()));
  P('flight computers', {
    system: 'Avionics', count: 3, material: 'Triple-redundant flight computers', mass: 3 * 12,
    desc: 'Three computers fly the stage and vote on every decision, so one can fail without consequence (the Falcon avionics are three-string, fault-tolerant and designed to human-rating requirements). On a side booster they also guide the boost-back, entry and landing on their own.',
    explode: [0, 2.0, 3.0],
  }, mesh(merge([15, 135, 255].map((a) => unit(1.45, a, fwdY, 0.42, 0.28, 0.32))), FM.avionics()));
  P('IMU & GPS navigation unit', {
    system: 'Avionics', material: 'Inertial measurement unit with GPS receiver', mass: 15,
    desc: 'Gyroscopes and accelerometers measure the stage\'s rotation and acceleration hundreds of times a second; GPS fixes correct the drift — accurate enough to land on a drone ship.',
    explode: [0, 2.6, 3.0],
  }, mesh(merge([unit(1.45, 75, fwdY, 0.34, 0.26, 0.3), post(...polar(1.45, 75), fwdY + 0.13, fwdY + 0.2, 0.08, 12)]), FM.avionics()));
  P('autonomous flight-safety system', {
    system: 'Avionics', count: 2, material: 'Two independent flight-safety computers with their own batteries', mass: 2 * 10,
    desc: 'Falcon flies an autonomous flight-safety system: onboard computers compare the trajectory with pre-approved corridors and would end the flight themselves, with no ground command needed. Two independent strings are shown.',
    explode: [0, 3.2, 3.0],
  }, mesh(merge([195, 315].map((a) => unit(1.45, a, fwdY, 0.36, 0.26, 0.28))), FM.safety()));
  P('batteries & power distribution', {
    system: 'Power', count: 3, material: 'Lithium-ion battery packs and a power distribution unit', mass: 60,
    desc: 'Batteries power the stage from the switch to internal power a few minutes before launch until landing; the distribution unit switches power to every consumer through the harnesses. Pack count estimated.',
    explode: [0, 3.8, 3.0],
  }, mesh(merge([45, 165, 285].map((a) => unit(1.47, a, fwdY + 0.4, 0.36, 0.24, 0.26))), FM.battery()));
  P('S-band transmitters', {
    system: 'Communications', count: 2, material: 'S-band telemetry and video transmitters', mass: 2 * 4,
    desc: 'Send the stage\'s telemetry and its camera views to the ground — the booster views in every launch webcast — and keep doing so after separation, all the way to landing. Positions estimated.',
    explode: [0, 4.4, 3.0],
  }, mesh(merge([45, 225].map((a) => unit(1.5, a, fwdY, 0.25, 0.15, 0.15))), FM.avionics()));
  // every forward-skirt box stands off the wall on a bracket: [r, azimuths, y, w, h, d] as built above
  const avBoxes = [[1.45, [15, 135, 255], fwdY, 0.42, 0.28, 0.32], [1.45, [75], fwdY, 0.34, 0.26, 0.3], [1.45, [195, 315], fwdY, 0.36, 0.26, 0.28],
    [1.47, [45, 165, 285], fwdY + 0.4, 0.36, 0.24, 0.26], [1.5, [45, 225], fwdY, 0.25, 0.15, 0.15]];
  const avBr = [];
  for (const [r, azs, y, w, h, d] of avBoxes) for (const a of azs) avBr.push(...wallBracket(r, a, y, w, h, d, R - 0.015));
  P('forward-skirt avionics brackets', {
    system: 'Structure', count: 13, xrayWeight: 0.6, material: 'Machined aluminium brackets and wall doublers', mass: 13 * 1.5,
    desc: 'Each avionics, power and telemetry box in the forward skirt is bolted to a bracket that stands it off the skirt wall, clear of the forward dome, with the harness ring below. Bracket design not published; layout estimated.',
    explode: [0, 3.4, 2.4],
  }, mesh(merge(avBr), FM.aluDark()));
  const antY = centre ? 44.5 : Y.s1Top + 1.2;
  const antAz = centre ? [30, 210] : [73, 253];
  P('S-band telemetry antennas', {
    system: 'Communications', count: 2, material: 'Flush S-band patch antennas', mass: 2 * 1.5,
    desc: 'Flush patches on opposite sides radiate the transmitters\' telemetry and video, so one is always in view of a ground station whichever way the stage rolls. Positions estimated.',
    explode: [0, 1.0, 1.8],
  }, mesh(merge(antAz.map((a) => unit(R + 0.02, a, antY, 0.16, 0.24, 0.04))), FM.raceway()));
  P('GPS antennas', {
    system: 'Communications', count: 2, material: 'GPS patch antennas', mass: 2 * 1,
    desc: 'Pick up GPS signals for the navigation unit; the stage must know where it is to the metre to steer onto a landing pad or drone ship. Positions estimated.',
    explode: [0, 1.4, 1.8],
  }, mesh(merge(antAz.map((a) => unit(R + 0.02, a, antY + 0.4, 0.12, 0.12, 0.03))), FM.raceway()));
  // two cameras on the skin at the same azimuth (positions estimated from webcast views)
  const camAz = 100;
  const camera = (y) => {
    const [lx, lz] = polar(R + 0.09, camAz);
    return [mesh(unit(R + 0.06, camAz, y, 0.12, 0.1, 0.1), FM.black()), mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10).translate(lx, y - 0.07, lz), FM.lens())];
  };
  P('forward camera', {
    system: 'Sensors', material: 'Ruggedised video camera in a small housing', mass: 1.5,
    desc: 'Looks down the side of the stage from its forward end: the view of the stage falling away, the grid fins deploying and the boost-back plume in launch webcasts, sent down by the S-band transmitters. Position estimated from webcast views.',
    explode: [0, 1.8, 2.2],
  }, camera(Y.s1Top + 0.45));
  P('engine-section camera', {
    system: 'Sensors', material: 'Ruggedised video camera in a small housing', mass: 1.5,
    desc: 'At the top of the engine section, looking aft at the landing legs and the plume: the view of the legs swinging down and of the landing burn in webcasts. Position estimated from webcast views.',
    explode: [0, -1.2, 2.2],
  }, camera(Y.engSectionTop - 0.18));

  // ------------------------------------------------------------------ booster attach hardware
  // forward: the top of the centre core's LOX tank (its forward skirt) to each side booster;
  // aft: between the engine sections at the base engine mount (Falcon User's Guide)
  const fwdAttachY = 41.8, aftAttachY = 2.75;
  if (centre) {
    const gap0 = R, gap1 = 4.27 - R;                       // centre-core skin → side-booster skin
    const sepFwd = [], sepAft = [];
    for (const s of [1, -1]) {
      const label = s > 0 ? 'A' : 'B';
      const f = [], a = [];
      for (const dz of [-0.42, 0.42]) {
        for (const [list, y, h] of [[f, fwdAttachY, 0.9], [a, aftAttachY, 0.8]]) {
          list.push(block(s * (gap0 + 0.12), y, dz, 0.3, h, 0.42));                         // fitting and pusher housing
          list.push(rod([s * (gap0 + 0.2), y, dz], [s * (gap1 - 0.1), y, dz], 0.085, 12));   // pusher / strut
        }
      }
      f.push(beam([s * (gap0 + 0.05), fwdAttachY + 0.5, -0.42], [s * (gap0 + 0.05), fwdAttachY + 0.5, 0.42], 0.12, 0.2));
      a.push(beam([s * (gap0 + 0.05), 2.3, -0.42], [s * (gap0 + 0.05), 2.3, 0.42], 0.12, 0.2));
      P(`forward attach & pushers (${label})`, {
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher separation mechanisms', mass: 260,
        desc: `Two pneumatic pusher separation mechanisms fasten the top of the centre core's LOX tank to side booster ${label} (Falcon User's Guide). They hold through ascent, then release and actively push the booster away after its engines shut down. Pneumatic devices give a low-shock push over a long stroke. Height on the forward skirt estimated.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(f), FM.aluDark()));
      P(`aft attach & pushers (${label})`, {
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher mechanisms', mass: 240,
        desc: `Two identical pusher mechanisms join the base engine mounts; at separation they force the base of side booster ${label} sideways so it clears the centre core. Layout simplified.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(a), FM.aluDark()));
      // helium supply for this side's pushers: a bottle by each pair, lines through the skin
      const fa = s > 0 ? 350 : 170, aa = s > 0 ? 10 : 190;
      sepFwd.push(bottle(...at(1.45, fa, 41.75), 0.15, 0.6, 14));
      sepAft.push(new THREE.SphereGeometry(0.12, 14, 10).translate(...at(1.42, aa, 2.7)));
      for (const dz of [-0.42, 0.42]) {
        sepFwd.push(pipe([at(1.45, fa, 41.95), [s * 1.62, 41.95, dz * 0.8], [s * (gap0 - 0.02), fwdAttachY + 0.1, dz]], 0.012, { seg: 4, tubular: 8 }));
        sepAft.push(pipe([at(1.42, aa, 2.75), [s * 1.6, 2.76, dz * 0.7], [s * (gap0 - 0.02), aftAttachY + 0.05, dz]], 0.012, { seg: 4, tubular: 8 }));
      }
    }
    P('forward booster-separation helium bottles', {
      system: 'Separation', count: 2, material: 'Composite-overwrapped helium bottles and stainless lines in the LOX tank\'s forward skirt', mass: 20,
      desc: 'A bottle beside each forward pusher pair holds the helium that releases the fittings and drives the push, with short lines through the skin into the pusher housings — the same all-pneumatic principle as the stage and fairing separation. The supply is not described publicly; bottle size and position are estimates.',
      explode: [0, 1.0, 3.4],
    }, mesh(merge(sepFwd), FM.copv()));
    P('aft booster-separation helium bottles', {
      system: 'Separation', count: 2, material: 'Helium bottles and stainless lines in the engine bay', mass: 10,
      desc: 'Feed the aft pusher pairs at the base engine mounts, which shove the side boosters\' engine sections sideways so the bases clear the centre core. Bottle size and position are estimates.',
      explode: [0, -1.0, 3.4],
    }, mesh(merge(sepAft), FM.copv()));
  } else {
    // the booster halves of the attach fittings: they leave with the booster at separation
    const xin = -attachSide;                                 // inboard direction in this booster's frame
    for (const [name, y, h] of [['forward attach fitting', fwdAttachY, 0.6], ['aft attach fitting', aftAttachY, 0.55]]) {
      const g = [];
      for (const dz of [-0.42, 0.42]) g.push(block(xin * (R + 0.06), y, dz, 0.16, h, 0.36), block(xin * (R - 0.08), y, dz, 0.14, h + 0.2, 0.3));
      g.push(beam([xin * (R - 0.12), y + h / 2 + 0.05, -0.42], [xin * (R - 0.12), y + h / 2 + 0.05, 0.42], 0.1, 0.14));
      P(name, {
        system: 'Separation', count: 2, material: 'Titanium receiving fittings bolted to an internal ring frame', mass: 90,
        desc: `The side booster's half of the ${name.split(' ')[0]} attachment${name.startsWith('forward') ? ', at the top of its LOX tank' : ', at the engine section'}: the receptacles the centre core's struts and pushers bear on. They release and leave with the booster at separation. Layout simplified.`,
        explode: [xin * 1.0, 0, 0.8],
      }, mesh(merge(g), FM.aluDark()));
    }
  }
  return out;
}
