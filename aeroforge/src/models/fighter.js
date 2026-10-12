// AX-7 WRAITH — fictional fifth-generation air-superiority fighter.
// Smooth chined fuselage, 42° diamond wing with NACA 0004.5→0003 sections, all-moving tails,
// canted twin fins, caret intakes, 2-D thrust-vectoring nozzles and an internal weapons bay.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import {
  loftRings, orientOutward, orientTubeOutward, mirrorZ, wingPanel, wingPoint, hingedMesh, lathe, ogiveProfile,
  rod, interpKeys, mergeGeometries,
} from '../engine/geometry.js';
import { M, SKIN } from '../engine/materials.js';
import { decal, tailCode, emblem, stencilText, danger, rescue, panelOutline } from '../engine/decals.js';
import { plumeMaterial, plumeMesh, vaporConeMaterial } from '../engine/effects.js';
import { recoveryTemperature } from '../physics/atmosphere.js';

const X = (s) => 9.5 - s;   // fuselage station (m from nose) → model x (nose at +x)

const W = [[0, 0.015], [0.8, 0.26], [2.2, 0.56], [3.6, 0.78], [5.0, 0.95], [6.4, 1.18], [7.6, 1.55], [9.0, 1.78], [11.5, 1.86], [14, 1.74], [16.5, 1.5], [18.6, 1.32]];
const HT = [[0, 0.015], [0.8, 0.22], [2.2, 0.46], [3.6, 0.62], [5.0, 0.72], [6.4, 0.74], [7.6, 0.7], [9.0, 0.64], [11.5, 0.56], [14, 0.5], [16.5, 0.44], [18.6, 0.4]];
const HB = [[0, 0.015], [0.8, 0.2], [2.2, 0.38], [3.6, 0.48], [5.0, 0.54], [6.4, 0.58], [7.6, 0.6], [9, 0.62], [11.5, 0.6], [14, 0.56], [16.5, 0.5], [18.6, 0.44]];
const Y0 = [[0, -0.1], [2.2, -0.04], [5, 0], [18.6, 0]];

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};

/**
 * Smooth chined cross-section: a cubic upper surface that slopes down to a sharp chine and a
 * flatter lower surface. The chine point is duplicated so the loft gets a crisp crease there.
 */
function section(s) {
  const w = interpKeys(W, s), ht = interpKeys(HT, s), hb = interpKeys(HB, s), y0 = interpKeys(Y0, s);
  const up = [[0, ht], [w * 0.55, ht], [w * 0.7, Math.min(w * 0.17, ht * 0.6)], [w, 0]];
  const lo = [[w, 0], [w * 0.78, Math.max(-w * 0.2, -hb * 0.6)], [w * 0.45, -hb], [0, -hb]];
  const right = [];
  for (let i = 0; i <= 10; i++) right.push(bez(...up, i / 10));
  right.push([w, 0]);                                     // crease
  for (let i = 1; i <= 8; i++) right.push(bez(...lo, i / 8));
  // ring: right side top→bottom, then left side bottom→top (mirrored, skipping the centre points)
  const left = right.slice(1, -1).reverse().map(([z, y]) => [-z, y]);
  return right.concat(left).map(([z, y]) => [X(s), y + y0, z]);
}

function fuselageSegment(s0, s1, steps) {
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // denser stations toward the nose for a crisp radome
    const s = s0 + (s1 - s0) * (s0 === 0 ? t * t * 0.5 + t * 0.5 : t);
    rings.push(section(s));
  }
  return orientOutward(loftRings(rings, { capStart: true, capEnd: true, uvMode: 'metric-x' }));
}

function missileGeometry(length = 3.66, r = 0.089) {
  const body = lathe(ogiveProfile(r, 0.55, length - 0.55, 10), 20);
  const cyl = new THREE.CylinderGeometry(r, r, length - 0.55, 20, 1, false);
  cyl.translate(0, (length - 0.55) / 2, 0);
  const fins = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const mid = new THREE.BoxGeometry(0.008, 0.5, 0.15); mid.translate(0, 1.9, r + 0.07);
    const tail = new THREE.BoxGeometry(0.008, 0.32, 0.17); tail.translate(0, 0.2, r + 0.08);
    for (const f of [mid, tail]) { f.rotateY(a); fins.push(f.toNonIndexed()); }
  }
  const g = mergeGeometries([body.toNonIndexed(), cyl.toNonIndexed(), ...fins]);
  g.rotateZ(-Math.PI / 2);     // along +x, nose forward
  g.translate(-length / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildFighter() {
  const A = new Assembly();
  const attitude = new THREE.Group();
  A.root.add(attitude);
  const P = (name, info, objs) => A.part(name, info, objs, attitude);

  // ----------------------------------------------------------------- fuselage, split for explode
  const radome = P('Radome', {
    system: 'Avionics', material: 'Quartz-cyanate composite, frequency-selective', mass: 85, explode: [3.2, 0, 0],
    desc: 'Bandpass radome passes the radar\'s own X-band and scatters everything else — a key low-observable feature.',
    callout: true, anchor: [X(1.0), 0.35, 0],
  }, mesh(fuselageSegment(0, 2.6, 16), SKIN.stealth()));
  radome.userData.part.thermalRole = 'stagnation';

  const aesa = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 40), M.gunmetal());
  aesa.rotation.z = -(Math.PI / 2 - 0.35);   // tilted array deflects returns away from the emitter
  aesa.position.set(X(2.45), 0.05, 0);
  const tiles = new THREE.Mesh(new THREE.CircleGeometry(0.39, 40), new THREE.MeshStandardMaterial({ color: 0x1d4a3a, roughness: 0.4, metalness: 0.6, emissive: 0x0a2a1a, emissiveIntensity: 0.4 }));
  tiles.rotation.y = Math.PI / 2;
  tiles.position.set(0.045, 0, 0);
  const tileHolder = new THREE.Group(); tileHolder.add(tiles); tileHolder.rotation.z = 0.35; tileHolder.position.copy(aesa.position);
  P('AESA radar array', {
    system: 'Avionics', material: 'GaN T/R modules on aluminium backplane', mass: 250, explode: [2.2, 0, 0],
    desc: '~2,000 gallium-nitride transmit/receive modules steer the beam electronically — no moving antenna.',
    callout: true, anchor: [X(2.45), 0.3, 0],
  }, [aesa, tileHolder]);

  P('Forward fuselage', {
    system: 'Structure', material: 'Ti-6Al-4V frames, RAM-coated composite skin', mass: 2300, explode: [1.2, 0, 0],
    desc: 'Houses the cockpit, avionics bays and nose landing gear. Chine edges align with the wing leading edge.',
  }, mesh(fuselageSegment(2.6, 8.2, 14), SKIN.stealth()));
  P('Centre fuselage', {
    system: 'Structure', material: 'Titanium bulkheads, composite skins', mass: 4100, explode: [0, 0, 0],
    desc: 'Carries the wing attachments, main weapons bay, main gear wells and most of the internal fuel.',
  }, mesh(fuselageSegment(8.2, 14.2, 12), SKIN.stealth()));
  P('Aft fuselage', {
    system: 'Structure', material: 'Titanium, high-temperature BMI composite', mass: 1900, explode: [-2.0, 0, 0],
    desc: 'Engine bays and tail booms; high-temperature structure around the afterburners.',
  }, mesh(fuselageSegment(14.2, 18.6, 10), SKIN.stealth()));

  // ----------------------------------------------------------------- canopy & cockpit
  const canopyGeo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  canopyGeo.scale(2.15, 0.6, 0.5);
  const canopy = mesh(canopyGeo, M.canopy(), { cast: false });
  canopy.position.set(X(5.3), 0.6, 0);
  P('Canopy', {
    system: 'Cockpit', material: 'Polycarbonate with gold-tinted ITO coating', mass: 160, explode: [0, 1.6, 0],
    desc: 'One-piece frameless bubble. The metallised coating keeps radar energy from entering the cockpit cavity.',
    callout: true, anchor: [X(5.3), 1.25, 0],
  }, canopy);
  const seat = mesh(new THREE.BoxGeometry(0.55, 0.9, 0.5), M.darkMetal());
  seat.position.set(X(6.0), 0.55, 0);
  const helmet = mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.5 }));
  helmet.position.set(X(5.7), 1.0, 0);
  const hud = mesh(new THREE.BoxGeometry(0.02, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x30ff70, emissiveIntensity: 1.2, transparent: true, opacity: 0.6 }));
  hud.position.set(X(4.6), 0.88, 0);
  hud.rotation.z = 0.5;
  P('Ejection seat & pilot', {
    system: 'Cockpit', material: 'Aluminium / Kevlar', mass: 110, explode: [0, 2.6, 0],
    desc: 'Zero-zero ejection seat with helmet-mounted display; the HUD combiner glows ahead of the pilot.',
  }, [seat, helmet, hud]);

  // ----------------------------------------------------------------- intakes (caret, serpentine)
  const intakeLining = new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.95, metalness: 0.1, side: THREE.BackSide });
  for (const side of [1, -1]) {
    const rings = [
      [[0.75, 0.06], [1.62, 0.02], [1.42, -0.62], [0.75, -0.62]],
      [[0.8, 0.05], [1.64, 0.02], [1.46, -0.62], [0.8, -0.62]],
      [[0.95, 0.03], [1.74, 0.0], [1.56, -0.6], [0.95, -0.6]],
      [[1.1, 0.0], [1.8, -0.02], [1.62, -0.56], [1.1, -0.56]],
    ].map((ring, i) => {
      const s = [6.0, 7.0, 8.4, 9.8][i];
      return ring.map(([z, y]) => {
        const shear = i === 0 ? -0.6 * ((z - 0.75) / 0.87) - 0.35 * ((0.06 - y) / 0.68) : 0;
        return [X(s) + shear, y, z * side];
      });
    });
    const g = orientTubeOutward(loftRings(rings, { uvMode: 'metric' }));
    const outer = mesh(g, SKIN.stealth());
    const inner = mesh(g, intakeLining);
    const back = new THREE.Shape(rings[2].map(([, y, z]) => new THREE.Vector2(z, y)));
    const plate = mesh(new THREE.ShapeGeometry(back), M.intake(), { cast: false });
    plate.rotation.y = -Math.PI / 2;
    plate.position.x = X(8.4);
    P(side > 0 ? 'Right caret intake' : 'Left caret intake', {
      system: 'Propulsion', material: 'Composite duct with RAM lining', mass: 210, explode: [0.4, -0.6, 1.6 * side],
      desc: 'Swept, raked lips create oblique shocks for supersonic pressure recovery; the S-duct hides the fan face from radar.',
      callout: side > 0, anchor: [X(6.2), -0.25, 1.4 * side],
    }, [outer, inner, plate]);
  }

  // ----------------------------------------------------------------- wings with control surfaces
  const wRoot = { le: [1.6, -0.05, 1.5], chord: 7.6, t: 0.045 };
  const wTip = { le: [1.6 - 5.28 * Math.tan((42 * Math.PI) / 180), -0.05 - 5.28 * Math.tan((3.25 * Math.PI) / 180), 6.78], chord: 1.55, t: 0.03 };
  const surfaces = { flaperon: [], aileron: [], rudder: [], stab: [], tvc: [] };

  for (const side of [1, -1]) {
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const box = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0, c1: 0.78, stations: 8 }));
    const tipFill = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.78, c1: 1, eta0: 0.96, eta1: 1, stations: 1 }));
    const wing = P(side > 0 ? 'Right wing' : 'Left wing', {
      system: 'Airframe', material: 'Ti-6Al-4V spars, composite skins', mass: 1350, explode: [0, 0.2, 2.6 * side],
      desc: '42° leading-edge sweep, 78 m² total area. Diamond planform aligns edges with the fuselage chines and tails.',
      callout: side > 0, anchor: [-1.4, 0.0, 4.6 * side],
    }, [mesh(box, SKIN.stealthWing()), mesh(tipFill, SKIN.stealthWing())]);
    wing.userData.part.thermalRole = 'leadingEdge';

    const fl = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.78, c1: 1, eta0: 0.04, eta1: 0.5, stations: 3 }));
    const flH = hingedMesh(fl, SKIN.stealthWing(), mz(wingPoint(wRoot, wTip, 0.04, 0.78)), mz(wingPoint(wRoot, wTip, 0.5, 0.78)));
    const ai = flip(wingPanel({ root: wRoot, tip: wTip, c0: 0.78, c1: 1, eta0: 0.52, eta1: 0.96, stations: 3 }));
    const aiH = hingedMesh(ai, SKIN.stealthWing(), mz(wingPoint(wRoot, wTip, 0.52, 0.78)), mz(wingPoint(wRoot, wTip, 0.96, 0.78)));
    [flH, aiH].forEach((h) => { h.mesh.castShadow = true; h.mesh.receiveShadow = true; });
    wing.add(flH.pivot, aiH.pivot);
    surfaces.flaperon.push({ h: flH, side });
    surfaces.aileron.push({ h: aiH, side });

    // wingtip lights
    const nav = mesh(new THREE.SphereGeometry(0.05, 10, 8), side > 0 ? M.navGreen() : M.navRed(), { cast: false });
    nav.position.set(wTip.le[0] - 0.25, wTip.le[1], 6.8 * side);
    const strip = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), M.formation(), { cast: false });
    strip.position.set(wTip.le[0] - 0.9, wTip.le[1] + 0.03, 6.6 * side);
    wing.add(nav, strip);

    // all-moving horizontal stabiliser
    const sRoot = { le: [-6.3, 0.0, 1.2], chord: 3.3, t: 0.04 };
    const sTip = { le: [-6.3 - 3.1 * Math.tan((42 * Math.PI) / 180), 0.0, 4.3], chord: 1.05, t: 0.03 };
    const stabGeo = flip(wingPanel({ root: sRoot, tip: sTip, stations: 4 }));
    const stabH = hingedMesh(stabGeo, SKIN.stealthWing(), new THREE.Vector3(-7.6, 0, 0), new THREE.Vector3(-7.6, 0, side));
    stabH.mesh.castShadow = true;
    P(side > 0 ? 'Right stabilator' : 'Left stabilator', {
      system: 'Flight controls', material: 'Composite over titanium spindle', mass: 280, explode: [-1.8, 0, 1.9 * side],
      desc: 'All-moving tailplane for pitch control; deflects differentially to assist roll at high AoA.',
    }, stabH.pivot);
    surfaces.stab.push({ h: stabH, side });

    // canted vertical tail with rudder (built in a local frame, then rotated upright)
    const fin = new THREE.Group();
    fin.position.set(-4.9, 0.3, 1.2 * side);
    fin.rotation.x = -Math.PI / 2 + 0.47 * side;
    const vRoot = { le: [0, 0, 0], chord: 3.5, t: 0.04 };
    const vTip = { le: [-2.6 * Math.tan((24 * Math.PI) / 180), 0, 2.6], chord: 1.35, t: 0.03 };
    fin.add(mesh(wingPanel({ root: vRoot, tip: vTip, c0: 0, c1: 0.7, stations: 4 }), SKIN.stealthWing()));
    fin.add(mesh(wingPanel({ root: vRoot, tip: vTip, c0: 0.7, c1: 1, eta0: 0, eta1: 0.12, stations: 1 }), SKIN.stealthWing()));
    fin.add(mesh(wingPanel({ root: vRoot, tip: vTip, c0: 0.7, c1: 1, eta0: 0.88, eta1: 1, stations: 1 }), SKIN.stealthWing()));
    const rud = wingPanel({ root: vRoot, tip: vTip, c0: 0.7, c1: 1, eta0: 0.12, eta1: 0.88, stations: 3 });
    const rudH = hingedMesh(rud, SKIN.stealthWing(), wingPoint(vRoot, vTip, 0.12, 0.7), wingPoint(vRoot, vTip, 0.88, 0.7));
    rudH.mesh.castShadow = true;
    fin.add(rudH.pivot);
    const finStrip = mesh(new THREE.BoxGeometry(0.6, 0.06, 0.03), M.formation(), { cast: false });
    finStrip.position.set(-1.2, -0.035 * side, 1.4);
    fin.add(finStrip);
    surfaces.rudder.push({ h: rudH, side });
    P(side > 0 ? 'Right vertical tail' : 'Left vertical tail', {
      system: 'Flight controls', material: 'Composite, RAM edges', mass: 240, explode: [-0.6, 1.8, 1.0 * side],
      desc: '27° outward cant keeps the fins out of the strong side-on radar returns that a vertical surface would give.',
      callout: side > 0, anchor: [-6.4, 2.3, 2.3 * side],
    }, fin);
  }

  // ----------------------------------------------------------------- engines & 2-D vectoring nozzles
  const plumeMats = [];
  const turbineMat = M.turbineGlow().clone();
  for (const side of [1, -1]) {
    const z = 0.62 * side;
    const rr = (w, h, x) => {
      const pts = [];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const k = 3.2;   // superellipse exponent → rounded rectangle
        const yy = Math.sign(s) * Math.pow(Math.abs(s), 2 / k) * h / 2;
        const zz = Math.sign(c) * Math.pow(Math.abs(c), 2 / k) * w / 2;
        pts.push([x, yy, z + zz]);
      }
      return pts;
    };
    const duct = orientTubeOutward(loftRings([rr(1.05, 0.74, X(18.0)), rr(1.02, 0.7, X(18.8)), rr(0.98, 0.62, X(19.4))], { uvMode: 'metric' }));
    const nozOuter = mesh(duct, SKIN.stealthWing());
    const nozInner = mesh(duct, new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.5, metalness: 0.85, side: THREE.BackSide }));
    const face = mesh(new THREE.CircleGeometry(0.32, 24), turbineMat, { cast: false });
    face.rotation.y = -Math.PI / 2;
    face.position.set(X(18.9), 0, z);
    const vecPivot = new THREE.Group();
    vecPivot.position.set(X(19.4), 0, z);
    const flapU = mesh(new THREE.BoxGeometry(0.62, 0.04, 0.98), M.darkMetal());
    flapU.position.set(-0.31, 0.29, 0);
    const flapL = flapU.clone(); flapL.position.y = -0.29;
    const pm = plumeMaterial({ core: 0xfff3d6, outer: 0xff6a20, diamonds: 1.2 });
    plumeMats.push(pm);
    const plume = plumeMesh(0.3, 0.1, 6.5, pm);
    plume.rotation.z = -Math.PI / 2;
    plume.scale.set(1, 1, 1.45);
    plume.position.set(-0.1, 0, 0);
    const corePlume = plumeMesh(0.2, 0.04, 3.2, plumeMaterial({ core: 0xffffff, outer: 0x9fb8ff, diamonds: 2 }));
    plumeMats.push(corePlume.material);
    corePlume.rotation.z = -Math.PI / 2;
    corePlume.scale.set(1, 1, 1.4);
    vecPivot.add(flapU, flapL, plume, corePlume);
    surfaces.tvc.push(vecPivot);
    const eng = P(side > 0 ? 'Right engine & TVC nozzle' : 'Left engine & TVC nozzle', {
      system: 'Propulsion', material: 'Ceramic-matrix composite flaps, Ni superalloy', mass: 1770, explode: [-3.2, 0, 1.0 * side],
      desc: '156 kN afterburning turbofan. 2-D nozzle vectors ±20° in pitch for post-stall agility and hides the turbine face.',
      callout: side > 0, anchor: [X(19.2), 0.45, z],
    }, [nozOuter, nozInner, face, vecPivot]);
    eng.userData.part.thermalRole = 'nozzle';
  }

  // ----------------------------------------------------------------- landing gear
  const gear = [];
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 1, roughness: 0.08 });
  const gearPaint = new THREE.MeshStandardMaterial({ color: 0xd9dcde, metalness: 0.2, roughness: 0.45 });
  const wheel = (r, w) => {
    const g = new THREE.Group();
    const tyre = mesh(new THREE.TorusGeometry(r * 0.72, r * 0.28, 16, 36), new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.85 }));
    tyre.scale.z = w / (r * 0.56);
    const hub = mesh(new THREE.CylinderGeometry(r * 0.48, r * 0.48, w * 0.82, 24), M.aluminium());
    hub.rotation.x = Math.PI / 2;
    const cap = mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 0.9, 12), M.gunmetal());
    cap.rotation.x = Math.PI / 2;
    g.add(tyre, hub, cap);
    for (let k = 0; k < 6; k++) {
      const sp = mesh(new THREE.BoxGeometry(r * 0.08, r * 0.62, w * 0.86), M.gunmetal());
      sp.rotation.z = (k / 6) * Math.PI;
      g.add(sp);
    }
    return g;
  };
  // oleo strut: painted cylinder over a polished chrome slider, with a scissor torque link
  const oleo = (len, r, wheelR) => {
    const g = new THREE.Group();
    g.add(mesh(rod([0, 0, 0], [0, -len * 0.58, 0], r), gearPaint));
    g.add(mesh(rod([0, -len * 0.55, 0], [0, -len, 0], r * 0.72), chrome));
    g.add(mesh(rod([r * 1.2, -len * 0.45, 0], [r * 2.6, -len * 0.62, 0], r * 0.28), gearPaint));
    g.add(mesh(rod([r * 2.6, -len * 0.62, 0], [r * 1.0, -len * 0.84, 0], r * 0.28), gearPaint));
    g.add(mesh(rod([-r * 1.1, -0.05, r * 0.4], [-r * 1.1, -len * 0.9, r * 0.4], r * 0.12), M.darkMetal()));   // brake line
    const axle = mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, wheelR * 0.9, 10), chrome);
    axle.rotation.x = Math.PI / 2;
    axle.position.y = -len;
    g.add(axle);
    return g;
  };
  {
    const strut = new THREE.Group();
    strut.position.set(X(3.9), -0.42, 0);
    strut.add(oleo(1.95, 0.07, 0.3));
    strut.add(mesh(rod([0, -0.4, 0], [-0.3, -1.1, 0], 0.03), gearPaint));
    const wh = wheel(0.3, 0.18); wh.position.set(0.0, -1.98, 0);
    strut.add(wh);
    const taxi = mesh(new THREE.SphereGeometry(0.05, 8, 8), M.strobe().clone(), { cast: false });
    taxi.material.emissiveIntensity = 6;
    taxi.position.set(0.12, -0.9, 0);
    strut.add(taxi);
    gear.push({ g: strut, axis: 'z', up: 1.75 });
  }
  for (const side of [1, -1]) {
    const strut = new THREE.Group();
    strut.position.set(X(11.5), -0.46, 1.45 * side);
    strut.add(oleo(1.86, 0.09, 0.42));
    strut.add(mesh(rod([0, -0.2, 0], [0.4, -1.2, -0.25 * side], 0.035), gearPaint));
    const door = mesh(new THREE.BoxGeometry(1.1, 1.0, 0.025), SKIN.stealth());
    door.position.set(0.05, -0.55, 0.16 * side);
    strut.add(door);
    const wh = wheel(0.42, 0.26); wh.position.set(0, -1.86, 0.05 * side);
    strut.add(wh);
    gear.push({ g: strut, axis: 'x', up: 1.7 * side });
  }
  P('Landing gear', {
    system: 'Utilities', material: '300M steel, aluminium wheels', mass: 520, explode: [0, -1.4, 0],
    desc: 'Tricycle gear: the nose leg retracts forward, the mains fold inboard into wells beside the weapons bay.',
  }, gear.map((x) => x.g));

  // ----------------------------------------------------------------- weapons bay
  const bay = { doors: [], stores: [] };
  const doorGeo = (side) => new THREE.BoxGeometry(4.2, 0.03, 0.62).translate(0, 0, -0.31 * side);
  const bayParts = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(-1.7, -0.64, 0.7 * side);
    const d = mesh(doorGeo(side), SKIN.stealth());
    pivot.add(d);
    bay.doors.push({ pivot, side });
    bayParts.push(pivot);
  }
  const msl = missileGeometry();
  [-0.54, -0.18, 0.18, 0.54].forEach((z, i) => {
    const m = mesh(msl, M.missile());
    const tip = mesh(new THREE.SphereGeometry(0.06, 12, 8), M.seeker(), { cast: false });
    tip.position.set(1.82, 0, 0);
    const holder = new THREE.Group();
    holder.add(m, tip);
    holder.position.set(-1.7, -0.36, z);
    holder.rotation.x = Math.PI / 4;
    bay.stores.push({ holder, drop: 0.5 + (i % 2) * 0.12 });
    bayParts.push(holder);
  });
  P('Main weapons bay', {
    system: 'Weapons', material: 'Composite doors, trapeze launchers', mass: 640, explode: [0, -2.2, 0],
    desc: 'Four medium-range air-to-air missiles carried internally. Trapeze launchers push each round clear of the airflow in ~0.1 s.',
    callout: true, anchor: [-1.7, -0.8, 0.0],
  }, bayParts);

  // ----------------------------------------------------------------- lights, probe, vapour cone
  const pitot = mesh(rod([X(0) + 0.6, -0.1, 0], [X(0) - 0.2, -0.1, 0], 0.012, 6), M.aluminium(), { cast: false });
  const strobe = mesh(new THREE.SphereGeometry(0.06, 10, 8), M.strobe().clone(), { cast: false });
  strobe.position.set(X(18.7), 0.42, 0);
  const chineStrips = [1, -1].map((side) => {
    const s = mesh(new THREE.BoxGeometry(0.7, 0.05, 0.02), M.formation(), { cast: false });
    s.position.set(X(4.6), 0.02, 0.9 * side);
    return s;
  });
  P('Air data & lighting', {
    system: 'Avionics', material: 'Steel probe, LED lighting', mass: 12, explode: [1.2, 0.6, 0],
    desc: 'Pitot probe for air data; electroluminescent formation strips are visible only at close range in night formation.',
  }, [pitot, strobe, ...chineStrips]);

  const vcMat = vaporConeMaterial();
  const vcGeo = new THREE.CylinderGeometry(0.4, 3.4, 9, 48, 8, true);
  vcGeo.rotateZ(-Math.PI / 2);
  const vapor = new THREE.Mesh(vcGeo, vcMat);
  vapor.position.set(X(7.5), 0.1, 0);
  vapor.userData.fx = true;
  vapor.renderOrder = 11;
  attitude.add(vapor);

  // ----------------------------------------------------------------- fine detail: antennas, nozzle internals
  const bladeShape = (h, c) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(c, 0); sh.lineTo(c * 0.55, h); sh.lineTo(c * 0.25, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
    g.translate(-c / 2, 0, -0.01);
    return g;
  };
  const antennas = [[-1.2, 0.6, 1, 0.16, 0.28], [-4.0, 0.53, 1, 0.12, 0.22], [2.4, -0.6, -1, 0.14, 0.24]].map(([x, y, up, h, c]) => {
    const m = mesh(bladeShape(h, c), SKIN.stealthWing());
    m.rotation.y = Math.PI;
    if (up < 0) m.rotation.x = Math.PI;
    m.position.set(x, y, 0);
    return m;
  });
  const dispensers = [1, -1].map((side) => {
    const m = mesh(new THREE.BoxGeometry(0.42, 0.12, 0.02), M.darkMetal());
    m.position.set(X(16.2), -0.34, 1.33 * side);
    m.rotation.x = 0.55 * side;
    return m;
  });
  P('Antennas & countermeasures', {
    system: 'Avionics', material: 'Composite blade antennas, flare dispensers', mass: 40, explode: [0, 1.2, 0],
    desc: 'Communication, navigation and IFF blades sit flush or in-line with the airflow; flare dispensers are buried in the lower aft fuselage.',
  }, [...antennas, ...dispensers]);

  // nozzle internals: afterburner spray rings and the last turbine stage glowing at the back of each duct
  const hot = new THREE.MeshStandardMaterial({ color: 0x3a3336, metalness: 0.9, roughness: 0.42 });
  for (const side of [1, -1]) {
    const eng = A.parts.find((q) => q.name.startsWith(side > 0 ? 'Right engine' : 'Left engine'));
    for (const [r, x] of [[0.27, X(18.55)], [0.17, X(18.6)]]) {
      const ring = mesh(new THREE.TorusGeometry(r, 0.014, 6, 32), hot);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 0, 0.62 * side);
      eng.add(ring);
    }
    const bladeRow = [];
    for (let k = 0; k < 36; k++) {
      const b = new THREE.BoxGeometry(0.01, 0.2, 0.035).translate(0, 0.14, 0).rotateY(0.6).rotateX((k / 36) * Math.PI * 2);
      bladeRow.push(b.toNonIndexed());
    }
    const blades = mesh(mergeGeometries(bladeRow), turbineMat);
    blades.position.set(X(18.92), 0, 0.62 * side);
    eng.add(blades);
  }

  // ----------------------------------------------------------------- markings (projected decals)
  attitude.updateMatrixWorld(true);
  const partMesh = (name, i = 0) => {
    const part = A.parts.find((q) => q.name === name);
    const list = [];
    part.traverse((o) => { if (o.isMesh) list.push(o); });
    return { part, mesh: list[i] };
  };
  const c27 = 0.47;
  for (const side of [1, -1]) {
    const tail = partMesh(side > 0 ? 'Right vertical tail' : 'Left vertical tail');
    const n = [0, -Math.sin(c27), Math.cos(c27) * side];
    const at = [-6.35, 0.3 + 1.25 * Math.cos(c27), side * (1.2 + 1.25 * Math.sin(c27))].map((v, i) => v + n[i] * 0.045);
    tail.part.add(decal(tail.mesh, tailCode('AF', '07-4021'), { at, dir: n, size: [1.35, 1.35, 0.07] }));
    const intake = partMesh(side > 0 ? 'Right caret intake' : 'Left caret intake');
    const ni = [0, -0.3, 0.95 * side];
    intake.part.add(decal(intake.mesh, emblem(), { at: [2.0, -0.3, 1.52 * side + 0.03 * side], dir: ni, size: [0.95, 0.48, 0.2] }));
    const fwd = partMesh('Forward fuselage');
    fwd.part.add(decal(fwd.mesh, danger('WARNING · INTAKE'), { at: [X(5.6), -0.12, 1.02 * side], dir: [0, 0, side], size: [0.95, 0.3, 0.3], roughness: 0.5 }));
    fwd.part.add(decal(fwd.mesh, rescue(), { at: [X(4.6), 0.45, 0.72 * side], dir: [0, 0.65, 0.76 * side], size: [0.5, 0.25, 0.3] }));
    const wing = partMesh(side > 0 ? 'Right wing' : 'Left wing');
    for (const [x, z] of [[-3.4, 2.6], [-2.6, 4.2]]) {
      wing.part.add(decal(wing.mesh, stencilText('NO STEP', 'rgba(30,34,38,0.85)', true), { at: [x, 0.08, z * side], dir: [0, 1, 0], size: [0.6, 0.15, 0.2], angle: Math.PI / 2 }));
    }
  }
  const spine = partMesh('Centre fuselage');
  spine.part.add(decal(spine.mesh, panelOutline('ar'), { at: [0.6, 0.66, 0], dir: [0, 1, 0], size: [0.62, 0.62, 0.3] }));
  spine.part.add(decal(spine.mesh, panelOutline('gun'), { at: [0.2, 0.5, 1.15], dir: [0, 1, 0.25], size: [0.5, 0.32, 0.3] }));
  const leftWing = partMesh('Left wing');
  leftWing.part.add(decal(leftWing.mesh, emblem(), { at: [-1.2, 0.08, -4.1], dir: [0, 1, 0], size: [1.5, 0.75, 0.25], angle: -Math.PI / 2 }));
  const radomeMesh = partMesh('Forward fuselage');
  radomeMesh.part.add(decal(radomeMesh.mesh, stencilText('AX-7  07-4021', 'rgba(36,40,46,0.9)'), { at: [X(6.6), -0.36, 1.3], dir: [0, -0.2, 1], size: [1.0, 0.25, 0.3] }));

  A.finalize();

  // ----------------------------------------------------------------- behaviour
  const state = {
    gear: 1, bay: 0, pitch: 0, roll: 0, yaw: 0, throttle: 0.0, mach: 0.2, altitude: 0, alpha: 0,
    airborne: 0, flight: null, strobeT: 0,
  };
  const targets = { gear: 1, bay: 0, airborne: 0 };
  const approach = (cur, tgt, rate, dt) => cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);

  const vehicle = {
    id: 'fighter',
    designation: 'AX-7',
    name: 'WRAITH',
    role: 'Air superiority fighter',
    tagline: 'Fifth generation · very low observable · supercruise',
    summary: 'A twin-engine stealth air-dominance fighter. Every edge on the airframe is aligned to a handful of angles so radar energy is reflected in a few narrow spikes rather than back to the emitter. Internal carriage, serpentine ducts and canted fins complete the signature work; 2-D vectoring nozzles give control beyond the stall.',
    specs: [
      ['Length', '19.0 m'], ['Wingspan', '13.56 m'], ['Wing area', '78.0 m²'], ['LE sweep', '42°'],
      ['Combat mass', '29,300 kg'], ['Thrust', '2 × 156 kN (A/B)'], ['Max speed', 'Mach 2.25'], ['Supercruise', 'Mach 1.5+'],
      ['Ceiling', '19,800 m'], ['Load limit', '+9 / −3 g'],
    ],
    fleetTag: 'Mach 2.25',
    aero: true,
    root: A.root,
    attitude,
    parts: A.parts,
    view: { dir: [1.05, 0.5, 1.15], fill: 1.0 },
    displaySize: 11,
    thermalRange: [200, 1600],
    state,
    targets,
    setGear(v) { targets.gear = v ? 1 : 0; },
    setBay(v) { targets.bay = v ? 1 : 0; },
    setAirborne(v) { targets.airborne = v ? 1 : 0; },
    temperatureOf(info) {
      const f = state.flight;
      const T = f ? f.atm.T : 288;
      const stag = f ? recoveryTemperature(f.atm.T, state.mach, 0.89) : 288;
      if (info.thermalRole === 'stagnation') return stag;
      if (info.thermalRole === 'leadingEdge') return T + (stag - T) * 0.92;
      if (info.thermalRole === 'nozzle') return 600 + state.throttle * 700 + (state.throttle > 0.8 ? 450 : 0);
      if (info.system === 'Weapons') return T + (stag - T) * 0.4;
      return T + (stag - T) * 0.8;
    },
    update(dt, t) {
      state.gear = approach(state.gear, targets.gear, 0.45, dt);
      state.bay = approach(state.bay, targets.bay, 1.4, dt);
      state.airborne = approach(state.airborne, targets.airborne, 0.5, dt);
      const g = state.gear;
      for (const { g: strut, axis, up } of gear) {
        const a = (1 - g) * up;
        if (axis === 'z') strut.rotation.z = a; else strut.rotation.x = a;
      }
      const b = state.bay;
      const doorOpen = Math.min(1, b * 1.6);
      for (const { pivot, side } of bay.doors) pivot.rotation.x = -side * doorOpen * 1.75;
      const drop = Math.max(0, (b - 0.4) / 0.6);
      for (const { holder, drop: d } of bay.stores) holder.position.y = -0.36 - drop * d;

      const deg = Math.PI / 180;
      // sign conventions: +roll = right wing down, +pitch = nose up, +yaw = nose right
      const flap = 18 * state.gear * (1 - state.airborne);
      for (const { h, side } of surfaces.flaperon) h.setAngle((-state.roll * 12 + flap * side) * deg);
      for (const { h } of surfaces.aileron) h.setAngle(-state.roll * 20 * deg);
      for (const { h, side } of surfaces.stab) h.setAngle((-state.pitch * 22 * side - state.roll * 6) * deg);
      for (const { h } of surfaces.rudder) h.setAngle(state.yaw * 28 * deg);
      for (const p of surfaces.tvc) p.rotation.z = -state.pitch * 20 * deg;

      const thr = state.throttle;
      const ab = Math.max(0, (thr - 0.8) / 0.2);
      for (let i = 0; i < plumeMats.length; i++) {
        const pm = plumeMats[i];
        pm.uniforms.time.value = t;
        const isCore = i % 2 === 1;
        pm.uniforms.intensity.value = isCore ? (thr > 0.04 ? 0.05 + thr * 0.35 + ab * 0.6 : 0) : ab * 1.1;
      }
      turbineMat.emissiveIntensity = 0.5 + thr * 3.6 + ab * 3;

      const m = state.mach;
      const transonic = Math.max(0, 1 - Math.abs(m - 1.0) / 0.06);
      const humid = Math.max(0, 1 - state.altitude / 9000);
      vcMat.uniforms.strength.value = transonic * (0.3 + 0.7 * humid) * state.airborne;
      vcMat.uniforms.time.value = t;
      vapor.visible = vcMat.uniforms.strength.value > 0.01;

      state.strobeT += dt;
      strobe.material.emissiveIntensity = (state.strobeT % 1.2) < 0.08 ? 18 : 0;

      // flight pose: lift off the platform and take up attitude
      const air = state.airborne;
      attitude.position.y = air * 1.6 + Math.sin(t * 0.9) * 0.08 * air;
      attitude.rotation.z = air * (state.alpha * deg * 0.9 + state.pitch * 0.06);
      attitude.rotation.x = air * state.roll * 0.35;
      attitude.rotation.y = -air * state.yaw * 0.08;
    },
  };
  return vehicle;
}
