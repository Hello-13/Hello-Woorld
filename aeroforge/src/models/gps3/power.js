// GPS III electrical power: two three-panel solar-array wings on single-axis drives, nickel–hydrogen
// batteries, the power regulation unit and the wiring harness. Panel count and size are estimates
// consistent with the reported ≈ 14 m span and ≈ 28 m² array area (307 ft²).

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HY, HZ, IX, IY, IZ, RC, boxG, cylG, merge, unit, pipeG } from './kit.js';

const SADA_L = 0.10;          // drive stand-off from the radiator face
const YOKE_L = 0.90;          // yoke length (equals half the bus width so the stowed stack is centred)
const PANEL_L = 1.70;         // panel length along the span
const PANEL_W = 2.50;         // panel width (along the bus Z axis)
const PANEL_T = 0.025;
const GAP = 0.02;             // hinge gap between panels
const FOLD = 0.035;           // stack spacing when stowed
const BRACE = (YOKE_L * 0.55 - 0.03) / (YOKE_L - 0.03);   // yoke cross-brace half-length (meets the struts)

export const ARRAY_SPAN = 2 * HY + 2 * (SADA_L + YOKE_L + 3 * PANEL_L + 3 * GAP);

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
      system: 'Power', material: 'Stepper motor, slip rings, bearings', mass: 13, temp: 290, explode: [0, 1.9, 0],
      desc: 'Turns its wing once per orbit — about 0.5° a minute — so the cells keep facing the Sun while the body stays pointed at the Earth. Slip rings carry the array\'s current across the rotating joint.',
      callout: s > 0, anchor: [0, 0.12, 0.12],
    }, [mesh(sada, G.gunmetal())], mount);

    // hold-down and release mechanisms on the radiator face
    const hrm = [];
    for (const x of [-0.55, 0.55]) for (const z of [-1.05, 1.05]) {
      hrm.push(cylG([x, 0.035, z], 0.03, 0.07, 'y', 14), cylG([x, 0.078, z], 0.018, 0.016, 'y', 10), boxG([x, 0.004, z], [0.1, 0.008, 0.1]));
    }
    P(`Hold-down & release mechanisms (${tag})`, {
      system: 'Power', material: 'Titanium cups, release nuts', mass: 3.5, count: 4, temp: 285, explode: [0, 1.75, 0],
      desc: 'Bolts through the folded panel stack clamp the wing to the radiator for launch; after separation the release nuts free them and spring hinges swing the panels out. Count and positions estimated.',
    }, mesh(merge(hrm), G.titanium()), mount);

    const drive = new THREE.Group();
    drive.position.y = SADA_L;
    mount.add(drive);
    const yokePivot = new THREE.Group();
    drive.add(yokePivot);
    const yoke = merge([
      cylG([0, 0.02, 0], 0.05, 0.04, 'y', 16),
      pipeG([[0, 0.03, 0], [0, YOKE_L, 1.0]], 0.022, 10), pipeG([[0, 0.03, 0], [0, YOKE_L, -1.0]], 0.022, 10),
      pipeG([[0, YOKE_L * 0.55, BRACE], [0, YOKE_L * 0.55, -BRACE]], 0.014, 8),
      boxG([0, YOKE_L, 1.0], [0.05, 0.05, 0.08]), boxG([0, YOKE_L, -1.0], [0.05, 0.05, 0.08]),
    ]);
    P(`Array yoke (${tag})`, {
      system: 'Power', material: 'Carbon-fibre tubes, titanium hinge fittings', mass: 7, temp: 300, explode: [0, 2.0, 0],
      desc: 'Holds the first panel clear of the bus so the wing\'s shadow and the radiator\'s view to space don\'t interfere. It folds flat against the radiator for launch (length estimated so the stowed stack sits centred on the face).',
    }, mesh(yoke, G.cfrp(2)), yokePivot);

    const pivots = [];
    let parent = yokePivot, len = YOKE_L;
    const names = ['inboard', 'middle', 'outboard'];
    for (let i = 0; i < 3; i++) {
      const pv = new THREE.Group();
      pv.position.y = len + GAP;
      parent.add(pv);
      const g = new THREE.BoxGeometry(PANEL_T, PANEL_L, PANEL_W).translate(0, PANEL_L / 2, 0);
      const edge = G.aluminium();
      const panel = mesh(g, [G.cells(4.5, 3.5), G.panelBack(), edge, edge, edge, edge]);
      const hinges = merge([boxG([0, 0.01, 1.0], [0.04, 0.04, 0.1]), boxG([0, 0.01, -1.0], [0.04, 0.04, 0.1]),
        boxG([0, PANEL_L - 0.01, 1.0], [0.04, 0.04, 0.1]), boxG([0, PANEL_L - 0.01, -1.0], [0.04, 0.04, 0.1])]);
      const part = P(`Solar panel ${i + 1} (${tag}, ${names[i]})`, {
        system: 'Power', material: 'Triple-junction GaAs cells on carbon-fibre / aluminium honeycomb', mass: 14, temp: 330, explode: [0, 2.15 + i * 0.18, 0],
        desc: i === 0
          ? `Inboard panel, ${PANEL_L.toFixed(2)} × ${PANEL_W.toFixed(2)} m (size estimated). Ultra-triple-junction cells convert about 28 % of the 1,361 W/m² of sunlight; together the six panels give GPS III its 4,480 W at end of life.`
          : i === 1
            ? 'Middle panel. Radiation in the GPS orbit — inside the outer Van Allen belt — slowly damages the cells, so the array is sized for its fifteenth year, not its first.'
            : 'Outboard panel. Spring-loaded hinges and a cable synchronisation loop unfold the three panels together, in seconds, after the release nuts fire.',
        callout: s > 0 && i === 2, anchor: [0.02, PANEL_L * 0.75, PANEL_W / 2],
      }, [panel, mesh(hinges, G.aluminium())], pv);
      part.userData.part.thermalRole = 'array';
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

  // ------------------------------------------------------------------ batteries, regulation, harness (on the −Y radiator, inner face y = −IY)
  const battery = (name, x, ex) => {
    const z = 0.66, d = 0.27;
    const y0 = -IY;
    const base = [boxG([x, y0 + 0.006, z], [0.42, 0.012, 0.42]), boxG([x, y0 + d - 0.008, z], [0.4, 0.016, 0.4])];
    const cells = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = x - 0.143 + i * 0.095, cz = z - 0.143 + j * 0.095;
      cells.push(cylG([cx, y0 + 0.012 + 0.12, cz], 0.042, 0.22, 'y', 16));
      cells.push(new THREE.SphereGeometry(0.042, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx, y0 + 0.232, cz));
    }
    return P(name, {
      system: 'Power', material: 'Nickel–hydrogen pressure-vessel cells, aluminium sleeves', mass: 58, count: 16, temp: 278, explode: [0, -1.2, 0],
      desc: 'One of two nickel–hydrogen batteries. Twice a year, when the Sun lies near the orbit plane, the satellite crosses the Earth\'s shadow on every orbit for up to about 56 minutes, and the batteries run the whole spacecraft. Cells are kept cool (≈ 0–10 °C) on the radiator; cell count and capacity estimated.',
      callout: x > 0, anchor: [x, y0 + 0.27, z + 0.2],
    }, [mesh(merge(base), G.blackBox()), mesh(merge(cells), G.silverBox())]);
  };
  battery('Battery 1', 0.4);
  battery('Battery 2', -0.4);
  P('Power regulation unit', {
    system: 'Power', material: 'Aluminium chassis, shunt regulators and battery charge electronics', mass: 34, temp: 305, explode: [0, -1.2, 0],
    desc: 'Holds the main bus voltage steady: it shunts surplus array current in sunlight, charges the batteries, and switches to battery power at each eclipse entry without a glitch to the clocks or transmitters.',
  }, unit([0.4, -(IY - 0.11), 0.12], [0.42, 0.22, 0.32], G.alodine(), { mount: '-y', conn: '+z', n: 5, fins: 7 }));
  P('Array drive electronics', {
    system: 'Power', material: 'Aluminium chassis', mass: 7, temp: 300, explode: [0, -1.2, 0],
    desc: 'Steps both array drives in time with the orbit and the yaw-steering law, from commands computed by the spacecraft processor.',
  }, unit([0.4, -(IY - 0.06), -0.24], [0.3, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+z', n: 3 }));
  P('Ordnance & deployment controller', {
    system: 'Electrical', material: 'Aluminium chassis', mass: 6, temp: 290, explode: [-1.1, 0, 0],
    desc: 'Fires the one-shot devices — the array release nuts and propulsion isolation valves — with redundant arm-and-fire circuits so nothing can trigger by accident on the ground or during launch.',
  }, unit([-(IX - 0.05), -0.45, 0.42], [0.1, 0.24, 0.18], G.alodine(), { mount: '-x', conn: '+z', n: 3 }));

  // wiring harness: a ring above the units, drops to each box, and trunks to the aft deck
  const ringZ = 1.0, ringR = 0.71, runs = [];
  const ring = [];
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([Math.cos(a) * ringR, Math.sin(a) * ringR, ringZ]); }
  runs.push(pipeG(ring, 0.017, 8));
  const drop = (x, y, z) => {
    const a = Math.atan2(y, x);
    runs.push(pipeG([[Math.cos(a) * ringR, Math.sin(a) * ringR, ringZ], [x, y, ringZ - 0.04], [x, y, z]], 0.01, 6));
  };
  drop(0.36, 0.78, 0.94); drop(-0.42, 0.8, 0.93); drop(0.62, 0.78, 0.48); drop(-0.6, 0.78, 0.18);
  drop(0.4, -0.75, 0.86); drop(-0.4, -0.75, 0.86); drop(0.62, -0.78, 0.28); drop(-0.4, -0.82, 0.28);
  drop(0.8, 0.45, 0.5); drop(-0.8, 0.45, 0.5); drop(0.8, -0.45, 0.51); drop(-0.8, -0.45, 0.51);
  for (const [x, y] of [[0.8, 0.12], [-0.8, -0.12]]) runs.push(pipeG([[x * 0.89, y, ringZ], [x, y, ringZ - 0.05], [x, y, -HZ + 0.12], [x * 0.95, y * 4, -HZ + 0.06]], 0.016, 8));
  P('Wiring harness', {
    system: 'Electrical', material: 'Shielded copper wire bundles, beta-cloth wrap', mass: 95, temp: 293, explode: [0, 0, 0.35],
    desc: 'Thousands of wires tie every unit to the power bus and the data buses. A harness is typically 4–5 % of a satellite\'s dry mass; this one is modelled as its main trunks only (routing estimated).',
  }, mesh(merge(runs), G.harness()));

  return { setDeploy, wings, RC, HZ, IZ };
}
