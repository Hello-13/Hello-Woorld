// F-22A thermal management (Lockheed Martin's ECS/TMS has about 135 components): an air-cycle pack
// (in systems.js), a vapour-cycle refrigeration pack, two polyalphaolefin (PAO) liquid loops that carry
// avionics heat to fuel–PAO heat exchangers in the ECS bay, and the fuel side — cool fuel from the F-1B
// feed cell through the exchangers, then either back to the tanks or through an air-cooled fuel cooler
// (ACFC) under each exhaust grille on the spine, whose cooling air comes from the inlet diverter.
// Unit positions are approximate; the loops' assignment of equipment is approximate.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, rectTube } from './util.js';

const { X, smooth, M } = FR;
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);
/** Route points clamped inside the fuselage skin (the re-laid-out outer mould line). */
const inside = (pts, m = 0.03) => pts.map((p) => FR.inBody(p, m));
/** Air-cooled fuel cooler under its exhaust grille on the spine behind the cockpit (FR.ACFC): [s, |z|] centre and
 *  length / height / width; its top sits 10 cm under the skin (under the upper longeron). */
const COOLER = { s: (FR.ACFC.s0 + FR.ACFC.s1) / 2 - 0.02, z: (FR.ACFC.z0 + FR.ACFC.z1) / 2, ls: 0.5, h: 0.12, w: 0.3 };
COOLER.y = FR.topAt(COOLER.s, COOLER.z) - 0.1 - COOLER.h / 2;
/** Middle of the diverter slot between the forward fuselage side and the inlet cowl's inner wall. */
const slotZ = (s) => FR.aW(s) + 0.03 * (1 - smooth(M(6.4), M(7.5), s));

export function buildThermal(ctx) {
  const { P } = ctx;

  // ------------------------------------------------------------------ vapour-cycle pack
  {
    // under the cockpit floor (y ≈ −0.07): pack, compressor and valve block all stay below y −0.09
    const g = [box(M(6.78), -0.26, 0.46, 0.34, 0.17, 0.26)];
    g.push(FR.cylX(M(6.7), -0.14, 0.43, 0.16, 0.05, 0.05, 14));                                 // refrigerant compressor
    g.push(box(M(6.86), -0.14, 0.54, 0.14, 0.07, 0.1));                                          // expansion valve block
    const E = FR.ECS_BAY, V = FR.ROUTE.nose.vcs;
    // both lines drop down the pack's inboard side (clear of the corridor's lanes) and run aft along its floor
    const l = [FR.pipe([[5.22, -0.3, 0.36], [5.22, -0.4, V[0][0]], [5.28, -0.7, V[0][0]], [5.45, V[0][1], V[0][0]], [6.16, V[0][1], V[0][0]], [E.pao[0] - 0.13, E.pao[1] + 0.01, E.pao[2] + 0.03], [E.pao[0] - 0.08, E.pao[1], E.pao[2] + 0.02]], 0.016, 6, 24),   // evaporator ↔ PAO loop 1's pump
      // condenser ↔ fuel: aft into the right fuel–PAO exchanger's fuel side
      FR.pipe([[5.42, -0.3, 0.36], [5.42, -0.4, V[0][0]], [5.46, -0.66, V[0][0]], [5.56, V[1][1], V[1][0]], [6.45, V[1][1], V[1][0]], [6.53, -0.8, 0.3], [E.fpx[0] - 0.11, E.fpx[1] + 0.03, E.fpx[2] + 0.03]], 0.016, 6, 24)];
    P('Vapour-cycle refrigeration pack', {
      system: 'Environmental control', material: 'Electric compressor, refrigerant evaporator and fuel-cooled condenser', mass: 28,
      explode: [0.3, -0.75, 0.95],
      desc: 'Works like a refrigerator: a compressor pumps refrigerant round a closed circuit, chilling the PAO coolant for the hottest electronics in its evaporator and dumping that heat into fuel in its condenser. It sits beside the nose-wheel well under the cockpit, ahead of the ECS bay (position approximate).',
    }, [mesh(merge(g), F.boxLight()), mesh(merge(l), F.pipe())]);
  }

  // ------------------------------------------------------------------ PAO loops, pumps and heat exchangers
  const E = FR.ECS_BAY;
  for (const [k, side] of [[1, 1], [2, -1]]) {
    const z = side;
    P(`Fuel–PAO heat exchanger (loop ${k})`, {
      system: 'Environmental control', material: 'Aluminium plate-fin core, PAO on one side, fuel on the other', mass: 22,
      explode: [0.4, -1.35, 0.55 * side],
      desc: `Loop ${k}'s heat goes into the fuel here, low in the ECS bay: hot PAO on one side of the plates, cool fuel from the tanks on the other. Fuel is the F-22's main heat sink, because a stealthy jet cannot have many external cooling scoops (position approximate).`,
    }, mesh(box(E.fpx[0], E.fpx[1], z * E.fpx[2], 0.26, 0.15, 0.17), F.copper()));
    P(`PAO pump & reservoir (loop ${k})`, {
      system: 'Environmental control', material: 'Electric coolant pump, pressurised reservoir', mass: 10,
      explode: [0.6, -1.65, 0.75 * side],
      desc: `Each liquid loop has its own pump and reservoir, so one failure cannot stop all liquid cooling; the reservoir takes up the coolant's expansion as it heats.`,
    }, mesh(merge([FR.cylX(E.pao[0], E.pao[1], z * E.pao[2], 0.2, 0.065, 0.065, 14), new THREE.SphereGeometry(0.06, 14, 10).translate(X(E.pao[0]), E.pao[1] + 0.12, z * (E.pao[2] + 0.02)),
      FR.pipe([[E.pao[0], E.pao[1] + 0.06, z * (E.pao[2] + 0.01)], [E.pao[0], E.pao[1] + 0.07, z * (E.pao[2] + 0.02)]], 0.015, 6, 2),
      FR.pipe([[E.pao[0] + 0.1, E.pao[1], z * E.pao[2]], [E.fpx[0] - 0.13, E.fpx[1], z * E.fpx[2]]], 0.016, 6, 4)]), F.boxLight()));
  }
  // each loop's supply and return pair: from the fuel–PAO exchanger's outboard face up into the corridor beside the
  // nose well (FR.ROUTE.nose.pao), forward under F-1A and the vapour-cycle pack, up under the boxes below the cockpit
  // floor and under the IFDL processor, into the ends of the cold-plate rails in the forward avionics racks
  const NR = FR.ROUTE.nose, AV = FR.AV_BAY;
  const paoRun = (side, [zl, yl], sDrop, railZ) => {
    const z = side;
    return FR.pipe([[sDrop, E.fpx[1], z * (E.fpx[2] + 0.06)], [sDrop, E.fpx[1] + 0.02, z * zl], [sDrop, -0.64, z * zl], [sDrop - 0.08, yl, z * zl], [NR.rise + 0.08, yl, z * zl], [5.25, yl, z * zl], [NR.descend[1], -0.5, z * zl],
      [NR.descend[0], NR.under, z * zl], [3.85, NR.under, z * zl], [3.7, -0.41, z * zl], [3.45, -0.37, z * zl], [3.22, -0.36, z * zl], [3.12, -0.24, z * (zl - 0.06)], [3.04, -0.1, z * (railZ + 0.03)], [AV.s1 + 0.02, AV.shelfUp - 0.002, z * railZ], [AV.s1 - 0.003, AV.shelfUp - 0.002, z * railZ]], 0.018, 6, 60);
  };
  {
    // loop 1: radar array cold plates and the CIP racks (supply and return pair on the right)
    const g = [paoRun(1, NR.pao[1], 6.72, 0.2), paoRun(1, NR.pao[0], 6.62, 0.06)];
    P('PAO cooling loop 1 (radar & CIPs)', {
      system: 'Environmental control', material: 'Polyalphaolefin coolant in aluminium supply and return lines', mass: 30, xrayWeight: 0.7,
      explode: [0.8, -0.25, 0.25],
      desc: 'One of two PAO liquid loops: it runs through the cold plates under the APG-77\'s transmit/receive modules and the common integrated processors, then back to its fuel–PAO heat exchanger. An AESA turns much of its power into heat.',
    }, mesh(merge(g), F.pao()));
  }
  {
    // loop 2: CNI and EW receivers, the IFDL processor and the vehicle-management computers (left)
    const g = [paoRun(-1, NR.pao[1], 6.72, 0.2), paoRun(-1, NR.pao[0], 6.62, 0.06)];
    P('PAO cooling loop 2 (CNI & EW)', {
      system: 'Environmental control', material: 'Polyalphaolefin coolant in aluminium supply and return lines', mass: 25, xrayWeight: 0.7,
      explode: [0.8, -0.25, -0.25],
      desc: 'The second liquid loop cools the CNI and electronic-warfare receivers and the flight-critical computers, through its own pump, reservoir and fuel–PAO exchanger (assignment of equipment to the two loops approximate).',
    }, mesh(merge(g), F.pao()));
  }

  // ------------------------------------------------------------------ air-cooled fuel coolers (ACFC)
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const z = side;
    const C = COOLER, sF = C.s - C.ls / 2;
    const c = [box(C.s, C.y, z * C.z, C.ls, C.h, C.w)];
    for (let k = 0; k < 9; k++) c.push(box(sF + 0.03 + k * 0.055, C.y, z * C.z, 0.008, C.h + 0.005, C.w + 0.005));              // core plate edges
    const d = [];
    // cooling air from the diverter slot between the fuselage and the inlet, aft along the forebody side under the
    // chine (outboard of F-1A), then up into the cooler's outboard face
    d.push(rectTube([[5.32, -0.12, z * slotZ(5.32)], [5.5, -0.08, z * 0.8], ...inside([[6.0, -0.02, z * 0.79], [6.4, 0.06, z * 0.78]], 0.04), [sF - 0.06, C.y - 0.02, z * (C.z + C.w / 2 - 0.02)], [sF + 0.04, C.y, z * (C.z + C.w / 2 - 0.02)]], 0.03, 0.08, { n: 16 }));
    // exhaust plenum straight up to the grille in the skin above
    const ex = (sv) => [[sv, C.y + C.h / 2 - 0.005, z * (C.z - 0.08)], [sv, FR.topAt(sv, C.z) - 0.025, z * (C.z - 0.08)], [sv, FR.topAt(sv, C.z) - 0.025, z * (C.z + 0.08)], [sv, C.y + C.h / 2 - 0.005, z * (C.z + 0.08)]];
    d.push(FR.gridSurface([C.s - C.ls / 2 + 0.03, C.s, C.s + C.ls / 2 - 0.03].map((sv) => ex(sv).map(([a, b, cc]) => [X(a), b, cc])), { closed: true, uv: 'n' }));
    P(`Air-cooled fuel cooler (${R})`, {
      system: 'Fuel', material: 'Aluminium fuel / air heat exchanger with its diverter-air inlet duct and exhaust plenum', mass: 18,
      explode: [0.4, 1.35, 1.65 * side],
      desc: 'When fuel coming back from the liquid loops is too hot to return to the tanks, it passes through one of two air-cooled fuel coolers (ACFC). Their air is taken from the inlet diverter and leaves through the exhaust grilles on the spine just behind the canopy, which T.O. 00-105E-9 marks as the ACFC exhaust doors — the F-22 has no conventional cooling scoops (duct routing approximate).',
    }, [mesh(merge(c), F.copper()), mesh(merge(d), F.ductDark())]);
  }

  // ------------------------------------------------------------------ fuel side of the thermal loop
  {
    const g = [];
    const C = COOLER;
    for (const side of [1, -1]) {
      const z = side;
      // cool fuel from the F-1B feed cell down in front of the main bay to the exchanger
      // (down through the gap between the ECS bay and the main bay's front wall, inboard of the corridor's runs)
      const sl = FR.ROUTE.nose.slot;
      g.push(FR.pipe([[FR.FUEL.f1b[0] + 0.06, -0.3, z * 0.22], [sl + 0.013, -0.33, z * 0.22], [sl + 0.004, -0.62, z * 0.22], [sl - 0.02, -0.86, z * 0.24], [E.fpx[0] + 0.11, E.fpx[1] - 0.01, z * E.fpx[2]]], 0.02, 6, 16));
      // warm fuel out of the exchanger: up between the PAO pump and the bleed-air exchanger into F-1A, to the cooler …
      g.push(FR.pipe([[E.fpx[0] - 0.11, E.fpx[1] + 0.06, z * E.fpx[2]], [6.475, E.fpx[1] + 0.065, z * E.fpx[2]], [6.462, E.fpx[1] + 0.11, z * E.fpx[2]], [6.462, -0.46, z * E.fpx[2]], [6.44, 0.0, z * 0.45], [C.s - C.ls / 2 - 0.02, C.y - 0.02, z * (C.z - 0.08)], [C.s - C.ls / 2 + 0.02, C.y - 0.02, z * (C.z - 0.08)]], 0.018, 6, 24));
      // … and from the cooler back into F-1A (recirculation)
      g.push(FR.pipe([[C.s + C.ls / 2 - 0.02, C.y - 0.02, z * (C.z - 0.06)], [C.s + C.ls / 2 + 0.02, C.y - 0.02, z * (C.z - 0.06)], [6.55, C.y - 0.08, z * 0.3], [6.5, C.y - 0.2, z * 0.25]], 0.018, 6, 10));
      // bypass straight back to F-1A when the fuel is cool enough
      g.push(FR.pipe([[6.462, -0.5, z * E.fpx[2]], [6.45, -0.42, z * 0.27], [6.44, -0.38, z * 0.28]], 0.016, 6, 4));
    }
    P('Fuel thermal-management lines', {
      system: 'Fuel', material: 'Aluminium / titanium fuel lines, temperature-controlled recirculation valves', mass: 14, xrayWeight: 0.7,
      explode: [0.3, 0.6, 0],
      desc: 'Fuel is the heat sink: cool fuel from the F-1B feed cell runs through the fuel–PAO exchangers in the ECS bay, then either straight back to F-1A or up through the air-cooled fuel coolers first, so the 8,200 kg of internal fuel soaks up avionics heat until the engines burn it (routing approximate).',
    }, mesh(merge(g), F.pipe()));
  }
}
