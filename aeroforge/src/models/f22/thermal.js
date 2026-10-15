// F-22A thermal management (Lockheed Martin's ECS/TMS has about 135 components): an air-cycle pack
// (in systems.js), a vapour-cycle refrigeration pack, two polyalphaolefin (PAO) liquid loops that carry
// avionics heat to fuel–PAO heat exchangers, and the fuel side — cool fuel from the transfer gallery
// through the exchangers, then either back to the tanks or through a fuel–ram-air cooler beside each
// inlet, whose cooling air comes from the inlet diverter and leaves through the upper grilles.
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
/** Fuel–ram-air cooler: in the dry bay between F-1 and F-2, over the inboard shoulder of the inlet duct and right
 *  under the upper bleed grille it exhausts through: [s, y, |z|] centre and length / height / width. */
const COOLER = { s: 7.15, y: 0.395, z: 0.88, ls: 0.26, h: 0.13, w: 0.2 };
/** Middle of the diverter slot between the forward fuselage side and the inlet cowl's inner wall. */
const slotZ = (s) => FR.aW(s) + 0.03 * (1 - smooth(M(6.4), M(7.5), s));

export function buildThermal(ctx) {
  const { P } = ctx;

  // ------------------------------------------------------------------ vapour-cycle pack
  {
    // under the cockpit floor (y ≈ −0.07): pack, compressor and valve block all stay below y −0.09
    const g = [box(M(6.78), -0.26, 0.42, 0.34, 0.17, 0.26)];
    g.push(FR.cylX(M(6.7), -0.14, 0.39, 0.16, 0.05, 0.05, 14));                                 // refrigerant compressor
    g.push(box(M(6.86), -0.14, 0.5, 0.14, 0.07, 0.1));                                          // expansion valve block
    const l = [FR.pipe([[M(6.62), -0.31, 0.42], [M(6.58), -0.43, 0.385], [M(6.55), -0.533, 0.355]], 0.016, 6, 6),         // evaporator ↔ PAO loop 1 supply line (inboard of the batteries)
      // condenser ↔ fuel: outboard of the main harness and the bleed duct, under the front of F-1
      FR.pipe(inside([[M(6.94), -0.29, 0.52], [M(7.0), -0.33, 0.6], [M(7.04), -0.46, 0.63], [M(7.1), -0.53, 0.65]], 0.035), 0.016, 6, 8)];
    P('Vapour-cycle refrigeration pack', {
      system: 'Environmental control', material: 'Electric compressor, refrigerant evaporator and fuel-cooled condenser', mass: 28,
      explode: [0.3, -0.75, 0.95],
      desc: 'Works like a refrigerator: a compressor pumps refrigerant round a closed circuit, chilling the PAO coolant for the hottest electronics in its evaporator and dumping that heat into fuel in its condenser. It sits beside the air-cycle machine in the ECS bay (position approximate).',
    }, [mesh(merge(g), F.boxLight()), mesh(merge(l), F.pipe())]);
  }

  // ------------------------------------------------------------------ PAO loops, pumps and heat exchangers
  for (const [k, side] of [[1, 1], [2, -1]]) {
    const z = side;
    P(`Fuel–PAO heat exchanger (loop ${k})`, {
      system: 'Environmental control', material: 'Aluminium plate-fin core, PAO on one side, fuel on the other', mass: 22,
      explode: [0.4, -1.35, 0.55 * side],
      desc: `Loop ${k}'s heat goes into the fuel here: hot PAO on one side of the plates, cool fuel from the tanks on the other. Fuel is the F-22's main heat sink, because a stealthy jet cannot have many external cooling scoops.`,
    }, mesh(box(M(7.35), -0.58, z * 0.39, 0.34, 0.2, 0.24), F.copper()));
    P(`PAO pump & reservoir (loop ${k})`, {
      system: 'Environmental control', material: 'Electric coolant pump, pressurised reservoir', mass: 10,
      explode: [0.6, -1.65, 0.75 * side],
      desc: `Each liquid loop has its own pump and reservoir, so one failure cannot stop all liquid cooling; the reservoir takes up the coolant's expansion as it heats.`,
    }, mesh(merge([FR.cylX(M(6.8), -0.65, z * 0.32, 0.22, 0.07, 0.07, 14), new THREE.SphereGeometry(0.065, 14, 10).translate(X(M(6.8)), -0.62, z * 0.47)]), F.boxLight()));   // under the bleed duct, forward of the bulkhead at s 7.0
  }
  {
    // loop 1: radar array cold plates and the CIP racks (supply and return pair on the right)
    const g = [];
    for (const dz of [0, -0.06]) {
      g.push(FR.pipe(inside([[M(7.2), -0.58, 0.38 + dz], [M(6.95), -0.6, 0.3 + dz], [M(6.0), -0.45, 0.42 + dz], [M(4.5), -0.28, 0.42 + dz], [M(3.0), -0.12, 0.38 + dz], [M(2.62), 0.0, 0.36 + dz]]), 0.018, 6, 40));
    }
    g.push(FR.pipe([[M(3.05), 0.3, 0.2], [M(3.3), 0.36, 0.0], [M(3.05), 0.3, -0.2]], 0.016, 6));
    g.push(FR.pipe([[M(3.4), -0.1, 0.38], [M(3.3), 0.1, 0.32], [M(3.15), 0.3, 0.2]], 0.014, 6));
    P('PAO cooling loop 1 (radar & CIPs)', {
      system: 'Environmental control', material: 'Polyalphaolefin coolant in aluminium supply and return lines', mass: 30, xrayWeight: 0.7,
      explode: [0.8, -0.25, 0.25],
      desc: 'One of two PAO liquid loops: it runs through the cold plates under the APG-77\'s transmit/receive modules and the common integrated processors, then back to its fuel–PAO heat exchanger. An AESA turns much of its power into heat.',
    }, mesh(merge(g), F.pao()));
  }
  {
    // loop 2: CNI and EW receivers, the IFDL processor and the vehicle-management computers (left)
    const g = [];
    for (const dz of [0, 0.06]) {
      g.push(FR.pipe(inside([[M(7.2), -0.58, -0.38 + dz], [M(6.95), -0.6, -0.3 + dz], [M(6.0), -0.45, -0.42 + dz], [M(4.5), -0.3, -0.44 + dz], [M(3.6), -0.25, -0.3 + dz], [M(3.22), -0.2, -0.16 + dz]]), 0.018, 6, 40));
    }
    g.push(FR.pipe([[M(3.6), -0.25, -0.3], [M(3.8), 0.0, -0.3], [M(3.92), 0.12, -0.25]], 0.014, 6));
    g.push(FR.pipe([[M(3.7), -0.25, -0.24], [M(3.85), 0.0, 0.15], [M(3.92), 0.12, 0.25]], 0.014, 6));
    g.push(FR.pipe([[M(4.5), -0.3, -0.42], [M(4.7), -0.3, -0.38], [M(4.9), -0.3, -0.42]], 0.014, 6));
    P('PAO cooling loop 2 (CNI & EW)', {
      system: 'Environmental control', material: 'Polyalphaolefin coolant in aluminium supply and return lines', mass: 25, xrayWeight: 0.7,
      explode: [0.8, -0.25, -0.25],
      desc: 'The second liquid loop cools the CNI and electronic-warfare receivers and the flight-critical computers, through its own pump, reservoir and fuel–PAO exchanger (assignment of equipment to the two loops approximate).',
    }, mesh(merge(g), F.pao()));
  }

  // ------------------------------------------------------------------ fuel–ram-air coolers
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const z = side;
    const C = COOLER, sF = C.s - C.ls / 2;
    const c = [box(C.s, C.y, z * C.z, C.ls, C.h, C.w)];
    for (let k = 0; k < 6; k++) c.push(box(sF + 0.02 + k * 0.044, C.y, z * C.z, 0.008, C.h + 0.005, C.w + 0.005));              // core plate edges
    const d = [];
    // cooling air from the diverter slot between the fuselage and the inlet, aft along the forebody side under
    // the chine (outboard of F-1), then up over the duct's inboard shoulder into the cooler
    d.push(rectTube([[5.32, -0.12, z * slotZ(5.32)], [5.5, -0.08, z * 0.8], ...inside([[6.0, -0.03, z * 0.77], [6.5, 0.03, z * 0.76]], 0.04), [6.8, 0.22, z * 0.79], [sF - 0.02, C.y - 0.02, z * (C.z - 0.03)]], 0.03, 0.08, { n: 16 }));
    // exhaust up to the upper grille
    d.push(rectTube([[C.s, C.y + C.h / 2 - 0.01, z * (C.z + 0.04)], [C.s + 0.02, FR.topAt(C.s + 0.02, 1.0) - 0.05, z * 1.0], [C.s + 0.04, FR.topAt(C.s + 0.04, 1.08) - 0.03, z * 1.08]], 0.1, 0.04, { n: 6 }));
    P(`Fuel–ram-air cooler (${R})`, {
      system: 'Fuel', material: 'Aluminium fuel / air heat exchanger with its diverter-air inlet and exhaust ducts', mass: 18,
      explode: [0.4, 1.35, 1.65 * side],
      desc: 'When fuel coming back from the liquid loops is too hot to return to the tanks, it passes through one of two fuel–ram-air coolers. Air for them is taken from the inlet diverter and leaves through the grilles on the upper surface, because the F-22 has no conventional cooling scoops (duct routing approximate).',
    }, [mesh(merge(c), F.copper()), mesh(merge(d), F.ductDark())]);
  }

  // ------------------------------------------------------------------ fuel side of the thermal loop
  {
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      // cool fuel from the transfer gallery forward and down to the exchanger
      g.push(FR.pipe(inside([[M(8.6), -0.12, z * 0.26], [M(8.4), -0.17, z * 0.28], [M(8.2), -0.5, z * 0.3], [M(7.7), -0.6, z * 0.35], [M(7.52), -0.6, z * 0.35]]), 0.02, 6, 16));   // over the main bay's forward wall
      // warm fuel out of the exchanger: up to the ram-air cooler …
      const C = COOLER;
      g.push(FR.pipe([...inside([[M(7.18), -0.6, z * 0.42], [M(7.3), -0.52, z * 0.55], [M(7.6), -0.2, z * 0.66], [6.5, 0.0, z * 0.7]], 0.035), [6.85, 0.27, z * 0.74], [C.s - C.ls / 2 - 0.02, C.y - 0.04, z * (C.z - 0.07)]], 0.018, 6, 20));
      // … and from the cooler back into F-1 (recirculation)
      g.push(FR.pipe([[C.s + C.ls / 2 + 0.01, C.y, z * (C.z - 0.06)], [C.s, C.y + 0.07, z * 0.7], ...inside([[6.75, 0.45, z * 0.6]], 0.06)], 0.018, 6, 10));
      // bypass straight back to F-1 when the fuel is cool enough
      g.push(FR.pipe(inside([[M(7.3), -0.52, z * 0.55], [M(7.4), -0.3, z * 0.6]], 0.035), 0.016, 6, 4));
    }
    // condenser line from the vapour-cycle pack joins the right-hand return
    g.push(FR.pipe(inside([[M(7.1), -0.53, 0.6], [M(7.2), -0.53, 0.58], [M(7.3), -0.52, 0.55]], 0.035), 0.014, 6, 6));
    P('Fuel thermal-management lines', {
      system: 'Fuel', material: 'Aluminium / titanium fuel lines, temperature-controlled recirculation valves', mass: 14, xrayWeight: 0.7,
      explode: [0.3, 0.6, 0],
      desc: 'Fuel is the heat sink: cool fuel from the transfer gallery runs through the fuel–PAO exchangers, then either straight back to the tanks or out through the fuel–ram-air coolers first, so the 8,200 kg of internal fuel soaks up avionics heat until the engines burn it (routing approximate).',
    }, mesh(merge(g), F.pipe()));
  }
}
