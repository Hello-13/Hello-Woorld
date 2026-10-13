// GPS III (Lockheed Martin, A2100M bus) — the newest operational generation of the NAVSTAR Global
// Positioning System satellites, modelled from public sources at real scale.
//
// Axes (metres): built in the GPS spacecraft body frame — +Z points at the Earth (the L-band
// antenna face), +Y along the solar-array axis, +X toward the Sun's hemisphere under yaw steering;
// origin at the centre of the bus box. `body` holds everything; the orbit view clones it and aims
// its +Z at the Earth. For display, `body` is turned so +Z (nadir) points up in the hangar and
// showroom (as the satellite stands on its launch adapter) and down toward the Earth in the
// 'orbit' look. Subsystems are built in ./gps3/.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { buildStructure } from './gps3/structure.js';
import { buildPayload } from './gps3/payload.js';
import { buildPropulsion } from './gps3/propulsion.js';
import { buildADCS } from './gps3/adcs.js';
import { buildPower, ARRAY_SPAN } from './gps3/power.js';
import { GPS3 } from './gps3/data.js';
import { clockRelativity, period, RE } from '../physics/orbital.js';
import { fmt } from '../ui/dom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// nadir (+Z) up, array axis (+Y) along world X, Sun side (+X) toward world +Z
const Q_SHOW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
// nadir down toward the Earth backdrop: the same, turned 180° about world Z
const Q_ORBIT = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI).multiply(Q_SHOW);
const VIEW_SHOW = [0.42, 0.5, 1.0];
const VIEW_ORBIT = [0.55, 0.17, 1.0];

/** Current display orientation, read by the guided tour to aim its camera at the same side. */
export const DISPLAY = { orbit: false };
/** A camera direction written for the hangar orientation, mapped to the current one (the 'orbit'
 *  look turns the body 180° about world Z; the camera keeps its elevation above the horizon). */
export const viewDir = (d) => (DISPLAY.orbit ? [-d[0], d[1], d[2]] : d.slice());

export function buildSatellite({ compact = false } = {}) {
  const A = new Assembly();
  const body = new THREE.Group();
  body.quaternion.copy(Q_SHOW);
  A.root.add(body);
  const P = (name, info, objs, parent = body) => A.part(name, info, objs, parent);

  buildStructure(P);
  buildPayload(P);
  buildPropulsion(P);
  const { rotors } = buildADCS(P);
  const power = buildPower(P, body);
  A.finalize();

  const state = { deploy: compact ? 0 : 1, deployTarget: compact ? 0 : 1, sunAngle: 0, burn: 0, orbitLook: false };
  power.setDeploy(state.deploy);
  const wobble = new THREE.Quaternion();
  const up = V(0, 1, 0);
  const rel = clockRelativity(GPS3.altitude);
  const T = period(RE + GPS3.altitude);
  const view = { dir: VIEW_SHOW.slice(), fill: 0.95 };

  return {
    id: 'satellite',
    designation: 'GPS III',
    name: 'NAVSTAR',
    role: 'Navigation satellite · MEO',
    tagline: '20,180 km MEO · six 55° planes · three rubidium clocks · 15-year design life',
    summary: 'GPS III is Lockheed Martin\'s newest generation of the U.S. Space Force\'s Global Positioning System. Every GPS satellite is also a NAVSTAR — the system\'s original name — and carries a NAVSTAR number (SV01, launched on 23 December 2018, is NAVSTAR 77 / USA-289). Built on the A2100M bus, each satellite broadcasts the time of its atomic clocks and its own orbit on L1, L2 and L5, including the civil L1C signal shared with Galileo and the jam-resistant military M-code. A receiver that hears four satellites solves for its position and its own clock error. The launcher leaves it in a transfer orbit; its own apogee engine finishes the climb to a circular orbit 20,180 km up.',
    specs: [
      ['Launch mass', `${fmt.n(GPS3.launchMass)} kg (3,680–4,400 kg reported per launch)`],
      ['Dry mass', `${fmt.n(GPS3.dryMass)} kg (brackets, fasteners and secondary structure not listed as parts)`],
      ['Bus', 'Lockheed Martin A2100M'],
      ['Power', `${fmt.n(GPS3.powerEOL)} W at end of life`],
      ['Orbit', `${fmt.n(GPS3.altitude)} km circular, ${GPS3.inclination}° inclination`],
      ['Period', `≈ 11 h 58 min (half a sidereal day; two-body ${fmt.hms(T)})`],
      ['Signals', 'L1 C/A, L1C, L1/L2 P(Y), L2C, L5, M-code'],
      ['Clocks', '3 rubidium atomic frequency standards'],
      ['Relativity', `+${rel.netUs.toFixed(1)} µs/day, clocks pre-set to 10.22999999543 MHz`],
      ['Array span', `≈ ${ARRAY_SPAN.toFixed(1)} m deployed (estimate)`],
      ['Design life', `${GPS3.designLife} years`],
      ['Satellites', 'SV01–SV10; SV01 launched 23 Dec 2018'],
    ],
    heroStats: [['20,180', 'km', 'Orbit altitude'], [`+${rel.netUs.toFixed(1)}`, 'µs/day', 'Clock relativity'], ['15', 'yr', 'Design life']],
    sources: 'Lockheed Martin GPS III product releases; U.S. Space Force and GPS.gov space-segment pages; IS-GPS-200, IS-GPS-705 and IS-GPS-800 signal specifications; Marquis & Reigh, "The GPS Block IIR and IIR-M broadcast L-band antenna panel" (NAVIGATION, 2015); L3Harris GPS III navigation-payload releases; Lockheed Martin GPS III SV01 antenna-assembly release (2013); InsideGNSS, "GPS III" spacecraft overview; Excelitas rubidium clock releases; NASA Space Geodesy Project and ILRS (SV09 laser retroreflector array); Spaceflight Now (SV01 launch profile); N. Ashby, "Relativity in the Global Positioning System" (Living Reviews in Relativity, 2003); Wikipedia "GPS Block III".',
    fleetTag: 'Δv lab',
    root: A.root,
    body,
    parts: A.parts,
    view,
    displaySize: 10.5,
    hover: 2.6,
    thermalRange: [150, 420],
    state,
    setDeploy(d) { state.deployTarget = d; },
    /** 'orbit' look: nadir down toward the Earth backdrop; otherwise nadir up, as on the launch adapter. */
    setLook(k) {
      state.orbitLook = k === 'orbit';
      DISPLAY.orbit = state.orbitLook;
      view.dir = (state.orbitLook ? VIEW_ORBIT : VIEW_SHOW).slice();
      body.quaternion.copy(state.orbitLook ? Q_ORBIT : Q_SHOW);
    },
    temperatureOf(info) {
      switch (info.thermalRole) {
        case 'sunlit': return 395;
        case 'shadow': return 170;
        case 'array': return 330;
        case 'radiator': return 285;
        case 'earth': return 250;
        case 'aft': return 225;
        case 'engine': return 270 + state.burn * 1150;
        case 'thruster': return 270;
        default: return info.temp;
      }
    },
    update(dt, time) {
      if (Math.abs(state.deploy - state.deployTarget) > 1e-3) {
        state.deploy += Math.sign(state.deployTarget - state.deploy) * Math.min(Math.abs(state.deployTarget - state.deploy), dt * 0.6);
        power.setDeploy(state.deploy);
      }
      // the drives follow the Sun; with the wings folded they hold still
      state.sunAngle += dt * 0.1;
      const k = state.deploy * state.deploy * (3 - 2 * state.deploy);
      for (const w of power.wings) w.drive.rotation.y = Math.sin(state.sunAngle) * 0.35 * k * w.s;
      rotors.forEach((r, i) => { r.rotation.y += dt * (4 + i * 0.7); });
      wobble.setFromAxisAngle(up, Math.sin(time * 0.15) * 0.04);
      body.quaternion.multiplyQuaternions(wobble, state.orbitLook ? Q_ORBIT : Q_SHOW);
      body.position.y = Math.sin(time * 0.6) * 0.12;
    },
  };
}
