// F-22A propulsion: caret inlets with boundary-layer bleed, serpentine ducts, and two Pratt &
// Whitney F119-PW-100 engines broken into their modules (3-stage fan, 6-stage HP compressor,
// annular combustor, single-stage HP and LP turbines on counter-rotating spools, augmentor) with
// 2-D convergent–divergent pitch-vectoring nozzles.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { M } from '../../engine/materials.js';
import { plumeMaterial, plumeMesh } from '../../engine/effects.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, bladeRow, latheX, hinge, toothedGrid, rectTube } from './util.js';

const { X, lerp, EM } = FR;
const SM = FR.M;              // fuselage station map (FR.M; the name M is the shared materials here)

const mirrorPts = (ring) => ring.map((p) => [p[0], p[1], -p[2]]).reverse();

export function buildPropulsion(ctx) {
  const { P, anim } = ctx;
  const D = FR.ductRings();
  const cowlRings = FR.COWL_TAUS.map((t) => FR.cowlRing(t));
  const iSplit = D.st.findIndex((s) => s != null && s >= SM(9.4));
  anim.turbine = M.turbineGlow().clone();
  anim.plumes = [];

  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const sideRings = (rings) => (side > 0 ? rings : rings.map(mirrorPts));
    const zc = FR.ENG_Z * side, yc = FR.ENG_Y;

    // ---------------------------------------------------------------- caret inlet cowl and lip
    const cowl = FR.gridSurface(sideRings(cowlRings), { closed: true });
    const lipBand = FR.gridSurface(sideRings([D.lip, D.inner]), { closed: true, uv: 'n' });
    const c = P(`Caret inlet cowl (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite cowl, RAM-lined lips', mass: 140,
      explode: [1.0, -0.55, 1.7 * side], callout: side > 0, anchor: [X(5.95), -0.3, 1.72 * side],
      desc: 'A fixed-geometry caret inlet: the top and outer lips are both swept, so each makes an oblique shock that slows supersonic air with little loss, and their edges line up with the wing and chines. A narrow slot at the inboard wall separates the inlet from the fuselage boundary layer.',
    }, mesh(merge([cowl, lipBand]), F.skin()));
    c.userData.part.thermalRole = 'leadingEdge';

    // ---------------------------------------------------------------- inlet duct, bleed and S-duct
    const fwd = sideRings(D.rings.slice(0, iSplit + 1));
    const aft = sideRings(D.rings.slice(iSplit));
    // perforated bleed regions on the upper and inboard walls of the compression surfaces, from the lip
    // to the throat, standing 4 mm off the duct wall toward its centre line
    const perf = [];
    {
      const ringsP = sideRings(D.rings.slice(0, D.st.findIndex((x) => x != null && x >= SM(8.0)) + 1));
      const inset = (r) => {
        let cz = 0, cy = 0; for (const p of r) { cz += p[2]; cy += p[1]; } cz /= r.length; cy /= r.length;
        return r.map((p) => { const dz = cz - p[2], dy = cy - p[1], L = Math.hypot(dz, dy) || 1; return [p[0], p[1] + (dy / L) * 0.004, p[2] + (dz / L) * 0.004]; });
      };
      const sub = (j0, j1) => ringsP.map((r) => inset(r).slice(j0, j1 + 1));
      const n = ringsP[0].length;
      perf.push(FR.gridSurface(sub(0, 4)), FR.gridSurface(sub(n - 6, n - 1)));
    }
    const bl = [];
    // bleed plenum behind the inboard wall (between the forebody side and the duct, clear of the forward-fuselage
    // frame at 6.2 and of the throat, whose inboard wall moves inboard behind it), with a short exit duct up into the
    // fuel coolers' cooling-air duct from the diverter, so the bled air leaves with the coolers' air through their
    // exhaust grille on the spine (the production bleed exit is not published; early aircraft had inlet bleed
    // doors, which T.O. 00-105E-9 says were eliminated from aircraft 02-028 on)
    const pl0 = 6.25, pl1 = 6.6, yPl = -0.2;
    let zPl = 9;
    for (const sv of [pl0, (pl0 + pl1) / 2, pl1]) { let zz = 0.05; while (zz < 1.5 && FR.ductDepth(sv, yPl, zz) < -0.07) zz += 0.01; zPl = Math.min(zPl, zz - 0.065); }
    bl.push(new THREE.BoxGeometry(pl1 - pl0, 0.4, 0.09).translate(X((pl0 + pl1) / 2), yPl, side * zPl));
    bl.push(FR.pipe([[6.38, yPl + 0.18, side * zPl], [6.38, yPl + 0.215, side * (zPl + 0.015)], [6.38, yPl + 0.235, side * 0.775]], 0.03, 8, 6));
    P(`Inlet throat & boundary-layer bleed (${R})`, {
      system: 'Propulsion', material: 'Composite duct, perforated titanium bleed panels', mass: 110,
      explode: [0.55, -0.35, 1.25 * side],
      desc: 'From the lip back to the throat the upper and inboard compression surfaces are perforated: slow, low-energy boundary-layer air is sucked off through thousands of small holes so the engine sees uniform flow. It is fixed bleed — there are no moving ramps in a caret inlet.',
    }, [mesh(FR.gridSurface(fwd, { closed: true, uv: 'n' }), F.duct()), mesh(merge(perf), F.perforated())]);
    P(`Inlet bleed plenum & exit duct (${R})`, {
      system: 'Propulsion', material: 'Composite plenum and duct', mass: 14,
      explode: [0.9, 0.35, 1.5 * side],
      desc: 'The bleed air collects in a plenum behind the perforated wall, between the forebody side and the duct, and a short duct passes it into the fuel coolers\' cooling-air duct, so it leaves with their air through the exhaust grille on the spine behind the canopy (exit arrangement not published; routing approximate).',
    }, mesh(merge(bl), F.ductDark()));
    {
      // fixed exit grilles on the spine behind the cockpit: the air-cooled fuel coolers' exhaust (T.O. 00-105E-9 top
      // panel map, "ACFC exhaust doors" #4236 right / #4235 left), a saw-toothed frame with slats across it
      const AC = FR.ACFC, s0 = AC.s0, s1 = AC.s1;
      const pt = (s, u) => { const z = side * lerp(AC.z0, AC.z1, u); return [X(s), FR.topAt(s, Math.abs(z)) + 0.003, z]; };
      const frame = slab(toothedGrid(pt, [s0, (s0 + s1) / 2, s1], { width: AC.z1 - AC.z0 }), () => [0, -0.015, 0], new THREE.Vector3(0, 1, 0));
      const slats = [];
      for (let k = 1; k < 9; k++) {
        const s = lerp(s0 + 0.05, s1 - 0.05, k / 9);
        const za = AC.z0 + 0.03, zb = AC.z1 - 0.03;
        const ya = FR.topAt(s, za) - 0.004, yb = FR.topAt(s, zb) - 0.004;
        const len = Math.hypot(zb - za, yb - ya);
        slats.push(new THREE.BoxGeometry(0.012, 0.02, len).rotateX(Math.atan2(yb - ya, zb - za) * side).translate(X(s), (ya + yb) / 2 - 0.004, side * (za + zb) / 2));
      }
      P(`Fuel-cooler exhaust grille (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite grille frame with angled slats, saw-tooth edges', mass: 4,
        explode: [0.3, 1.6, 1.5 * side],
        desc: 'Fixed grilles on the spine just behind the canopy let out the air that has passed through the air-cooled fuel coolers beneath them (T.O. 00-105E-9 calls them the ACFC exhaust doors); the model also leads the inlet bleed out here, which is an assumption. The T.O. notes that the inlet bleed doors of early aircraft were eliminated from aircraft 02-028 on.',
      }, [mesh(frame, F.door()), mesh(merge(slats), F.ductDark())]);
    }
    P(`Serpentine inlet duct (${R})`, {
      system: 'Propulsion', material: 'Composite duct with radar-absorbent lining', mass: 160,
      explode: [0, -0.15, 1.0 * side], callout: side > 0, anchor: [X(SM(10.6)), FR.ductSpan(SM(10.6), 0.6).hi, 0.6 * side],
      desc: 'From the caret inlet the duct climbs and swings inboard over the weapons bay, then turns back down and outboard onto the engine, about 6 m in all (Lockheed Martin gives its length as 6.35 diameters). The serpentine ducts keep the fan faces — normally the brightest radar reflectors on a jet — out of line of sight from any exterior view, and an absorbent lining soaks up energy that bounces in. The real duct shape is not published; the model\'s is solved so that no straight line from outside reaches its fan face.',
    }, mesh(FR.gridSurface(aft, { closed: true, uv: 'n' }), F.duct()));
    {
      // bypass (spill) doors on the upper fuselage over the ducts' crossover, either side of the refuelling receptacle:
      // three louvre panels each side (FR.BYPASS), each over a short plenum off the duct's roof
      const BP = FR.BYPASS, n = 3, gapZ = 0.02, wz = (BP.z1 - BP.z0 - (n - 1) * gapZ) / n;
      anim.bypass = anim.bypass || [];
      const pivots = [], plen = [];
      for (let k = 0; k < n; k++) {
        const za = BP.z0 + k * (wz + gapZ), zb = za + wz;
        const pt = (s, u) => { const z = side * lerp(za, zb, u); return [X(s), FR.topAt(s, Math.abs(z)) + 0.003, z]; };
        const door = slab(toothedGrid(pt, [BP.s0, (BP.s0 + BP.s1) / 2, BP.s1], { width: wz }), () => [0, -0.02, 0], new THREE.Vector3(0, 1, 0));
        const hd = hinge(mesh(door, F.door()), new THREE.Vector3(X(BP.s1), FR.topAt(BP.s1, za), side * za), new THREE.Vector3(X(BP.s1), FR.topAt(BP.s1, zb), side * zb), new THREE.Vector3(X(BP.s0), 0.6, side * (za + zb) / 2), new THREE.Vector3(0, 1, 0));
        anim.bypass.push(hd);
        pivots.push(hd.pivot);
      }
      P(`Inlet bypass door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite louvre doors with saw-tooth edges, hydraulically actuated', mass: 9, count: 3,
        explode: [-0.2, 1.75, 1.2 * side],
        desc: 'When the engine needs less air than the fixed caret inlet captures, these louvre doors on the upper fuselage over the duct open to spill the surplus overboard, keeping the inlet shock system stable instead of letting it buzz (T.O. 00-105E-9 shows them either side of the refuelling receptacle). It matters at the Mach 1.5-plus the F-22 cruises at on dry power.',
      }, pivots);
      // plenum: a collar on the duct's roof under the doors, up to the door opening
      const roof = (sv, zz) => { const sp = FR.ductSpan(sv, zz); return sp ? sp.hi : FR.topAt(sv, zz) - 0.12; };
      const fs = [BP.s0 + 0.08, BP.s1 - 0.08], fz = [BP.z0 + 0.06, BP.z1 - 0.12], ms = [BP.s0 + 0.05, BP.s1 - 0.05], mz = [BP.z0 + 0.03, BP.z1 - 0.03];
      const loop = (sa, za, f) => {
        const out = [];
        for (let k = 0; k < 6; k++) out.push(f(lerp(sa[0], sa[1], k / 6), za[0]));
        for (let k = 0; k < 4; k++) out.push(f(sa[1], lerp(za[0], za[1], k / 4)));
        for (let k = 0; k < 6; k++) out.push(f(lerp(sa[1], sa[0], k / 6), za[1]));
        for (let k = 0; k < 4; k++) out.push(f(sa[0], lerp(za[1], za[0], k / 4)));
        return out;
      };
      const foot = loop(fs, fz, (sv, zz) => [X(sv), roof(sv, zz) + 0.008, side * zz]);
      const mouth = loop(ms, mz, (sv, zz) => [X(sv), FR.topAt(sv, zz) - 0.024, side * zz]);
      plen.push(FR.gridSurface([foot, mouth], { closed: true, uv: 'n' }));
      P(`Inlet bypass duct (${R})`, {
        system: 'Propulsion', material: 'Composite plenum off the top of the S-duct', mass: 10,
        explode: [-0.2, 1.25, 1.35 * side],
        desc: 'A short plenum taps the roof of the serpentine duct where it crosses over toward the engine and leads straight up to the bypass doors, so spilled air leaves before it reaches the engine (plenum shape approximate).',
      }, mesh(merge(plen), F.duct()));
    }

    // ---------------------------------------------------------------- F119 fan
    const E = FR.F119;
    const tor = (r, t, s0, seg = 40) => new THREE.TorusGeometry(r, t, 6, seg).rotateY(Math.PI / 2).translate(X(s0), yc, zc);
    {
      const g = [];
      g.push(latheX([[0.001, EM(13.12)], [0.09, EM(13.2)], [0.15, EM(13.32)], [0.18, EM(13.45)], [0.2, EM(13.6)], [0.214, EM(13.8)], [0.226, EM(13.9)], [0.229, EM(14.05)]], yc, zc, 28));   // spinner and blisk drum: every blade root sits on it
      const rot = [[EM(13.5), 20, 0.18, 0.47, 0.16], [EM(13.72), 26, 0.2, 0.44, 0.13], [EM(13.92), 32, 0.22, 0.42, 0.11]];
      for (const [s, n, h, t, ch] of rot) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: ch, twist: 0.75, thick: 0.014 }));
      // a stator row behind each rotor
      for (const [s, n, h, t] of [[EM(13.61), 36, 0.2, 0.47], [EM(13.82), 40, 0.21, 0.44], [EM(14.02), 44, 0.22, 0.42]]) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: 0.07, twist: -0.35, thick: 0.01 }));
      const blades = merge(g);
      const cas = FR.cylX(EM(13.74), yc, zc, 0.76, 0.49, 0.48, 40, true);       // fan-case liner over the blade tips
      const fan = P(`F119 fan (${R})`, {
        system: 'Propulsion', material: 'Hollow wide-chord titanium blades linear-friction-welded to their discs (blisks), Alloy C stators', mass: 480,
        explode: [1.3, 0.55, 0.45 * side], callout: side > 0, anchor: [X(EM(13.62)), yc + 0.4, zc],
        desc: 'Three shroudless fan stages driven by the single-stage LP turbine, each a blisk: hollow wide-chord titanium blades linear-friction-welded to their disc, with Alloy C stator rows between. The fan face is 38 in (0.97 m) across, and with a bypass ratio of 0.30 about 23 % of the air flows around the core (blade counts illustrative; the whole F119 weighs about 2,270 kg).',
      }, [mesh(blades, F.blade()), mesh(cas, F.tiDull())]);
      fan.userData.part.thermalRole = 'fan';
      fan.userData.part.xrayWeight = 0.45;
      // variable inlet guide vanes: one row ahead of the first rotor, each vane on a spindle through the
      // case, all turned together by a unison ring and its actuator
      const igv = [bladeRow({ x: X(EM(13.4)), y: yc, z: zc, count: 22, rHub: 0.15, rTip: 0.48, chord: 0.06, twist: -0.2, thick: 0.012 })];
      const ring = [tor(0.505, 0.012, EM(13.4), 44)];
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        ring.push(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 5).translate(0, 0.49, 0).rotateX(a).translate(X(EM(13.4)), yc, zc));
      }
      // actuator under the case driving the ring through a bellcrank
      ring.push(FR.cylX(EM(13.6), yc - 0.53, zc + side * 0.12, 0.26, 0.022, 0.022, 10));
      ring.push(FR.pipe([[EM(13.46), yc - 0.53, zc + side * 0.12], [EM(13.41), yc - 0.505, zc + side * 0.1]], 0.008, 5, 2));
      const ig = P(`F119 variable inlet guide vanes (${R})`, {
        system: 'Propulsion', material: 'Burn-resistant titanium (Alloy C) vanes on spindles, unison ring and actuator', mass: 30,
        explode: [1.75, 0.3, 0.45 * side],
        desc: 'The first row of vanes is variable: a unison ring round the case, moved by a FADEC-controlled actuator, turns all 22 vanes together to set the angle at which air meets the first fan rotor, which widens the stall and surge margin (vane count illustrative).',
      }, [mesh(igv[0], F.blade()), mesh(merge(ring), F.steel())]);
      ig.userData.part.thermalRole = 'fan';
      ig.userData.part.xrayWeight = 0.5;
    }
    // ---------------------------------------------------------------- outer case and bypass duct
    {
      const c = [];
      c.push(FR.cylX(EM(13.76), yc, zc, 0.78, E.rCase, E.rCase, 44, true));                  // fan case
      c.push(FR.cylX(EM(14.9), yc, zc, 1.5, E.rCase, E.rCase - 0.01, 44, true));               // bypass duct outer wall
      for (const s0 of [EM(13.38), EM(14.15)]) c.push(tor(E.rCase + 0.012, 0.02, s0, 44));            // case flanges
      c.push(tor(E.rCase - 0.01, 0.018, EM(15.62), 44));
      const core = latheX([[0.33, EM(14.14)], [0.345, EM(14.6)], [0.37, EM(14.9)], [0.38, EM(15.3)], [0.39, EM(15.62)]], yc, zc, 36);
      // fan frame: radial struts across the bypass duct carry the front bearing and the core
      const st = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        st.push(new THREE.BoxGeometry(0.1, E.rCase - 0.34, 0.025).translate(0, (E.rCase + 0.34) / 2, 0).rotateX(a).translate(X(EM(14.17)), yc, zc));
      }
      const cs = P(`F119 bypass duct & outer case (${R})`, {
        system: 'Propulsion', skin: true, material: 'Burn-resistant titanium (Alloy C) case, axially split for maintenance', mass: 260,
        explode: [0.7, 1.75, 0.95 * side],
        desc: 'The outer case is 48 in (1.22 m) across. Between it and the core cowl runs the bypass duct, which carries cool fan air past the hot core to the augmentor and nozzle. The case splits along its length, so modules can be changed without pulling the whole engine apart (drawn faint in X-ray so the core shows).',
      }, [mesh(merge([...c, ...st]), F.tiDull()), mesh(core, F.hot())]);
      cs.userData.part.thermalRole = 'fan';
      cs.userData.part.xrayWeight = 0.5;
    }
    // ---------------------------------------------------------------- HP compressor
    {
      const g = [];
      for (let k = 0; k < 6; k++) {
        const s = EM(14.2) + k * 0.1;
        const tip = lerp(0.3, 0.245, k / 5), hub = lerp(0.19, 0.215, k / 5);
        g.push(bladeRow({ x: X(s), y: yc, z: zc, count: 36 + k * 6, rHub: hub, rTip: tip, chord: 0.055, twist: 0.55, thick: 0.008 }));
        g.push(bladeRow({ x: X(s + 0.05), y: yc, z: zc, count: 44 + k * 6, rHub: hub + 0.005, rTip: tip, chord: 0.035, twist: -0.4, thick: 0.006 }));
      }
      g.push(latheX([[0.19, EM(14.15)], [0.205, EM(14.5)], [0.215, EM(14.82)]], yc, zc, 24));
      const cas = latheX([[0.32, EM(14.12)], [0.3, EM(14.45)], [0.27, EM(14.82)]], yc, zc, 32);
      const hpc = P(`F119 HP compressor (${R})`, {
        system: 'Propulsion', material: 'Titanium and nickel blisks, burn-resistant Alloy C stators', mass: 300,
        explode: [0.6, 0.55, 0.55 * side],
        desc: 'Six stages (the F100 needed ten) raise the core pressure so that the whole engine reaches an overall pressure ratio of about 26:1. Its stators are a burn-resistant titanium alloy, because a titanium fire in a compressor can otherwise sustain itself.',
      }, [mesh(merge(g), F.blade()), mesh(cas, F.tiDull())]);
      hpc.userData.part.thermalRole = 'compressor';
      hpc.userData.part.xrayWeight = 0.35;
    }
    // ---------------------------------------------------------------- shafts and bearings
    {
      const g = [FR.cylX(EM(14.55) - 0.06, yc, zc, 2.22, 0.05, 0.05, 12)];                  // LP shaft: fan hub ↔ LP turbine
      g.push(FR.cylX(EM(14.75), yc, zc, 1.2, 0.11, 0.115, 16, true));                         // HP spool drum
      const b = [];
      for (const [s0, r] of [[EM(13.48), 0.08], [EM(14.12), 0.09], [EM(14.86), 0.14], [EM(15.38), 0.13], [EM(15.58), 0.09]]) {
        b.push(tor(r, 0.025, s0, 18));
        b.push(FR.cylX(s0, yc, zc, 0.06, r + 0.03, r + 0.03, 18, true));
      }
      P(`F119 shafts & bearings (${R})`, {
        system: 'Propulsion', material: 'Steel / nickel shafts, M50 rolling-element bearings in oil-wetted sumps', mass: 120,
        explode: [0.3, -0.75, 0.4 * side],
        desc: 'Two concentric spools: a slim LP shaft runs inside the HP drum from the LP turbine to the fan, and the two turn in opposite directions. Five bearings (the one between the turbines is an intershaft bearing) sit in sealed sumps fed by the lube system (bearing count approximate).',
      }, [mesh(merge(g), F.steel()), mesh(merge(b), F.brass())]);
    }
    // ---------------------------------------------------------------- combustor
    {
      const ann = latheX([[0.22, EM(14.9)], [0.24, EM(14.86)], [0.31, EM(14.86)], [0.335, EM(14.9)], [0.34, EM(15.2)], [0.21, EM(15.2)], [0.205, EM(14.95)], [0.22, EM(14.9)]], yc, zc, 36);
      const noz = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        noz.push(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6).rotateZ(Math.PI / 2).translate(X(EM(14.83)), yc + Math.cos(a) * 0.275, zc + Math.sin(a) * 0.275));
      }
      noz.push(tor(0.3, 0.012, EM(14.79), 36));                                                  // fuel manifold
      const comb = P(`F119 annular combustor (${R})`, {
        system: 'Propulsion', material: 'Floatwall liner of cooled high-cobalt alloy panels', mass: 140,
        explode: [0.1, 0.6, 0.6 * side],
        desc: 'A short annular combustor fed by a ring of fuel injectors from a manifold (count illustrative). Its Floatwall liner is made of separate, air-cooled panels with no welds, so thermal cycling cannot start cracks at weld seams; it burns cleanly with little smoke.',
      }, [mesh(ann, F.inconel()), mesh(merge(noz), F.brass())]);
      comb.userData.part.thermalRole = 'combustor';
    }
    // ---------------------------------------------------------------- HP and LP turbines
    {
      const g = [bladeRow({ x: X(EM(15.24)), y: yc, z: zc, count: 36, rHub: 0.22, rTip: 0.33, chord: 0.05, twist: -0.7, thick: 0.012 })];
      g.push(bladeRow({ x: X(EM(15.32)), y: yc, z: zc, count: 52, rHub: 0.225, rTip: 0.335, chord: 0.045, twist: 0.8, thick: 0.01 }));
      g.push(FR.cylX(EM(15.33), yc, zc, 0.07, 0.228, 0.228, 28));                               // rotor disc: blade roots sit on its rim
      g.push(latheX([[0.21, EM(15.2)], [0.223, EM(15.2) + 0.015], [0.223, EM(15.24) + 0.035]], yc, zc, 28));   // vane inner shroud, carried on the combustor's inner liner
      const hpt = P(`F119 HP turbine (${R})`, {
        system: 'Propulsion', material: 'Single-crystal nickel superalloy blades, impingement cooled', mass: 170,
        explode: [-0.4, 0.6, 0.6 * side],
        desc: 'One stage of single-crystal blades drives the six-stage compressor. The gas reaching it is around 1,900 K (about 3,000 °F), hotter than the alloy can survive, so compressor air is blown through each hollow blade and out of tiny holes as a protective film.',
      }, mesh(merge(g), F.bladeHot()));
      hpt.userData.part.thermalRole = 'turbine';
      hpt.userData.part.xrayWeight = 0.4;
      // the vanes between the turbines hang from the turbine case (tips reach the case wall) and carry an inner shroud
      const l = [bladeRow({ x: X(EM(15.42)), y: yc, z: zc, count: 40, rHub: 0.225, rTip: 0.381, chord: 0.05, twist: -0.6, thick: 0.012 })];
      l.push(FR.cylX(EM(15.42), yc, zc, 0.055, 0.228, 0.228, 28, true));
      l.push(bladeRow({ x: X(EM(15.51)), y: yc, z: zc, count: 60, rHub: 0.23, rTip: 0.365, chord: 0.045, twist: -0.85, thick: 0.01 }));
      l.push(FR.cylX(EM(15.52), yc, zc, 0.06, 0.233, 0.233, 28));                               // rotor disc
      const lpt = P(`F119 LP turbine (${R})`, {
        system: 'Propulsion', material: 'Nickel superalloy', mass: 150,
        explode: [-0.8, 0.6, 0.6 * side],
        desc: 'A single LP stage turns the three-stage fan through the LP shaft. The two spools spin in opposite directions, which cancels much of their gyroscopic moment when the jet manoeuvres hard (the vanes between the turbines were kept).',
      }, mesh(merge(l), F.bladeHot()));
      lpt.userData.part.thermalRole = 'turbine';
      lpt.userData.part.xrayWeight = 0.4;
    }
    // ---------------------------------------------------------------- augmentor
    {
      const g = [];
      // thick, curved radial vanes with the fuel injectors built in (they replace spray bars and
      // V-gutter flameholders, and hide the turbine); three fuel-zone manifolds feed them
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.push(new THREE.BoxGeometry(0.24, 0.29, 0.05).rotateY(0.45).rotateX(a).translate(X(EM(15.7)), yc + Math.cos(a) * 0.36, zc + Math.sin(a) * 0.36));
      }
      g.push(latheX([[0.215, EM(15.58)], [0.2, EM(15.75)], [0.14, EM(15.95)], [0.06, EM(16.12)], [0.001, EM(16.2)]], yc, zc, 24));
      for (const r of [0.26, 0.36, 0.46]) g.push(tor(r, 0.014, EM(15.84), 36));
      // the augmentor duct tapers toward the nozzle (≈ 1.15 m → 0.98 m), so it fits between the booms
      const liner = latheX([[0.535, EM(15.64)], [0.525, EM(16.0)], [0.49, EM(16.5)], [0.46, EM(16.9)], [0.455, EM(17.25)]], yc, zc, 40);
      const outer = latheX(FR.F119_AUG, yc, zc, 40);
      const aug = P(`F119 augmentor (${R})`, {
        system: 'Propulsion', material: 'Nickel / cobalt alloys, ceramic RAM-coated vanes, perforated cooling liner', mass: 380,
        explode: [-1.3, 0.55, 0.6 * side],
        desc: 'The three-zone afterburner lifts thrust from about 116 kN dry to the 156 kN class. Instead of spray bars and V-gutters, fuel is injected from thick curved vanes coated with radar-absorbent ceramic, which also hold the flame and block any view of the turbine (vane count illustrative); a perforated liner keeps bypass air between flame and casing.',
      }, [mesh(merge([...g, outer]), F.hot()), mesh(liner, F.liner())]);
      aug.userData.part.thermalRole = 'augmentor';
      aug.userData.part.xrayWeight = 0.45;
      const glow = mesh(new THREE.CircleGeometry(0.45, 32).rotateY(-Math.PI / 2).translate(X(EM(17.2)), yc, zc), anim.turbine, { cast: false });
      glow.userData.fx = true;
      aug.add(glow);
    }
    // ---------------------------------------------------------------- 2-D vectoring nozzle
    // the nozzle ends at s 16.5 between the tail booms (NAWDC top and bottom views: chevron trailing edges at
    // 16.25–16.65), ahead of the stinger and the boom ends; its upper and lower external flaps start where the full
    // aft-fuselage section ends (S_BE) and close the top and bottom between the boom and the stinger
    {
      const sx = (s) => X(s);
      const NW = 0.5;                       // half width between the sidewalls
      const S_EXIT = EM(18.52), S_THR = EM(17.96), S_CONV = EM(17.72), S_EXT = FR.S_BE;
      // fixed: transition duct (round → rectangular) and sidewalls
      const tr = [];
      for (const [s, k, w, h] of [[EM(17.22), 2, 0.99, 0.99], [EM(17.4), 2.6, 0.99, 0.94], [EM(17.55), 3.6, 0.98, 0.8], [S_CONV, 6, 0.96, 0.66]]) tr.push(FR.superRing(sx(s), zc, yc, w, h, 28, k));
      const trans = FR.gridSurface(tr, { closed: true, uv: 'n' });
      const walls = [];
      const w0 = EM(17.5), w1 = EM(18.45);
      for (const dz of [-NW, NW]) {
        const grid = [];
        for (const s of [w0, lerp(w0, w1, 0.33), lerp(w0, w1, 0.66), w1]) {
          const t = (s - w0) / (w1 - w0);
          const top = yc + lerp(0.58, 0.32, t), bot = yc + lerp(-0.58, -0.31, t);
          grid.push([[sx(s), top, zc + dz], [sx(s), bot, zc + dz]]);
        }
        walls.push(slab(grid, () => [0, 0, dz > 0 ? -0.04 : 0.04], new THREE.Vector3(0, 0, Math.sign(dz))));
      }
      // fixed convergent flaps set the throat; the divergent (vectoring) flaps swing about the throat;
      // the external flaps hinge at their front edges and follow. Trailing edges are saw-toothed.
      const fw = NW - 0.04;
      const flapPts = (sgn, s0, s1, y0, y1, cut) => toothedGrid((s, u) => [sx(s), yc + sgn * lerp(y0, y1, (s - s0) / (s1 - s0)), zc + lerp(-fw, fw, u)],
        cut ? [s0, lerp(s0, s1, 0.33), lerp(s0, s1, 0.66), s1] : [s0, s1], { width: 2 * fw, fore: false, aft: cut, cut: true });
      const conv = (sgn) => slab(flapPts(sgn, S_CONV, S_THR, 0.32, 0.21, false), () => [0, sgn * 0.035, 0]);
      const div = (sgn) => slab(flapPts(sgn, S_THR, S_EXIT, 0.21, 0.25, true), () => [0, sgn * 0.035, 0]);
      const throat = new THREE.Vector3(sx(S_THR), yc, zc);
      const pivot = new THREE.Group();
      pivot.position.copy(throat);
      const inner = new THREE.Group();
      inner.position.copy(throat).multiplyScalar(-1);
      pivot.add(inner);
      inner.add(mesh(merge([div(1), div(-1)]), F.nozzleIn()));
      // plume (effect)
      const pm = plumeMaterial({ core: 0xfff3d6, outer: 0xff6a20, diamonds: 1.2 });
      const plume = plumeMesh(0.3, 0.12, 6.5, pm);
      plume.rotation.z = -Math.PI / 2;
      plume.scale.set(1, 1, 1.5);
      plume.position.set(sx(S_EXIT + 0.03), yc, zc);
      const core = plumeMesh(0.2, 0.05, 3.2, plumeMaterial({ core: 0xffffff, outer: 0x9fb8ff, diamonds: 2 }));
      core.rotation.z = -Math.PI / 2;
      core.scale.set(1, 1, 1.45);
      core.position.copy(plume.position);
      inner.add(plume, core);
      anim.plumes.push(pm, core.material);
      // external flaps: the upper one starts on the aft deck (its leading edge follows the deck's own curve), the
      // lower one on the flat bottom; both close to the divergent flaps' trailing edges
      const ext = (sgn) => {
        const yLE = (z) => (sgn > 0 ? FR.upperB(S_EXT, Math.abs(z)) - 0.004 : -FR.bD(S_EXT) + 0.004);
        const yTE = yc + sgn * 0.3;
        const front = new THREE.Vector3(sx(S_EXT), yLE(zc), zc);
        const p = new THREE.Group();
        p.position.copy(front);
        const g = new THREE.Group();
        g.position.copy(front).multiplyScalar(-1);
        p.add(g);
        const grid = toothedGrid((s, u) => {
          const t = (s - S_EXT) / (S_EXIT - S_EXT), z = zc + lerp(-NW - 0.01, NW + 0.01, u);
          return [sx(s), lerp(yLE(z), yTE, t) + sgn * 0.035 * Math.sin(Math.PI * Math.min(1, t)) * t, z];
        }, [0, 1, 2, 3, 4, 5, 6].map((k) => lerp(S_EXT, S_EXIT, k / 6)), { width: 2 * NW + 0.02, fore: false, cut: true });
        g.add(mesh(slab(grid, () => [0, -sgn * 0.035, 0], new THREE.Vector3(0, sgn, 0)), F.wing()));
        return p;
      };
      const extU = ext(1), extL = ext(-1);
      anim.tvc.push({ pivot, extU, extL });
      const tp = P(`Nozzle transition duct & sidewalls (${R})`, {
        system: 'Propulsion', material: 'Burn-resistant titanium (Alloy C) and nickel alloy, ceramic-coated hot walls', mass: 170,
        explode: [-2.2, 0.75, 0.85 * side],
        desc: 'The fixed part of the 2-D nozzle: a transition duct that turns the round augmentor exit into a rectangle, and flat sidewalls 1.0 m apart that carry the flap hinges. The nozzle ends between the tail booms, which, with the flat sides and the rectangular exit, shield the hot turbine from view.',
      }, [mesh(trans, F.nozzleIn()), mesh(merge(walls), F.nozzle())]);
      tp.userData.part.thermalRole = 'nozzle';
      const cv = P(`Nozzle convergent flaps (${R})`, {
        system: 'Propulsion', material: 'Cooled nickel-alloy flaps', mass: 70,
        explode: [-2.45, -0.75, 0.85 * side],
        desc: 'Upper and lower convergent flaps squeeze the flow down to the throat, the narrowest point, where it reaches the speed of sound. The throat area is fully variable: it opens up for afterburner, when the hotter, larger-volume gas needs more room.',
      }, mesh(merge([conv(1), conv(-1)]), F.nozzleIn()));
      cv.userData.part.thermalRole = 'nozzle';
      const dv = P(`Nozzle divergent (vectoring) flaps (${R})`, {
        system: 'Propulsion', material: 'Burn-resistant titanium (Alloy C) and nickel flaps, saw-tooth trailing edges', mass: 150,
        explode: [-3.1, 0.3, 0.85 * side], callout: side > 0, anchor: [X(S_EXIT - 0.2), yc + 0.27, zc],
        desc: 'Two wedge-shaped divergent flaps let the supersonic jet expand after the throat, and swing it ±20° in pitch to give pitch control even when the tail has too little airflow to bite. They also flatten the plume so it mixes and cools faster, cutting the infrared signature.',
      }, pivot);
      dv.userData.part.thermalRole = 'nozzle';
      const ex = P(`Nozzle external flaps (${R})`, {
        system: 'Propulsion', material: 'Composite / titanium outer flaps, saw-tooth trailing edges', mass: 60,
        explode: [-2.8, 0.95, 1.05 * side],
        desc: 'The long outer flaps above and below hinge at their front edges, where the aft deck and the belly end, and follow the divergent flaps, keeping the outer mould line smooth; their serrated trailing edges match the planform angles.',
      }, [extU, extL]);
      ex.userData.part.thermalRole = 'nozzle';
      // nozzle actuators: two above and two below, between the convergent flaps and the external flaps,
      // each with a supply and return line from the engine
      const acts = [], lines = [];
      for (const dz of [-0.28, 0.28]) {
        for (const y of [0.4, -0.42]) {
          acts.push(new THREE.CylinderGeometry(0.03, 0.026, 0.27, 10).rotateZ(Math.PI / 2).translate(sx(EM(17.815)), yc + y, zc + dz));
          acts.push(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8).rotateZ(Math.PI / 2).translate(sx(EM(18.0)), yc + y * 0.93, zc + dz));
          const r0 = Math.sign(y) * 0.585;
          lines.push(FR.pipe([[EM(15.0), yc + r0 * 0.98, zc + dz * 0.6], [EM(16.4), yc + r0 * 0.94, zc + dz * 0.8], [EM(17.3), yc + Math.sign(y) * 0.5, zc + dz], [EM(17.68), yc + y + Math.sign(y) * 0.02, zc + dz]], 0.008, 5, 16));
        }
      }
      P(`Nozzle actuators (${R})`, {
        system: 'Propulsion', material: 'Linear actuators with supply and return lines along the augmentor case (working fluid not published)', mass: 50, count: 4,
        explode: [-2.2, -0.45, 1.25 * side],
        desc: 'Four linear actuators move the flaps together to set throat and exit areas, and differentially to vector the jet, on FADEC command. Lines along the augmentor case bring their working fluid from the engine; whether the F119 uses fuel or hydraulic fluid for this is not published, so treat the plumbing as approximate.',
      }, [mesh(merge(acts), F.hyd()), mesh(merge(lines), F.pipe())]);
    }
    // ---------------------------------------------------------------- gearbox, AMAD, engine fuel, lube, ignition, mounts
    // Under the front of each engine (T.O. 00-105E-9 bottom panel map: AMAD bay screens at ≈ 11.3–11.7 and the air
    // turbine starter's exhaust screens at ≈ 12.0–12.4, inboard of the main-gear wells): the airframe-mounted
    // accessory drive (FR.AMAD) with the generator on its front face and the starter and hydraulic pumps on its aft
    // face, and behind it the engine's own gearbox, joined to it by the power take-off shaft
    {
      const AM = FR.AMAD, az = AM.z * side, ay = AM.y;
      // engine-mounted gearbox under the fan case's aft end, driven by a radial tower shaft from the HP spool
      const G0 = 12.2, G1 = 12.7, gy = -0.79, gm = (G0 + G1) / 2;
      const g = [];
      g.push(new THREE.BoxGeometry(G1 - G0, 0.11, 0.34).translate(X(gm), gy, zc));
      g.push(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12).translate(X(12.36), gy + 0.11, zc));             // tower-shaft housing up into the case
      for (const s of [12.3, 12.58]) g.push(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 12).rotateX(Math.PI / 2).translate(X(s), gy, zc - side * 0.19));   // drive pads on the inboard face
      g.push(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateZ(Math.PI / 2).translate(X(G0 - 0.02), gy - 0.02, zc));   // PTO pad on the front face
      P(`F119 accessory gearbox (${R})`, {
        system: 'Propulsion', material: 'Aluminium / magnesium gear case, steel gears, mounted under the fan case', mass: 55,
        explode: [0.2, -0.95, 0.55 * side],
        desc: 'The engine-mounted gearbox takes power off the HP spool through a radial tower shaft and drives the engine\'s own fuel, augmentor and lube pumps; a power take-off pad on its front face drives the shaft forward to the airframe gearbox.',
      }, mesh(merge(g), F.boxLight()));
      // power take-off shaft forward to the AMAD, with flexible diaphragm couplings at both ends
      const pA = new THREE.Vector3(X(G0 - 0.04), gy - 0.02, zc), pB = new THREE.Vector3(X(AM.s1 + 0.02), ay - 0.01, az);
      const sh = [FR.pipe([[G0 - 0.04, pA.y, pA.z], [(G0 + AM.s1) / 2, (pA.y + pB.y) / 2, (pA.z + pB.z) / 2], [AM.s1 + 0.02, pB.y, pB.z]], 0.026, 10, 4)];
      for (const q of [pA, pB]) sh.push(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 14).rotateZ(Math.PI / 2).translate(q.x, q.y, q.z));
      P(`Power take-off shaft (${R})`, {
        system: 'Propulsion', material: 'Steel shaft with flexible diaphragm couplings', mass: 6,
        explode: [0.45, -1.35, 0.95 * side],
        desc: 'A short, fast-turning shaft carries engine power out of the engine to the airframe-mounted accessory drive just ahead of it; its flexible couplings let the engine grow and move on its mounts without loading the gearboxes. During a start, power flows the other way along it to spin the engine up.',
      }, mesh(merge(sh), F.steel()));
      const am = [new THREE.BoxGeometry(AM.s1 - AM.s0, AM.h, AM.w).translate(X((AM.s0 + AM.s1) / 2), ay, az)];
      for (const s of [AM.s0 + 0.03, AM.s1 - 0.03]) am.push(new THREE.BoxGeometry(0.05, AM.h + 0.03, AM.w + 0.03).translate(X(s), ay, az));   // mounting faces
      am.push(FR.cylX((AM.s0 + AM.s1) / 2, ay + AM.h / 2 + 0.03, az, 0.1, 0.03, 0.03, 10));                      // oil filler / breather
      // air turbine starter on the aft face, inboard, its exhaust down to the screens in the belly
      const st = [FR.cylX(AM.s1 + 0.11, ay - 0.01, az - side * 0.15, 0.22, 0.07, 0.065, 14)];
      st.push(FR.pipe([[AM.s1 + 0.2, ay - 0.04, az - side * 0.15], [AM.s1 + 0.27, ay - 0.08, az - side * 0.15], [AM.s1 + 0.3, -FR.bD(AM.s1 + 0.3) + 0.03, az - side * 0.15]], 0.045, 10, 6));
      P(`Airframe-mounted accessory drive (${R})`, {
        system: 'Propulsion', material: 'AMAD: aluminium gear case, steel gears, own lube system; air turbine starter on its aft face', mass: 45,
        explode: [0.3, -0.55, 1.55 * side],
        desc: 'The AMAD is the airframe gearbox under the front of the engine: it turns this side\'s 270 V DC generator (forward face) and the engine-driven hydraulic pumps (aft face), and its air turbine starter, blown by the APU, spins the engine for a start; the T.O. shows its cooling screens and the starter\'s exhaust screens in the belly. If one fails, that side loses hydraulic and electrical power; every F-22 AMAD is validated on a single depot test stand at Hill AFB.',
      }, [mesh(merge(am), F.boxLight()), mesh(merge(st), F.tiDull())]);

      const f = [];
      // on the gearbox's front face, either side of the PTO pad
      f.push(new THREE.BoxGeometry(0.12, 0.1, 0.12).translate(X(G0 - 0.06), gy - 0.005, zc + side * 0.12));       // main fuel pump
      f.push(new THREE.BoxGeometry(0.12, 0.1, 0.11).translate(X(G0 - 0.06), gy - 0.005, zc - side * 0.12));      // fuel metering unit
      f.push(FR.pipe([[G0 - 0.06, gy + 0.05, zc - side * 0.12], [G0 + 0.1, -0.715, zc - side * 0.2], [12.85, -0.66, zc - side * 0.22], [EM(14.72), yc - 0.48, zc - side * 0.14], [EM(14.79), yc - 0.3, zc - side * 0.03]], 0.016, 6, 24));
      P(`Engine fuel pump & metering unit (${R})`, {
        system: 'Propulsion', material: 'Gear-driven high-pressure pump, FADEC-controlled metering unit', mass: 40,
        explode: [0.9, -1.15, 0.65 * side],
        desc: 'On the front of the engine gearbox: the main fuel pump raises the fuel delivered by the airframe boost pumps to injection pressure, and the metering unit, set by the FADEC, meters it to the combustor\'s fuel manifold. The same fuel first cools the engine oil.',
      }, mesh(merge(f), F.boxLight()));
      const a = [];
      a.push(FR.cylX(G1 + 0.11, gy, zc, 0.22, 0.065, 0.065, 14));                                                 // augmentor pump on the gearbox's aft face
      a.push(FR.pipe([[G1 + 0.22, gy, zc], [13.2, yc - 0.635, zc + side * 0.05], [EM(15.55), yc - 0.6, zc + side * 0.05], [EM(15.75), yc - 0.56, zc]], 0.018, 6, 20));
      a.push(tor(0.556, 0.012, EM(15.75), 40));                                                  // zone manifold in the case / liner gap
      for (let k = 0; k < 3; k++) { const ang = Math.PI + (k - 1) * 0.5; a.push(FR.pipe([[EM(15.75), yc + Math.cos(ang) * 0.556, zc + Math.sin(ang) * 0.556 * side], [EM(15.8), yc + Math.cos(ang) * 0.48, zc + Math.sin(ang) * 0.48 * side]], 0.01, 5, 2)); }
      P(`Augmentor fuel pump & zone manifolds (${R})`, {
        system: 'Propulsion', material: 'Centrifugal augmentor pump, three-zone fuel manifolds', mass: 30,
        explode: [-0.7, -1.2, 0.8 * side],
        desc: 'A separate pump on the back of the engine gearbox supplies the afterburner, whose demand is several times the dry flow. Fuel goes to three zones lit in sequence as the throttle moves through the afterburner range, feeding the injectors inside the curved augmentor vanes.',
      }, mesh(merge(a), F.pipe()));
      const o = [];
      const oy = yc + 0.58, oz = zc - side * 0.33;
      o.push(new THREE.CapsuleGeometry(0.065, 0.28, 4, 12).rotateZ(Math.PI / 2).translate(X(EM(13.95)), oy, oz));
      o.push(new THREE.BoxGeometry(0.12, 0.08, 0.1).translate(X(EM(13.62)), oy - 0.06, oz + side * 0.04));      // lube pump / filter
      o.push(FR.pipe([[EM(13.7), oy - 0.04, oz], [EM(13.55), yc + 0.32, zc - side * 0.18], [EM(13.5), yc + 0.12, zc - side * 0.07]], 0.012, 5));
      o.push(FR.pipe([[EM(14.1), oy - 0.04, oz], [EM(14.6), yc + 0.5, zc - side * 0.3], [EM(15.2), yc + 0.44, zc - side * 0.2], [EM(15.38), yc + 0.2, zc - side * 0.08]], 0.012, 5));
      P(`Oil tank & lube system (${R})`, {
        system: 'Propulsion', material: 'Aluminium oil tank, lube and scavenge pumps, fuel-cooled oil cooler', mass: 25,
        explode: [0.4, 1.25, -0.5 * side],
        desc: 'A self-contained lubrication system: a tank on the upper fan case, a pump and filter, and lines to the bearing sumps; scavenge pumps return the oil through a cooler that dumps its heat into the fuel (T.O. 00-105E-9: about 6 US gal of oil per jet; position approximate).',
      }, mesh(merge(o), F.boxLight()));
      const ig = [];
      const ex = [EM(14.5), yc - 0.42, zc + side * 0.3];                         // on the case's lower outboard side, inside the bay's fire-loop envelope
      ig.push(new THREE.BoxGeometry(0.22, 0.1, 0.12).translate(X(ex[0]), ex[1], ex[2]));
      for (const ang of [-2.2, -1.2]) {
        const py = yc + Math.cos(ang) * 0.34, pz = zc + Math.sin(ang) * 0.34 * -side;
        ig.push(FR.pipe([[ex[0] + 0.1, ex[1], ex[2]], [EM(14.85), yc + Math.cos(ang) * 0.5, zc + Math.sin(ang) * 0.5 * -side], [EM(14.95), py, pz]], 0.008, 5));
        ig.push(FR.cylX(EM(14.95), py, pz, 0.05, 0.014, 0.014, 6));
      }
      P(`Ignition exciters & igniters (${R})`, {
        system: 'Propulsion', material: 'Capacitor-discharge exciter, shielded leads, two igniter plugs', mass: 8,
        explode: [0.0, -1.45, 0.75 * side],
        desc: 'A high-energy capacitor-discharge exciter fires two igniter plugs in the combustor for starting and relight; the FADEC switches them on automatically if it senses a flame-out.',
      }, mesh(merge(ig), F.copper()));

      // mounts: forward trunnions either side of the fan case on the engine-bay frame (FR.ENGINE_MOUNTS: the
      // wing's mid titanium spar station), inboard into the keel web and outboard into the titanium boom; an aft
      // link at the augmentor up to the rear engine-bay frame lets the hot engine grow in length
      const EMT = FR.ENGINE_MOUNTS, m = [];
      const sF = EMT.fwd, sA = EMT.aft;
      m.push(FR.pipe([[sF, yc, zc + side * (E.rCase + 0.005)], [sF, yc, side * (EMT.boomZ - 0.005)]], 0.032, 8, 2));   // outboard trunnion to the boom
      m.push(FR.pipe([[sF, yc, zc - side * (E.rCase + 0.005)], [sF, yc, side * 0.022]], 0.03, 8, 2));                  // inboard trunnion to the keel
      for (const zz of [zc + side * (E.rCase + 0.03), side * (EMT.boomZ - 0.04), zc - side * (E.rCase + 0.025)]) m.push(new THREE.BoxGeometry(0.07, 0.11, 0.05).translate(X(sF), yc, zz));   // (not proud of the frame's forward face, the main well's aft wall)
      const ra = FR.mono(FR.F119_AUG.map(([r, s]) => [s, r]), sA), a45 = Math.PI / 4;
      const pa = [sA, yc + ra * Math.cos(a45) + 0.005, zc + side * ra * Math.sin(a45)];
      m.push(FR.pipe([pa, [sA, EMT.aftY, zc + side * 0.3]], 0.024, 6, 2));
      m.push(new THREE.BoxGeometry(0.08, 0.05, 0.12).translate(X(sA), EMT.aftY, zc + side * 0.3));
      P(`Engine mounts (${R})`, {
        system: 'Propulsion', material: 'Steel trunnions and links, titanium fittings', mass: 35,
        explode: [0.2, 1.0, 0.7 * side],
        desc: 'Trunnions either side of the fan case take thrust and vertical loads into the engine-bay structure — the keel web inboard and the titanium boom outboard — and an aft link at the augmentor, up to the rear engine-bay frame, lets the hot engine grow in length as it heats up. The engine drops out downward for change (arrangement approximate).',
      }, mesh(merge(m), F.steel()));
      // dual-channel FADEC on the lower outboard side of the case, with its harness up the side and along the case
      const th = side > 0 ? 0.542 : Math.PI - 0.542;
      const fy = yc - 0.33, fz = zc + side * 0.55;
      const fd = [new THREE.BoxGeometry(0.4, 0.2, 0.08).rotateX(th).translate(X(EM(14.75)), fy, fz)];
      fd.push(FR.pipe([[EM(14.55), fy + 0.06, fz], [EM(14.4), yc - 0.12, zc + side * 0.61], [EM(14.0), yc, zc + side * 0.61]], 0.012, 5));
      // colour-coded harnesses along the case from the FADEC, and the engine's own sensors
      {
        const hz = zc + side * 0.61, hz2 = zc + side * 0.56;
        const blue = [FR.pipe([[EM(14.55), fy + 0.02, fz], [EM(14.35), yc - 0.14, hz], [EM(13.9), yc - 0.13, hz], [EM(13.45), yc - 0.12, hz]], 0.011, 6, 16)];
        const orange = [FR.pipe([[EM(14.95), fy, fz], [EM(15.2), yc - 0.38, hz2], [EM(15.6), yc - 0.36, zc + side * 0.53]], 0.011, 6, 12)];
        const green = [FR.pipe([[EM(14.6), fy - 0.05, fz], [EM(14.45), yc - 0.5, zc + side * 0.42], [EM(14.3), yc - 0.6, zc + side * 0.18], [12.5, gy + 0.06, zc + side * 0.12]], 0.01, 6, 12)];
        const sens = [];
        // fan-inlet temperature / pressure probes (T2 / P2) through the case at the fan face
        for (const a of [0.6, 2.4]) sens.push(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6).translate(0, 0.45, 0).rotateX(a * side).translate(X(EM(13.39)), yc, zc));
        // N1 / N2 speed pickups on the gearbox
        for (const dz of [-0.2, 0.2]) sens.push(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8).rotateX(Math.PI / 2).translate(X(12.45), gy, zc + dz));
        // turbine-exhaust thermocouples: a ring of probes and their harness at the LP turbine exit
        sens.push(tor(0.555, 0.008, EM(15.6), 40));
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sens.push(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5).translate(0, 0.46, 0).rotateX(a).translate(X(EM(15.6)), yc, zc)); }
        P(`F119 harnesses & sensors (${R})`, {
          system: 'Propulsion', material: 'Colour-coded shielded harnesses, thermocouples, pressure and speed sensors', mass: 14, xrayWeight: 0.6,
          explode: [0.5, -0.25, 1.35 * side],
          desc: 'Harnesses from the FADEC to the fan-inlet temperature and pressure probes, the N1 / N2 speed pickups on the gearbox, the ring of turbine-exhaust thermocouples, igniters and actuators. They are colour-coded, part of a design that lets the F119 be serviced with just five hand tools.',
        }, [mesh(merge(blue), F.wireBlue()), mesh(merge(orange), F.wireOrange()), mesh(merge(green), F.wireGreen()), mesh(merge(sens), F.probe())]);
      }
      P(`FADEC engine control (${R})`, {
        system: 'Propulsion', material: 'Dual-redundant digital engine controller (Hamilton Standard), fuel cooled', mass: 18,
        explode: [0.0, 0.5, 1.15 * side],
        desc: 'Full-authority digital engine control: two independent channels schedule fuel flow, variable vanes, nozzle area and vectoring, and talk directly to the vehicle-management computers, which makes the F119 stall-resistant and tolerant of slamming the throttles.',
      }, mesh(merge(fd), F.box()));
    }
  }
}
