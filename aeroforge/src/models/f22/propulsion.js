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
      explode: [1.0, -0.55, 1.7 * side], callout: side > 0, anchor: [X(6.4), -0.35, 1.55 * side],
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
      explode: [0, -0.15, 1.0 * side], callout: side > 0, anchor: [X(10.6), -0.1, 1.2 * side],
      desc: 'The duct curves up and inward for about 7 m from the inlet to the engine, so no line of sight reaches the spinning fan — normally the brightest radar reflector on a jet — and its absorbent lining soaks up energy that bounces in.',
    }, mesh(FR.gridSurface(aft, { closed: true, uv: 'n' }), F.duct()));

    // ---------------------------------------------------------------- F119 fan
    {
      const g = [];
      g.push(latheX([[0.001, 13.12], [0.09, 13.2], [0.15, 13.32], [0.18, 13.45], [0.2, 13.6], [0.21, 14.05]], yc, zc, 28));
      const rot = [[13.5, 20, 0.18, 0.47, 0.16], [13.72, 26, 0.2, 0.44, 0.13], [13.92, 32, 0.22, 0.42, 0.11]];
      for (const [s, n, h, t, ch] of rot) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: ch, twist: 0.75, thick: 0.014 }));
      for (const [s, n, h, t] of [[13.61, 36, 0.2, 0.47], [13.82, 40, 0.21, 0.44], [14.02, 44, 0.22, 0.42]]) g.push(bladeRow({ x: X(s), y: yc, z: zc, count: n, rHub: h, rTip: t, chord: 0.07, twist: -0.35, thick: 0.01 }));
      const blades = merge(g);
      const cas = [];
      cas.push(FR.cylX(13.74, yc, zc, 0.76, 0.535, 0.535, 40, true));
      cas.push(FR.cylX(14.9, yc, zc, 1.7, 0.535, 0.52, 40, true));             // bypass duct
      cas.push(new THREE.TorusGeometry(0.55, 0.025, 6, 40).rotateY(Math.PI / 2).translate(X(13.38), yc, zc));
      cas.push(new THREE.TorusGeometry(0.55, 0.02, 6, 40).rotateY(Math.PI / 2).translate(X(14.1), yc, zc));
      const fan = P(`F119 fan (${R})`, {
        system: 'Propulsion', material: 'Titanium integrally bladed rotors (blisks), titanium case', mass: 360,
        explode: [1.2, 0.55, 0.45 * side], callout: side > 0, anchor: [X(13.6), 0.55, zc],
        desc: 'Three fan stages built as integrally bladed rotors, driven by the single-stage LP turbine. About 23 % of the air (bypass ratio 0.3) goes around the core to cool the augmentor and nozzle (blade counts illustrative).',
      }, [mesh(blades, F.blade()), mesh(merge(cas), F.tiDull())]);
      fan.userData.part.thermalRole = 'fan';
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
        system: 'Propulsion', material: 'Titanium and nickel blisks', mass: 210,
        explode: [0.6, 0.55, 0.55 * side],
        desc: 'Six stages squeeze the core air before combustion; the HP spool turns opposite to the LP spool, which lets the engine drop a row of turbine vanes and save weight (stage count from Pratt & Whitney).',
      }, [mesh(merge(g), F.blade()), mesh(cas, F.tiDull())]);
      hpc.userData.part.thermalRole = 'compressor';
    }
    // ---------------------------------------------------------------- combustor
    {
      const ann = latheX([[0.22, 14.9], [0.24, 14.86], [0.31, 14.86], [0.335, 14.9], [0.34, 15.2], [0.21, 15.2], [0.205, 14.95], [0.22, 14.9]], yc, zc, 36);
      const noz = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        noz.push(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6).rotateZ(Math.PI / 2).translate(X(14.83), yc + Math.cos(a) * 0.275, zc + Math.sin(a) * 0.275));
      }
      const comb = P(`F119 annular combustor (${R})`, {
        system: 'Propulsion', material: 'Nickel-alloy Floatwall liner, thermal-barrier coating', mass: 95,
        explode: [0.1, 0.6, 0.6 * side],
        desc: 'A short annular combustor with replaceable liner panels burns fuel from a ring of injectors (count illustrative); its exit gas is far hotter than the melting point of the turbine blades it feeds.',
      }, [mesh(ann, F.inconel()), mesh(merge(noz), F.brass())]);
      comb.userData.part.thermalRole = 'combustor';
    }
    // ---------------------------------------------------------------- HP and LP turbines
    {
      const g = [bladeRow({ x: X(15.24), y: yc, z: zc, count: 36, rHub: 0.22, rTip: 0.33, chord: 0.05, twist: -0.7, thick: 0.012 })];
      g.push(bladeRow({ x: X(15.32), y: yc, z: zc, count: 52, rHub: 0.225, rTip: 0.335, chord: 0.045, twist: 0.8, thick: 0.01 }));
      g.push(FR.cylX(15.33, yc, zc, 0.07, 0.215, 0.215, 28));
      const hpt = P(`F119 HP turbine (${R})`, {
        system: 'Propulsion', material: 'Single-crystal nickel superalloy blades, cooled', mass: 120,
        explode: [-0.4, 0.6, 0.6 * side],
        desc: 'One stage of air-cooled single-crystal blades drives the six-stage compressor. Cooling air bled from the compressor flows through each hollow blade and out of tiny holes to form a protective film.',
      }, mesh(merge(g), F.bladeHot()));
      hpt.userData.part.thermalRole = 'turbine';
      const l = [bladeRow({ x: X(15.42), y: yc, z: zc, count: 40, rHub: 0.225, rTip: 0.355, chord: 0.05, twist: -0.6, thick: 0.012 })];
      l.push(bladeRow({ x: X(15.51), y: yc, z: zc, count: 60, rHub: 0.23, rTip: 0.365, chord: 0.045, twist: -0.85, thick: 0.01 }));
      l.push(FR.cylX(15.52, yc, zc, 0.06, 0.22, 0.22, 28));
      l.push(FR.cylX(14.7, yc, zc, 2.0, 0.05, 0.05, 10));           // LP shaft to the fan
      const lpt = P(`F119 LP turbine (${R})`, {
        system: 'Propulsion', material: 'Nickel superalloy', mass: 105,
        explode: [-0.8, 0.6, 0.6 * side],
        desc: 'A single LP stage turns the three-stage fan through a shaft running inside the HP spool, in the opposite direction to the HP turbine (counter-rotating spools).',
      }, mesh(merge(l), F.bladeHot()));
      lpt.userData.part.thermalRole = 'turbine';
    }
    // ---------------------------------------------------------------- augmentor
    {
      const g = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.push(new THREE.BoxGeometry(0.16, 0.26, 0.02).rotateX(a).translate(X(15.68), yc + Math.cos(a) * 0.33, zc + Math.sin(a) * 0.33));
        g.push(new THREE.BoxGeometry(0.04, 0.24, 0.05).rotateX(a).translate(X(16.0), yc + Math.cos(a) * 0.32, zc + Math.sin(a) * 0.32));
      }
      g.push(latheX([[0.215, 15.58], [0.2, 15.75], [0.14, 15.95], [0.06, 16.12], [0.001, 16.2]], yc, zc, 24));
      for (const r of [0.22, 0.33, 0.43]) g.push(new THREE.TorusGeometry(r, 0.012, 6, 36).rotateY(Math.PI / 2).translate(X(15.9), yc, zc));
      for (const r of [0.28, 0.4]) g.push(new THREE.TorusGeometry(r, 0.028, 4, 36).rotateY(Math.PI / 2).translate(X(16.02), yc, zc));
      const liner = FR.cylX(16.5, yc, zc, 1.5, 0.48, 0.47, 40, true);
      const outer = FR.cylX(16.48, yc, zc, 1.55, 0.52, 0.5, 40, true);
      const aug = P(`F119 augmentor (${R})`, {
        system: 'Propulsion', material: 'Nickel / cobalt alloys, perforated cooling liner', mass: 260,
        explode: [-1.3, 0.55, 0.6 * side],
        desc: 'The afterburner: spray rings inject fuel behind the turbine and V-gutter flameholders anchor the flame, lifting thrust from about 116 kN dry to about 156 kN. A perforated liner keeps a film of bypass air between flame and casing.',
      }, [mesh(merge(g), F.hot()), mesh(liner, F.liner()), mesh(outer, F.hot())]);
      aug.userData.part.thermalRole = 'augmentor';
      const glow = mesh(new THREE.CircleGeometry(0.46, 32).rotateY(-Math.PI / 2).translate(X(17.2), yc, zc), anim.turbine, { cast: false });
      glow.userData.fx = true;
      aug.add(glow);
    }
    // ---------------------------------------------------------------- 2-D vectoring nozzle
    {
      const sx = (s) => X(s);
      // fixed: transition duct (round → rectangular), sidewalls, actuators
      const tr = [];
      for (const [s, k, w, h] of [[17.22, 2, 0.95, 0.95], [17.4, 2.6, 0.94, 0.86], [17.55, 3.6, 0.93, 0.74], [17.72, 6, 0.92, 0.64]]) tr.push(FR.superRing(sx(s), zc, yc, w, h, 28, k));
      const trans = FR.gridSurface(tr, { closed: true, uv: 'n' });
      const walls = [];
      for (const dz of [-0.53, 0.53]) {
        const grid = [];
        for (const s of [17.5, 17.8, 18.1, 18.45]) {
          const t = (s - 17.5) / 0.95;
          const top = lerp(0.56, 0.3, t), bot = lerp(-0.6, -0.33, t);
          grid.push([[sx(s), top, zc + dz], [sx(s), bot, zc + dz]]);
        }
        walls.push(slab(grid, () => [0, 0, dz > 0 ? -0.04 : 0.04], new THREE.Vector3(0, 0, Math.sign(dz))));
      }
      const acts = [];
      for (const dz of [-0.6, 0.6]) for (const y of [0.28, -0.3]) acts.push(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 10).rotateZ(Math.PI / 2).translate(sx(17.85), yc + y, zc + dz * (side > 0 ? 1 : 1)));
      // moving flaps: convergent + divergent about the throat, external flaps about their front edges
      const flapGeo = (sgn) => merge([
        slab([[[sx(17.72), sgn * 0.32 + yc, zc - 0.46], [sx(17.72), sgn * 0.32 + yc, zc + 0.46]], [[sx(17.96), sgn * 0.21 + yc, zc - 0.46], [sx(17.96), sgn * 0.21 + yc, zc + 0.46]]], () => [0, sgn * 0.035, 0]),
        slab([[[sx(17.96), sgn * 0.21 + yc, zc - 0.46], [sx(17.96), sgn * 0.21 + yc, zc + 0.46]], [[sx(18.52), sgn * 0.25 + yc, zc - 0.46], [sx(18.52), sgn * 0.25 + yc, zc + 0.46]]], () => [0, sgn * 0.035, 0]),
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
          grid.push([[sx(s), y, zc - 0.56], [sx(s), y, zc + 0.56]]);
        }
        g.add(mesh(slab(grid, () => [0, -sgn * 0.04, 0], new THREE.Vector3(0, sgn, 0)), F.wing()));
        return p;
      };
      const extU = ext(1), extL = ext(-1);
      anim.tvc.push({ pivot, extU, extL });
      const nz = P(`2-D vectoring nozzle (${R})`, {
        system: 'Propulsion', material: 'Nickel and titanium flaps, ceramic-coated hot sections', mass: 430,
        explode: [-2.6, 0.3, 0.85 * side], callout: side > 0, anchor: [X(18.3), 0.5, zc],
        desc: 'A two-dimensional convergent–divergent nozzle: upper and lower flaps set the throat area and swing the exhaust ±20° in pitch, giving pitch control even when the tail has too little airflow to bite. Its flat sides and serrated edges also shield the hot turbine from view.',
      }, [mesh(trans, F.nozzleIn()), mesh(merge(walls), F.nozzle()), mesh(merge(acts), F.hyd()), pivot, extU, extL]);
      nz.userData.part.thermalRole = 'nozzle';
    }
    // ---------------------------------------------------------------- gearbox, AMAD and mounts
    {
      const g = [];
      g.push(new THREE.BoxGeometry(0.55, 0.12, 0.34).translate(X(13.85), yc - 0.62, zc));
      g.push(FR.cylX(13.85, yc - 0.56, zc, 0.5, 0.06, 0.06, 10));
      g.push(FR.pipe([[13.7, yc - 0.6, zc], [13.7, -0.5, side * 1.1], [13.7, -0.42, side * 1.3]], 0.03, 6));
      g.push(new THREE.BoxGeometry(0.5, 0.2, 0.24).translate(X(13.75), -0.42, side * 1.38));
      P(`Accessory gearbox & AMAD (${R})`, {
        system: 'Propulsion', material: 'Aluminium / magnesium gear cases, steel gears', mass: 95,
        explode: [0.2, -0.9, 0.55 * side],
        desc: 'A gearbox under the fan case takes power off the HP spool and sends it by shaft to the airframe-mounted accessory drive (AMAD), which turns this side\'s generator and hydraulic pumps.',
      }, mesh(merge(g), F.boxLight()));
      const m = [];
      for (const dz of [-0.6, 0.6]) m.push(FR.pipe([[13.9, yc, zc + dz * 0.95], [13.75, yc + 0.05, zc + dz * 1.12]], 0.03, 6));
      m.push(FR.pipe([[16.6, yc + 0.5, zc], [16.4, yc + 0.55, zc + 0.08 * side]], 0.025, 6));
      m.push(FR.pipe([[14.1, yc + 0.54, zc], [13.7, yc + 0.6, zc]], 0.022, 6));
      P(`Engine mounts (${R})`, {
        system: 'Propulsion', material: 'Steel trunnions and links', mass: 35,
        explode: [0.2, 1.0, 0.7 * side],
        desc: 'Trunnions on the fan case take thrust and vertical loads into the engine-bay frame; an aft link at the augmentor lets the hot engine grow in length as it heats up. The engine drops out downward for change.',
      }, mesh(merge(m), F.steel()));
    }
  }
}
