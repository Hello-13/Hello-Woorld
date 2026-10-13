// One Falcon Heavy first-stage core: the centre core (with interstage, stage-separation and
// booster-attach hardware) or a side booster (with its composite nose cone). Built in the core's
// own frame (axis on y, y = 0 at the nozzle exit plane); the caller positions the group.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { latticePanel, loftRings, rod, beam, lathe, ogiveProfile } from '../../engine/geometry.js';
import { SKIN } from '../../engine/materials.js';
import { R, Y, ENGINE_RING, polar } from './dims.js';
import { merge, barrel, dome, domeY, pipe, hoop, post, block, bottle, radialYaw, perforatedDisc } from './util.js';
import { merlinBell, merlinNozzle, merlinChamber, merlinKit, placeAll } from './merlin.js';
import { FM, stagePaint, tankMaterial } from './materials.js';

const D = Y.domeDepth;
const OUTER = Array.from({ length: 8 }, (_, k) => 22.5 + k * 45);     // outer engine azimuths (deg)
const LEGS = [45, 135, 225, 315];
const tangentYaw = (a) => (-(a + 90) * Math.PI) / 180;                  // kit +x → counter-clockwise tangent

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

/**
 * Build one core. kind: 'centre' | 'booster'. prefix names the parts ('Centre core', 'Side booster A').
 * paint: stage paint options. explodeBase: [x, y, z] added to every part's exploded offset.
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

  // ------------------------------------------------------------------ paint and tank skins
  const span = [Y.heatShield, Y.s1Top];
  const vOf = (y) => (y - span[0]) / (span[1] - span[0]);
  const seams = [Y.engSectionTop, 7.4, 11.2, 15.0, Y.commonDome, 20.4, 24.2, 28.0, 31.8, 35.6, Y.loxTop].map(vOf);
  const paintMap = stagePaint(`${prefix}`, {
    seams, soot: paint.soot ?? 0.12, streaks: paint.streaks ?? 20, seed: paint.seed ?? 5,
    word: { text: 'SPACEX', v0: vOf(19.5), v1: vOf(29.5), u: 0.583, size: 90 },
  });
  const skinMat = tankMaterial(paintMap, span[1] - span[0]);
  const tankBarrel = (y0, y1) => barrel(R, y0, y1, { v0y: span[0], v1y: span[1], rings: Math.max(2, Math.round((y1 - y0) / 4)) });
  // internal ring frames at the barrel-section welds (they also give Blueprint its station lines)
  const frameYs = [Y.engSectionTop, 7.4, 11.2, 15.0, 20.4, 24.2, 28.0, 31.8, 35.6, Y.loxTop, Y.s1Top - 0.05];
  const frames = (y0, y1) => merge(frameYs.filter((y) => y >= y0 && y <= y1).map((y) => hoop(R - 0.035, 0.03, y, { seg: 72, tube: 4 })));
  const frameMat = FM.aluDark();

  const lox = P('LOX tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195, friction-stir welded barrel sections', mass: Math.round(4300 * k),
    desc: `Upper tank: about 278 t of liquid oxygen, densified to −207 °C (66 K) so more fits in the same volume. Its forward skirt carries the ${centre ? 'interstage and the forward booster attach fittings' : 'forward section, grid fins and the forward attach fitting'}.`,
    explode: [0, 1.2, -6.5],
  }, [mesh(tankBarrel(Y.commonDome, Y.s1Top), skinMat), mesh(frames(Y.commonDome + 0.1, Y.s1Top), frameMat)]);
  lox.userData.part.thermalRole = 'lox';
  const rp1 = P('RP-1 tank', {
    system: 'Fuel', skin: true, material: 'Aluminium-lithium 2195', mass: Math.round(2500 * k),
    desc: 'Lower tank: about 118 t of RP-1, a refined kerosene, chilled to about −7 °C. The LOX downcomer runs down its centre to the engines.',
    explode: [0, -0.6, -6.5],
  }, [mesh(tankBarrel(Y.engSectionTop, Y.commonDome), skinMat), mesh(frames(Y.engSectionTop, Y.commonDome), frameMat)]);
  rp1.userData.part.thermalRole = 'rp1';
  P('engine section skin', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium skin panels with thermal protection coating', mass: Math.round(450 * k),
    desc: 'Aft skirt around the Octaweb. It carries the landing-leg hinges and, on the centre core, the aft booster attach fittings; the hold-down clamps grip its base on the pad.',
    explode: [0, -1.6, -6.5],
  }, mesh(tankBarrel(Y.heatShield, Y.engSectionTop), skinMat));

  // ------------------------------------------------------------------ bulkheads
  const fwd = dome(R - 0.01, Y.loxTop, D, 1);
  const common = dome(R - 0.01, Y.commonDome, D, -1);
  const aft = dome(R - 0.01, Y.engSectionTop, D, -1);
  if (centre) {
    const cd = P('common dome', {
      system: 'Fuel', material: 'Aluminium-lithium 2195 bulkhead', mass: 380,
      desc: 'One bulkhead separates the LOX above from the RP-1 below, saving the length and mass of a separate intertank. It bulges down into the RP-1 tank because the LOX side carries the greater pressure head.',
      callout: true, anchor: [R * 0.7, Y.commonDome - 0.4, 0.4], explode: [0, 0.4, 0],
    }, mesh(common, FM.domeAlu()));
    cd.userData.part.thermalRole = 'lox';
    const fa = P('forward & aft domes', {
      system: 'Fuel', material: 'Aluminium-lithium 2195 bulkheads', mass: 640,
      desc: 'Ellipsoidal end domes of the propellant tanks. The forward dome caps the LOX tank under the interstage; the aft dome closes the RP-1 tank above the engine bay.',
      explode: [0, 0.4, 0],
    }, [mesh(fwd, FM.domeAlu()), mesh(aft, FM.domeAlu())]);
    fa.userData.part.thermalRole = 'lox';
  } else {
    const d = P('tank domes', {
      system: 'Fuel', material: 'Aluminium-lithium 2195 bulkheads', mass: 980,
      desc: 'Forward LOX dome, LOX/RP-1 common dome and aft RP-1 dome. The common dome bulges into the RP-1 tank.',
      explode: [0, 0.4, 0],
    }, [mesh(fwd, FM.domeAlu()), mesh(common, FM.domeAlu()), mesh(aft, FM.domeAlu())]);
    d.userData.part.thermalRole = 'lox';
  }

  // ------------------------------------------------------------------ pressurant and feed system
  const copvGeo = [], strutGeo = [];
  for (const a of [30, 150, 270]) {
    const [x, z] = polar(1.05, a);
    copvGeo.push(bottle(x, 37.2, z, 0.3, 1.7, 20));
    const [wx, wz] = polar(R - 0.02, a);
    strutGeo.push(rod([x, 37.9, z], [wx, 38.4, wz], 0.03, 6), rod([x, 36.5, z], [wx, 36.0, wz], 0.03, 6));
  }
  const copv = P('helium COPVs', {
    system: 'Fuel', count: 3, material: 'Carbon-overwrapped aluminium-liner pressure vessels, struts', mass: 3 * 70,
    desc: 'Composite-overwrapped bottles of high-pressure helium submerged in the LOX, where the cold packs more gas into each bottle. Helium keeps the tanks pressurised as propellant drains. The first-stage bottle count and layout are not published; three are shown.',
    callout: centre, anchor: [1.05, 38.2, 0.4], explode: [0, 1.6, 2.2],
  }, [mesh(merge(copvGeo), FM.copv()), mesh(merge(strutGeo), FM.steelLine())]);
  copv.userData.part.thermalRole = 'lox';

  const dcTop = domeY(R, Y.commonDome, D, -1, 0);
  const dcBottom = domeY(R, Y.engSectionTop, D, -1, 0);
  const downcomer = [
    post(0, 0, dcBottom - 0.4, dcTop + 0.05, 0.22, 20),
    lathe([[0.22, dcTop - 0.05], [0.45, dcTop + 0.12], [0.5, dcTop + 0.2]], 24),              // sump / anti-vortex inlet
    hoop(0.23, 0.035, 9.6, { seg: 24, tube: 6 }), hoop(0.23, 0.035, 5.0, { seg: 24, tube: 6 }), // expansion-joint flanges
  ];
  const feedGeo = [hoop(0.85, 0.09, 2.62, { seg: 48, tube: 10 })];                            // LOX distribution ring
  for (const a of OUTER) {
    const [x, z] = polar(ENGINE_RING, a);
    const [tx, tz] = polar(0.36, a + 90);
    const [ix, iz] = polar(0.85, a);
    feedGeo.push(pipe([[ix, 2.62, iz], [(ix + x + tx) / 2, 2.62, (iz + z + tz) / 2], [x + tx, 2.5, z + tz]], 0.07, { seg: 8, tubular: 10 }));
    // RP-1 from the aft-dome outlets to each fuel-pump inlet
    const [fx, fz] = polar(1.05, a + 6);
    const [ox, oz] = polar(0.61, a + 90);
    feedGeo.push(pipe([[fx, domeY(R, Y.engSectionTop, D, -1, 1.05) + 0.05, fz], [x + ox * 0.8, 2.75, z + oz * 0.8], [x + ox, 2.45, z + oz]], 0.06, { seg: 8, tubular: 10 }));
  }
  feedGeo.push(pipe([[0, dcBottom - 0.3, 0], [0.2, 2.7, 0.2], [0.6, 2.62, 0.6]], 0.16, { seg: 12, tubular: 10 }));
  feedGeo.push(pipe([[0, dcBottom - 0.3, 0], [0.15, 2.45, 0], [0.36, 2.5, 0]], 0.08, { seg: 10, tubular: 8 }));      // to the centre engine
  if (centre) {
    const dc = P('LOX downcomer', {
      system: 'Fuel', material: 'Aluminium alloy feed line with flexible joints', mass: 160,
      desc: 'The LOX feed line drops from the bottom of the LOX tank straight through the middle of the RP-1 tank to the engine bay — the shortest path for the denser propellant.',
      callout: true, anchor: [0.25, 10, 0.25], explode: [0, 0, 2.6],
    }, mesh(merge(downcomer), FM.steelLine()));
    dc.userData.part.thermalRole = 'lox';
    P('engine feed manifolds', {
      system: 'Fuel', material: 'Stainless steel and aluminium lines, prevalves', mass: 420,
      desc: 'Below the aft dome a LOX distribution ring and nine RP-1 lines split the flow to the nine turbopump inlets, each behind a prevalve.',
      explode: [0, -1.2, 2.6],
    }, mesh(merge(feedGeo), FM.steelLine()));
    // helium pressurisation and vent lines along the inside of the tank wall
    const [hx, hz] = polar(1.7, 200), [rx, rz] = polar(1.7, 210), [cx, cz] = polar(1.05, 270);
    const press = [
      pipe([[cx, 36.4, cz], [hx * 0.9, 35.5, hz * 0.9], [hx, 30, hz], [hx, Y.commonDome + 0.3, hz], [hx, Y.commonDome - 0.4, hz], [hx, Y.engSectionTop + 0.2, hz], [hx * 0.85, 2.9, hz * 0.85]], 0.035, { seg: 6, tubular: 80 }),
      pipe([[rx * 0.85, 2.9, rz * 0.85], [rx, Y.engSectionTop + 0.3, rz], [rx, Y.commonDome - 0.5, rz], [rx, Y.commonDome + 0.4, rz], [rx, Y.loxTop - 0.2, rz], [rx * 0.7, Y.loxTop + 0.5, rz * 0.7]], 0.03, { seg: 6, tubular: 80 }),
      post(0, 0, Y.loxTop + D - 0.05, Y.loxTop + D + 0.25, 0.12, 12),                        // LOX vent / relief valve
      block(polar(1.4, 200)[0], Y.commonDome + 0.5, polar(1.4, 200)[1], 0.2, 0.2, 0.2),        // RP-1 vent
      block(polar(1.25, 330)[0], 2.95, polar(1.25, 330)[1], 0.5, 0.28, 0.3),                    // helium heat exchanger
    ];
    P('pressurisation & vent lines', {
      system: 'Fuel', material: 'Stainless steel lines, vent and relief valves', mass: 140,
      desc: 'Cold helium from the bottles is warmed in a heat exchanger in the engine bay, then fed back to the tank tops to hold ullage pressure; vent and relief valves on the domes dump boil-off on the pad.',
      explode: [0, 0.8, 4.0],
    }, mesh(merge(press), FM.steelLine()));
  } else {
    const dc = P('LOX downcomer & feed lines', {
      system: 'Fuel', material: 'Aluminium and stainless steel feed lines, prevalves', mass: 560,
      desc: 'LOX drops through the centre of the RP-1 tank to a distribution ring in the engine bay; RP-1 leaves the aft dome through nine lines to the turbopumps.',
      explode: [0, -0.4, 2.6],
    }, [mesh(merge(downcomer), FM.steelLine()), mesh(merge(feedGeo), FM.steelLine())]);
    dc.userData.part.thermalRole = 'lox';
  }

  // ------------------------------------------------------------------ Octaweb thrust structure
  const ow = [];
  const oct = (r, y) => Array.from({ length: 8 }, (_, i) => { const [x, z] = polar(r, i * 45); return [x, y, z]; });
  for (const y of [1.45, 3.45]) {
    const v = oct(1.7, y);
    for (let i = 0; i < 8; i++) ow.push(beam(v[i], v[(i + 1) % 8], 0.12, 0.2));
  }
  for (const [x, , z] of oct(1.7, 0)) ow.push(beam([x, 1.45, z], [x, 3.45, z], 0.14, 0.14));
  for (const a of OUTER) {
    const [x, z] = polar(ENGINE_RING, a);
    const [cx, cz] = polar(0.42, a);
    ow.push(beam([cx, 2.08, cz], [x, 2.08, z], 0.12, 0.18));                // radial web to the engine mount
    for (const s of [-22.5, 22.5]) {
      const [vx, vz] = polar(1.7, a + s);
      ow.push(beam([x, 2.08, z], [vx, 2.4, vz], 0.1, 0.12));
    }
    ow.push(block(x, 2.08, z, 0.3, 0.14, 0.3));                             // gimbal mount pad
    ow.push(beam([x, 2.1, z], [x * 1.12, 3.4, z * 1.12], 0.08, 0.08));       // thrust post to the upper ring
  }
  ow.push(hoop(0.42, 0.07, 2.08, { seg: 24, tube: 6 }), block(0, 2.08, 0, 0.32, 0.14, 0.32), hoop(1.76, 0.06, 3.5, { seg: 64, tube: 6 }));
  P('Octaweb', {
    system: 'Structure', material: 'Bolted aluminium thrust structure (Block 5)', mass: Math.round(1150 * k),
    desc: 'Octagonal thrust structure: eight Merlins on a ring around a ninth. It carries ≈ 7.6 MN of sea-level thrust into the tank walls and makes engine-out tolerable — any one engine can shut down and the others gimbal to compensate.',
    callout: centre, anchor: [1.7, 2.6, 0.4], explode: [0, -2.2, 0],
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
    system: 'Thermal control', material: 'Ablative-coated heat shield, flexible high-temperature fabric boots', mass: 520,
    desc: 'Closes the bottom of the engine bay against the radiant heat of 27 plumes and the re-entry burn. Flexible boots seal around each nozzle while it gimbals.',
    explode: [0, -3.2, 0],
  }, [mesh(perforatedDisc(R - 0.005, holes, Y.heatShield, 0.06, 96), FM.heatShield()), mesh(merge(boots), FM.boot()), mesh(merge(hold), FM.aluDark())]);
  hs.userData.part.thermalRole = 'heatshield';

  // ------------------------------------------------------------------ Merlin 1D engines
  const engineAt = (x, z, yaw, detail = false) => {
    const kit = merlinKit({ detail });
    const put = (list) => placeAll(list, x, 0, z, yaw);
    return { pump: put([...kit.pump, ...kit.gg]), line: put([...kit.line, ...kit.valve]), duct: put(kit.duct), act: put(kit.act) };
  };
  const ring = centre ? OUTER : [null, ...OUTER];
  const bells = [], pumps = [], lines = [], ducts = [], acts = [];
  const bellGeo = merlinBell(28);
  for (const a of ring) {
    const [x, z] = a == null ? [0, 0] : polar(ENGINE_RING, a);
    const g = bellGeo.clone(); g.translate(x, 0, z); bells.push(g);
    const e = engineAt(x, z, a == null ? 0 : tangentYaw(a));
    pumps.push(...e.pump); lines.push(...e.line); ducts.push(...e.duct); acts.push(...e.act);
  }
  const engines = P(centre ? 'Merlin 1D engines (outer ring)' : 'Merlin 1D engines', {
    system: 'Propulsion', count: centre ? 8 : 9, material: 'Copper-alloy regeneratively cooled chamber and nozzle, Inconel manifolds',
    mass: (centre ? 8 : 9) * 470,
    desc: centre
      ? 'Eight of the centre core\'s nine engines, each 845 kN at sea level and 914 kN in vacuum. The centre core throttles them back early in flight so it still has propellant when the side boosters separate.'
      : 'Nine Merlin 1D, 845 kN each at sea level (7.6 MN per core). Each has its own turbopump and gas generator; the dark pipe beside each nozzle dumps the turbine exhaust.',
    explode: [0, -4.2, 0],
  }, [mesh(merge(bells), SKIN.bell()), mesh(merge(pumps), FM.pump()), mesh(merge(lines), FM.steelLine()), mesh(merge(ducts), FM.inconel())]);
  engines.userData.part.thermalRole = centre ? 'engineC' : 'engineB';
  P(centre ? 'outer-engine TVC actuators' : 'TVC actuators', {
    system: 'Flight controls', count: centre ? 16 : 18, material: 'Hydraulic actuators powered by high-pressure RP-1',
    mass: (centre ? 16 : 18) * 14,
    desc: 'Two actuators per engine gimbal the nozzle a few degrees in pitch and yaw to steer. Their working fluid is RP-1 tapped from the engine\'s own fuel pump, so no separate hydraulic supply is needed.',
    explode: [0, -2.6, 1.4],
  }, mesh(merge(acts), FM.steelLine()));

  if (centre) {
    // the centre engine, broken out into its components
    const kit = merlinKit({ detail: true });
    const E = (name, info, objs) => P(name, { ...info, system: info.system || 'Propulsion' }, objs);
    const ch = E('Merlin 1D thrust chamber & pintle injector', {
      material: 'Copper-alloy liner, Inconel jacket', mass: 140,
      desc: 'Centre engine. RP-1 and LOX meet at a single pintle injector, which resists combustion instability; they burn at about 9.7 MPa and 3,400 K. Fuel flowing through channels in the chamber wall cools it before injection.',
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
      callout: true, anchor: [0.36, 2.2, 0.2], explode: [1.0, -1.9, 4.6],
    }, [mesh(merge(kit.pump), FM.pump())]);
    E('Merlin 1D gas generator', {
      material: 'Inconel combustor', mass: 18,
      desc: 'Burns a small fuel-rich share of the propellants (≈ 3 %) to drive the turbine. In this open cycle the turbine gas is dumped overboard instead of entering the main chamber — simpler and lighter than staged combustion, at a few seconds of Isp.',
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
      desc: 'Main oxidiser and fuel valves plus the ignition line. A slug of pyrophoric TEA-TEB, which ignites on contact with LOX, lights the gas generator and the chamber; the dual-redundant system allows restarts for the boost-back and landing burns.',
      explode: [-1.0, -1.9, 4.6],
    }, [mesh(merge(kit.line), FM.steelLine()), mesh(merge(kit.valve), FM.gold())]);
    E('Merlin 1D gimbal & TVC actuators', {
      system: 'Flight controls', count: 2, material: 'Gimbal bearing block, hydraulic actuators (RP-1 working fluid)', mass: 40,
      desc: 'The centre engine gimbals too: it is the one Merlin that relights alone for the landing burn, so it must steer.',
      explode: [-0.8, -1.3, 5.3],
    }, mesh(merge(kit.act), FM.steelLine()));
  }

  // ------------------------------------------------------------------ forward structure
  let finY;
  if (centre) {
    const inter = P('interstage', {
      system: 'Separation', skin: true, material: 'Carbon-fibre / aluminium-honeycomb sandwich, black thermal paint', mass: 2100,
      desc: 'Carbon-composite shroud between the stages, 6.6 m long. It covers the Merlin Vacuum nozzle and carries the grid fins and cold-gas thrusters, and stays with the centre core at separation.',
      callout: true, anchor: [R + 0.05, 44.2, 0.3], explode: [0, 3.2, 0],
    }, [mesh(barrel(R, Y.s1Top, Y.interTop, { rings: 3 }), FM.blackTPS()), mesh(barrel(R - 0.03, Y.s1Top, Y.interTop), FM.compositeInner())]);
    inter.userData.part.thermalRole = 'ambient';
    const sep = [];
    for (const a of [0, 90, 180, 270]) {
      const [x, z] = polar(R - 0.18, a + 45);
      sep.push(post(x, z, Y.interTop - 0.55, Y.interTop - 0.02, 0.07, 12), post(x, z, Y.interTop - 0.75, Y.interTop - 0.55, 0.11, 12));
      const [lx, lz] = polar(R - 0.12, a);
      sep.push(block(lx, Y.interTop - 0.2, lz, 0.22, 0.4, 0.18, radialYaw(a)));
    }
    sep.push(hoop(R - 0.06, 0.05, Y.interTop - 0.05, { seg: 96, tube: 6 }));
    P('stage-separation pushers & latches', {
      system: 'Separation', count: 4, material: 'Pneumatic pushers, mechanical latches (collets), separation ring', mass: 180,
      desc: 'Mechanical latches hold the second stage on the interstage ring; at separation they release and pneumatic pushers drive the stages apart — no explosives, so the system can be tested on the actual flight hardware. Count and placement simplified.',
      explode: [0, 4.4, 0],
    }, mesh(merge(sep), FM.aluDark()));
    finY = Y.interTop - 0.45;
  } else {
    const fsec = P('forward section', {
      system: 'Structure', skin: true, material: 'Carbon composite, black thermal paint', mass: 420,
      desc: 'Short composite section above the LOX tank, in the black interstage finish. It carries the grid fins and cold-gas thrusters and supports the nose cone. Length estimated.',
      explode: [0, 2.0, 0],
    }, [mesh(barrel(R, Y.s1Top, Y.adapterTop, { rings: 2 }), FM.blackTPS()), mesh(barrel(R - 0.03, Y.s1Top, Y.adapterTop), FM.compositeInner())]);
    fsec.userData.part.thermalRole = 'ambient';
    const nose = P('nose cone', {
      system: 'Skin & fairings', skin: true, material: 'Carbon-composite sandwich, white paint', mass: 520,
      desc: 'Aerodynamic composite nose that replaces the interstage on a side booster: it turns the booster into a clean body of revolution beside the centre core. Length estimated from photographs.',
      callout: attachSide > 0, anchor: [0.5, Y.adapterTop + 3.2, 0.6], explode: [0, 4.2, 0],
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
    m.position.z = 0;
    hinge.add(m);
    finGroup.push(hinge);
    out.fins.push(m);
    const [hx, hz] = polar(R + 0.12, a);
    finActs.push(block(hx, finY + 0.16, hz, 0.62, 0.36, 0.24, radialYaw(a)));
    const [ax, az] = polar(R - 0.25, a);
    finActs.push(rod([ax, finY + 0.1, az], [hx, finY + 0.1, hz], 0.06, 8));
  }
  const gf = P('grid fins', {
    system: 'Recovery', count: 4, material: 'Cast and machined titanium', mass: 4 * 180,
    desc: 'Stowed flat for ascent, the four lattice fins swing out after separation and steer the falling booster through re-entry. Block 5 fins are titanium, about 1.2 × 1.5 m, and survive re-entry heating without ablative coating.',
    callout: centre, anchor: [polar(R + 0.3, 45)[0], finY - 0.8, polar(R + 0.3, 45)[1]], explode: centre ? [0, 3.6, 0] : [0, 2.4, 0],
  }, finGroup);
  gf.userData.part.thermalRole = 'ambient';
  P('grid-fin actuators', {
    system: 'Hydraulics', count: 4, material: 'Closed-loop hydraulic actuators in aerodynamic housings', mass: 4 * 35,
    desc: 'Each fin rotates on a hydraulic actuator in a housing at its root, driven by the stage\'s hydraulic power unit.',
    explode: centre ? [0, 3.9, 0] : [0, 2.7, 0],
  }, mesh(merge(finActs), FM.black()));

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
    const [fx, fz] = polar(R + 0.3, a);
    footGeos.push(block(fx, 1.35 + legLen - 0.15, fz, 0.6, 0.3, 0.32, radialYaw(a)));
    const [hx, hz] = polar(R + 0.1, a);
    footGeos.push(block(hx, 1.5, hz, 0.7, 0.3, 0.3, radialYaw(a)));                  // hinge fitting
    const [px, pz] = polar(R + 0.13, a);
    pistonGeos.push(rod([px, 1.75, pz], [px, 8.0, pz], 0.075, 10), rod([px, 8.0, pz], [px, 9.8, pz], 0.05, 8));
  }
  const legs = P('landing legs', {
    system: 'Recovery', count: 4, material: 'Carbon fibre with aluminium honeycomb', mass: 4 * 520,
    desc: 'Folded against the skirt for ascent; for landing they swing down to a stance about 18 m across. Block 5 legs can be retracted after landing, which speeds turnaround.',
    callout: !centre && attachSide > 0, anchor: [polar(R + 0.35, 45)[0], 6.5, polar(R + 0.35, 45)[1]], explode: [0, -1.6, 0],
  }, [mesh(merge(legGeos), FM.legCarbon()), mesh(merge(footGeos), FM.black()), ...(centre ? [] : [mesh(merge(pistonGeos), FM.steelLine())])]);
  legs.userData.part.thermalRole = 'ambient';
  if (centre) {
    P('leg deployment pistons', {
      system: 'Recovery', count: 4, material: 'Telescoping pneumatic pistons (high-pressure helium)', mass: 4 * 45,
      desc: 'A telescoping piston inside each leg pushes it out and down with high-pressure helium in the last seconds before touchdown.',
      explode: [0, -1.6, 1.0],
    }, mesh(merge(pistonGeos), FM.steelLine()));
  }

  // ------------------------------------------------------------------ cold-gas thrusters, raceway, avionics
  const cgY = centre ? 44.5 : Y.s1Top + 0.65;
  const cg = [], n2 = [];
  for (const a of [90, 270]) {
    const [x, z] = polar(R + 0.12, a);
    cg.push(block(x, cgY, z, 0.5, 0.62, 0.26, radialYaw(a)));
    for (const dy of [-0.18, 0.18]) for (const dt of [-0.14, 0.14]) {
      const [nx, nz] = polar(R + 0.27, a + (dt * 180) / (Math.PI * R));
      cg.push(post(nx, nz, cgY + dy - 0.05, cgY + dy + 0.05, 0.035, 8));
    }
    const [sx, sz] = polar(1.2, a + 35);
    n2.push(new THREE.SphereGeometry(0.33, 18, 12).translate(sx, centre ? 42.1 : Y.s1Top + 0.45, sz));
  }
  P('cold-gas thrusters & N₂ tanks', {
    system: 'Attitude control', count: 2, material: 'Nitrogen thruster pods, composite-overwrapped N₂ tanks', mass: 160,
    desc: 'Pods of nitrogen cold-gas thrusters flip the stage after separation and hold its attitude outside the atmosphere, where grid fins have no air to work with.',
    explode: centre ? [0, 3.2, 1.2] : [0, 2.2, 1.2],
  }, [mesh(merge(cg), FM.black()), mesh(merge(n2), FM.copv())]);

  const rw = [];
  const rwA = 120;
  const [rwx, rwz] = polar(R + 0.07, rwA);
  rw.push(block(rwx, (Y.heatShield + 0.4 + Y.s1Top) / 2, rwz, 0.26, Y.s1Top - Y.heatShield - 0.4, 0.14, radialYaw(rwA)));
  for (let y = 2.5; y < Y.s1Top; y += 2.4) {
    const [bx, bz] = polar(R + 0.04, rwA);
    rw.push(block(bx, y, bz, 0.36, 0.08, 0.1, radialYaw(rwA)));
  }
  P('raceway', {
    system: 'Electrical', material: 'Composite cable tray cover', mass: 140,
    desc: 'External tunnel that carries power, data and flight-termination cables up the outside of the tanks between the engine bay and the forward avionics.',
    explode: [0, 0, 1.6],
  }, mesh(merge(rw), FM.raceway()));

  const av = [];
  for (let i = 0; i < 6; i++) {
    const a = 15 + i * 60;
    const [x, z] = polar(1.45, a);
    av.push(block(x, Y.s1Top + 0.22, z, 0.42, 0.28, 0.32, radialYaw(a)));
  }
  for (const a of [0, 120, 240]) {
    const [x, z] = polar(1.62, a);
    av.push(block(x, 3.0, z, 0.3, 0.36, 0.2, radialYaw(a)));
  }
  av.push(hoop(1.5, 0.03, Y.s1Top + 0.06, { seg: 48, tube: 4 }));
  P('avionics', {
    system: 'Avionics', material: 'Flight computers, IMU/GPS, power and engine controllers', mass: 260,
    desc: 'Triple-redundant flight computers, inertial and GPS navigation, power distribution and the autonomous flight-safety system on the forward skirt, with engine controllers in the engine bay.',
    explode: [0, 2.0, 0.8],
  }, mesh(merge(av), FM.avionics()));

  // ------------------------------------------------------------------ booster attach hardware (centre core)
  if (centre) {
    const gap0 = R, gap1 = 4.27 - R;                       // centre-core skin → side-booster skin
    for (const s of [1, -1]) {
      const label = s > 0 ? 'A' : 'B';
      const f = [], a = [];
      for (const dz of [-0.42, 0.42]) {
        // forward: two pneumatic pusher mechanisms at the top of the LOX tanks
        f.push(block(s * (gap0 + 0.12), 40.1, dz, 0.3, 0.9, 0.42));
        f.push(rod([s * (gap0 + 0.2), 40.1, dz], [s * (gap1 - 0.04), 40.1, dz], 0.085, 12));
        f.push(block(s * (gap1 - 0.06), 40.1, dz, 0.16, 0.6, 0.36));
        // aft: two identical mechanisms on the engine sections
        a.push(block(s * (gap0 + 0.12), 2.75, dz, 0.3, 0.8, 0.42));
        a.push(rod([s * (gap0 + 0.2), 2.75, dz], [s * (gap1 - 0.04), 2.75, dz], 0.085, 12));
        a.push(block(s * (gap1 - 0.06), 2.75, dz, 0.16, 0.55, 0.36));
      }
      f.push(beam([s * (gap0 + 0.05), 40.6, -0.42], [s * (gap0 + 0.05), 40.6, 0.42], 0.12, 0.2));
      a.push(beam([s * (gap0 + 0.05), 2.3, -0.42], [s * (gap0 + 0.05), 2.3, 0.42], 0.12, 0.2));
      P(`forward attach & pushers (${label})`, {
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher mechanisms', mass: 260,
        desc: `Two pneumatic pusher mechanisms tie the top of side booster ${label} to the top of the centre core's LOX tank. They hold through ascent, then release and push the booster away after its engines shut down.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(f), FM.aluDark()));
      P(`aft attach & pushers (${label})`, {
        system: 'Separation', count: 2, material: 'Titanium fittings, pneumatic pusher mechanisms', mass: 240,
        desc: `Two identical pushers at the engine sections shove the base of side booster ${label} sideways so it clears the centre core. Pneumatic devices give a low-shock release over a long stroke.`,
        explode: [s * 1.2, 0, 0.8],
      }, mesh(merge(a), FM.aluDark()));
    }
  }
  return out;
}
