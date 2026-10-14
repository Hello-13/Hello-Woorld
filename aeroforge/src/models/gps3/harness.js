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
import { BATT, battConn, SPRU_IN } from './layout.js';

const YD = 0.585, YP = 0.64;           // data and power trunk offsets from the core axis on each panel
const ZT = 1.595, ZB = -1.6, XR = 1.08; // top and bottom data trunks, risers at x = ±XR
const XC = 0.95;                       // where the main power bus crosses the +X bay from panel to panel
const ZPT = 1.628;                     // main power bus under the Earth deck (between the trunk and the deck runs)
const ZPB = ZB + 0.03;                 // lower power branch along the foot of the NPE panel (MDU and clocks)

export function buildHarness(P) {
  const data = [], power = [];
  // ---- data trunk ladders on both panels, tied across the ±X bays at top and bottom
  for (const s of [1, -1]) {
    const y = s * YD;
    data.push(pipeG([[-XR, y, ZT], [XR, y, ZT]], 0.012, 8), pipeG([[-XR, y, ZB], [XR, y, ZB]], 0.012, 8));
    for (const x of [-XR, XR]) data.push(pipeG([[x, y, ZT], [x, y, ZB]], 0.01, 8));
  }
  // cross-ties: at the top across the ±X bays, at the bottom along the corners (clear of the fill lines)
  for (const x of [-1.0, 1.0]) data.push(pipeG([[x, -YD, ZT], [x, YD, ZT]], 0.01, 8));
  for (const x of [-XR, XR]) data.push(pipeG([[x, -YD, ZB], [x, YD, ZB]], 0.01, 8));
  const clampX = (x) => Math.max(-XR, Math.min(XR, x));
  for (const { p, side, power: pw, lead = [] } of NET.nodes) {
    const s = side === 'npe' ? 1 : side === 'bus' ? -1 : (p[1] >= 0 ? 1 : -1);
    if (side === 'npe' || side === 'bus') {
      const zt = p[2] > 0 ? ZT : ZB;
      data.push(pipeG([p, [p[0], s * YD, p[2]], [p[0], s * YD, zt]], 0.0055, 6));
      if (pw) power.push(pipeG([p, [p[0] + 0.03, s * YP, p[2]], [p[0] + 0.03, s * YP, p[2] > -0.6 ? ZPT : ZPB]], 0.008, 6));
    } else if (side === 'deck') {
      const x = clampX(p[0]);
      data.push(pipeG([p, [x, p[1], p[2]], [x, s * YD, p[2]], [x, s * YD, ZT]], 0.0055, 6));
      // deck loads beyond the +X end of the bus panels land on the main bus where it crosses the +X bay
      if (pw) power.push(pipeG(p[0] > XC ? [[p[0], p[1] + 0.03, p[2] - 0.01], [XC, p[1] + 0.03, ZPT]] : [[p[0], p[1] + 0.03, p[2] - 0.01], [x, p[1] + 0.03, ZPT], [x, s * YP, ZPT]], 0.008, 6));
    } else if (side === 'aft') {
      // aft-end units follow their own lead first (a thruster pod's cable runs back along its outrigger,
      // 5 cm inboard of the feed line; a sun sensor's goes straight up through the deck), then run
      // inside the aft deck to the corner riser
      const pts = [p, ...lead];
      const last = pts[pts.length - 1];
      pts.push([clampX(last[0]), last[1], -HZ + 0.06], [clampX(last[0]), s * YD, -HZ + 0.06], [clampX(last[0]), s * YD, ZB]);
      data.push(pipeG(pts, 0.0055, 6));
    } else {
      // core and bay units: out to the nearer panel's trunk; a unit beyond the risers meets the riser instead
      const zt = p[2] > 0 ? ZT : ZB, x = clampX(p[0]);
      data.push(pipeG(x === p[0] ? [p, [p[0], s * YD, p[2]], [p[0], s * YD, zt]] : [p, [p[0], s * YD, p[2]], [x, s * YD, p[2]]], 0.0055, 6));
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
  // +Y wing: across the NPE panel at drive height to its +X edge, down it, and across the bottom of the +X bay
  const zA = ZB + 0.045;   // the array run across the foot of the +X bay, over the bottom data trunks
  // ...and up the riser to the array-input connector on the SPRU's underside (power.js SPRU_IN)
  power.push(pipeG([[dx, yIn, dz], [dx, 0.66, dz], [0.95, 0.66, dz], [0.95, 0.66, zA], [0.95, yb, zA], [xr, yb, zA], [xr, yb, 0.6], [SPRU_IN[0], yb, 0.6], [SPRU_IN[0], yb, SPRU_IN[2]]], 0.016, 8));
  power.push(pipeG([[dx, -yIn, dz], [dx, yb, dz], [xr, yb, dz]], 0.016, 8));
  // battery feeders: from the riser over the packs to each pack's power connector
  for (const bx of BATT.xs) { const c = battConn(bx).power; power.push(pipeG([[xr, yb, -0.8], [c[0], yb, -0.8], [c[0], c[1], c[2]]], 0.013, 8)); }
  power.push(pipeG([[-0.1, -0.7, 1.05], [-0.1, -YP, ZPT], [XC, -YP, ZPT], [XC, YP, ZPT], [-1.0, YP, ZPT]], 0.016, 8));
  // the −Y main bus runs from the last drop at its −X end to the last at its +X end (the wheels, the
  // IMU and the wheel drive electronics stand beyond the +X bay crossing), so every drop lands on it
  const busX = NET.nodes.filter((n) => n.power && n.side === 'bus' && n.p[2] > -0.6).map((n) => n.p[0] + 0.03);
  power.push(pipeG([[-0.1, -YP, ZPT], [Math.min(-0.1, ...busX) - 0.01, -YP, ZPT]], 0.014, 8));
  if (Math.max(...busX) > XC) power.push(pipeG([[XC, -YP, ZPT], [Math.max(...busX) + 0.01, -YP, ZPT]], 0.014, 8));
  // the +Y main bus turns down the −X edge of the NPE panel into the lower branch, to just past the last clock drop
  const xEnd = Math.max(-1.0, ...NET.nodes.filter((n) => n.power && n.side === 'npe' && n.p[2] <= -0.6).map((n) => n.p[0] + 0.03)) + 0.01;
  power.push(pipeG([[-1.0, YP, ZPT], [-1.0, YP, ZPB], [xEnd, YP, ZPB]], 0.014, 8));
  P('Power harness', {
    system: 'Electrical', material: 'Copper power cables, beta-cloth wrap', mass: 55, temp: 295, explode: [0, 0, 0.2],
    desc: 'The power path a student can trace: array current from both drives to the power regulation unit (the +Y wing\'s across the bottom of the +X bay), feeders to each battery\'s connector, and the main power bus out under the Earth deck to both panels, with drops to the larger loads such as the transmitters, the computer and the wheels. On the navigation panel the bus turns down the −X edge into a lower branch for the Mission Data Unit and the clocks. A harness is typically 4–5 % of a satellite\'s dry mass (routing estimated).',
  }, mesh(merge(power), G.powerHarness()));
}
