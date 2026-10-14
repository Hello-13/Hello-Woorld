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

const { X, smooth } = FR;
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);
/** Middle of the diverter slot between the forward fuselage side and the inlet cowl's inner wall. */
const slotZ = (s) => FR.aW(s) + 0.03 * (1 - smooth(6.4, 7.5, s));

export function buildThermal(ctx) {
  const { P } = ctx;

  // ------------------------------------------------------------------ vapour-cycle pack
  {
    // under the cockpit floor (y ≈ −0.07): pack, compressor and valve block all stay below y −0.09
    const g = [box(6.78, -0.26, 0.42, 0.34, 0.17, 0.26)];
    g.push(FR.cylX(6.7, -0.14, 0.39, 0.16, 0.05, 0.05, 14));                                 // refrigerant compressor
    g.push(box(6.86, -0.14, 0.5, 0.14, 0.07, 0.1));                                          // expansion valve block
    const l = [FR.pipe([[6.62, -0.31, 0.42], [6.58, -0.43, 0.385], [6.55, -0.533, 0.355]], 0.016, 6, 6),         // evaporator ↔ PAO loop 1 supply line (inboard of the batteries)
      // condenser ↔ fuel: outboard of the main harness and the bleed duct, under the front of F-1
      FR.pipe([[6.94, -0.29, 0.52], [7.0, -0.33, 0.6], [7.04, -0.46, 0.63], [7.1, -0.53, 0.65]], 0.016, 6, 8)];
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
    }, mesh(box(7.35, -0.62, z * 0.35, 0.34, 0.2, 0.3), F.copper()));
    P(`PAO pump & reservoir (loop ${k})`, {
      system: 'Environmental control', material: 'Electric coolant pump, pressurised reservoir', mass: 10,
      explode: [0.6, -1.65, 0.75 * side],
      desc: `Each liquid loop has its own pump and reservoir, so one failure cannot stop all liquid cooling; the reservoir takes up the coolant's expansion as it heats.`,
    }, mesh(merge([FR.cylX(6.8, -0.65, z * 0.32, 0.22, 0.07, 0.07, 14), new THREE.SphereGeometry(0.065, 14, 10).translate(X(6.8), -0.62, z * 0.47)]), F.boxLight()));   // under the bleed duct, forward of the bulkhead at s 7.0
  }
  {
    // loop 1: radar array cold plates and the CIP racks (supply and return pair on the right)
    const g = [];
    for (const dz of [0, -0.06]) {
      g.push(FR.pipe([[7.2, -0.6, 0.38 + dz], [6.95, -0.6, 0.3 + dz], [6.0, -0.45, 0.42 + dz], [4.5, -0.28, 0.42 + dz], [3.0, -0.12, 0.38 + dz], [2.62, 0.0, 0.36 + dz]], 0.018, 6, 40));
    }
    g.push(FR.pipe([[3.05, 0.3, 0.2], [3.3, 0.36, 0.0], [3.05, 0.3, -0.2]], 0.016, 6));
    g.push(FR.pipe([[3.4, -0.1, 0.38], [3.3, 0.1, 0.32], [3.15, 0.3, 0.2]], 0.014, 6));
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
      g.push(FR.pipe([[7.2, -0.6, -0.38 + dz], [6.95, -0.6, -0.3 + dz], [6.0, -0.45, -0.42 + dz], [4.5, -0.3, -0.44 + dz], [3.6, -0.25, -0.3 + dz], [3.22, -0.2, -0.16 + dz]], 0.018, 6, 40));
    }
    g.push(FR.pipe([[3.6, -0.25, -0.3], [3.8, 0.0, -0.3], [3.92, 0.12, -0.25]], 0.014, 6));
    g.push(FR.pipe([[3.7, -0.25, -0.24], [3.85, 0.0, 0.15], [3.92, 0.12, 0.25]], 0.014, 6));
    g.push(FR.pipe([[4.5, -0.3, -0.42], [4.7, -0.3, -0.38], [4.9, -0.3, -0.42]], 0.014, 6));
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
    const c = [box(8.2, 0.29, z * 1.16, 0.4, 0.16, 0.26)];
    for (let k = 0; k < 6; k++) c.push(box(8.02 + k * 0.072, 0.29, z * 1.16, 0.008, 0.165, 0.265));              // core plate edges
    const d = [];
    // cooling air from the diverter slot between the fuselage and the inlet, up over the duct's inboard top
    d.push(rectTube([[6.6, -0.12, z * slotZ(6.6)], [6.95, -0.06, z * slotZ(6.95)], [7.35, 0.05, z * 0.985], [7.7, 0.17, z * 1.03], [7.99, 0.28, z * 1.1]], 0.035, 0.12, { n: 16 }));
    // exhaust up to the upper grille
    d.push(rectTube([[8.4, 0.31, z * 1.16], [8.44, 0.45, z * 1.16], [8.48, FR.topAt(8.48, 1.24) - 0.05, z * 1.16]], 0.14, 0.06, { n: 6 }));
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
      g.push(FR.pipe([[8.6, -0.12, z * 0.26], [8.4, -0.17, z * 0.28], [8.2, -0.5, z * 0.3], [7.7, -0.62, z * 0.35], [7.52, -0.62, z * 0.35]], 0.02, 6, 16));   // over the main bay's forward wall
      // warm fuel out of the exchanger: up to the ram-air cooler …
      g.push(FR.pipe([[7.18, -0.66, z * 0.42], [7.3, -0.55, z * 0.85], [7.6, -0.2, z * 0.97], [7.85, 0.2, z * 1.06], [8.0, 0.29, z * 1.06]], 0.018, 6, 20));
      // … and from the cooler back into F-1 (recirculation)
      g.push(FR.pipe([[8.4, 0.25, z * 1.1], [8.38, 0.42, z * 0.95], [8.3, 0.45, z * 0.75]], 0.018, 6, 10));
      // bypass straight back to F-1 when the fuel is cool enough
      g.push(FR.pipe([[7.3, -0.55, z * 0.85], [7.4, -0.3, z * 0.8]], 0.016, 6, 4));
    }
    // condenser line from the vapour-cycle pack joins the right-hand return
    g.push(FR.pipe([[7.1, -0.53, 0.65], [7.2, -0.56, 0.73], [7.3, -0.55, 0.83]], 0.014, 6, 6));
    P('Fuel thermal-management lines', {
      system: 'Fuel', material: 'Aluminium / titanium fuel lines, temperature-controlled recirculation valves', mass: 14, xrayWeight: 0.7,
      explode: [0.3, 0.6, 0],
      desc: 'Fuel is the heat sink: cool fuel from the transfer gallery runs through the fuel–PAO exchangers, then either straight back to the tanks or out through the fuel–ram-air coolers first, so the 8,200 kg of internal fuel soaks up avionics heat until the engines burn it (routing approximate).',
    }, mesh(merge(g), F.pipe()));
  }
}
