// Fan module and LP compressor (booster): spinner, 22 swept composite fan blades, fan disk,
// Kevlar-wrapped containment case, outlet guide vanes, fan hub frame, 4-stage booster and its
// variable bleed valves.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe } from '../../engine/geometry.js';
import { M, SKIN } from '../../engine/materials.js';
import { GM } from './materials.js';
import { FAN, ROWS, coreAt, bypassAt } from './layout.js';
import { cutLathe, cutPair, bladeGeometry, ring, wall, sector, boxAt, kept, merge } from './geom.js';

const D2R = Math.PI / 180;

/** Fan blade: swept wide-chord composite; with sheath = true, the titanium leading-edge strip. */
function fanBlade(sheath = false) {
  const chord = (f) => 0.5 + 0.17 * Math.sin(Math.min(1, f * 1.4) * (Math.PI / 2));
  const stagger = (f) => 24 + 38 * Math.pow(f, 0.85);
  // leading edge: swept forward over the inner span, then back at the tip (the -115B's swept fan)
  const le = (f) => 0.085 * Math.sin(Math.PI * 0.9 * f) - 0.1 * f * f * f;
  return bladeGeometry({
    rHub: FAN.hubR - 0.004, rTip: FAN.tipR - 0.004,
    chord, stagger, t: (f) => 0.11 - 0.08 * f, camber: (f) => 0.09 - 0.065 * f,
    sweep: (f) => le(f) - 0.5 * chord(f) * Math.cos(stagger(f) * D2R),
    lean: (f) => 0.05 * f * f,
    stations: 12, n: sheath ? 6 : 16,
    ...(sheath ? { c0: 0, c1: 0.1, scale: 1.18 } : {}),
  });
}

/** A blade row sized to the core annulus at y. Rotors leave a tip gap, stators a hub gap. */
export function coreRow({ y, chord, count, rotor = true, stagger = rotor ? [38, 56] : [-24, -32], t = [0.07, 0.05], camber = rotor ? 0.05 : -0.05, stations = 2, n = 6, ann = coreAt, gap = 0.003, phase = 0 }, keep) {
  const [hub, tip] = ann(y);
  const g = bladeGeometry({ rHub: rotor ? hub : hub + gap, rTip: rotor ? tip - gap : tip, chord, stagger, t, camber, y, stations, n });
  return ring(g, count, { keep, phase });
}

export function buildFan(ctx) {
  const { P, T, lt, cut } = ctx;

  // ------------------------------------------------------------------ spinner (turns with N1)
  const spinnerGeo = lathe([[0.001, 0.8], [0.05, 0.765], [0.12, 0.68], [0.2, 0.57], [0.28, 0.45], [0.35, 0.33], [0.41, 0.21], [0.45, 0.11], [0.468, 0.03], [0.47, 0.0]], 72);
  const spinner = mesh(spinnerGeo, M.spinner());
  const spinSpinner = new THREE.Group();
  spinSpinner.add(spinner);
  ctx.spin.n1.push(spinSpinner);
  P('Spinner', {
    system: 'Propulsion', material: 'Composite cone, painted spiral', mass: 45,
    explode: [0, 3.0, 0], temp: 288,
    desc: 'A long cone that turns the incoming air smoothly onto the fan hub. The white spiral lets ground crew see at a glance whether the fan is turning.',
  }, spinSpinner).userData.part.stationTemp = '2';

  // ------------------------------------------------------------------ fan blades
  const blades = mesh(ring(fanBlade(false), FAN.blades), GM.composite());
  const sheaths = mesh(ring(fanBlade(true), FAN.blades), GM.tiSheath());
  blades.userData.temp = lt('2', '13', 0.5);
  const spinFan = new THREE.Group();
  spinFan.add(blades, sheaths);
  ctx.spin.n1.push(spinFan);
  P('Fan blades', {
    system: 'Propulsion', material: 'Carbon-fibre / toughened-epoxy composite, titanium leading-edge sheath', mass: 480, count: 22,
    explode: [0, 2.3, 0],
    desc: '22 wide-chord swept composite blades, each about 1.2 m long and under 23 kg; the fan is 3.25 m (128 in) across. At take-off the tips run supersonic, and the fan alone makes roughly four fifths of the thrust. A titanium sheath protects each leading edge from birds, hail and erosion.',
    callout: true, anchor: [-1.15, -0.1, 0.25],
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
    desc: 'Holds the 22 blade roots in dovetail slots and carries their centrifugal pull — about 90 tonnes-force per blade at take-off N1. Composite platforms between the roots form the smooth inner flow surface.',
  }, disk);

  // ------------------------------------------------------------------ fan containment case
  const yF = 0.3, yMid = -0.72, yAft = -1.45;
  const caseShell = [
    // forward flange (A-flange) and containment barrel
    [[FAN.caseR, yF], [1.77, yF], [1.77, yF - 0.03], [1.668, yF - 0.03], [1.668, yMid + 0.03], [1.77, yMid + 0.03], [1.77, yMid], [FAN.caseR, yMid]],
    // aft fan case with the OGV ring and its aft flange
    [[FAN.caseR, yMid - 0.01], [1.73, yMid - 0.01], [1.69, yMid - 0.06], [1.69, yAft + 0.03], [1.77, yAft + 0.03], [1.77, yAft], [FAN.caseR, yAft]],
  ];
  const caseGrp = cut(cutLathe(caseShell, GM.fanCase(), { seg: 96 }));
  const kevlar = cut(cutLathe([[1.668, 0.18], [1.738, 0.16], [1.738, -0.62], [1.668, -0.64]], GM.kevlar(), { seg: 96 }));
  // stiffening ribs and abradable rub strip over the blade tips
  const ribs = cut(cutLathe([0.05, -0.2, -0.45].map((y) => [[1.738, y + 0.012], [1.758, y + 0.012], [1.758, y - 0.012], [1.738, y - 0.012]]), GM.fanCase(), { seg: 96 }));
  const rub = cut(cutLathe([[FAN.caseR - 0.012, 0.12], [FAN.caseR, 0.12], [FAN.caseR, -0.5], [FAN.caseR - 0.012, -0.5]], GM.rubStrip(), { seg: 96 }));
  const acoustic = cut(cutLathe([[[FAN.caseR - 0.006, yF], [FAN.caseR, yF], [FAN.caseR, 0.13], [FAN.caseR - 0.006, 0.13]], [[FAN.caseR - 0.006, -0.52], [FAN.caseR, -0.52], [FAN.caseR, yMid], [FAN.caseR - 0.006, yMid]]], GM.acoustic(), { seg: 96 }));
  P('Fan containment case', {
    system: 'Structure', material: 'Aluminium case wrapped in Kevlar fabric, abradable rub strip', mass: 1150,
    explode: [0, 1.15, 0], temp: 290,
    desc: 'If a blade ever breaks off at full power, the many layers of Kevlar wound round the case stretch and catch it — certification requires a deliberate blade-off test at take-off speed. The case also carries the fan cowls, the accessory gearbox, FADEC and oil tank.',
    callout: true, anchor: [-0.6, -0.15, 1.7],
  }, [caseGrp, kevlar, ribs, rub, acoustic]);

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
  const casingFwd = -0.72, casingAft = -1.66;
  const inner = [];
  for (let y = casingFwd; y >= casingAft - 1e-6; y -= 0.06) inner.push([coreAt(y)[1], y]);
  const outer = [];
  for (let y = casingAft; y <= casingFwd + 1e-6; y += 0.06) outer.push([bypassAt(y)[0], y]);
  const splitterProf = [[0.872, -0.70], ...inner, ...outer.slice(0, -1), [0.885, -0.70]];
  const splitter = cut(cutLathe(splitterProf, GM.casing(), { seg: 80 }));
  P('Booster casing & splitter', {
    system: 'Structure', material: 'Titanium splitter lip, aluminium casing', mass: 190,
    explode: [-0.55, 0.85, 0], temp: 300,
    desc: 'The sharp splitter lip divides the fan exit flow: about 1 kg of air in 8.2 goes down into the core, the other 7.2 kg into the bypass duct. The casing behind it holds the booster stator vanes.',
  }, splitter).userData.part.stationTemp = '13';

  // ------------------------------------------------------------------ booster (LP compressor) rows
  const bIGV = cut(cutPair((keep) => coreRow({ ...ROWS.boosterIGV, rotor: false, stagger: [-8, -12], camber: -0.03, t: 0.06 }, keep), GM.titanium()));
  P('Booster inlet guide vanes', {
    system: 'Propulsion', material: 'Titanium (count estimated)', mass: 22, count: ROWS.boosterIGV.count,
    explode: [-0.55, 1.0, 0], temp: 292,
    desc: 'Fixed vanes at the core inlet that set the swirl the first booster rotor wants to see.',
  }, bIGV).userData.part.stationTemp = '13';

  const boosterSpin = [];
  ROWS.boosterRotors.forEach((r, i) => {
    const m = mesh(coreRow({ ...r, stagger: [42, 58], t: [0.07, 0.045] }), GM.titanium());
    m.userData.temp = lt('2', '25', 0.15 + i * 0.25);
    const g = new THREE.Group();
    g.add(m);
    ctx.spin.n1.push(g);
    boosterSpin.push(g);
    P(`Booster rotor ${i + 1}`, {
      system: 'Propulsion', material: 'Titanium blades (count estimated)', mass: 28 - i * 3, count: r.count,
      explode: [0, 0.95 - i * 0.04, 0],
      desc: i === 0
        ? 'First of four booster stages on the fan shaft (the -115B added the fourth stage to supercharge its larger core). Each turns at fan speed, N1, so the blades sit at large radius to get useful blade speed.'
        : i === 3
          ? 'Last booster stage. Together the fan hub and four booster stages raise core pressure about 2.3-fold before the HP compressor (modelled value; GE does not publish it).'
          : `Booster stage ${i + 1} rotor: each stage adds a pressure ratio of about 1.2.`,
    }, g);
  });
  ROWS.boosterStators.forEach((r, i) => {
    const s = cut(cutPair((keep) => coreRow({ ...r, rotor: false }, keep), GM.titanium()));
    P(i === 3 ? 'Booster outlet guide vanes' : `Booster stator ${i + 1}`, {
      system: 'Propulsion', material: 'Titanium vanes (count estimated)', mass: 14, count: r.count,
      explode: [-0.55, 0.92 - i * 0.04, 0],
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
  const frame = [];
  // gooseneck (transition) duct walls between booster exit and HPC inlet
  const gooseOut = [], gooseIn = [];
  for (let y = -1.6; y >= -2.1 - 1e-6; y -= 0.05) { const [h, t] = coreAt(y); gooseOut.push([t, y]); gooseIn.push([h, y]); }
  frame.push(gooseOut.concat(gooseOut.slice().reverse().map(([r, y]) => [r + 0.025, y])));
  frame.push(gooseIn.map(([r, y]) => [r - 0.03, y]).concat(gooseIn.slice().reverse()));
  // hub ring that carries the forward sump, and the outer core-duct ring under the bypass wall
  frame.push([[0.3, fr0], [0.4, fr0], [0.4, fr1], [0.3, fr1]]);
  frame.push([[0.76, -1.62], [bypassAt(-1.62)[0], -1.62], [bypassAt(-2.02)[0], -2.02], [0.6, -2.02], [0.6, -1.95], [0.74, -1.9]]);
  // outer frame ring at the fan case aft flange
  frame.push([[FAN.caseR, -1.45], [1.72, -1.45], [1.72, -1.95], [1.62, -1.95]]);
  const frameRings = cut(cutLathe(frame, GM.casingDark(), { seg: 80 }));
  // struts: 12 through the bypass duct (one carries the radial drive shaft), and 12 in the core duct
  const strutBy = (keep) => {
    const [a] = bypassAt(-1.78);
    const g = bladeGeometry({ rHub: a - 0.02, rTip: 1.64, chord: 0.36, stagger: 0, t: 0.16, camber: 0, y: -1.78, stations: 1, n: 8 });
    return ring(g, 12, { keep });
  };
  const strutCore = (keep) => {
    const g = bladeGeometry({ rHub: 0.39, rTip: 0.77, chord: 0.24, stagger: 0, t: 0.18, camber: 0, y: -1.83, stations: 2, n: 8, sweep: [0.05, -0.02] });
    return ring(g, 12, { keep });
  };
  const sBy = cut(cutPair(strutBy, GM.casingDark()));
  const sCore = cut(cutPair(strutCore, GM.casingDark()));
  P('Fan hub frame', {
    system: 'Structure', material: 'Cast and fabricated titanium / steel frame', mass: 820,
    explode: [0, 0, 0], temp: 320,
    desc: 'The engine\'s forward backbone: struts across the core and bypass ducts tie the fan case to the hub that holds the forward bearings, and the forward mount picks up the pylon here. One bypass strut is hollow for the radial drive shaft, another carries the fuel and oil lines.',
  }, [frameRings, sBy, sCore]);

  // ------------------------------------------------------------------ variable bleed valves
  const vbv = (keep) => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const phi = Math.PI / 2 + ((i + 0.5) / 12) * Math.PI * 2;
      if (!keep(phi)) continue;
      // door hinged at its aft edge, cracked open into the duct wall
      const door = sector(0.735, 0.752, -1.64, -1.76, phi - 0.16, phi + 0.16, 6);
      door.rotateX(0);
      list.push(door);
      // chute through the frame that dumps the bled air into the bypass stream
      list.push(boxAt(0.86, -1.72, phi, [0.2, 0.08, 0.12]));
      list.push(boxAt(0.81, -1.67, phi + 0.11, [0.14, 0.02, 0.02]));
    }
    // unison ring that drives all the doors together
    list.push(...[lathe([[0.79, -1.62], [0.81, -1.62], [0.81, -1.64], [0.79, -1.64], [0.79, -1.62]], 64)]);
    return merge(list);
  };
  const vbvGrp = cut(cutPair(vbv, GM.steel()));
  P('Variable bleed valves', {
    system: 'Propulsion', material: 'Steel doors, unison ring and fuel-powered actuators (count estimated)', mass: 70, count: 12,
    explode: [-0.4, 0.25, 0.35], temp: 330,
    desc: 'Doors in the duct between booster and HP compressor. At low power and during rapid throttle changes the booster pumps more air than the core can swallow; the FADEC opens these doors to dump the excess into the bypass and keep the booster from stalling.',
    callout: true, anchor: [0.75, -1.7, 0.2],
  }, vbvGrp).userData.part.stationTemp = '25';

  void kept; void SKIN; void wall;
}
