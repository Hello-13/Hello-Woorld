// MQ-9A fuel system. The Predator B carries its 3,900 lb (1,778 kg) of internal fuel in seven
// tanks: three bladder cells in line in the fuselage (forward, header, aft) and an inboard and an
// outboard tank in each wing (NTSB CHI06MA121; USAF accident reports). The engine draws only from
// the header tank, kept full by jet pumps: two pumps on the header send pressurised "motive" fuel
// along a manifold, solenoid valves route it to the jet pump in the selected tank, and each jet
// pump's suction pulls that tank's fuel into the header. Jet pumps have no moving parts, so no
// motors sit in the wing tanks. Tank sizes and every routing here are estimates.

import * as THREE from 'three';
import { wingPanel, loftRings } from '../../engine/geometry.js';
import { X, prof, fusePoint, merge, box, lru, cylX, tubeBetween, pipe, applyMat, WING, wsec, W_ROOT, W_TIP, wpt, ribGeo } from './shape.js';

const deg = Math.PI / 180;
const SN = (s) => (s > 0 ? 'starboard' : 'port');
const mirror = (g) => applyMat(g.clone(), new THREE.Matrix4().makeScale(1, 1, -1));
const zE = (z) => (z - W_ROOT.le[2]) / (W_TIP.le[2] - W_ROOT.le[2]);
const twistAt = (z) => WING.twist * zE(z);
const twistGeo = (g, z) => { const s = wsec(z); return g.translate(-s.le[0], -s.le[1], 0).rotateZ(twistAt(z) * deg).translate(s.le[0], s.le[1], 0); };
const W = (z, cf, side, inset, zs) => { const p = wpt(z, cf, side, inset); return [p[0], p[1], p[2] * zs]; };

export const CELLS = { fwd: [3.42, 4.05], header: [4.12, 4.74], aft: [6.55, 7.3] };
export const WTANK = { inb: [0.5, 4.4], outb: [4.5, 8.4], rib: 4.45 };
const WING_TOP = 1.53;            // underside of the wing carry-through box over the header cell

/** Signed volume of a closed mesh (m³). */
export function volume(g) {
  const p = g.attributes.position, idx = g.index ? g.index.array : null;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  const n = idx ? idx.length : p.count;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx[i] : i); b.fromBufferAttribute(p, idx ? idx[i + 1] : i + 1); c.fromBufferAttribute(p, idx ? idx[i + 2] : i + 2);
    v += a.dot(b.cross(c));
  }
  return Math.abs(v / 6);
}

function outward(gm) {
  const p = gm.attributes.position, idx = gm.index.array;
  let vol = 0;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) { va.fromBufferAttribute(p, idx[i]); vb.fromBufferAttribute(p, idx[i + 1]); vc.fromBufferAttribute(p, idx[i + 2]); vol += va.dot(vb.cross(vc)); }
  if (vol < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  gm.computeVertexNormals();
  return gm;
}

/** Bladder cell between stations s0..s1, inset from the skin, its top held below `top(s)`. */
function cellGeo(s0, s1, top, n = 32) {
  const ss = [s0, s0 + 0.04, ...[0.25, 0.5, 0.75].map((t) => s0 + (s1 - s0) * t), s1 - 0.04, s1];
  return outward(loftRings(ss.map((s) => {
    const end = s === s0 || s === s1;
    const shrink = end ? 0.085 : 0.06;
    const yTop = top(s) - (end ? 0.025 : 0);
    const rr = [];
    for (let i = 0; i < n; i++) {
      const p = fusePoint(s, -Math.PI / 2 + (i / n) * Math.PI * 2, shrink);
      p[1] = Math.min(p[1], yTop);
      rr.push(p);
    }
    return rr;
  }), { capStart: true, capEnd: true, uvMode: 'metric' }));
}

/** Wing tank between the spars from span z0 to z1. */
function wingTankGeo(z0, z1) {
  const r0 = wsec(z0), r1 = wsec(z1);
  return twistGeo(wingPanel({ root: { ...r0, t: r0.t * 0.9 }, tip: { ...r1, t: r1.t * 0.9 }, c0: 0.165, c1: 0.675, stations: 8, twist: twistAt(z1) - twistAt(z0), withChord: false }), z0);
}

/** Jet pump: a small venturi body with its motive-fuel nozzle, lying along x. */
function jetPump(p, len = 0.12) {
  return merge([cylX(p[0] - len / 2, p[0] + len * 0.1, 0.02, 0.014, p[1], p[2], 10), cylX(p[0] + len * 0.1, p[0] + len / 2, 0.014, 0.022, p[1], p[2], 10), cylX(p[0] + len * 0.28, p[0] + len * 0.4, 0.008, 0.008, p[1] + 0.022, p[2], 6)]);
}

/** Build the fuel parts. ctx: { P, L, m }. Returns the litres per tank and attachment points. */
export function buildFuel({ P, L, m }) {
  const litres = {};
  const L_PER_KG = 1 / 0.81;
  const cellTop = (s) => (s < 4.1 ? prof(s).top - 0.1 : WING_TOP);
  // ---- fuselage cells
  const fwdG = cellGeo(...CELLS.fwd, cellTop), hdrG = cellGeo(...CELLS.header, () => WING_TOP), aftG = cellGeo(...CELLS.aft, (s) => prof(s).top - 0.1);
  litres.fwd = volume(fwdG) * 1000 * 0.97; litres.header = volume(hdrG) * 1000 * 0.97; litres.aft = volume(aftG) * 1000 * 0.97;
  const lt = (v) => `≈ ${Math.round(v / 10) * 10} L`;
  P('Forward fuel cell', {
    system: 'Fuel', material: 'Crash-resistant bladder cell', mass: 9, explode: [0.45, -0.95, 0],
    desc: `The first of three bladder tanks in line in the fuselage, behind the avionics bay (${lt(litres.fwd)} in this model). In a 2020 loss over Africa the crew locked out both wing tanks, whose automatic mode kept drawing on them, and selected this tank by hand to refill the header (USAF investigation).`,
  }, L(fwdG, m.fuel));
  P('Header fuel cell', {
    system: 'Fuel', material: 'Crash-resistant bladder cell', mass: 8, explode: [0, -1.15, 0],
    desc: `The tank the engine draws from, under the wing box at the centre of gravity (${lt(litres.header)} here). The system keeps it full by refilling it from the other six tanks, so the engine never sees an empty or sloshing tank, and its position means a full or empty header barely moves the balance.`,
  }, L(hdrG, m.fuel));
  P('Aft fuel cell', {
    system: 'Fuel', material: 'Crash-resistant bladder cell', mass: 7, explode: [-0.45, -0.95, 0],
    desc: `The third fuselage bladder, between the main-gear wells and the accessory bay (${lt(litres.aft)} here). Fuel aft of the centre of gravity is used in turn with the forward cell so that the balance stays within limits as the aircraft burns 3,900 lb of fuel.`,
  }, L(aftG, m.fuel));

  // ---- wing tanks, closing ribs, wing jet pumps, transfer lines, vents (each side)
  const sides = {};
  for (const side of [1, -1]) {
    const f = (g) => (side > 0 ? g : mirror(g));
    const sn = SN(side);
    const inb = wingTankGeo(...WTANK.inb), outb = wingTankGeo(...WTANK.outb);
    litres.inb = volume(inb) * 1000 * 0.97; litres.outb = volume(outb) * 1000 * 0.97;
    P(`Inboard wing tank (${sn})`, {
      system: 'Fuel', material: 'Sealed bay between the spars (est.)', mass: 10, explode: [0, -0.35, 1.9 * side],
      desc: `The inboard of the two tanks in each wing (NTSB), between the spars from the root to 4.4 m out (${lt(litres.inb)} in this model). Wing fuel sits where the lift is, so it relieves wing bending; a jet pump at its low point empties it into the header tank.`,
      callout: side > 0, anchor: W(4.25, 0.5, 1, 0, side),   // upper skin near the outboard end of the tank, clear of the stores labels
    }, L(f(inb), m.fuel));
    P(`Outboard wing tank (${sn})`, {
      system: 'Fuel', material: 'Sealed bay between the spars (est.)', mass: 7, explode: [0, -0.35, 2.6 * side],
      desc: `The outboard tank, 4.5–8.4 m out, behind a closing rib (${lt(litres.outb)} here). Weight this far out relieves the most wing bending, so it is usually emptied last; a jet pump by its inboard end transfers it.`,
    }, L(f(outb), m.fuel));
    P(`Tank closing rib (${sn})`, {
      system: 'Structure', material: 'Machined aluminium sealed rib (est.)', mass: 2, explode: [0, -0.1, 2.25 * side],
      desc: 'A sealed rib 4.45 m out that divides the wing’s fuel bay into its inboard and outboard tanks, with sealed pass-throughs for the motive-fuel and transfer lines (position estimated).',
    }, L(f(ribGeo(WTANK.rib, 0.16, 0.68, { th: 0.016 })), m.primer));
    const jpI = W(1.0, 0.6, -1, 0.035, 1), jpO = W(4.62, 0.6, -1, 0.03, 1);
    P(`Wing jet pumps (${sn})`, {
      system: 'Fuel', material: 'Venturi jet pumps, no moving parts', mass: 0.6, count: 2, explode: [0, -0.7, 1.9 * side],
      desc: 'One at the low point of each wing tank, near the lower skin. Motive fuel squirts through a nozzle into a venturi, and the low pressure it makes draws the surrounding tank fuel along with it into the transfer line. With no motor or moving part inside the tank there is nothing to wear or spark.',
    }, L(f(merge([jetPump(jpI), jetPump(jpO)])), m.darkMetal));
    const rootIn = [X(4.75), 1.6, 0.36];
    const xfer = [
      pipe([[jpO[0] - 0.06, jpO[1], jpO[2]], W(3.2, 0.62, -1, 0.04, 1), W(1.6, 0.62, -1, 0.04, 1), [jpI[0] - 0.06, jpI[1] + 0.01, jpI[2] + 0.04]], 0.009, 6, 40),
      pipe([[jpI[0] - 0.06, jpI[1], jpI[2]], W(0.6, 0.55, -1, 0.04, 1), rootIn, [X(4.6), 1.5, 0.2]], 0.011, 6, 24),
    ];
    P(`Wing transfer lines (${sn})`, {
      system: 'Fuel', material: 'Aluminium tube with flexible joints at the wing root', mass: 1.5, count: 2, explode: [0, 0.35, 1.4 * side],
      desc: 'Carry what the jet pumps draw from the outboard and inboard tanks along the rear spar, across the wing joint and into the top of the header cell (routing estimated).',
    }, L(f(merge(xfer)), m.pipe));
    const selTop = prof(4.8).bot + 0.185;
    const motive = pipe([[X(4.8), selTop, 0.02], [X(4.81), selTop + 0.05, 0.2], [X(4.8), 1.45, 0.33], [X(4.76), 1.58, 0.37], W(0.5, 0.645, -1, 0.05, 1), W(2.0, 0.645, -1, 0.05, 1), W(3.4, 0.645, -1, 0.05, 1), W(4.7, 0.645, -1, 0.045, 1), [jpO[0] + 0.05, jpO[1] + 0.02, jpO[2] + 0.03]], 0.006, 5, 48);
    const motiveI = pipe([W(1.0, 0.645, -1, 0.05, 1), [jpI[0] + 0.05, jpI[1] + 0.02, jpI[2]]], 0.005, 5, 6);
    P(`Wing motive-fuel line (${sn})`, {
      system: 'Fuel', material: 'Stainless tube, 12 mm', mass: 0.6, explode: [0, 0.55, 1.6 * side],
      desc: 'The jet-pump manifold’s branch along the wing’s rear spar: pressurised fuel from the header pumps, released by its solenoid valve, drives the two wing jet pumps (routing estimated).',
    }, L(f(merge([motive, motiveI])), m.copper));
    const ventG = [];
    for (const [z, cf] of [[3.9, 0.3], [8.0, 0.3]]) ventG.push(pipe([W(z, cf, 1, 0.03, 1), W(z + 0.4, cf + 0.1, 0, 0, 1), W(8.85, 0.5, 0, 0, 1), W(9.1, 0.5, -1, 0.02, 1)], 0.007, 5, 20));
    ventG.push(box(0.12, 0.012, 0.05, W(9.1, 0.5, -1, -0.002, 1)));
    P(`Wing fuel vents (${sn})`, {
      system: 'Fuel', material: 'Vent lines to a flush under-wing outlet', mass: 0.8, count: 2, explode: [0, -0.1, 2.9 * side],
      desc: 'A vent from the high point of each wing tank runs outboard to a flush outlet under the wingtip, letting air in as fuel is used and letting fuel expand in the heat of the ramp without straining the tank.',
    }, L(f(merge(ventG)), m.pipe));
    sides[side] = { jpI, jpO };
  }

  // ---- header pumps, jet-pump manifold and selector valves, fuselage jet pumps
  const pumpY = prof(4.45).bot + 0.085;
  P('Header tank pumps', {
    system: 'Fuel', material: 'Two electric fuel pumps on the header cell', mass: 3, count: 2, explode: [0, -1.45, 0.45],
    desc: 'Two electric pumps on the floor of the header cell. They feed the engine and also send fuel at pressure to the jet-pump manifold that refills the header from the other tanks; either can do the job alone.',
  }, L(merge([1, -1].map((zs) => merge([cylX(X(4.62), X(4.36), 0.036, 0.036, pumpY, 0.19 * zs, 14), cylX(X(4.36), X(4.31), 0.022, 0.022, pumpY, 0.19 * zs, 10), box(0.05, 0.05, 0.05, [X(4.6), pumpY + 0.045, 0.19 * zs])]))), m.darkMetal));
  const selS = 4.8, selY = prof(selS).bot + 0.12;
  const sel = [lru(0.06, 0.06, 0.24, [X(selS), selY, 0], 0.01)];
  for (let k = 0; k < 6; k++) sel.push(cylX(X(selS) - 0.014, X(selS) + 0.014, 0.013, 0.013, selY + 0.05, -0.1 + k * 0.04, 8), tubeBetween([X(selS), selY + 0.03, -0.1 + k * 0.04], [X(selS), selY + 0.065, -0.1 + k * 0.04], 0.009, 8));
  P('Jet-pump selector valves', {
    system: 'Fuel', material: 'Manifold block with six solenoid valves', mass: 1.5, count: 6, explode: [0, -1.25, -0.6],
    desc: 'One solenoid valve per tank on a block between the header cell and the gear wells. Opening a valve routes motive fuel to that tank’s jet pump; the flight computers sequence them in automatic mode and the crew can select a tank by hand (positions estimated).',
  }, L(merge(sel), m.lruOlive));
  const fwdJP = [X(3.52), prof(3.52).bot + 0.085, 0], aftJP = [X(7.2), prof(7.2).bot + 0.085, 0];
  P('Fuselage jet pumps', {
    system: 'Fuel', material: 'Venturi jet pumps', mass: 0.4, count: 2, explode: [0, -1.4, 0],
    desc: 'At the low points of the forward and aft cells. Like the wing jet pumps they have no moving parts: motive fuel from the manifold drags each cell’s fuel through a transfer line into the header.',
  }, L(merge([jetPump(fwdJP), jetPump(aftJP)]), m.darkMetal));
  const keelY = 1.15;
  const manifold = [
    pipe([[X(4.36), pumpY, 0.19], [X(4.5), pumpY - 0.02, 0.1], [X(selS) + 0.03, selY - 0.01, 0.06]], 0.006, 5, 12),
    pipe([[X(4.36), pumpY, -0.19], [X(4.5), pumpY - 0.02, -0.1], [X(selS) + 0.03, selY - 0.01, -0.06]], 0.006, 5, 12),
    pipe([[X(selS) - 0.03, selY, 0.01], [X(5.0), keelY, 0.0], [X(6.0), keelY + 0.01, 0.0], [X(6.6), prof(6.6).bot + 0.1, 0], [aftJP[0] + 0.05, aftJP[1] + 0.02, 0]], 0.006, 5, 40),
    pipe([[X(selS) + 0.02, selY + 0.01, -0.03], [X(4.4), prof(4.4).bot + 0.05, -0.08], [X(3.9), prof(3.9).bot + 0.06, -0.06], [fwdJP[0] - 0.05, fwdJP[1] + 0.02, 0]], 0.006, 5, 24),
  ];
  P('Jet-pump motive manifold', {
    system: 'Fuel', material: 'Stainless tube, 12 mm', mass: 1, explode: [0, -1.65, 0],
    desc: 'Carries pressurised fuel from the header pumps to the selector block and on to every jet pump: forward to the forward cell, aft along the keel between the gear wells to the aft cell, and out along each wing (routing estimated).',
  }, L(merge(manifold), m.copper));
  const xferF = [
    pipe([[fwdJP[0] - 0.06, fwdJP[1], 0.04], [X(3.8), fwdJP[1] + 0.01, 0.08], [X(4.08), fwdJP[1] + 0.03, 0.1], [X(4.2), prof(4.2).bot + 0.12, 0.1]], 0.012, 6, 20),
    pipe([[aftJP[0] - 0.06, aftJP[1], 0.03], [X(6.6), prof(6.6).bot + 0.11, 0.03], [X(6.0), keelY + 0.02, 0.025], [X(5.0), keelY + 0.02, 0.025], [X(4.76), prof(4.74).bot + 0.14, 0.05]], 0.012, 6, 40),
  ];
  P('Fuselage transfer lines', {
    system: 'Fuel', material: 'Aluminium tube', mass: 1.5, count: 2, explode: [0, -1.85, 0],
    desc: 'Carry the forward and aft cells’ fuel into the header: the aft line runs along the keel between the main-gear wells (routing estimated).',
  }, L(merge(xferF), m.pipe));

  // ---- engine feed: header → forward electric heater → FSOV at the firewall → engine
  const heaterP = [X(7.55), 1.34, 0.17];
  P('Forward electric fuel heater', {
    system: 'Fuel', material: 'Electric in-line heater', mass: 2, explode: [0.2, -0.7, 0.85],
    desc: 'Warms the engine feed electrically so that water in the fuel cannot freeze into filter-blocking ice at altitude. A leak at this heater drained an MQ-9A over Africa in 2020; the crew was told to crash it and the loss was $11.29 million (USAF investigation; position estimated).',
  }, L(merge([cylX(heaterP[0] - 0.09, heaterP[0] + 0.09, 0.04, 0.04, heaterP[1], heaterP[2], 14), box(0.05, 0.03, 0.05, [heaterP[0], heaterP[1] + 0.045, heaterP[2]]), cylX(heaterP[0] - 0.1, heaterP[0] + 0.1, 0.044, 0.044, heaterP[1], heaterP[2], 14, true)]), m.lruOlive));
  const fsovP = [X(8.92), 1.43, 0.2];
  P('Electrical fuel shutoff valve (FSOV)', {
    system: 'Fuel', material: 'Motorised valve at the firewall', mass: 1, explode: [0.2, -0.6, 0.95],
    desc: 'The aircraft’s electrical shutoff valve at the firewall, separate from the engine’s mechanical MSOV: it closes the feed for an engine shutdown or an engine-bay fire. In 2025 a chafed wire inside a fuel control fired this valve shut in flight and the aircraft was lost (USAF investigation; position estimated).',
  }, L(merge([lru(0.07, 0.06, 0.06, fsovP), cylX(fsovP[0] - 0.02, fsovP[0] + 0.02, 0.02, 0.02, fsovP[1] + 0.05, fsovP[2], 10)]), m.darkMetal));
  return { litres, heaterP, fsovP, pumpY, keelY, selS, selY, fwdJP, aftJP, cellTop };
}

/** The engine feed line and the remaining fuel details that depend on propulsion positions. */
export function buildFuelLines({ P, L, m }, fu, prop) {
  const { heaterP, fsovP, pumpY, keelY } = fu;
  const hp = prop.heatP, pump = prop.pumpP;
  const under = (s, z, d = 0.03) => [X(s), prof(s).bot + d, z];       // in the keel channel under the aft cell's floor
  P('Engine feed line', {
    system: 'Fuel', material: 'Aluminium tube, stainless and fire-sleeved aft of the firewall', mass: 2.5, explode: [0, -0.45, 0.75],
    desc: 'From the header pumps along the keel between the gear wells and under the aft cell’s floor, up behind the cell to the forward electric heater, through the FSOV at the firewall, then under the engine’s hot end to its own fuel heater and up the port side to the high-pressure pump on top of the engine (routing estimated).',
  }, L(merge([
    pipe([[X(4.62), pumpY, 0.19], [X(4.72), pumpY - 0.005, 0.12], [X(4.8), prof(4.8).bot + 0.058, 0.03], [X(5.0), keelY - 0.01, -0.025], [X(6.0), keelY - 0.01, -0.025], [X(6.47), prof(6.47).bot + 0.03, 0.0],
      under(6.62, 0.035), under(6.95, 0.04), under(7.25, 0.045), [X(7.36), 1.26, 0.12], [X(7.42), 1.32, 0.16], [heaterP[0] + 0.1, heaterP[1], heaterP[2]]], 0.011, 6, 80),
    pipe([[heaterP[0] - 0.1, heaterP[1], heaterP[2]], [X(8.0), 1.38, 0.22], [X(8.5), 1.41, 0.21], [fsovP[0] + 0.035, fsovP[1], fsovP[2]]], 0.011, 6, 30),
    pipe([[fsovP[0] - 0.035, fsovP[1], fsovP[2]], [X(9.05), 1.425, 0.15], [X(9.15), 1.415, 0.0], [X(9.22), 1.43, -0.14], [hp[0] + 0.095, hp[1], hp[2]]], 0.011, 6, 30),
    pipe([[hp[0] - 0.09, hp[1], hp[2]], [X(9.5), 1.5, -0.235], [X(9.56), 1.68, -0.25], [X(9.62), 1.82, -0.16], [X(9.68), 1.89, -0.06], [pump[0], pump[1] - 0.005, pump[2] - 0.038]], 0.009, 6, 40),
  ]), m.pipe));
  // fuselage-cell vents, sump drains, quantity probes, refuel ports and the dump system
  const top = (s) => fusePoint(s, Math.PI / 2 - 0.62, 0.05);
  const vent = [];
  for (const s of [3.7, 4.45, 6.9]) vent.push(tubeBetween([X(s), s > 4.1 && s < 4.8 ? 1.5 : fu.cellTop(s) - 0.01, 0.12], [X(s), top(s)[1], top(s)[2]], 0.007, 5));
  vent.push(pipe([top(3.7), top(4.45), [X(5.4), 1.72, 0.3], top(6.9), [X(7.1), 1.72, 0.33], [X(7.2), 1.45, 0.37], fusePoint(7.25, -0.45, 0.004)], 0.007, 5, 60));
  P('Fuselage tank vents', {
    system: 'Fuel', material: 'Vent lines to a flush outlet on the lower side', mass: 0.6, count: 3, explode: [0, 1.25, 0.55],
    desc: 'A vent from the top of each fuselage cell joins a line along the upper starboard side that exits at a flush outlet on the lower side aft of the gear wells, so the bladders never collapse or over-pressurise as fuel is drawn or warms (routing estimated).',
  }, L(merge(vent), m.pipe));
  const drain = (p) => new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10).translate(p[0], p[1], p[2]);
  const drains = [drain([X(3.5), prof(3.5).bot - 0.002, 0.06]), drain([X(4.5), prof(4.5).bot - 0.002, -0.095]), drain([X(7.2), prof(7.2).bot - 0.002, 0.06])];
  for (const zs of [1, -1]) for (const z of [1.2, 4.7]) drains.push(drain(W(z, 0.5, -1, -0.002, zs)));
  P('Fuel sump drains', {
    system: 'Fuel', material: 'Flush poppet drain valves', mass: 0.6, count: 7, explode: [0, -1.0, 0],
    desc: 'A drain at the low point of each of the seven tanks, opened before flight to check for water and sediment, which sink below the fuel (positions estimated).',
  }, L(merge(drains), m.darkMetal));
  const FQ = [];
  for (const [s, z] of [[3.85, 0.12], [4.3, -0.12], [6.9, 0.12]]) FQ.push(tubeBetween([X(s), prof(s).bot + 0.08, z], [X(s), (s > 4.1 && s < 4.8 ? 1.5 : fu.cellTop(s) - 0.02), z], 0.012, 8));
  for (const zs of [1, -1]) for (const z of [1.6, 3.4, 6.4]) FQ.push(tubeBetween(W(z, 0.42, 1, 0.025, zs), W(z, 0.42, -1, 0.025, zs), 0.01, 6));
  P('Fuel quantity probes', {
    system: 'Fuel', material: 'Capacitance probes', mass: 1.2, count: 9, xrayWeight: 0.5, explode: [0, 1.1, 0],
    desc: 'Capacitance probes in every tank (two in each long inboard tank): fuel and air have different dielectric constants, so each probe’s capacitance tells how deep the fuel is around it. The readings give fuel remaining and, tank by tank, the centre of gravity (counts estimated).',
  }, L(merge(FQ), m.alu));
  const caps = [];
  for (const zs of [1, -1]) for (const z of [3.2, 6.6]) caps.push(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 16).translate(...W(z, 0.42, 1, -0.002, zs)));
  for (const s of [3.75, 6.9]) { const p = fusePoint(s, Math.PI / 2 - 0.45); caps.push(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 16).translate(X(s), p[1] + 0.001, p[2])); }
  P('Gravity refuel ports', {
    system: 'Fuel', material: 'Flush filler caps', mass: 1.5, count: 6, explode: [0, 1.7, 0],
    desc: 'Flush filler caps over each wing tank and the forward and aft fuselage cells, for gravity refuelling where no pressure-refuelling equipment is available; the header fills from the others (positions estimated).',
  }, L(merge(caps), m.darkMetal));
  const dv = [X(4.66), fu.pumpY + 0.02, -0.06];
  const mast = fusePoint(6.42, -Math.PI / 2 - 0.12, -0.002);
  P('Fuel dump valve & outlet', {
    system: 'Fuel', material: 'Motorised dump valve, 20 mm line and a small outlet mast', mass: 1.2, explode: [0, -1.55, -0.45],
    desc: 'A valve on the header pumps’ outlet sends fuel overboard through a line along the keel to an outlet mast under the fuselage. After an engine warning in 2018 a crew dumped fuel before an emergency landing, cutting the weight and the energy the brakes would have to absorb (USAF investigation; outlet position not public, estimated here).',
  }, L(merge([lru(0.06, 0.05, 0.05, dv), pipe([dv, [X(5.0), fu.keelY - 0.03, -0.012], [X(6.0), fu.keelY - 0.03, -0.012], [X(6.38), mast[1] + 0.03, mast[2]]], 0.01, 6, 30), tubeBetween([X(6.38), mast[1] + 0.03, mast[2]], [X(6.46), mast[1] - 0.09, mast[2]], 0.013, 8)]), m.darkMetal));
}
