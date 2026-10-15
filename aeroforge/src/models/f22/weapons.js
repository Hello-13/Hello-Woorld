// F-22A internal weapons: the main bay (split on the centre line by a keel web) with six AIM-120C on
// EDO LAU-142/A hydro-pneumatic AVEL ejectors behind two thermoset bifold doors, each door driven by
// its own hydraulic drive (power drive unit, torque shaft, rotary actuators); two side bays each with
// an AIM-9X on an LAU-141/A trapeze launcher and its drive actuator, behind a door with its own
// actuator; the stores-management processor that sequences them; and the M61A2 20 mm gun in the right
// wing root with its hydraulic drive, flexible shafts and linear linkless feed and storage system.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, ogiveProfile } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge, toothedGrid, rectTube } from './util.js';

const { X, lerp, M } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** Missile along +x, centred on its length: ogive radome, body, mid wings and tail fins. */
function missile({ length, r, nose, wingSpan = 0, wingRoot = 0, wingAt = 0, finSpan, finRoot, finTip = 0.06, roll = Math.PI / 4 }) {
  // built along +y (tail at y = 0, nose at y = length), then turned to +x
  const parts = [lathe(ogiveProfile(r, nose, length - nose, 12), 20), new THREE.CylinderGeometry(r, r, length - nose, 20, 1, false).translate(0, (length - nose) / 2, 0)];
  const fin = (y0, root, tipC, h) => {
    const V2 = (a, b) => new THREE.Vector2(a, b);
    const sh = new THREE.Shape([V2(y0, r * 0.98), V2(y0 + root, r * 0.98), V2(y0 + root * 0.8, r + h), V2(y0 + root * 0.8 - tipC, r + h)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = p.getX(i), b = p.getY(i), c = p.getZ(i); p.setXYZ(i, c - 0.003, a, b); }
    return g;
  };
  for (let k = 0; k < 4; k++) {
    const a = roll + (k * Math.PI) / 2;
    parts.push(fin(0.02, finRoot, finTip, finSpan / 2 - r).rotateY(a));
    if (wingSpan) parts.push(fin(length - wingAt - wingRoot, wingRoot, wingRoot * 0.3, wingSpan / 2 - r).rotateY(a));
  }
  const g = merge(parts);
  g.rotateZ(-Math.PI / 2);
  g.translate(-length / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** Cylinder between two Vector3 points. */
function rodV(a, b, r, seg = 10) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}
const tmpD = new THREE.Vector3(), tmpM = new THREE.Vector3();
/** Stretch a unit rod (along +y, centred) from a toward b, `len` long (default: all the way). */
function place(m, a, b, len = null) {
  tmpD.subVectors(b, a);
  const L = Math.max(1e-4, tmpD.length());
  tmpD.multiplyScalar(1 / L);
  const l = len ?? L;
  m.position.copy(tmpM.copy(a).addScaledVector(tmpD, l / 2));
  m.quaternion.setFromUnitVectors(UP, tmpD);
  m.scale.set(1, l, 1);
}
const unitRod = (r, mat, seg = 10) => mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);

const { bayCeil, AMRAAM_SLOTS, MAIN_DOOR, DIVIDER } = FR;

export function buildWeapons(ctx) {
  const { P, anim } = ctx;
  const bay = anim.bay;
  bay.bifold = [];
  bay.links = [];

  // ------------------------------------------------------------------ main weapons bay structure
  {
    const { s0, s1, z } = FR.MAIN_BAY;
    // cross-section: walls at ±z from the belly to the ceiling's outboard corner, ceiling sloping up to the flat
    // centre strip (FR.bayCeil)
    const prof = (s) => {
      const D = FR.bD(s), zb = FR.BAY_CEIL_BREAK;
      return [[z, -D], [z, FR.bayCeil(z)], [(z + zb) / 2, FR.bayCeil((z + zb) / 2)], [zb, FR.BAY_CEIL], [-zb, FR.BAY_CEIL], [-(z + zb) / 2, FR.bayCeil((z + zb) / 2)], [-z, FR.bayCeil(z)], [-z, -D]].map(([zz, y]) => [X(s), y, zz]);
    };
    const st = [s0, lerp(s0, s1, 0.25), lerp(s0, s1, 0.5), lerp(s0, s1, 0.75), s1];
    const liner = FR.gridSurface(st.map(prof), { closed: false, uv: 'n' });
    const ends = [];
    for (const s of [s0, s1]) {
      const shape = new THREE.Shape(prof(s).map((p) => new THREE.Vector2(p[2], p[1])));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateY(Math.PI / 2);
      g.translate(X(s), 0, 0);
      ends.push(g);
    }
    // ceiling and wall frames at the three launcher stations, and the door land along the chevron behind the aft wall
    const ribs = [];
    for (const s of [lerp(s0, s1, 0.18), lerp(s0, s1, 0.5), lerp(s0, s1, 0.82)]) {
      const p = prof(s);
      p[0][1] += 0.006; p[p.length - 1][1] += 0.006;                 // the wall frames stop just inside the belly skin
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k], b = p[k + 1];
        const len = Math.hypot(a[1] - b[1], a[2] - b[2]);
        const g = new THREE.BoxGeometry(0.05, len, 0.03);
        g.rotateX(Math.atan2(b[2] - a[2], b[1] - a[1]));             // +y → along the segment a → b
        g.translate(a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        ribs.push(g);
      }
    }
    for (const side of [1, -1]) {
      // the land: a shallow strip just inside the belly skin under the chevron tips behind the aft wall
      const pts = [];
      for (let k = 0; k <= 8; k++) { const zz = lerp(0.03, z, k / 8); pts.push([FR.mainDoorAft(zz) - 0.02, zz]); }
      for (let k = 0; k < pts.length - 1; k++) {
        const [sa, za] = pts[k], [sb, zb] = pts[k + 1];
        if (Math.max(sa, sb) <= s1 + 0.01) continue;
        const sm = Math.max((sa + sb) / 2, s1 + 0.02), len = Math.hypot(sb - sa, zb - za);
        ribs.push(new THREE.BoxGeometry(0.05, 0.016, len).rotateY(-Math.atan2(sb - sa, zb - za)).translate(X(sm), -FR.bD(sm) + 0.02, side * (za + zb) / 2));
      }
    }
    P('Main weapons bay', {
      system: 'Weapons', material: 'Aluminium / composite bay liner and ceiling frames, acoustic treatment', mass: 230,
      explode: [0, -0.75, 0],
      desc: 'A bay about 3.9 m long and 1.9 m wide under the inlet ducts, split along the centre line, that holds six AIM-120 missiles or two 1,000 lb GBU-32 JDAMs plus two AIM-120s (the doors, with their big chevron aft edges, are about 4.3 m long). Carrying weapons inside keeps the outline clean; external stores would multiply the radar cross-section.',
    }, [mesh(merge([liner, ...ends]), F.bay()), mesh(merge(ribs), F.alu())]);

    // centre-line keel web between the two halves of the bay, with the door land along its lower edge
    const stK = ctx.sB.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const h = DIVIDER.half;
    const web = slab([stK.map((s) => [X(s), FR.BAY_CEIL - 0.005, -h]), stK.map((s) => [X(s), -FR.bD(s) + 0.024, -h])], () => [0, 0, 2 * h]);
    // the door land runs on under the chevron tips to the notch on the centre line
    const stC = [...stK, FR.mainDoorAft(0)];
    const cap = slab(stC.map((s) => [[X(s), -FR.bD(s), -DIVIDER.cap], [X(s), -FR.bD(s), DIVIDER.cap]]), () => [0, 0.024, 0], V(0, -1, 0));
    const top = new THREE.BoxGeometry(s1 - s0, 0.02, 0.07).translate(X((s0 + s1) / 2), FR.BAY_CEIL - 0.01, 0);
    // fore and aft ends tie into the bay end bulkheads
    const lugs = [s0 + 0.04, s1 - 0.04].map((s) => FR.boxS(s, (FR.BAY_CEIL - FR.bD(s)) / 2, 0, 0.08, FR.bD(s) + FR.BAY_CEIL - 0.04, 0.07));
    P('Main bay centre divider', {
      system: 'Structure', material: 'Machined titanium keel web with a composite door land', mass: 85,
      explode: [0, -1.25, 0],
      desc: 'A keel web on the centre line splits the main bay into two halves of three launchers each. With the bay edge longerons it carries fuselage bending around the largest cut-out in the airframe, and its lower edge is the land both inner door panels close against.',
    }, [mesh(merge([web, top, ...lugs]), F.ti()), mesh(cap, F.composite())]);
  }

  // ------------------------------------------------------------------ main bay bifold doors and their drives
  {
    const { s0, z } = FR.MAIN_BAY;
    const { zIn, zFold, thick } = MAIN_DOOR;
    // door panel point grid: the fore edge saw-toothed (teeth parallel to the wing leading edge), the aft edge the
    // big chevron; each column runs from its fore-edge station to its aft-edge station
    const panelGrid = (side, za, zb) => {
      const n = Math.max(1, Math.round((zb - za) / 0.2)), cols = 2 * n + 1, a = FR.TOOTH_SLOPE * ((zb - za) / (2 * n));
      const nr = 10;
      const rows = [];
      for (let r = 0; r <= nr; r++) {
        const row = [];
        for (let k = 0; k < cols; k++) {
          const zz = lerp(za, zb, k / (cols - 1));
          const sf = k % 2 === 1 ? s0 - a : s0, sa = FR.mainDoorAft(zz);
          const sv = lerp(sf, sa, r / nr);
          row.push([X(sv), -FR.bD(sv) - 0.002, side * zz]);
        }
        rows.push(row);
      }
      return rows;
    };
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const panel = (za, zb) => slab(panelGrid(side, za, zb), () => [0, thick, 0], V(0, -1, 0));
      const outerGeo = panel(zFold, z), innerGeo = panel(zIn, zFold);             // the outer panel reaches its hinge on the cut-out's edge
      // fold-joint hinge knuckles on the inner faces
      const kn = [];
      const sFold1 = FR.mainDoorAft(zFold);
      for (let s = s0 + 0.35; s < sFold1 - 0.2; s += 0.62) kn.push(FR.cylX(s, -FR.bD(s) - 0.002 + thick + 0.012, side * zFold, 0.14, 0.016, 0.016, 8));
      const yF0 = -FR.bD(s0) - 0.002 + thick, yF1 = -FR.bD(sFold1) - 0.002 + thick;
      const hi = hinge([mesh(innerGeo, F.door())], V(X(s0), yF0, side * zFold), V(X(sFold1), yF1, side * zFold), V(X(9), -0.9, side * 0.2), V(0, 1, 0));
      const sH1 = FR.mainDoorAft(z);
      const ho = hinge([mesh(outerGeo, F.door()), mesh(merge(kn), F.tiDull()), hi.pivot], V(X(s0), -FR.bD(s0), side * z), V(X(sH1), -FR.bD(sH1), side * z), V(X(9), -0.9, side * 0.6), V(0, -1, 0));
      P(`Main bay door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Thermoset composite bifold door (outer and inner panel), saw-tooth fore edge, chevron aft edge', mass: 55,
        explode: [0, -1.55, 0.35 * side],
        desc: 'A bifold door: the wider outer panel is hinged to the fuselage at the bay edge and the inner panel to the outer one, so the door swings down and folds in half instead of hanging deep in the airflow. Its fore edge is saw-toothed and its aft edge is one big chevron, each edge parallel to the wing leading edge, so their reflections join the few directions the planform already uses.',
      }, ho.pivot);
      bay.bifold.push({ outer: ho, inner: hi });

      // drive: a hydraulic power drive unit turns a torque shaft along the bay sill, just above the edge
      // longeron and outboard of the bay's outer missile; three geared rotary actuators on the shaft each swing
      // a crank, and a link from the crank to a fitting on the outer panel moves the door (the fold follows)
      const BD = FR.BAY_DRIVE, zd = side * BD.z, g = [], br = [];
      g.push(FR.cylX((BD.s0 + BD.s1) / 2, BD.y, zd, BD.s1 - BD.s0, BD.shaftR, BD.shaftR, 10));          // torque shaft
      g.push(FR.boxS(BD.pdu, BD.y, zd + side * 0.01, 0.3, 0.07, 0.07));                                     // power drive unit
      g.push(FR.cylX(BD.pdu + 0.23, BD.y, zd + side * 0.01, 0.16, 0.03, 0.03, 12));                         // hydraulic motor
      const hp0 = V(X(s0), -FR.bD(s0), side * z), hp1 = V(X(sH1), -FR.bD(sH1), side * z);
      const cranks = [];
      for (const s of BD.stations) {
        g.push(FR.cylX(s, BD.y, zd, 0.12, BD.r, BD.r, 14));                                           // rotary actuator
        br.push(FR.boxS(s + 0.075, BD.y - 0.035, side * (BD.z + 0.01), 0.03, 0.05, 0.04));                     // mounting lug on the longeron
        const H = hp0.clone().lerp(hp1, (s - s0) / (sH1 - s0));                                        // on the door hinge line
        const arm = V(0, BD.fit[1], side * BD.fit[0]);
        const crank = unitRod(0.012, F.steel()), link = unitRod(0.008, F.steel());
        cranks.push({ A: V(X(s), BD.y, zd), H, arm, crank, link });
      }
      P(`Main bay door drive (${R})`, {
        system: 'Weapons', material: 'Hydraulic power drive unit (4,000 psi), steel torque shaft, three geared rotary actuators with cranks and links', mass: 30,
        explode: [0.2, -1.05, 0.75 * side],
        desc: 'The doors have to snap open in a fraction of a second so a missile can leave the bay. A hydraulic power drive unit turns a torque shaft along the bay sill, and three geared rotary actuators on it swing the outer door panel through cranks and links (arrangement approximate). Vickers built the development main- and side-bay door actuation systems; Curtiss-Wright later supplied the production weapons-bay-door actuation.',
      }, [mesh(merge(g), F.hyd()), mesh(merge(br), F.tiDull()), ...cranks.flatMap((k) => [k.crank, k.link])]);
      const v = new THREE.Vector3(), cP = new THREE.Vector3(), dP = new THREE.Vector3();
      bay.links.push(() => {
        for (const k of cranks) {
          v.copy(k.arm).applyQuaternion(ho.pivot.quaternion);
          cP.copy(k.A).add(v);
          dP.copy(k.H).add(v);
          place(k.crank, k.A, cP);
          place(k.link, cP, dP);
        }
      });
    }
  }

  // ------------------------------------------------------------------ AIM-120C and LAU-142/A AVEL
  {
    const geo = missile({ length: 3.65, r: 0.089, nose: 0.5, wingSpan: 0.447, wingRoot: 0.38, wingAt: 1.45, finSpan: 0.447, finRoot: 0.26, finTip: 0.1 });
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const ms = [], ls = [];
      for (const [zz, y, t] of AMRAAM_SLOTS) {
        const holder = new THREE.Group();
        const m = mesh(geo, F.missile());
        const band = mesh(new THREE.CylinderGeometry(0.0905, 0.0905, 0.06, 20).rotateZ(Math.PI / 2).translate(0.9, 0, 0), F.missileBand(), { cast: false });
        holder.add(m, band);
        holder.position.set(X(FR.AMRAAM_S), y, side * zz);
        // the missile's own fins sit at 45° (×-tail); turn it so they lie at the solved angle t
        holder.rotation.x = side > 0 ? -t - Math.PI / 4 : t - Math.PI / 4;
        ms.push(holder);
        // launcher: hanger body under the ceiling, ejector arms reaching down to the missile's lugs
        const lg = new THREE.Group();
        const top = bayCeil(zz);
        const body = mesh(merge([new THREE.BoxGeometry(2.1, 0.1, 0.11), new THREE.BoxGeometry(0.5, 0.04, 0.09).translate(0.55, 0.06, 0), FR.cylX(0, 0, 0, 0.24, 0.035, 0.035, 10).translate(-X(0) + 0.75, 0, 0)]), F.boxLight());
        body.position.set(X(FR.AMRAAM_S - 0.13), top - 0.055, side * zz);
        lg.add(body);
        const arms = [];
        for (const ds of [-0.6, 0.6]) {
          const arm = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), F.steel());
          arm.position.set(X(FR.AMRAAM_S - 0.13 + ds), 0, side * zz);
          lg.add(arm);
          arms.push(arm);
        }
        ls.push(lg);
        bay.ejectors.push({ holder, y0: y, arms: arms.map((a) => ({ mesh: a, x: a.position.x })), top: top - 0.105, z: side * zz });
      }
      P(`AIM-120C AMRAAM ×3 (${R} main bay)`, {
        system: 'Weapons', material: 'Steel / composite airframe, active radar seeker', mass: 456, massSource: 'USAF AIM-120 fact sheet: 152 kg (335 lb) each', count: 3,
        explode: [0, -1.05, 0.55 * side], callout: side > 0, anchor: [X(FR.AMRAAM_S - 0.9), -0.55, side * 0.45],
        desc: 'Active-radar medium-range missiles, 3.65 m long and 17.8 cm in diameter (USAF fact sheet). The C model\'s clipped wings and fins were designed so that six fit in the F-22\'s main bay, three each side of the centre web, staggered in height so their fins interleave.',
      }, ms);
      P(`LAU-142/A AVEL launchers ×3 (${R})`, {
        system: 'Weapons', material: 'Mostly aluminium hydro-pneumatic ejector', mass: 154, massSource: 'Hydraulics & Pneumatics (1998): nearly 113 lb (51 kg) each', count: 3,
        explode: [0, -0.45, 0.35 * side],
        desc: 'EDO\'s AMRAAM Vertical Eject Launcher is a hydropneumatic launcher with a 9 in (23 cm) stroke: it ejects the missile out of the bay at more than 25 ft/s (7.6 m/s), peaking at 40 g, and needs no pyrotechnics, so it takes less logistics support than cartridge launchers. Mostly aluminium and nearly 113 lb, it is built substantial to minimise missile movement in the bay (the two arms drawn are approximate).',
      }, ls);
    }
  }

  // ------------------------------------------------------------------ side bays: doors, AIM-9X, LAU-141/A
  {
    const { s0, s1 } = FR.SIDE_BAY;
    const st = ctx.sB.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const geo9 = missile({ length: 3.02, r: 0.0635, nose: 0.3, wingSpan: 0.24, wingRoot: 0.16, wingAt: 0.62, finSpan: 0.36, finRoot: 0.22, finTip: 0.08 });
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const wallPt = (s, u) => { const wf = FR.wallFractions(s); const [zz, y] = FR.wallB(s, lerp(wf[4], wf[7], u)); return [X(s), y, side * (zz + 0.002)]; };
      const grid = toothedGrid(wallPt, st, { width: 0.43 });
      const door = slab(grid, () => [0, 0.01, -side * 0.035], V(0, 0, side));
      const top0 = V(...wallPt(s0, 0)), top1 = V(...wallPt(s1, 0));
      const h = hinge(mesh(door, F.door()), top0, top1, V(X(10), -0.8, side * 1.6), V(0, 0.3, side));
      P(`Side bay door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth fore and aft edges', mass: 30,
        explode: [0, -0.3, 1.25 * side],
        desc: 'Hinged along its top edge on the side of the inlet trunk; it swings up and out so the trapeze launcher can carry the Sidewinder into the airflow. Like every door on the jet, its fore and aft edges are saw-toothed.',
      }, h.pivot);
      bay.doors.push({ h, angle: 1.9, side: true });

      // door actuator: a linear jack from the bay roof to a crank on the door just below its hinge
      {
        const sA = M(10.05);
        const wf = FR.wallFractions(sA);
        const [hz, hy] = FR.wallB(sA, wf[4]);
        const Fx = V(X(sA), hy + 0.02, side * (hz - 0.24));
        const crank = V(X(sA), hy - 0.093, side * (hz - 0.098));
        const p0 = top0.clone();
        const bar = unitRod(0.024, F.hyd()), rodM = unitRod(0.012, F.chrome(), 8);
        const fit = mesh(merge([FR.boxS(sA, hy + 0.035, side * (hz - 0.24), 0.08, 0.04, 0.06), FR.boxS(sA, hy - 0.093, side * (hz - 0.08), 0.05, 0.05, 0.03)]), F.tiDull());
        const len = 0.17;
        const cp = new THREE.Vector3();
        P(`Side bay door actuator (${R})`, {
          system: 'Weapons', material: 'Hydraulic linear actuator, 4,000 psi', mass: 4,
          explode: [0, 0.2, 1.05 * side],
          desc: 'A linear jack in the roof of the side bay pushes on a crank below the door hinge to swing the door up and out in a fraction of a second; Vickers built the development side-bay door actuators (position approximate).',
        }, [bar, rodM, fit]);
        bay.links.push(() => {
          cp.subVectors(crank, p0).applyQuaternion(h.pivot.quaternion).add(p0);
          place(bar, Fx, cp, len);
          tmpM.subVectors(cp, Fx).normalize();
          place(rodM, tmpM.clone().multiplyScalar(0.05).add(Fx), cp);
        });
      }

      const holder = new THREE.Group();
      holder.add(mesh(geo9, F.missile()));
      holder.add(mesh(new THREE.SphereGeometry(0.03, 12, 8).translate(1.5, 0, 0), F.seeker(), { cast: false }));
      // the launch rail belongs to the LAU-141/A: it rides out on the trapeze with the missile
      const railHolder = new THREE.Group();
      railHolder.add(mesh(merge([new THREE.BoxGeometry(2.3, 0.05, 0.06).translate(0, 0.095, 0), new THREE.BoxGeometry(0.4, 0.06, 0.1).translate(-0.9, 0.13, 0), new THREE.BoxGeometry(0.16, 0.04, 0.12).translate(0.95, 0.125, 0)]), F.boxLight()));
      // stowed in the middle of the bay, rolled with the trunk wall's 29° lean so the X of fins fits the cavity
      const stow = V(X(M(10.05)), -0.65, side * 1.44), out = V(X(M(10.05)), -1.13, side * 1.86), roll = side * 0.5;
      holder.position.copy(stow);
      railHolder.position.copy(stow);
      holder.rotation.x = roll;
      railHolder.rotation.x = roll;
      const arms = [];
      const armG = new THREE.Group();
      armG.add(railHolder);
      for (const ds of [-0.7, 0.7]) {
        const arm = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 8), F.steel());
        armG.add(arm);
        arms.push({ arm, pivot: V(X(M(10.05) + ds), -0.54, side * 1.2), attach: V(ds * -1, 0.095 * Math.cos(roll), 0.095 * Math.sin(roll)) });
      }
      P(`AIM-9X Sidewinder (${R} side bay)`, {
        system: 'Weapons', material: 'Aluminium airframe, imaging-infrared seeker, thrust-vectoring vanes', mass: 85,
        explode: [0, -0.6, 1.05 * side],
        desc: 'Short-range infrared missile (3.02 m). Its imaging seeker has to see the target before launch, which is why the side-bay launcher swings it out into the open air first.',
      }, holder);
      P(`LAU-141/A trapeze launcher (${R})`, {
        system: 'Weapons', material: 'Steel arms, rail with plume deflector', mass: 45,
        explode: [0, -0.2, 0.8 * side],
        desc: 'Essentially an F-16 wingtip launch rail on a swinging trapeze: doors open, the arms carry the rail and missile out into the airflow, the seeker locks on, the missile fires off the rail and everything retracts within seconds.',
      }, armG);
      bay.trapeze.push({ holder, rail: railHolder, stow, out, arms });

      // trapeze drive: a hydraulic actuator from a roof fitting to a lever on the aft arm
      {
        const aft = arms[1];
        const Fx = V(X(M(10.6)), -0.475, side * 1.42);                                  // fitting in the side-bay roof
        const bar = unitRod(0.03, F.hyd()), rodM = unitRod(0.015, F.chrome(), 8);
        const fit = mesh(merge([FR.boxS(M(10.6), -0.455, side * 1.42, 0.08, 0.03, 0.08), FR.cylX(M(10.75), -0.54, side * 1.2, 0.1, 0.035, 0.035, 10)]), F.tiDull());
        const end = new THREE.Vector3(), lever = new THREE.Vector3();
        P(`LAU-141/A trapeze actuator (${R})`, {
          system: 'Weapons', material: 'Hydraulic linear actuator on the trapeze arm, 4,000 psi', mass: 6,
          explode: [0.3, 0.25, 0.6 * side],
          desc: 'Swings the trapeze arms, rail and missile out of the bay and back. The 3.02 m AIM-9X has to be held steady in the airflow long enough for its seeker to lock on before it fires (position approximate).',
        }, [bar, rodM, fit]);
        bay.links.push((kd, ke) => {
          end.lerpVectors(stow, out, ke).add(aft.attach);
          lever.lerpVectors(aft.pivot, end, 0.35);
          place(bar, Fx, lever, 0.18);
          tmpM.subVectors(lever, Fx).normalize();
          place(rodM, tmpM.clone().multiplyScalar(0.06).add(Fx), lever);
        });
      }

      // countermeasure bay behind the side bay: flare magazines behind a small flush door
      const cst = ctx.sB.filter((s) => s >= FR.CM_BAY.s0 - 1e-6 && s <= FR.CM_BAY.s1 + 1e-6);
      const cPt = (s, u) => { const wf = FR.wallFractions(s); const [zz, y] = FR.wallB(s, lerp(wf[5], wf[6], u)); return [X(s), y, side * (zz + 0.002)]; };
      const cdoor = slab(toothedGrid(cPt, cst, { width: 0.14 }), () => [0, 0.005, -side * 0.025], V(0, 0, side));
      P(`Countermeasure bay door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth edges', mass: 3,
        explode: [0, -0.15, 1.45 * side],
        desc: 'A small flush door on the side of the inlet trunk that opens only to release countermeasures.',
      }, mesh(cdoor, F.door()));
      const mg = [];
      const sm = (FR.CM_BAY.s0 + FR.CM_BAY.s1) / 2;
      const wfm = FR.wallFractions(sm);
      const [zm, ym] = FR.wallB(sm, (wfm[5] + wfm[6]) / 2);
      for (const ds of [-0.1, 0.1]) {
        const b = new THREE.BoxGeometry(0.17, 0.1, 0.07);
        mg.push(b.translate(X(sm + ds), ym, side * (zm - 0.07)));
      }
      const cells = [];
      for (const ds of [-0.1, 0.1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cells.push(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 6).rotateX(Math.PI / 2).translate(X(sm + ds - 0.06 + i * 0.04), ym - 0.03 + j * 0.03, side * (zm - 0.033)));
      mg.push(FR.pipe([[sm, ym + 0.06, side * (zm - 0.08)], [sm - 0.3, ym + 0.15, side * (zm - 0.15)], [sm - 0.9, ym + 0.2, side * (zm - 0.2)]], 0.008, 5));
      P(`Countermeasure dispenser (${R})`, {
        system: 'Weapons', material: 'Dispenser magazines of MJU-39/40 flare cartridges, sequencer', mass: 25, count: 2,
        explode: [0, -0.3, 0.95 * side],
        desc: 'Flare magazines in the small bay behind the side weapons bay. Cued by the defensive systems, the pilot (or the system) fires flares through the door to decoy infrared-guided missiles (cartridge count illustrative).',
      }, [mesh(merge(mg), F.box()), mesh(merge(cells), F.copper())]);
    }
  }

  // ------------------------------------------------------------------ stores management
  {
    // processor under the ceiling at the front of the right half of the main bay, ahead of the AVELs, and a weapon
    // interface unit at the front of each half; harness runs along the ceiling to each AVEL, down the outer wall to
    // the door drive, and out through the ceiling's outer slope, over the bleed duct and the side-bay roof to the
    // side-bay door and trapeze actuators
    const C = FR.BAY_CEIL, s0 = FR.MAIN_BAY.s0, sAv = FR.AMRAAM_S - 0.13 - 1.05;          // front of the AVEL bodies
    const sP = s0 + 0.3, sW = s0 + 0.15;
    const g = [FR.boxS(sP, C - 0.1, 0.2, 0.3, 0.2, 0.24)];
    const w = [];
    // processor ↔ the two interface units (the left one round the front of the centre divider)
    w.push(FR.pipe([[sP - 0.05, C - 0.03, 0.31], [sP - 0.12, C - 0.03, 0.42], [sW, C - 0.03, 0.46]], 0.009, 5, 8));
    w.push(FR.pipe([[sP - 0.14, C - 0.04, 0.12], [s0 + 0.06, C - 0.04, 0.05], [s0 + 0.06, C - 0.04, -0.05], [sW - 0.05, C - 0.03, -0.42], [sW, C - 0.03, -0.46]], 0.009, 5, 16));
    for (const side of [1, -1]) {
      const z = side;
      g.push(FR.boxS(sW, C - 0.06, side * 0.5, 0.16, 0.12, 0.12));
      // along the ceiling to the front of each AVEL body (the inboard right one straight off the processor)
      for (const [zz] of AMRAAM_SLOTS) {
        const yA = bayCeil(zz) - 0.03;
        if (side > 0 && zz < 0.3) w.push(FR.pipe([[sP + 0.14, C - 0.03, zz], [sAv + 0.01, C - 0.03, zz]], 0.007, 5, 4));
        else w.push(FR.pipe([[sW + 0.07, C - 0.03, z * 0.5], [sW + 0.25, Math.max(yA, C - 0.03), z * (0.5 + (zz - 0.5) * 0.6)], [sAv + 0.01, yA, z * zz]], 0.007, 5, 10));
      }
      // down the inside of the outer wall to the door drive's power unit on the sill
      const BD = FR.BAY_DRIVE, zw = FR.MAIN_BAY.z - 0.012;
      w.push(FR.pipe([[sW + 0.07, C - 0.07, z * 0.55], [sW + 0.2, bayCeil(0.85) - 0.03, z * 0.85], [sW + 0.3, FR.BAY_CEIL_WALL - 0.03, z * zw], [BD.pdu - 0.3, BD.y + 0.03, z * zw], [BD.pdu - 0.05, BD.y + 0.01, z * zw]], 0.008, 5, 20));
      // out through the ceiling's outer slope, over the bleed duct under the inlet floor, over the side-bay roof
      // (between the side-bay roof and the bottom of the F-2 lobe above it, outboard of the weapons hydraulic branch)
      const DA = M(10.05), TA = M(10.6), yR = -0.425;
      w.push(FR.pipe([[sW + 0.07, C - 0.05, z * 0.55], [sW + 0.15, bayCeil(0.78) - 0.03, z * 0.78], [sW + 0.17, bayCeil(0.84) + 0.06, z * 0.86], [sW + 0.2, -0.43, z * 1.0], [sW + 0.25, yR, z * 1.3], [sW + 0.4, yR, z * 1.5], [DA - 0.08, yR, z * 1.5], [DA - 0.01, -0.435, z * 1.47]], 0.008, 5, 40));
      w.push(FR.pipe([[DA - 0.08, yR, z * 1.5], [TA - 0.1, yR, z * 1.5], [TA - 0.02, -0.445, z * 1.45]], 0.007, 5, 16));
    }
    P('Stores management system', {
      system: 'Weapons', material: 'Stores-management processor and two weapon interface units, shielded wiring', mass: 22, count: 3,
      explode: [0.5, -1.45, 0],
      desc: 'Lockheed Martin Tactical Aircraft Systems supplied the stores management system, which sequences each shot: open the doors, run the AVEL or trapeze, fire the missile, close the doors. Interface units at the front of the bay fan its commands out to every launcher and door drive (positions approximate).',
    }, [mesh(merge(g), F.box()), mesh(merge(w), F.harness())]);
  }

  // ------------------------------------------------------------------ M61A2 gun and ammunition system
  {
    const gz = 1.72, gy = 0.0;
    const g = [];
    // 1.83 m (71.93 in) overall: barrels s 8.55–10.0, rotor housing to s 10.38
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.push(FR.cylX(9.275, gy + Math.cos(a) * 0.06, gz + Math.sin(a) * 0.06, 1.45, 0.019, 0.022, 8));
    }
    g.push(FR.cylX(8.69, gy, gz, 0.06, 0.09, 0.09, 16));                               // muzzle clamp
    g.push(FR.cylX(9.72, gy, gz, 0.06, 0.09, 0.09, 16));                               // mid-barrel clamp, aft of the spar lug and frame
    g.push(FR.cylX(10.19, gy, gz, 0.38, 0.11, 0.09, 16));                              // rotor and housing
    g.push(new THREE.BoxGeometry(0.26, 0.14, 0.14).translate(X(10.25), gy - 0.05, gz - 0.1));    // feeder / clearing unit
    // muzzle blast trough up to the gun port in the glove skin
    g.push(rectTube([[8.6, 0.045, gz], [8.6, 0.085, gz]], 0.12, 0.2, { n: 2, up: [1, 0, 0] }));
    P('M61A2 20 mm cannon', {
      system: 'Weapons', material: 'Steel barrels, lightweight composite housing', mass: 92, massSource: 'GD-OTS F-22A 20 mm gun system sheet: 202 lb (91.6 kg)',
      explode: [0.9, 1.35, 1.4], callout: true, anchor: [X(9.4), gy + 0.18, gz],
      desc: 'A six-barrel 20 mm Gatling gun in the right wing root, 1.83 m (71.93 in) long. Mechanically it is an M61A1 with thinner barrels, which cut its weight from 248 lb to 202 lb; its rate is switchable between 4,000 and 6,000 rounds per minute (about 100 per second).',
    }, mesh(merge(g), F.gun()));
    // hydraulic drive behind the breech, geared to the rotor, with a flexible shaft to the conveyor
    let gunDrive = null;
    {
      const d = [FR.boxS(10.52, 0.05, 1.6, 0.2, 0.16, 0.13), FR.cylX(10.68, 0.05, 1.6, 0.12, 0.055, 0.05, 14)];   // gearbox, then motor; container starts at s 10.75
      d.push(FR.pipe([[10.45, 0.05, 1.64], [10.41, 0.045, 1.7], [10.37, 0.02, 1.72]], 0.025, 8, 6));      // output to the rotor
      gunDrive = d;
    }
    // linear linkless ammunition handling system: a composite container laid across the belly behind the main bay,
    // a single conveyor loop of 473 elements through it, a semi-flexible recoil track up to the ammunition transfer
    // unit on the gun, and a drive shaft from the gun drive to the container (GD-OTS; Wolff, NDIA 2007)
    {
      const A = FR.AMMO, sm = (A.s0 + A.s1) / 2, ym = (A.y0 + A.y1) / 2, zm = (A.z0 + A.z1) / 2;
      const a = [FR.boxS(sm, ym, zm, A.s1 - A.s0, A.y1 - A.y0, A.z1 - A.z0 - 0.12)];
      // turnaround guide housings at both ends, a little proud of the panels; access gates in the top cover
      const ends = [];
      for (const z of [A.z0 + 0.04, A.z1 - 0.04]) ends.push(FR.boxS(sm, ym, z, A.s1 - A.s0 + 0.012, A.y1 - A.y0 + 0.012, 0.08));
      for (const z of [-0.3, 0.3, 0.9]) ends.push(FR.boxS(sm, A.y1 + 0.004, z, 0.16, 0.008, 0.22));
      // the recoil track: a chute of articulated links from the container's gun end up and forward to the transfer
      // unit under the breech; feed and return lanes side by side
      const track = [[A.s0 + 0.12, A.y1 - 0.02, A.z1 - 0.1], [A.s0 + 0.1, -0.62, A.z1 - 0.06], [A.s0 + 0.02, -0.42, A.z1 + 0.06], [10.62, -0.24, 1.55], [10.44, -0.14, 1.61], [10.31, -0.1, 1.63]];
      const ch = [rectTube(track, 0.14, 0.07, { n: 20 })];
      // link joints along the track
      const tu = [FR.boxS(10.27, -0.09, 1.63, 0.14, 0.1, 0.15)];                                  // ammunition transfer unit
      P('Linear linkless ammunition system', {
        system: 'Weapons', material: 'Glass / carbon-epoxy container panels on aluminium honeycomb, PEEK conveyor elements, semi-flexible recoil track, transfer unit', mass: 187,
        explode: [0.2, -1.45, 0.6],
        desc: 'Holds 480 rounds on one continuous conveyor of 473 composite elements that loops through a 2.3 m container laid across the belly behind the main weapons bay, just forward of the right main-gear well (T.O. 00-105E-9; GD-OTS). A semi-flexible recoil track carries the rounds up to the transfer unit on the gun and lets the belt move with the recoiling gun, and the fired cases ride back into the container instead of being thrown overboard. GD-OTS gives 178 lb (81 kg) for the feed system and 288 lb (131 kg) for a full load of ammunition.',
      }, [mesh(merge(a), F.boxLight()), mesh(merge(ends), F.alu()), mesh(merge(ch), F.box()), mesh(merge(tu), F.gun())]);
      // the gun drive's flexible container drive shaft runs down beside the recoil track to the container's drive end
      const f = [FR.pipe([[10.6, -0.02, 1.66], [10.68, -0.2, 1.6], [10.82, -0.42, A.z1 + 0.1], [A.s0 + 0.15, -0.64, A.z1 + 0.02], [A.s0 + 0.16, A.y1 - 0.01, A.z1 - 0.05]], 0.014, 6, 24)];
      P('M61A2 hydraulic gun drive & flexible shafts', {
        system: 'Weapons', material: 'Hydraulic motor and gearbox (two subassemblies in one unit), flexible container drive shaft', mass: 24,
        explode: [0.4, 1.7, 1.55],
        desc: 'Aircraft M61s are hydraulically driven: one motor at the breech spins the rotor and barrels and, through a flexible drive shaft down to the container, the ammunition conveyor, so gun and feed always stay in step. The F-22\'s drive is two subassemblies in one unit, started by a computer command or the trigger (GD-OTS lists the hydraulic drive, container drive shaft and transfer unit as separate replaceable units).',
      }, [mesh(merge(gunDrive), F.hyd()), mesh(merge(f), F.steel())]);
    }
    // gun-port door: flush panel on the upper glove over the muzzle
    const gst = [8.45, 8.6, 8.75];
    const grid = toothedGrid((s, u) => { const z = lerp(1.64, 1.8, u); return [X(s), FR.topAt(s, z) + 0.004, z]; }, gst, { width: 0.16 });
    const door = slab(grid, () => [0, -0.02, 0], V(0, 1, 0));
    const h = hinge(mesh(door, F.door()), V(X(8.75), FR.topAt(8.75, 1.64), 1.64), V(X(8.75), FR.topAt(8.75, 1.8), 1.8), V(X(8.45), 0.2, 1.72), V(0, -1, 0));
    P('Gun-port door', {
      system: 'Weapons', skin: true, material: 'Composite door, saw-tooth edges', mass: 4,
      explode: [1.2, 1.75, 1.45],
      desc: 'Covers the muzzle in normal flight and snaps open hydraulically only while the gun fires, so the port adds nothing to the radar signature the rest of the time.',
    }, h.pivot);
    anim.gunDoor = h;
  }
}
