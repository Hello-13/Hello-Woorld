// One Falcon Heavy first-stage core: the centre core (with interstage, stage-separation and
// booster-attach hardware) or a side booster (with its composite nose cone and the booster halves
// of the attach fittings). Built in the core's own frame (axis on y, y = 0 at the nozzle exit
// plane); the caller positions the group.
//
// Each core is broken into its systems the way a cutaway poster shows them: monocoque LOX tank over
// a skin-and-stringer RP-1 tank with three bulkheads; heated-helium pressurisation; the LOX
// downcomer, distribution manifold, RP-1 feed lines and prevalves; fill, drain and vent valves to
// the T-0 umbilical plate; the Octaweb with nine Merlin 1D, their TVC actuators, controllers and
// TEA-TEB supply; flight computers, navigation, flight-safety, power, wiring and antennas;
// recovery hardware (grid fins with their hydraulic power unit, legs with their pistons and
// helium bottles, nitrogen thrusters). Counts and placements that are not published are marked as
// estimates in each part's desc.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { latticePanel, loftRings, rod, beam, lathe, ogiveProfile } from '../../engine/geometry.js';
import { SKIN } from '../../engine/materials.js';
import { R, Y, ENGINE_RING, T0_Y, polar } from './dims.js';
import { merge, barrel, dome, domeY, pipe, hoop, post, block, bottle, radialYaw, perforatedDisc } from './util.js';
import { merlinBell, merlinNozzle, merlinChamber, merlinKit, placeAll } from './merlin.js';
import { FM, stagePaint, tankMaterial } from './materials.js';

const D = Y.domeDepth;
const OUTER = Array.from({ length: 8 }, (_, k) => 22.5 + k * 45);     // outer engine azimuths (deg)
const LEGS = [45, 135, 225, 315];
const tangentYaw = (a) => (-(a + 90) * Math.PI) / 180;                  // kit +x → counter-clockwise tangent
const aftDomeY = (r) => domeY(R - 0.01, Y.engSectionTop, D, -1, r);
/** [x, y, z] at radius r, azimuth a (deg), height y. */
const at = (r, a, y) => { const [x, z] = polar(r, a); return [x, y, z]; };

/** Stowed landing leg in leg frame: x tangential, y along the leg (0 → len), z radial outward. */
function legGeometry(len) {
  const rings = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = t * len;
    const w = 0.92 - 0.38 * t;                // tapers toward the foot
    const th = 0.34 - 0.1 * t;
    const ring = [];
    const M = 12;
    for (let j = 0; j < M; j++) {
      const a = (j / M) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      // flattened lens: flat-ish inner face against the stage, rounded outer fairing
      const z = cz > 0 ? cz * th : cz * 0.06;
      ring.push([cx * w * 0.5, y, z + 0.06]);
    }
    rings.push(ring);
  }
  return loftRings(rings, { capStart: true, capEnd: true });
}

/** A small box mounted at radius r, azimuth a, height y, facing outward (w tangential, d radial). */
const unit = (r, a, y, w, h, d) => { const [x, z] = polar(r, a); return block(x, y, z, w, h, d, radialYaw(a)); };

/**
 * Build one core. kind: 'centre' | 'booster'. prefix names the parts ('Centre core', 'Side booster A').
 * paint: stage paint options. explodeBase: [x, y, z] added to every part's exploded offset.
 * attachSide: +1 for the booster on +x, −1 for the one on −x (its inboard face is the other way).
 * Returns handles the vehicle uses for animation and temperatures.
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
  const inboardAz = attachSide > 0 ? 180 : 0;    // side booster face toward the centre core

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
  const frameYs = [Y.engSectionTop, 7.4, 11.2, 15.0, 21.4, 25.0, 28.6, 32.2, 35.8, Y.loxTop, Y.s1Top - 0.05];
  const frames = (y0, y1) => merge(frameYs.filter((y) => y >= y0 && y <= y1).map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 })));
  const frameMat = FM.aluDark();

  const lox = P('LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195, friction-stir welded monocoque barrel sections', mass: Math.round(4300 * k),
    desc: `Upper tank: ≈ 287 t of liquid oxygen, densified to −207 °C (66 K) so more fits in the same volume. It is a monocoque — the pressurised skin carries the load without stringers. Its forward skirt carries ${centre ? 'the interstage' : 'the forward section, grid fins and the forward attach fitting'}.`,
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
    system: 'Structure', count: 36, material: 'Aluminium-lithium stringers welded to the skin', mass: Math.round(260 * k),
    desc: 'The RP-1 tank is skin-and-stringer: longitudinal stiffeners inside the wall stop it buckling under the weight of the full LOX tank above and the thrust below, even when pressure is low. The LOX tank above is a plain monocoque. Stringer count estimated.',
    explode: [0, -0.6, -4.2],
  }, mesh(merge(str), frameMat));
  st.userData.part.thermalRole = 'rp1';
  P('engine section skin', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skin panels with thermal protection coating', mass: Math.round(450 * k),
    desc: 'Aft skirt around the Octaweb. It carries the landing-leg hinges, the T-0 umbilical plate and the aft attach fittings; the hold-down clamps grip its base on the pad.',
    explode: [0, -1.6, -6.5],
  }, mesh(tankBarrel(Y.heatShield, Y.engSectionTop), skinMat));

  // ------------------------------------------------------------------ bulkheads
  const fd = P('forward dome', {
    system: 'Fuel', material: 'Aluminium bulkhead (domes are aluminium, barrels Al-Li)', mass: Math.round(330 * k),
    desc: 'Ellipsoidal dome capping the LOX tank. The LOX vent and relief valve sits at its crown. Dome depth estimated.',
    explode: [0, 1.0, 0],
  }, mesh(dome(R - 0.01, Y.loxTop, D, 1), FM.domeAlu()));
  fd.userData.part.thermalRole = 'lox';
  const cd = P('common dome', {
    system: 'Fuel', material: 'Aluminium bulkhead', mass: Math.round(380 * k),
    desc: 'One bulkhead separates the LOX above from the RP-1 below, saving the length and mass of a separate intertank. Shown bulging into the RP-1 tank, so the weight and pressure of the LOX load it in tension; its exact curvature is not published. It must also insulate: −207 °C LOX on one side, −7 °C RP-1 on the other.',
    callout: centre, anchor: [R * 0.7, Y.commonDome - 0.4, 0.4], explode: [0, 0.4, 0],
  }, mesh(dome(R - 0.01, Y.commonDome, D, -1), FM.domeAlu()));
  cd.userData.part.thermalRole = 'lox';
  const ad = P('aft dome', {
    system: 'Fuel', material: 'Aluminium bulkhead with feed-line outlets', mass: Math.round(330 * k),
    desc: 'Closes the bottom of the RP-1 tank above the engine bay. The LOX downcomer passes through its centre and nine RP-1 outlets around it feed the engines.',
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
  const hxAz = 315;
  const [hxx, hxz] = polar(1.2, hxAz);
  const hx = P('helium heat exchanger', {
    system: 'Fuel', material: 'Stainless-steel coil heat exchanger', mass: 35,
    desc: 'Cold helium from the bottles is warmed here by engine heat before it goes back to the tank tops; warm gas fills more ullage per kilogram. Position in the engine bay estimated.',
    explode: [0, -1.0, 4.4],
  }, [mesh(block(hxx, 2.78, hxz, 0.4, 0.24, 0.28, radialYaw(hxAz)), FM.inconel()), mesh(hoop(0.11, 0.03, 2.78, { x: hxx, z: hxz, seg: 16, tube: 6 }), FM.steelLine())]);
  hx.userData.part.temp = 330;
  // helium lines: bottle → down the inside wall → heat exchanger → back up to the LOX and RP-1 ullage
  const [cx, cz] = polar(1.05, 270), [px, pz] = polar(1.7, 300), [qx, qz] = polar(1.7, 310);
  const press = [
    pipe([[cx, 36.4, cz], [px * 0.9, 35.5, pz * 0.9], [px, 30, pz], [px, Y.commonDome + 0.3, pz], [px, Y.commonDome - 0.4, pz], [px, Y.engSectionTop + 0.2, pz], [hxx * 1.12, 2.92, hxz * 1.12]], 0.035, { seg: 6, tubular: 80 }),
    pipe([[hxx * 1.12, 2.9, hxz * 1.05], [qx, Y.engSectionTop + 0.3, qz], [qx, Y.commonDome - 0.5, qz], [qx, Y.commonDome + 0.4, qz], [qx, Y.loxTop - 0.2, qz], [qx * 0.7, Y.loxTop + 0.5, qz * 0.7]], 0.03, { seg: 6, tubular: 80 }),
    pipe([[hxx, 2.9, hxz], [hxx * 0.92, aftDomeY(1.1) + 0.02, hxz * 0.92]], 0.025, { seg: 6, tubular: 6 }),          // RP-1 ullage feed
  ];
  P('pressurisation lines', {
    system: 'Fuel', material: 'Stainless steel helium lines', mass: 110,
    desc: 'Helium runs from the bottles in the LOX tank down the inside of the wall to the heat exchanger, then back up to the tops of both tanks to hold their ullage pressure as the propellant drains. Routing simplified.',
    explode: [0, 0.8, 4.0],
  }, mesh(merge(press), FM.steelLine()));

  // ------------------------------------------------------------------ propellant feed system
  const dcTop = domeY(R, Y.commonDome, D, -1, 0);
  const dcBottom = domeY(R, Y.engSectionTop, D, -1, 0);
  const downcomer = [
    post(0, 0, dcBottom - 0.4, dcTop + 0.05, 0.22, 20),
    lathe([[0.22, dcTop - 0.05], [0.45, dcTop + 0.12], [0.5, dcTop + 0.2]], 24),              // sump / anti-vortex inlet
    hoop(0.23, 0.035, 10.6, { seg: 24, tube: 6 }), hoop(0.23, 0.035, 5.6, { seg: 24, tube: 6 }), // expansion-joint flanges
  ];
  const dc = P('LOX downcomer', {
    system: 'Fuel', material: 'Aluminium alloy feed line with flexible joints', mass: 160,
    desc: 'The LOX feed line drops from the bottom of the LOX tank straight through the middle of the RP-1 tank to the engine bay — the shortest path for the denser propellant. Bellows joints let it grow and shrink with the tank.',
    callout: centre, anchor: [0.25, 12.8, 0.25], explode: [0, 0, 2.6],
  }, mesh(merge(downcomer), FM.steelLine()));
  dc.userData.part.thermalRole = 'lox';

  const loxInlet = (a) => a == null ? [0.36, 2.5, 0] : (() => { const [x, z] = polar(ENGINE_RING, a); const [tx, tz] = polar(0.36, a + 90); return [x + tx, 2.5, z + tz]; })();
  const rpInlet = (a) => a == null ? [0.61, 2.45, 0] : (() => { const [x, z] = polar(ENGINE_RING, a); const [ox, oz] = polar(0.61, a + 90); return [x + ox, 2.45, z + oz]; })();
  const man = [hoop(0.85, 0.09, 2.62, { seg: 48, tube: 10 })];                                 // LOX distribution ring
  for (const a of OUTER) {
    const [ix, iz] = polar(0.85, a);
    const [lx, , lz] = loxInlet(a);
    man.push(pipe([[ix, 2.62, iz], [(ix + lx) / 2, 2.62, (iz + lz) / 2], [lx, 2.52, lz]], 0.07, { seg: 8, tubular: 10 }));
  }
  man.push(pipe([[0, dcBottom - 0.3, 0], [0.2, 2.6, 0.2], [0.6, 2.62, 0.6]], 0.16, { seg: 12, tubular: 10 }));
  man.push(pipe([[0, dcBottom - 0.3, 0], [0.15, 2.45, 0], [0.36, 2.52, 0]], 0.08, { seg: 10, tubular: 8 }));      // to the centre engine
  const mf = P('LOX distribution manifold', {
    system: 'Fuel', material: 'Stainless steel ring manifold and feed legs', mass: 140,
    desc: 'Below the aft dome the downcomer splits into a ring that feeds the eight outer turbopumps, plus a short leg to the centre engine. Ring shape and routing estimated; the real layout is not published.',
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
    system: 'Fuel', count: 9, material: 'Aluminium and stainless lines with flex joints', mass: 120,
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
    system: 'Fuel', count: 18, material: 'Pneumatically actuated isolation valves', mass: 18 * 6,
    desc: 'One LOX and one RP-1 prevalve at each engine inlet hold the propellant above the turbopumps until start, and can isolate a shut-down engine — part of what makes engine-out survivable.',
    explode: [0, -1.4, 3.6],
  }, mesh(merge(pv), FM.gold()));
  pvp.userData.part.thermalRole = 'lox';

  // fill, drain and vent valves: ground lines enter at the T-0 plate; the vents sit at the tank tops
  const fv = [];
  const [t0x, t0z] = polar(R + 0.04, t0Az);
  fv.push(pipe([at(R - 0.05, t0Az - 8, T0_Y - 0.05), at(1.45, t0Az - 8, 2.95), at(0.98, t0Az - 4, 2.64)], 0.06, { seg: 8, tubular: 10 }));     // LOX fill / drain
  fv.push(unit(1.45, t0Az - 8, 2.95, 0.2, 0.2, 0.2));
  fv.push(pipe([at(R - 0.05, t0Az + 8, T0_Y + 0.05), at(1.5, t0Az + 8, 3.12), at(1.3, t0Az + 8, aftDomeY(1.3) + 0.04)], 0.05, { seg: 8, tubular: 10 }));  // RP-1 fill / drain
  fv.push(unit(1.52, t0Az + 8, 3.12, 0.18, 0.16, 0.18));
  fv.push(post(0, 0, Y.loxTop + D - 0.05, Y.loxTop + D + 0.25, 0.12, 12), post(0, 0, Y.loxTop + D + 0.25, Y.loxTop + D + 0.32, 0.18, 12));   // LOX vent / relief valve
  fv.push(pipe([[0.15, Y.loxTop + D + 0.28, 0], at(1.2, 15, Y.loxTop + D + 0.1), at(R - 0.06, 20, Y.loxTop + 0.55)], 0.05, { seg: 8, tubular: 12 }));
  fv.push(unit(1.68, 200, Y.commonDome - 0.25, 0.2, 0.2, 0.16), rod(at(1.68, 200, Y.commonDome - 0.25), at(R + 0.02, 200, Y.commonDome - 0.25), 0.035, 8));  // RP-1 vent
  const fvp = P('fill, drain & vent valves', {
    system: 'Fuel', count: 4, material: 'Stainless valve bodies and lines', mass: 70,
    desc: 'LOX and RP-1 fill-and-drain valves behind the T-0 plate load the tanks in the last hour of the countdown (LOX keeps topping up because it boils off); vent and relief valves at the top of each tank dump excess pressure. Line routing simplified.',
    explode: [0, 0, 4.8],
  }, mesh(merge(fv), FM.steelLine()));
  fvp.userData.part.thermalRole = 'lox';
  const t0 = [unit(R + 0.04, t0Az, T0_Y, 1.25, 0.7, 0.08)];
  for (const dy of [-0.18, 0.18]) for (const dt of [-0.4, -0.13, 0.13, 0.4]) {
    const a = t0Az + (dt * 180) / (Math.PI * R);
    t0.push(unit(R + 0.1, a, T0_Y + dy, 0.12, 0.12, 0.06));
  }
  P('T-0 umbilical plate', {
    system: 'Fuel', material: 'Quick-disconnect plate: LOX, RP-1, helium, nitrogen, power and data', mass: 45,
    desc: centre
      ? 'Where the ground lines plug into the centre core until liftoff: propellant, pressurant, purge gas, power and data through quick-disconnects that release at T-0. Shown facing the transporter-erector; the routing of the centre core\'s base umbilicals is not published.'
      : 'Where the tail service mast plugs into the side booster until liftoff: propellant, pressurant, purge gas, power and data through quick-disconnects that release at T-0, then the mast swings back under a hood.',
    explode: [t0x * 0.8, -1.0, t0z * 0.8],
  }, mesh(merge(t0), FM.aluDark()));

  // ------------------------------------------------------------------ Octaweb thrust structure
  const ow = [];
  const oct = (r, y) => Array.from({ length: 8 }, (_, i) => { const [x, z] = polar(r, i * 45); return [x, y, z]; });
  for (const [y, h] of [[1.45, 0.2], [3.05, 0.16]]) {
    const v = oct(1.7, y);
    for (let i = 0; i < 8; i++) ow.push(beam(v[i], v[(i + 1) % 8], 0.12, h));
  }
  for (const [x, , z] of oct(1.7, 0)) ow.push(beam([x, 1.45, z], [x, 3.05, z], 0.14, 0.14), beam([x, 3.05, z], [x * 1.04, 3.24, z * 1.04], 0.1, 0.1));
  for (const a of OUTER) {
    const [x, z] = polar(ENGINE_RING, a);
    const [ix, iz] = polar(0.42, a);
    ow.push(beam([ix, 2.08, iz], [x, 2.08, z], 0.12, 0.18));                // radial web to the engine mount
    for (const s of [-22.5, 22.5]) {
      const [vx, vz] = polar(1.7, a + s);
      ow.push(beam([x, 2.08, z], [vx, 2.4, vz], 0.1, 0.12));
    }
    ow.push(block(x, 2.08, z, 0.3, 0.14, 0.3));                             // gimbal mount pad
  }
  // attachment ring at the dome-to-barrel junction (the tank's Y-ring)
  ow.push(hoop(0.42, 0.07, 2.08, { seg: 24, tube: 6 }), block(0, 2.08, 0, 0.32, 0.14, 0.32), hoop(R - 0.04, 0.04, 3.3, { seg: 64, tube: 6 }));
  P('Octaweb', {
    system: 'Structure', material: 'Bolted aluminium thrust structure (Block 5)', mass: Math.round(1150 * k),
    desc: 'Octagonal thrust structure: eight Merlins on a ring around a ninth. It carries ≈ 7.6 MN of sea-level thrust into the tank wall at the aft Y-ring and makes engine-out tolerable — any one engine can shut down and the others gimbal to compensate.',
    callout: centre, anchor: [1.75, 2.6, 0.5], explode: [0, -2.2, 0],
  }, mesh(merge(ow), FM.aluDark()));

  const holes = [[0, 0, 0.37], ...OUTER.map((a) => [...polar(ENGINE_RING, a), 0.37])];
  const boots = [];
  for (const [x, z] of [[0, 0], ...OUTER.map((a) => polar(ENGINE_RING, a))]) {
    const b = lathe([[0.37, Y.heatShield - 0.05], [0.28, Y.heatShield - 0.13], [0.19, Y.throat - 0.12]], 24);
    b.translate(x, 0, z);
    boots.push(b);
  }
  // hold-down fittings at the base of the skirt (gripped by the pad clamps)
  const hold = [0, 90, 180, 270].map((a) => { const [x, z] = polar(R - 0.12, a); return block(x, Y.heatShield + 0.12, z, 0.34, 0.26, 0.34, radialYaw(a)); });
  const hs = P('heat shield & engine boots', {
    system: 'Thermal control', material: 'High-temperature composite heat shield, flexible fabric engine boots (materials not published)', mass: 520,
    desc: 'Closes the bottom of the engine bay against the radiant heat of 27 plumes and the re-entry burn. Flexible boots seal around each nozzle while it gimbals; the four hold-down fittings at its rim take the pad clamps.',
    explode: [0, -3.2, 0],
  }, [mesh(perforatedDisc(R - 0.005, holes, Y.heatShield, 0.06, 96), FM.heatShield()), mesh(merge(boots), FM.boot()), mesh(merge(hold), FM.aluDark())]);
  hs.userData.part.thermalRole = 'heatshield';

  // ------------------------------------------------------------------ Merlin 1D engines
  const engineAt = (x, z, yaw, detail = false) => {
    const kit = merlinKit({ detail });
    const put = (list) => placeAll(list, x, 0, z, yaw);
    return { pump: put([...kit.pump, ...kit.gg]), line: put([...kit.line, ...kit.valve]), duct: put(kit.duct), act: put(kit.act) };
  };
  const bellGeo = merlinBell(28);
  const engineSet = (azimuths) => {
    const g = { bells: [], pumps: [], lines: [], ducts: [], acts: [] };
    for (const a of azimuths) {
      const [x, z] = a == null ? [0, 0] : polar(ENGINE_RING, a);
      const b = bellGeo.clone(); b.translate(x, 0, z); g.bells.push(b);
      const e = engineAt(x, z, a == null ? 0 : tangentYaw(a));
      g.pumps.push(...e.pump); g.lines.push(...e.line); g.ducts.push(...e.duct); g.acts.push(...e.act);
    }
    return g;
  };
  const engMeshes = (g) => [mesh(merge(g.bells), SKIN.bell()), mesh(merge(g.pumps), FM.pump()), mesh(merge(g.lines), FM.steelLine()), mesh(merge(g.ducts), FM.inconel())];
  const ring = engineSet(OUTER);
  const engines = P('Merlin 1D engines (outer ring)', {
    system: 'Propulsion', count: 8, material: 'Copper-alloy regeneratively cooled chamber and nozzle, Inconel manifolds', mass: 8 * 470,
    desc: centre
      ? 'Eight of the centre core\'s nine engines, each 845 kN at sea level and 914 kN in vacuum. The centre core throttles them back shortly after liftoff so it still has propellant when the side boosters separate.'
      : 'Eight Merlin 1D on the Octaweb ring, 845 kN each at sea level (7.6 MN per core with the centre engine). Each has its own turbopump and gas generator; the dark pipe beside each nozzle dumps the turbine exhaust.',
    explode: [0, -4.2, 0],
  }, engMeshes(ring));
  engines.userData.part.thermalRole = centre ? 'engineC' : 'engineB';
  const acts = [...ring.acts];
  if (!centre) {
    const mid = engineSet([null]);
    acts.push(...mid.acts);
    const ce = P('Merlin 1D centre engine', {
      system: 'Propulsion', material: 'Copper-alloy regeneratively cooled chamber and nozzle', mass: 470,
      desc: 'The middle Merlin. It is one of the three that relight for the boost-back and entry burns, and it flies the final landing burn alone or with two neighbours.',
      explode: [0, -5.4, 1.2],
    }, engMeshes(mid));
    ce.userData.part.thermalRole = 'engineB';
  }
  P(centre ? 'outer-engine TVC actuators' : 'TVC actuators', {
    system: 'Flight controls', count: centre ? 16 : 18, material: 'Hydraulic actuators powered by high-pressure RP-1',
    mass: (centre ? 16 : 18) * 14,
    desc: 'Two actuators per engine gimbal the nozzle a few degrees in pitch and yaw to steer. Their working fluid is RP-1 tapped from the engine\'s own fuel pump and returned to the low-pressure side, so the first stage needs no separate hydraulic supply for steering.',
    explode: [0, -2.6, 1.4],
  }, mesh(merge(acts), FM.steelLine()));

  if (centre) {
    // the centre engine, broken out into its components
    const kit = merlinKit({ detail: true });
    const E = (name, info, objs) => P(name, { ...info, system: info.system || 'Propulsion' }, objs);
    const ch = E('Merlin 1D thrust chamber & pintle injector', {
      material: 'Copper-alloy liner, Inconel jacket', mass: 140,
      desc: 'Centre engine. RP-1 and LOX meet at a single pintle injector, which resists combustion instability, and burn at about 9.7 MPa and roughly 3,600 K. Fuel flowing through channels in the chamber wall cools it before injection.',
      explode: [0, -2.3, 4.6],
    }, mesh(merlinChamber(48), FM.copper()));
    ch.userData.part.thermalRole = 'engineC';
    const nz = E('Merlin 1D nozzle', {
      material: 'Regeneratively cooled channel-wall nozzle', mass: 110,
      desc: 'Expands the exhaust 16 : 1 to a ≈ 0.92 m exit. Sized for sea level: a bigger bell would over-expand at liftoff and the flow would separate from the wall.',
      explode: [0, -3.3, 4.6],
    }, mesh(merlinNozzle(56), SKIN.bell()));
    nz.userData.part.thermalRole = 'engineC';
    E('Merlin 1D turbopump', {
      material: 'Single shaft: LOX impeller, RP-1 impeller, turbine', mass: 120,
      desc: 'One shaft carries the LOX pump, the RP-1 pump and the turbine, spinning at about 36,000 rpm and absorbing ≈ 10,000 hp to raise the propellants to injection pressure.',
      anchor: [0.5, 1.5, 0.2], explode: [1.0, -1.9, 4.6],
    }, [mesh(merge(kit.pump), FM.pump())]);
    E('Merlin 1D gas generator', {
      material: 'Inconel combustor', mass: 18,
      desc: 'Burns a few per cent of the propellants, fuel-rich and therefore cool enough for the turbine blades, to drive the turbine. In this open cycle the turbine gas is dumped overboard instead of entering the main chamber — simpler and lighter than staged combustion, at the cost of a few seconds of Isp.',
      explode: [1.3, -2.5, 5.3],
    }, mesh(merge(kit.gg), FM.inconel()));
    const td = E('Merlin 1D turbine exhaust duct', {
      material: 'Inconel', mass: 12,
      desc: 'Carries the sooty, fuel-rich turbine exhaust out through the heat shield — the dark stream visible beside each Merlin plume.',
      explode: [1.7, -3.0, 4.6],
    }, mesh(merge(kit.duct), FM.inconel()));
    td.userData.part.thermalRole = 'engineC';
    E('Merlin 1D valves & TEA-TEB igniter', {
      material: 'Valve bodies, stainless lines', mass: 30,
      desc: 'Main oxidiser and fuel valves plus the ignition line. A slug of pyrophoric TEA-TEB, which ignites on contact with LOX, lights the gas generator and the chamber. Three engines per core can relight, for the boost-back, entry and landing burns.',
      explode: [-1.0, -1.9, 4.6],
    }, [mesh(merge(kit.line), FM.steelLine()), mesh(merge(kit.valve), FM.gold())]);
    E('Merlin 1D gimbal & TVC actuators', {
      system: 'Flight controls', count: 2, material: 'Gimbal bearing block, hydraulic actuators (RP-1 working fluid)', mass: 40,
      desc: 'The centre engine gimbals too: it is the Merlin that usually relights alone for the landing burn, so it must steer.',
      explode: [-0.8, -1.3, 5.3],
    }, mesh(merge(kit.act), FM.steelLine()));
  }

  // engine-bay equipment: TEA-TEB supply, pneumatic helium bottles, engine controllers
  const tea = [bottle(...at(1.58, 112.5, 2.62), 0.12, 0.42, 14)];
  tea.push(pipe([at(1.58, 112.5, 2.84), at(1.2, 100, 2.6), at(0.5, 60, 2.35)], 0.018, { seg: 6, tubular: 14 }));
  P('TEA-TEB ignition tank', {
    system: 'Propulsion', material: 'Stainless pressure vessel, ignition-fluid lines', mass: 25,
    desc: 'Holds the pyrophoric triethylaluminium-triethylborane that lights the engines: enough for all nine at liftoff and for the three engines that relight during recovery. Its green flash shows in the exhaust at every ignition. Tank count and position estimated.',
    explode: [0, -1.4, 4.2],
  }, mesh(merge(tea), FM.steelLine()));
  const pb = [];
  for (const a of [22.5, 202.5]) pb.push(new THREE.SphereGeometry(0.12, 16, 10).translate(...at(1.58, a, 2.7)));
  P('pneumatic helium bottles', {
    system: 'Recovery', count: 2, material: 'Composite-overwrapped high-pressure helium bottles', mass: 2 * 12,
    desc: 'Supply the high-pressure helium that deploys the landing legs and works the engine-bay pneumatic valves. Bottle count and position estimated.',
    explode: [0, -0.8, 5.0],
  }, mesh(merge(pb), FM.copv()));
  const ec = [];
  for (const a of OUTER) ec.push(unit(1.64, a + 8, 1.8, 0.16, 0.2, 0.12));
  ec.push(unit(0.55, 180, 1.7, 0.16, 0.2, 0.12));
  P('engine controllers', {
    system: 'Avionics', count: 9, material: 'Radiation-tolerant engine computers', mass: 9 * 4,
    desc: 'Each Merlin has its own controller running start-up, throttle and shutdown sequences and reporting health to the flight computers, which can shut an engine down and re-plan around it. Positions estimated.',
    explode: [0, -1.8, 2.0],
  }, mesh(merge(ec), FM.avionics()));

  // ------------------------------------------------------------------ forward structure
  let finY;
  if (centre) {
    const inter = P('interstage', {
      system: 'Separation', skin: true, material: 'Carbon-fibre / aluminium-honeycomb sandwich; black thermal layer painted white-grey on Falcon Heavy centre cores', mass: 2100,
      desc: 'Composite shroud between the stages (6.6 m long here; length estimated). It covers the Merlin Vacuum nozzle, carries the grid fins and cold-gas thrusters, and stays with the centre core at separation. On Falcon Heavy centre cores its black thermal layer is painted over in white-grey behind the Falcon Heavy logo.',
      explode: [0, 2.0, 0],
    }, [mesh(barrel(R, Y.s1Top, Y.interTop, { rings: 3 }), FM.interstageWhite()), mesh(barrel(R - 0.03, Y.s1Top, Y.interTop), FM.compositeInner())]);
    inter.userData.part.thermalRole = 'ambient';
    const sep = [];
    for (const a of [0, 120, 240]) {
      // collets: a ring of fingers closed over a groove on the second stage's aft ring
      sep.push(unit(R - 0.12, a, Y.interTop - 0.18, 0.3, 0.36, 0.16), unit(R - 0.05, a, Y.interTop - 0.02, 0.22, 0.06, 0.08));
    }
    for (const a of [60, 180, 300]) {
      const [x, z] = polar(R - 0.2, a);
      sep.push(post(x, z, Y.interTop - 0.55, Y.interTop - 0.02, 0.07, 12), post(x, z, Y.interTop - 0.75, Y.interTop - 0.55, 0.11, 12));
    }
    sep.push(hoop(R - 0.06, 0.05, Y.interTop - 0.05, { seg: 96, tube: 6 }));
    P('stage-separation collets & pushers', {
      system: 'Separation', count: 3, material: 'Reusable separation collets, pneumatic pushers, separation ring', mass: 180,
      desc: 'Three collets — reduced from twelve attachment points on the original Falcon 9 — hold the second stage on the interstage ring. At separation they open and pneumatic pushers drive the stages apart: no explosives, so the system can be tested on the actual flight hardware. Pusher count not published; three shown.',
      explode: [0, 2.9, 0],
    }, mesh(merge(sep), FM.aluDark()));
    finY = Y.interTop - 0.45;
  } else {
    const fsec = P('forward section', {
      system: 'Structure', skin: true, material: 'Carbon composite, black thermal paint', mass: 420,
      desc: 'Short composite section above the LOX tank, in the black interstage finish. It carries the grid fins, cold-gas thrusters, the booster half of the forward attach fitting and the nose cone. Length (2 m) estimated.',
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
  const finGeo = latticePanel(1.22, 1.52, 0.115, 0.014, 0.12, 0.05);
  finGeo.translate(0, -0.76 - 0.05, 0);
  const finGroup = [];
  const finActs = [];
  for (const a of LEGS) {
    const hinge = new THREE.Group();
    const [x, z] = polar(R + 0.2, a);
    hinge.position.set(x, finY, z);
    hinge.rotation.y = radialYaw(a);
    const m = mesh(finGeo, FM.titanium());
    hinge.add(m);
    finGroup.push(hinge);
    out.fins.push(m);
    finActs.push(unit(R + 0.12, a, finY + 0.16, 0.62, 0.36, 0.24));
    finActs.push(rod(at(R - 0.25, a, finY + 0.1), at(R + 0.12, a, finY + 0.1), 0.06, 8));
  }
  const gf = P('grid fins', {
    system: 'Recovery', count: 4, material: 'Cast and machined titanium', mass: 4 * 180,
    desc: 'Stowed flat for ascent, the four lattice fins swing out moments after separation and steer the falling stage through re-entry. Block 5 fins are titanium, about 1.2 × 1.5 m, and survive re-entry heating without an ablative coating.',
    callout: centre, anchor: at(R + 0.3, 45, finY + 0.15), explode: [0, 2.4, 0],
  }, finGroup);
  gf.userData.part.thermalRole = 'ambient';
  P('grid-fin actuators', {
    system: 'Hydraulics', count: 4, material: 'Closed-loop hydraulic actuators in aerodynamic housings', mass: 4 * 35,
    desc: 'Each fin rotates on a hydraulic actuator in a housing at its root. Block 5 uses a closed-loop hydraulic system; early Falcon 9 grid fins vented their hydraulic fluid overboard and could run out.',
    explode: [0, 2.7, 0],
  }, mesh(merge(finActs), FM.black()));
  // the unit sits 20° off the outboard side on a side booster (mirrored between A and B), clear of
  // the inboard attach fitting, the 90° / 270° thruster pods and the fin roots
  const hpuAz = !centre && attachSide > 0 ? 340 : 200, hpuY = centre ? 46.2 : 42.35, ringY = finY - 0.35;
  const [hux, huz] = polar(1.42, hpuAz);
  const hpu = [
    post(hux, huz, hpuY - 0.2, hpuY + 0.2, 0.11, 14),                                         // motor-pump
    bottle(...at(1.45, hpuAz + 14, hpuY), 0.1, 0.42, 12),                                      // reservoir
    new THREE.SphereGeometry(0.11, 14, 10).translate(...at(1.45, hpuAz - 14, hpuY + 0.05)),    // accumulator
    unit(R - 0.06, hpuAz, hpuY, 0.62, 0.1, 0.04),                                              // mounting plate
    hoop(1.68, 0.02, ringY, { seg: 72, tube: 4 }),                                             // pressure / return lines
    pipe([[hux, hpuY + 0.2, huz], at(1.62, hpuAz, ringY + 0.1), at(1.68, hpuAz, ringY)], 0.025, { seg: 6, tubular: 8 }),
  ];
  for (const a of LEGS) hpu.push(pipe([at(1.68, a, ringY), at(1.66, a, finY - 0.05), at(R - 0.25, a, finY + 0.1)], 0.022, { seg: 6, tubular: 8 }));
  P('grid-fin hydraulic power unit', {
    system: 'Hydraulics', material: 'Electric motor-pump, reservoir, accumulator and lines', mass: 55,
    desc: 'Block 5\'s closed-loop hydraulics: a motor-driven pump, a reservoir that takes the returned fluid and an accumulator for peak demand, with lines around the inside of the skin to the four fin actuators. Unit layout estimated.',
    explode: [0, 2.6, 1.6],
  }, mesh(merge(hpu), FM.steelLine()));

  // ------------------------------------------------------------------ landing legs (stowed)
  const legLen = 9.2;
  const legGeo = legGeometry(legLen);
  const legGeos = [], footGeos = [], pistonGeos = [];
  for (const a of LEGS) {
    const g = legGeo.clone();
    g.rotateY(radialYaw(a));
    const [x, z] = polar(R + 0.01, a);
    g.translate(x, 1.35, z);
    legGeos.push(g);
    footGeos.push(unit(R + 0.3, a, 1.35 + legLen - 0.15, 0.6, 0.3, 0.32));
    footGeos.push(unit(R + 0.1, a, 1.5, 0.7, 0.3, 0.3));                       // hinge fitting
    const [px, pz] = polar(R + 0.13, a);
    pistonGeos.push(rod([px, 1.75, pz], [px, 8.0, pz], 0.075, 10), rod([px, 8.0, pz], [px, 9.8, pz], 0.05, 8));
  }
  const legs = P('landing legs', {
    system: 'Recovery', count: 4, material: 'Carbon fibre with aluminium honeycomb', mass: 4 * 520,
    desc: 'Folded against the skirt for ascent; in the last seconds of the landing burn they swing down to a stance about 18 m across. Block 5 legs can be stowed again after landing, speeding turnaround.',
    callout: !centre && attachSide > 0, anchor: [polar(R + 0.35, 45)[0], 8.0, polar(R + 0.35, 45)[1]], explode: [0, -1.6, 0],
  }, [mesh(merge(legGeos), FM.legCarbon()), mesh(merge(footGeos), FM.black())]);
  legs.userData.part.thermalRole = 'ambient';
  P('leg deployment pistons', {
    system: 'Recovery', count: 4, material: 'Telescoping pneumatic pistons (high-pressure helium)', mass: 4 * 45,
    desc: 'A telescoping piston inside each leg pushes it out and down with high-pressure helium from the engine-bay bottles, then acts as the strut the stage lands on.',
    explode: [0, -1.6, 1.0],
  }, mesh(merge(pistonGeos), FM.steelLine()));

  // ------------------------------------------------------------------ attitude control
  const cgY = centre ? 44.5 : Y.s1Top + 1.0;
  const cg = [], n2 = [], n2l = [];
  const n2Y = 42.3;
  for (const a of [90, 270]) {
    cg.push(unit(R + 0.12, a, cgY, 0.5, 0.62, 0.26));
    for (const dy of [-0.18, 0.18]) for (const dt of [-0.14, 0.14]) {
      const [nx, nz] = polar(R + 0.27, a + (dt * 180) / (Math.PI * R));
      cg.push(post(nx, nz, cgY + dy - 0.05, cgY + dy + 0.05, 0.035, 8));
    }
    n2.push(new THREE.SphereGeometry(0.33, 18, 12).translate(...at(1.2, a + 10, n2Y)));
    n2l.push(pipe([at(1.2, a + 10, n2Y + 0.3), at(1.55, a + 4, (n2Y + cgY) / 2 + 0.2), at(R - 0.04, a, cgY)], 0.022, { seg: 6, tubular: 12 }));
  }
  P('cold-gas thrusters', {
    system: 'Attitude control', count: 2, material: 'Nitrogen thruster pods (four nozzles each)', mass: 2 * 40,
    desc: 'Pods of nitrogen cold-gas thrusters flip the stage after separation and hold its attitude outside the atmosphere, where the grid fins have no air to work with.',
    explode: [0, 2.0, 1.2],
  }, mesh(merge(cg), FM.black()));
  P('nitrogen tanks', {
    system: 'Attitude control', count: 2, material: 'Composite-overwrapped N₂ tanks and feed lines', mass: 2 * 40,
    desc: 'High-pressure nitrogen for the thrusters, fed through regulators to each pod. Placement estimated.',
    explode: [0, 2.6, 2.0],
  }, [mesh(merge(n2), FM.copv()), mesh(merge(n2l), FM.steelLine())]);

  // ------------------------------------------------------------------ avionics, power, wiring, antennas
  const fwdY = Y.s1Top + 0.22;
  const rw = [];
  // midway between the 45° and 135° legs (clear of the stowed legs' roots); its foot stops above the
  // pad hold-down clamps. Azimuth estimated.
  const rwA = 90, rwBottom = Y.heatShield + 0.95;
  rw.push(unit(R + 0.07, rwA, (rwBottom + Y.s1Top) / 2, 0.26, Y.s1Top - rwBottom, 0.14));
  for (let y = 2.5; y < Y.s1Top; y += 2.4) rw.push(unit(R + 0.04, rwA, y, 0.36, 0.08, 0.1));
  P('raceway', {
    system: 'Electrical', material: 'Composite cable tray cover', mass: 140,
    desc: 'External tunnel that carries power, data and flight-safety cables up the outside of the tanks between the engine bay and the forward avionics, so no wiring has to pass through the propellant. Shown midway between two landing legs; its exact azimuth on each core is estimated.',
    callout: !centre && attachSide > 0, anchor: at(R + 0.16, rwA, 30.0), explode: [0, 0, 1.6],
  }, mesh(merge(rw), FM.raceway()));
  const wh = [
    hoop(1.6, 0.025, Y.s1Top + 0.04, { seg: 64, tube: 4 }), hoop(1.66, 0.025, 2.9, { seg: 64, tube: 4 }),
    pipe([at(R + 0.06, rwA, Y.s1Top - 0.25), at(R - 0.05, rwA, Y.s1Top - 0.05), at(1.6, rwA, Y.s1Top + 0.04)], 0.03, { seg: 6, tubular: 8 }),
    pipe([at(R + 0.06, rwA, rwBottom + 0.1), at(R - 0.02, rwA, 2.6), at(1.7, rwA + 6, 2.75), at(1.66, rwA + 12, 2.9)], 0.03, { seg: 6, tubular: 10 }),   // past the Octaweb post
  ];
  for (const a of OUTER) wh.push(pipe([at(1.66, a + 8, 2.9), at(1.64, a + 8, 1.9)], 0.015, { seg: 4, tubular: 4 }));
  for (const a of [15, 75, 135, 195, 255, 315]) wh.push(pipe([at(1.6, a, Y.s1Top + 0.04), at(1.52, a, fwdY - 0.1)], 0.015, { seg: 4, tubular: 4 }));
  P('wiring harnesses', {
    system: 'Electrical', material: 'Shielded cable bundles', mass: 180,
    desc: 'Cable bundles leave the raceway through the skin at both ends: a ring in the forward skirt ties the computers, navigation, flight-safety and power units together, and a ring in the engine bay drops a harness to each engine controller. Routing simplified.',
    explode: [0, 0, 2.0],
  }, mesh(merge(wh), FM.cable()));
  P('flight computers', {
    system: 'Avionics', count: 3, material: 'Triple-redundant flight computers', mass: 3 * 12,
    desc: 'Three computers fly the stage and vote on every decision, so one can fail without consequence. On a side booster they also guide the boost-back, entry and landing on their own.',
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
  const antY = centre ? 44.5 : Y.s1Top + 1.6;
  const antAz = centre ? [30, 210] : [73, 253];
  const ant = [];
  for (const a of antAz) ant.push(unit(R + 0.02, a, antY, 0.16, 0.24, 0.04), unit(R + 0.02, a, antY + 0.4, 0.12, 0.12, 0.03));
  P('telemetry & GPS antennas', {
    system: 'Communications', count: 4, material: 'S-band telemetry patches and GPS patch antennas', mass: 4 * 1.5,
    desc: 'Flush antennas send telemetry and video to the ground and pick up GPS for navigation. Positions estimated.',
    explode: [0, 1.0, 1.8],
  }, mesh(merge(ant), FM.raceway()));

  // ------------------------------------------------------------------ booster attach hardware
  const fwdAttachY = 42.0, aftAttachY = 2.75;
  if (centre) {
    const gap0 = R, gap1 = 4.27 - R;                       // centre-core skin → side-booster skin
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
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher mechanisms', mass: 260,
        desc: `Forward attach on the centre core's reinforced interstage base, tied to the forward section of side booster ${label} (the boosters are joined at their forward sections and at the Octawebs). It holds through ascent, then releases and its pneumatic pushers shove the booster away after its engines shut down. Two mechanisms shown; the exact count and layout are not published.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(f), FM.aluDark()));
      P(`aft attach & pushers (${label})`, {
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher mechanisms', mass: 240,
        desc: `Aft attach between the engine sections at Octaweb level; its pushers shove the base of side booster ${label} sideways so it clears the centre core. Pneumatic devices give a low-shock release over a long stroke. Layout simplified.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(a), FM.aluDark()));
    }
  } else {
    // the booster halves of the attach fittings: they leave with the booster at separation
    const xin = -attachSide;                                 // inboard direction in this booster's frame
    for (const [name, y, h] of [['forward attach fitting', fwdAttachY, 0.6], ['aft attach fitting', aftAttachY, 0.55]]) {
      const g = [];
      for (const dz of [-0.42, 0.42]) g.push(block(xin * (R + 0.06), y, dz, 0.16, h, 0.36), block(xin * (R - 0.08), y, dz, 0.14, h + 0.2, 0.3));
      g.push(beam([xin * (R - 0.12), y + h / 2 + 0.05, -0.42], [xin * (R - 0.12), y + h / 2 + 0.05, 0.42], 0.1, 0.14));
      P(name, {
        system: 'Separation', count: 2, material: 'Titanium receiving fittings bolted to an internal ring frame', mass: 90,
        desc: `The side booster's half of the ${name.split(' ')[0]} attachment: the receptacles the centre core's struts and pushers bear on. They release and leave with the booster at separation. Layout simplified.`,
        explode: [xin * 1.0, 0, 0.8],
      }, mesh(merge(g), FM.aluDark()));
    }
  }
  return out;
}
