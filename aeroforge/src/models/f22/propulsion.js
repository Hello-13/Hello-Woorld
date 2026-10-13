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
import { merge, slab, bladeRow, latheX } from './util.js';

const { X, lerp, mono } = FR;

const mirrorPts = (ring) => ring.map((p) => [p[0], p[1], -p[2]]).reverse();

/** Duct liner rings (right side): the lip ring shrunk by the lip thickness, then the S-duct. */
function ductRings() {
  const lip = FR.cowlRing(0);
  const n = lip.length;
  let cz = 0, cy = 0;
  for (const p of lip) { cz += p[2]; cy += p[1]; }
  cz /= n; cy /= n;
  const inner = lip.map((p) => {
    const dz = p[2] - cz, dy = p[1] - cy, L = Math.hypot(dz, dy) || 1;
    const k = Math.max(0, 1 - 0.04 / L);
    return [p[0] - 0.03, cy + dy * k, cz + dz * k];
  });
  const rel = inner.map((p) => [p[2] - cz, p[1] - cy]);
  const ang = rel.map(([dz, dy]) => Math.atan2(dy, dz));
  const w0 = Math.max(...rel.map((r) => r[0])) - Math.min(...rel.map((r) => r[0]));
  const h0 = Math.max(...rel.map((r) => r[1])) - Math.min(...rel.map((r) => r[1]));
  const col = (c) => FR.DUCT.map((row) => [row[0], row[c]]);
  const cols = [1, 2, 3, 4, 5].map(col);
  const rings = [inner];
  const st = [];
  for (let s = FR.DUCT[0][0]; s < FR.FAN_S - 0.01; s += 0.22) st.push(s);
  st.push(FR.FAN_S);
  for (const s of st) {
    const [zc, yc, w, h, r] = cols.map((k) => mono(k, s));
    rings.push(rel.map(([dz, dy], j) => {
      const a = ang[j];
      const e = [Math.cos(a) * w / 2, Math.sin(a) * h / 2];
      const l = [(dz * w) / w0, (dy * h) / h0];
      return [X(s), yc + lerp(l[1], e[1], r), zc + lerp(l[0], e[0], r)];
    }));
  }
  return { lip, inner, rings, st: [null, ...st] };
}

export function buildPropulsion(ctx) {
  const { P, anim } = ctx;
  const D = ductRings();
  const cowlRings = FR.COWL_TAUS.map((t) => FR.cowlRing(t));
  const iSplit = D.st.findIndex((s) => s != null && s >= 9.4);
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
      explode: [1.0, -0.55, 1.7 * side], callout: side > 0, anchor: [X(7.03), -0.25, 1.75 * side],
      desc: 'A fixed-geometry caret inlet: the top and outer lips are both swept, so each makes an oblique shock that slows supersonic air with little loss, and their edges line up with the wing and chines. A narrow slot at the inboard wall separates the inlet from the fuselage boundary layer.',
    }, [mesh(cowl, F.skin()), mesh(lipBand, F.skin())]);
    c.userData.part.thermalRole = 'leadingEdge';

    // ---------------------------------------------------------------- inlet duct, bleed and S-duct
    const fwd = sideRings(D.rings.slice(0, iSplit + 1));
    const aft = sideRings(D.rings.slice(iSplit));
    const bleed = [];
    // porous bleed panel on the inboard duct wall and the plenum behind it
    for (let k = 0; k < 6; k++) {
      const s = 7.75 + k * 0.14;
      bleed.push(new THREE.BoxGeometry(0.1, 0.36, 0.03).translate(X(s), -0.32 + k * 0.035, side * (FR.aW(s) + 0.035)));
    }
    bleed.push(new THREE.BoxGeometry(0.9, 0.42, 0.1).translate(X(8.15), -0.18, side * 0.94));
    // bypass ducting to the upper-surface spill doors
    bleed.push(FR.pipe([[8.3, -0.05, side * 1.0], [8.8, 0.25, side * 1.02], [9.3, 0.5, side * 1.05]], 0.07, 8));
    P(`Inlet throat & boundary-layer bleed (${R})`, {
      system: 'Propulsion', material: 'Composite duct, porous titanium bleed panel', mass: 120,
      explode: [0.55, -0.35, 1.25 * side],
      desc: 'Low-energy boundary-layer air is sucked off through a porous panel in the inlet wall and dumped overboard, and excess inlet air spills through bypass doors on the upper fuselage, so the engine always sees uniform flow (layout simplified).',
    }, [mesh(FR.gridSurface(fwd, { closed: true, uv: 'n' }), F.duct()), mesh(merge(bleed), F.ductDark())]);
    P(`Serpentine inlet duct (${R})`, {
      system: 'Propulsion', material: 'Composite duct with radar-absorbent lining', mass: 160,
      explode: [0, -0.15, 1.0 * side], callout: side > 0, anchor: [X(10.6), 0.38, 1.15 * side],
      desc: 'The duct curves up and inward for about 7 m from the inlet to the engine, so no line of sight reaches the spinning fan — normally the brightest radar reflector on a jet — and its absorbent lining soaks up energy that bounces in.',
    }, mesh(FR.gridSurface(aft, { closed: true, uv: 'n' }), F.duct()));

    // ---------------------------------------------------------------- F119 fan
    const E = FR.F119;
    const tor = (r, t, s0, seg = 40) => new THREE.TorusGeometry(r, t, 6, seg).rotateY(Math.PI / 2).translate(X(s0), yc, zc);
    {
      const g = [];
      g.push(latheX([[0.001, 13.12], [0.09, 13.2], [0.15, 13.32], [0.18, 13.45], [0.2, 13.6], [0.21, 14.05]], yc, zc, 28));
      const rot = [[13.5, 20, 0.18, 0.47, 0.16], [13.72, 26, 0.2, 0.44, 0.13], [13.92, 32, 0.22, 0.42, 0.11]];
      for (const [s, n, h, t, ch] of rot) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: ch, twist: 0.75, thick: 0.014 }));
      // variable inlet guide vanes, then a stator row behind each rotor
      g.push(bladeRow({ x: X(13.4), y: yc, z: zc, count: 22, rHub: 0.15, rTip: 0.48, chord: 0.06, twist: -0.2, thick: 0.012 }));
      for (const [s, n, h, t] of [[13.61, 36, 0.2, 0.47], [13.82, 40, 0.21, 0.44], [14.02, 44, 0.22, 0.42]]) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: 0.07, twist: -0.35, thick: 0.01 }));
      const blades = merge(g);
      const cas = FR.cylX(13.74, yc, zc, 0.76, 0.49, 0.48, 40, true);       // fan-case liner over the blade tips
      const fan = P(`F119 fan (${R})`, {
        system: 'Propulsion', material: 'Hollow wide-chord titanium blades linear-friction-welded to their discs (blisks), Alloy C stators', mass: 480,
        explode: [1.3, 0.55, 0.45 * side], callout: side > 0, anchor: [X(13.62), 0.38, zc],
        desc: 'Three shroudless fan stages built as integrally bladed rotors (blisks), driven by the single-stage LP turbine; the inlet guide vanes are variable for stall margin. The fan face is 38 in (0.97 m) across, and with a bypass ratio of 0.30 about 23 % of the air flows around the core (blade counts illustrative; the whole F119 weighs about 2,270 kg).',
      }, [mesh(blades, F.blade()), mesh(cas, F.tiDull())]);
      fan.userData.part.thermalRole = 'fan';
    }
    // ---------------------------------------------------------------- outer case and bypass duct
    {
      const c = [];
      c.push(FR.cylX(13.76, yc, zc, 0.78, E.rCase, E.rCase, 44, true));                  // fan case
      c.push(FR.cylX(14.9, yc, zc, 1.5, E.rCase, E.rCase - 0.01, 44, true));               // bypass duct outer wall
      for (const s0 of [13.38, 14.15]) c.push(tor(E.rCase + 0.012, 0.02, s0, 44));            // case flanges
      c.push(tor(E.rCase - 0.01, 0.018, 15.62, 44));
      const core = latheX([[0.33, 14.14], [0.345, 14.6], [0.37, 14.9], [0.38, 15.3], [0.39, 15.62]], yc, zc, 36);
      // fan frame: radial struts across the bypass duct carry the front bearing and the core
      const st = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        st.push(new THREE.BoxGeometry(0.1, E.rCase - 0.34, 0.025).translate(0, (E.rCase + 0.34) / 2, 0).rotateX(a).translate(X(14.17), yc, zc));
      }
      const cs = P(`F119 bypass duct & outer case (${R})`, {
        system: 'Propulsion', skin: true, material: 'Burn-resistant titanium (Alloy C) case, axially split for maintenance', mass: 260,
        explode: [0.7, 1.75, 0.95 * side],
        desc: 'The outer case is 48 in (1.22 m) across. Between it and the core cowl runs the bypass duct, which carries cool fan air past the hot core to the augmentor and nozzle. The case splits along its length, so modules can be changed without pulling the whole engine apart (drawn faint in X-ray so the core shows).',
      }, [mesh(merge(c), F.tiDull()), mesh(core, F.hot()), mesh(merge(st), F.tiDull())]);
      cs.userData.part.thermalRole = 'fan';
    }
    // ---------------------------------------------------------------- HP compressor
    {
      const g = [];
      for (let k = 0; k < 6; k++) {
        const s = 14.2 + k * 0.1;
        const tip = lerp(0.3, 0.245, k / 5), hub = lerp(0.19, 0.215, k / 5);
        g.push(bladeRow({ x: X(s), y: yc, z: zc, count: 36 + k * 6, rHub: hub, rTip: tip, chord: 0.055, twist: 0.55, thick: 0.008 }));
        g.push(bladeRow({ x: X(s + 0.05), y: yc, z: zc, count: 44 + k * 6, rHub: hub + 0.005, rTip: tip, chord: 0.035, twist: -0.4, thick: 0.006 }));
      }
      g.push(latheX([[0.19, 14.15], [0.205, 14.5], [0.215, 14.82]], yc, zc, 24));
      const cas = latheX([[0.32, 14.12], [0.3, 14.45], [0.27, 14.82]], yc, zc, 32);
      const hpc = P(`F119 HP compressor (${R})`, {
        system: 'Propulsion', material: 'Titanium and nickel blisks, burn-resistant Alloy C stators', mass: 300,
        explode: [0.6, 0.55, 0.55 * side],
        desc: 'Six stages (the F100 needed ten) raise the core pressure so that the whole engine reaches an overall pressure ratio of about 26:1. Its stators are a burn-resistant titanium alloy, because a titanium fire in a compressor can otherwise sustain itself.',
      }, [mesh(merge(g), F.blade()), mesh(cas, F.tiDull())]);
      hpc.userData.part.thermalRole = 'compressor';
    }
    // ---------------------------------------------------------------- shafts and bearings
    {
      const g = [FR.cylX(14.55, yc, zc, 2.1, 0.05, 0.05, 12)];                          // LP shaft: fan ↔ LP turbine
      g.push(FR.cylX(14.75, yc, zc, 1.2, 0.11, 0.115, 16, true));                         // HP spool drum
      const b = [];
      for (const [s0, r] of [[13.48, 0.08], [14.12, 0.09], [14.86, 0.14], [15.38, 0.13], [15.58, 0.09]]) {
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
      const ann = latheX([[0.22, 14.9], [0.24, 14.86], [0.31, 14.86], [0.335, 14.9], [0.34, 15.2], [0.21, 15.2], [0.205, 14.95], [0.22, 14.9]], yc, zc, 36);
      const noz = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        noz.push(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6).rotateZ(Math.PI / 2).translate(X(14.83), yc + Math.cos(a) * 0.275, zc + Math.sin(a) * 0.275));
      }
      noz.push(tor(0.3, 0.012, 14.79, 36));                                                  // fuel manifold
      const comb = P(`F119 annular combustor (${R})`, {
        system: 'Propulsion', material: 'Floatwall liner of cooled high-cobalt alloy panels', mass: 140,
        explode: [0.1, 0.6, 0.6 * side],
        desc: 'A short annular combustor fed by a ring of fuel injectors from a manifold (count illustrative). Its Floatwall liner is made of separate, air-cooled panels with no welds, so thermal cycling cannot start cracks at weld seams; it burns cleanly with little smoke.',
      }, [mesh(ann, F.inconel()), mesh(merge(noz), F.brass())]);
      comb.userData.part.thermalRole = 'combustor';
    }
    // ---------------------------------------------------------------- HP and LP turbines
    {
      const g = [bladeRow({ x: X(15.24), y: yc, z: zc, count: 36, rHub: 0.22, rTip: 0.33, chord: 0.05, twist: -0.7, thick: 0.012 })];
      g.push(bladeRow({ x: X(15.32), y: yc, z: zc, count: 52, rHub: 0.225, rTip: 0.335, chord: 0.045, twist: 0.8, thick: 0.01 }));
      g.push(FR.cylX(15.33, yc, zc, 0.07, 0.215, 0.215, 28));
      const hpt = P(`F119 HP turbine (${R})`, {
        system: 'Propulsion', material: 'Single-crystal nickel superalloy blades, impingement cooled', mass: 170,
        explode: [-0.4, 0.6, 0.6 * side],
        desc: 'One stage of single-crystal blades drives the six-stage compressor. The gas reaching it is around 1,900 K (about 3,000 °F), hotter than the alloy can survive, so compressor air is blown through each hollow blade and out of tiny holes as a protective film.',
      }, mesh(merge(g), F.bladeHot()));
      hpt.userData.part.thermalRole = 'turbine';
      const l = [bladeRow({ x: X(15.42), y: yc, z: zc, count: 40, rHub: 0.225, rTip: 0.355, chord: 0.05, twist: -0.6, thick: 0.012 })];
      l.push(bladeRow({ x: X(15.51), y: yc, z: zc, count: 60, rHub: 0.23, rTip: 0.365, chord: 0.045, twist: -0.85, thick: 0.01 }));
      l.push(FR.cylX(15.52, yc, zc, 0.06, 0.22, 0.22, 28));
      const lpt = P(`F119 LP turbine (${R})`, {
        system: 'Propulsion', material: 'Nickel superalloy', mass: 150,
        explode: [-0.8, 0.6, 0.6 * side],
        desc: 'A single LP stage turns the three-stage fan through the LP shaft. The two spools spin in opposite directions, which cancels much of their gyroscopic moment when the jet manoeuvres hard (the vanes between the turbines were kept).',
      }, mesh(merge(l), F.bladeHot()));
      lpt.userData.part.thermalRole = 'turbine';
    }
    // ---------------------------------------------------------------- augmentor
    {
      const g = [];
      // thick, curved radial vanes with the fuel injectors built in (they replace spray bars and
      // V-gutter flameholders, and hide the turbine); three fuel-zone manifolds feed them
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.push(new THREE.BoxGeometry(0.24, 0.29, 0.05).rotateY(0.45).rotateX(a).translate(X(15.7), yc + Math.cos(a) * 0.36, zc + Math.sin(a) * 0.36));
      }
      g.push(latheX([[0.215, 15.58], [0.2, 15.75], [0.14, 15.95], [0.06, 16.12], [0.001, 16.2]], yc, zc, 24));
      for (const r of [0.26, 0.36, 0.46]) g.push(tor(r, 0.014, 15.84, 36));
      // the augmentor duct tapers slightly toward the nozzle (≈ 1.17 m → 1.08 m)
      const liner = latheX([[0.535, 15.64], [0.525, 16.2], [0.51, 16.8], [0.5, 17.25]], yc, zc, 40);
      const outer = latheX([[E.rAug, 15.64], [0.575, 16.2], [0.555, 16.8], [0.54, 17.25]], yc, zc, 40);
      const aug = P(`F119 augmentor (${R})`, {
        system: 'Propulsion', material: 'Nickel / cobalt alloys, ceramic RAM-coated vanes, perforated cooling liner', mass: 380,
        explode: [-1.3, 0.55, 0.6 * side],
        desc: 'The three-zone afterburner lifts thrust from about 116 kN dry to the 156 kN class. Instead of spray bars and V-gutters, fuel is injected from thick curved vanes coated with radar-absorbent ceramic, which also hold the flame and block any view of the turbine (vane count illustrative); a perforated liner keeps bypass air between flame and casing.',
      }, [mesh(merge(g), F.hot()), mesh(liner, F.liner()), mesh(outer, F.hot())]);
      aug.userData.part.thermalRole = 'augmentor';
      const glow = mesh(new THREE.CircleGeometry(0.5, 32).rotateY(-Math.PI / 2).translate(X(17.2), yc, zc), anim.turbine, { cast: false });
      glow.userData.fx = true;
      aug.add(glow);
    }
    // ---------------------------------------------------------------- 2-D vectoring nozzle
    {
      const sx = (s) => X(s);
      const NW = 0.5;                       // half width between the sidewalls
      // fixed: transition duct (round → rectangular) and sidewalls
      const tr = [];
      for (const [s, k, w, h] of [[17.22, 2, 1.09, 1.09], [17.4, 2.6, 1.07, 1.0], [17.55, 3.6, 1.0, 0.82], [17.72, 6, 0.96, 0.66]]) tr.push(FR.superRing(sx(s), zc, yc, w, h, 28, k));
      const trans = FR.gridSurface(tr, { closed: true, uv: 'n' });
      const walls = [];
      for (const dz of [-NW, NW]) {
        const grid = [];
        for (const s of [17.5, 17.8, 18.1, 18.45]) {
          const t = (s - 17.5) / 0.95;
          const top = lerp(0.56, 0.3, t), bot = lerp(-0.6, -0.33, t);
          grid.push([[sx(s), top, zc + dz], [sx(s), bot, zc + dz]]);
        }
        walls.push(slab(grid, () => [0, 0, dz > 0 ? -0.04 : 0.04], new THREE.Vector3(0, 0, Math.sign(dz))));
      }
      // moving flaps: convergent + divergent about the throat, external flaps about their front edges
      const fw = NW - 0.04;
      const flapGeo = (sgn) => merge([
        slab([[[sx(17.72), sgn * 0.32 + yc, zc - fw], [sx(17.72), sgn * 0.32 + yc, zc + fw]], [[sx(17.96), sgn * 0.21 + yc, zc - fw], [sx(17.96), sgn * 0.21 + yc, zc + fw]]], () => [0, sgn * 0.035, 0]),
        slab([[[sx(17.96), sgn * 0.21 + yc, zc - fw], [sx(17.96), sgn * 0.21 + yc, zc + fw]], [[sx(18.52), sgn * 0.25 + yc, zc - fw], [sx(18.52), sgn * 0.25 + yc, zc + fw]]], () => [0, sgn * 0.035, 0]),
      ]);
      const throat = new THREE.Vector3(sx(17.96), yc, zc);
      const pivot = new THREE.Group();
      pivot.position.copy(throat);
      const inner = new THREE.Group();
      inner.position.copy(throat).multiplyScalar(-1);
      pivot.add(inner);
      inner.add(mesh(merge([flapGeo(1), flapGeo(-1)]), F.nozzleIn()));
      // plume (effect)
      const pm = plumeMaterial({ core: 0xfff3d6, outer: 0xff6a20, diamonds: 1.2 });
      const plume = plumeMesh(0.3, 0.12, 6.5, pm);
      plume.rotation.z = -Math.PI / 2;
      plume.scale.set(1, 1, 1.5);
      plume.position.set(sx(18.55), yc, zc);
      const core = plumeMesh(0.2, 0.05, 3.2, plumeMaterial({ core: 0xffffff, outer: 0x9fb8ff, diamonds: 2 }));
      core.rotation.z = -Math.PI / 2;
      core.scale.set(1, 1, 1.45);
      core.position.copy(plume.position);
      inner.add(plume, core);
      anim.plumes.push(pm, core.material);
      const ext = (sgn) => {
        const front = new THREE.Vector3(sx(17.55), sgn > 0 ? 0.555 : -0.6, zc);
        const p = new THREE.Group();
        p.position.copy(front);
        const g = new THREE.Group();
        g.position.copy(front).multiplyScalar(-1);
        p.add(g);
        const top0 = sgn > 0 ? 0.555 : -0.6, top1 = sgn > 0 ? 0.27 : -0.29;
        const grid = [];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4, s = lerp(17.55, 18.52, t);
          const y = lerp(top0, top1, t) + sgn * 0.03 * Math.sin(Math.PI * t);
          grid.push([[sx(s), y, zc - NW - 0.03], [sx(s), y, zc + NW + 0.03]]);
        }
        g.add(mesh(slab(grid, () => [0, -sgn * 0.04, 0], new THREE.Vector3(0, sgn, 0)), F.wing()));
        return p;
      };
      const extU = ext(1), extL = ext(-1);
      anim.tvc.push({ pivot, extU, extL });
      const nz = P(`2-D vectoring nozzle (${R})`, {
        system: 'Propulsion', material: 'Burn-resistant titanium (Alloy C) and nickel flaps, ceramic-coated hot sections', mass: 500,
        explode: [-2.6, 0.3, 0.85 * side], callout: side > 0, anchor: [X(18.3), 0.5, zc],
        desc: 'A two-dimensional convergent–divergent nozzle: upper and lower flaps set the throat and exit areas and swing the exhaust ±20° in pitch, giving pitch control even when the tail has too little airflow to bite. Its flat sides and serrated edges also shield the hot turbine from view.',
      }, [mesh(trans, F.nozzleIn()), mesh(merge(walls), F.nozzle()), pivot, extU, extL]);
      nz.userData.part.thermalRole = 'nozzle';
      // nozzle actuators: two above and two below, between the convergent flaps and the external flaps
      const acts = [];
      for (const dz of [-0.28, 0.28]) {
        for (const y of [0.4, -0.42]) {
          acts.push(new THREE.CylinderGeometry(0.03, 0.026, 0.27, 10).rotateZ(Math.PI / 2).translate(sx(17.815), yc + y, zc + dz));
          acts.push(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8).rotateZ(Math.PI / 2).translate(sx(18.0), yc + y * 0.93, zc + dz));
        }
      }
      P(`Nozzle actuators (${R})`, {
        system: 'Propulsion', material: 'Fuel-draulic linear actuators (engine fuel as the working fluid)', mass: 50, count: 4,
        explode: [-2.2, -0.45, 1.25 * side],
        desc: 'Four linear actuators move the convergent and divergent flaps together to set throat and exit area, and differentially to vector the jet. On many augmented engines these run on high-pressure engine fuel rather than hydraulic fluid (working fluid and count approximate for the F119).',
      }, mesh(merge(acts), F.hyd()));
    }
    // ---------------------------------------------------------------- gearbox, AMAD, engine fuel, lube, ignition, mounts
    {
      const gy = yc - 0.69;
      const g = [];
      g.push(new THREE.BoxGeometry(0.55, 0.12, 0.34).translate(X(13.85), gy, zc));
      g.push(FR.cylX(13.85, gy + 0.07, zc, 0.5, 0.05, 0.05, 10));                          // tower-shaft housing
      g.push(FR.pipe([[13.7, gy, zc + side * 0.12], [13.7, -0.55, side * 1.1], [13.7, -0.42, side * 1.3]], 0.03, 6));
      g.push(new THREE.BoxGeometry(0.5, 0.2, 0.24).translate(X(13.75), -0.42, side * 1.38));
      P(`Accessory gearbox & AMAD (${R})`, {
        system: 'Propulsion', material: 'Aluminium / magnesium gear cases, steel gears', mass: 95,
        explode: [0.2, -0.95, 0.55 * side],
        desc: 'A gearbox under the fan case takes power off the HP spool through a tower shaft and drives the engine\'s own pumps; a shaft to the airframe-mounted accessory drive (AMAD) turns this side\'s generator and hydraulic pumps.',
      }, mesh(merge(g), F.boxLight()));

      const f = [];
      f.push(new THREE.BoxGeometry(0.18, 0.14, 0.16).translate(X(13.48), gy - 0.01, zc + side * 0.1));       // main fuel pump
      f.push(new THREE.BoxGeometry(0.2, 0.12, 0.14).translate(X(13.5), gy - 0.01, zc - side * 0.1));        // fuel metering unit
      f.push(FR.pipe([[13.5, gy + 0.05, zc - side * 0.1], [13.9, gy + 0.08, zc - side * 0.18], [14.5, -0.64, zc - side * 0.22], [14.75, -0.42, zc - side * 0.12], [14.79, -0.31, zc - side * 0.04]], 0.016, 6));
      P(`Engine fuel pump & metering unit (${R})`, {
        system: 'Propulsion', material: 'Gear-driven high-pressure pump, FADEC-controlled metering unit', mass: 40,
        explode: [0.9, -1.15, 0.65 * side],
        desc: 'On the gearbox: the main fuel pump raises the fuel delivered by the airframe boost pumps to injection pressure, and the metering unit, set by the FADEC, meters it into the combustor manifold. The same fuel first cools the engine oil.',
      }, mesh(merge(f), F.boxLight()));
      const a = [];
      a.push(FR.cylX(14.2, gy, zc, 0.24, 0.07, 0.07, 14));                                     // augmentor pump
      a.push(FR.pipe([[14.3, gy, zc], [15.1, -0.66, zc + side * 0.05], [15.55, -0.64, zc + side * 0.05], [15.75, -0.58, zc]], 0.018, 6));
      a.push(tor(0.556, 0.012, 15.75, 40));                                                  // zone manifold in the case / liner gap
      for (let k = 0; k < 3; k++) { const ang = Math.PI + (k - 1) * 0.5; a.push(FR.pipe([[15.75, yc + Math.cos(ang) * 0.556, zc + Math.sin(ang) * 0.556 * side], [15.8, yc + Math.cos(ang) * 0.48, zc + Math.sin(ang) * 0.48 * side]], 0.01, 5, 2)); }
      P(`Augmentor fuel pump & zone manifolds (${R})`, {
        system: 'Propulsion', material: 'Centrifugal augmentor pump, three-zone fuel manifolds', mass: 30,
        explode: [-0.7, -1.2, 0.8 * side],
        desc: 'A separate pump supplies the afterburner, whose demand is several times the dry flow. Fuel goes to three zones lit in sequence as the throttle moves through the afterburner range, feeding the injectors inside the curved augmentor vanes.',
      }, mesh(merge(a), F.pipe()));
      const o = [];
      const oy = yc + 0.58, oz = zc - side * 0.33;
      o.push(new THREE.CapsuleGeometry(0.065, 0.28, 4, 12).rotateZ(Math.PI / 2).translate(X(13.95), oy, oz));
      o.push(new THREE.BoxGeometry(0.12, 0.08, 0.1).translate(X(13.62), oy - 0.06, oz + side * 0.04));      // lube pump / filter
      o.push(FR.pipe([[13.7, oy - 0.04, oz], [13.55, 0.3, zc - side * 0.18], [13.5, 0.1, zc - side * 0.07]], 0.012, 5));
      o.push(FR.pipe([[14.1, oy - 0.04, oz], [14.6, 0.48, zc - side * 0.3], [15.2, 0.42, zc - side * 0.2], [15.38, 0.18, zc - side * 0.08]], 0.012, 5));
      P(`Oil tank & lube system (${R})`, {
        system: 'Propulsion', material: 'Aluminium oil tank, lube and scavenge pumps, fuel-cooled oil cooler', mass: 25,
        explode: [0.4, 1.25, -0.5 * side],
        desc: 'A self-contained lubrication system: a tank on the upper fan case, a pump and filter, and lines to the bearing sumps; scavenge pumps return the oil through a cooler that dumps its heat into the fuel (position approximate).',
      }, mesh(merge(o), F.boxLight()));
      const ig = [];
      const ex = [14.5, yc - 0.5, zc + side * 0.36];
      ig.push(new THREE.BoxGeometry(0.22, 0.1, 0.12).translate(X(ex[0]), ex[1], ex[2]));
      for (const ang of [-2.2, -1.2]) {
        const py = yc + Math.cos(ang) * 0.34, pz = zc + Math.sin(ang) * 0.34 * -side;
        ig.push(FR.pipe([[ex[0] + 0.1, ex[1], ex[2]], [14.85, yc + Math.cos(ang) * 0.5, zc + Math.sin(ang) * 0.5 * -side], [14.95, py, pz]], 0.008, 5));
        ig.push(FR.cylX(14.95, py, pz, 0.05, 0.014, 0.014, 6));
      }
      P(`Ignition exciters & igniters (${R})`, {
        system: 'Propulsion', material: 'Capacitor-discharge exciter, shielded leads, two igniter plugs', mass: 8,
        explode: [0.0, -1.45, 0.75 * side],
        desc: 'A high-energy capacitor-discharge exciter fires two igniter plugs in the combustor for starting and relight; the FADEC switches them on automatically if it senses a flame-out.',
      }, mesh(merge(ig), F.copper()));

      const m = [];
      for (const dz of [-1, 1]) m.push(FR.pipe([[13.9, yc, zc + dz * (E.rCase + 0.01)], [13.75, yc + 0.05, zc + dz * (E.rCase + 0.07)]], 0.03, 6));
      m.push(FR.pipe([[16.55, yc + 0.1, zc + side * 0.575], [16.4, yc + 0.1, zc + side * 0.65]], 0.025, 6));
      m.push(FR.pipe([[14.1, yc + E.rCase + 0.01, zc], [13.7, yc + E.rCase + 0.05, zc]], 0.022, 6));
      P(`Engine mounts (${R})`, {
        system: 'Propulsion', material: 'Steel trunnions and links', mass: 35,
        explode: [0.2, 1.0, 0.7 * side],
        desc: 'Trunnions on the fan case take thrust and vertical loads into the engine-bay frames; an aft link at the augmentor lets the hot engine grow in length as it heats up. The engine drops out downward for change.',
      }, mesh(merge(m), F.steel()));
      // dual-channel FADEC on the lower outboard side of the case, with its harness to the fan case
      const th = side > 0 ? 0.542 : Math.PI - 0.542;
      const fy = yc - 0.33, fz = zc + side * 0.55;
      const fd = [new THREE.BoxGeometry(0.4, 0.2, 0.08).rotateX(th).translate(X(14.75), fy, fz)];
      fd.push(FR.pipe([[14.55, fy + 0.05, fz], [14.2, fy + 0.1, zc + side * 0.6], [13.9, fy + 0.15, zc + side * 0.6]], 0.012, 5));
      P(`FADEC engine control (${R})`, {
        system: 'Propulsion', material: 'Dual-redundant digital engine controller (Hamilton Standard), fuel cooled', mass: 18,
        explode: [0.0, 0.5, 1.15 * side],
        desc: 'Full-authority digital engine control: two independent channels schedule fuel flow, variable vanes, nozzle area and vectoring, and talk directly to the vehicle-management computers, which makes the F119 stall-resistant and tolerant of slamming the throttles.',
      }, mesh(merge(fd), F.box()));
    }
  }
}
