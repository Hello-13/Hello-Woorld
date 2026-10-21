// GPS III (Lockheed Martin, A2100M bus): the newest operational generation of the NAVSTAR Global
// Positioning System satellites, modelled from public sources at real scale.
//
// Axes (metres): built in the GPS spacecraft body frame. +Z points at the Earth (the L-band
// antenna face), +Y along the solar-array axis, +X toward the Sun's hemisphere under yaw steering;
// origin at the centre of the bus box. `body` holds everything; the orbit view clones it and aims
// its +Z at the Earth. For display, `body` is turned so +Z (nadir) points up in the hangar and
// showroom (as the satellite stands on its launch adapter), and in the 'orbit' look down toward the
// Earth backdrop, pitched 45° toward the viewer so the antenna face can be seen. Subsystems are
// built in ./gps3/ (layout.js holds where the deck and panel units sit). Lockheed Martin's own axes
// are turned 180° about Z from the IGS axes used here, so its "−Y" NPE panel is +Y here.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { buildStructure } from './gps3/structure.js';
import { buildAntennas } from './gps3/antennas.js';
import { buildPayload } from './gps3/payload.js';
import { buildPropulsion } from './gps3/propulsion.js';
import { buildADCS } from './gps3/adcs.js';
import { buildPower } from './gps3/power.js';
import { ARRAY_SPAN, ARRAY_AREA } from './gps3/dims.js';
import { buildHarness } from './gps3/harness.js';
import { NET } from './gps3/kit.js';
import { GPS3 } from './gps3/data.js';
import { DISPLAY, displayDir } from './gps3/display.js';
import { clockRelativity, period, RE } from '../physics/orbital.js';
import { fmt } from '../ui/dom.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the two display poses (gps3/display.js holds the same turns as plain vector maps, for the tour):
// nadir (+Z) up, array axis (+Y) along world X, Sun side (+X) toward world +Z
const Q_SHOW = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
// nadir down toward the Earth backdrop (turned 180° about world Z), then pitched 45° about the
// array axis so nadir also leans toward the default camera and the antenna face shows
const Q_ORBIT = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 4)
  .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI)).multiply(Q_SHOW);
// default camera directions, written in the body frame (x Sun side, y array axis, z nadir)
const VIEW_SHOW = [1.0, 0.42, 0.5];
const VIEW_ORBIT = [0.8, -0.35, 0.55];

// the current display orientation and body-frame camera directions, shared with the guided tour
export { DISPLAY, displayDir };

export function buildSatellite({ compact = false } = {}) {
  const A = new Assembly();
  const body = new THREE.Group();
  body.quaternion.copy(Q_SHOW);
  A.root.add(body);
  const P = (name, info, objs, parent = body) => A.part(name, info, objs, parent);

  NET.nodes.length = 0;                  // harness landing points, collected afresh for every build
  buildStructure(P);
  const antennas = buildAntennas(P);
  buildPayload(P);
  buildPropulsion(P);
  const { rotors } = buildADCS(P);
  const power = buildPower(P, body);
  buildHarness(P);
  A.finalize();

  const state = { deploy: compact ? 0 : 1, deployTarget: compact ? 0 : 1, sunAngle: 0, burn: 0, orbitLook: false };
  const applyDeploy = (d) => { power.setDeploy(d); antennas.setJIB(d); };
  applyDeploy(state.deploy);
  const wobble = new THREE.Quaternion();
  const up = V(0, 1, 0);
  const rel = clockRelativity(GPS3.altitude);
  const T = period(RE + GPS3.altitude);
  const listed = A.parts.reduce((a, p) => a + (p.userData.part.mass || 0) * 1, 0);
  const view = { dir: displayDir(VIEW_SHOW), fill: 0.95 };
  const [W, D, H] = GPS3.size;

  return {
    id: 'satellite',
    designation: 'GPS III',
    name: 'NAVSTAR',
    role: 'Navigation satellite · MEO',
    tagline: '20,180 km MEO · six 55° planes · three rubidium clocks · 15-year design life',
    summary: 'GPS III is Lockheed Martin\'s newest generation of the U.S. Space Force\'s Global Positioning System. Every GPS satellite is also a NAVSTAR, the system\'s original name, and carries a NAVSTAR number (SV01, launched on 23 December 2018, is NAVSTAR 77 / USA-289). Built on the A2100M bus, each satellite broadcasts the time of its atomic clocks and its own orbit on L1, L2 and L5, including the civil L1C signal, designed to be interoperable with Galileo\'s E1, and the jam-resistant military M-code. A receiver that hears four satellites solves for its position and its own clock error. The launcher leaves it in a transfer orbit; its own apogee engine finishes the climb to a circular orbit 20,180 km up, and only then do its solar arrays and antennas deploy.',
    specs: [
      ['Launch mass', `${fmt.n(GPS3.launchMass)} kg (8,115 lb, Space Force fact sheet); Lockheed's 2014 sheet gave 3,880 kg, and up to ≈ 4,400 kg is reported for individual launches`],
      ['On-orbit mass', `${fmt.n(GPS3.dryMass)} kg (4,764 lb, fact sheet), used here as the dry mass; listed parts sum to ≈ ${fmt.n(Math.round(listed / 10) * 10)} kg (brackets, fasteners and small items are not listed)`],
      ['Size', `Bus ${W} × ${D} × ${H} m (97 × 70 × 134 in, fact sheet): 2.46 m along the Sun axis, 1.78 m along the array axis, as in the IGS box-wing model. Stowed, as modelled: ≈ 3.9 m from the separation plane to the Earth deck, ≈ 4.5 m to the tops of the antenna elements and ≈ 5.0 m to the forward TT&C mast, with the apogee-engine nozzle reaching ≈ 0.24 m below the separation plane (the IGS box-wing ±X face, 7.5 m², corresponds to about 4.2 m)`],
      ['Bus', 'Lockheed Martin A2100M'],
      ['Power', `${fmt.n(GPS3.powerEOL)} W at end of life`],
      ['Orbit', `${fmt.n(GPS3.altitude)} km circular, ${GPS3.inclination}° inclination`],
      ['Period', `≈ 11 h 58 min (half a sidereal day; two-body ${fmt.hms(T)})`],
      ['Signals', 'L1 C/A, L1C, L1/L2 P(Y), L2C, L5, M-code; L3 for detection-system data'],
      ['Clocks', '3 rubidium atomic frequency standards, plus a slot for a fourth'],
      ['Relativity', `+${rel.netUs.toFixed(1)} µs/day, clocks pre-set to 10.22999999543 MHz`],
      ['Propulsion', `100-lbf apogee engine, LEROS-1c class (${GPS3.laeThrust} N, Isp ${GPS3.laeIsp} s; identity unconfirmed); ${GPS3.thrusterLarge} N and ${GPS3.thrusterSmall} N hydrazine thrusters; one hydrazine and two NTO tanks (A2100 dual mode)`],
      ['Array', `2 wings × 2 panels, ${ARRAY_AREA.toFixed(1)} m² (IGS box-wing model; ≈ 28.5 m² / 307 ft² reported); ${GPS3.arraySpan} m span published, ≈ ${ARRAY_SPAN.toFixed(1)} m modelled`],
      ['Design life', `${GPS3.designLife} years`],
      ['Satellites', 'SV01–SV10; SV01 launched 23 Dec 2018, SV10 21 Apr 2026'],
      ['Configuration shown', 'A composite of the series: Global Burst Detector (SV01–SV08), laser retroreflector (SV09, SV10), optical communications terminal and Digital RAFS demonstration (SV10)'],
    ],
    heroStats: [['20,180', 'km', 'Orbit altitude'], [`+${rel.netUs.toFixed(1)}`, 'µs/day', 'Clock relativity'], ['15', 'yr', 'Design life']],
    sources: 'U.S. Space Force GPS III fact sheet (Space Systems Command, Los Angeles: weights, size, design life); W. Marquis & M. Shaw, "GPS III: Bringing New Capabilities to the Global Community", InsideGNSS, Sep/Oct 2011 (subsystems and units; Fig. 3 block diagram; Fig. 4 expanded view: unit placement on the NPE and Bus/NCE/HPE panels, core structure, tanks, sunshade, masts, access panels); P. Steigenberger, S. Thoelert & O. Montenbruck, "GPS III Vespucci: Results of half a year in orbit", Advances in Space Research, 2020 (manufacturer scale model in IGS axes, box-wing areas, MLI colours, 15 m span, phase-centre offsets); Wikipedia "Lockheed Martin A2100" (tank sizes and maxima) and "LEROS" (apogee engine); airforce-technology.com GPS III project page (four UTJ panels, 100-lb apogee engine, Honeywell and ATK contracts); Sandia National Laboratories news release on the Global Burst Detector (2025); Lockheed Martin SV10 launch release (21 Apr 2026: optical crosslink demonstration, Digital RAFS) and Tesat SCOT80 terminal coverage; Lockheed Martin patent US 10,749,252 (2020), Fig. 1 GPS III nadir antenna deck (EC, MEC and UHF crosslink element layout); Lockheed Martin GPS III releases, including the SV01 antenna-assembly delivery (2013); Honeywell GPS III OBC / RWA / IMU critical-design-review release (2010); Northrop Grumman Astro Aerospace JIB antenna releases (2011, 2014); Wikipedia "GPS Block III" (A2100M bus, Orbital ATK composite tanks); IS-GPS-200, IS-GPS-705 and IS-GPS-800 signal specifications; ILRS GPS III mission page and NASA (laser retroreflector arrays on SV09 and SV10); IGS/ESA GPS III radiation-force modelling (Dilssner et al., 2022: box face areas, 2,161 kg); L3Harris navigation-payload releases; Excelitas rubidium clock releases; EaglePicher battery heritage; Spaceflight Now (SV01 launch profile); N. Ashby, "Relativity in the Global Positioning System" (Living Reviews in Relativity, 2003).',
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
    /** 'orbit' look: nadir toward the Earth backdrop; otherwise nadir up, as on the launch adapter. */
    setLook(k) {
      state.orbitLook = k === 'orbit';
      DISPLAY.orbit = state.orbitLook;
      body.quaternion.copy(state.orbitLook ? Q_ORBIT : Q_SHOW);
      const d = displayDir(state.orbitLook ? VIEW_ORBIT : VIEW_SHOW);
      view.dir = d;
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
        applyDeploy(state.deploy);
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
