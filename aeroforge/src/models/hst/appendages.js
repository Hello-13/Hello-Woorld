// Deployable and external hardware: the two SA3 rigid solar-array wings on their drives, the two
// high-gain antennas on deployable masts, the low-gain antennas, the magnetic torquer bars,
// magnetometers and coarse sun sensors.
//
// SA3 wings (2002): 7.1 × 2.6 m and 640 lb (290 kg) each (SM4 Media Guide Fig. 5-25), four
// Iridium-derived gallium-arsenide panels per wing on an aluminium-lithium frame, 5,270 W together.
// The arrays sit on the ±V2 sides of the forward shell (−V2 = +z), the high-gain antenna masts on
// the ±V3 (±y) sides; the four torquer bars ride on the forward shell at 90° intervals and the
// magnetometers and two of the five coarse sun sensors on the light shield (SM3A Media Guide §5.1).
// Mast lengths and dish size are estimates from photographs.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { rod, lathe, mergeGeometries } from '../../engine/geometry.js';
import { RAD, ST, az, deg, ix, cablePath, radialBox } from './layout.js';
import { HM } from './materials.js';

const merge = (list) => mergeGeometries(list.map(ix));

export const SA = { x: 6.3, rDrive: RAD.shell, mast: 0.75, wing: 7.1, width: 2.6 };
export const HGA = { x: 6.95, mast: 3.3, dish: 0.65 };

export function buildAppendages(P, body) {
  const out = { arrays: [], hgas: [] };

  // ------------------------------------------------------------------ solar arrays (±z)
  // Each SA3 wing hangs off the forward shell on a chain (NASA NTRS 20010070991 §2.1): the ESA solar
  // array drive adapter (female end on HST), the drive mechanism, a visco-elastic damper, a titanium
  // coupler carrying the array connectors, and the M55J graphite mast with its hinge, then the
  // aluminium-lithium panel support structure carrying four panels (two each side of the fold hinge).
  // Chain sizes estimated from photographs.
  const Z_SADA = SA.rDrive, Z_SADM = SA.rDrive + 0.05, Z_PIV = SA.rDrive + 0.3;     // 1.55, 1.60, 1.85
  const L_DAMP = 0.12, L_COUP = 0.15, L_MAST = 0.4;                                    // wing root at |z| 2.52
  const ROOT = L_DAMP + L_COUP + L_MAST;
  const zc = (s, z0, z1) => [s * (z0 + z1) / 2, z1 - z0];
  const cylZ = (r, x, y, z, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(x, y, z);
  const sadaPts = [], dba = [], dbaDet = [], cables = [];
  for (const s of [1, -1]) {
    const side = s > 0 ? '−V2' : '+V2';
    // fixed to the shell: drive adapter and drive mechanism
    const [zA, lA] = zc(s, Z_SADA, Z_SADM);
    const sada = [cylZ(0.2, SA.x, 0, zA, lA, 32), new THREE.BoxGeometry(0.5, 0.4, 0.03).translate(SA.x, 0, s * (Z_SADA + 0.015))];
    for (let k = 0; k < 8; k++) sada.push(cylZ(0.014, SA.x + 0.17 * Math.cos(k * Math.PI / 4), 0.17 * Math.sin(k * Math.PI / 4), s * (Z_SADM + 0.008), 0.016, 6));
    P(`Solar array drive adapter (${side})`, {
      system: 'Power', material: 'ESA-built adapter flange; its female end is fixed to the telescope, the male end takes the array', mass: 8, temp: 285, explode: [0, 0, s * 0.5],
      desc: 'The interface plate that lets a whole wing be unbolted and swapped by spacewalkers: the 2002 crew changed both wings here. Size estimated.',
    }, mesh(merge(sada), HM.al()));
    const [zM, lM] = zc(s, Z_SADM, Z_PIV);
    const sadm = [cylZ(0.15, SA.x, 0, zM, lM - 0.03, 32)];
    const sadmEnd = [cylZ(0.16, SA.x, 0, s * (Z_PIV - 0.012), 0.024, 32), cylZ(0.16, SA.x, 0, s * (Z_SADM + 0.012), 0.024, 32)];
    for (const y of [-0.06, 0.06]) sadmEnd.push(new THREE.BoxGeometry(0.05, 0.04, 0.06).translate(SA.x + 0.16, y, s * (Z_PIV - 0.04)));   // cable-set connectors
    P(`Solar array drive mechanism (${side})`, {
      system: 'Power', material: 'ESA stepper-motor drive under a metal shield and MLI blanket; two 10 W survival heaters', mass: 20, temp: 280, explode: [0, 0, s * 0.8],
      desc: 'Turns its wing about the mast so the cells keep facing the Sun wherever the telescope points. Thermostats switch its two 10 W survival heaters on at −27 °C (−33 °C for the backup); two sets of cables and connectors carry the array\'s power past it into the telescope. Size estimated.',
    }, [mesh(merge(sadm), HM.mli(6)), mesh(merge(sadmEnd), HM.al())]);
    // rotating chain on the deploy pivot
    const pivot = new THREE.Group();
    pivot.position.set(SA.x, 0, s * Z_PIV);
    const damper = [cylZ(0.1, 0, 0, s * L_DAMP / 2, L_DAMP - 0.03, 28), cylZ(0.11, 0, 0, s * 0.008, 0.016, 28), cylZ(0.11, 0, 0, s * (L_DAMP - 0.008), 0.016, 28)];
    P(`Solar array damper (${side})`, {
      system: 'Power', material: 'Titanium spool with visco-elastic material between titanium shear laps, under MLI; 25 W heater', mass: 6, temp: 288, explode: [0, 0.3, s * 0.15],
      desc: 'Damps the wing\'s flexing, which gives Hubble\'s pointing a margin of stability. The visco-elastic layers only work warm, so a 25 W heater holds it between +10 and +15 °C.',
    }, [mesh(merge(damper.slice(0, 1)), HM.mli(7)), mesh(merge(damper.slice(1)), HM.ti())], pivot);
    const z0c = L_DAMP, z1c = L_DAMP + L_COUP;
    const coup = [cylZ(0.1, 0, 0, s * (z0c + z1c) / 2, L_COUP, 28)];
    const coupConn = [], coupH = [], pig = [];
    for (const y of [-0.06, 0.06]) {
      coupConn.push(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12).rotateZ(Math.PI / 2).translate(0.12, y, s * (z0c + 0.05)));
      pig.push(...cablePath([[0.15, y, s * (z0c + 0.05)], [0.17, y, s * 0.02], [0.16, y, -s * 0.03]], 0.012, 6));
    }
    for (const sx of [-1, 1]) coupH.push(...cablePath([[sx * 0.08, -0.07, s * (z0c + 0.03)], [sx * 0.16, -0.07, s * (z0c + 0.03)], [sx * 0.16, -0.07, s * (z1c - 0.03)], [sx * 0.08, -0.07, s * (z1c - 0.03)]], 0.012, 6));
    P(`Solar array coupler (${side})`, {
      system: 'Power', material: 'Titanium spool carrying the array\'s electrical connectors; two gold-anodised EVA handles', mass: 6, temp: 285, explode: [0, 0.45, s * 0.25],
      desc: 'Where the wing\'s power leaves the array: its connectors and two gold-anodised handles stick out through the blanket, so a spacewalker can hold the wing and demate it. From here the two cable sets run down past the drive into the telescope.',
    }, [mesh(merge(coup), HM.ti()), mesh(merge(coupConn), HM.box()), mesh(merge(coupH), HM.kapton()), mesh(merge(pig), HM.powerCable())], pivot);
    const mast = [rod([0, 0, s * z1c], [0, 0, s * ROOT], 0.07, 20)];
    const hinge = [cylZ(0.085, 0, 0, s * (z1c + 0.14), 0.06, 24), new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12).translate(0, 0, s * (z1c + 0.14))];
    const mh = [];
    for (const sx of [-1, 1]) mh.push(...cablePath([[sx * 0.05, 0.05, s * (z1c + 0.22)], [sx * 0.05, 0.14, s * (z1c + 0.22)], [sx * 0.05, 0.14, s * (ROOT - 0.04)], [sx * 0.05, 0.05, s * (ROOT - 0.04)]], 0.011, 6));
    const dp = P(`Solar array mast (${side})`, {
      system: 'Power', material: 'M55J graphite-composite tube under MLI, with a hinge and two gold-anodised handles', mass: 12, temp: 270, explode: [0, 0.6, s * 0.4],
      desc: 'Carries the wing out from the drive. Graphite composite barely changes length between sunlight and shadow; the hinge folded the wing against its carrier for launch in the Shuttle. Length estimated.',
    }, [mesh(merge(mast), HM.mli(8)), mesh(merge(hinge), HM.ti()), mesh(merge(mh), HM.kapton())], pivot);

    // the wing: panel support structure and four panels, the outer pair folding back over the inner when stowed
    const wingRoot = new THREE.Group();
    wingRoot.position.set(0, 0, s * ROOT);
    pivot.add(wingRoot);
    const half = SA.wing / 2;
    const PW = SA.width / 2 - 0.02;          // each panel 1.28 m wide, 3.51 m long: two side by side per half
    const panels = (z0) => [-1, 1].map((sx) => new THREE.BoxGeometry(PW, 0.03, half - 0.04).translate(sx * (PW / 2 + 0.01), 0, s * (z0 + half / 2)));
    const frame = (z0) => {
      const f = [];
      const z1 = z0 + half - 0.04;
      for (const x of [-SA.width / 2, 0, SA.width / 2]) f.push(rod([x, -0.035, s * z0], [x, -0.035, s * z1], 0.022, 6));
      for (const z of [z0, (z0 + z1) / 2, z1]) f.push(rod([-SA.width / 2, -0.035, s * z], [SA.width / 2, -0.035, s * z], 0.018, 6));
      // three flexures per panel between the panel and the frame
      for (const sx of [-1, 1]) for (const z of [z0 + 0.35, (z0 + z1) / 2, z1 - 0.35]) f.push(new THREE.BoxGeometry(0.07, 0.03, 0.05).translate(sx * (z === (z0 + z1) / 2 ? SA.width / 2 - 0.05 : 0.05), -0.022, s * z));
      return f;
    };
    const mats = [HM.sa3Back(), HM.sa3Back(), HM.sa3Cells(), HM.sa3Back(), HM.sa3Back(), HM.sa3Back()];
    const inner = new THREE.Group();
    // root yoke: a hub on the mast tip and a spreader beam carrying the inner panels' root edge
    const yoke = [cylZ(0.1, 0, 0, 0, 0.14, 20)];
    yoke.push(new THREE.BoxGeometry(SA.width - 0.1, 0.06, 0.07).translate(0, -0.03, s * 0.045));
    for (const x of [-1, 1]) yoke.push(rod([0, -0.02, s * 0.03], [x * (SA.width / 2 - 0.15), -0.03, s * 0.06], 0.025, 6));
    const hingeG = new THREE.Group();
    hingeG.position.set(0, 0.04, s * (half + 0.02));
    const outer = new THREE.Group();
    outer.position.set(0, -0.04, -s * (half + 0.02));
    hingeG.add(outer);
    inner.add(hingeG);
    const track = new THREE.Group();          // sun-tracking rotation about the mast axis
    track.add(inner);
    wingRoot.add(track);
    const foldHinge = [rod([-SA.width / 2 + 0.1, 0.04, s * (half + 0.02)], [SA.width / 2 - 0.1, 0.04, s * (half + 0.02)], 0.03, 10)];
    const wp = P(`Solar array wing (${side})`, {
      system: 'Power', material: 'Aluminium-lithium X2096 panel support structure under MLI; hinges under silver-Teflon tape', mass: 290, massSource: 'NASA SM4 Media Guide (640 lb per wing)', temp: 330,
      explode: [0, 0, s * 1.6], xrayWeight: 0.5,
      desc: 'The third set of arrays (SA3), fitted in 2002: 7.1 × 2.6 m, rigid instead of the roll-up blankets that flexed and jittered the telescope as they crossed between sunlight and shadow. Twelve flexures, three per panel, let the frame swing between −70 °C and +86 °C every orbit without "snapping". ≈ 5.3 kW for both wings (5,270 W predicted at 6 years). Fold scheme in the deploy demo simplified.',
      callout: s > 0, anchor: [0.3, 0.4, s * 5.0],
    }, [mesh(merge([...frame(0.04), ...yoke]), HM.al()), mesh(merge(foldHinge), HM.ti())], track);
    // the wing part is the tracking group's child, so move the groups under it
    wp.add(inner);
    wp.userData.part.thermalRole = 'array';
    const panelInfo = (which) => ({
      system: 'Power', material: 'Two Iridium-design panels, each 1,000 gallium-arsenide-on-germanium cells on a Kapton face sheet over aluminium honeycomb; white Tedlar backs', count: 2, temp: 330, explode: [0, 0.5, 0], xrayWeight: 0.5,
      desc: `The ${which} pair of the wing's four panels, about 4.6 m² each. The white Tedlar backs radiate heat to space; the cells face the Sun. Part of the wing; mass included.`,
    });
    // one mesh per panel: the box keeps its face groups, so the cells show on the front only
    const ip = P(`SA3 solar panels, inner pair (${side})`, panelInfo('inner'), panels(0.04).map((g) => mesh(g, mats)), inner);
    ip.userData.part.thermalRole = 'array';
    const op = P(`SA3 solar panels, outer pair (${side})`, panelInfo('outer'), [...panels(half + 0.04).map((g) => mesh(g, mats)), mesh(merge(frame(half + 0.04)), HM.al())], outer);
    op.userData.part.thermalRole = 'array';
    out.arrays.push({ s, pivot, hinge: hingeG, track, drivePart: dp, wingPart: wp });
    // the pivot rides on the drive mechanism's part so the chain explodes with it
    body.add(pivot);

    // diode box beside the drive, and the two cable sets that run from the coupler down past the
    // drive and adapter into it, then into the shell
    const c = s > 0 ? 90 : 270;
    dba.push(new THREE.BoxGeometry(0.3, 0.12, 0.25).translate(6.75, RAD.shell + 0.06, 0).rotateX(deg(c)));
    for (const y of [-0.06, 0.06]) dbaDet.push(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10).rotateZ(Math.PI / 2).translate(6.59, RAD.shell + 0.06, y).rotateX(deg(c)), new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10).rotateZ(Math.PI / 2).translate(6.91, RAD.shell + 0.06, y).rotateX(deg(c)));
    for (const y of [-0.06, 0.06]) cables.push(...cablePath([[SA.x + 0.185, y, s * (Z_PIV - 0.04)], [SA.x + 0.185, y, s * (Z_SADM + 0.03)], [SA.x + 0.24, y, s * (Z_SADA + 0.045)], [6.56, y, s * (Z_SADA + 0.045)]], 0.013, 6));
    sadaPts.push(c);
  }
  P('Diode box assemblies (DBA-2)', {
    system: 'Power', material: 'Diode networks in boxes beside each wing\'s drive, one per wing', mass: 10, count: 2, temp: 290, explode: [0, 0, 0.9],
    desc: 'Diode networks steer the current from the array strings and keep a shaded or failed string from drawing power. New DBA-2 boxes went in with the SA3 wings on the first two spacewalks of 2002. Exact location unconfirmed; size estimated.',
  }, [mesh(merge(dba), HM.iridite()), mesh(merge(dbaDet), HM.box())]);
  P('Solar array drive cable sets', {
    system: 'Power', material: 'Two power cable sets per wing, from the coupler past the drive to the diode box', mass: 6, count: 4, temp: 285, explode: [0, 0, 0.7],
    desc: 'Two sets of cables and connectors carry each wing\'s power into the telescope, past the turning drive. From the diode box the current goes on to the power control unit in bay 4.',
  }, mesh(merge(cables), HM.powerCable()));

  // ------------------------------------------------------------------ high-gain antennas (±y)
  // the reflector as a closed shell 2.5 cm thick (front face, rim, back face), so it renders single-sided
  // and casts clean shadows onto itself; profile runs out along the back and returns along the front
  const DISH_T = 0.025, DN = 24;
  const sag = (r) => (r * r) / (4 * 0.42);
  const dishProfile = [];
  for (let i = 0; i <= DN; i++) { const r = (i / DN) * HGA.dish; dishProfile.push([r, sag(r) - DISH_T]); }
  for (let i = DN; i >= 0; i--) { const r = (i / DN) * HGA.dish; dishProfile.push([r, sag(r)]); }
  const Y1 = 0.11, Y2 = 0.13;                // outer axis above the mast tip; inner axis above the outer
  for (const s of [1, -1]) {
    const side = s > 0 ? '+V3' : '−V3';
    const base = [new THREE.BoxGeometry(0.5, 0.12, 0.34).translate(HGA.x, s * (RAD.shell + 0.05), 0)];
    base.push(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 16).rotateX(Math.PI / 2).translate(HGA.x, s * (RAD.shell + 0.14), 0));
    const pivot = new THREE.Group();
    pivot.position.set(HGA.x, s * (RAD.shell + 0.14), 0);
    pivot.add(mesh(merge([rod([0, 0, 0], [0, s * HGA.mast, 0], 0.065, 16), new THREE.CylinderGeometry(0.11, 0.11, 0.2, 16).rotateX(Math.PI / 2)]), HM.al()));
    // waveguide and cable run along the mast
    pivot.add(mesh(merge([rod([0.09, s * 0.15, 0.05], [0.09, s * (HGA.mast - 0.1), 0.05], 0.018, 6), rod([-0.08, s * 0.15, -0.05], [-0.08, s * (HGA.mast - 0.1), -0.05], 0.012, 6)]), HM.kapton()));
    const mp = P(`High-gain antenna mast (${side})`, {
      system: 'Communications', material: 'Aluminium/graphite boom with root deployment hinge, waveguide and cabling', mass: 30, temp: 255, explode: [2.5, s * 2.0, 0],
      desc: 'Holds its antenna clear of the telescope so the dish can see a TDRS relay over most of the sky. Latched flat along the forward shell and light shield for launch, it was swung out 90° by its hinge drive after release in 1990. Length estimated.',
    }, [mesh(merge(base), HM.al()), pivot]);
    const hd = [new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20).rotateX(Math.PI / 2).translate(HGA.x, s * (RAD.shell + 0.14), 0.32), new THREE.CylinderGeometry(0.025, 0.025, 0.04, 6).rotateX(Math.PI / 2).translate(HGA.x, s * (RAD.shell + 0.14), 0.44)];
    hd.push(new THREE.BoxGeometry(0.2, 0.1, 0.12).translate(HGA.x, s * (RAD.shell + 0.06), 0.3));
    P(`HGA mast hinge drive (${side})`, {
      system: 'Structure', material: 'Stepper-motor rotary drive actuator on the hinge line, hex fitting for manual drive', mass: 6, temp: 255, explode: [1.2, s * 0.6, 0.4],
      desc: 'One of Hubble\'s three hinge drives (two antenna masts and the aperture door), all the same rotary drive actuator. Each has a hex fitting so a spacewalker can crank it by hand if the motor fails.',
    }, mesh(merge(hd), HM.box()));
    const tip = new THREE.Group();
    tip.position.set(0, s * HGA.mast, 0);
    pivot.add(tip);
    const gimbal = new THREE.Group();          // deploy compensation; carries the outer-axis drive
    tip.add(gimbal);
    const ax1 = new THREE.Group();             // outer axis (about z)
    ax1.position.set(0, s * Y1, 0);
    gimbal.add(ax1);
    const g2 = new THREE.Group();              // inner axis (about x)
    g2.position.set(0, s * Y2, 0);
    ax1.add(g2);
    const dishG = new THREE.Group();           // dish geometry kept in the gimbal's frame
    dishG.position.set(0, -s * (Y1 + Y2), 0);
    g2.add(dishG);
    const dish = lathe(dishProfile, 48);
    if (s < 0) dish.rotateZ(Math.PI);
    dish.translate(0, s * 0.3, 0);
    // eight ribs following the back of the reflector shell
    const back = [];
    const backY = (r) => s * (0.3 + sag(r) - DISH_T - 0.014);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rs = [0.05, 0.2, 0.35, 0.48, 0.6];
      for (let i = 0; i < rs.length - 1; i++) back.push(rod([Math.cos(a) * rs[i], backY(rs[i]), Math.sin(a) * rs[i]], [Math.cos(a) * rs[i + 1], backY(rs[i + 1]), Math.sin(a) * rs[i + 1]], 0.012, 5));
    }
    back.push(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16).translate(0, s * (0.3 - DISH_T - 0.03), 0));   // hub on the gimbal
    // feed: the S-band horn 0.38 m in front of the vertex, its mouth toward the reflector, on a central
    // post from the vertex and braced by four symmetric struts from the dish face; a stiffening ring
    // round the rim. Built for the +V3 dish (opening toward +y) and turned over for the −V3 one.
    const FEED = 0.38, feedList = [
      rod([0, 0.3, 0], [0, 0.3 + FEED - 0.08, 0], 0.02, 10),                                                // central post
      new THREE.CylinderGeometry(0.035, 0.07, 0.14, 18).translate(0, 0.3 + FEED - 0.01, 0),               // horn, flaring toward the dish
      new THREE.CylinderGeometry(0.04, 0.04, 0.03, 18).translate(0, 0.3 + FEED + 0.07, 0),                // horn back / connector
      new THREE.TorusGeometry(HGA.dish - 0.005, 0.012, 6, 48).rotateX(Math.PI / 2).translate(0, 0.3 + sag(HGA.dish), 0),   // rim stiffener
    ];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, rs = HGA.dish * 0.78;
      feedList.push(rod([Math.cos(a) * rs, 0.3 + sag(rs) + 0.008, Math.sin(a) * rs], [0, 0.3 + FEED - 0.1, 0], 0.008, 5));
    }
    const feed = merge(feedList);
    if (s < 0) feed.rotateX(Math.PI);
    // RF line from the inner rotary joint into the hub behind the vertex; the central post carries it to the horn
    const rf = cablePath([[0.19, s * (Y1 + Y2), 0], [0.08, s * 0.22, 0], [0.02, s * (0.3 - DISH_T - 0.02), 0]], 0.008, 6);
    dishG.add(mesh(dish, HM.dishShell()), mesh(merge(back), HM.grEp()), mesh(feed, HM.al()), mesh(merge(rf), HM.kapton()));
    const hp = P(`High-gain antenna (${side})`, {
      system: 'Communications', material: 'Parabolic reflector of aluminium honeycomb with graphite-epoxy facesheets (General Electric), S-band feed horn 0.38 m in front of the vertex on a central post and four struts', mass: 28, temp: 250,
      explode: [0, s * 0.8, 0],
      desc: 'Steerable dish (≈1.3 m, estimated) that sends science data at 2255.5 or 2287.5 MHz (±10 MHz) to NASA\'s Tracking and Data Relay Satellites 36,000 km up, which relay it to White Sands. Its beam is just over 4° wide, so the gimbal aims it to within 1° as Hubble circles the Earth.',
      callout: s > 0, anchor: [0.4, s * 0.5, 0.4],
    }, gimbal, tip);
    // outer-axis drive: bracket on the mast tip, rotary drive actuator and rotary joint on the z axis
    const od = [new THREE.BoxGeometry(0.16, 0.06, 0.16).translate(0, s * 0.03, 0), new THREE.BoxGeometry(0.08, Y1, 0.05).translate(0, s * Y1 / 2, -0.12)];
    const odA = [new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20).rotateX(Math.PI / 2).translate(0, s * Y1, -0.24)];
    const odJ = [new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16).rotateX(Math.PI / 2).translate(0, s * Y1, 0.1)];
    const odRF = cablePath([[0.09, -s * 0.1, 0.05], [0.09, s * 0.04, 0.05], [0.03, s * Y1, 0.14]], 0.009, 6);
    P(`HGA outer-axis drive (${side})`, {
      system: 'Communications', material: 'Rotary drive actuator (stepper motor) with an RF rotary joint', mass: 6, temp: 255, explode: [0, s * 0.25, -0.3],
      desc: 'The first of the gimbal\'s two axes. Its stepper-motor actuator swings the dish up to 100° either way, and a rotary joint carries the S-band signal across the turning axis, so the transmitter in bay 5 stays wired straight through to a dish that never stops moving.',
    }, [mesh(merge(od), HM.al()), mesh(merge(odA), HM.box()), mesh(merge(odJ), HM.ti()), mesh(merge(odRF), HM.kapton())], gimbal);
    // inner-axis drive on the outer axis: yoke, actuator and rotary joint on the x axis
    const id = [new THREE.BoxGeometry(0.32, 0.05, 0.12).translate(0, s * 0.03, 0)];
    for (const sx of [-1, 1]) id.push(new THREE.BoxGeometry(0.03, Y2 + 0.04, 0.1).translate(sx * 0.13, s * (Y2 / 2 + 0.02), 0));
    const idA = [new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20).rotateZ(Math.PI / 2).translate(-0.25, s * Y2, 0)];
    const idJ = [new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16).rotateZ(Math.PI / 2).translate(0.19, s * Y2, 0)];
    const idRF = cablePath([[0.03, 0, 0.14], [0.17, s * 0.04, 0.1], [0.23, s * Y2, 0.04]], 0.009, 6);
    P(`HGA inner-axis drive (${side})`, {
      system: 'Communications', material: 'Yoke with a rotary drive actuator and an RF rotary joint', mass: 6, temp: 255, explode: [0, s * 0.45, 0.3],
      desc: 'The second gimbal axis, at right angles to the first: together they aim the dish anywhere in a wide cone, to within 1° of a TDRS satellite. The second rotary joint passes the signal on to the feed.',
    }, [mesh(merge(id), HM.al()), mesh(merge(idA), HM.box()), mesh(merge(idJ), HM.ti()), mesh(merge(idRF), HM.kapton())], ax1);
    out.hgas.push({ s, pivot, gimbal, ax1, g2, mastPart: mp, dishPart: hp });
  }

  // ------------------------------------------------------------------ low-gain antennas
  // conical log-spiral antennas: a blunt 0.26 m cone on a 0.2 m base housing with the two spiral arms
  // wound round it. Built along +y with the base at the origin, then turned to look along ±x.
  const lga = (dir) => {
    const body = [new THREE.CylinderGeometry(0.1, 0.1, 0.07, 24).translate(0, 0.035, 0), new THREE.CylinderGeometry(0.03, 0.1, 0.26, 24, 1, false).translate(0, 0.2, 0), new THREE.SphereGeometry(0.03, 12, 8).translate(0, 0.33, 0)];
    const arms = [];
    for (const off of [0, Math.PI]) {
      const pts = [];
      for (let i = 0; i <= 36; i++) { const u = i / 36, rr = 0.104 - 0.072 * u, a = off + u * Math.PI * 5; pts.push([Math.cos(a) * rr, 0.075 + 0.245 * u, Math.sin(a) * rr]); }
      arms.push(...cablePath(pts, 0.006, 5));
    }
    const rz = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    return { body: merge(body).rotateZ(rz), arms: merge(arms).rotateZ(rz) };
  };
  const LGA_PHI = deg(200), LGA_X = ST.front - 0.22, LGA_R = RAD.shell + 0.3;
  const fwd = lga(1);
  for (const g of [fwd.body, fwd.arms]) g.translate(LGA_X, ...az(LGA_PHI, LGA_R).slice(1));
  // boom from a bracket on the light shield skin, with a diagonal brace aft of it
  const boom = [radialBox(LGA_PHI, RAD.shell + 0.035, LGA_X, { radial: 0.05, tangential: 0.18, axialLen: 0.32 }),
    rod(az(LGA_PHI, RAD.shell + 0.05, LGA_X), az(LGA_PHI, LGA_R, LGA_X), 0.025, 10),
    rod(az(LGA_PHI, RAD.shell + 0.05, LGA_X - 0.3), az(LGA_PHI, LGA_R - 0.04, LGA_X), 0.012, 6),
    radialBox(LGA_PHI, RAD.shell + 0.035, LGA_X - 0.3, { radial: 0.05, tangential: 0.1, axialLen: 0.1 })];
  P('Low-gain antenna (forward)', {
    system: 'Communications', material: 'Conical log-spiral antenna (two copper arms on a cone in a dark radome) on a short boom off the light shield', mass: 4, temp: 245, explode: [1.6, -0.6, 0],
    desc: 'One of two spiral-cone antennas (2.1–2.3 GHz), this one on the light shield looking forward. Between them they see almost the whole sky: every command sent to Hubble arrives through them, and they keep a link alive if the telescope loses attitude.',
  }, [mesh(fwd.body, HM.radome()), mesh(fwd.arms, HM.copper()), mesh(merge(boom), HM.al())]);
  const aft = lga(-1);
  for (const g of [aft.body, aft.arms]) g.translate(-0.02, ...az(deg(270), 1.75).slice(1));
  P('Low-gain antenna (aft)', {
    system: 'Communications', material: 'Conical log-spiral antenna on the aft bulkhead', mass: 4, temp: 255, explode: [-3.8, 0, -0.6],
    desc: 'The aft-looking twin on the aft bulkhead, set 180° from the forward antenna; between them the two cover nearly the whole sky at low data rates through the multiple-access transponders.',
  }, [mesh(aft.body, HM.radome()), mesh(aft.arms, HM.copper())]);

  // ------------------------------------------------------------------ magnetic torquer bars (forward shell, 90° apart)
  const MT0 = 6.3, MT1 = MT0 + 2.5;
  for (const [n, c] of [[1, 45], [2, 135], [3, 225], [4, 315]]) {
    const p = deg(c);
    const bar = [rod(az(p, RAD.shell + 0.15, MT0), az(p, RAD.shell + 0.15, MT1), 0.045, 16)];
    for (const x of [MT0 + 0.1, MT1 - 0.1]) bar.push(new THREE.BoxGeometry(0.14, 0.16, 0.16).translate(0, RAD.shell + 0.08, 0).rotateX(p).translate(x, 0, 0));
    for (const x of [MT0, MT1]) bar.push(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateZ(Math.PI / 2).translate(x, 0, 0).translate(0, ...az(p, RAD.shell + 0.15).slice(1)));
    P(`Magnetic torquer bar ${n}`, {
      system: 'Attitude control', material: 'Ferromagnetic-core electromagnet with redundant windings, 2.5 m long', mass: 45, massSource: 'NASA SM3A Media Guide (100 lb)', temp: 255,
      explode: az(p, 0.9, 0.3), desc: 'One of four bars on the forward shell. Driven against the Earth\'s magnetic field, it bleeds off the momentum the reaction wheels build up from gravity-gradient and aerodynamic torques, and can hold attitude in a contingency. Hubble carries no thrusters at all.',
    }, mesh(merge(bar), HM.mtb()));
  }

  // ------------------------------------------------------------------ magnetometers and coarse sun sensors
  const mss = [];
  for (const c of [70, 290]) {
    const p = deg(c);
    mss.push(rod(az(p, RAD.shell, 12.6), az(p, RAD.shell + 0.3, 12.6), 0.02, 8));
    mss.push(new THREE.BoxGeometry(0.14, 0.12, 0.12).translate(0, RAD.shell + 0.36, 0).rotateX(p).translate(12.6, 0, 0));
  }
  P('Magnetometers', {
    system: 'Attitude control', material: 'Two three-axis fluxgate magnetic sensing systems', mass: 6, count: 2, temp: 245, explode: [1.4, 0.3, 0],
    desc: 'Measure the strength and direction of the Earth\'s field so the torquer bars can be driven in the right direction. Mounted near the front of the light shield, away from the electronics.',
  }, mesh(merge(mss), HM.iridite()));
  const cssGeo = (list) => {
    const g = [];
    for (const [x, r, c] of list) {
      const p = deg(c);
      g.push(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16).translate(0, r + 0.03, 0).rotateX(p).translate(x, 0, 0));
      g.push(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, r + 0.06, 0).rotateX(p).translate(x, 0, 0));
    }
    return merge(g);
  };
  P('Coarse sun sensors (forward)', {
    system: 'Attitude control', material: 'Silicon photodiode sensors', mass: 2, count: 2, temp: 250, explode: [0.8, 0, 0],
    desc: 'Two of Hubble\'s five coarse sun sensors, near the aperture. They always know roughly where the Sun is, and if it comes within 35° of the optical axis they start the aperture door closing.',
  }, mesh(cssGeo([[ST.front - 0.2, RAD.shell, 110], [ST.front - 0.2, RAD.shell, 250]]), HM.box()));
  P('Coarse sun sensors (aft)', {
    system: 'Attitude control', material: 'Silicon photodiode sensors', mass: 3, count: 3, temp: 262, explode: [-1.6, -4.0, 0],
    desc: 'The other three sun sensors, on the aft shroud. Together the five fix the initial attitude after deployment and guide the safe mode that turns the solar arrays toward the Sun when something goes wrong. Positions approximate.',
  }, mesh(cssGeo([[0.85, RAD.big, 20], [0.85, RAD.big, 180], [0.85, RAD.big, 340]]), HM.box()));

  // ------------------------------------------------------------------ wiring: forward trunk, array power, RF
  // trunk bundles from the equipment section's forward ring harness to the light-shield hardware:
  // inside the forward shell, then in the gap between the light shield's liner and skin, outside the
  // stray-light baffles
  const XJ = ST.fwdShell - 0.05, XG = ST.fwdShell + 0.1;
  const hz = [];
  for (const c of [62, 118, 242, 298]) {
    hz.push(...cablePath([az(deg(c), 1.68, 4.98), az(deg(c), 1.485, ST.equip + 0.02), az(deg(c), 1.485, XJ), az(deg(c), RAD.gap, XG), az(deg(c), RAD.gap, 12.6)], 0.016, 6));
  }
  P('Forward harness trunk', {
    system: 'Electrical', material: 'Shielded copper wiring bundles and connectors', mass: 60, temp: 285, explode: [0, 0, 0], xrayWeight: 0.4,
    desc: 'Four bundles leave the equipment section\'s forward ring harness and run up the inside of the forward shell, then between the light shield\'s black liner and its skin, clear of the baffles, to the torquer bars, magnetometers, sun sensors and the forward low-gain antenna. Hubble carries kilometres of wire through hundreds of connectors. Routing simplified.',
  }, mesh(merge(hz), HM.harness()));

  // array power: each wing's diode box → into the shell → aft along the forward shell → round the
  // equipment section to the power control unit in bay 4, passing the battery bays 2 and 3
  const arc = (list, r, x, a0, a1, rr = 0.02, step = 15) => {
    const n = Math.max(1, Math.round(Math.abs(a1 - a0) / step));
    for (let i = 0; i < n; i++) list.push(rod(az(deg(a0 + ((a1 - a0) * i) / n), r, x), az(deg(a0 + ((a1 - a0) * (i + 1)) / n), r, x), rr, 6));
  };
  const pw = [];
  for (const c of [90, 270]) pw.push(...cablePath([az(deg(c), RAD.shell + 0.06, 6.93), az(deg(c), 1.485, 6.95), az(deg(c), 1.485, 5.02), az(deg(c), 1.6, 4.98)], 0.024, 6));
  arc(pw, 1.6, 4.98, 90, 225, 0.024);
  arc(pw, 1.6, 4.98, 270, 225, 0.024);
  pw.push(rod(az(deg(225), 1.6, 4.98), az(deg(225), 1.6, 4.82), 0.024, 6));
  for (const c of [165, 195]) pw.push(rod(az(deg(c), 1.6, 4.98), az(deg(c), 1.62, 4.9), 0.02, 6));
  P('Solar array power harness', {
    system: 'Power', material: 'Heavy-gauge copper power cables', mass: 40, temp: 285, explode: [0, 0, 0], xrayWeight: 0.5,
    desc: 'Carries each wing\'s current from its diode box into the forward shell, aft and round the equipment section to the power control unit in bay 4, past the battery modules in bays 2 and 3. The arrays recharge the six batteries after every ~36-minute eclipse, through each battery\'s charge current controller. Routing simplified.',
  }, mesh(merge(pw), HM.powerCable()));

  // RF: the transmitters and transponders in bay 5 → coax to both high-gain antennas and waveguide to the low-gain antennas
  const rf = [];
  const B5 = 285;
  rf.push(rod(az(deg(B5), 1.62, 4.62), az(deg(B5), 1.62, 4.88), 0.016, 6));
  arc(rf, 1.62, 4.88, B5, 360, 0.016);
  arc(rf, 1.62, 4.88, B5, 180, 0.016);
  for (const c of [0, 180]) rf.push(rod(az(deg(c), 1.62, 4.88), az(deg(c), 1.47, 5.05), 0.016, 6), rod(az(deg(c), 1.47, 5.05), az(deg(c), 1.47, HGA.x), 0.016, 6), rod(az(deg(c), 1.47, HGA.x), az(deg(c), RAD.shell + 0.05, HGA.x), 0.016, 6));
  rf.push(...cablePath([az(deg(200), 1.62, 4.88), az(deg(200), 1.47, 5.05), az(deg(200), 1.47, XJ), az(deg(200), RAD.gap, XG), az(deg(200), RAD.gap, ST.front - 0.15), az(deg(200), RAD.shell + 0.1, ST.front - 0.15)], 0.014, 6));   // forward LGA, outside the baffles
  rf.push(rod(az(deg(297), 1.62, 4.88), az(deg(297), 1.62, 3.62), 0.016, 6), rod(az(deg(297), 1.62, 3.62), az(deg(297), 1.9, 3.5), 0.016, 6), rod(az(deg(297), 1.9, 3.5), az(deg(297), 1.9, 0.3), 0.016, 6), rod(az(deg(297), 1.9, 0.3), az(deg(270), 1.75, 0.08), 0.016, 6));
  P('RF cables & waveguide', {
    system: 'Communications', material: 'Low-loss S-band coaxial cable and waveguide, with RF transfer switches', mass: 20, temp: 280, explode: [0, 0, 0], xrayWeight: 0.6,
    desc: 'Links the transmitters and transponders in bay 5 to the two high-gain antennas (up their masts through the gimbals\' rotary joints) and, by waveguide, to the forward and aft low-gain antennas, so any radio can reach any antenna. Routing simplified.',
  }, mesh(merge(rf), HM.kapton()));

  return out;
}
