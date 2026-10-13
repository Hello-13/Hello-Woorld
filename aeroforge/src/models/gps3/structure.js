// GPS III mechanical subsystem and thermal skins (A2100M bus, Lockheed Martin GPS III expanded view,
// Marquis & Shaw 2011, Fig. 4; manufacturer's scale model, Steigenberger et al. 2020, Fig. 4):
// a composite core box around the hydrazine tank, standing on the launch adapter section and its
// separation ring; shear webs that bound the two ±X oxidiser-tank bays; the Earth and aft decks;
// the two big equipment panels on ±Y (navigation payload panel and bus / network-comm / hosted-
// payload panel) whose outer faces are the OSR radiators; MLI-closed ±X faces with access panels.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { G } from './materials.js';
import { HX, HY, HZ, T, CORE, BAY, IX, IY, IZ, ADAPTER, SEP_Z, boxG, cylG, merge, plateG, rectHole, boltsG } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Plate drawn in a (u, v) plane and extruded along w, then mapped to the body axes given. */
function sidePlate(outline, holes, thick, w0, [U, Vv, W]) {
  const g = plateG(outline, thick, w0, holes);
  return g.applyMatrix4(new THREE.Matrix4().makeBasis(U, Vv, W));
}
const Y_Z_X = [V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)];   // u → y, v → z, w → x  (a ±X face)
const X_Z_Y = [V(1, 0, 0), V(0, 0, 1), V(0, -1, 0)];  // u → x, v → z, w → −y (a ±Y face)

/** Rectangle outline (u, v) centred at (cu, cv). */
const rect = (cu, cv, w, h) => [[cu - w / 2, cv - h / 2], [cu + w / 2, cv - h / 2], [cu + w / 2, cv + h / 2], [cu - w / 2, cv + h / 2]];

export function buildStructure(P) {
  // ------------------------------------------------------------------ core structure (box section)
  const zc0 = -HZ, zc1 = IZ, hc = zc1 - zc0, zm = (zc0 + zc1) / 2;
  const win = (u) => [rectHole(u, -0.95, 0.62, 0.95), rectHole(u, 0.25, 0.62, 1.05), rectHole(u, 1.25, 0.62, 0.55)].map((h) => h);
  const walls = [];
  for (const s of [1, -1]) {
    // ±X walls (in the y–z plane) and ±Y walls (x–z plane), each with three lightening windows
    walls.push(sidePlate(rect(0, zm, 2 * CORE, hc), win(0), T, s > 0 ? CORE - T : -CORE, Y_Z_X));
    walls.push(sidePlate(rect(0, zm, 2 * CORE - 2 * T, hc), win(0), T, s > 0 ? -CORE : CORE - T, X_Z_Y));
  }
  P('Core structure', {
    system: 'Structure', material: 'Carbon-fibre / aluminium-honeycomb sandwich panels (ATK, now Northrop Grumman)', mass: 120, skin: true, temp: 290,
    desc: 'The backbone of the bus: a tall box about 1.0 × 1.0 m (estimate) of flat composite panels running the full 3.4 m from the launch adapter to the Earth deck, with the hydrazine tank inside it. It carries the launch loads of the whole satellite into the separation ring. ATK won the A2100 composite-structure order for GPS III in April 2010.',
  }, mesh(merge(walls), G.cfrp(3)));
  const fr = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) fr.push(boxG([sx * (CORE - 0.02), sy * (CORE - 0.02), zm], [0.04, 0.04, hc]));
  for (const z of [zc0 + 0.03, -1.43, -0.45, 0.83, 1.6]) {
    for (const s of [1, -1]) {
      fr.push(boxG([s * (CORE - T - 0.015), 0, z], [0.03, 2 * CORE - 0.1, 0.05]));
      fr.push(boxG([0, s * (CORE - T - 0.015), z], [2 * CORE - 0.1, 0.03, 0.05]));
    }
  }
  P('Core frames & longerons', {
    system: 'Structure', material: 'Machined aluminium corner longerons and ring frames', mass: 28, temp: 290, explode: [0, 0, 0.08],
    desc: 'Four corner longerons and five ring frames stiffen the core panels and pick up the tank supports, the deck edges and the shear webs; the bottom frame bolts to the launch adapter section (frame positions estimated).',
  }, mesh(merge(fr), G.aluminium()));

  // ------------------------------------------------------------------ decks
  P('Earth deck (+Z)', {
    system: 'Structure', material: 'Aluminium honeycomb sandwich, aluminium face sheets', mass: 42, skin: true, temp: 255, explode: [0, 0, 1.55],
    desc: 'The nadir panel that always faces the Earth, 2.46 × 1.78 m. It carries the L-band antenna panel, the crosslink elements, the TT&C masts, the Earth sensors, the burst detector\'s sensors and sunshade, and (on SV09 and SV10) the laser retroreflector.',
  }, mesh(boxG([0, 0, HZ - T / 2], [2 * HX, 2 * IY, T]), G.honeycomb()));
  const aftOutline = rect(0, 0, 2 * HX, 2 * IY);
  P('Aft deck (−Z)', {
    system: 'Structure', material: 'Aluminium honeycomb sandwich panel', mass: 34, skin: true, temp: 230, explode: [0, 0, -1.35],
    desc: 'The anti-Earth panel that closes the box around the foot of the core. The oxidiser feed lines and the thruster manifold run on its inner face; outside are the thruster outrigger brackets, the service valves and the aft TT&C antenna.',
  }, mesh(plateG(aftOutline, T, -HZ, [rectHole(0, 0, 2 * CORE, 2 * CORE)]), G.honeycomb()));

  // ------------------------------------------------------------------ shear webs (bound the ±X tank bays)
  const wl = IX - CORE;
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    P(`Shear web (${sx > 0 ? '+X' : '−X'}, ${sy > 0 ? '+Y' : '−Y'} side)`, {
      system: 'Structure', material: 'Aluminium honeycomb shear panel', mass: 11, skin: true, temp: 290, explode: [sx * 0.35, sy * 0.25, 0],
      desc: 'One of four shear webs that run from the core walls out to the ±X faces, in line with the core\'s ±Y walls. They carry panel loads into the core, bound the roughly 1.0 m-wide oxidiser-tank bay on each ±X side and wall off the equipment compartments behind the ±Y panels (web positions follow the scale model).',
    }, mesh(boxG([sx * (CORE + wl / 2), sy * (BAY - T / 2), zm], [wl, T * 0.8, hc]), G.honeycomb()));
  }

  // ------------------------------------------------------------------ ±X closeouts with access panels
  const AP = { w: 0.25, h: 2.0, zc: -0.05 };
  for (const s of [1, -1]) {
    const tag = s > 0 ? '+X' : '−X';
    const strips = [];
    for (const sy of [1, -1]) {
      const yc = sy * (BAY + HY) / 2, w = HY - BAY;
      strips.push(sidePlate(rect(yc, 0, w, 2 * HZ - 0.002), [rectHole(yc, AP.zc, AP.w + 0.006, AP.h + 0.006)], T, s > 0 ? IX : -HX, Y_Z_X));
    }
    P(`Closeout panels (${tag})`, {
      system: 'Skin & fairings', material: 'Aluminium honeycomb closeout strips', mass: 9, count: 2, skin: true, temp: s > 0 ? 300 : 275, explode: [s * 1.45, 0, 0],
      desc: `The ${tag} face is not an equipment panel: two narrow closeout strips cover the equipment compartments behind the ±Y panels, and between them the ${tag} tank bay, about 1.0 m wide, is closed only by insulation, with the oxidiser tank behind it (layout from the manufacturer's scale model).`,
    }, mesh(merge(strips), G.honeycomb()));
    for (const sy of [1, -1]) {
      const yc = sy * (BAY + HY) / 2, x = s * (HX - T / 2);
      const bolts = [];
      for (let i = 0; i <= 12; i++) { const z = AP.zc - AP.h / 2 + 0.04 + (i / 12) * (AP.h - 0.08); bolts.push([x + s * 0.0155, yc - AP.w / 2 + 0.025, z], [x + s * 0.0155, yc + AP.w / 2 - 0.025, z]); }
      for (const z of [AP.zc - AP.h / 2 + 0.03, AP.zc + AP.h / 2 - 0.03]) bolts.push([x + s * 0.0155, yc, z]);
      P(`Access panel (${tag}, ${sy > 0 ? '+Y' : '−Y'} side)`, {
        system: 'Skin & fairings', material: 'Aluminium honeycomb panel on captive fasteners', mass: 2.2, skin: true, temp: s > 0 ? 300 : 275, explode: [s * 1.7, sy * 0.15, 0],
        desc: 'One of the four "access panels" in Lockheed\'s expanded view: a long, narrow removable panel that lets technicians reach the interior after the bus is closed, for example for propellant-system work at the launch site. It comes off by its captive fasteners without disturbing the structure (size from the figure, estimated).',
      }, [mesh(boxG([x, yc, AP.zc], [T, AP.w, AP.h]), G.honeycomb()), mesh(boltsG(bolts, 'x', 0.007, 0.006), G.satinTi())]);
    }
  }

  // corner and edge fittings that join the panels (machined aluminium, bonded inserts and bolts)
  const fit = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const c = [sx * (IX - 0.03), sy * (IY - 0.03), sz * (IZ - 0.03)];
    fit.push(boxG(c, [0.06, 0.06, 0.06]), boxG([c[0] + sx * 0.026, c[1] - sy * 0.04, c[2]], [0.008, 0.08, 0.05]), boxG([c[0] - sx * 0.04, c[1] + sy * 0.026, c[2]], [0.08, 0.008, 0.05]));
  }
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    for (const z of [-1.1, -0.35, 0.4, 1.1]) fit.push(boxG([sx * (IX - 0.02), sy * (IY - 0.02), z], [0.04, 0.04, 0.08]));
    // web-to-closeout and web-to-core clips
    for (const z of [-1.2, 0, 1.2]) fit.push(boxG([sx * (IX - 0.02), sy * (BAY + 0.02), z], [0.04, 0.04, 0.1]), boxG([sx * (CORE + 0.02), sy * (BAY + 0.02), z], [0.04, 0.04, 0.1]));
  }
  P('Panel corner fittings', {
    system: 'Structure', material: 'Machined aluminium cleats, bonded inserts, titanium bolts', mass: 11, count: 64, temp: 285, explode: [0, 0, 0.12],
    desc: 'Corner blocks and cleats where the honeycomb panels meet one another and the webs. Honeycomb cannot take a bolt directly, so threaded inserts are potted into each panel and the cleats bolt to them; the same inserts carry every unit on the panels (count and size estimated).',
  }, mesh(merge(fit), G.aluminium()));

  // ------------------------------------------------------------------ launch adapter section and separation hardware
  const { r: rA, z0: za0, z1: za1 } = ADAPTER, ha = za0 - za1;
  const adapt = [cylG([0, 0, (za0 + za1) / 2], rA, ha, 'z', 72, rA, true), cylG([0, 0, za0 - 0.025], rA + 0.012, 0.05, 'z', 72), cylG([0, 0, za1 + 0.025], rA + 0.012, 0.05, 'z', 72)];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; adapt.push(boxG([Math.cos(a) * (rA - 0.02), Math.sin(a) * (rA - 0.02), (za0 + za1) / 2], [0.04, 0.04, ha])); }
  // eight radial gussets under the core foot that spread its load into the adapter's top frame
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    adapt.push(new THREE.BoxGeometry(0.29, 0.04, 0.05).translate(0.695, 0, 0).rotateZ(a).translate(0, 0, za0 - 0.03));
  }
  P('Launch adapter section', {
    system: 'Separation', material: 'Composite cylinder with aluminium end frames and longerons', mass: 38, skin: true, temp: 235, explode: [0, 0, -1.95],
    desc: 'A short cylinder about 1.7 m across and 0.4 m tall under the aft deck that carries the satellite\'s weight from the core to the separation ring; the apogee engine fires down through it. The manufacturer\'s scale model shows it under black MLI, and the IGS box-wing envelope (4.2 m tall) includes it (size from the scale model, estimated).',
  }, mesh(merge(adapt), G.cfrp(5)));
  const rI = 0.833;   // 1,666 mm interface (assumption: the adapter's width suggests this class rather than 1,194 mm; not published)
  const prof = [[rI - 0.03, -0.002], [rI + 0.025, -0.002], [rI + 0.025, -0.05], [rI + 0.04, -0.075], [rI + 0.04, -0.1], [rI - 0.012, -0.1], [rI - 0.012, -0.08], [rI - 0.03, -0.065], [rI - 0.03, -0.002]];
  const ringG = lathe(prof.slice().reverse(), 120).rotateX(Math.PI / 2).translate(0, 0, SEP_Z);
  P('Separation ring', {
    system: 'Separation', material: 'Machined aluminium ring', mass: 32, temp: 240, explode: [0, 0, -2.25],
    desc: 'The satellite\'s half of the separation joint. A clamp band squeezes this ring against the launcher\'s payload adapter and is released by pyrotechnic bolt cutters at separation. Shown at the 1,666 mm (66 in) interface size that the adapter\'s 1.7 m width suggests; the GPS III figure is not published (assumption).',
  }, mesh(ringG, G.aluminium()));
  const springs = [], zs = SEP_Z - 0.06;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, r = rI - 0.07;
    springs.push(cylG([Math.cos(a) * r, Math.sin(a) * r, zs], 0.028, 0.09, 'z', 14));
    springs.push(cylG([Math.cos(a) * r, Math.sin(a) * r, zs - 0.06], 0.012, 0.03, 'z', 10));
  }
  P('Separation springs', {
    system: 'Separation', material: 'Steel spring cartridges with push rods', mass: 4, count: 4, temp: 240, explode: [0, 0, -2.35],
    desc: 'Four spring cartridges (count estimated) push the satellite off the adapter at a fraction of a metre per second once the clamp band releases, so it drifts cleanly away from the launcher\'s upper stage.',
  }, mesh(merge(springs), G.gunmetal()));
  const umb = [];
  for (const s of [1, -1]) {
    umb.push(boxG([0, s * (rI - 0.08), zs + 0.01], [0.07, 0.09, 0.07]));
    umb.push(cylG([0, s * (rI - 0.08), zs - 0.04], 0.03, 0.03, 'z', 16));
  }
  P('Separation connectors', {
    system: 'Separation', material: 'Pull-apart umbilical connectors', mass: 3, count: 2, temp: 240, explode: [0, 0, -2.4],
    desc: 'Two umbilical connectors carry ground power, battery charging and telemetry through the launch-vehicle adapter until the satellite moves away and they pull apart.',
  }, mesh(merge(umb), G.blackBox()));
  const sw = [];
  for (const a of [0, Math.PI]) {
    const c = [Math.cos(a) * (rI - 0.08), Math.sin(a) * (rI - 0.08), zs + 0.02];
    sw.push(boxG(c, [0.05, 0.04, 0.05]), cylG([c[0], c[1], c[2] - 0.04], 0.008, 0.03, 'z', 8));
  }
  P('Separation switches', {
    system: 'Separation', material: 'Plunger switches', mass: 0.6, count: 2, temp: 240, explode: [0, 0, -2.38],
    desc: 'Plunger switches held closed by the adapter: the "event detectors" of the TT&C subsystem. When they open at separation they start the on-board computer\'s timed sequence: wake the attitude control, null the tip-off rates, point the satellite. Lockheed\'s figure also labels two "GED" units near the base of the core (acronym not expanded; count and form estimated).',
  }, mesh(merge(sw), G.silverBox()));

  // ------------------------------------------------------------------ the two big equipment panels (±Y), OSR outer faces
  const STRIP = 0.35;    // black strip along the −X edge of each radiator (scale model)
  for (const s of [1, -1]) {
    const yP = s * (HY - T / 2), yo = s * (HY + 0.0012);
    const osrW = 2 * HX - STRIP, osrC = (STRIP) / 2;
    const bolts = [];
    for (let i = 0; i <= 24; i++) { const x = -HX + 0.04 + (i / 24) * (2 * HX - 0.08); bolts.push([x, s * (HY + 0.004), HZ - 0.035], [x, s * (HY + 0.004), -HZ + 0.035]); }
    for (let i = 1; i < 32; i++) { const z = -HZ + (i / 32) * 2 * HZ; bolts.push([HX - 0.035, s * (HY + 0.004), z], [-HX + 0.035, s * (HY + 0.004), z]); }
    const npe = s > 0;
    const rad = P(npe ? 'NPE panel (+Y)' : 'Bus/NCE/HPE panel (−Y)', {
      system: 'Thermal control', material: 'Aluminium honeycomb equipment panel; quartz optical solar reflectors outside', mass: 72, skin: true, temp: 285, explode: [0, 1.65 * s, 0],
      desc: npe
        ? 'The navigation payload element panel, Lockheed\'s "NPE panel (−Y)" (its own axes; +Y in the IGS axes used here). The clocks, Mission Data Unit, transmitters and filters bolt to its inner face, and its outer face is the payload\'s radiator: yaw steering keeps it edge-on to the Sun, and the mirror tiles absorb only about 8 % of sunlight but emit about 80 % of a black body\'s infrared.'
        : 'The bus / network-communications / hosted-payload panel, Lockheed\'s "Bus/NCE/HPE panel (+Y)" (−Y here). It carries the batteries, power regulation, computer, wheels, crosslink and S-band boxes and the burst-detector processors; like its twin it never faces the Sun, and its outer face is a radiator with the solar-array drive passing through it.',
    }, [mesh(boxG([0, yP, 0], [2 * HX, T, 2 * HZ]), G.honeycomb()), mesh(boxG([osrC, yo, 0], [osrW, 0.0024, 2 * HZ - 0.01]), G.osr(osrW / 0.64, 2 * HZ / 0.64)),
      mesh(boxG([-HX + STRIP / 2, yo, 0], [STRIP, 0.0024, 2 * HZ - 0.01]), G.blackPaint()), mesh(boltsG(bolts, 'y', 0.007, 0.005), G.satinTi())]);
    rad.userData.part.thermalRole = 'radiator';
    const pipes = [];
    for (let i = 0; i < 10; i++) pipes.push(cylG([0, yP, -1.48 + i * 0.33], 0.0075, 2 * HX - 0.14, 'x', 8));
    for (const x of [-0.98, 0.98]) pipes.push(cylG([x, yP, 0], 0.0075, 2 * HZ - 0.24, 'z', 8));
    P(npe ? 'Heat pipes (+Y panel)' : 'Heat pipes (−Y panel)', {
      system: 'Thermal control', material: 'Aluminium extrusions charged with ammonia', mass: 18, count: 12, temp: 288, explode: [0, 1.5 * s, 0],
      desc: 'Sealed tubes embedded in the panel honeycomb: ammonia evaporates under a hot box, flows as vapour to colder parts of the panel, condenses and wicks back. They spread several hundred watts so the whole radiator works evenly (pipe count and routing estimated).',
    }, mesh(merge(pipes), G.tubing()));
    const y = s * (IY - 0.0015), strips = [], sensors = [];
    for (const z of [-1.6, -0.62, 0.3, 1.6]) strips.push(boxG([0, y, z], [2.2, 0.003, 0.03]));
    for (const x of [-1.15, 1.15]) strips.push(boxG([x, y, 0], [0.03, 0.003, 3.1]));
    for (const [x, z] of [[-1.1, -1.3], [1.1, -1.3], [-1.1, 0.0], [1.1, 0.0], [-1.1, 1.3], [1.1, 1.3], [0.3, 1.6], [0.3, -1.6]]) sensors.push(boxG([x, s * (IY - 0.004), z], [0.012, 0.008, 0.02]));
    P(npe ? 'Heaters & thermistors (+Y panel)' : 'Heaters & thermistors (−Y panel)', {
      system: 'Thermal control', material: 'Kapton film heaters, thermistors, heater harness', mass: 2.5, temp: 290, explode: [0, 1.32 * s, 0],
      desc: npe
        ? 'Film heaters, thermistors and the heater harness on the payload panel (a "navigation panel with heater harness installed" is pictured in the GPS III design paper). In eclipse, and before the units are switched on, the heaters hold every box above its minimum temperature; the thermistors report through the interface units (routing estimated).'
        : 'Film heaters and thermistors on the bus panel. The batteries are the coldest-running units (about 0–10 °C) and have their own heater circuits (routing estimated).',
    }, [mesh(merge(strips), G.heater()), mesh(merge(sensors), G.blackBox())]);
  }

  // ------------------------------------------------------------------ multi-layer insulation
  const RECESS = 0.06;
  for (const s of [1, -1]) {
    const sun = s > 0, g = [];
    // flush over the closeout strips (and the web ends), recessed across the tank bay, with returns along the webs
    const yi = BAY - T - 0.01;
    for (const sy of [1, -1]) g.push(boxG([s * (HX + 0.006), sy * (yi + HY) / 2, 0], [0.012, HY - yi, 2 * HZ]));
    g.push(boxG([s * (HX - RECESS), 0, 0], [0.012, 2 * yi, 2 * HZ - 0.02]));
    for (const sy of [1, -1]) g.push(boxG([s * (HX - RECESS / 2 + 0.003), sy * (yi + 0.006), 0], [RECESS + 0.006, 0.012, 2 * HZ - 0.02]));
    const b = P(sun ? 'MLI blanket (+X)' : 'MLI blanket (−X)', {
      system: 'Thermal control', material: sun ? '15–20 layers of aluminised Kapton / Mylar, silver outer layer' : '15–20 layers of aluminised Kapton / Mylar, black outer layer', mass: 4.5, skin: true, temp: sun ? 395 : 170, explode: [s * 2.0, 0, 0],
      desc: sun
        ? 'Silver multi-layer insulation over the Sun-facing face, including the recessed oxidiser-tank bay. Pre-launch images of SV02 show this face silver; the IGS box-wing model takes it to absorb about 44 % of sunlight. Each foil layer reflects heat back, so almost none of the outer layer\'s 100 °C-plus reaches the bus (layer count estimated).'
        : 'Black MLI over the shadow face, the gold-wrapped oxidiser tank included (SV02 pre-launch images). Here the outer layer falls below −100 °C while the tank behind it is kept warm by heaters.',
    }, mesh(merge(g), sun ? G.silverMLI(1.3) : G.blackMLI(1.4)));
    b.userData.part.thermalRole = sun ? 'sunlit' : 'shadow';
  }
  const eb = P('MLI blanket (Earth deck)', {
    system: 'Thermal control', material: 'Radio-transparent MLI, silver outer layer', mass: 3, skin: true, temp: 250, explode: [0, 0, 1.68],
    desc: 'Silver, radio-transparent blanket on the antenna face (SV02 pre-launch images), so it insulates without blocking the L-band and crosslink signals. From 20,180 km the Earth fills only a 27.8° disc, so this face sees mostly cold space and a little earthshine.',
  }, mesh(boxG([0, 0, HZ + 0.006], [2 * HX + 0.025, 2 * HY - 0.01, 0.012]), G.silverMLI(1.1)));
  eb.userData.part.thermalRole = 'earth';
  const hole = new THREE.Path(); hole.absarc(0, 0, ADAPTER.r + 0.02, 0, Math.PI * 2, true);
  const ab = P('MLI blanket (aft deck)', {
    system: 'Thermal control', material: 'Multi-layer insulation, black outer layer', mass: 2.5, skin: true, temp: 230, explode: [0, 0, -1.6],
    desc: 'Black blanket on the anti-Earth face around the adapter (the box-wing model uses black-MLI optical properties for −Z). With heaters it keeps the propellant lines on the aft deck above hydrazine\'s 2 °C freezing point.',
  }, mesh(plateG(rect(0, 0, 2 * HX + 0.025, 2 * HY - 0.01), 0.012, -HZ - 0.013, [hole]), G.blackMLI(1.2)));
  ab.userData.part.thermalRole = 'aft';
  const lb = P('MLI blanket (launch adapter)', {
    system: 'Thermal control', material: 'Multi-layer insulation, black outer layer', mass: 2.5, skin: true, temp: 230, explode: [0, 0, -2.1],
    desc: 'Black blanket around the launch adapter section, as on the manufacturer\'s scale model. It shields the propulsion end from the apogee engine\'s radiant heat; the IGS team noted that the adapter\'s optical properties are unknown.',
  }, mesh(cylG([0, 0, (ADAPTER.z0 + ADAPTER.z1) / 2 - 0.005], ADAPTER.r + 0.014, ADAPTER.z0 - ADAPTER.z1 - 0.03, 'z', 72, ADAPTER.r + 0.014, true), G.blackMLI(1.6)));
  lb.userData.part.thermalRole = 'aft';
}
