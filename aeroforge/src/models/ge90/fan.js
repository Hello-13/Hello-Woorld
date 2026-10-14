// Fan module and LP compressor (booster): spinner, 22 swept composite fan blades, fan disk,
// forged-aluminium containment case with its rub strip and acoustic liners, outlet guide vanes,
// fan hub frame, 4-stage booster and its variable bleed valves and their actuators.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { M, SKIN } from '../../engine/materials.js';
import { GM } from './materials.js';
import { FAN, ROWS, coreAt, bypassAt } from './layout.js';
import { fanBladeSpec } from './blade.js';
import { cutLathe, cutPair, bladeGeometry, ring, boxAt, axialCyl, merge, ccw, flipFaces, rotorRow, P3, tube } from './geom.js';

/** Fan blade: swept wide-chord composite; with sheath = true, the titanium leading-edge strip. */
const fanBlade = (sheath = false) => bladeGeometry(fanBladeSpec(sheath));

/** A closed [r, y] section swept between angles p0 and p1, with end faces (a tilted sector). */
function slab(loop, p0, p1, seg = 6) {
  const l = ccw(loop);
  const shape = new THREE.Shape(l.map(([r, y]) => new THREE.Vector2(r, y)));
  return merge([lathe(l.concat([l[0]]), seg, p0, p1 - p0), new THREE.ShapeGeometry(shape).rotateY(p0 - Math.PI / 2), flipFaces(new THREE.ShapeGeometry(shape)).rotateY(p1 - Math.PI / 2)]);
}

/** One airfoil sized to the core annulus at y. Rotors leave a tip gap, stators a hub gap. */
export function coreBlade({ y, chord, count, rotor = true, stagger = rotor ? [38, 56] : [-24, -32], t = [0.07, 0.05], camber = rotor ? 0.05 : -0.05, stations = 2, n = 5, ann = coreAt, gap = 0.003 }) {
  const [hub, tip] = ann(y);
  // hub and tip ends sit against platforms and casings, so small airfoils are left open there
  return bladeGeometry({ rHub: rotor ? hub : hub + gap, rTip: rotor ? tip - gap : tip, chord, stagger, t, camber, y, stations, n, caps: count < 40 });
}

/** A stator row (static, cut by the cutaway through keep). */
export function coreRow(o, keep) {
  return ring(coreBlade(o), o.count, { keep, phase: o.phase ?? 0 });
}

/** A rotor row that turns and is cut blade by blade (see rotorRow in geom.js). */
export function coreRotor(o, material) {
  return rotorRow(coreBlade(o), o.count, material);
}

export function buildFan(ctx) {
  const { P, T, lt, cut } = ctx;

  // ------------------------------------------------------------------ spinner (turns with N1)
  const spinnerGeo = lathe([[0.001, 0.8], [0.05, 0.765], [0.12, 0.68], [0.2, 0.57], [0.28, 0.45], [0.35, 0.33], [0.41, 0.21], [0.45, 0.11], [0.468, 0.03], [0.47, 0.0]], 72);
  const spinner = mesh(spinnerGeo, M.spinner());
  const spinSpinner = new THREE.Group();
  spinSpinner.add(spinner);
  ctx.spin.n1.push({ g: spinSpinner });
  P('Spinner', {
    system: 'Propulsion', material: 'Composite cone, painted spiral', mass: 45,
    explode: [0, 2.45, 0], temp: 288,
    desc: 'A long cone that turns the incoming air smoothly onto the fan hub. The white spiral lets ground crew see at a glance whether the fan is turning.',
  }, spinSpinner).userData.part.stationTemp = '2';

  // ------------------------------------------------------------------ fan blades
  const blades = mesh(ring(fanBlade(false), FAN.blades), GM.composite());
  const sheaths = mesh(ring(fanBlade(true), FAN.blades), GM.tiSheath());
  blades.userData.temp = lt('2', '13', 0.5);
  const spinFan = new THREE.Group();
  spinFan.add(blades, sheaths);
  ctx.spin.n1.push({ g: spinFan });
  P('Fan blades', {
    system: 'Propulsion', material: 'Carbon-fibre / toughened-epoxy composite, titanium leading-edge sheath', mass: 480, count: 22,
    explode: [0, 2.3, 0],
    desc: '22 wide-chord swept composite blades, each about 1.2 m long and under 23 kg; the fan is 3.25 m (128 in) across, with about 5 mm between the blade tips and the rub strip. At take-off the tips run supersonic, and the bypass air the fan pushes makes about four fifths of the thrust. A titanium sheath protects each leading edge from birds, hail and erosion.',
    callout: true, anchor: [-1.58, -0.1, 0.3],
  }, spinFan).userData.part.stationTemp = '13';

  // ------------------------------------------------------------------ fan disk & platforms
  const diskProf = [[0.44, 0.0], [0.455, 0.0], [0.455, -0.46], [0.44, -0.46], [0.4, -0.42], [0.3, -0.33], [0.22, -0.31], [0.2, -0.35], [0.13, -0.35], [0.13, -0.17], [0.2, -0.17], [0.22, -0.21], [0.3, -0.19], [0.4, -0.08]];
  const platform = [[0.455, 0.03], [0.47, 0.03], [0.47, -0.47], [0.455, -0.47]];
  // booster spool cone bolted to the disk's aft face
  const cone = [[0.43, -0.46], [0.455, -0.46], [0.565, -0.74], [0.545, -0.74]];
  const disk = cut(cutLathe([diskProf, platform, cone], GM.titanium(), { seg: 72 }));
  P('Fan disk', {
    system: 'Propulsion', material: 'Forged titanium alloy', mass: 420,
    explode: [0, 1.85, 0], temp: 300,
    desc: 'Holds the 22 blade roots in dovetail slots and carries their centrifugal pull — on the order of 100 tonnes-force per blade at take-off N1 (estimate). Composite platforms between the roots form the smooth inner flow surface.',
  }, disk);

  // ------------------------------------------------------------------ fan containment case
  // a hardwall case: one thick forged and machined aluminium ring, thickest over the blade tips
  const yF = 0.3, yMid = -0.72, yAft = -1.45;
  const caseShell = [
    // forward flange (A-flange), the thick containment zone over the blades, and the mid flange
    [[FAN.caseR, yF], [1.77, yF], [1.77, yF - 0.03], [1.67, yF - 0.03], [1.67, 0.2], [1.705, 0.17], [1.705, -0.6], [1.67, -0.64], [1.67, yMid + 0.03], [1.77, yMid + 0.03], [1.77, yMid], [FAN.caseR, yMid]],
    // aft fan case with the OGV ring and its aft flange
    [[FAN.caseR, yMid - 0.01], [1.73, yMid - 0.01], [1.69, yMid - 0.06], [1.69, yAft + 0.03], [1.77, yAft + 0.03], [1.77, yAft], [FAN.caseR, yAft]],
  ];
  const caseGrp = cut(cutLathe(caseShell, GM.fanCase(), { seg: 96 }));
  // machined stiffening ribs round the containment zone
  const ribs = cut(cutLathe([0.12, -0.08, -0.28, -0.48].map((y) => [[1.705, y + 0.012], [1.73, y + 0.012], [1.73, y - 0.012], [1.705, y - 0.012]]), GM.fanCase(), { seg: 96 }));
  P('Fan containment case', {
    system: 'Structure', material: 'Forged and machined aluminium ring (hardwall containment), made by Volvo Aero', mass: 650,
    explode: [0, 1.15, 0], temp: 290,
    desc: 'If a blade ever breaks off at full power, this thick aluminium ring, about 600 kg machined (Volvo Aero), has to stop it; certification requires a deliberate blade-off test at take-off speed. A Kevlar/fibreglass wrap was added only as a temporary fix while the 777-300ER was certified in 2003; the production answer was a thicker aluminium forging. The case also carries the fan cowls, the accessory gearbox, FADEC and oil tank.',
    callout: true, anchor: [0.9, 0.0, 1.5],
  }, [caseGrp, ribs]);
  const rub = cut(cutLathe([[FAN.rubR, 0.12], [FAN.caseR, 0.12], [FAN.caseR, -0.5], [FAN.rubR, -0.5]], GM.rubStrip(), { seg: 96 }));
  const acoustic = cut(cutLathe([[[FAN.caseR - 0.006, yF], [FAN.caseR, yF], [FAN.caseR, 0.13], [FAN.caseR - 0.006, 0.13]], [[FAN.caseR - 0.006, -0.52], [FAN.caseR, -0.52], [FAN.caseR, yMid], [FAN.caseR - 0.006, yMid]]], GM.acoustic(), { seg: 96 }));
  P('Fan case rub strip & acoustic liners', {
    system: 'Structure', material: 'Abradable filled-epoxy rub strip, perforated honeycomb liners', mass: 60,
    explode: [0, 1.15, 0], temp: 290,
    desc: 'The blade tips run about 5 mm inside a soft abradable strip: if the fan rubs, the strip wears instead of the blades, and the gap stays small for efficiency. Perforated honeycomb panels in front of and behind the fan absorb its tone.',
  }, [rub, acoustic]);

  // ------------------------------------------------------------------ outlet guide vanes
  const ogvY = -1.12;
  const [ogvIn, ogvOut] = bypassAt(ogvY);
  const ogvGeo = (keep) => ring(bladeGeometry({ rHub: ogvIn, rTip: ogvOut, chord: 0.26, stagger: [-14, -10], t: 0.075, camber: -0.07, y: ogvY, stations: 3, n: 8 }), 52, { keep });
  const ogv = cut(cutPair(ogvGeo, GM.painted()));
  P('Fan outlet guide vanes', {
    system: 'Propulsion', material: 'Composite vanes (count estimated)', mass: 210, count: 52,
    explode: [0, 0.7, 0], temp: 330,
    desc: 'Stationary vanes behind the fan that straighten the swirling bypass flow so it leaves the nozzle axially — swirl is wasted kinetic energy. GE does not publish the vane count; about 52 is modelled.',
  }, ogv).userData.part.stationTemp = '13';

  // ------------------------------------------------------------------ booster casing & splitter
  // One U-shaped section: a solid splitter nose, then two walls with the actuator cavity between
  // them, open aft onto the fan hub frame. The booster case (2 cm wall on the core flow path) ends
  // on the gooseneck's lip at y −1.60; the splitter's inner bypass wall (1.5 cm) ends on the frame's
  // mid ring at y −1.62.
  const NOSE_AFT = -0.86, CASE_AFT = -1.60, SHELL_AFT = -1.62, CASE_T = 0.02, SHELL_T = 0.015;
  const stations = (y0, y1) => { const out = []; for (let y = y0; y > y1 + 1e-6; y -= 0.06) out.push(y); out.push(y1); return out; };
  const tipAt = (y) => coreAt(y)[1], bypIn = (y) => bypassAt(y)[0];
  const splitterProf = [
    [0.872, -0.70],
    ...stations(-0.72, CASE_AFT).map((y) => [tipAt(y), y]),                       // core flow path, front to back
    ...stations(NOSE_AFT, CASE_AFT).reverse().map((y) => [tipAt(y) + CASE_T, y]),  // outside of the booster case
    ...stations(NOSE_AFT, SHELL_AFT).map((y) => [bypIn(y) - SHELL_T, y]),          // nose bulkhead, inside of the bypass wall
    ...stations(-0.72, SHELL_AFT).reverse().map((y) => [bypIn(y), y]),             // bypass flow path, back to front
    [0.885, -0.70],
  ];
  const splitter = cut(cutLathe(splitterProf, GM.casing(), { seg: 80 }));
  P('Booster casing & splitter', {
    system: 'Structure', material: 'Titanium splitter lip, aluminium casing and inner bypass wall', mass: 190,
    explode: [-0.55, 0.9, 0], temp: 300,
    desc: 'The sharp splitter lip divides the fan exit flow: about 1 kg of air in 8.1 goes down into the core, the other 7.1 kg into the bypass duct (take-off bypass ratio 7.1, ICAO databank). Behind the lip, the booster case that holds the stator vanes and the splitter\'s inner bypass wall part company; the cavity between them, closed at the back by the fan hub frame, houses the VBV actuators and unison ring, their servo-fuel tubes and harness leads, and the booster anti-ice duct.',
  }, splitter).userData.part.stationTemp = '13';

  // ------------------------------------------------------------------ booster (LP compressor) rows
  const bIGV = cut(cutPair((keep) => coreRow({ ...ROWS.boosterIGV, rotor: false, stagger: [-8, -12], camber: -0.03, t: 0.06 }, keep), GM.titanium()));
  P('Booster inlet guide vanes', {
    system: 'Propulsion', material: 'Titanium (count estimated)', mass: 22, count: ROWS.boosterIGV.count,
    explode: [-0.55, 0.9, 0], temp: 292,
    desc: 'Fixed vanes at the core inlet that set the swirl the first booster rotor wants to see.',
  }, bIGV).userData.part.stationTemp = '13';

  const boosterSpin = [];
  ROWS.boosterRotors.forEach((r, i) => {
    const m = coreRotor({ ...r, stagger: [42, 58], t: [0.07, 0.045] }, GM.titanium());
    m.userData.temp = lt('2', '25', 0.15 + i * 0.25);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n1.push({ rotor: m });
    boosterSpin.push(g);
    P(`Booster rotor ${i + 1}`, {
      system: 'Propulsion', material: 'Titanium blades (count estimated)', mass: 28 - i * 3, count: r.count,
      explode: [0, 0.9, 0],
      desc: i === 0
        ? 'First of four booster stages on the fan shaft. The -115B added the fourth stage, and dropped one HP-compressor stage, to push more air through a core of the same size as the earlier GE90s\'. Each turns at fan speed, N1, so the blades sit at large radius to get useful blade speed.'
        : i === 3
          ? 'Last booster stage. Together the fan hub and four booster stages raise core pressure about 2.3-fold before the HP compressor (modelled value; GE does not publish it).'
          : `Booster stage ${i + 1} rotor: each stage adds a pressure ratio of about 1.2.`,
    }, g);
  });
  ROWS.boosterStators.forEach((r, i) => {
    const s = cut(cutPair((keep) => coreRow({ ...r, rotor: false }, keep), GM.titanium()));
    P(i === 3 ? 'Booster outlet guide vanes' : `Booster stator ${i + 1}`, {
      system: 'Propulsion', material: 'Titanium vanes (count estimated)', mass: 14, count: r.count,
      explode: [-0.55, 0.9, 0],
      desc: i === 3
        ? 'Removes the last booster swirl before the air turns down the gooseneck duct towards the HP compressor.'
        : 'Stator vanes slow the air leaving each rotor, turning its velocity into pressure and setting it up for the next rotor.',
    }, s).userData.part.stationTemp = '25';
  });

  // booster spool (drum and disks) — axisymmetric, so it is drawn cut and does not need to turn
  const drum = [];
  const ys = ROWS.boosterRotors.map((r) => r.y);
  drum.push([[0.545, -0.74], [0.565, -0.74], [coreAt(-1.6)[0] - 0.012, -1.62], [coreAt(-1.6)[0] - 0.032, -1.62]]);
  for (const y of ys) {
    const h = coreAt(y)[0];
    drum.push([[h - 0.005, y + 0.035], [h, y + 0.035], [h, y - 0.035], [h - 0.005, y - 0.035], [h - 0.04, y - 0.015], [0.47, y - 0.012], [0.47, y + 0.012], [h - 0.04, y + 0.015]]);
  }
  const spool = cut(cutLathe(drum, GM.titanium(), { seg: 72 }));
  P('Booster spool', {
    system: 'Propulsion', material: 'Titanium drum and disks', mass: 160,
    explode: [0, 0.9, 0], temp: 320,
    desc: 'The drum that carries the four booster rotor stages. It is bolted to the back of the fan disk, so booster and fan always turn together at N1.',
  }, spool);

  // ------------------------------------------------------------------ fan hub frame
  const fr0 = -1.68, fr1 = -2.0;
  // gooseneck (transition) duct walls between booster exit and HPC inlet
  const gooseOut = [], gooseIn = [];
  for (let y = -1.6; y >= -2.1 - 1e-6; y -= 0.05) { const [h, t] = coreAt(y); gooseOut.push([t, y]); gooseIn.push([h, y]); }
  const FRAME = 'Cast and fabricated titanium / steel';
  P('Fan hub frame hub', {
    system: 'Structure', material: `${FRAME} hub ring`, mass: 140,
    explode: [0, 0, 0], temp: 330,
    desc: 'The inner ring of the engine\'s forward backbone. The cones of the forward sump hang from it, carrying the #1, #2 and #3 bearings, so the fan\'s whole weight and thrust come into the frame here.',
  }, cut(cutLathe([[0.3, fr0], [0.4, fr0], [0.4, fr1], [0.3, fr1]], GM.casingDark(), { seg: 64 })));
  P('Gooseneck duct', {
    system: 'Structure', material: `${FRAME} duct walls`, mass: 90,
    explode: [0, 0, 0], temp: 360,
    desc: 'The S-shaped transition that carries the core air down from the booster\'s large radius to the HP compressor\'s small one, through the frame. Its curvature has to be gentle enough that the flow does not separate from the inner wall.',
  }, cut(cutLathe([gooseOut.concat(gooseOut.slice().reverse().map(([r, y]) => [r + 0.025, y])), gooseIn.map(([r, y]) => [r - 0.03, y]).concat(gooseIn.slice().reverse())], GM.casingDark(), { seg: 64 }))).userData.part.stationTemp = '25';
  P('Fan hub frame core struts', {
    system: 'Structure', material: `${FRAME} hollow struts`, mass: 110, count: 12,
    explode: [0, 0, 0], temp: 360,
    desc: 'Twelve struts across the core duct between hub and mid ring. They are hollow: the radial drive shaft, the N1 probe, the #1-bearing accelerometer lead and the forward sump\'s oil and vent lines pass through them.',
  }, cut(cutPair((keep) => ring(bladeGeometry({ rHub: 0.39, rTip: 0.77, chord: 0.24, stagger: 0, t: 0.18, camber: 0, y: -1.83, stations: 2, n: 8, sweep: [0.05, -0.02] }), 12, { keep }), GM.casingDark())));
  P('Fan hub frame mid ring', {
    system: 'Structure', material: `${FRAME} ring`, mass: 160,
    explode: [0, 0, 0], temp: 320,
    desc: 'The ring between the core and bypass ducts that ties the two sets of struts together, with the variable-bypass-valve chutes through it. The core cowl and the reverser\'s inner wall start from its aft edge.',
  }, cut(cutLathe([[0.76, -1.62], [bypassAt(-1.62)[0], -1.62], [bypassAt(-2.02)[0], -2.02], [0.6, -2.02], [0.6, -1.95], [0.74, -1.9]], GM.casingDark(), { seg: 64 })));
  P('Fan hub frame bypass struts', {
    system: 'Structure', material: `${FRAME} hollow struts`, mass: 210, count: 12,
    explode: [0, 0, 0], temp: 300,
    desc: 'Twelve thick struts across the bypass duct to the outer ring. Their hollow insides are the passages between fan case and core: one carries the radial drive shaft, one the fuel, servo-fuel and oil-supply lines (6 o\'clock), one the scavenge line, one the N1 probe, harnesses and sense lines.',
  }, cut(cutPair((keep) => { const [a] = bypassAt(-1.78); return ring(bladeGeometry({ rHub: a - 0.02, rTip: 1.64, chord: 0.36, stagger: 0, t: 0.16, camber: 0, y: -1.78, stations: 1, n: 8 }), 12, { keep }); }, GM.casingDark())));
  P('Fan hub frame outer ring', {
    system: 'Structure', material: `${FRAME} ring`, mass: 110,
    explode: [0, 0, 0], temp: 300,
    desc: 'Bolted to the fan case\'s aft flange, it takes the struts\' loads into the case. The forward engine mount picks up the pylon on it at 12 o\'clock, so the frame carries the engine\'s weight.',
  }, cut(cutLathe([[FAN.caseR, -1.45], [1.72, -1.45], [1.72, -1.95], [1.62, -1.95]], GM.casingDark(), { seg: 64 })));

  // ------------------------------------------------------------------ variable bleed valves
  const vbv = (keep) => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const phi = Math.PI / 2 + ((i + 0.5) / 12) * Math.PI * 2;
      if (!keep(phi)) continue;
      // door hinged at its aft edge with its forward edge swung inward into the flow, so that,
      // open, it scoops the air and debris running along the outer wall out through the hole
      list.push(slab([[0.703, -1.645], [0.718, -1.645], [0.752, -1.76], [0.737, -1.76]], phi - 0.16, phi + 0.16, 6));
      // chute through the frame that dumps the bled air into the bypass stream
      list.push(boxAt(0.86, -1.72, phi, [0.2, 0.08, 0.12]));
      list.push(boxAt(0.81, -1.67, phi + 0.11, [0.14, 0.02, 0.02]));
    }
    // unison ring that drives all the doors together
    list.push(lathe([[0.79, -1.64], [0.81, -1.64], [0.81, -1.62], [0.79, -1.62], [0.79, -1.64]], 48 * keep.arc / Math.PI / 2 | 0, keep.start, keep.arc));
    return merge(list);
  };
  const vbvGrp = cut(cutPair(vbv, GM.steel()));
  P('Variable bypass valves (VBV)', {
    system: 'Propulsion', material: 'Steel doors and unison ring (door count estimated)', mass: 70, count: 12,
    explode: [-0.4, 0.25, 0.35], temp: 330,
    desc: 'Doors in the duct between booster and HP compressor, which GE\'s manuals call variable bypass valves. At low power and during rapid throttle changes the booster pumps more air than the core can swallow; the FADEC opens these doors to dump the excess into the bypass and keep the booster from stalling. They open inward into the flow, so they also scoop out sand, hail and ice flung to the outer wall — GE calls it a FOD-free core.',
  }, vbvGrp).userData.part.stationTemp = '25';

  // two fuel-powered actuators on the frame that turn the unison ring through bellcranks
  const vbvAct = cutPair((keep) => {
    const list = [];
    for (const phi of [0.75, 0.75 + Math.PI]) {
      if (!keep(phi)) continue;
      list.push(axialCyl(0.86, -1.43, phi, 0.028, 0.26, 16), axialCyl(0.86, -1.27, phi, 0.018, 0.06, 12));
      // head-end clevis bracket and a mid-body steady bracket, both bolted to the booster case
      for (const [y0, y1, top] of [[-1.25, -1.29, 0.852], [-1.43, -1.47, 0.84]]) list.push(slab([[coreAt(y0)[1] + CASE_T + 0.0002, y0], [coreAt(y1)[1] + CASE_T + 0.0002, y1], [top, y1], [top, y0]], phi - 0.018, phi + 0.018, 3));
      list.push(tube([P3(0.86, -1.56, phi), P3(0.84, -1.6, phi + 0.02), P3(0.81, -1.63, phi + 0.04)], 0.009, { seg: 8 }));
      list.push(boxAt(0.81, -1.625, phi + 0.04, [0.05, 0.03, 0.04]));
    }
    return merge(list);
  }, GM.steel());
  P('VBV actuators', {
    system: 'Propulsion', material: 'Parker fuel-powered actuators with bellcranks (count and position estimated)', mass: 14, count: 2,
    explode: [-0.4, 0.25, 0.75], temp: 330,
    desc: 'High-pressure fuel from the HMU, used as hydraulic fluid and fed through a pair of servo tubes, drives these two Parker rams, bracketed to the booster case inside the splitter cavity; through bellcranks they rotate the unison ring that opens and closes all the bypass-valve doors together. A position sensor in each tells the FADEC where the doors are.',
  }, cut(vbvAct));

  void SKIN;
}
