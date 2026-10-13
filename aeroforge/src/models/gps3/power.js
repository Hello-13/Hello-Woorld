// GPS III electrical power subsystem: solar arrays, batteries and the power regulation unit
// (Marquis & Shaw, InsideGNSS 2011), plus the array drives, frangibolt hold-downs and hinges of the
// mechanical subsystem, the deployment device controller and the wiring harness. Panel count and
// size are estimates consistent with the reported ≈ 28.5 m² (307 ft²) of array.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HX, HY, HZ, IX, IY, IZ, AFT, boxG, cylG, merge, unit, pipeG, connPoint } from './kit.js';
import { HARNESS } from './payload.js';
import { WHEELS } from './adcs.js';
import { CORNERS, CLUSTER } from './propulsion.js';

const SADA_L = 0.10;          // drive stand-off from the radiator face
const YOKE_L = HX;            // yoke length (half the bus width, so the stowed stack sits centred on the face)
const PANEL_L = 1.70;         // panel length along the span
const PANEL_W = 2.70;         // panel width (along the bus Z axis)
const PANEL_T = 0.025;
const GAP = 0.02;             // hinge gap between panels
const FOLD = 0.035;           // stack spacing when stowed
const ARM_Z = 1.15;           // yoke arm and hinge-line positions along Z
const BRACE = (YOKE_L * 0.55 - 0.03) / (YOKE_L - 0.03) * ARM_Z;   // yoke cross-brace half-length (meets the arms)

export const ARRAY_SPAN = 2 * HY + 2 * (SADA_L + YOKE_L + 3 * PANEL_L + 3 * GAP);
export const ARRAY_AREA = 6 * PANEL_L * PANEL_W;

export function buildPower(P, body) {
  const wings = [];
  for (const s of [1, -1]) {
    const tag = s > 0 ? '+Y' : '−Y';
    const mount = new THREE.Group();
    mount.position.set(0, s * HY, 0);
    if (s < 0) mount.rotation.x = Math.PI;      // mirror by rotation: cells keep facing +X
    body.add(mount);

    // drive: housing, flange and output shaft
    const sada = merge([
      cylG([0, 0.006, 0], 0.16, 0.012, 'y', 32), cylG([0, 0.055, 0], 0.11, 0.09, 'y', 32),
      cylG([0, 0.095, 0], 0.06, 0.02, 'y', 20),
    ]);
    P(`Solar array drive (${tag})`, {
      system: 'Power', material: 'Stepper motor, slip rings, bearings', mass: 19, temp: 290, explode: [0, 1.9, 0],
      desc: 'Turns its wing once per orbit, about 0.5° a minute, so the cells keep facing the Sun while the body stays pointed at the Earth. Slip rings carry the array\'s current across the rotating joint.',
      // no callout: on screen the drive sits on the array axis level with the labelled inboard panel, and
      // the panel's label (drawn to the right of its dot) ran into the drive's dot in the Showroom and tour framings
    }, [mesh(sada, G.gunmetal())], mount);

    // frangibolt hold-downs on the radiator face
    const hrm = [];
    for (const x of [-0.55, 0.55]) for (const z of [-1.2, 1.2]) {
      hrm.push(cylG([x, 0.035, z], 0.03, 0.07, 'y', 14), cylG([x, 0.078, z], 0.018, 0.016, 'y', 10), boxG([x, 0.004, z], [0.1, 0.008, 0.1]));
    }
    P(`Frangibolt hold-downs (${tag})`, {
      system: 'Power', material: 'Titanium cups, shape-memory-alloy Frangibolt actuators', mass: 4, count: 4, temp: 285, explode: [0, 1.75, 0],
      desc: 'Bolts through the folded panel stack clamp the wing to the radiator for launch and through the apogee burns; they release only once the satellite is on station. To release, a heater warms a shape-memory-alloy sleeve around each notched bolt; the sleeve stretches and snaps the bolt, with no explosive shock. The design papers list frangibolts for every deployable (count and positions estimated).',
    }, mesh(merge(hrm), G.satinTi()), mount);

    const drive = new THREE.Group();
    drive.position.y = SADA_L;
    mount.add(drive);
    const yokePivot = new THREE.Group();
    drive.add(yokePivot);
    const yoke = merge([
      cylG([0, 0.02, 0], 0.05, 0.04, 'y', 16),
      pipeG([[0, 0.03, 0], [0, YOKE_L, ARM_Z]], 0.022, 10), pipeG([[0, 0.03, 0], [0, YOKE_L, -ARM_Z]], 0.022, 10),
      pipeG([[0, YOKE_L * 0.55, BRACE], [0, YOKE_L * 0.55, -BRACE]], 0.014, 8),
      boxG([0, YOKE_L, ARM_Z], [0.05, 0.05, 0.08]), boxG([0, YOKE_L, -ARM_Z], [0.05, 0.05, 0.08]),
    ]);
    P(`Array yoke (${tag})`, {
      system: 'Power', material: 'Carbon-fibre tubes, titanium hinge fittings', mass: 9, temp: 300, explode: [0, 2.0, 0],
      desc: 'Holds the first panel clear of the bus so the wing\'s shadow and the radiator\'s view to space don\'t interfere. It folds flat against the radiator for launch (length estimated so the stowed stack sits centred on the face).',
    }, mesh(yoke, G.cfrp(2)), yokePivot);

    const hinge = (name, parent, desc, zs = [-ARM_Z, ARM_Z], y = 0, pulleys = true) => {
      const g = [];
      for (const z of zs) g.push(boxG([0, y, z], [0.04, 0.05, 0.1]), cylG([0, y, z], 0.014, 0.12, 'z', 10));
      if (pulleys) g.push(cylG([0, y, ARM_Z + 0.09], 0.035, 0.012, 'z', 18), cylG([0, y, -ARM_Z - 0.09], 0.035, 0.012, 'z', 18));
      return P(name, { system: 'Power', material: 'Titanium spring hinges, cable-loop pulleys, eddy-current damper', mass: 1.6, count: 2, temp: 300, explode: [0, 0.1, 0], desc }, mesh(merge(g), G.satinTi()), parent);
    };
    hinge(`Root hinge (${tag})`, yokePivot, 'Spring hinge where the yoke meets the drive shaft. A damper slows the swing so the whole wing does not slam into its latches as it unfolds (form estimated).', [-0.09, 0.09], 0.04, false);

    const pivots = [];
    let parent = yokePivot, len = YOKE_L;
    const names = ['inboard', 'middle', 'outboard'];
    for (let i = 0; i < 3; i++) {
      const pv = new THREE.Group();
      pv.position.y = len + GAP;
      parent.add(pv);
      const g = new THREE.BoxGeometry(PANEL_T, PANEL_L, PANEL_W).translate(0, PANEL_L / 2, 0);
      const edge = G.aluminium();
      const panel = mesh(g, [G.cells(4.5, 3.8), G.panelBack(), edge, edge, edge, edge]);
      const part = P(`Solar panel ${i + 1} (${tag}, ${names[i]})`, {
        system: 'Power', material: 'Triple-junction GaAs cells on carbon-fibre / aluminium honeycomb', mass: 21, temp: 330, explode: [0, 2.15 + i * 0.18, 0],
        desc: i === 0
          ? `Inboard panel, ${PANEL_L.toFixed(2)} × ${PANEL_W.toFixed(2)} m (size estimated; six give ${ARRAY_AREA.toFixed(1)} m² against the reported 28.5 m²). Ultra-triple-junction cells convert about 28 % of the 1,361 W/m² of sunlight; together the six panels give GPS III its 4,480 W at end of life.`
          : i === 1
            ? 'Middle panel. Radiation in the GPS orbit, inside the outer Van Allen belt, slowly damages the cells, so the array is sized for its fifteenth year, not its first.'
            : 'Outboard panel. Spring hinges and a closed cable loop unfold the three panels together, in seconds, once the frangibolts release.',
        // the wing's one callout, on the −Y inboard panel near its aft edge (local +z is body −Z on this wing):
        // the array spot whose label stays on screen and clear of the deck and engine labels and the page text
        // in the orbit-look and Showroom/Hangar framings
        callout: s < 0 && i === 0, anchor: [0.02, PANEL_L / 2, PANEL_W / 2 - 0.15],
      }, panel, pv);
      part.userData.part.thermalRole = 'array';
      hinge(`Panel hinge ${i + 1} (${tag})`, pv, i === 0
        ? 'Spring hinges between the yoke and the inboard panel. A closed cable loop over pulleys at each hinge line ties the hinges together, so all the panels open at the same rate (form estimated).'
        : `Spring hinges between panels ${i} and ${i + 1}, with the pulleys of the synchronising cable loop at each end (form estimated).`);
      pivots.push(pv);
      parent = pv;
      len = PANEL_L;
    }
    wings.push({ drive, yokePivot, pivots, s });
  }

  /** d = 1 deployed, 0 stowed against the radiator (an accordion fold about the hinge lines). */
  const setDeploy = (d) => {
    const f = 1 - d;
    for (const w of wings) {
      w.yokePivot.rotation.z = (Math.PI / 2) * f;
      w.pivots.forEach((pv, i) => {
        const sgn = i % 2 === 0 ? 1 : -1;
        pv.rotation.z = -sgn * Math.PI * f;
        pv.position.x = sgn * FOLD * f;
      });
    }
  };

  // ------------------------------------------------------------------ batteries, regulation (on the −Y radiator, inner face y = −IY)
  const box = (name, info, c, sz, mat, opts) => { HARNESS.push(connPoint(c, sz, opts.conn, 0.04)); return P(name, info, unit(c, sz, mat, opts)); };
  const battery = (name, x, ex) => {
    const z = 1.0, d = 0.27;
    const y0 = -IY;
    const base = [boxG([x, y0 + 0.006, z], [0.42, 0.012, 0.42]), boxG([x, y0 + d - 0.008, z], [0.4, 0.016, 0.4])];
    const cells = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = x - 0.143 + i * 0.095, cz = z - 0.143 + j * 0.095;
      cells.push(cylG([cx, y0 + 0.012 + 0.12, cz], 0.042, 0.22, 'y', 16));
      cells.push(new THREE.SphereGeometry(0.042, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx, y0 + 0.232, cz));
    }
    HARNESS.push([x, y0 + d + 0.04, z + 0.2]);
    return P(name, {
      system: 'Power', material: 'Pressure-vessel cells in aluminium sleeves', mass: 82, count: 16, temp: 278, explode: ex,
      desc: x > 0
        ? 'One of two batteries. Twice a year, when the Sun lies near the orbit plane, the satellite crosses the Earth\'s shadow on every orbit for up to about 56 minutes, and the batteries run the whole spacecraft. Design-era descriptions give nickel–hydrogen cells (shown); the supplier, EaglePicher, lists lithium-ion heritage on GPS III, so the chemistry flown is not confirmed. Cell count and capacity estimated.'
        : 'The second battery. Cells are kept cool, about 0–10 °C, on the radiator, because battery life falls quickly when they run warm (cell count estimated).',
    }, [mesh(merge(base), G.blackBox()), mesh(merge(cells), G.silverBox())]);
  };
  battery('Battery 1', 0.42, [0.2, -1.2, 0]);
  battery('Battery 2', -0.42, [-0.2, -1.2, 0]);
  box('Power regulation unit', {
    system: 'Power', material: 'Aluminium chassis, shunt regulators and battery charge electronics', mass: 46, temp: 305, explode: [0, -1.2, 0],
    desc: 'Holds the main bus voltage steady: it shunts surplus array current in sunlight, charges the batteries, and switches to battery power at each eclipse entry without a glitch to the clocks or transmitters.',
  }, [0.42, -(IY - 0.11), 0.45], [0.44, 0.22, 0.32], G.alodine(), { mount: '-y', conn: '+z', n: 5, fins: 7 });
  box('Array drive electronics', {
    system: 'Power', material: 'Aluminium chassis', mass: 9, temp: 300, explode: [0, -1.2, 0],
    desc: 'Steps both array drives in time with the orbit and the yaw-steering law, from commands computed by the on-board computer.',
  }, [0.42, -(IY - 0.06), 0.1], [0.3, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+y', n: 3 });
  box('Deployment device controller', {
    system: 'Electrical', material: 'Aluminium chassis', mass: 7, temp: 290, explode: [0, -1.2, 0],
    desc: 'Fires the one-shot devices (the frangibolts, the helium pyro valves and the antenna releases) with redundant arm-and-fire circuits, so nothing can trigger by accident on the ground or during launch.',
  }, [0.42, -(IY - 0.06), -0.18], [0.26, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+y', n: 3 });

  // ground-test and arming connectors on the shadow side, reachable through the fairing access door
  const tb = [boxG([-HX - 0.016, -0.5, -1.12], [0.008, 0.3, 0.16])];
  const plugs = [];
  for (let i = 0; i < 3; i++) { tb.push(cylG([-HX - 0.035, -0.6 + i * 0.1, -1.1], 0.022, 0.03, 'x', 12)); plugs.push(boxG([-HX - 0.06, -0.6 + i * 0.1, -1.16], [0.004, 0.04, 0.09])); }
  P('Test & arming connectors', {
    system: 'Electrical', material: 'Connector bracket, arming plugs with red "remove before flight" tags', mass: 1.2, temp: 270, explode: [-0.6, 0, 0],
    desc: 'Where ground equipment plugs in for testing, and where arming plugs complete the ordnance circuits shortly before launch. Generic stand-in: the GPS III layout of these connectors is not public.',
  }, [mesh(merge(tb), G.blackBox()), mesh(merge(plugs), G.redTag())]);

  // ------------------------------------------------------------------ wiring harness: a ring above the units, drops to every box, trunks to the aft deck
  const ringZ = 1.16, ringR = 0.72, runs = [];
  const ring = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([Math.cos(a) * ringR, Math.sin(a) * ringR, ringZ]); }
  runs.push(pipeG(ring, 0.017, 8));
  for (const p of HARNESS) {
    // down in front of the unit (on the radiators, in front of the deepest box, the batteries), then across to its connector
    const a = Math.atan2(p[1], p[0]), mx = p[0] * 0.9, my = Math.abs(p[1]) > 0.9 ? Math.sign(p[1]) * 0.9 : p[1] * 0.88, top = Math.max(p[2] + 0.02, ringZ - 0.06);
    runs.push(pipeG([[Math.cos(a) * ringR, Math.sin(a) * ringR, ringZ], [mx, my, top], [mx, my, p[2]], p], 0.009, 6));
  }
  for (const s of [1, -1]) runs.push(pipeG([[0.08, s * (IY - 0.04), 0], [0.08, s * (IY - 0.04), ringZ - 0.04], [0.15, s * ringR * 0.97, ringZ]], 0.014, 8));
  const trunks = [[0.8, 0.3], [-0.82, -0.2]];
  for (const [x, y] of trunks) runs.push(pipeG([[x * 0.9, y, ringZ], [x, y, ringZ - 0.05], [x, y, -1.33]], 0.016, 8));
  for (const [wx, wy] of WHEELS) {
    const t = trunks[wx > 0 ? 0 : 1];
    runs.push(pipeG([[t[0], t[1], -1.33], [wx + 0.12 * Math.sign(wx), wy * 0.75, -1.33], [wx, wy, -1.33]], 0.008, 6));
  }
  for (const [sx, sy] of CORNERS) {
    const t = trunks[sx > 0 ? 0 : 1];
    const [cx, cy] = CLUSTER(sx, sy);
    runs.push(pipeG([[t[0], t[1], -1.33], [sx * 0.84, t[1], -1.33], [sx * 0.84, cy, -1.33], [cx, cy, AFT - 0.01]], 0.006, 6));
  }
  P('Wiring harness', {
    system: 'Electrical', material: 'Shielded copper wire bundles, beta-cloth wrap', mass: 110, temp: 293, explode: [0, 0, 0.35],
    desc: 'Thousands of wires tie every unit to the power bus and the data buses: a main ring above the equipment, a drop to each box, trunks down to the wheels and thruster valves, and the array lines from both drives. A harness is typically 4–5 % of a satellite\'s dry mass; only the main bundles are modelled (routing estimated).',
  }, mesh(merge(runs), G.harness()));

  return { setDeploy, wings, HZ, IZ };
}

export { IX };
