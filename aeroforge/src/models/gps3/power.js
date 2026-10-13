// GPS III electrical power subsystem (Marquis & Shaw, InsideGNSS 2011): solar arrays, nickel–hydrogen
// batteries and the power regulation unit, plus the array drives, frangibolt hold-downs and hinges of
// the mechanical subsystem, the deployment device controller and pyro relay assembly. Lockheed's
// expanded view shows a "2-panel Solar Array Wing (2 places)" stowed against each ±Y face and labels
// "SPRU", "FBA" and "SADA" on the bus panel; airforce-technology lists four ultra-triple-junction
// panels totalling 307 ft² (28.5 m²), and the IGS box-wing model uses 28.2 m² and a 15 m span.
// The drive sits about 0.35 m below mid-height on each face, with eight hold-down cups around it
// (manufacturer's scale model, Steigenberger et al. 2020, Fig. 4).

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { HX, HY, HZ, IY, SADA_C, boxG, cylG, merge, unit, pipeG, connPoint, reg } from './kit.js';
import { onBUS } from './layout.js';

import { SADA_L, YOKE_L, PANEL_L, PANEL_W, PANEL_T, GAP, ARRAY_SPAN, ARRAY_AREA } from './dims.js';

const FOLD = 0.035;           // stack spacing when stowed
const ARM_Z = 1.0;            // yoke arm ends and hinge-line fittings along Z
const BRACE = 0.55 * ARM_Z;   // the cross-brace meets the arms at 55 % of the reach
/** Frangibolt hold-down pattern on each ±Y face (x, z), from the scale model. */
const HOLD = [0.65, -0.37].flatMap((x) => [0.88, 0.09, -0.82, -1.61].map((z) => [x, z]));

export { ARRAY_SPAN, ARRAY_AREA };

export function buildPower(P, body) {
  const wings = [];
  for (const s of [1, -1]) {
    const tag = s > 0 ? '+Y' : '−Y';
    const mount = new THREE.Group();
    mount.position.set(SADA_C[0], s * HY, SADA_C[1]);
    if (s < 0) mount.rotation.x = Math.PI;      // mirror by rotation: cells keep facing +X
    body.add(mount);

    // drive: inner housing through the panel, flange, motor housing and output shaft
    const sada = merge([
      cylG([0, -0.08, 0], 0.12, 0.11, 'y', 32), cylG([0, 0.006, 0], 0.16, 0.012, 'y', 36), cylG([0, 0.07, 0], 0.11, 0.12, 'y', 32),
      cylG([0, 0.14, 0], 0.06, 0.02, 'y', 20),
    ]);
    const bolts = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; bolts.push(cylG([Math.cos(a) * 0.14, 0.015, Math.sin(a) * 0.14], 0.008, 0.008, 'y', 6)); }
    P(`Solar array drive (${tag})`, {
      system: 'Power', material: 'Stepper motor, slip rings, bearings', mass: 19, temp: 290, explode: [0, 1.95, 0],
      desc: s < 0
        ? 'The "SADA" (solar array drive assembly) that Lockheed\'s figure labels on the bus panel, seated about 0.35 m below mid-height on the face as the scale model shows. It turns its wing once per 718-minute orbit, about 0.5° a minute, so the cells face the Sun while the body points at the Earth; slip rings carry the array current across the rotating joint.'
        : 'One of the two solar array drive assemblies: a stepper motor turns the +Y wing once per 718-minute orbit, about 0.5° a minute, in step with its twin, so the cells face the Sun while the body points at the Earth. Slip rings inside carry the wing\'s share of the 4,480 W end-of-life power across the rotating joint to the power regulation unit.',
      // the drive's callout, on the +Y one (the one the default framings see), at the rim of the motor housing
      callout: s > 0, anchor: [0, 0.12, 0.11],
    }, [mesh(sada, G.gunmetal()), mesh(merge(bolts), G.satinTi())], mount);

    const drive = new THREE.Group();
    drive.position.y = SADA_L;
    mount.add(drive);
    const yokePivot = new THREE.Group();
    drive.add(yokePivot);
    const yoke = merge([
      cylG([0, 0.02, 0], 0.05, 0.04, 'y', 16),
      pipeG([[0, 0.03, 0], [0, YOKE_L, ARM_Z]], 0.022, 10), pipeG([[0, 0.03, 0], [0, YOKE_L, -ARM_Z]], 0.022, 10),
      pipeG([[0, YOKE_L * 0.55, BRACE], [0, YOKE_L * 0.55, -BRACE]], 0.014, 8),
      pipeG([[0, YOKE_L - 0.02, ARM_Z], [0, YOKE_L - 0.02, -ARM_Z]], 0.016, 8),
      boxG([0, YOKE_L, ARM_Z], [0.05, 0.05, 0.08]), boxG([0, YOKE_L, -ARM_Z], [0.05, 0.05, 0.08]),
    ]);
    P(`Array yoke (${tag})`, {
      system: 'Power', material: 'Carbon-fibre tubes, titanium hinge fittings', mass: 10, temp: 300, explode: [0, 2.05, 0],
      desc: 'A triangular frame that holds the inboard panel about 1.3 m clear of the bus, so the wing\'s shadow and the radiator\'s view of space don\'t interfere. It folds flat against the face for launch; its length is estimated so the folded wing just covers the 2.46 m face, which gives a span of about 14.6 m against the 15 m published.',
    }, mesh(yoke, G.cfrp(2)), yokePivot);
    const ah = [];
    for (const sz of [1, -1]) ah.push(pipeG([[0.03, 0.06, 0], [0.03, YOKE_L * 0.5, sz * ARM_Z * 0.5], [0.03, YOKE_L - 0.05, sz * (ARM_Z - 0.05)], [0.03, YOKE_L + 0.01, sz * (ARM_Z - 0.12)],
      [-PANEL_T / 2 - 0.007, YOKE_L + GAP + 0.012, sz * (ARM_Z - 0.12)]], 0.0075, 6));   // service loop across the root hinge line
    ah.push(pipeG([[0.03, 0.06, 0], [0.05, 0.02, 0.04], [0.05, -0.02, 0.02]], 0.011, 6));
    P(`Array harness (${tag})`, {
      system: 'Electrical', material: 'Copper power and sense wires in a beta-cloth sleeve', mass: 4, temp: 300, explode: [0, 2.1, 0],
      desc: 'The wing\'s power harness: bundles from the panels cross each hinge line in service loops, run along the yoke arms and enter the drive, whose slip rings pass about 2.2 kW per wing into the bus at end of life (routing estimated).',
    }, mesh(merge(ah), G.harness()), yokePivot);

    const hinge = (name, parent, desc, zs = [-ARM_Z, ARM_Z], y = 0, pulleys = true) => {
      const g = [];
      for (const z of zs) g.push(boxG([0, y, z], [0.04, 0.05, 0.1]), cylG([0, y, z], 0.014, 0.12, 'z', 10));
      if (pulleys) g.push(cylG([0, y, ARM_Z + 0.09], 0.035, 0.012, 'z', 18), cylG([0, y, -ARM_Z - 0.09], 0.035, 0.012, 'z', 18));
      return P(name, { system: 'Power', material: 'Titanium spring hinges, cable-loop pulleys, eddy-current damper', mass: 1.6, count: 2, temp: 300, explode: [0, 0.1, 0], desc }, mesh(merge(g), G.satinTi()), parent);
    };
    hinge(`Root hinge (${tag})`, yokePivot, 'Spring hinge where the yoke meets the drive shaft. A damper slows the swing so the whole wing does not slam into its latches as it unfolds; the hinges are part of the mechanical subsystem with the structure and frangibolts (form estimated).', [-0.09, 0.09], 0.04, false);

    const pivots = [];
    let parent = yokePivot, len = YOKE_L;
    const names = ['inboard', 'outboard'];
    for (let i = 0; i < 2; i++) {
      const pv = new THREE.Group();
      pv.position.y = len + GAP;
      parent.add(pv);
      const g = new THREE.BoxGeometry(PANEL_T, PANEL_L, PANEL_W).translate(0, PANEL_L / 2, 0);
      const edge = G.aluminium();
      const back = [];
      const tipEnd = i === 0 ? PANEL_L - 0.012 : PANEL_L - 0.12;   // the inboard panel's runs continue across the hinge to the outboard panel
      for (const z of [-(ARM_Z - 0.12), ARM_Z - 0.12]) back.push(pipeG([[-PANEL_T / 2 - 0.007, 0.012, z], [-PANEL_T / 2 - 0.007, tipEnd, z]], 0.006, 6));
      for (let k = 1; k <= 4; k++) back.push(pipeG([[-PANEL_T / 2 - 0.007, (k / 5) * PANEL_L, -(ARM_Z - 0.12)], [-PANEL_T / 2 - 0.007, (k / 5) * PANEL_L, ARM_Z - 0.12]], 0.004, 6));
      const part = P(`Solar panel ${i + 1} (${tag}, ${names[i]})`, {
        system: 'Power', material: 'Ultra-triple-junction GaAs cells on carbon-fibre / aluminium honeycomb', mass: 26, temp: 330, explode: [0, 2.2 + i * 0.2, 0],
        desc: i === 0
          ? `Inboard panel, ${PANEL_L.toFixed(2)} × ${PANEL_W.toFixed(2)} m (size estimated): Lockheed's figure shows a two-panel wing, and four panels make ${ARRAY_AREA.toFixed(1)} m², the area of the IGS box-wing model. Ultra-triple-junction cells convert about 28 % of the 1,361 W/m² of sunlight; together the four panels give GPS III its 4,480 W at end of life. The string harness runs across the back to the hinge line.`
          : 'Outboard panel. Radiation in the GPS orbit, inside the outer Van Allen belt, slowly damages the cells, so the array is sized for its fifteenth year, not its first. Spring hinges and a closed cable loop unfold both panels together, in seconds, once the frangibolts release.',
        // the wing's one callout, on the −Y inboard panel near its aft edge (local +z is body −Z on this wing)
        callout: s < 0 && i === 0, anchor: [0.02, PANEL_L / 2, PANEL_W / 2 - 0.15],
      }, [mesh(g, [G.cells(4.5, 4.2), G.panelBack(), edge, edge, edge, edge]), mesh(merge(back), G.harness())], pv);
      part.userData.part.thermalRole = 'array';
      hinge(`Panel hinge ${i + 1} (${tag})`, pv, i === 0
        ? 'Spring hinges between the yoke and the inboard panel. A closed cable loop over pulleys at each hinge line ties the hinges together, so the panels open at the same rate; the power harness crosses here in a service loop (form estimated).'
        : 'Spring hinges between the inboard and outboard panels, with the pulleys of the synchronising cable loop at each end (form estimated).');
      pivots.push(pv);
      parent = pv;
      len = PANEL_L;
    }
    wings.push({ drive, yokePivot, pivots, s });

    // frangibolt hold-downs: eight cups per face around the drive (body frame)
    const hrm = [];
    for (const [x, z] of HOLD) {
      const y0 = s * HY;
      hrm.push(cylG([x, y0 + s * 0.075, z], 0.03, 0.15, 'y', 14), cylG([x, y0 + s * 0.157, z], 0.02, 0.014, 'y', 10), boxG([x, y0 + s * 0.004, z], [0.1, 0.008, 0.1]));
    }
    P(`Frangibolt hold-downs (${tag})`, {
      system: 'Power', material: 'Titanium cups, shape-memory-alloy Frangibolt actuators', mass: 6, count: 8, temp: 285, explode: [0, s * 1.85, 0],
      desc: 'Eight hold-down cups on each face (a 2 × 4 pattern around the drive in the scale model). Bolts through them clamp the folded wing for launch and through the apogee burns; to release, a heater warms a shape-memory-alloy sleeve round each notched bolt until it snaps it, with no explosive shock. The design paper lists frangibolts for every deployable element.',
    }, mesh(merge(hrm), G.satinTi()), body);
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

  // ------------------------------------------------------------------ batteries and regulation (on the −Y bus panel, inner face y = −IY)
  const box = (name, info, xz, sz, mat, opts, power = true) => {
    const c = onBUS(xz, sz[1]);
    reg(connPoint(c, sz, opts.conn, 0.04), 'bus', power);
    return P(name, info, unit(c, sz, mat, opts));
  };
  const BAT = { s: [1.0, 0.25, 0.3], z: -1.05 };
  const battery = (name, x, desc) => {
    const y0 = -IY, z = BAT.z, d = BAT.s[1];
    const base = [boxG([x, y0 + 0.006, z], [BAT.s[0] + 0.03, 0.012, BAT.s[2] + 0.03]), boxG([x - BAT.s[0] / 2 + 0.01, y0 + d / 2, z], [0.02, d, BAT.s[2]]), boxG([x + BAT.s[0] / 2 - 0.01, y0 + d / 2, z], [0.02, d, BAT.s[2]]),
      boxG([x, y0 + d - 0.01, z + 0.075], [BAT.s[0], 0.02, 0.03]), boxG([x, y0 + d - 0.01, z - 0.075], [BAT.s[0], 0.02, 0.03]), boxG([x, y0 + 0.07, z], [BAT.s[0] - 0.04, 0.04, BAT.s[2] - 0.01])];
    const cells = [];
    for (let i = 0; i < 10; i++) for (const dz of [-0.075, 0.075]) {
      const cx = x - 0.441 + i * 0.098;
      cells.push(cylG([cx, y0 + 0.12, z + dz], 0.044, 0.12, 'y', 16));
      cells.push(new THREE.SphereGeometry(0.044, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(cx, y0 + 0.18, z + dz));
    }
    reg([x + 0.3, y0 + d + 0.04, z + 0.12], 'bus', true);
    return P(name, {
      system: 'Power', material: 'Nickel–hydrogen pressure-vessel cells in aluminium sleeves', mass: 75, count: 20, temp: 278, explode: [0, -1.25, -0.15], desc,
    }, [mesh(merge(base), G.blackBox()), mesh(merge(cells), G.silverBox())]);
  };
  battery('Battery 1', -0.4, 'One of the two nickel–hydrogen batteries, drawn in Lockheed\'s figure as a long pack of pressure-vessel cells in two rows (here 2 × 10 cells, about 1.0 × 0.25 × 0.3 m; count estimated). Twice a year, when the Sun lies near the orbit plane, the satellite crosses the Earth\'s shadow on every orbit for up to about 56 minutes, and the batteries run the whole spacecraft. The design paper lists lithium-ion as a later weight-saving insertion.');
  battery('Battery 2', 0.66, 'The second NiH₂ battery. Cells are kept cool, about 0–10 °C, on the radiator panel, because battery life falls quickly when they run warm (cell count estimated).');
  box('Power regulation unit (SPRU)', {
    system: 'Power', material: 'Aluminium chassis, shunt regulators and battery charge electronics', mass: 44, temp: 305, explode: [0, -1.15, 0.05],
    desc: 'Lockheed\'s figure labels this unit "SPRU" (acronym not expanded in the source); the design paper names the subsystem\'s power regulation unit. It holds the main bus voltage steady, shunts surplus array current in sunlight, charges the batteries and switches to battery power at each eclipse entry without a glitch to the clocks or transmitters.',
  }, [-0.1, 0.85], [0.44, 0.22, 0.32], G.alodine(), { mount: '-y', conn: '+z', n: 5, fins: 7 });
  box('FBA unit', {
    system: 'Power', material: 'Aluminium chassis', mass: 5, temp: 300, explode: [0.1, -1.15, 0],
    desc: 'A box Lockheed\'s figure labels "FBA", next to the solar-array drive on the bus panel. The source does not expand the acronym or describe it, so its function is left unstated here (size estimated).',
  }, [0.48, -0.37], [0.22, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+y', n: 3 }, false);
  box('Array drive electronics', {
    system: 'Power', material: 'Aluminium chassis', mass: 9, temp: 300, explode: [0, -1.15, 0],
    desc: 'Steps both array drives in time with the orbit and the yaw-steering law, from commands computed by the on-board computer (unit and position estimated).',
  }, [-0.35, -0.37], [0.3, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+y', n: 3 }, false);
  box('Deployment device controller', {
    system: 'Electrical', material: 'Aluminium chassis', mass: 7, temp: 290, explode: [0, -1.15, 0],
    desc: 'The TT&C subsystem\'s "deployment device control": it arms and commands the one-shot devices (the frangibolts, the helium pyro valves and the antenna releases) with redundant arm-and-fire circuits, so nothing can trigger by accident on the ground or during launch.',
  }, [-0.8, -0.37], [0.26, 0.12, 0.18], G.alodine(), { mount: '-y', conn: '+y', n: 3 }, false);
  // pyro relay assembly on the −X/+Y shear web, facing the −X tank bay
  const pr = [-0.75, 0.4175, -1.17], prS = [0.25, 0.12, 0.15];
  reg(connPoint(pr, prS, '+z', 0.04), 'core');
  P('Pyro relay assembly', {
    system: 'Electrical', material: 'Aluminium chassis, latching relays', mass: 4, temp: 288, explode: [-0.65, 0.15, 0],
    desc: 'The "Pyro Relay Assy" of Lockheed\'s expanded view, beside the core: it switches the firing current, several amps for milliseconds, to the helium pyro valves, the frangibolt heaters and the antenna releases when the deployment device controller commands it (position estimated).',
  }, unit(pr, prS, G.alodine(), { mount: '+y', conn: '+z', n: 4 }));

  // ground-test and arming connectors on the −X closeout, reachable through the fairing access door
  const tb = [boxG([-HX - 0.018, 0.7, -1.3], [0.008, 0.16, 0.36])];
  const plugs = [];
  for (let i = 0; i < 3; i++) { const z = -1.18 - i * 0.12; tb.push(cylG([-HX - 0.035, 0.7, z], 0.022, 0.03, 'x', 12)); plugs.push(boxG([-HX - 0.055, 0.7, z - 0.07], [0.004, 0.04, 0.09])); }
  P('Test & arming connectors', {
    system: 'Electrical', material: 'Connector bracket, arming plugs with red "remove before flight" tags', mass: 1.2, temp: 270, explode: [-0.7, 0.1, 0],
    desc: 'Where ground equipment plugs in for testing, and where arming plugs complete the ordnance circuits shortly before launch. Generic stand-in below the −X access panel: the GPS III layout of these connectors is not public.',
  }, [mesh(merge(tb), G.blackBox()), mesh(merge(plugs), G.redTag())]);

  return { setDeploy, wings };
}

export { HZ };
