// Falcon Heavy second stage (a standard Falcon 9 upper stage with one Merlin Vacuum), the
// 13.1 m × 5.2 m composite payload fairing and a representative payload on its adapter.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, rod, beam, ogiveProfile } from '../../engine/geometry.js';
import { SKIN, M } from '../../engine/materials.js';
import { R, Y, polar } from './dims.js';
import { merge, barrel, dome, domeY, pipe, hoop, post, block, bottle, radialYaw } from './util.js';
import { MVAC, mvacChamber, mvacRegen, mvacExtension, mvacKit, placeAll, thrustCone } from './merlin.js';
import { FM, stagePaint, tankMaterial } from './materials.js';

const D = 0.7;

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

  // ------------------------------------------------------------------ tanks
  const span = [Y.interTop, Y.s2Top];
  const vOf = (y) => (y - span[0]) / (span[1] - span[0]);
  const paintMap = stagePaint('S2', { seams: [Y.s2AftSkirt, 49.8, Y.s2CommonDome, 53.2, 54.9, Y.s2LoxTop].map(vOf), soot: 0, streaks: 0, seed: 11 });
  const skin = tankMaterial(paintMap, span[1] - span[0]);
  const tb = (y0, y1) => barrel(R, y0, y1, { v0y: span[0], v1y: span[1], rings: 3 });
  const lox = P('Second stage LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195', mass: 1150,
    desc: 'Upper tank of the second stage, about 78 t of densified LOX; its forward skirt carries the avionics and the fairing.',
    explode: [0, 1.0, -4.5],
  }, [mesh(tb(Y.s2CommonDome, Y.s2Top), skin), mesh(merge([53.2, 54.9, Y.s2LoxTop, Y.s2Top - 0.05].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  lox.userData.part.thermalRole = 'lox';
  const rp = P('Second stage RP-1 tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195', mass: 700,
    desc: 'Lower tank, about 33 t of RP-1. Second-stage propellant totals ≈ 111 t, burned by one Merlin Vacuum for up to ≈ 6.5 minutes in one or more burns.',
    explode: [0, -0.6, -4.5],
  }, [mesh(tb(Y.interTop, Y.s2CommonDome), skin), mesh(merge([Y.interTop + 0.05, Y.s2AftSkirt, 49.8].map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 }))), FM.aluDark())]);
  rp.userData.part.thermalRole = 'rp1';
  const cd = P('Second stage common dome', {
    system: 'Fuel', material: 'Aluminium-lithium bulkhead', mass: 160,
    desc: 'Shared bulkhead between the second-stage LOX and RP-1 tanks, the same layout as the first stage.',
    explode: [0, 0.2, 0],
  }, mesh(dome(R - 0.01, Y.s2CommonDome, D, -1), FM.domeAlu()));
  cd.userData.part.thermalRole = 'lox';
  const domes = P('Second stage forward & aft domes', {
    system: 'Fuel', material: 'Aluminium-lithium bulkheads', mass: 260,
    desc: 'End domes of the second-stage tanks. The aft dome sits just above the Merlin Vacuum powerhead.',
    explode: [0, 0.2, 0],
  }, [mesh(dome(R - 0.01, Y.s2LoxTop, D, 1), FM.domeAlu()), mesh(dome(R - 0.01, Y.s2AftSkirt, D, -1), FM.domeAlu())]);
  domes.userData.part.thermalRole = 'lox';
  const cg = [], cs = [];
  for (const a of [90, 210, 330]) {
    const [x, z] = polar(1.0, a);
    cg.push(bottle(x, 53.9, z, 0.28, 1.4, 18));
    const [wx, wz] = polar(R - 0.02, a);
    cs.push(rod([x, 54.4, z], [wx, 54.8, wz], 0.025, 6), rod([x, 53.4, z], [wx, 53.0, wz], 0.025, 6));
  }
  const copv = P('Second stage helium COPVs', {
    system: 'Fuel', count: 3, material: 'Carbon-overwrapped pressure vessels on struts', mass: 3 * 55,
    desc: 'Three helium bottles submerged in the second-stage LOX tank. A strut holding one of them failed on CRS-7 in 2015, and a COPV liner breach caused the AMOS-6 pad loss in 2016 — both led to redesigned bottles and loading procedures.',
    explode: [0, 1.2, 2.2],
  }, [mesh(merge(cg), FM.copv()), mesh(merge(cs), FM.steelLine())]);
  copv.userData.part.thermalRole = 'lox';
  const dTop = domeY(R, Y.s2CommonDome, D, -1, 0), dBot = domeY(R, Y.s2AftSkirt, D, -1, 0);
  const feed = [
    post(0.0, 0, dBot - 0.3, dTop + 0.05, 0.16, 16),
    lathe([[0.16, dTop - 0.04], [0.34, dTop + 0.1], [0.38, dTop + 0.16]], 20),
    pipe([[0.0, dBot - 0.3, 0], [0.1, 47.05, 0], [0.36, MVAC.gimbalTop + Y.mvacExit - 0.1, 0]], 0.08, { seg: 10, tubular: 10 }),
    pipe([[0.9, domeY(R, Y.s2AftSkirt, D, -1, 0.9) + 0.03, 0.3], [0.85, 47.0, 0.3], [0.6, MVAC.gimbalTop + Y.mvacExit - 0.3, 0.15]], 0.06, { seg: 8, tubular: 10 }),
  ];
  const fl = P('Second stage LOX downcomer & feed lines', {
    system: 'Fuel', material: 'Aluminium and stainless lines, prevalves', mass: 90,
    desc: 'As on the first stage, LOX runs down through the RP-1 tank to the engine; a separate line brings RP-1 from the aft dome.',
    explode: [0, 0, 2.4],
  }, mesh(merge(feed), FM.steelLine()));
  fl.userData.part.thermalRole = 'lox';

  // ------------------------------------------------------------------ thrust structure and Merlin Vacuum
  const ex = Y.mvacExit;
  const ts = [thrustCone(R - 0.06, Y.s2AftSkirt - 0.15, 0.42, MVAC.gimbalTop + ex + 0.02, 48), hoop(R - 0.08, 0.06, Y.s2AftSkirt - 0.12, { seg: 64, tube: 6 })];
  for (let i = 0; i < 8; i++) {
    const [x, z] = polar(R - 0.1, i * 45 + 22.5), [ix, iz] = polar(0.4, i * 45 + 22.5);
    ts.push(beam([x, Y.interTop + 0.05, z], [ix, MVAC.gimbalTop + ex, iz], 0.08, 0.08));
  }
  P('Second stage thrust structure', {
    system: 'Structure', material: 'Aluminium thrust cone and struts', mass: 260,
    desc: 'Carries the Merlin Vacuum\'s ≈ 981 kN from the gimbal into the tank wall.',
    explode: [0, -0.4, 0],
  }, [mesh(ts[0], FM.aluDark()), mesh(merge(ts.slice(1)), FM.aluDark())]);

  const kit = mvacKit();
  const at = (list) => placeAll(list, 0, ex, 0, Math.PI);
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
    desc: 'The large bell expands the exhaust 165 : 1 (exit ≈ 3 m here, estimated from that ratio), lifting Isp to 348 s. The uncooled niobium glows orange-hot in vacuum; at sea level this bell would over-expand and the flow would separate.',
    callout: true, anchor: [1.45, ex + 0.6, 0.3], explode: [0, -2.0, 0],
  }, [ext, flange]);
  c3.userData.part.thermalRole = 'mvacExt';
  V('MVac turbopump', {
    material: 'Single-shaft LOX / RP-1 turbopump', mass: 120,
    desc: 'The same turbopump as the Merlin 1D, feeding the vacuum engine.',
    explode: [-1.2, -0.8, 0],
  }, mesh(merge(at(kit.pump)), FM.pump()));
  const gg = V('MVac gas generator & exhaust manifold', {
    material: 'Inconel gas generator, duct and toroidal manifold', mass: 45,
    desc: 'On MVac the turbine exhaust is not thrown overboard: a duct feeds it into a ring manifold at the top of the extension, where it film-cools the niobium wall and adds a little thrust.',
    explode: [-1.4, -1.2, 0.8],
  }, [mesh(merge(at(kit.gg)), FM.inconel()), mesh(merge(at(kit.duct)), FM.inconel())]);
  gg.userData.part.thermalRole = 'engine2';
  V('MVac TVC actuators', {
    system: 'Flight controls', count: 2, material: 'Hydraulic actuators (RP-1 working fluid)', mass: 30,
    desc: 'Gimbal the engine for pitch and yaw during the burns; roll is held by the nitrogen thrusters.',
    explode: [1.1, -0.7, 0],
  }, mesh(merge(at(kit.act)), FM.steelLine()));
  V('MVac valves & TEA-TEB igniter', {
    material: 'Valves, igniter lines, TEA-TEB cartridge', mass: 25,
    desc: 'Restart capability rests on the TEA-TEB supply: each relight uses a slug of the pyrophoric fluid, so the stage carries enough for the planned burns.',
    explode: [1.3, -1.1, 0.8],
  }, [mesh(merge(at(kit.line)), FM.steelLine()), mesh(merge(at(kit.valve)), FM.gold())]);

  // ------------------------------------------------------------------ attitude control, avionics, power
  const rcs = [], n2 = [];
  for (const a of [90, 270]) {
    const [x, z] = polar(R + 0.1, a);
    rcs.push(block(x, Y.s2AftSkirt - 0.1, z, 0.46, 0.5, 0.22, radialYaw(a)));
    for (const dt of [-0.12, 0.12]) {
      const [nx, nz] = polar(R + 0.23, a + (dt * 180) / (Math.PI * R));
      rcs.push(post(nx, nz, Y.s2AftSkirt - 0.32, Y.s2AftSkirt - 0.22, 0.03, 8), post(nx, nz, Y.s2AftSkirt + 0.02, Y.s2AftSkirt + 0.12, 0.03, 8));
    }
    const [sx, sz] = polar(1.15, a + 45);
    n2.push(new THREE.SphereGeometry(0.3, 18, 12).translate(sx, 47.55, sz));
  }
  P('Second stage cold-gas thrusters', {
    system: 'Attitude control', count: 2, material: 'Nitrogen thruster pods', mass: 50,
    desc: 'Nitrogen cold-gas thrusters control roll during the burns and all three axes while coasting and deploying the payload. Pod positions estimated.',
    explode: [0, -0.4, 1.6],
  }, mesh(merge(rcs), FM.black()));
  P('Second stage nitrogen tanks', {
    system: 'Attitude control', count: 2, material: 'Composite-overwrapped N₂ tanks', mass: 60,
    desc: 'Store the high-pressure nitrogen for the attitude thrusters; mounted on the thrust structure (placement estimated).',
    explode: [0, -1.2, 1.2],
  }, mesh(merge(n2), FM.copv()));
  const av = [];
  for (let i = 0; i < 6; i++) {
    const a = 30 + i * 60;
    const [x, z] = polar(1.5, a);
    av.push(block(x, Y.s2Top - 0.35, z, 0.42, 0.3, 0.3, radialYaw(a)));
  }
  P('Second stage avionics', {
    system: 'Avionics', material: 'Flight computers, IMU / GPS, autonomous flight-safety system', mass: 140,
    desc: 'Guidance computers fly the closed-loop ascent and the orbital burns; the autonomous flight-safety system watches the trajectory and would terminate the flight on its own.',
    explode: [0, 1.4, 1.0],
  }, mesh(merge(av), FM.avionics()));
  const pw = [];
  for (const a of [150, 330]) { const [x, z] = polar(1.45, a); pw.push(block(x, Y.s2AftSkirt - 0.2, z, 0.5, 0.3, 0.32, radialYaw(a))); }
  P('Second stage batteries & power', {
    system: 'Electrical', material: 'Lithium-ion batteries, power distribution units', mass: 80,
    desc: 'Batteries power the stage through ascent, coasts and deorbit; there are no solar arrays on the second stage.',
    explode: [0, -0.8, -1.2],
  }, mesh(merge(pw), FM.avionics()));
  const rw = [];
  const [rwx, rwz] = polar(R + 0.06, 120);
  rw.push(block(rwx, (Y.interTop + 0.3 + Y.fairingBase) / 2, rwz, 0.22, Y.fairingBase - Y.interTop - 0.3, 0.12, radialYaw(120)));
  const ant = [];
  for (const a of [60, 240]) { const [x, z] = polar(R + 0.02, a); ant.push(block(x, 56.3, z, 0.16, 0.24, 0.04, radialYaw(a))); }
  P('Second stage raceway', {
    system: 'Electrical', material: 'Composite cable tray', mass: 30,
    desc: 'Cable tunnel joining the engine bay to the forward avionics.',
    explode: [0, 0, 1.4],
  }, mesh(merge(rw), FM.raceway()));
  P('Second stage telemetry antennas', {
    system: 'Communications', count: 2, material: 'S-band patch antennas', mass: 6,
    desc: 'Downlink vehicle telemetry and video to ground stations and relay satellites.',
    explode: [0, 0.6, 1.6],
  }, mesh(merge(ant), FM.raceway()));

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
  const bus = [block(0, py0 + 2.6, 0, 2.5, 5.0, 2.2)];
  const busIn = [post(0, 0, py0 - 0.4, py0 + 0.1, 0.18, 16, 0.08), post(0, 0, py0 + 0.6, py0 + 4.4, 0.62, 24)];
  for (const y of [py0 + 1.3, py0 + 3.7]) busIn.push(new THREE.SphereGeometry(0.55, 18, 12).translate(0.62, y, 0), new THREE.SphereGeometry(0.55, 18, 12).translate(-0.62, y, 0));
  const pl = P('Payload: communications satellite', {
    system: 'Payload', material: 'Spacecraft bus under gold and silver multi-layer insulation', mass: 6400,
    desc: 'A representative ≈ 6.4 t geostationary communications satellite of the kind Falcon Heavy sends to transfer orbit (26.7 t is the expendable GTO limit).',
    callout: true, anchor: [1.3, py0 + 3.8, 1.1], explode: [0, 4.0, 0],
  }, [mesh(merge(bus), SKIN.mli())]);
  pl.userData.part.temp = 293;
  P('Payload apogee engine & propellant tanks', {
    system: 'Propulsion', material: 'Bipropellant apogee engine, titanium tanks', mass: 2900,
    desc: 'Most of a GEO satellite\'s launch mass is propellant for raising itself from transfer orbit to geostationary orbit; the apogee engine sits inside the adapter ring.',
    explode: [0, 3.4, 2.4],
  }, mesh(merge(busIn), M.titanium()));
  const arr = [];
  for (const s of [1, -1]) arr.push(block(0, py0 + 2.6, s * 1.24, 2.3, 4.6, 0.26));
  P('Payload solar arrays (stowed)', {
    system: 'Power', count: 2, material: 'Folded solar array wings on hold-down points', mass: 2 * 160,
    desc: 'Folded against the bus for launch and released after separation.',
    explode: [0, 4.0, 0.9],
  }, mesh(merge(arr), M.solar()));
  const refl = [];
  for (const s of [1, -1]) {
    const g = lathe([[0.001, 0], [0.6, 0.06], [1.1, 0.22], [1.25, 0.32]], 40);
    g.rotateZ((s * Math.PI) / 2);
    g.translate(s * (1.25 + 0.36), py0 + 2.8, 0);
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
    const shell = lathe(prof, 72, side > 0 ? 0 : Math.PI, Math.PI);
    const blanket = lathe(inner, 48, side > 0 ? 0 : Math.PI, Math.PI);
    const f = P(`Fairing half ${label}`, {
      system: 'Skin & fairings', skin: true, material: 'Carbon-fibre skins over aluminium honeycomb; acoustic blankets inside', mass: 950,
      desc: 'One of the two clamshell halves (13.1 m × 5.2 m together) that protect the payload through max-Q. Acoustic blankets line the inside to soak up the roar of liftoff. Both halves are recovered and reflown.',
      callout: side > 0, anchor: [1.8, 66.0, 1.2], explode: [side * 4.0, 2.2, 0],
    }, [mesh(shell, FM.fairing()), mesh(blanket, FM.blanket())], grp);
    f.userData.part.thermalRole = 'fairing';
    // recovery kit in the nose of each half: parafoil pack, nitrogen thrusters, avionics
    const rk = [];
    rk.push(block(side * 1.15, 66.6, 0, 0.5, 0.9, 1.1));
    rk.push(block(side * 1.6, 65.6, 0.8, 0.3, 0.5, 0.4));
    for (const z of [-1.1, 1.1]) rk.push(post(side * 2.25, z, 64.0, 64.3, 0.06, 8));
    rk.push(new THREE.SphereGeometry(0.22, 14, 10).translate(side * 1.3, 65.4, -0.8));
    P(`Fairing half ${label} recovery system`, {
      system: 'Recovery', material: 'Parafoil, nitrogen thrusters, GPS and avionics', mass: 120,
      desc: 'Each half flies itself back: nitrogen thrusters orient it for re-entry and a steerable parafoil brings it down to the sea for pick-up.',
      explode: [side * 4.6, 2.6, 0],
    }, mesh(merge(rk), FM.black()), grp);
  }
  const sepGeo = [];
  for (let y = Y.fairingBase + 0.6; y < 66; y += 1.6) for (const z of [-2.55, 2.55]) {
    const zz = y < Y.fairingBase + 1.35 ? Math.sign(z) * (R + 0.2 + (y - Y.fairingBase) * 0.55) : z;
    sepGeo.push(block(0, y, zz * 0.98, 0.12, 0.28, 0.1));
  }
  sepGeo.push(hoop(R + 0.04, 0.05, Y.fairingBase + 0.12, { seg: 64, tube: 6 }));
  P('Fairing separation system', {
    system: 'Separation', material: 'Pneumatic pushers and latches along the seam and base ring', mass: 110,
    desc: 'A fully pneumatic system unlatches the halves and pushes them apart once the air is too thin to matter, about 3½ minutes into flight — low shock for the payload and testable on the real hardware.',
    explode: [0, 2.2, 0],
  }, mesh(merge(sepGeo), FM.aluDark()), fairA);
  return out;
}
