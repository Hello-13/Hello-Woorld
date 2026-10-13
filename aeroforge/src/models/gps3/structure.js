// GPS III primary structure, closure panels, radiators, heat pipes and blankets (A2100M-style bus:
// a composite central cylinder carrying the propellant tanks, four shear webs, honeycomb decks and
// equipment panels, radiator panels on the two faces that never see the Sun under yaw steering).

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { HX, HY, HZ, T, RC, IX, IY, IZ, boxG, cylG, merge } from './kit.js';

/** Rectangular plate with a circular hole, `thick` along z, top face at z = z0 + thick/2. */
function holedPlate(hx, hy, r, thick, z) {
  const s = new THREE.Shape();
  s.moveTo(-hx, -hy); s.lineTo(hx, -hy); s.lineTo(hx, hy); s.lineTo(-hx, hy); s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, r, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 48 });
  return g.translate(0, 0, z - thick / 2);
}

export function buildStructure(P) {
  // ------------------------------------------------------------------ central cylinder
  const cylH = 2 * IZ;
  const shell = mesh(cylG([0, 0, 0], RC, cylH, 'z', 64, RC, true), G.cfrp(4));
  const frames = merge([
    cylG([0, 0, IZ - 0.02], RC + 0.012, 0.04, 'z', 64), cylG([0, 0, -IZ + 0.02], RC + 0.012, 0.04, 'z', 64),
    cylG([0, 0, -0.63], RC + 0.008, 0.03, 'z', 64), cylG([0, 0, 0.555], RC + 0.008, 0.03, 'z', 64),
  ]);
  P('Central cylinder', {
    system: 'Structure', material: 'Carbon-fibre / epoxy cylinder with aluminium end and tank-support frames', mass: 150, skin: true, temp: 290,
    desc: 'The backbone of the A2100 bus: a 1.24 m composite tube (diameter estimated) running from the launch adapter to the Earth deck. It carries the whole spacecraft\'s launch loads — several g along the axis — and the two propellant tanks are stacked inside it.',
  }, [shell, mesh(frames, G.aluminium())]);

  // ------------------------------------------------------------------ decks
  P('Earth deck (+Z)', {
    system: 'Structure', material: 'Aluminium honeycomb sandwich, aluminium face sheets', mass: 52, skin: true, temp: 255, explode: [0, 0, 1.5],
    desc: 'The nadir panel that always faces the Earth. It carries the L-band navigation antenna, the crosslink and telemetry antennas, Earth sensors and the nuclear-detonation sensors; the payload\'s output network hangs beneath it.',
  }, mesh(boxG([0, 0, HZ - T / 2], [2 * HX, 2 * HY, T]), G.honeycomb()));
  P('Aft deck (−Z)', {
    system: 'Structure', material: 'Aluminium honeycomb sandwich ring panel', mass: 46, skin: true, temp: 230, explode: [0, 0, -1.5],
    desc: 'The anti-Earth panel around the base of the central cylinder. It closes the box at the launch-adapter end and carries the reaction wheels inside and the thruster clusters and service valves outside.',
  }, mesh(holedPlate(HX, HY, RC + 0.005, T, -HZ + T / 2), G.honeycomb()));

  // ------------------------------------------------------------------ equipment panels (±X) and shear webs
  for (const s of [1, -1]) {
    P(s > 0 ? 'Equipment panel (+X)' : 'Equipment panel (−X)', {
      system: 'Structure', material: 'Aluminium honeycomb sandwich', mass: 38, skin: true, temp: s > 0 ? 300 : 275, explode: [1.4 * s, 0, 0],
      desc: s > 0
        ? 'Sun-side closure panel. Yaw steering keeps the Sun in the X–Z plane, so this face is warmed by sunlight for half of every orbit and is blanketed rather than used as a radiator.'
        : 'Shadow-side closure panel. It carries the propulsion pressurant controls and the ordnance controller on its inner face, under a black blanket.',
    }, mesh(boxG([s * (HX - T / 2), 0, 0], [T, 2 * IY, 2 * IZ]), G.honeycomb()));
  }
  const web = (name, c, sz, ex) => P(name, {
    system: 'Structure', material: 'Aluminium honeycomb shear panel', mass: 15, temp: 290, explode: ex,
    desc: 'One of four radial shear webs tying the central cylinder to the outer panels, so bending and twisting loads from the panels flow into the cylinder. The webs also split the bus into four equipment bays (layout estimated from A2100 practice).',
  }, mesh(boxG(c, sz), G.honeycomb()));
  const wl = IX - RC, wly = IY - RC;
  web('Shear web (+X)', [RC + wl / 2, 0, 0], [wl, T * 0.8, 2 * IZ], [0.35, 0, 0]);
  web('Shear web (−X)', [-RC - wl / 2, 0, 0], [wl, T * 0.8, 2 * IZ], [-0.35, 0, 0]);
  web('Shear web (+Y)', [0, RC + wly / 2, 0], [T * 0.8, wly, 2 * IZ], [0, 0.35, 0]);
  web('Shear web (−Y)', [0, -RC - wly / 2, 0], [T * 0.8, wly, 2 * IZ], [0, -0.35, 0]);

  // ------------------------------------------------------------------ launch-vehicle adapter ring
  const rI = 0.597;   // 1,194 mm interface (assumed; a standard 47-inch size)
  const prof = [[rI - 0.03, -0.002], [rI + 0.025, -0.002], [rI + 0.025, -0.07], [rI + 0.04, -0.105], [rI + 0.04, -0.14], [rI - 0.012, -0.14], [rI - 0.012, -0.11], [rI - 0.03, -0.09], [rI - 0.03, -0.002]];
  const ringG = lathe(prof.slice().reverse(), 96)   // reversed so the outer face winds outward
   .rotateX(Math.PI / 2).translate(0, 0, -HZ);
  P('Launch-vehicle adapter ring', {
    system: 'Separation', material: 'Machined aluminium ring', mass: 30, temp: 240, explode: [0, 0, -1.95],
    desc: 'The satellite\'s half of the separation joint. A clamp band squeezes this ring against the launcher\'s payload adapter and is cut by pyrotechnic bolt cutters at separation. Interface diameter assumed 1,194 mm (a standard size; the GPS III figure is not published).',
  }, mesh(ringG, G.aluminium()));
  const springs = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    springs.push(cylG([Math.cos(a) * 0.55, Math.sin(a) * 0.55, -HZ - 0.05], 0.028, 0.1, 'z', 14));
    springs.push(cylG([Math.cos(a) * 0.55, Math.sin(a) * 0.55, -HZ - 0.105], 0.012, 0.02, 'z', 10));
  }
  const umb = [];
  for (const s of [1, -1]) {
    umb.push(boxG([s * 0.46, 0.0, -HZ - 0.035], [0.09, 0.07, 0.07]));
    umb.push(cylG([s * 0.46, 0, -HZ - 0.085], 0.03, 0.03, 'z', 16));
  }
  P('Separation springs & umbilicals', {
    system: 'Separation', material: 'Steel spring cartridges; separation connectors', mass: 8, count: 4, temp: 240, explode: [0, 0, -2.05],
    desc: 'Four spring cartridges (count estimated) push the satellite off the adapter at a fraction of a metre per second once the clamp band releases; two umbilical connectors carry ground power and telemetry until they pull apart at separation.',
  }, [mesh(merge(springs), G.gunmetal()), mesh(merge(umb), G.blackBox())]);

  // ------------------------------------------------------------------ radiators (±Y) with embedded heat pipes
  for (const s of [1, -1]) {
    const osr = G.osr(2 * HX / 0.64, 2 * HZ / 0.64);
    const hc = G.honeycomb();
    const faces = s > 0 ? [hc, hc, osr, hc, hc, hc] : [hc, hc, hc, osr, hc, hc];
    const rad = P(s > 0 ? 'Radiator panel (+Y)' : 'Radiator panel (−Y)', {
      system: 'Thermal control', material: 'Quartz optical solar reflectors on aluminium honeycomb', mass: 62, skin: true, temp: 285, explode: [0, 1.6 * s, 0],
      desc: s > 0
        ? 'Yaw steering keeps this face edge-on to the Sun, so it is the payload\'s radiator: the clocks, signal generator and L-band transmitters bolt to its inside. The mirror tiles absorb only about 8 % of sunlight but emit about 80 % of the infrared of a black body.'
        : 'The bus radiator: batteries, power regulator, computer and transponders mount on its inner face. Like its twin it never faces the Sun, and the solar-array drive passes through its centre.',
    }, mesh(boxG([0, s * (HY - T / 2), 0], [2 * HX, T, 2 * HZ]), faces));
    rad.userData.part.thermalRole = 'radiator';
    const pipes = [];
    for (let i = 0; i < 7; i++) pipes.push(cylG([0, s * (HY - T / 2), -1.05 + i * 0.35], 0.0075, 2 * HX - 0.12, 'x', 8));
    for (const x of [-0.62, 0.62]) pipes.push(cylG([x, s * (HY - T / 2), 0], 0.0075, 2 * HZ - 0.2, 'z', 8));
    P(s > 0 ? 'Heat pipes (+Y radiator)' : 'Heat pipes (−Y radiator)', {
      system: 'Thermal control', material: 'Aluminium extrusions charged with ammonia', mass: 14, count: 9, temp: 288, explode: [0, 1.38 * s, 0],
      desc: 'Sealed tubes embedded in the radiator honeycomb: ammonia evaporates under a hot box, flows as vapour to colder parts of the panel, condenses and wicks back. They spread several hundred watts so the whole panel radiates evenly (pipe count and routing estimated).',
    }, mesh(merge(pipes), G.tubing()));
  }

  // ------------------------------------------------------------------ multi-layer insulation
  for (const s of [1, -1]) {
    const b = P(s > 0 ? 'MLI blanket (+X)' : 'MLI blanket (−X)', {
      system: 'Thermal control', material: '15–20 layers of aluminised Mylar / Kapton, black Kapton outer layer', mass: 5, skin: true, temp: s > 0 ? 395 : 170, explode: [1.7 * s, 0, 0],
      desc: s > 0
        ? 'Multi-layer insulation over the Sun-side panel. Each foil layer reflects radiant heat back, so although the outer layer reaches well over 100 °C in sunlight, almost none of it leaks into the bus (layer count estimated).'
        : 'Blanket over the shadow-side panel: here the outer layer falls below −100 °C while the electronics behind it stay near room temperature.',
    }, mesh(boxG([s * (HX + 0.007), 0, 0], [0.012, 2 * HY - 0.01, 2 * HZ + 0.02]), G.blackMLI(1.4)));
    b.userData.part.thermalRole = s > 0 ? 'sunlit' : 'shadow';
  }
  const eb = P('MLI blanket (Earth deck)', {
    system: 'Thermal control', material: 'Multi-layer insulation, black Kapton outer layer', mass: 4, skin: true, temp: 250, explode: [0, 0, 1.68],
    desc: 'Blanket on the Earth deck between the antennas. From 20,180 km the Earth fills only a 27.8° disc, so this face looks mostly at cold space plus a little earthshine.',
  }, mesh(boxG([0, 0, HZ + 0.006], [2 * HX + 0.02, 2 * HY - 0.01, 0.012]), G.blackMLI(1.2)));
  eb.userData.part.thermalRole = 'earth';
  const ab = P('MLI blanket (aft deck)', {
    system: 'Thermal control', material: 'Multi-layer insulation, amber (aluminised Kapton) outer layer', mass: 4, skin: true, temp: 230, explode: [0, 0, -1.65],
    desc: 'Blanket around the launch adapter. It shields the propulsion end from the apogee engine\'s radiant heat and keeps the hydrazine lines above their 2 °C freezing point together with heaters.',
  }, mesh(holedPlate(HX + 0.01, HY - 0.005, RC + 0.03, 0.012, -HZ - 0.007), G.goldMLI()));
  ab.userData.part.thermalRole = 'aft';
}
