// Hubble Space Telescope layout: the stations and radii every hst/ module builds against.
//
// Axes: optical axis along +x (= +V1) with the aperture door forward; y up (= +V3, the Sun side,
// where the door hinges); z right as seen looking forward from behind (= −V2, since the V1–V2–V3
// frame is right-handed). Metres, x = 0 at the aft face of the aft bulkhead.
//
// Station plan from the NASA/Lockheed SM3A Media Reference Guide (1999), section 5: light shield
// 4 m long, 3 m inside diameter; forward shell 4 m long, 3.1 m across; equipment section a ring of
// 1.5 m-deep bays; aft shroud 3.5 m long, 4.2–4.3 m across; together 13.1 m to the door hinge
// (13.2 m published overall). Optics: primary–secondary separation 4.906 m, focus 1.5 m behind the
// primary vertex, 60 cm hole through the primary.

import * as THREE from 'three';
import { HST_OTA, hubbleDesign, conicSag } from '../../physics/optics.js';
import { lathe } from '../../engine/geometry.js';

export const ST = {
  aft: 0,              // aft bulkhead, aft face
  bulkhead: 0.09,      // bulkhead thickness
  aftShroud: 3.55,     // aft shroud → equipment section joint
  equip: 5.05,         // equipment section → forward shell joint
  fwdShell: 9.05,      // forward shell → light shield joint
  front: 13.02,        // light shield forward ring (aperture)
  door: 13.06,         // aperture-door hinge line
};

export const RAD = {
  big: 2.1,            // aft shroud radius; equipment-section circumradius (4.2 m maximum diameter)
  shell: 1.55,         // forward shell / light shield outer radius over the blankets (3.1 m)
  inner: 1.5,          // light shield inside radius (3.0 m)
  truss: 1.36,         // metering truss radius (2.7 m diameter, SM3A guide)
};

const D = hubbleDesign();
export const OPT = {
  xPM: 4.15,                          // primary mirror vertex
  rPM: HST_OTA.D / 2,                 // 1.2 m
  rHole: 0.3,                         // primary central hole radius (23.5 in / 60 cm hole, SM3A guide)
  tPM: 0.305,                         // mirror thickness (~12 in)
  R1: HST_OTA.R1, K1: D.K1,
  xSM: 4.15 + HST_OTA.d,              // secondary mirror vertex (9.056)
  rSM: HST_OTA.D2 / 2,
  R2: D.R2, K2: D.K2,
  xFocus: 4.15 - D.b,                 // Cassegrain focus, 1.5 m behind the primary vertex (2.65)
  rObsc: (HST_OTA.obscuration * HST_OTA.D) / 2,   // 0.396 m: secondary baffle shadow
  rField: 0.235,                      // ≈ 14′ field radius at the focal surface (57.6 m × 14′)
  design: D,
};

/** Primary mirror front surface x at radius r (concave toward +x). */
export const pmSurface = (r) => OPT.xPM + conicSag(r, OPT.R1, OPT.K1);
/** Secondary mirror front surface x at radius r (convex toward −x). */
export const smSurface = (r) => OPT.xSM + conicSag(r, OPT.R2, OPT.K2);

/** Point at azimuth φ (rad, from +y toward +z) and radius r around the x axis. */
export const az = (phi, r, x = 0) => [x, r * Math.cos(phi), r * Math.sin(phi)];
export const deg = (d) => (d * Math.PI) / 180;

/** Lathe a profile of [r, x] pairs around the x axis. */
export function axial(profile, segments = 48, phiStart = 0, phiLength = Math.PI * 2) {
  // lathe revolves about +y; rotating −90° about z maps +y → +x
  return lathe(profile, segments, phiStart, phiLength).rotateZ(-Math.PI / 2);
}

/** Open (or capped) cylinder around the x axis from x0 to x1. */
export function tube(r, x0, x1, { seg = 48, open = true, rTop = r, thetaStart = 0, thetaLength = Math.PI * 2, hs = 1 } = {}) {
  // CylinderGeometry runs along y with its top (+y) at radiusTop; rotate so +y → +x
  const g = new THREE.CylinderGeometry(rTop, r, x1 - x0, seg, hs, open, thetaStart, thetaLength);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** Flat annulus (disc with a hole) facing ±x at station x. */
export function annulus(r0, r1, x, seg = 48, facing = 1) {
  const g = new THREE.RingGeometry(r0, r1, seg, 1);
  g.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/** Box placed at a point with its local axes: radial (outward), tangential and axial sizes. */
export function radialBox(phi, rMid, x, { radial, tangential, axialLen }) {
  const g = new THREE.BoxGeometry(axialLen, radial, tangential);
  g.rotateX(phi);              // local +y (radial) → direction at azimuth φ
  const [, y, z] = az(phi, rMid);
  g.translate(x, y, z);
  return g;
}

/** Tilted-plate helper: a thin box whose normal is n at point p. */
export function plate(w, h, t, p, n, up = [1, 0, 0]) {
  const g = new THREE.BoxGeometry(w, h, t);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...n).negate(), new THREE.Vector3(...up));
  g.applyMatrix4(m);
  g.translate(...p);
  return g;
}

/**
 * Give a geometry an index if it has none (in place), so geometries of mixed index state can be
 * merged. Indexed merges keep each primitive's shared vertices: about a third of the vertex data of
 * a non-indexed merge, and quicker to build.
 */
export function ix(g) {
  if (g.index) return g;
  const n = g.attributes.position.count;
  const a = new (n > 65535 ? Uint32Array : Uint16Array)(n);
  for (let i = 0; i < n; i++) a[i] = i;
  g.setIndex(new THREE.BufferAttribute(a, 1));
  return g;
}

/**
 * Curved skin patch on a cylinder of radius r around the x axis: x0..x1, azimuth φ0..φ1 (rad).
 * Normals point outward; UVs run u along x (metres) and v around (metres).
 */
export function shellPatch(r, x0, x1, phi0, phi1, { nx = 2, nphi = 12 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    for (let j = 0; j <= nphi; j++) {
      const p = phi0 + ((phi1 - phi0) * j) / nphi;
      pos.push(x, r * Math.cos(p), r * Math.sin(p));
      uv.push(x - x0, (p - phi0) * r);
    }
  }
  const row = nphi + 1;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nphi; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the normals face away from the axis
  const n = g.attributes.normal;
  if (n.getY(0) * pos[1] + n.getZ(0) * pos[2] < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Edge frame (four rods) around a shellPatch, standing slightly proud of it. */
export function patchFrame(r, x0, x1, phi0, phi1, rodR = 0.012, rodFn) {
  const out = [];
  const arc = (x) => {
    const n = Math.max(2, Math.ceil(Math.abs(phi1 - phi0) / 0.12));
    for (let j = 0; j < n; j++) {
      const a = phi0 + ((phi1 - phi0) * j) / n, b = phi0 + ((phi1 - phi0) * (j + 1)) / n;
      out.push(rodFn(az(a, r, x), az(b, r, x), rodR, 4));
    }
  };
  arc(x0); arc(x1);
  out.push(rodFn(az(phi0, r, x0), az(phi0, r, x1), rodR, 4), rodFn(az(phi1, r, x0), az(phi1, r, x1), rodR, 4));
  return out;
}

/** Points along an arc of radius r at station x, azimuth a0 → a1 in degrees (≈ step° apart). */
export function arcPts(r, x, a0, a1, step = 12) {
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(az(deg(a0 + ((a1 - a0) * i) / n), r, x));
  return out;
}

/**
 * A cable or harness bundle along a polyline: a rod per segment and a small knuckle at every bend,
 * so thick bundles read as one continuous run. Returns a list of geometries to merge.
 */
export function cablePath(pts, r = 0.015, seg = 6) {
  const out = [];
  const k = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), k.subVectors(b, a).normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    out.push(g);
    if (i > 0) out.push(new THREE.SphereGeometry(r, seg, 3).translate(a.x, a.y, a.z));
  }
  return out;
}

/** Total length (m) of a cablePath polyline, for checking harness and handrail lengths. */
export const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]) : 0), 0);
