// GPS III wiring, drawn last from the landing points every module registered (kit.js NET):
// - the data harness: the units sit on MIL-STD-1553B buses (Lockheed's block diagram shows a bus
//   1553B, a payload 1553B, MDU and hosted-payload 1553B links and an alternate bus), run here as a
//   trunk ladder on each equipment panel with a drop to every unit and ties to the deck and aft units;
// - the power harness: array power from both drives to the power regulation unit, the batteries on
//   their own feeders, and the main power bus out to both panels with drops to the larger loads.
// Routing is an estimate; the bundles are sized as the main runs only.

import { mesh } from '../../engine/assembly.js';
import { G } from './materials.js';
import { IY, HZ, SADA_C, NET, merge, pipeG } from './kit.js';

const YD = 0.585, YP = 0.64;           // data and power trunk offsets from the core axis on each panel
const ZT = 1.62, ZB = -1.6, XR = 1.08; // top and bottom data trunks, risers at x = ±XR
const ZPT = 1.645;                     // main power bus under the Earth deck

export function buildHarness(P) {
  const data = [], power = [];
  // ---- data trunk ladders on both panels, tied across the ±X bays at top and bottom
  for (const s of [1, -1]) {
    const y = s * YD;
    data.push(pipeG([[-XR, y, ZT], [XR, y, ZT]], 0.012, 8), pipeG([[-XR, y, ZB], [XR, y, ZB]], 0.012, 8));
    for (const x of [-XR, XR]) data.push(pipeG([[x, y, ZT], [x, y, ZB]], 0.01, 8));
  }
  for (const x of [-1.0, 1.0]) for (const z of [ZT, ZB]) data.push(pipeG([[x, -YD, z], [x, YD, z]], 0.01, 8));
  const clampX = (x) => Math.max(-XR, Math.min(XR, x));
  for (const { p, side, power: pw } of NET.nodes) {
    const s = side === 'npe' ? 1 : side === 'bus' ? -1 : (p[1] >= 0 ? 1 : -1);
    if (side === 'npe' || side === 'bus') {
      const zt = p[2] > 0 ? ZT : ZB;
      data.push(pipeG([p, [p[0], s * YD, p[2]], [p[0], s * YD, zt]], 0.0055, 6));
      if (pw) power.push(pipeG([p, [p[0] + 0.03, s * YP, p[2]], [p[0] + 0.03, s * YP, p[2] > -0.6 ? ZPT : ZB + 0.03]], 0.008, 6));
    } else if (side === 'deck') {
      const x = clampX(p[0]);
      data.push(pipeG([p, [x, p[1], p[2]], [x, s * YD, p[2]], [x, s * YD, ZT]], 0.0055, 6));
      if (pw) power.push(pipeG([[p[0], p[1] + 0.03, p[2] - 0.01], [x, p[1] + 0.03, ZPT], [x, s * YP, ZPT]], 0.008, 6));
    } else if (side === 'aft') {
      // outside parts (thruster pods) come in through the aft deck near the corner
      const inside = Math.abs(p[0]) < 1.2 ? p : [Math.sign(p[0]) * 1.15, p[1], p[2]];
      const pts = [p];
      if (inside !== p) pts.push(inside, [inside[0], inside[1], -HZ + 0.06]);
      const last = pts[pts.length - 1];
      pts.push([clampX(last[0]), last[1], -HZ + 0.06], [clampX(last[0]), s * YD, -HZ + 0.06], [clampX(last[0]), s * YD, ZB]);
      data.push(pipeG(pts, 0.0055, 6));
    } else {
      // core and bay units: out to the nearer panel's trunk
      const zt = p[2] > 0 ? ZT : ZB;
      data.push(pipeG([p, [p[0], s * YD, p[2]], [p[0], s * YD, zt]], 0.0055, 6));
    }
  }
  P('Data harness (1553B)', {
    system: 'Electrical', material: 'Shielded twisted-pair data cables, beta-cloth wrap', mass: 45, temp: 293, explode: [0, 0, 0.3],
    desc: 'The command and telemetry wiring. Lockheed\'s block diagram puts the units on MIL-STD-1553B data buses: a bus 1553B for the vehicle units, a payload 1553B for the navigation and network-communications units, separate MDU and hosted-payload links, and an alternate bus. A trunk runs along each equipment panel with a drop to every box and ties to the deck sensors and the thruster valves (routing estimated).',
  }, mesh(merge(data), G.harness()));

  // ---- power: drives → SPRU, batteries, main bus
  const yIn = IY - 0.105;   // inner end of each drive housing
  const [dx, dz] = SADA_C;
  const xr = 0.13, yb = -0.7;            // the SPRU's riser on the bus panel, between the two batteries
  power.push(pipeG([[dx, yIn, dz], [dx, 0.66, dz], [dx, 0.66, ZB + 0.02], [0.95, 0.66, ZB + 0.02], [0.95, yb, ZB + 0.02], [xr, yb, ZB + 0.02], [xr, yb, 0.6], [0.05, yb, 0.6], [0.05, yb, 0.65]], 0.016, 8));
  power.push(pipeG([[dx, -yIn, dz], [dx, yb, dz], [xr, yb, dz]], 0.016, 8));
  for (const bx of [-0.4, 0.66]) power.push(pipeG([[xr, yb, -0.8], [bx, yb, -0.8], [bx, -0.72, -0.86]], 0.013, 8));
  power.push(pipeG([[-0.1, -0.7, 1.05], [-0.1, -YP, ZPT], [0.95, -YP, ZPT], [0.95, YP, ZPT], [-1.0, YP, ZPT]], 0.016, 8));
  power.push(pipeG([[-0.1, -YP, ZPT], [-1.0, -YP, ZPT]], 0.014, 8));
  P('Power harness', {
    system: 'Electrical', material: 'Copper power cables, beta-cloth wrap', mass: 55, temp: 295, explode: [0, 0, 0.2],
    desc: 'The power path a student can trace: array current from both drives (the +Y wing\'s along the bottom of the bus) to the power regulation unit, feeders to the two batteries, and the main power bus out under the Earth deck to both panels, with drops to the larger loads such as the transmitters, the Mission Data Unit, the clocks, the computer and the wheels. A harness is typically 4–5 % of a satellite\'s dry mass (routing estimated).',
  }, mesh(merge(power), G.powerHarness()));
}
