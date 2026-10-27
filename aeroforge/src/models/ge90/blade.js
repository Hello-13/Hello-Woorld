// Blade-section math for the GE90-115B model, free of three.js so the tests can check it.
//
// Lathe frame (see layout.js): engine axis +y. A blade template is built at phi = 90°, i.e. its
// span runs along +x and its tangential direction is +z. Each section is laid out flat in the
// (axial, tangential) plane and then wrapped onto its own cylinder of radius r, so every point of
// a section sits exactly at radius r. (Laid out flat, a wide-chord fan-blade tip would reach past
// its tip radius by r·(1/cos(t/r) − 1): about 30 mm at the GE90's 0.67 m tip chord.)

import { FAN } from './layout.js';

const D2R = Math.PI / 180;

/** NACA 00xx half-thickness at chord fraction x for thickness ratio t. */
export function naca00(x, t) {
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
}

/** Closed airfoil loop of [chord fraction, thickness offset] pairs (upper TE→LE, then lower). */
export function airfoil(t, n = 24, c0 = 0, c1 = 1, camber = 0) {
  const xs = [];
  for (let i = 0; i <= n; i++) xs.push(c0 + (c1 - c0) * 0.5 * (1 - Math.cos((Math.PI * i) / n)));
  const yc = (x) => camber * 4 * x * (1 - x);
  const upper = xs.slice().reverse().map((x) => [x, yc(x) + Math.max(naca00(x, t), x > 0.999 ? 0.0006 : 0)]);
  const lower = xs.slice(1, -1).map((x) => [x, yc(x) - Math.max(naca00(x, t), 0.0006)]);
  return upper.concat(lower);
}

/** Spanwise value: a number (constant), a [hub, tip] pair (linear) or a function of span fraction. */
const at = (q, f, d = 0) => (q == null ? d : typeof q === 'function' ? q(f) : Array.isArray(q) ? q[0] + (q[1] - q[0]) * f : q);

/** Point of a section at radius r, axial station ax and tangential offset tg, wrapped onto the cylinder. */
export const wrap = (r, ax, tg) => [r * Math.cos(tg / r), ax, r * Math.sin(tg / r)];

/**
 * Section rings [[x, y, z] …] of a blade from hub to tip. o: rHub, rTip, chord, stagger (deg),
 * t (thickness ratio), camber, sweep and lean (axial and tangential offsets of the section centre),
 * y (axial station), stations, n, c0 / c1 (chord window), scale (thickness scale).
 */
export function bladeRings(o) {
  const stations = o.stations ?? 4, n = o.n ?? 8;
  const rings = [];
  for (let k = 0; k <= stations; k++) {
    const f = k / stations;
    const r = o.rHub + (o.rTip - o.rHub) * f;
    const chord = at(o.chord, f);
    const st = at(o.stagger, f) * D2R;
    const loop = airfoil(at(o.t, f, 0.08), n, o.c0 ?? 0, o.c1 ?? 1, at(o.camber, f, 0.04));
    const ca = -Math.cos(st), ct = Math.sin(st);
    const na = Math.sin(st), nt = Math.cos(st);
    const ax0 = (o.y ?? 0) + at(o.sweep, f, 0);
    const tg0 = at(o.lean, f, 0);
    const scale = o.scale ?? 1;
    rings.push(loop.map(([xc, yt]) => {
      const c = (xc - 0.5) * chord, h = yt * chord * scale;
      return wrap(r, ax0 + c * ca + h * na, tg0 + c * ct + h * nt);
    }));
  }
  return rings;
}

/** Tip radius of the fan blades: 2 mm inside the 128 in (3.25 m) fan diameter. */
export const FAN_BLADE_TIP_R = FAN.tipR - 0.002;

/**
 * GE90-115B fan blade: wide-chord, swept, carbon-fibre composite. With sheath = true, the titanium
 * leading-edge strip over the first 10 % of chord.
 */
export function fanBladeSpec(sheath = false) {
  const chord = (f) => 0.5 + 0.17 * Math.sin(Math.min(1, f * 1.4) * (Math.PI / 2));
  const stagger = (f) => 24 + 38 * Math.pow(f, 0.85);
  // leading edge: swept forward over the inner span, then back at the tip (the -115B's swept fan)
  const le = (f) => 0.085 * Math.sin(Math.PI * 0.9 * f) - 0.1 * f * f * f;
  return {
    rHub: FAN.hubR - 0.004, rTip: FAN_BLADE_TIP_R,
    chord, stagger, t: (f) => 0.11 - 0.08 * f, camber: (f) => 0.09 - 0.065 * f,
    sweep: (f) => le(f) - 0.5 * chord(f) * Math.cos(stagger(f) * D2R),
    lean: (f) => 0.05 * f * f,
    stations: 10, n: sheath ? 5 : 14,
    ...(sheath ? { c0: 0, c1: 0.1, scale: 1.18 } : {}),
  };
}
