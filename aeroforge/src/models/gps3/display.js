// How the satellite's body frame is turned for display, written without three.js so the guided tour
// (which aims its camera in body axes) can be loaded by node --test. satellite.js builds the same two
// orientations as quaternions for `body` and re-exports these helpers.
//
// - Hangar and showroom: nadir (+Z) up, the array axis (+Y) along world X, the Sun side (+X) toward
//   world +Z, as the satellite stands on its launch adapter.
// - 'orbit' look: nadir down toward the Earth backdrop (the showroom pose turned 180° about world Z),
//   then pitched 45° about world X so nadir also leans toward the default camera.

const S = Math.SQRT1_2;

/** Current display orientation, set by the vehicle's setLook and read by the guided tour. */
export const DISPLAY = { orbit: false };

/** Body-frame vector → world, hangar / showroom pose. */
export const toShow = ([x, y, z]) => [y, z, x];

/** Body-frame vector → world, 'orbit' look: showroom pose, then 180° about world Z, then −45° about world X. */
export function toOrbit(d) {
  const [x, y, z] = toShow(d);
  const a = -x, b = -y, c = z;          // 180° about Z
  return [a, S * (b + c), S * (c - b)];  // −45° about X
}

/** A camera direction written in the satellite's body frame, turned into a world direction for the
 *  current display orientation and kept a little above the horizon (the camera cannot go below it). */
export function displayDir(d) {
  const n = Math.hypot(...d) || 1;
  const v = (DISPLAY.orbit ? toOrbit : toShow)(d.map((c) => c / n));
  if (v[1] < 0.06) {
    v[1] = 0.06;
    const m = Math.hypot(...v);
    for (let i = 0; i < 3; i++) v[i] /= m;
  }
  return v;
}
