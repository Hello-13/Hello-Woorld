// Falcon Heavy second stage (a standard Falcon 9 upper stage with one Merlin Vacuum and the
// mission-extension kit most Falcon Heavy flights carry), the 13.1 m × 5.2 m composite payload
// fairing and a representative payload on its adapter.
//
// Aft-skirt layout (estimated): the aft dome's crown clears the separation plane; the MVac
// powerhead hangs from a thrust cone below it, with the nitrogen bottles, batteries and TEA-TEB
// tank on the skirt wall underneath the cone.

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

  // ------------------------------------------------------------------ tanks
  const span = [Y.interTop, Y.s2Top];
  const vOf = (y) => (y - span[0]) / (span[1] - span[0]);
  const paintMap = stagePaint('S2', { seams: [Y.s2AftSkirt, 50.2, Y.s2CommonDome, 53.6, 55.2, Y.s2LoxTop].map(vOf), soot: 0, streaks: 0, seed: 11 });
  const skin = tankMaterial(paintMap, span[1] - span[0]);
  const tb = (y0, y1) => barrel(R, y0, y1, { v0y: span[0], v1y: span[1], rings: 3 });
  const lox = P('Second stage LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195 monocoque', mass: 1150,
    desc: 'Upper tank of the second stage, ≈ 75 t of densified LOX; its forward skirt carries the avionics, the payload adapter and the fairing. The second stage is a shorter copy of the first, built on the same tooling.',
    explode: [0, 1.0, -4.5],
  }, [mesh(tb(Y.s2CommonDome, Y.s2Top), skin), mesh(merge([53.6, 55.2, Y.s2LoxTop, Y.s2Top - 0.05].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  lox.userData.part.thermalRole = 'lox';
  const rp = P('Second stage RP-1 tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195 skin and stringers', mass: 700,
    desc: 'Lower tank, ≈ 32 t of RP-1; its aft skirt carries the thrust cone and the Merlin Vacuum. Second-stage propellant totals ≈ 107.5 t (111.5 t fuelled stage), burned by one Merlin Vacuum for up to ≈ 6½ minutes in one or more burns.',
    explode: [0, -0.6, -4.5],
  }, [mesh(tb(Y.interTop, Y.s2CommonDome), skin), mesh(merge([Y.interTop + 0.05, Y.s2AftSkirt, 50.2].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  rp.userData.part.thermalRole = 'rp1';
  const mek = P('Second stage mission-extension kit', {
    system: 'Thermal control', skin: true, material: 'Grey thermal paint band; extra COPVs and TEA-TEB inside', mass: 60,
    desc: 'Most Falcon Heavy flights carry a medium or long mission-extension kit for coasts of hours between burns. The grey band over the RP-1 tank absorbs sunlight so the kerosene does not get too cold; the kit also adds strengthened helium bottles and extra TEA-TEB for the relights.',
    explode: [0, -0.6, -4.5],
  }, mesh(barrel(R + 0.006, Y.s2AftSkirt + 0.15, Y.s2CommonDome - 0.15, { rings: 2 }), FM.mekGrey()));
  mek.userData.part.thermalRole = 'rp1';
  const cd = P('Second stage common dome', {
    system: 'Fuel', material: 'Aluminium bulkhead', mass: 160,
    desc: 'Shared bulkhead between the second-stage LOX and RP-1 tanks, the same layout as the first stage.',
    explode: [0, 0.2, 0],
  }, mesh(dome(R - 0.01, Y.s2CommonDome, D, -1), FM.domeAlu()));
  cd.userData.part.thermalRole = 'lox';
  const fwd = P('Second stage forward dome', {
    system: 'Fuel', material: 'Aluminium bulkhead', mass: 130,
    desc: 'Caps the LOX tank under the payload adapter; the LOX vent valve sits at its crown.',
    explode: [0, 0.8, 0],
  }, [mesh(dome(R - 0.01, Y.s2LoxTop, D, 1), FM.domeAlu()), mesh(post(0, 0, Y.s2LoxTop + D - 0.04, Y.s2LoxTop + D + 0.08, 0.09, 12), FM.steelLine())]);
  fwd.userData.part.thermalRole = 'lox';
  const aft = P('Second stage aft dome', {
    system: 'Fuel', material: 'Aluminium bulkhead with LOX and RP-1 outlets', mass: 130,
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

  // ------------------------------------------------------------------ feed system
  const ex = Y.mvacExit;
  const dy = MVAC.throatY - 1.18;                        // MVac kit is the Merlin 1D kit raised by this
  const dTop = domeY(R, Y.s2CommonDome, D, -1, 0), dBot = aftDomeY(0);
  const loxIn = [-0.36, ex + 2.5 + dy, 0], rpIn = [-0.61, ex + 2.45 + dy, 0];
  const feed = [
    post(0.0, 0, dBot - 0.02, dTop + 0.05, 0.16, 16),
    lathe([[0.16, dTop - 0.04], [0.34, dTop + 0.1], [0.38, dTop + 0.16]], 20),
    pipe([[0, dBot + 0.02, 0], [-0.18, dBot - 0.05, 0], [loxIn[0], loxIn[1] - 0.02, 0]], 0.08, { seg: 10, tubular: 8 }),
    post(rpIn[0], 0, rpIn[1] - 0.06, aftDomeY(0.61) + 0.03, 0.06, 10),
  ];
  const fl = P('Second stage LOX downcomer & feed lines', {
    system: 'Fuel', material: 'Aluminium and stainless lines, prevalves', mass: 90,
    desc: 'As on the first stage, LOX runs down through the middle of the RP-1 tank and out through the aft dome to the engine; RP-1 leaves through a short outlet beside it. Both lines carry prevalves.',
    explode: [0, 0, 2.4],
  }, mesh(merge(feed), FM.steelLine()));
  fl.userData.part.thermalRole = 'lox';

  // ------------------------------------------------------------------ thrust structure and Merlin Vacuum
  const gimbalY = ex + MVAC.gimbalTop;
  const ts = [thrustCone(R - 0.06, Y.s2AftSkirt - 0.32, 0.62, gimbalY + 0.1, 48), hoop(R - 0.08, 0.05, Y.s2AftSkirt - 0.32, { seg: 64, tube: 6 }), hoop(0.62, 0.05, gimbalY + 0.1, { seg: 32, tube: 6 })];
  for (let i = 0; i < 8; i++) ts.push(beam(at(R - 0.1, i * 45 + 22.5, Y.interTop + 0.06), at(0.62, i * 45 + 22.5, gimbalY + 0.08), 0.07, 0.07));
  for (const a of [45, 135, 225, 315]) ts.push(beam(at(0.62, a, gimbalY + 0.1), at(0.12, a, gimbalY - 0.02), 0.08, 0.1));
  P('Second stage thrust structure', {
    system: 'Structure', material: 'Aluminium thrust cone, struts and gimbal ring', mass: 260,
    desc: 'Carries the Merlin Vacuum\'s ≈ 981 kN from the gimbal into the aft skirt. The cone sits under the aft dome; the powerhead pokes up through its central ring.',
    explode: [0, -0.4, 0],
  }, [mesh(ts[0], FM.aluDark()), mesh(merge(ts.slice(1)), FM.aluDark())]);

  const kit = mvacKit();
  const atE = (list) => placeAll(list, 0, ex, 0, Math.PI);
  const V = (name, info, objs) => P(name, { system: 'Propulsion', ...info }, objs);
  const ch = mesh(mvacChamber(48), FM.copper()); ch.position.y = ex;
  const c1 = V('MVac thrust chamber & injector', {
    material: 'Copper-alloy liner, Inconel jacket, pintle injector', mass: 150,
    desc: 'The same chamber and pintle injector as the sea-level Merlin 1D. MVac throttles to about 39 % and relights for multi-burn missions.',
    explode: [0, -0.9, 0],
  }, ch);
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
    material: 'Niobium-alloy sheet, radiatively cooled', mass: 160,
    desc: 'The large bell expands the exhaust 165 : 1 to a ≈ 3.3 m exit, lifting Isp to 348 s. The uncooled niobium glows orange-hot in vacuum; at sea level this bell would over-expand and the flow would separate. Its length here is estimated.',
    callout: true, anchor: [-1.4, ex + 0.85, 0.35], explode: [0, -2.0, 0],
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
  V('MVac valves & TEA-TEB igniter', {
    material: 'Valves, igniter lines, TEA-TEB cartridge', mass: 25,
    desc: 'Main valves and the dual-redundant TEA-TEB ignition system: each relight uses a slug of the pyrophoric fluid, so the stage carries enough for the planned burns.',
    explode: [1.3, -1.1, 0.8],
  }, [mesh(merge(atE(kit.line)), FM.steelLine()), mesh(merge(atE(kit.valve)), FM.gold())]);
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
    desc: 'Nitrogen cold-gas thrusters control roll during the burns and all three axes while coasting and deploying the payload. Pod positions estimated.',
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
  const av = [];
  for (let i = 0; i < 6; i++) av.push(unit(1.62, 30 + i * 60, Y.s2Top - 0.25, 0.4, 0.24, 0.28));
  P('Second stage avionics', {
    system: 'Avionics', material: 'Flight computers, IMU / GPS, autonomous flight-safety system', mass: 140,
    desc: 'Guidance computers fly the closed-loop ascent and the orbital burns; the autonomous flight-safety system watches the trajectory and would terminate the flight on its own.',
    explode: [0, 1.4, 1.0],
  }, mesh(merge(av), FM.avionics()));
  P('Second stage batteries & power', {
    system: 'Power', count: 2, material: 'Lithium-ion batteries, power distribution units', mass: 80,
    desc: 'Batteries power the stage through ascent, coasts and the deorbit burn; there are no solar arrays on the second stage, which limits how long it can coast.',
    explode: [0, -0.8, -1.2],
  }, mesh(merge([40, 220].map((a) => unit(1.6, a, 47.74, 0.34, 0.22, 0.2))), FM.battery()));
  const rw = [unit(R + 0.06, 120, (Y.interTop + 0.3 + Y.fairingBase) / 2, 0.22, Y.fairingBase - Y.interTop - 0.3, 0.12)];
  P('Second stage raceway', {
    system: 'Electrical', material: 'Composite cable tray', mass: 30,
    desc: 'Cable tunnel joining the engine bay to the forward avionics.',
    explode: [0, 0, 1.4],
  }, mesh(merge(rw), FM.raceway()));
  P('Second stage telemetry antennas', {
    system: 'Communications', count: 2, material: 'S-band patch antennas', mass: 6,
    desc: 'Downlink vehicle telemetry and video to ground stations and relay satellites.',
    explode: [0, 0.6, 1.6],
  }, mesh(merge([60, 240].map((a) => unit(R + 0.02, a, 56.3, 0.16, 0.24, 0.04))), FM.raceway()));
  P('Second stage GPS antennas', {
    system: 'Communications', count: 2, material: 'GPS patch antennas', mass: 2,
    desc: 'Feed the navigation unit with GPS fixes for orbit insertion and, on missions that need it, the deorbit burn.',
    explode: [0, 0.6, 2.0],
  }, mesh(merge([150, 330].map((a) => unit(R + 0.02, a, 55.9, 0.14, 0.14, 0.03))), FM.raceway()));

  // ------------------------------------------------------------------ payload adapter and payload
  const paf = [lathe([[R - 0.1, Y.s2Top], [1.25, Y.s2Top + 0.25], [0.82, Y.pafTop - 0.06], [0.79, Y.pafTop]], 64), hoop(0.79, 0.04, Y.pafTop - 0.02, { seg: 64, tube: 6 })];
  P('Payload attach fitting', {
    system: 'Structure', material: 'Machined aluminium cone, 1,575 mm bolted interface', mass: 180,
    desc: 'Conical adapter from the 3.66 m stage to the payload interface ring. Falcon\'s standard interface is 1,575 mm; heavier payloads use a 2,624 mm adapter.',
    explode: [0, 1.6, 0],
  }, mesh(merge(paf), FM.alu()));
  const clamp = [hoop(0.8, 0.045, Y.pafTop + 0.03, { seg: 64, tube: 8 })];
  for (let i = 0; i < 8; i++) { const [x, z] = polar(0.72, i * 45); clamp.push(post(x, z, Y.pafTop - 0.25, Y.pafTop - 0.02, 0.03, 8)); }
  P('Payload clamp band & separation springs', {
    system: 'Separation', material: 'Clamp band, separation springs', mass: 40,
    desc: 'A clamp band holds the spacecraft to the adapter; when it is released, springs push the payload away at well under 1 m/s.',
    explode: [0, 2.1, 0],
  }, mesh(merge(clamp), FM.steelLine()));

  const py0 = Y.pafTop + 0.05;
  // octagonal bus (flats face ±x / ±z) with a top deck, launch-adapter ring and thruster clusters
  const busSide = lathe([[1.19, py0 + 0.1], [1.19, py0 + 5.0]], 8, Math.PI / 8);
  const deck = [lathe([[0.001, py0 + 0.1], [1.19, py0 + 0.1]], 8, Math.PI / 8), lathe([[1.19, py0 + 5.0], [0.001, py0 + 5.0]], 8, Math.PI / 8)];
  const busKit = [post(0, 0, py0 - 0.02, py0 + 0.12, 0.8, 32), post(0, 0, py0 + 5.0, py0 + 5.25, 0.45, 20), post(0, 0, py0 + 5.25, py0 + 5.6, 0.18, 16, 0.3)];
  for (const a of [45, 135, 225, 315]) for (const y of [py0 + 0.4, py0 + 4.7]) busKit.push(unit(1.12, a, y, 0.18, 0.14, 0.14));
  const pl = P('Payload: communications satellite', {
    system: 'Payload', material: 'Spacecraft bus under gold and silver multi-layer insulation', mass: 6400,
    desc: 'A representative ≈ 6.4 t geostationary communications satellite of the kind Falcon Heavy sends to transfer orbit (26.7 t is the expendable GTO limit). Thruster clusters sit at the bus corners; the feed tower on top lights the reflectors.',
    callout: true, anchor: [-1.15, 59.2, 0.6], explode: [0, 4.0, 0],
  }, [mesh(busSide, SKIN.mli()), mesh(merge(deck), SKIN.mli()), mesh(merge(busKit), M.titanium())]);
  pl.userData.part.temp = 293;
  const busIn = [post(0, 0, py0 - 0.4, py0 + 0.1, 0.18, 16, 0.08), post(0, 0, py0 + 0.6, py0 + 4.4, 0.62, 24)];
  for (const y of [py0 + 1.3, py0 + 3.7]) busIn.push(new THREE.SphereGeometry(0.42, 18, 12).translate(0.62, y, 0), new THREE.SphereGeometry(0.42, 18, 12).translate(-0.62, y, 0));
  P('Payload apogee engine & propellant tanks', {
    system: 'Propulsion', material: 'Bipropellant apogee engine, titanium tanks', mass: 2900,
    desc: 'Most of a GEO satellite\'s launch mass is propellant for raising itself from transfer orbit to geostationary orbit; the apogee engine sits inside the adapter ring.',
    explode: [0, 3.4, 2.4],
  }, mesh(merge(busIn), M.titanium()));
  P('Payload solar arrays (stowed)', {
    system: 'Power', count: 2, material: 'Folded solar array wings on hold-down points', mass: 2 * 160,
    desc: 'Folded against the bus for launch and released after separation.',
    explode: [0, 4.0, 0.9],
  }, mesh(merge([1, -1].map((s) => block(0, py0 + 2.6, s * 1.24, 2.0, 4.6, 0.26))), M.solar()));
  const refl = [];
  for (const s of [1, -1]) {
    const g = lathe([[0.001, 0], [0.6, 0.06], [1.1, 0.22], [1.25, 0.32]], 40);
    g.rotateZ((s * Math.PI) / 2);
    g.translate(s * (1.19 + 0.36), py0 + 2.8, 0);
    refl.push(g);
  }
  P('Payload antenna reflectors (stowed)', {
    system: 'Communications', count: 2, material: 'Carbon-fibre reflectors', mass: 2 * 70,
    desc: 'Deployable communications reflectors folded against the sides of the bus for launch.',
    explode: [0, 4.0, 0],
  }, mesh(merge(refl), M.offWhite()));

  // ------------------------------------------------------------------ fairing
  const prof = fairingProfile(0);
  const inner = fairingProfile(0.05).filter(([, y]) => y > Y.fairingBase + 1.3 && y < 66.5);
  for (const [grp, side, label] of [[fairA, 1, 'A'], [fairB, -1, 'B']]) {
    const phi = side > 0 ? 0 : Math.PI;
    const f = P(`Fairing half ${label}`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon-fibre skins over aluminium honeycomb', mass: 640,
      desc: 'One of the two clamshell halves (13.1 m × 5.2 m together) that protect the payload through max-Q and aerodynamic heating. Both halves are recovered and reflown.',
      callout: side > 0, anchor: [2.0, 62.2, 1.5], explode: [side * 4.0, 2.2, 0],
    }, mesh(lathe(prof, 72, phi, Math.PI), FM.fairing()), grp);
    f.userData.part.thermalRole = 'fairing';
    P(`Fairing half ${label} acoustic blankets`, {
      system: 'Skin & fairings', skin: true, material: 'Foam acoustic blankets on the inner wall', mass: 40,
      desc: 'Line the inside of the cylinder and lower ogive to soak up the roar of liftoff and transonic flight, which would otherwise shake the payload harder than the launch loads themselves.',
      explode: [side * 3.2, 2.2, 0],
    }, mesh(lathe(inner, 48, phi, Math.PI), FM.blanket()), grp);
    // recovery kit in the nose of each half: thrusters, avionics, GPS; the parafoil pack beside it
    const rk = [block(side * 1.6, 65.6, 0.8, 0.3, 0.5, 0.4), new THREE.SphereGeometry(0.22, 14, 10).translate(side * 1.3, 65.4, -0.8)];
    for (const z of [-1.1, 1.1]) rk.push(post(side * 2.25, z, 64.0, 64.3, 0.06, 8));
    P(`Fairing half ${label} recovery system`, {
      system: 'Recovery', material: 'Nitrogen thrusters and tank, GPS and avionics', mass: 60,
      desc: 'Each half flies itself back: nitrogen thrusters orient it for re-entry and its own avionics and GPS steer it to the recovery zone.',
      explode: [side * 4.6, 2.6, 0],
    }, mesh(merge(rk), FM.black()), grp);
    P(`Fairing half ${label} parafoil`, {
      system: 'Recovery', material: 'Packed steerable parafoil and drogue', mass: 45,
      desc: 'A drogue and then a steerable parafoil bring the half down gently to the sea for pick-up, after which it is cleaned and flown again.',
      explode: [side * 5.2, 3.2, 0],
    }, mesh(block(side * 1.15, 66.6, 0, 0.5, 0.9, 1.1), FM.parafoil()), grp);
    const sepGeo = [];
    for (let y = Y.fairingBase + 0.6; y < 66; y += 1.6) for (const z of [-2.55, 2.55]) {
      const zz = y < Y.fairingBase + 1.35 ? Math.sign(z) * (R + 0.2 + (y - Y.fairingBase) * 0.55) : z;
      sepGeo.push(block(side * 0.07, y, zz * 0.98, 0.07, 0.28, 0.1));
    }
    P(`Fairing half ${label} separation pushers`, {
      system: 'Separation', material: 'Pneumatic pushers and latches along the vertical seam', mass: 25,
      desc: 'A fully pneumatic system unlatches the vertical seam and pushes the halves apart about 4 minutes into flight, once aerodynamic heating on the payload has fallen to a low level — low shock for the payload and testable on the real hardware.',
      explode: [side * 4.0, 2.2, 0],
    }, mesh(merge(sepGeo), FM.aluDark()), grp);
  }
  P('Fairing base separation ring', {
    system: 'Separation', material: 'Pneumatic latch ring at the fairing base', mass: 30,
    desc: 'Holds both halves to the second stage\'s forward skirt; its latches release together with the seam latches and the ring stays with the stage.',
    explode: [0, 1.4, 0],
  }, mesh(hoop(R + 0.04, 0.05, Y.fairingBase + 0.12, { seg: 64, tube: 6 }), FM.aluDark()));
  return out;
}
