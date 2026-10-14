// Falcon Heavy second stage (a standard Falcon 9 upper stage with one Merlin Vacuum and the
// mission-extension kit most Falcon Heavy flights carry), the 13.2 m × 5.2 m composite payload
// fairing and a representative payload on its adapter.
//
// Aft-skirt layout (estimated): the aft dome's crown clears the separation plane; the MVac
// powerhead hangs from a thrust cone below it, with the nitrogen bottles, batteries, TEA-TEB
// tank, mission-extension-kit bottles and the MVac controller under the cone. The T-0 quick
// disconnect faces the transporter-erector (−z); the raceway beside it carries the stage and
// payload harnesses to the forward skirt and through the payload attach fitting.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, rod, beam, ogiveProfile } from '../../engine/geometry.js';
import { SKIN, M } from '../../engine/materials.js';
import { R, Y, polar } from './dims.js';
import { merge, barrel, dome, domeY, pipe, hoop, post, block, bottle, radialYaw } from './util.js';
import { MVAC, mvacChamber, mvacRegen, mvacExtension, mvacKit, placeAll, thrustCone } from './merlin.js';
import { FM, stagePaint, tankMaterial } from './materials.js';

const D = Y.s2DomeDepth;
const at = (r, a, y) => { const [x, z] = polar(r, a); return [x, y, z]; };
const unit = (r, a, y, w, h, d) => { const [x, z] = polar(r, a); return block(x, y, z, w, h, d, radialYaw(a)); };
/** Capsule bottle lying tangentially at radius r, azimuth a, height y. */
const sideBottle = (r, a, y, rad, len) => {
  const g = new THREE.CapsuleGeometry(rad, Math.max(0.001, len - 2 * rad), 6, 14);
  g.rotateZ(Math.PI / 2);
  g.rotateY(radialYaw(a));
  g.translate(...at(r, a, y));
  return g;
};
const arc = (r, y, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => at(r, a0 + ((a1 - a0) * i) / n, y));

/** Fairing outer profile [r, y]: boat-tail flare, 5.2 m cylinder, tangent ogive with a rounded tip. */
export function fairingProfile(inset = 0) {
  const r0 = 2.6 - inset;
  const base = [[R + 0.03 - inset, Y.fairingBase], [R + 0.03 - inset, Y.fairingBase + 0.25], [r0, Y.fairingBase + 1.35], [r0, 64.6]];
  const og = ogiveProfile(r0, 5.6, 64.6, 24).slice(1).filter(([r]) => r > 0.5);
  const [rt, yt] = og[og.length - 1];
  // elliptical nose cap closing the ogive at the 70.0 m tip
  const cap = [];
  for (let i = 1; i <= 7; i++) {
    const a = (i / 7) * (Math.PI / 2);
    cap.push([Math.max(0.002, rt * Math.cos(a)), yt + Math.sin(a) * (Y.fairingTop - inset - yt)]);
  }
  return base.concat(og, cap);
}
const FAIR = fairingProfile(0);
/** Fairing outer radius at height y. */
function fairR(y) {
  for (let i = 1; i < FAIR.length; i++) {
    const [r0, y0] = FAIR[i - 1], [r1, y1] = FAIR[i];
    if (y >= y0 && y <= y1 && y1 > y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}
/** A box against the fairing's inner wall at azimuth a, its outer face following the wall's slope. */
function wallBox(a, y, w, h, d, gap = 0.04) {
  const s = (fairR(y + 0.05) - fairR(y - 0.05)) / 0.1;           // dr/dy
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(Math.atan(s));
  g.rotateY(radialYaw(a));
  g.translate(...at(fairR(y) - gap - d / 2, a, y));
  return g;
}

export function buildUpper(A, parent, { explodeBase = [0, 0, 0] } = {}) {
  // each fairing half hangs from a pivot on its base hinge line so it can swing open
  const half = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (R + 0.03), Y.fairingBase, 0);
    const inner = new THREE.Group();
    inner.position.set(-side * (R + 0.03), -Y.fairingBase, 0);
    pivot.add(inner);
    parent.add(pivot);
    return { pivot, inner };
  };
  const hA = half(1), hB = half(-1);
  const fairA = hA.inner, fairB = hB.inner;
  const P = (name, info, objs, grp = parent) => {
    const e = info.explode || [0, 0, 0];
    return A.part(name, { ...info, explode: [e[0] + explodeBase[0], e[1] + explodeBase[1], e[2] + explodeBase[2]] }, objs, grp);
  };
  const out = { fairA: hA.pivot, fairB: hB.pivot };
  const aftDomeY = (r) => domeY(R, Y.s2AftSkirt, D, -1, r);

  // ------------------------------------------------------------------ tanks and skirts
  const span = [Y.interTop, Y.s2Top];
  const vOf = (y) => (y - span[0]) / (span[1] - span[0]);
  const paintMap = stagePaint('S2', { seams: [Y.s2AftSkirt, 50.2, Y.s2CommonDome, 53.6, 55.2, Y.s2LoxTop].map(vOf), soot: 0, streaks: 0, seed: 11 });
  const skin = tankMaterial(paintMap, span[1] - span[0]);
  const tb = (y0, y1) => barrel(R, y0, y1, { v0y: span[0], v1y: span[1], rings: 3 });
  const lox = P('Second stage LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195 monocoque', mass: 1150,
    desc: 'Upper tank of the second stage, ≈ 75 t of densified LOX; its forward skirt carries the avionics, the payload attach fitting and the fairing. The second stage is a shorter copy of the first, built on the same tooling.',
    callout: true, anchor: [R + 0.02, 54.5, 0.3], explode: [0, 1.0, -4.5],
  }, [mesh(tb(Y.s2CommonDome, Y.s2Top), skin), mesh(merge([53.6, 55.2, Y.s2LoxTop, Y.s2Top - 0.05].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  lox.userData.part.thermalRole = 'lox';
  const rp = P('Second stage RP-1 tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195 skin and stringers', mass: 640,
    desc: 'Lower tank, ≈ 32 t of RP-1. Second-stage propellant totals ≈ 107.5 t (111.5 t fuelled stage), burned by one Merlin Vacuum for up to ≈ 6½ minutes in one or more burns.',
    explode: [0, -0.6, -4.5],
  }, [mesh(tb(Y.s2AftSkirt, Y.s2CommonDome), skin), mesh(merge([Y.s2AftSkirt, 50.2].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  rp.userData.part.thermalRole = 'rp1';
  P('Second stage aft skirt', {
    system: 'Structure', skin: true, material: 'Aluminium-lithium skirt with an aft ring for the separation latches', mass: 90,
    desc: 'Short skirt below the RP-1 tank\'s aft dome. Its aft ring is what the three stage-separation latches grip (the Falcon User\'s Guide puts them at the base of the second-stage fuel tank); inside it the thrust cone, the Merlin Vacuum powerhead, nitrogen tanks, batteries and the TEA-TEB tank sit under the dome. Length estimated.',
    explode: [0, -1.0, -4.5],
  }, [mesh(tb(Y.interTop, Y.s2AftSkirt), skin), mesh(hoop(R - 0.035, 0.035, Y.interTop + 0.05, { seg: 72, tube: 4 }), FM.aluDark())]);
  const mek = P('Second stage mission-extension kit band', {
    system: 'Thermal control', skin: true, material: 'Grey thermal paint band', mass: 10,
    desc: 'Most Falcon Heavy flights carry a medium or long mission-extension kit for coasts of hours between burns. The grey band over the RP-1 tank absorbs sunlight so the kerosene does not get too cold.',
    explode: [0, -0.6, -4.5],
  }, mesh(barrel(R + 0.006, Y.s2AftSkirt + 0.15, Y.s2CommonDome - 0.15, { rings: 2 }), FM.mekGrey()));
  mek.userData.part.thermalRole = 'rp1';
  const cd = P('Second stage common dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead', mass: 160,
    desc: 'Shared bulkhead between the second-stage LOX and RP-1 tanks, the same layout as the first stage.',
    explode: [0, 0.2, 0],
  }, mesh(dome(R - 0.01, Y.s2CommonDome, D, -1), FM.domeAlu()));
  cd.userData.part.thermalRole = 'lox';
  const fwd = P('Second stage forward dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead', mass: 130,
    desc: 'Caps the LOX tank under the payload adapter; the LOX vent valve sits at its crown.',
    explode: [0, 0.8, 0],
  }, [mesh(dome(R - 0.01, Y.s2LoxTop, D, 1), FM.domeAlu()), mesh(post(0, 0, Y.s2LoxTop + D - 0.04, Y.s2LoxTop + D + 0.08, 0.09, 12), FM.steelLine())]);
  fwd.userData.part.thermalRole = 'lox';
  const aft = P('Second stage aft dome', {
    system: 'Fuel', xrayWeight: 0.4, material: 'Aluminium bulkhead with LOX and RP-1 outlets', mass: 130,
    desc: 'Closes the bottom of the RP-1 tank. Its crown sits just above the Merlin Vacuum powerhead, so both propellant inlets reach up to it.',
    explode: [0, -0.2, 0],
  }, mesh(dome(R - 0.01, Y.s2AftSkirt, D, -1), FM.domeAlu()));
  aft.userData.part.thermalRole = 'rp1';
  const cg = [], cs = [];
  for (const a of [90, 210, 330]) {
    const [x, z] = polar(1.0, a);
    cg.push(bottle(x, 54.3, z, 0.28, 1.4, 18));
    const [wx, wz] = polar(R - 0.02, a);
    cs.push(rod([x, 54.8, z], [wx, 55.2, wz], 0.025, 6), rod([x, 53.8, z], [wx, 53.4, wz], 0.025, 6));
  }
  const copv = P('Second stage helium COPVs', {
    system: 'Fuel', count: 3, material: 'Carbon-overwrapped pressure vessels on struts', mass: 3 * 55,
    desc: 'Three helium bottles submerged in the second-stage LOX tank. A strut holding one of them failed on CRS-7 in 2015, and on AMOS-6 in 2016 oxygen trapped between a COPV\'s liner and its carbon overwrap ignited during fuelling. Both led to redesigned bottles and loading procedures.',
    explode: [0, 1.2, 2.2],
  }, [mesh(merge(cg), FM.copv()), mesh(merge(cs), FM.steelLine())]);
  copv.userData.part.thermalRole = 'lox';
  const qdAz = 270, qdY = 49.9;                     // T-0 quick disconnect, facing the transporter-erector
  const m2 = [hoop(1.0, 0.014, 53.48, { seg: 48, tube: 4 })];
  for (const a of [90, 210, 330]) m2.push(post(...polar(1.0, a), 53.48, 53.62, 0.018, 6));
  m2.push(pipe([at(R - 0.05, qdAz + 3, 52.62), at(1.6, qdAz + 2, 52.9), at(1.3, qdAz + 1, 53.3), at(1.0, qdAz, 53.48)], 0.012, { seg: 4, tubular: 12 }));
  P('Second stage COPV manifold & fill line', {
    system: 'Fuel', material: 'Stainless manifold ring and fill line', mass: 6,
    desc: 'Joins the three bottles into one pressurisation system and brings in the ground helium fill from the T-0 quick disconnect. Routing estimated.',
    explode: [0, 1.0, 3.0],
  }, mesh(merge(m2), FM.steelLine()));

  // ------------------------------------------------------------------ feed system
  const ex = Y.mvacExit;
  const dy = MVAC.throatY - 1.18;                        // MVac kit is the Merlin 1D kit raised by this
  const dTop = domeY(R, Y.s2CommonDome, D, -1, 0), dBot = aftDomeY(0);
  const loxIn = [-0.36, ex + 2.5 + dy, 0], rpIn = [-0.61, ex + 2.45 + dy, 0];
  const tubeIn = [post(0.0, 0, dBot - 0.02, dTop + 0.05, 0.16, 16), lathe([[0.16, dTop - 0.04], [0.34, dTop + 0.1], [0.38, dTop + 0.16]], 20)];
  const tubeOut = [post(0, 0, dBot + 0.06, dTop - 0.06, 0.19, 20)];
  const tubeSp = [];
  for (let y = dBot + 0.6; y < dTop - 0.3; y += 1.2) tubeSp.push(hoop(0.175, 0.01, y, { seg: 16, tube: 4 }));
  const tt2 = P('Second stage double-wall LOX transfer tube', {
    system: 'Fuel', material: 'Aluminium inner line, outer wall, spacer rings', mass: 45,
    desc: 'As on the first stage, LOX runs down through the middle of the RP-1 tank inside a double-walled transfer tube, the gap insulating the 66 K oxygen from the kerosene around it. Wall gap estimated.',
    explode: [0, 0, 2.4],
  }, [mesh(merge(tubeIn), FM.steelLine()), mesh(merge(tubeOut), FM.aluDark()), mesh(merge(tubeSp), FM.gold())]);
  tt2.userData.part.thermalRole = 'lox';
  const fl = P('Second stage feed lines & prevalves', {
    system: 'Fuel', xrayWeight: 0.5, material: 'Stainless lines, LOX and RP-1 prevalves', mass: 30,
    desc: 'A short LOX leg from the transfer tube to the turbopump\'s oxidiser inlet and an RP-1 outlet from the aft dome beside it, each with a prevalve that holds the propellant above the pump until start.',
    explode: [0, -0.6, 2.6],
  }, [mesh(merge([
    pipe([[0, dBot + 0.02, 0], [-0.18, dBot - 0.05, 0], [loxIn[0], loxIn[1] - 0.02, 0]], 0.08, { seg: 10, tubular: 8 }),
    post(rpIn[0], 0, rpIn[1] - 0.06, aftDomeY(0.61) + 0.03, 0.06, 10),
  ]), FM.steelLine()), mesh(merge([post(-0.09, 0, dBot - 0.1, dBot - 0.0, 0.1, 12), post(rpIn[0], 0, rpIn[1] + 0.02, rpIn[1] + 0.1, 0.075, 12)]), FM.gold())]);
  fl.userData.part.thermalRole = 'lox';

  // ------------------------------------------------------------------ thrust structure and Merlin Vacuum
  const gimbalY = ex + MVAC.gimbalTop;
  const ts = [thrustCone(R - 0.06, Y.s2AftSkirt - 0.32, 0.62, gimbalY + 0.1, 48), hoop(R - 0.08, 0.05, Y.s2AftSkirt - 0.32, { seg: 64, tube: 6 }), hoop(0.62, 0.05, gimbalY + 0.1, { seg: 32, tube: 6 })];
  for (let i = 0; i < 8; i++) ts.push(beam(at(R - 0.1, i * 45 + 22.5, Y.interTop + 0.06), at(0.62, i * 45 + 22.5, gimbalY + 0.08), 0.07, 0.07));
  for (const a of [45, 135, 225, 315]) ts.push(beam(at(0.62, a, gimbalY + 0.1), at(0.12, a, gimbalY - 0.02), 0.08, 0.1));
  P('Second stage thrust structure', {
    system: 'Structure', xrayWeight: 0.5, material: 'Aluminium thrust cone, struts and gimbal ring', mass: 260,
    desc: 'Carries the Merlin Vacuum\'s ≈ 981 kN from the gimbal into the aft skirt. The cone sits under the aft dome; the powerhead pokes up through its central ring.',
    explode: [0, -0.4, 0],
  }, [mesh(ts[0], FM.aluDark()), mesh(merge(ts.slice(1)), FM.aluDark())]);

  const kit = mvacKit();
  const atE = (list) => placeAll(list, 0, ex, 0, Math.PI);
  const V = (name, info, objs) => P(name, { system: 'Propulsion', ...info }, objs);
  const ch = mesh(mvacChamber(48), FM.copper()); ch.position.y = ex;
  const inj = mesh(merge(atE(kit.inj)), FM.gold());
  inj.userData.xrayWeight = 1;
  const c1 = V('MVac thrust chamber & injector', {
    material: 'Copper-alloy liner, Inconel jacket, pintle injector inside', mass: 150,
    desc: 'The same chamber and pintle injector as the sea-level Merlin 1D. The Falcon User\'s Guide gives the stage\'s throttle range as 220,500 lbf down to 140,679 lbf (981 → 626 kN, ≈ 64 %; Wikipedia quotes 39 %), and the engine relights for multi-burn missions.',
    explode: [0, -0.9, 0],
  }, [ch, inj]);
  c1.userData.part.thermalRole = 'engine2';
  const rg = mesh(mvacRegen(56), SKIN.bell()); rg.position.y = ex;
  const c2 = V('MVac regenerative nozzle', {
    material: 'Regeneratively cooled channel-wall nozzle', mass: 80,
    desc: 'Fuel-cooled section from the throat to the extension joint, where the expansion is about 19 : 1.',
    explode: [0, -1.4, 0],
  }, rg);
  c2.userData.part.thermalRole = 'engine2';
  const ext = mesh(mvacExtension(96), FM.niobium()); ext.position.y = ex;
  const flange = mesh(hoop(MVAC.jointR + 0.02, 0.035, MVAC.jointY + ex, { seg: 64, tube: 6 }), M.darkMetal());
  const c3 = V('MVac niobium nozzle extension', {
    xrayWeight: 0.55, material: 'Niobium-alloy sheet, radiatively cooled', mass: 160,
    desc: 'The large bell expands the exhaust 165 : 1 to a ≈ 3.3 m exit, lifting Isp to 348 s; the uncooled niobium glows orange-hot in vacuum. Shown ≈ 2.75 m long (estimated; the Merlin 1C Vacuum\'s was 9 ft). Since Transporter-7 (2023) lower-energy missions fly a short extension that gives ≈ 10 % less vacuum thrust but uses 75 % less material, mostly scarce niobium.',
    callout: true, anchor: [-1.45, ex + 0.3, 0.45], explode: [0, -2.0, 0],
  }, [ext, flange]);
  c3.userData.part.thermalRole = 'mvacExt';
  V('MVac turbopump', {
    material: 'Single-shaft LOX / RP-1 turbopump', mass: 120,
    desc: 'The same turbopump as the Merlin 1D, feeding the vacuum engine; its inlets reach straight up to the aft dome.',
    explode: [-1.2, -0.8, 0],
  }, mesh(merge(atE(kit.pump)), FM.pump()));
  const gg = V('MVac gas generator & exhaust manifold', {
    material: 'Inconel gas generator, duct and toroidal manifold', mass: 45,
    desc: 'On MVac the turbine exhaust is not thrown overboard: a duct feeds it into a ring manifold at the top of the extension, where it film-cools the niobium wall and adds a little thrust.',
    explode: [-1.4, -1.2, 0.8],
  }, [mesh(merge(atE(kit.gg)), FM.inconel()), mesh(merge(atE(kit.duct)), FM.inconel())]);
  gg.userData.part.thermalRole = 'engine2';
  V('MVac TVC actuators', {
    system: 'Flight controls', count: 2, material: 'Hydraulic actuators (RP-1 working fluid)', mass: 30,
    desc: 'Gimbal the engine for pitch and yaw during the burns; roll is held by the nitrogen thrusters.',
    explode: [1.1, -0.7, 0],
  }, mesh(merge(atE(kit.act)), FM.steelLine()));
  V('MVac TVC supply & return lines', {
    system: 'Hydraulics', count: 4, xrayWeight: 0.6, material: 'Stainless high-pressure RP-1 lines', mass: 3,
    desc: 'As on every Merlin, the turbopump feeds high-pressure RP-1 to the two actuators and takes it back to its low-pressure inlet. Routing estimated.',
    explode: [1.5, -0.4, 0.6],
  }, mesh(merge(atE(kit.tvc)), FM.steelLine()));
  V('MVac valves & TEA-TEB igniter', {
    material: 'Main valves, GG and mixture-trim valves, chill bleed, insulated igniter lines', mass: 25,
    desc: 'Main valves, the gas-generator valve, the mixture-ratio trim valve, the chill bleed and the dual-redundant TEA-TEB igniter lines, lagged with insulation (white) since the first Falcon 9 v1.1 relight failed in September 2013 when the cold lines clogged after a coast.',
    explode: [1.3, -1.1, 0.8],
  }, [mesh(merge(atE([...kit.line, ...kit.ign, ...kit.bleed.slice(1)])), FM.steelLine()), mesh(merge(atE([...kit.valve, kit.bleed[0]])), FM.gold()), mesh(merge(atE(kit.lag)), FM.lagging())]);
  const ctlAz = 80;
  P('MVac engine controller', {
    system: 'Avionics', material: 'Engine computer (three voting processors)', mass: 4,
    desc: 'Like each first-stage Merlin, the Merlin Vacuum has its own controller of three computers that check each other, running its start, throttle, relight and shutdown sequences. Mounted under the thrust cone beside the powerhead (position estimated).',
    explode: [0.6, -0.6, 1.4],
  }, mesh(unit(0.86, ctlAz, gimbalY + 0.02, 0.16, 0.2, 0.12), FM.avionics()));
  const tt = [sideBottle(1.6, 180, 47.76, 0.1, 0.45), pipe([at(1.5, 180, 47.76), at(0.9, 182, 47.5), [-0.36, ex + 2.05 + dy, 0.12]], 0.015, { seg: 6, tubular: 12 })];
  V('Second stage TEA-TEB ignition tank', {
    material: 'Stainless pressure vessel', mass: 12,
    desc: 'Ignition-fluid supply for the Merlin Vacuum\'s relights, sized for the mission\'s burns (the mission-extension kit adds more). Placement estimated.',
    explode: [0, -1.0, 2.0],
  }, mesh(merge(tt), FM.steelLine()));

  // helium: bottles in the LOX → down the wall → heat exchanger on the engine → back to both ullages
  const hxAt = at(0.75, 180, gimbalY - 0.05);
  const he = [
    block(hxAt[0], hxAt[1], hxAt[2], 0.2, 0.14, 0.3),
    pipe([at(1.0, 330, 53.55), at(1.72, 332, 53.0), at(1.72, 334, Y.s2CommonDome), at(1.72, 336, 48.3), at(1.6, 340, 47.68), at(0.95, 200, 47.42), [hxAt[0] - 0.08, hxAt[1], hxAt[2] + 0.12]], 0.028, { seg: 6, tubular: 70 }),
    pipe([[hxAt[0] + 0.08, hxAt[1], hxAt[2] - 0.12], at(0.95, 160, 47.42), at(1.6, 20, 47.68), at(1.72, 22, 48.3), at(1.72, 24, Y.s2CommonDome - 0.3), at(1.72, 26, Y.s2LoxTop - 0.1), at(1.3, 26, Y.s2LoxTop + 0.4)], 0.025, { seg: 6, tubular: 70 }),
    pipe([at(1.72, 22, 50.0), at(1.5, 22, Y.s2CommonDome - 0.4)], 0.02, { seg: 6, tubular: 6 }),
  ];
  P('Second stage helium heat exchanger & pressurisation lines', {
    system: 'Fuel', material: 'Heat exchanger on the engine, stainless helium lines', mass: 40,
    desc: 'The second stage is pressurised with heated helium too: gas from the COPVs is warmed in a heat exchanger on the Merlin Vacuum and fed to the tops of both tanks. Routing simplified.',
    explode: [0, 0.4, 3.4],
  }, mesh(merge(he), FM.steelLine()));

  // ------------------------------------------------------------------ mission-extension kit hardware
  const mekC = [sideBottle(1.6, 5, 47.78, 0.13, 0.6), sideBottle(1.6, 100, 47.78, 0.13, 0.6)];
  const mekL = [pipe([at(1.6, 354.6, 47.78), at(1.61, 348, 47.72), at(1.6, 341, 47.685)], 0.012, { seg: 4, tubular: 6 }),
    pipe([at(1.6, 89, 47.78), at(1.45, 92, 47.6), at(1.0, 150, 47.45), [hxAt[0] + 0.02, hxAt[1] + 0.08, hxAt[2] + 0.1]], 0.012, { seg: 4, tubular: 14 })];
  P('Second stage mission-extension kit COPVs', {
    system: 'Fuel', count: 2, material: 'Composite-overwrapped helium bottles and lines', mass: 2 * 30,
    desc: 'The mission-extension kit adds helium bottles for pressurisation control through coasts of hours (first flown on Falcon 9 for CRS-18, 2019), plumbed into the stage\'s pressurisation system. Their real count and placement are not published; two are shown in the aft skirt.',
    explode: [0, -1.4, -1.6],
  }, [mesh(merge(mekC), FM.copv()), mesh(merge(mekL), FM.steelLine())]);
  P('Second stage mission-extension kit batteries & TEA-TEB', {
    system: 'Power', count: 2, material: 'Extra battery pack and TEA-TEB bottle', mass: 45,
    desc: 'Extra battery capacity and extra TEA-TEB igniter fluid let the stage survive a long coast and still relight; the grey band on the RP-1 tank completes the kit. Placement estimated.',
    explode: [0, -1.6, -2.2],
  }, [mesh(unit(1.6, 255, 47.74, 0.32, 0.2, 0.18), FM.battery()), mesh(merge([sideBottle(1.6, 200, 47.76, 0.08, 0.35), pipe([at(1.6, 194, 47.76), at(1.6, 188, 47.7)], 0.01, { seg: 4, tubular: 4 })]), FM.steelLine())]);

  // ------------------------------------------------------------------ attitude control, avionics, power
  const rcs = [], n2 = [], n2l = [];
  const podY = Y.s2AftSkirt - 0.1;
  for (const a of [90, 270]) {
    rcs.push(unit(R + 0.1, a, podY, 0.46, 0.5, 0.22));
    for (const dt of [-0.12, 0.12]) {
      const [nx, nz] = polar(R + 0.23, a + (dt * 180) / (Math.PI * R));
      rcs.push(post(nx, nz, podY - 0.22, podY - 0.12, 0.03, 8), post(nx, nz, podY + 0.12, podY + 0.22, 0.03, 8));
    }
    n2.push(sideBottle(1.62, a + 45, 47.77, 0.12, 0.7));
    n2l.push(pipe([at(1.62, a + 45, 47.89), at(1.74, a + 20, 47.97), at(R - 0.03, a, podY)], 0.018, { seg: 6, tubular: 12 }));
  }
  P('Second stage cold-gas thrusters', {
    system: 'Attitude control', count: 2, material: 'Nitrogen thruster pods', mass: 50,
    desc: 'Nitrogen cold-gas thrusters control roll during the burns and all three axes while coasting and deploying the payload; the User\'s Guide notes cold gas is more reliable and leaves less contamination than a propellant thruster system. Pod positions estimated.',
    explode: [0, -0.4, 1.6],
  }, mesh(merge(rcs), FM.black()));
  P('Second stage nitrogen tanks', {
    system: 'Attitude control', count: 2, material: 'Composite-overwrapped N₂ tanks', mass: 60,
    desc: 'Store the high-pressure nitrogen for the attitude thrusters, on the aft-skirt wall below the thrust cone (placement estimated).',
    explode: [0, -1.2, 1.2],
  }, mesh(merge(n2), FM.copv()));
  P('Second stage nitrogen lines', {
    system: 'Attitude control', count: 2, material: 'Stainless lines and regulators', mass: 8,
    desc: 'Carry nitrogen from each tank through a regulator to the thruster pod beside it.',
    explode: [0, -1.0, 1.6],
  }, mesh(merge(n2l), FM.steelLine()));
  const avY = Y.s2Top - 0.25;
  const S = (name, info, geo, mat = FM.avionics()) => P(name, { system: 'Avionics', ...info }, mesh(merge(geo), mat));
  S('Second stage flight computers', {
    count: 3, material: 'Three-string fault-tolerant flight computers', mass: 3 * 12,
    desc: 'Three computers vote on every decision: they fly the closed-loop ascent and the orbital burns, and tell the separation, valve and pressurisation controllers what to do.',
    explode: [0, 1.4, 1.0],
  }, [30, 150, 270].map((a) => unit(1.62, a, avY, 0.4, 0.24, 0.28)));
  S('Second stage IMU & GPS unit', {
    material: 'Inertial measurement unit and GPS receivers', mass: 15,
    desc: 'Measures the stage\'s motion and position for guidance; GPS keeps the inertial solution honest all the way to orbit insertion and, on missions that need it, the deorbit burn.',
    explode: [0, 1.7, 1.0],
  }, [unit(1.62, 90, avY, 0.4, 0.24, 0.28)]);
  S('Second stage flight-termination system', {
    count: 2, material: 'Two independent autonomous flight-safety units', mass: 2 * 10,
    desc: 'Two independent strings of the autonomous flight-safety system watch the trajectory and would end the flight without any ground command.',
    explode: [0, 2.0, 1.0],
  }, [210, 330].map((a) => unit(1.62, a, avY, 0.4, 0.24, 0.28)), FM.safety());
  P('Second stage S-band transmitters', {
    system: 'Communications', count: 2, material: 'S-band telemetry and video transmitters', mass: 2 * 4,
    desc: 'Send telemetry and video from the second stage to the ground through orbit insertion and payload separation — the "second-stage engine" and payload views in every webcast.',
    explode: [0, 2.3, 1.0],
  }, mesh(merge([0, 180].map((a) => unit(1.62, a, avY, 0.26, 0.16, 0.16))), FM.avionics()));
  P('Second stage C-band transponder', {
    system: 'Communications', material: 'C-band radar transponder', mass: 3,
    desc: 'Answers the range\'s tracking radars with a strong, unambiguous echo, so Range Safety can follow the vehicle independently of its own telemetry. Placement estimated.',
    explode: [0, 2.6, 1.0],
  }, mesh(unit(1.62, 120, avY, 0.2, 0.15, 0.1), FM.avionics()));
  P('Second stage C-band antennas', {
    system: 'Communications', count: 2, material: 'Flush C-band antennas', mass: 2,
    desc: 'Two flush antennas 180° apart serve the C-band transponder. Placement estimated.',
    explode: [0, 0.8, 2.2],
  }, mesh(merge([15, 195].map((a) => unit(R + 0.02, a, 56.55, 0.1, 0.1, 0.03))), FM.raceway()));
  P('Second stage batteries & power', {
    system: 'Power', count: 2, material: 'Lithium-ion batteries, power distribution units', mass: 80,
    desc: 'Batteries power the stage through ascent, coasts and the deorbit burn; there are no solar arrays on the second stage, which limits how long it can coast.',
    explode: [0, -0.8, -1.2],
  }, mesh(merge([40, 220].map((a) => unit(1.6, a, 47.74, 0.34, 0.22, 0.2))), FM.battery()));
  const rwAz = 290;
  const rw = [unit(R + 0.06, rwAz, (Y.interTop + 0.3 + Y.fairingBase) / 2, 0.22, Y.fairingBase - Y.interTop - 0.3, 0.12)];
  P('Second stage raceway', {
    system: 'Electrical', material: 'Composite cable tray', mass: 30,
    desc: 'Cable tunnel joining the aft skirt to the forward avionics. Beside the T-0 quick disconnect, it also carries up to four dedicated payload harnesses along the outside of the tanks (Falcon User\'s Guide). Azimuth estimated.',
    explode: [0, 0, 1.4],
  }, mesh(merge(rw), FM.raceway()));
  P('Second stage telemetry antennas', {
    system: 'Communications', count: 2, material: 'S-band patch antennas', mass: 6,
    desc: 'Radiate the S-band transmitters\' telemetry and video to ground stations.',
    explode: [0, 0.6, 1.6],
  }, mesh(merge([60, 240].map((a) => unit(R + 0.02, a, 56.3, 0.16, 0.24, 0.04))), FM.raceway()));
  P('Second stage GPS antennas', {
    system: 'Communications', count: 2, material: 'GPS patch antennas', mass: 2,
    desc: 'Feed the navigation unit with GPS fixes for orbit insertion and, on missions that need it, the deorbit burn.',
    explode: [0, 0.6, 2.0],
  }, mesh(merge([150, 330].map((a) => unit(R + 0.02, a, 55.9, 0.14, 0.14, 0.03))), FM.raceway()));
  const camG = [unit(1.66, 60, 47.88, 0.12, 0.08, 0.1), unit(R + 0.06, 60, 57.45, 0.12, 0.08, 0.1)];
  const camL = [new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10).translate(...at(1.66, 60, 47.82)), new THREE.CylinderGeometry(0.03, 0.025, 0.04, 10).translate(...at(R + 0.07, 60, 57.51))];
  P('Second stage cameras', {
    system: 'Sensors', count: 2, material: 'Video cameras in small housings', mass: 2 * 1.5,
    desc: 'One looks down from the aft skirt at the Merlin Vacuum\'s glowing nozzle; one on the forward skirt watches the fairing go and the payload separate. Positions estimated from webcast views.',
    explode: [0, -0.4, 2.6],
  }, [mesh(merge(camG), FM.black()), mesh(merge(camL), FM.lens())]);

  // ------------------------------------------------------------------ T-0 quick disconnect and harnesses
  const qd = [unit(R + 0.01, qdAz, qdY, 0.9, 0.7, 0.04)];
  for (const dyq of [-0.16, 0.16]) for (const dt of [-0.3, -0.1, 0.1, 0.3]) qd.push(unit(R + 0.04, qdAz + (dt * 180) / (Math.PI * R), qdY + dyq, 0.1, 0.1, 0.04));
  const qdCover = [unit(R + 0.045, qdAz, (qdY + 0.35 + 52.62) / 2, 0.16, 52.62 - qdY - 0.35, 0.08), unit(R + 0.045, 258, (qdY - 0.2 + 48.3) / 2, 0.12, qdY - 0.2 - 48.3, 0.07),
    pipe([at(R + 0.04, qdAz - 6, qdY - 0.3), at(R + 0.05, 262, qdY - 0.25), at(R + 0.045, 258, qdY - 0.25)], 0.03, { seg: 6, tubular: 6 })];
  const qdLines = [
    pipe([at(R - 0.02, qdAz - 2, qdY + 0.05), at(1.55, qdAz - 2, qdY + 0.05)], 0.035, { seg: 6, tubular: 3 }),                 // RP-1 fill / drain
    pipe([at(R + 0.02, qdAz + 2, 52.6), at(R - 0.06, qdAz + 2, 52.62), at(1.55, qdAz + 2, 52.5)], 0.035, { seg: 6, tubular: 4 }),   // LOX fill / drain
    pipe([at(R + 0.03, 258, 48.32), at(R - 0.06, 258, 48.2), at(1.74, 270, 47.95), ...arc(1.74, 47.95, 285, 300, 3)], 0.01, { seg: 4, tubular: 12 }),   // GN₂ fill → 315° tank
    pipe([at(1.74, 258, 47.95), ...arc(1.74, 47.95, 250, 152, 8)], 0.01, { seg: 4, tubular: 16 }),                                // → 135° tank
  ];
  P('Second stage T-0 quick disconnect', {
    system: 'Fuel', material: 'Quick-disconnect plate; RP-1, LOX, helium, nitrogen, power, data and payload connectors; external line covers', mass: 35,
    desc: 'Where the transporter-erector\'s second-stage umbilicals plug in until liftoff: RP-1 and LOX fill and drain, helium and nitrogen, power and data, and the ground harness that runs the length of the TE, whose flight side feeds up to four payload harnesses (Falcon User\'s Guide). Covers carry the LOX and helium lines up to the LOX tank and the nitrogen line down to the aft skirt. Routing estimated.',
    explode: [0, 0.2, -2.6],
  }, [mesh(merge(qd), FM.aluDark()), mesh(merge(qdCover), FM.raceway()), mesh(merge(qdLines), FM.steelLine())]);
  const s2h = [
    pipe([at(R + 0.03, qdAz + 6, qdY + 0.05), at(R + 0.05, qdAz + 12, qdY + 0.07), at(R + 0.05, rwAz - 4, qdY + 0.07), at(R + 0.05, rwAz, qdY + 0.1)], 0.028, { seg: 6, tubular: 10 }),   // QD → raceway
    pipe([at(R + 0.05, rwAz, Y.interTop + 0.35), at(R - 0.03, rwAz, Y.interTop + 0.25), at(1.76, rwAz - 3, 47.8)], 0.028, { seg: 6, tubular: 6 }),
    hoop(1.76, 0.014, 47.8, { seg: 64, tube: 4 }),
    pipe([at(1.76, ctlAz, 47.8), at(1.2, ctlAz, 47.5), at(0.94, ctlAz, gimbalY + 0.02)], 0.014, { seg: 4, tubular: 8 }),         // → MVac controller
    pipe([at(R + 0.05, rwAz, Y.fairingBase - 0.05), at(R - 0.03, rwAz, Y.fairingBase + 0.05), at(1.72, rwAz - 3, 57.12)], 0.028, { seg: 6, tubular: 6 }),
    hoop(1.72, 0.014, 57.12, { seg: 64, tube: 4 }),
  ];
  for (const a of [40, 220, 180, 135, 315, 60]) s2h.push(pipe([at(1.76, a, 47.8), at(1.72, a, 47.84)], 0.01, { seg: 4, tubular: 3 }));   // batteries, TEA-TEB, N₂ valves, camera
  for (const a of [0, 30, 90, 120, 150, 180, 210, 270, 330]) s2h.push(pipe([at(1.72, a, 57.12), at(1.72, a, 57.24)], 0.01, { seg: 4, tubular: 3 }));
  for (const a of [rwAz - 4, rwAz + 4]) {
    // payload harnesses: forward skirt → up the attach fitting and adapter to the separation plane
    s2h.push(pipe([at(1.72, a, 57.12), at(1.76, a, 57.62), at(1.27, a, 57.89), at(0.84, a, Y.pafTop - 0.02), at(0.86, a, Y.pafTop + 0.4), at(0.72, a, Y.pafTop + 0.47)], 0.014, { seg: 4, tubular: 16 }));
  }
  P('Second stage wiring & payload harnesses', {
    system: 'Electrical', material: 'Shielded cable bundles, Ø 25–30 mm', mass: 60,
    desc: 'Rings in the aft and forward skirts tie the batteries, TEA-TEB and nitrogen valves, cameras and Merlin Vacuum controller to the computers, transmitters and antennas through the raceway. Two of up to four payload harnesses leave the T-0 quick disconnect, run up the raceway and climb the attach fitting to the spacecraft separation plane. Routing simplified.',
    explode: [0, 0.2, 2.8],
  }, mesh(merge(s2h), FM.cable()));

  // ------------------------------------------------------------------ payload attach fitting, adapter and payload
  const paf = [lathe([[R - 0.1, Y.s2Top], [1.25, Y.s2Top + 0.25], [0.82, Y.pafTop - 0.06], [0.79, Y.pafTop]], 64), hoop(0.79, 0.04, Y.pafTop - 0.02, { seg: 64, tube: 6 })];
  P('Payload attach fitting', {
    system: 'Structure', material: 'Machined aluminium cone, 1,575 mm bolted interface', mass: 180,
    desc: 'Conical adapter from the 3.66 m stage to the 1,575 mm (62.01 in) bolted interface of the EELV medium-class standard. Heavier payloads use 2,624 mm or 3,117 mm fittings.',
    explode: [0, 1.6, 0],
  }, mesh(merge(paf), FM.alu()));
  P('PAF close-out plate', {
    system: 'Structure', xrayWeight: 0.6, material: 'Thin aluminium plate', mass: 15,
    desc: 'Closes the top of the attach fitting between the payload and the upper stage, so debris and gas from the stage cannot reach the spacecraft (Falcon User\'s Guide).',
    explode: [0, 2.0, 0],
  }, mesh(post(0, 0, Y.pafTop - 0.03, Y.pafTop - 0.015, 0.75, 48), FM.aluDark()));
  const adTop = Y.pafTop + 0.45;
  const adapter = [lathe([[0.79, Y.pafTop + 0.02], [0.8, Y.pafTop + 0.1], [0.83, adTop - 0.06], [0.833, adTop]], 64), hoop(0.79, 0.03, Y.pafTop + 0.04, { seg: 64, tube: 6 })];
  P('Payload adapter (1,666 mm)', {
    system: 'Structure', material: 'Aluminium adapter cone', mass: 70,
    desc: 'Bolted on the 1,575 mm PAF, it steps up to the 1,666 mm clamp-band interface this satellite uses; Falcon adapters also come with 937 mm and 1,194 mm clamp bands. Height estimated.',
    explode: [0, 2.6, 0],
  }, mesh(merge(adapter), FM.aluDark()));
  const clamp = [hoop(0.845, 0.04, adTop - 0.03, { seg: 64, tube: 8 })];
  for (let i = 0; i < 8; i++) { const [x, z] = polar(0.74, i * 45); clamp.push(post(x, z, adTop - 0.25, adTop - 0.02, 0.03, 8)); }
  P('Payload clamp band & separation springs', {
    system: 'Separation', material: 'Clamp band, separation springs, separation connectors', mass: 40,
    desc: 'A clamp band holds the spacecraft ring to the adapter; when its bolts are cut, the band springs open and separation springs push the payload away at well under 1 m/s while the harness connectors pull apart.',
    explode: [0, 3.1, 0],
  }, mesh(merge(clamp), FM.steelLine()));

  const py0 = adTop + 0.05;
  // octagonal bus (flats face ±x / ±z) with a top deck, launch-adapter ring and thruster clusters
  const busSide = lathe([[1.19, py0 + 0.1], [1.19, py0 + 5.0]], 8, Math.PI / 8);
  const deck = [lathe([[0.001, py0 + 0.1], [1.19, py0 + 0.1]], 8, Math.PI / 8), lathe([[1.19, py0 + 5.0], [0.001, py0 + 5.0]], 8, Math.PI / 8)];
  const busKit = [post(0, 0, py0 - 0.02, py0 + 0.12, 0.8, 32), post(0, 0, py0 + 5.0, py0 + 5.25, 0.45, 20), post(0, 0, py0 + 5.25, py0 + 5.6, 0.18, 16, 0.3)];
  for (const a of [45, 135, 225, 315]) for (const y of [py0 + 0.4, py0 + 4.7]) busKit.push(unit(1.12, a, y, 0.18, 0.14, 0.14));
  const pl = P('Payload: communications satellite', {
    system: 'Payload', xrayWeight: 0.6, material: 'Spacecraft bus under gold and silver multi-layer insulation', mass: 6400,
    desc: 'A representative ≈ 6.4 t geostationary communications satellite of the kind Falcon Heavy sends to transfer orbit (26.7 t is the expendable GTO limit). Thruster clusters sit at the bus corners; the feed tower on top lights the reflectors.',
    callout: true, anchor: [-1.15, py0 + 0.9, 0.6], explode: [0, 4.4, 0],
  }, [mesh(busSide, SKIN.mli()), mesh(merge(deck), SKIN.mli()), mesh(merge(busKit), M.titanium())]);
  pl.userData.part.temp = 293;
  const busIn = [post(0, 0, py0 - 0.4, py0 + 0.1, 0.18, 16, 0.08), post(0, 0, py0 + 0.6, py0 + 4.4, 0.62, 24)];
  for (const y of [py0 + 1.3, py0 + 3.7]) busIn.push(new THREE.SphereGeometry(0.42, 18, 12).translate(0.62, y, 0), new THREE.SphereGeometry(0.42, 18, 12).translate(-0.62, y, 0));
  P('Payload apogee engine & propellant tanks', {
    system: 'Propulsion', xrayWeight: 0.6, material: 'Bipropellant apogee engine, titanium tanks', mass: 2900,
    desc: 'Most of a GEO satellite\'s launch mass is propellant for raising itself from transfer orbit to geostationary orbit; the apogee engine sits inside the adapter ring.',
    explode: [0, 3.8, 2.4],
  }, mesh(merge(busIn), M.titanium()));
  P('Payload solar arrays (stowed)', {
    system: 'Power', count: 2, xrayWeight: 0.6, material: 'Folded solar array wings on hold-down points', mass: 2 * 160,
    desc: 'Folded against the bus for launch and released after separation.',
    explode: [0, 4.4, 0.9],
  }, mesh(merge([1, -1].map((s) => block(0, py0 + 2.6, s * 1.24, 2.0, 4.6, 0.26))), M.solar()));
  const refl = [];
  for (const s of [1, -1]) {
    const g = lathe([[0.001, 0], [0.6, 0.06], [1.1, 0.22], [1.25, 0.32]], 40);
    g.rotateZ((s * Math.PI) / 2);
    g.translate(s * (1.19 + 0.36), py0 + 2.8, 0);
    refl.push(g);
  }
  P('Payload antenna reflectors (stowed)', {
    system: 'Communications', count: 2, xrayWeight: 0.6, material: 'Carbon-fibre reflectors', mass: 2 * 70,
    desc: 'Deployable communications reflectors folded against the sides of the bus for launch.',
    explode: [0, 4.4, 0],
  }, mesh(merge(refl), M.offWhite()));

  // ------------------------------------------------------------------ fairing
  const prof = FAIR;
  const innerProf = fairingProfile(0.05).filter(([, y]) => y > Y.fairingBase + 1.3 && y < 66.5);
  for (const [grp, side, label] of [[fairA, 1, 'A'], [fairB, -1, 'B']]) {
    const phi = side > 0 ? 0 : Math.PI;
    const az = (a) => (side > 0 ? a : 180 - a);         // azimuth on this half (A is +x, B mirrors it)
    const xs = side * 0.04;                              // just this half's side of the vertical seam
    const f = P(`Fairing half ${label}`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon-fibre skins over aluminium honeycomb', mass: 640,
      desc: 'One of the two clamshell halves (13.2 m × 5.2 m together, ≈ 1.7 t) that protect the payload through max-Q and aerodynamic heating. Both halves are recovered and reflown: by February 2025 fairing halves had re-flown on more than 300 missions.',
      callout: side > 0, anchor: [2.0, 62.2, 1.5], explode: [side * 4.0, 2.2, 0],
    }, mesh(lathe(prof, 72, phi, Math.PI), FM.fairing()), grp);
    f.userData.part.thermalRole = 'fairing';
    P(`Fairing half ${label} acoustic blankets`, {
      system: 'Skin & fairings', skin: true, material: 'Foam acoustic blankets on the inner wall', mass: 40,
      desc: 'Line the inside of the cylinder and lower ogive to soak up the roar of liftoff and transonic flight, which would otherwise shake the payload harder than the launch loads themselves.',
      explode: [side * 3.2, 2.2, 0],
    }, mesh(lathe(innerProf, 48, phi, Math.PI), FM.blanket()), grp);
    // vertical-seam latches every ≈ 1.6 m on both seams
    const lat = [];
    for (let y = Y.fairingBase + 0.6; y < 66; y += 1.6) for (const zs of [-1, 1]) {
      const zz = (fairR(y) - 0.06) * zs;
      lat.push(block(xs + side * 0.03, y, zz, 0.07, 0.25, 0.1));
    }
    P(`Fairing half ${label} seam latches`, {
      system: 'Separation', count: lat.length, material: 'Mechanical latches along the vertical seam', mass: 20,
      desc: 'Mechanical latches fasten the two halves along the vertical seam. A high-pressure helium circuit releases them all at once about 3½–4 minutes into flight, once aerodynamic heating on the payload has fallen low enough. Spacing estimated.',
      explode: [side * 4.6, 2.2, 0],
    }, mesh(merge(lat), FM.aluDark()), grp);
    const py = side > 0 ? 59.4 : 62.8;                   // A carries the lower pair, B the upper (estimate)
    const push = [];
    for (const zs of [-1, 1]) {
      const zz = (fairR(py) - 0.12) * zs;
      const g = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 14); g.rotateZ(Math.PI / 2); g.translate(side * 0.2, py, zz);
      const g2 = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10); g2.rotateZ(Math.PI / 2); g2.translate(side * 0.01, py, zz);
      push.push(g, g2, block(side * 0.38, py, zz, 0.04, 0.22, 0.2));
    }
    P(`Fairing half ${label} pneumatic pushers`, {
      system: 'Separation', count: 2, material: 'Helium-driven pneumatic pushers', mass: 12,
      desc: 'Two of the fairing\'s four pneumatic pushers, which shove the halves apart once the seam latches open. The whole system is pneumatic, so the actual flight hardware can be tested before flight and the separation leaves almost no debris. Positions estimated.',
      explode: [side * 4.9, 2.6, 0],
    }, mesh(merge(push), FM.steelLine()), grp);
    // helium bottle on the wall of each half, a line round to both seams and up each seam past the latches
    const bA = az(0), by = 58.7;
    const he = [bottle(...at(fairR(by) - 0.22, bA, by), 0.15, 0.6, 14)];
    const seamPts = (zs) => {
      const pts = [];
      for (let y = Y.fairingBase + 0.6; y < 66; y += 1.6) pts.push([xs + side * 0.1, y, (fairR(y) - 0.1) * zs]);
      return pts;
    };
    for (const zs of [-1, 1]) {
      const a1 = side > 0 ? zs * 84 : 180 - zs * 84;
      he.push(pipe([at(fairR(by) - 0.22, bA + zs * 4, by + 0.3), ...arc(fairR(by + 0.3) - 0.12, by + 0.3, bA + zs * 10, a1, 8), [xs + side * 0.1, by + 0.3, (fairR(by + 0.3) - 0.1) * zs], ...seamPts(zs).filter(([, y]) => y > by + 0.4)], 0.008, { seg: 4, tubular: 70, tension: 0.05 }));
      he.push(pipe([[xs + side * 0.1, Y.fairingBase + 0.6, (fairR(Y.fairingBase + 0.6) - 0.1) * zs], [xs + side * 0.1, by + 0.3, (fairR(by + 0.3) - 0.1) * zs]], 0.008, { seg: 4, tubular: 6 }));
    }
    P(`Fairing half ${label} helium bottle & lines`, {
      system: 'Separation', material: 'Composite helium bottle, stainless lines along the seams', mass: 10,
      desc: 'Stores the high-pressure helium that opens the latches and drives the pushers, with lines along the inside of the wall to both seams. The Falcon User\'s Guide describes the helium circuit, not its layout: one bottle per half is an estimate.',
      explode: [side * 4.3, 1.6, 0],
    }, mesh(merge(he), FM.steelLine()), grp);
    // recovery kit in the nose of each half, mounted on the wall
    const thr = [], tank = [], av = [];
    const thrY = 64.15;
    for (const ta of [24, -24]) {
      const a = az(ta);
      thr.push(wallBox(a, thrY, 0.16, 0.14, 0.12, 0.02));
      for (const dt of [-0.05, 0.05]) {
        const n = new THREE.CylinderGeometry(0.018, 0.03, 0.08, 10);
        n.rotateX(Math.PI / 2); n.rotateY(radialYaw(a));
        n.translate(...at(fairR(thrY) + 0.015, a + (dt * 180) / (Math.PI * 2.6), thrY));
        thr.push(n);
      }
    }
    const tA = az(-26.6), tY = 65.4;
    tank.push(new THREE.SphereGeometry(0.22, 16, 10).translate(...at(fairR(tY) - 0.3, tA, tY)), hoop(0.225, 0.012, tY, { seg: 24, tube: 4, x: at(fairR(tY) - 0.3, tA, tY)[0], z: at(fairR(tY) - 0.3, tA, tY)[2] }),
      wallBox(tA, tY, 0.3, 0.08, 0.08, 0.0));
    for (const ta of [24, -24]) tank.push(pipe([at(fairR(tY - 0.2) - 0.3, tA, tY - 0.15), at(fairR(tY - 0.6) - 0.08, az(ta * 0.5 - 13), tY - 0.6), at(fairR(thrY + 0.07) - 0.1, az(ta), thrY + 0.07)], 0.006, { seg: 4, tubular: 14 }));
    const aA = az(26.6), aY = 65.6;
    av.push(wallBox(aA, aY, 0.3, 0.5, 0.25, 0.07), wallBox(aA, aY, 0.36, 0.56, 0.05, 0.0));
    av.push(unit(fairR(aY + 0.45) + 0.005, aA, aY + 0.45, 0.12, 0.12, 0.02));       // GPS patch through the skin
    P(`Fairing half ${label} recovery thrusters`, {
      system: 'Recovery', count: 2, material: 'Nitrogen cold-gas thruster clusters, nozzles through the skin', mass: 12,
      desc: 'Nitrogen thrusters orient the falling half for re-entry, nose-first and stable, before the parachutes open. SES-10 (March 2017) brought back the first fairing half under control with thrusters and a steerable parachute. Positions estimated.',
      explode: [side * 4.8, 3.0, 0.6],
    }, mesh(merge(thr), FM.black()), grp);
    P(`Fairing half ${label} recovery N₂ tank & lines`, {
      system: 'Recovery', material: 'Composite nitrogen tank on a wall bracket, Ø ≈ 10 mm lines', mass: 18,
      desc: 'Nitrogen for the recovery thrusters, strapped to a bracket on the inner wall and piped to both thruster clusters. Positions estimated.',
      explode: [side * 4.8, 3.2, -0.6],
    }, [mesh(merge(tank.slice(0, 1)), FM.copv()), mesh(merge(tank.slice(1)), FM.steelLine())], grp);
    P(`Fairing half ${label} recovery avionics & GPS`, {
      system: 'Recovery', material: 'Avionics box on a wall bulkhead, GPS antenna', mass: 15,
      desc: 'Each half has its own computer and GPS to fly the thrusters and steer the parafoil to the recovery zone, where it is picked out of the sea, cleaned and flown again.',
      explode: [side * 4.8, 3.4, 1.2],
    }, mesh(merge(av), FM.black()), grp);
    P(`Fairing half ${label} parafoil`, {
      system: 'Recovery', material: 'Packed steerable parafoil and drogue in a wall-mounted pack', mass: 45,
      desc: 'A drogue and then a steerable parafoil bring the half down gently to the sea for pick-up. Pack size and position estimated.',
      explode: [side * 5.2, 3.6, 0],
    }, mesh(merge([wallBox(az(0), 66.6, 1.0, 0.85, 0.45, 0.05), wallBox(az(0), 66.6, 1.1, 0.06, 0.12, 0.0)]), FM.parafoil()), grp);
    if (side > 0) {
      // standard access door (one, Ø 610 mm; its azimuth is set per mission)
      const dA = 40, dY = 61.2;
      const dr = new THREE.CylinderGeometry(0.305, 0.305, 0.02, 32); dr.rotateX(Math.PI / 2); dr.rotateY(radialYaw(dA)); dr.translate(...at(2.605, dA, dY));
      const fr = new THREE.TorusGeometry(0.32, 0.012, 4, 32); fr.rotateY(radialYaw(dA)); fr.translate(...at(2.612, dA, dY));
      const bolts = [];
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2, u = 0.27;
        const b = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6); b.rotateX(Math.PI / 2);
        b.translate(Math.cos(t) * u, Math.sin(t) * u, 0); b.rotateY(radialYaw(dA)); b.translate(...at(2.618, dA, dY));
        bolts.push(b);
      }
      P('Fairing access door', {
        system: 'Skin & fairings', skin: true, material: 'Bolted composite door, Ø 610 mm', mass: 4,
        desc: 'The standard fairing has one circular 610 mm (24 in) door in the cylinder, placed per mission over whatever the customer needs to reach after encapsulation; up to eight are a non-standard option. It is not an emergency access once the vehicle is on the pad.',
        explode: [6.0, 2.4, 0.6],
      }, [mesh(dr, FM.fairing()), mesh(merge([fr, ...bolts]), FM.aluDark())], grp);
      // payload air-conditioning inlet facing the transporter-erector's duct
      const iA = 280, iY = 60.4;                        // above the lower pusher pair
      const door = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24); door.rotateX(Math.PI / 2); door.rotateY(radialYaw(iA)); door.translate(...at(2.605, iA, iY));
      const collar = new THREE.CylinderGeometry(0.15, 0.17, 0.12, 20); collar.rotateX(Math.PI / 2); collar.rotateY(radialYaw(iA)); collar.translate(...at(2.66, iA, iY));
      const diff = new THREE.CylinderGeometry(0.16, 0.12, 0.08, 16); diff.rotateX(Math.PI / 2); diff.rotateY(radialYaw(iA)); diff.translate(...at(2.5, iA, iY));
      const inl = P('Fairing air-conditioning inlet', {
        system: 'Environmental control', material: 'Inlet door, duct collar and inner diffuser', mass: 5,
        desc: 'Conditioned air from the pad plant comes in here through the transporter-erector\'s duct and keeps the encapsulated payload at 15.6–30 °C in ISO Class 7 (Class 10,000) clean air right through liftoff; it is disconnected only briefly during rollout (Falcon User\'s Guide). Position estimated.',
        explode: [4.8, 1.6, -1.6],
      }, [mesh(merge([door, collar]), FM.aluDark()), mesh(diff, FM.steelLine())], grp);
      inl.userData.part.temp = 293;
    }
  }
  P('Fairing base separation ring', {
    system: 'Separation', material: 'Pneumatic latch ring at the fairing base', mass: 30,
    desc: 'Holds both halves to the second stage\'s forward skirt; its latches release together with the seam latches and the ring stays with the stage.',
    explode: [0, 1.4, 0],
  }, mesh(hoop(R + 0.04, 0.05, Y.fairingBase + 0.12, { seg: 64, tube: 6 }), FM.aluDark()));
  return out;
}
