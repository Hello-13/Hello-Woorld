// F-22A avionics, sensors, antennas and lights: the two common integrated processors, the
// AN/ASQ-220 CNI suite and its apertures (UHF/VHF, IFF, GPS, TACAN / landing aids, IFDL), the
// inertial reference, the AN/APG-77 AESA radar (array tilted back, mount, receiver / exciter), the
// AN/ALR-94 passive receivers and the AN/AAR-56 missile-launch detectors, air-data probes, and the
// position, formation and anti-collision lights. Box positions inside the avionics bays are
// approximate; aperture positions are illustrative.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { M } from '../../engine/materials.js';
import { naca00 } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge } from './util.js';
import { normalA } from './systems.js';

const { X } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);

/** Thin patch (flush aperture) at p, facing n. */
function patchGeo(p, n, w = 0.12, h = 0.05, t = 0.008) {
  const geo = new THREE.BoxGeometry(w, t, h);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
  return geo.translate(p.x, p.y, p.z);
}

export function buildAvionics(ctx) {
  const { P, anim } = ctx;

  // ================================================================== avionics bay (behind the radar bulkhead)
  for (const [k, z] of [[1, 0.2], [2, -0.2]]) {
    const g = [box(3.3, 0.12, z, 0.55, 0.3, 0.25)];
    for (let i = 0; i < 6; i++) g.push(box(3.08 + i * 0.09, 0.28, z, 0.012, 0.03, 0.22));      // module card tops
    P(`Common integrated processor (CIP ${k})`, {
      system: 'Avionics', material: 'Liquid-cooled rack of standard electronic modules', mass: 60,
      explode: [1.9, 1.2, z * 2],
      desc: `One of two Hughes common integrated processors (bay space for a third). Each runs the radar, electronic-warfare, CNI and fusion software on modules cooled by the PAO loop; sensor fusion merges every sensor's tracks into one picture before the pilot sees it.`,
    }, mesh(merge(g), F.box()));
  }
  P('CNI suite (AN/ASQ-220)', {
    system: 'Avionics', material: 'Integrated comm / nav / identification modules', mass: 70,
    explode: [2.1, -0.75, 0],
    desc: 'TRW\'s integrated communication, navigation and identification suite: radios (HAVE QUICK, SINCGARS, later Link 16 receive), IFF including Mode 5, TACAN and landing aids share common modules instead of a box per radio, and its emissions are tightly controlled for stealth.',
  }, mesh(merge([box(3.22, -0.19, 0.16, 0.6, 0.2, 0.24), box(3.22, -0.19, -0.16, 0.6, 0.2, 0.24)]), F.boxLight()));
  P('Intra-flight data link', {
    system: 'Avionics', material: 'Low-probability-of-intercept data-link processor', mass: 15,
    explode: [0.6, 0.6, 1.1],
    desc: 'The IFDL processor shares sensor tracks silently between F-22s in a flight using narrow, directional, hard-to-detect transmissions.',
  }, mesh(merge([box(4.9, -0.22, 0.42, 0.4, 0.18, 0.12)]), F.box()));
  P('Inertial navigation & GPS', {
    system: 'Avionics', material: 'Ring-laser-gyro inertial reference with embedded GPS', mass: 18,
    explode: [2.0, 1.75, 0],
    desc: 'Measures the jet\'s attitude, velocity and position, corrected by GPS, for navigation, weapons and the flight controls.',
  }, mesh(box(2.96, 0.08, 0, 0.18, 0.18, 0.22), F.box()));
  P('AN/ALR-94 receiver processors', {
    system: 'Sensors', material: 'Wideband receivers and signal processors', mass: 40, count: 2,
    explode: [1.6, 0.4, 1.0],
    desc: 'Receivers behind the ALR-94\'s distributed antennas measure the frequency, timing and direction of every radar emitter they hear, so the system can identify a threat and fix its position passively (location approximate).',
  }, mesh(merge([box(3.92, 0.12, 0.25, 0.3, 0.2, 0.18), box(3.92, 0.12, -0.25, 0.3, 0.2, 0.18)]), F.boxLight()));
  P('Vehicle management system computers', {
    system: 'Flight controls', material: 'Redundant flight-control processors', mass: 25, count: 3,
    explode: [2.2, 1.95, 0.6],
    desc: 'Fly-by-wire computers turn stick and throttle inputs into surface and nozzle commands many times a second. The airframe is unstable in pitch for agility, so they never stop correcting (channel count illustrative).',
  }, mesh(merge([box(4.3, -0.22, 0.36, 0.3, 0.16, 0.12), box(4.3, -0.22, -0.36, 0.3, 0.16, 0.12), box(4.7, -0.22, -0.36, 0.3, 0.16, 0.12)]), F.boxLight()));

  // ================================================================== AN/APG-77 radar
  {
    // the fixed array leans back 20°: its top edge sits aft of its bottom edge and its face looks
    // forward and up, so it never squares up to a radar ahead (Wikipedia: "tilted back for stealth")
    const tilt = 20 * FR.DEG;
    const at = (s0) => X(s0);
    const face = new THREE.CircleGeometry(1, 48).scale(0.45, 0.31, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(at(2.35), -0.03, 0);
    const back = new THREE.CylinderGeometry(1, 1, 0.06, 48).rotateX(Math.PI / 2).scale(0.45, 0.31, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(at(2.385), -0.03, 0);
    // tile rows: thin strips that read as the subarrays of transmit/receive modules
    const rows = [];
    for (let k = -6; k <= 6; k++) {
      const yy = k * 0.05;
      const half = 0.45 * Math.sqrt(Math.max(0, 1 - (yy / 0.31) ** 2));
      if (half < 0.05) continue;
      rows.push(new THREE.BoxGeometry(0.004, 0.006, half * 2).translate(0, yy, 0));
    }
    const grid = merge(rows).rotateZ(tilt).translate(at(2.345), -0.03, 0);
    P('AN/APG-77 AESA array', {
      system: 'Sensors', material: 'Gallium-arsenide transmit/receive modules on a cooled backplane', mass: 220,
      explode: [2.5, 0.35, 0], callout: true, anchor: [X(2.4), 0.2, 0.1],
      desc: 'About 1,956 thumb-sized transmit/receive modules (the most cited figure; sources range ~1,900–2,000) steer the beam electronically in microseconds with no moving antenna. The fixed array is tilted back, face looking slightly up, so it never squares up to another radar.',
    }, [mesh(face, F.array()), mesh(back, F.alu()), mesh(grid, F.tile(), { cast: false })]);
    // mount: ring frame behind the array, struts back to the radar bulkhead (s 2.55)
    const m = [];
    const ringC = V(at(2.42), -0.03, 0);
    m.push(new THREE.TorusGeometry(1, 0.03, 6, 48).scale(0.4, 0.27, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(ringC.x, ringC.y, ringC.z));
    for (const [yy, zz] of [[0.2, 0.25], [0.2, -0.25], [-0.22, 0.25], [-0.22, -0.25]]) {
      // a point on the tilted ring plane at local (yy, zz) → its station, then a strut aft to the bulkhead
      const lx = -yy * Math.sin(tilt), ly = yy * Math.cos(tilt);
      const p = [FR.SN - (ringC.x + lx), ringC.y + ly, zz];
      m.push(FR.pipe([p, [2.53, p[1], zz]], 0.025, 6, 2));
    }
    P('APG-77 array mount & coolant manifold', {
      system: 'Sensors', material: 'Aluminium mount, PAO manifold', mass: 40,
      explode: [2.0, 0.35, 0],
      desc: 'Holds the array at its fixed tilt off the radar bulkhead and feeds liquid coolant to the cold plates behind the modules — an AESA turns much of its power into heat.',
    }, mesh(merge(m), F.alu()));
    P('APG-77 receiver / exciter & power supply', {
      system: 'Sensors', material: 'Radar receiver, exciter and power-supply modules', mass: 60,
      explode: [1.6, 0.85, 0],
      desc: 'Generates the radar waveforms and digitises the returns; the signal processing itself runs in the common integrated processors.',
    }, mesh(merge([box(2.7, 0.18, 0, 0.16, 0.12, 0.4), box(2.7, -0.22, 0, 0.16, 0.1, 0.36)]), F.boxLight()));
  }

  // ================================================================== distributed sensors
  {
    const g = [];
    const patch = (p, n, w, h) => g.push(patchGeo(p, n, w, h));
    for (const side of [1, -1]) {
      for (const eta of [0.2, 0.45, 0.7, 0.92]) {
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        patch(V(sec.le[0] - 0.02 * sec.chord, sec.le[1] + naca00(0.02, sec.t) * sec.chord + 0.002, side * z), V(0.2, 1, 0), 0.1, 0.16);
      }
      for (const eta of [0.35, 0.8]) {
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        patch(V(sec.le[0] - 0.9 * sec.chord, sec.le[1] + 0.012, side * z), V(0, 1, 0), 0.08, 0.14);
      }
      for (const s of [1.8, 2.3, 4.0]) { const z = FR.aW(s) - 0.07; patch(V(X(s), FR.upperA(s, z) + 0.003, side * z), normalA(s, side * z), 0.12, 0.04); }
      for (const s of [16.2, 17.0]) patch(V(X(s), FR.topAt(s, 1.4) + 0.004, side * 1.4), V(0, 1, side * 0.3), 0.12, 0.05);
      patch(V(X(17.2), -FR.bD(17.2) - 0.004, side * 1.0), V(0, -1, 0), 0.12, 0.05);
    }
    P('AN/ALR-94 EW apertures', {
      system: 'Sensors', material: 'Conformal broadband antennas', mass: 30, count: 24,
      explode: [0, 0.3, 0],
      desc: 'The real ALR-94 blends more than 30 antennas into the wings and fuselage for all-round radar-warning coverage and threat location, often cueing the APG-77; 24 representative apertures are modelled, at illustrative positions.',
    }, mesh(merge(g), F.composite()));
  }
  {
    const g = [];
    const eye = (p, n) => {
      const geo = new THREE.CylinderGeometry(0.055, 0.06, 0.02, 18);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
      geo.translate(p.x, p.y, p.z);
      g.push(geo);
    };
    for (const side of [1, -1]) {
      eye(V(X(3.2), FR.upperA(3.2, 0.45) + 0.004, side * 0.45), normalA(3.2, side * 0.45));
      eye(V(X(3.4), FR.bottomAt(3.4, 0.35) - 0.004, side * 0.35), V(0, -1, side * 0.6));
      eye(V(X(16.8), -FR.bD(16.8) * 0.6, side * (FR.bW(16.8) - 0.05)), V(0, -0.3, side));
    }
    P('AN/AAR-56 missile launch detectors', {
      system: 'Sensors', material: 'Infrared sensor windows', mass: 18, count: 6,
      explode: [0, 0.3, 0.4],
      desc: 'Six infrared sensors give full spherical coverage to warn of a missile launch and cue countermeasures (window positions approximate).',
    }, mesh(merge(g), F.lens()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s, dy] of [[2.05, -0.05], [2.5, 0.06]]) {
        const z = FR.aW(s) - 0.02;
        const y = FR.aYC(s) + dy;
        g.push(FR.pipe([[s, y, side * z], [s - 0.02, y, side * (z + 0.07)]], 0.008, 6, 2));
        g.push(FR.cylX(s - 0.1, y, side * (z + 0.07), 0.2, 0.006, 0.008, 6));
      }
    }
    P('Air-data probes', {
      system: 'Sensors', material: 'Heated multi-function pitot-static probes', mass: 6, count: 4,
      explode: [1.6, 0, 0.45],
      desc: 'Small L-shaped probes on the sides of the nose measure total and static pressure and flow angle for the flight controls and air-data computers; they are electrically heated against ice (count approximate).',
    }, mesh(merge(g), F.probe()));
  }

  // ================================================================== CNI apertures (communications)
  {
    const blade = (s, y, up, h, c) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(c, 0); sh.lineTo(c * 0.62, h); sh.lineTo(c * 0.3, h); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false });
      g.translate(-c / 2, 0, -0.008);
      g.rotateY(Math.PI);
      if (up < 0) g.rotateX(Math.PI);
      return g.translate(X(s), y, 0);
    };
    P('UHF/VHF blade antennas', {
      system: 'Communications', material: 'Composite blade antennas', mass: 4, count: 2,
      explode: [0, 0.85, 0],
      desc: 'Only two small blades break the outline, on the spine and the belly, for voice and data radios (HAVE QUICK, SINCGARS); most other CNI antennas are flush with the skin.',
    }, mesh(merge([blade(9.9, FR.topAt(9.9, 0) - 0.01, 1, 0.13, 0.26), blade(6.2, FR.bottomAt(6.2, 0) + 0.01, -1, 0.12, 0.22)]), F.wing()));
    const top = (s, z) => V(X(s), FR.topAt(s, Math.abs(z)) + 0.003, z);
    const bot = (s, z) => V(X(s), FR.bottomAt(s, z) - 0.003, z);
    P('GPS antenna', {
      system: 'Communications', material: 'Flush patch antenna', mass: 1,
      explode: [0, 1.1, 0],
      desc: 'A flush patch on the spine looking up at the GPS satellites, feeding the embedded GPS in the inertial navigation system.',
    }, mesh(patchGeo(top(10.8, 0), V(0, 1, 0), 0.14, 0.14), F.composite()));
    P('IFF antennas', {
      system: 'Communications', material: 'Flush conformal arrays, upper and lower', mass: 3, count: 2,
      explode: [0, 1.25, -0.4],
      desc: 'Flush arrays above and below the fuselage answer and send identification-friend-or-foe interrogations (including Mode 5); the interrogator can steer its beam so it questions only the target it means to (positions approximate).',
    }, mesh(merge([patchGeo(top(7.0, 0.42), normalA(7.0, 0.42), 0.22, 0.06), patchGeo(bot(7.4, 0.2), V(0, -1, 0), 0.22, 0.06)]), F.composite()));
    P('TACAN & landing-aid antennas', {
      system: 'Communications', material: 'Flush annular-slot and patch antennas', mass: 3, count: 3,
      explode: [0, -1.0, 0.4],
      desc: 'Flush antennas for TACAN (range and bearing to a beacon or tanker) and the instrument landing aids, upper and lower so one is always in view (positions approximate).',
    }, mesh(merge([patchGeo(top(12.1, 0), V(0, 1, 0), 0.16, 0.16), patchGeo(bot(5.2, 0.3), V(0, -1, 0), 0.16, 0.1), patchGeo(bot(5.2, -0.3), V(0, -1, 0), 0.16, 0.1)]), F.composite()));
    const ifdl = [];
    for (const side of [1, -1]) ifdl.push(patchGeo(top(11.0, side * 1.25), V(0, 1, side * 0.55), 0.2, 0.08), patchGeo(top(15.6, side * 1.15), V(0, 1, side * 0.4), 0.16, 0.06));
    P('IFDL apertures', {
      system: 'Communications', material: 'Flush directional antennas', mass: 4, count: 4,
      explode: [0, 1.4, 0.4],
      desc: 'Directional apertures for the inter/intra-flight data link: they point narrow beams at the other jets in a flight, so the link is very hard for anyone else to detect (positions illustrative).',
    }, mesh(merge(ifdl), F.composite()));
  }

  // ================================================================== lighting
  {
    const red = [], green = [], white = [], form = [];
    for (const { side, le, chord } of ctx.wingTips) {
      const lens = new THREE.SphereGeometry(0.045, 12, 8).scale(1.6, 0.6, 0.6).translate(le.x - 0.15 * chord, le.y, le.z + side * 0.005);
      (side > 0 ? green : red).push(lens);
      form.push(new THREE.BoxGeometry(0.5, 0.006, 0.05).translate(le.x - 0.55 * chord, le.y + 0.03, le.z - side * 0.15));
    }
    for (const side of [1, -1]) { const pts = []; for (let s = 4.3; s <= 4.91; s += 0.15) { const z = FR.aW(s) - 0.07; pts.push([s, FR.upperA(s, z) + 0.004, side * z]); } form.push(FR.pipe(pts, 0.011, 6, 8)); }
    // strips on the outer face of each canted fin, about two-thirds of the way up
    const T = FR.FIN;
    for (const side of [1, -1]) {
      const eta = 0.68, c = T.rootC + (T.tipC - T.rootC) * eta;
      const leX = -T.span * eta * Math.tan(T.sweep);
      const half = naca00(0.45, 0.04) * c;
      const strip = new THREE.BoxGeometry(0.42, 0.006, 0.045).translate(leX - 0.45 * c, -side * (half + 0.004), T.span * eta);
      const mtx = new THREE.Matrix4().makeRotationX(-Math.PI / 2 + T.cant * side).setPosition(X(T.rootS), T.rootY, side * T.rootZ);
      form.push(strip.applyMatrix4(mtx));
    }
    white.push(new THREE.SphereGeometry(0.035, 10, 8).translate(X(18.62), -0.08, -1.52));
    // steady, modest intensities: these are small lamps, not light sources for the scene
    const lamp = (c, e, k) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: k, roughness: 0.4 });
    const navG = mesh(merge(green), lamp(0x002200, 0x2bff6a, 2.2), { cast: false });
    const navR = mesh(merge(red), lamp(0x220000, 0xff2a1a, 2.2), { cast: false });
    const navW = mesh(merge(white), lamp(0x222222, 0xffffff, 1.6), { cast: false });
    const strips = mesh(merge(form), lamp(0x3a4a34, 0x7dffa0, 0.12), { cast: false });
    anim.lamps = [navG.material, navR.material, navW.material, strips.material];
    P('Position lights', {
      system: 'Electrical', material: 'LED position lights', mass: 2, count: 3,
      explode: [0, 0.6, 0],
      desc: 'Red (left) and green (right) lights at the wing tips and a white tail light on the left boom fairing.',
    }, [navG, navR, navW]);
    P('Formation light strips', {
      system: 'Electrical', material: 'Low-intensity electroluminescent strips', mass: 3, count: 6,
      explode: [0, 0.75, 0],
      desc: 'Dim green strips on the nose chines, the wing tips and the outer faces of both fins let a wingman hold position at night without the jet showing from far away.',
    }, strips);
    const stMat = M.strobe().clone();
    const s1 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(16.9), FR.topAt(16.9, 0) + 0.02, 0);
    const s2 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(12.8), -FR.bD(12.8) - 0.02, 0);
    P('Anti-collision strobes', {
      system: 'Electrical', material: 'White LED strobes', mass: 2, count: 2,
      explode: [-0.4, 0.9, 0],
      desc: 'White anti-collision strobes on the spine and belly (positions approximate). In flight they give one short flash a second; on the ground and in the hangar they stay off.',
    }, mesh(merge([s1, s2]), stMat, { cast: false }));
    anim.strobe = stMat;
  }
}
