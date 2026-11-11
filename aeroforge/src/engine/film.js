// Film mode: a slow, continuous, vehicle-aware camera program (reveal, low orbits, push-ins to
// details, rack focus) built from the vehicle's view data and its parts' bounds. The path is a
// closed, time-parameterised Hermite spline through keyframes in (azimuth, elevation, log
// distance, target, focus) space, so the camera never stops and the loop closes seamlessly.
//
// The program and its maths are pure (no three.js import): tests/film.test.mjs samples them.
// The Film class at the bottom drives the stage with injected helpers.

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

// Where the push-ins go, per vehicle: patterns over part names (userData.part.name). `side`
// picks the single matching part nearest the hero camera's side (right inlet, right nozzle…)
// instead of the union of every match. Order is the order the film visits them.
export const DETAIL_SHOTS = {
  fighter: [
    { name: 'inlet', match: /^Caret inlet cowl/, side: true },
    { name: 'canopy', match: /^Canopy$/ },
    { name: 'nozzles', match: /^Nozzle divergent/, side: true },
  ],
  helicopter: [
    { name: 'rotor head', match: /^Main rotor hub$|^Rotating swashplate$|^Stationary swashplate$/ },
    { name: 'cockpit', match: /^Windshields & cockpit windows$/ },
    { name: 'tail rotor', match: /^Tail rotor hub|^Tail rotor blades$/ },
  ],
  uav: [
    { name: 'sensor ball', match: /^MTS-B EO\/IR turret$|^Lynx radome$/ },
    { name: 'propeller', match: /^Three-blade propeller$|^Propeller hub/ },
    { name: 'weapons', match: /^AGM-114 Hellfire pair/, side: true },
  ],
  turbofan: [
    { name: 'fan', match: /^Fan blades$|^Spinner$/ },
    { name: 'exhaust', match: /^Core exhaust nozzle$|^Turbine rear frame$/ },
    { name: 'fan cowl', match: /^Fan cowl doors$/ },
  ],
  rocket: [
    { name: 'octaweb', match: /^Centre core Octaweb$|^Centre core outer Merlin 1D thrust chambers & nozzles$/ },
    { name: 'grid fins', match: /grid fins$/, side: true },
    { name: 'fairing', match: /^Fairing half [AB]$/ },
  ],
  satellite: [
    { name: 'antenna farm', match: /^L-band antenna panel$|^L-band helix|^M-code helix|^JIB antenna/ },
    { name: 'apogee engine', match: /^Liquid apogee engine$|^Engine heat shield$/ },
    { name: 'array tip', match: /^Solar panel 2 \(/, side: true },
  ],
  hubble: [
    { name: 'aperture', match: /^Aperture door$/ },
    { name: 'high-gain antenna', match: /^High-gain antenna \(/, side: true },
    { name: 'solar array', match: /^Solar array wing/, side: true },
  ],
};

// ------------------------------------------------------------------------------- small vector helpers
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
export const wrapPi = (a) => a - TAU * Math.round(a / TAU);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const boxCenter = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const boxRadius = (b) => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;
const boxUnion = (a, b) => (!a ? { min: [...b.min], max: [...b.max] } : {
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});
export const insideBox = (p, b, pad = 0) =>
  p[0] > b.min[0] - pad && p[0] < b.max[0] + pad && p[1] > b.min[1] - pad && p[1] < b.max[1] + pad && p[2] > b.min[2] - pad && p[2] < b.max[2] + pad;

// ------------------------------------------------------------------------------- details
/**
 * Resolve a vehicle's detail shots to world-space spheres.
 * parts: objects with userData.part.name; boundsOf(part) → { min:[3], max:[3] } or null.
 */
export function pickDetails(id, parts, boundsOf, center, heroDir, radius) {
  const shots = DETAIL_SHOTS[id] || [];
  const side = norm([heroDir[0], 0, heroDir[2]]);
  const out = [];
  for (const shot of shots) {
    const hits = parts.filter((p) => shot.match.test(p.userData?.part?.name || ''));
    if (!hits.length) continue;
    let box = null;
    if (shot.side) {
      let best = null, bestDot = -Infinity;
      for (const p of hits) {
        const b = boundsOf(p);
        if (!b) continue;
        const d = dot(sub(boxCenter(b), center), side);
        if (d > bestDot) { bestDot = d; best = b; }
      }
      box = best;
    } else {
      for (const p of hits) { const b = boundsOf(p); if (b) box = boxUnion(box, b); }
    }
    if (!box) continue;
    out.push({ name: shot.name, center: boxCenter(box), radius: clamp(boxRadius(box), radius * 0.04, radius * 0.45) });
  }
  if (out.length) return out;
  // no named details (a vehicle this file does not know): nose, top and tail of the bounding box
  const r = radius * 0.16;
  const box = { min: sub(center, [radius, radius, radius]), max: add(center, [radius, radius, radius]) };
  return [
    { name: 'nose', center: [box.max[0] - r, center[1], center[2]], radius: r },
    { name: 'top', center: [center[0], box.max[1] - r, center[2]], radius: r },
    { name: 'tail', center: [box.min[0] + r, center[1], center[2]], radius: r },
  ];
}

// ------------------------------------------------------------------------------- framing maths
/** Distance along `dir` from `target` at which every corner of `box` is inside the frame
 *  (same rule as Stage.frameVehicle); tanV / tanH are the usable half-angle tangents. */
export function fitDistance(box, dir, target, tanV, tanH) {
  const d = norm(dir);
  const right = norm(cross([0, 1, 0], d));
  const up = norm(cross(d, right));
  let need = 0;
  for (let i = 0; i < 8; i++) {
    const c = sub([i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]], target);
    const z = dot(c, d);
    need = Math.max(need, z + Math.abs(dot(c, right)) / tanH, z + Math.abs(dot(c, up)) / tanV);
  }
  return need;
}

/** Camera position for a spherical state around its target. */
export function orbitPoint(target, az, el, dist) {
  const c = Math.cos(el);
  return [target[0] + dist * c * Math.cos(az), target[1] + dist * Math.sin(el), target[2] + dist * c * Math.sin(az)];
}

// ------------------------------------------------------------------------------- the program
// A key is 10 numbers: az, el, log(dist), target xyz, focus xyz, coc (0 wide … 1 close-up).
const K = (az, el, dist, tgt, focus, coc) => [az, el, Math.log(dist), tgt[0], tgt[1], tgt[2], focus[0], focus[1], focus[2], coc];

/**
 * Build the camera program for a subject:
 * { id, box, center, heroDir, fill, tanV, tanH, details, floor (bool), floorY, minDist, maxDist }
 * Returns { keys, durations, total, turns } for sampleProgram.
 */
export function buildProgram(s) {
  const C = s.center;
  const R = Math.max(1e-3, boxRadius(s.box));
  const hero = norm(s.heroDir);
  const az0 = Math.atan2(hero[2], hero[0]);
  const el0 = Math.asin(clamp(hero[1], -1, 1));
  const floor = !!s.floor;
  const floorY = floor ? (s.floorY ?? 0) : -Infinity;
  const minDist = s.minDist ?? 2, maxDist = s.maxDist ?? 220;
  const tanV = s.tanV ?? Math.tan(16 * RAD), tanH = s.tanH ?? tanV * 1.7;
  const fovMin = 2 * Math.atan(Math.min(tanV, tanH));
  const d0 = clamp(fitDistance(s.box, hero, C, tanV, tanH) * 1.06 * (s.fill || 1), minDist, maxDist * 0.92);
  const lowEl = floor ? 0.07 : -0.12;

  // keeps a camera point outside the subject and above the floor by pushing it away / up
  const place = (tgt, az, el, dist) => {
    const pad = R * 0.08;
    for (let i = 0; i < 12; i++) {
      let p = orbitPoint(tgt, az, el, dist);
      if (floor && p[1] < floorY + 0.3) { el = Math.max(el, Math.asin(clamp((floorY + 0.3 - tgt[1]) / dist, -1, 1))); p = orbitPoint(tgt, az, el, dist); }
      if (!insideBox(p, s.box, pad) || dist >= maxDist * 0.9) break;
      dist *= 1.18;
    }
    return { az, el, dist: clamp(dist, minDist, maxDist * 0.92) };
  };

  // an approach to a detail: from outside its side of the vehicle, continuing the orbit direction
  const detailKey = (det, prevAz, drift = 0) => {
    const o = sub(det.center, C);
    const oxz = Math.hypot(o[0], o[2]);
    let az;
    if (oxz < R * 0.22) az = prevAz - 0.6;                 // on the axis (canopy, rotor head, fan): keep orbiting
    else {
      const outward = Math.atan2(o[2], o[0]);
      const off = wrapPi(prevAz - outward);
      az = prevAz - off + Math.sign(off || 1) * 0.55;     // 30° off the outward normal, toward where we came from
    }
    az += drift;
    const elev = clamp(Math.asin(clamp(o[1] / R, -1, 1)) * 0.55 + (floor ? 0.16 : 0.04), floor ? 0.05 : -0.35, 0.62);
    const dist = Math.max(minDist, det.radius * 2.0, (det.radius / Math.sin(fovMin / 2)) * 1.5);
    const p = place(det.center, az, elev, dist);
    return K(p.az, p.el, p.dist, det.center, det.center, 1);
  };

  const keys = [], durations = [];
  const push = (k, dur) => { keys.push(k); durations.push(dur); };
  const low = (y) => [C[0], C[1] - R * y, C[2]];

  // 0  the opening: low and close off the quarter …
  {
    const p = place(low(0.12), az0 + 0.75, Math.max(floor ? 0.06 : -0.05, el0 * 0.35), d0 * 0.62);
    push(K(p.az, p.el, p.dist, low(0.12), C, 0.55), 8.5);
  }
  // 1  … pulling back into the hero framing
  push(K(az0, el0, d0 * 0.95, C, C, 0.15), 7);
  // 2–3  a slow orbit at a low angle
  { const p = place(C, az0 - 0.8, lowEl + 0.03, d0 * 0.92); push(K(p.az, p.el, p.dist, C, C, 0.2), 10); }
  { const p = place(low(0.1), az0 - 1.7, lowEl, d0 * 0.82); push(K(p.az, p.el, p.dist, low(0.1), C, 0.3), 10); }
  let az = az0 - 1.7;
  const details = s.details || [];
  // 4–5  push in to the first detail, then drift around it
  if (details[0]) {
    const a = detailKey(details[0], az); push(a, 8);
    const b = detailKey(details[0], a[0], 0.32); b[1] = clamp(a[1] + 0.06, -0.4, 0.7); b[2] = Math.log(Math.exp(a[2]) * 0.95); push(b, 6);
    az = b[0];
  }
  // 6–7  the second detail
  if (details[1]) {
    const a = detailKey(details[1], az - 0.3); push(a, 8);
    const b = detailKey(details[1], a[0], 0.3); b[1] = clamp(a[1] - 0.04, -0.4, 0.7); b[2] = Math.log(Math.exp(a[2]) * 0.94); push(b, 6);
    az = b[0];
  }
  // 8  pull out to a high three-quarter
  { const p = place(C, az - 0.9, 0.5, d0 * 1.12); push(K(p.az, p.el, p.dist, C, C, 0.1), 9); az = p.az; }
  // 9–10  the third detail
  if (details[2]) {
    const a = detailKey(details[2], az - 0.4); push(a, 8);
    const b = detailKey(details[2], a[0], 0.28); b[1] = clamp(a[1] + 0.05, -0.4, 0.7); b[2] = Math.log(Math.exp(a[2]) * 0.95); push(b, 5);
    az = b[0];
  }
  // 11  a low three-quarter from the far side, then the loop closes back into the opening
  { const p = place(C, az - 0.8, lowEl + 0.07, d0 * 0.9); push(K(p.az, p.el, p.dist, C, C, 0.25), 8); az = p.az; }
  // close the loop with the fewest extra turns: the first key again, shifted by whole revolutions
  const turns = Math.round((az - keys[0][0]) / TAU);
  const total = durations.reduce((a, b) => a + b, 0);
  return { keys, durations, total, turns, hero: { az: az0, el: el0, dist: d0 } };
}

/** Key i of a closed program (any integer i), with the azimuth carried across whole loops. */
function keyAt(prog, i) {
  const n = prog.keys.length;
  const loops = Math.floor(i / n);
  const k = prog.keys[((i % n) + n) % n];
  if (!loops) return k;
  const c = k.slice();
  c[0] += loops * prog.turns * TAU;
  return c;
}
const durAt = (prog, i) => { const n = prog.durations.length; return prog.durations[((i % n) + n) % n]; };

/**
 * Sample the program at time t (seconds, any value: the program loops). Time-parameterised
 * cubic Hermite with finite-difference tangents, so position and velocity are continuous
 * across keys and the loop seam. Returns { az, el, dist, target, focus, coc }.
 */
export function sampleProgram(prog, t) {
  const n = prog.keys.length;
  const total = prog.total;
  const loop = Math.floor(t / total);
  let tt = t - loop * total;
  let i = 0;
  while (i < n - 1 && tt >= prog.durations[i]) { tt -= prog.durations[i]; i++; }
  const base = i + loop * n;
  const D = durAt(prog, base);
  const u = clamp(tt / D, 0, 1);
  const p0 = keyAt(prog, base), p1 = keyAt(prog, base + 1);
  const pm = keyAt(prog, base - 1), pp = keyAt(prog, base + 2);
  const Dm = durAt(prog, base - 1), Dp = durAt(prog, base + 1);
  const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
  const out = new Array(10);
  for (let k = 0; k < 10; k++) {
    const m0 = (D * (p1[k] - pm[k])) / (Dm + D);
    const m1 = (D * (pp[k] - p0[k])) / (D + Dp);
    out[k] = h00 * p0[k] + h10 * m0 + h01 * p1[k] + h11 * m1;
  }
  return { az: out[0], el: out[1], dist: Math.exp(out[2]), target: [out[3], out[4], out[5]], focus: [out[6], out[7], out[8]], coc: clamp(out[9], 0, 1) };
}

/** Camera placement for a sampled state, kept above the floor when there is one. */
export function cameraFor(state, { floor = true, floorY = 0, minDist = 2, maxDist = 220 } = {}) {
  const dist = clamp(state.dist, minDist, maxDist);
  let el = state.el;
  if (floor) {
    const need = (floorY + 0.25 - state.target[1]) / dist;
    if (need > -1 && need < 1) el = Math.max(el, Math.asin(need));
  }
  const position = orbitPoint(state.target, state.az, el, dist);
  return { position, target: state.target, focusDist: len(sub(state.focus, position)), coc: state.coc };
}

// ------------------------------------------------------------------------------- handheld drift
/** Tiny camera wander in radians [yaw, pitch]: a slow drift (7–13 s periods) plus faint
 *  operator jitter (sub-second), together under 0.1° so it is sub-pixel at 4K. */
export function drift(t, slow = 0.0011, fast = 0.00014) {
  const yaw = slow * (0.6 * Math.sin(t * 0.48 + 1.3) + 0.4 * Math.sin(t * 0.83 + 0.2))
    + fast * (0.7 * Math.sin(t * 7.1 + 0.5) + 0.3 * Math.sin(t * 11.3));
  const pitch = slow * (0.55 * Math.sin(t * 0.61 + 2.1) + 0.45 * Math.sin(t * 0.97 + 0.7))
    + fast * (0.6 * Math.sin(t * 8.3 + 1.1) + 0.4 * Math.sin(t * 13.7 + 0.3));
  return [yaw, pitch];
}

// ------------------------------------------------------------------------------- runtime
/**
 * Drives the stage camera through a program. Injected helpers keep this file free of three.js:
 *   boundsOf(object) → { min:[3], max:[3] } | null        (world space, solid meshes only)
 *   subject() → { id, root, parts, view: { dir, fill, targetY }, floor: bool, unitMetres } | null
 *   onStart(), onStop(reason), onNote(what), settings: { dof, drift, sweep } (live object)
 */
export class Film {
  constructor(stage, { boundsOf, subject, onStart, onStop, onNote, settings } = {}) {
    this.stage = stage;
    this.boundsOf = boundsOf;
    this.subject = subject;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onNote = onNote;
    this.settings = settings || { dof: true, drift: true, sweep: true };
    this.active = false;
    this.speed = 1;
    this.program = null;
    this.t = 0;
    this._hook = null;
    this._off = null;
  }

  /** Build the program for the current subject. Returns false when there is nothing to film. */
  start() {
    if (this.active) return true;
    const s = this.subject?.();
    if (!s) return false;
    const box = this.boundsOf(s.root);
    if (!box) return false;
    const center = boxCenter(box);
    if (s.view?.targetY != null) center[1] = s.view.targetY;
    const radius = boxRadius(box);
    const heroDir = norm(s.view?.dir || [1, 0.5, 1]);
    const stage = this.stage;
    const { tanV, tanH } = stage.frameTan();
    const details = pickDetails(s.id, s.parts || [], this.boundsOf, center, heroDir, radius);
    this.program = buildProgram({
      id: s.id, box, center, heroDir, fill: s.view?.fill || 1, tanV, tanH, details,
      floor: s.floor !== false, floorY: 0, minDist: stage.controls.minDistance, maxDist: stage.controls.maxDistance,
    });
    this.floor = s.floor !== false;
    this.unitMetres = s.unitMetres || 1;
    this.t = 0;
    this.dofDropped = false;
    this._slow = 0;
    this.blend = 0;                                     // eases from the camera's current place into the program
    this.p0 = [stage.camera.position.x, stage.camera.position.y, stage.camera.position.z];
    this.t0 = [stage.controls.target.x, stage.controls.target.y, stage.controls.target.z];
    stage.tween = null;
    this.active = true;
    this._hook = stage.onFrame((dt) => this.update(dt));
    this._listen();
    this.onStart?.();
    return true;
  }

  stop(reason = 'user') {
    if (!this.active) return;
    this.active = false;
    this._hook?.();
    this._hook = null;
    this._off?.();
    this._off = null;
    this.stage.setFocus?.(null);
    this.stage.env?.showroom?.sweep?.(false);
    this.onStop?.(reason);
  }

  toggle() { return this.active ? (this.stop('user'), false) : this.start(); }

  // any pointer or wheel input on the canvas hands the camera back
  _listen() {
    const el = this.stage.renderer.domElement;
    const stop = () => this.stop('input');
    const opts = { passive: true };
    el.addEventListener('pointerdown', stop, opts);
    el.addEventListener('wheel', stop, opts);
    el.addEventListener('touchstart', stop, opts);
    this._off = () => {
      el.removeEventListener('pointerdown', stop, opts);
      el.removeEventListener('wheel', stop, opts);
      el.removeEventListener('touchstart', stop, opts);
    };
  }

  update(dt) {
    const stage = this.stage;
    if (!this.active || !this.program) return;
    if (stage.tween) { this.stop('camera'); return; }   // something else is flying the camera (a search pick, a lab)
    const speed = this.speed * (stage.reducedMotion ? 0.6 : 1);
    this.t += dt * speed;
    this.blend = Math.min(1, this.blend + dt / 2.2);
    const state = sampleProgram(this.program, this.t);
    const cam = cameraFor(state, { floor: this.floor, floorY: 0, minDist: stage.controls.minDistance, maxDist: stage.controls.maxDistance });
    const b = smooth(this.blend);
    let pos = cam.position, tgt = cam.target;
    if (b < 1) {
      pos = [lerp(this.p0[0], pos[0], b), lerp(this.p0[1], pos[1], b), lerp(this.p0[2], pos[2], b)];
      tgt = [lerp(this.t0[0], tgt[0], b), lerp(this.t0[1], tgt[1], b), lerp(this.t0[2], tgt[2], b)];
    }
    // handheld drift: a tiny rotation, applied as an offset of the look target
    if (this.settings.drift && !stage.reducedMotion) {
      const [yaw, pitch] = drift(this.t);
      const fwd = norm(sub(tgt, pos));
      const right = norm(cross(fwd, [0, 1, 0]));
      const up = cross(right, fwd);
      const d = len(sub(tgt, pos));
      tgt = add(tgt, add(scale(right, yaw * d * b), scale(up, pitch * d * b)));
    }
    stage.camera.position.set(pos[0], pos[1], pos[2]);
    stage.controls.target.set(tgt[0], tgt[1], tgt[2]);
    // the lens: focus pulled to the shot's subject, the aperture opening up for close-ups. Under
    // automatic quality, 4 s below 50 fps with the lens on drops it for the rest of this run.
    if (this.settings.dof && !this.dofDropped && stage.autoQuality && stage.bokeh?.enabled) {
      this._slow = stage.fps < 50 ? (this._slow || 0) + dt : 0;
      if (this._slow > 4) { this.dofDropped = true; this.onNote?.('dof-dropped'); }
    }
    if (this.settings.dof && !this.dofDropped) stage.setFocus?.(cam.focusDist, lerp(4.0, 1.5, cam.coc), { unitMetres: this.unitMetres });
    else stage.setFocus?.(null);
    stage.env?.showroom?.sweep?.(!!this.settings.sweep, this.t);
  }
}
