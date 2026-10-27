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
import { merge, slab } from './util.js';

const { X, lerp } = FR;
const SM = FR.M;               // fuselage station map (FR.M; M is the shared materials here)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);

/** Thin patch (flush aperture) at p, facing n. */
function patchGeo(p, n, w = 0.12, h = 0.05, t = 0.008) {
  const geo = new THREE.BoxGeometry(w, t, h);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
  return geo.translate(p.x, p.y, p.z);
}

// outward normals of the outer mould line from its station functions (x = SN − s, so ∂/∂x = −∂/∂s), for apertures laid
// flat on a skin that slopes both along and across the jet
const E_N = 0.01;
/** Upward normal of the top surface y = topAt(s, |z|). */
const topNormal = (s, z) => { const fs = (FR.topAt(s + E_N, Math.abs(z)) - FR.topAt(s - E_N, Math.abs(z))) / (2 * E_N), fz = (FR.topAt(s, Math.abs(z) + E_N) - FR.topAt(s, Math.max(0, Math.abs(z) - E_N))) / (2 * E_N) * Math.sign(z || 1); return V(fs, 1, -fz).normalize(); };
/** Downward normal of the bottom surface y = bottomAt(s, z). */
const botNormal = (s, z) => { const bs = (FR.bottomAt(s + E_N, z) - FR.bottomAt(s - E_N, z)) / (2 * E_N), bz = (FR.bottomAt(s, z + E_N) - FR.bottomAt(s, z - E_N)) / (2 * E_N); return V(-bs, -1, bz).normalize(); };
/** Outward normal of the trunk side wall z = ±wallZ(s, y). */
const wallNormal = (s, y, side) => { const ws = (FR.wallZ(s + E_N, y) - FR.wallZ(s - E_N, y)) / (2 * E_N), wy = (FR.wallZ(s, y + E_N) - FR.wallZ(s, y - E_N)) / (2 * E_N); return V(ws, -wy, 1).multiply(V(1, 1, side)).normalize(); };

export function buildAvionics(ctx) {
  const { P, anim } = ctx;

  // ================================================================== avionics bay (behind the radar bulkhead)
  // (FR.AV_BAY: between the radar bulkhead and the forward cockpit bulkhead, two rack levels)
  const AV = FR.AV_BAY, uTop = AV.shelfUp + 0.01, lTop = AV.shelfLo + 0.01;
  for (const [k, z] of [[1, AV.cip.z], [2, -AV.cip.z]]) {
    const C = AV.cip;
    const g = [box(C.s, C.y, z, C.ls, C.h, C.w)];
    for (let i = 0; i < 6; i++) g.push(box(C.s - 0.225 + i * 0.09, C.y + C.h / 2 + 0.015, z, 0.012, 0.03, C.w - 0.02));      // module card tops
    P(`Common integrated processor (CIP ${k})`, {
      system: 'Avionics', material: 'Liquid-cooled rack of standard electronic modules', mass: 60,
      explode: [1.9, 1.2, z * 2],
      desc: `One of two Hughes common integrated processors (bay space for a third). Each runs the radar, electronic-warfare, CNI and fusion software on modules cooled by the PAO loop; sensor fusion merges every sensor's tracks into one picture before the pilot sees it.`,
    }, mesh(merge(g), F.box()));
  }
  {
    // liquid-cooled racks the boxes plug into: two shelves with PAO cold-plate rails, side frames and posts
    const g = [], c = [];
    const sm = (AV.s0 + AV.s1) / 2, L = AV.s1 - AV.s0;
    g.push(box(sm, AV.shelfUp, 0, L, 0.02, 0.72));                                              // upper shelf (radar receiver, ALR-94, CIPs, INS)
    g.push(box(sm, AV.shelfLo, 0, L, 0.02, 0.84));                                              // lower shelf (radar power supply, CNI, VMS)
    for (const side of [1, -1]) {
      g.push(box(sm, uTop + 0.14, side * 0.36, L - 0.04, 0.28, 0.012));                           // side frame
      for (const s of AV.posts) g.push(box(s, (AV.shelfUp + AV.shelfLo) / 2, side * 0.3, 0.03, AV.shelfUp - AV.shelfLo - 0.02, 0.03));   // posts between the shelves
      // cold-plate rails let into the shelves' top faces, under the modules
      for (const dz of [0.06, 0.2]) c.push(FR.cylX(sm, AV.shelfUp - 0.002, side * dz, L, 0.012, 0.012, 6));
      c.push(FR.cylX(sm, AV.shelfLo - 0.002, side * AV.cni.z, L, 0.012, 0.012, 6));
    }
    P('Forward avionics racks', {
      system: 'Avionics', material: 'Single-piece machined aluminium racks with liquid-cooled (PAO) cold-plate rails', mass: 45,
      explode: [1.75, -0.35, 0],
      desc: 'The forward avionics boxes plug into racks between the radar bulkhead and the cockpit; Flight called these single-piece machined racks the programme\'s most exacting machining job. Liquid coolant flows through the rails under each module, and there is room left for a third CIP.',
    }, [mesh(merge(g), F.alu()), mesh(merge(c), F.pao())]);
  }
  P('CNI suite (AN/ASQ-220)', {
    system: 'Avionics', material: 'Integrated comm / nav / identification modules', mass: 70,
    explode: [2.1, -0.75, 0],
    desc: 'TRW\'s integrated communication, navigation and identification suite: radios (HAVE QUICK, SINCGARS, later Link 16 receive), IFF including Mode 5, TACAN and landing aids share common modules instead of a box per radio, and its emissions are tightly controlled for stealth.',
  }, mesh(merge([1, -1].map((side) => box(AV.cni.s, lTop + AV.cni.h / 2, side * AV.cni.z, AV.cni.ls, AV.cni.h, AV.cni.w))), F.boxLight()));
  P('Intra-flight data link', {
    system: 'Avionics', material: 'Low-probability-of-intercept data-link processor', mass: 15,
    explode: [0.6, 0.6, 1.1],
    desc: 'The IFDL processor shares sensor tracks silently between F-22s in a flight using narrow, directional, hard-to-detect transmissions.',
  }, mesh(merge([box(SM(4.9), -0.22, 0.42, 0.4, 0.18, 0.12)]), F.box()));
  P('Inertial navigation & GPS', {
    system: 'Avionics', material: 'Ring-laser-gyro inertial reference with embedded GPS', mass: 18,
    explode: [2.0, 1.75, 0],
    desc: 'Measures the jet\'s attitude, velocity and position, corrected by GPS, for navigation, weapons and the flight controls.',
  }, mesh(box(AV.ins.s, uTop + AV.ins.h / 2, 0, AV.ins.ls, AV.ins.h, AV.ins.w), F.box()));
  P('AN/ALR-94 receiver processors', {
    system: 'Sensors', material: 'Wideband receivers and signal processors', mass: 40, count: 2,
    explode: [1.6, 0.4, 1.0],
    desc: 'Receivers behind the ALR-94\'s distributed antennas measure the frequency, timing and direction of every radar emitter they hear, so the system can identify a threat and fix its position passively (location approximate).',
  }, mesh(merge([1, -1].map((side) => box(AV.alr.s, uTop + AV.alr.h / 2, side * AV.alr.z, AV.alr.ls, AV.alr.h, AV.alr.w))), F.boxLight()));
  P('Vehicle management system computers', {
    system: 'Flight controls', material: 'Redundant flight-control processors', mass: 25, count: 3,
    explode: [2.2, 1.95, 0.6],
    desc: 'Fly-by-wire computers turn stick and throttle inputs into surface and nozzle commands many times a second; the airframe is unstable in pitch for agility, so they never stop correcting. The VMS (Lear Astronics) combines flight and propulsion control, and the F-22 was the first fighter with triplex digital flight-control computers and no electrical or mechanical back-up mode (Flight International, 1997; box positions approximate).',
  }, mesh(merge(AV.vms.at.map(([s, side]) => box(s, lTop + AV.vms.h / 2, side * AV.vms.z, AV.vms.ls, AV.vms.h, AV.vms.w))), F.boxLight()));

  // ================================================================== AN/APG-77 radar
  {
    // the fixed array leans back 20°: its top edge sits aft of its bottom edge and its face looks
    // forward and up, so it never squares up to a radar ahead (Wikipedia: "tilted back for stealth")
    const tilt = 20 * FR.DEG;
    const at = (s0) => X(s0);
    const face = new THREE.CircleGeometry(1, 48).scale(0.45, 0.31, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(at(SM(2.35)), -0.03, 0);
    const back = new THREE.CylinderGeometry(1, 1, 0.06, 48).rotateX(Math.PI / 2).scale(0.45, 0.31, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(at(SM(2.385)), -0.03, 0);
    // tile rows: thin strips that read as the subarrays of transmit/receive modules
    const rows = [];
    for (let k = -6; k <= 6; k++) {
      const yy = k * 0.05;
      const half = 0.45 * Math.sqrt(Math.max(0, 1 - (yy / 0.31) ** 2));
      if (half < 0.05) continue;
      rows.push(new THREE.BoxGeometry(0.004, 0.006, half * 2).translate(0, yy, 0));
    }
    const grid = merge(rows).rotateZ(tilt).translate(at(SM(2.345)), -0.03, 0);
    P('AN/APG-77 AESA array', {
      system: 'Sensors', material: 'Gallium-arsenide transmit/receive modules on a cooled backplane', mass: 220,
      explode: [2.5, 0.35, 0], callout: true, anchor: [X(SM(2.4)), 0.2, 0.1],
      desc: 'About 1,956 thumb-sized transmit/receive modules (the most cited figure; sources range ~1,900–2,000) steer the beam electronically in microseconds with no moving antenna. The fixed array is tilted back, face looking slightly up, so it never squares up to another radar.',
    }, [mesh(face, F.array()), mesh(back, F.alu()), mesh(grid, F.tile(), { cast: false })]);
    // mount: ring frame behind the array, struts back to the radar bulkhead (s 2.55)
    const m = [];
    const ringC = V(at(SM(2.42)), -0.03, 0);
    m.push(new THREE.TorusGeometry(1, 0.03, 6, 48).scale(0.4, 0.27, 1).rotateY(Math.PI / 2).rotateZ(tilt).translate(ringC.x, ringC.y, ringC.z));
    for (const [yy, zz] of [[0.2, 0.25], [0.2, -0.25], [-0.22, 0.25], [-0.22, -0.25]]) {
      // a point on the tilted ring plane at local (yy, zz) → its station, then a strut aft to the bulkhead
      const lx = -yy * Math.sin(tilt), ly = yy * Math.cos(tilt);
      const p = [FR.SN - (ringC.x + lx), ringC.y + ly, zz];
      m.push(FR.pipe([p, [SM(2.53), p[1], zz]], 0.025, 6, 2));
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
    }, mesh(merge([box(AV.rex.s, uTop + AV.rex.up[1] / 2, 0, AV.rex.ls, AV.rex.up[1], AV.rex.up[2]), box(AV.rex.s, lTop + AV.rex.lo[1] / 2, 0, AV.rex.ls, AV.rex.lo[1], AV.rex.lo[2])]), F.boxLight()));
  }

  // ================================================================== distributed sensors
  {
    const g = [];
    const patch = (p, n, w, h) => g.push(patchGeo(p, n, w, h));
    for (const side of [1, -1]) {
      // the four leading-edge apertures ride on the leading-edge flap: each sits on the flap's nose with a lead back
      // to the hinge line (over the flap drive's torque tube), where it meets the wing run's stub (wiring.js) through a flexible loop, so it droops with the
      // flap; they are a separate part parented to the flap's hinge group
      const lef = anim.lef.find((e) => e.side === side), le = [];
      for (const eta of [0.2, 0.45, 0.72, 0.92]) {             // (between the flap drive's rotary actuators)
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        const pt = V(sec.le[0] - 0.02 * sec.chord, sec.le[1] + naca00(0.02, sec.t) * sec.chord + 0.004, side * z);
        le.push(patchGeo(pt, V(0.2, 1, 0), 0.04, 0.07));      // (small, so it follows the swept nose's curvature)
        const xs = (f) => FR.SN - (sec.le[0] - f * sec.chord);
        le.push(FR.pipe([[xs(0.074), sec.le[1] + 0.022, side * z], [xs(0.06), sec.le[1] + 0.022, side * z], [xs(0.045), sec.le[1] + 0.012, side * z], [xs(0.025), pt.y - 0.03, side * z], [FR.SN - pt.x, pt.y - 0.006, side * z]], 0.006, 5, 10));
      }
      P(`AN/ALR-94 leading-edge apertures (${side > 0 ? 'right' : 'left'})`, {
        system: 'Sensors', material: 'Conformal broadband antennas on the leading-edge flap', mass: 3, count: 4,
        explode: [0.6, 0.35, 2.9 * side],
        desc: 'Four of the ALR-94\'s receive antennas sit in the nose of each leading-edge flap and droop with it; each one\'s lead crosses the flap\'s hinge line through a flexible loop to the wiring along the front spar (positions illustrative).',
      }, mesh(merge(le), F.composite()), lef.h.pivot.children[0]);
      for (const eta of [0.35, 0.8]) {
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        patch(V(sec.le[0] - 0.7 * sec.chord, sec.le[1] + naca00(0.7, sec.t) * sec.chord + 0.004, side * z), V(0, 1, 0), 0.08, 0.14);   // on the fixed wing, ahead of the flaperon / aileron
      }
      for (const s of [SM(1.8), SM(2.3), SM(4.0)]) { const z = FR.aW(s) - 0.07; patch(V(X(s), FR.upperA(s, z) + 0.003, side * z), topNormal(s, side * z), 0.12, 0.04); }
      for (const s of [SM(16.2), SM(17.0)]) patch(V(X(s), FR.topAt(s, 1.4) + 0.004, side * 1.4), V(0, 1, side * 0.3), 0.12, 0.05);
      patch(V(X(SM(17.2)), -FR.bD(SM(17.2)) - 0.004, side * 1.3), V(0, -1, 0), 0.12, 0.05);
    }
    P('AN/ALR-94 EW apertures', {
      system: 'Sensors', material: 'Conformal broadband antennas', mass: 27, count: 16,
      explode: [0, 0.3, 0],
      desc: 'The real ALR-94 blends more than 30 antennas into the wings and fuselage for all-round radar-warning coverage and threat location, often cueing the APG-77; 24 representative apertures are modelled (these 16 on the fixed structure, eight more in the leading-edge flaps), at illustrative positions.',
    }, mesh(merge(g), F.composite()));
  }
  {
    const g = [];
    // flush windows: a 6 mm disc laid on the skin's tangent plane (true normal along and across the jet), 2 mm proud
    const eye = (p, n) => {
      const nn = n.clone().normalize();
      const geo = new THREE.CylinderGeometry(0.055, 0.058, 0.006, 18);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), nn));
      geo.translate(p.x + nn.x * -0.001, p.y + nn.y * -0.001, p.z + nn.z * -0.001);
      g.push(geo);
    };
    for (const side of [1, -1]) {
      { const s = SM(3.2), z = side * 0.45; eye(V(X(s), FR.topAt(s, 0.45), z), topNormal(s, z)); }
      { const s = SM(3.4), z = side * 0.35; eye(V(X(s), FR.bottomAt(s, z), z), botNormal(s, z)); }
      { const s = SM(16.8), y = -FR.bD(s) * 0.6; eye(V(X(s), y, side * FR.wallZ(s, y)), wallNormal(s, y, side)); }
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
      for (const [s, dy] of [[SM(2.05), -0.05], [FR.M(2.55) + 0.12, 0.0]]) {              // (the aft pair on the chine, just behind the radome joint)
        const y = FR.aYC(s) + dy;
        const z = Math.abs(FR.inBody([s, y, FR.aW(s)], 0.012)[2]);            // stalk root 1.2 cm inside the skin at that height
        // a stubby blade stalk and a short probe tube, painted grey like the skin
        g.push(FR.pipe([[s, y, side * z], [s - 0.02, y, side * (z + 0.07)]], 0.013, 8, 2));
        g.push(FR.cylX(s - 0.075, y, side * (z + 0.07), 0.15, 0.009, 0.013, 10));
      }
    }
    P('Air-data probes', {
      system: 'Sensors', material: 'Heated multi-function pitot-static probes', mass: 6, count: 4,
      explode: [1.6, 0, 0.45],
      desc: 'Small L-shaped probes on the sides of the nose measure total and static pressure and flow angle for the flight controls and air-data computers; they are electrically heated against ice (count approximate).',
    }, mesh(merge(g), F.adProbe()));
  }

  // ================================================================== CNI apertures (communications)
  {
    const top = (s, z) => V(X(s), FR.topAt(s, Math.abs(z)) + 0.003, z);
    const bot = (s, z) => V(X(s), FR.bottomAt(s, z) - 0.003, z);
    // side photographs of the spine and of the belly under the nose show no blade antennas, so the UHF/VHF
    // apertures are drawn as flush conformal panels (positions and sizes approximate)
    P('UHF/VHF antennas', {
      system: 'Communications', material: 'Flush conformal antenna panels', mass: 4, count: 2,
      explode: [0, 0.85, 0],
      desc: 'Two flush apertures, one on the spine and one on the belly ahead of the main bay, for the voice and data radios (HAVE QUICK, SINCGARS). Photographs show no blade antennas on the spine or belly: like the rest of the CNI suite these sit flush with the skin (positions approximate).',
    }, mesh(merge([patchGeo(top(SM(9.9), 0), V((FR.topAt(SM(9.9) + 0.1, 0) - FR.topAt(SM(9.9) - 0.1, 0)) / 0.2, 1, 0), 0.3, 0.1), patchGeo(bot(6.6, 0), V(-(FR.bottomAt(6.7, 0) - FR.bottomAt(6.5, 0)) / 0.2, -1, 0), 0.26, 0.1)]), F.composite()));   // (each laid along the skin's slope)
    P('GPS antenna', {
      system: 'Communications', material: 'Flush patch antenna', mass: 1,
      explode: [0, 1.1, 0],
      desc: 'A flush patch on the spine looking up at the GPS satellites, feeding the embedded GPS in the inertial navigation system.',
    }, mesh(patchGeo(top(SM(10.8), 0), V(0, 1, 0), 0.14, 0.14), F.composite()));
    P('IFF antennas', {
      system: 'Communications', material: 'Flush conformal arrays, upper and lower', mass: 3, count: 2,
      explode: [0, 1.25, -0.4],
      desc: 'Flush arrays above and below the fuselage answer and send identification-friend-or-foe interrogations (including Mode 5); the interrogator can steer its beam so it questions only the target it means to (positions approximate).',
    }, mesh(merge([patchGeo(top(7.5, 0.42), topNormal(7.5, 0.42), 0.22, 0.06), patchGeo(bot(6.3, 0.2), botNormal(6.3, 0.2), 0.22, 0.06)]), F.composite()));
    P('TACAN & landing-aid antennas', {
      system: 'Communications', material: 'Flush annular-slot and patch antennas', mass: 3, count: 3,
      explode: [0, -1.0, 0.4],
      desc: 'Flush antennas for TACAN (range and bearing to a beacon or tanker) and the instrument landing aids, upper and lower so one is always in view (positions approximate).',
    }, mesh(merge([patchGeo(top(SM(12.1), 0), V(0, 1, 0), 0.16, 0.16), patchGeo(bot(SM(5.2), 0.3), botNormal(SM(5.2), 0.3), 0.16, 0.1), patchGeo(bot(SM(5.2), -0.3), botNormal(SM(5.2), -0.3), 0.16, 0.1)]), F.composite()));
    const ifdl = [];
    for (const side of [1, -1]) ifdl.push(patchGeo(top(SM(11.0), side * 1.25), V(0, 1, side * 0.55), 0.2, 0.08), patchGeo(top(SM(15.6), side * 1.15), V(0, 1, side * 0.4), 0.16, 0.06));
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
    // on the forebody sides above the chine: flat electroluminescent strips laid on the skin (4 mm proud), not tubes
    for (const side of [1, -1]) {
      // (4 cm wide measured on the skin, which falls steeply here, so the edges are found along the section)
      const edge = (s, k) => { const z0 = FR.aW(s) - 0.07, y0 = FR.upperA(s, z0); let dz = 0; while (Math.hypot(dz, FR.upperA(s, z0 + k * dz) - y0) < 0.02 && dz < 0.02) dz += 0.0005; return z0 + k * dz; };
      const row = (k) => { const r = []; for (let i = 0; i <= 6; i++) { const s = lerp(SM(4.3), SM(4.91), i / 6), z = edge(s, k); r.push([X(s), FR.upperA(s, z) + 0.004, side * z]); } return r; };
      form.push(slab([row(-1), row(1)], () => [0, -0.003, 0], V(0, 1, 0)));
    }
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
    { const sT = FR.BOOM.sEnd0 + (1.52 - FR.BOOM.zIn) / ((FR.BOOM.zEnd - FR.BOOM.zIn) / (FR.BOOM.sEnd1 - FR.BOOM.sEnd0)) - 0.03; white.push(new THREE.SphereGeometry(0.035, 10, 8).translate(X(sT), (FR.upperB(sT, 1.52) - FR.bD(sT)) / 2, -1.52)); }
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
      desc: 'Red (left) and green (right) lights at the wing tips and a white tail light on the end of the left tail boom.',
    }, [navG, navR, navW]);
    P('Formation light strips', {
      system: 'Electrical', material: 'Low-intensity electroluminescent strips', mass: 3, count: 6,
      explode: [0, 0.75, 0],
      desc: 'Dim green strips on the nose chines, the wing tips and the outer faces of both fins let a wingman hold position at night without the jet showing from far away.',
    }, strips);
    const stMat = M.strobe().clone();
    const s1 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(14.6), FR.topAt(14.6, 0) + 0.02, 0);
    const s2 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(SM(12.8)), -FR.bD(SM(12.8)) - 0.02, 0);
    P('Anti-collision strobes', {
      system: 'Electrical', material: 'White LED strobes', mass: 2, count: 2,
      explode: [-0.4, 0.9, 0],
      desc: 'White anti-collision strobes on the spine and belly (positions approximate). In flight they give one short flash a second; on the ground and in the hangar they stay off.',
    }, mesh(merge([s1, s2]), stMat, { cast: false }));
    anim.strobe = stMat;
  }
}
