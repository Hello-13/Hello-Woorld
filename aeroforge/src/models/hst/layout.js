// Hubble Space Telescope layout: the stations and radii every hst/ module builds against.
//
// Axes: optical axis along +x with the aperture door forward (+x); y up (= +V3, the Sun side);
// z right (= +V2, the solar-array axis). Metres, x = 0 at the aft face of the aft bulkhead.
//
// Station plan (NASA media guides: 13.2 m overall, 4.2 m maximum diameter; light shield ≈ 4 m
// long and 3 m inside diameter; primary–secondary separation 4.906 m; focus 1.5 m behind the
// primary vertex). The split of the remaining length between forward shell, equipment section
// and aft shroud is estimated from drawings.

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
  bayFace: 2.0,        // equipment-section bay-door plane (decagon apothem)
  shell: 1.55,         // forward shell / light shield outer radius over the blankets
  inner: 1.5,          // light shield inside radius (3.0 m)
  truss: 1.45,         // metering truss radius (2.9 m diameter)
};

const D = hubbleDesign();
export const OPT = {
  xPM: 4.15,                          // primary mirror vertex
  rPM: HST_OTA.D / 2,                 // 1.2 m
  rHole: 0.3,                         // primary central hole radius (estimate)
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

/** Non-indexed copy so geometries of mixed index state can be merged. */
export const ni = (g) => (g.index ? g.toNonIndexed() : g);
