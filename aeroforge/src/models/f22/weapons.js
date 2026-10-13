// F-22A internal weapons: the main bay with six AIM-120C on LAU-142/A AVEL ejectors, two side
// bays each with an AIM-9X on an LAU-141/A trapeze launcher, the M61A2 20 mm gun in the right
// wing root with its linear linkless ammunition handling system, and the doors that close them.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { lathe, ogiveProfile } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge } from './util.js';
import { stations, cavity } from './airframe.js';

const { X } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

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

export function buildWeapons(ctx) {
  const { P, anim } = ctx;
  const bay = anim.bay;

  // ------------------------------------------------------------------ main weapons bay structure
  {
    const { s0, s1, z } = FR.MAIN_BAY;
    const prof = (s) => {
      const D = FR.bD(s);
      return [[z, -D], [z, -0.45], [0.55, -0.24], [-0.55, -0.24], [-z, -0.45], [-z, -D]].map(([zz, y]) => [X(s), y, zz]);
    };
    const st = [s0, (s0 + s1) / 2, s1];
    const liner = FR.gridSurface(st.map(prof), { closed: false, uv: 'n' });
    const ends = [];
    for (const s of [s0, s1]) {
      const shape = new THREE.Shape(prof(s).map((p) => new THREE.Vector2(p[2], p[1])));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateY(Math.PI / 2);
      g.translate(X(s), 0, 0);
      ends.push(g);
    }
    const ribs = [];
    for (const s of [9.3, 10.4, 11.4]) {
      const p = prof(s);
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k], b = p[k + 1];
        const len = Math.hypot(a[1] - b[1], a[2] - b[2]);
        const g = new THREE.BoxGeometry(0.05, len, 0.06);
        g.rotateX(-Math.atan2(b[2] - a[2], b[1] - a[1]));
        g.translate(a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        ribs.push(g);
      }
    }
    // door actuators and hinge fittings along each door edge
    for (const sd of [1, -1]) for (const s of [9.0, 10.4, 11.8]) ribs.push(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8).rotateX(Math.PI / 2 - 0.5 * sd).translate(X(s), -0.62, sd * 0.68));
    P('Main weapons bay', {
      system: 'Weapons', material: 'Aluminium / composite bay structure, acoustic treatment', mass: 260,
      explode: [0, -0.75, 0],
      desc: 'A 3.9 m bay under the inlet ducts that holds six AIM-120 missiles, or two 1,000 lb GBU-32 JDAM bombs plus two AIM-120s. Carrying weapons inside keeps the outline clean; external stores would multiply the radar cross-section.',
    }, [mesh(liner, F.bay()), mesh(merge(ends), F.bay()), mesh(merge(ribs), F.alu())]);
  }

  // ------------------------------------------------------------------ main bay doors
  {
    const { s0, s1, z } = FR.MAIN_BAY;
    const st = ctx.sB.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const zs = [0.006, 0.2, 0.4, 0.6, z - 0.004].map((v) => v * side);
      const grid = st.map((s) => zs.map((zz) => [X(s), -FR.bD(s) - 0.002, zz]));
      const outer = slab(grid, () => [0, 0.035, 0], V(0, -1, 0));
      const p0 = V(X(s0), -FR.bD(s0), side * z), p1 = V(X(s1), -FR.bD(s1), side * z);
      const h = hinge([mesh(outer, F.skin())], p0, p1, V(X(10), -0.9, side * 0.2), V(0, -1, 0));
      P(`Main bay door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door with saw-tooth edges', mass: 55,
        explode: [0, -1.55, 0.35 * side],
        desc: 'Hinged at its outer edge and driven open hydraulically in a fraction of a second. Its forward and aft edges are saw-toothed so that their reflections join the few directions the planform already uses.',
      }, h.pivot);
      bay.doors.push({ h, angle: 1.85 });
    }
  }

  // ------------------------------------------------------------------ AIM-120C and LAU-142/A AVEL
  {
    const geo = missile({ length: 3.65, r: 0.089, nose: 0.5, wingSpan: 0.447, wingRoot: 0.38, wingAt: 1.45, finSpan: 0.447, finRoot: 0.26, finTip: 0.1 });
    const slots = [[0.13, -0.47], [0.39, -0.56], [0.645, -0.64]];
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const ms = [], ls = [];
      for (const [zz, y] of slots) {
        const holder = new THREE.Group();
        const m = mesh(geo, F.missile());
        const band = mesh(new THREE.CylinderGeometry(0.0905, 0.0905, 0.06, 20).rotateZ(Math.PI / 2).translate(0.9, 0, 0), F.missileBand(), { cast: false });
        holder.add(m, band);
        holder.position.set(X(10.43), y, side * zz);
        holder.rotation.x = (zz > 0.3 ? 0 : Math.PI / 4);
        ms.push(holder);
        // launcher: hanger body on the ceiling with the ejector arms reaching down to the missile
        const lg = new THREE.Group();
        const body = mesh(new THREE.BoxGeometry(2.1, 0.1, 0.13), F.boxLight());
        body.position.set(X(10.3), -0.3 - (y + 0.47) * 0.4, side * zz);
        lg.add(body);
        const arms = [];
        for (const ds of [-0.6, 0.6]) {
          const arm = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), F.steel());
          arm.position.set(X(10.3 + ds), 0, side * zz);
          lg.add(arm);
          arms.push(arm);
        }
        ls.push(lg);
        bay.ejectors.push({ holder, y0: y, arms: arms.map((a) => ({ mesh: a, x: a.position.x })), top: body.position.y - 0.05, z: side * zz });
      }
      P(`AIM-120C AMRAAM ×3 (${R} main bay)`, {
        system: 'Weapons', material: 'Steel / composite airframe, active radar seeker', mass: 152, massSource: 'USAF AIM-120 fact sheet (each)', count: 3,
        explode: [0, -1.05, 0.55 * side], callout: side > 0, anchor: [X(9.5), -0.55, side * 0.4],
        desc: 'Active-radar medium-range missiles, 3.65 m long and 17.8 cm in diameter (USAF fact sheet). The C model\'s clipped wings and fins were designed so that six fit in the F-22\'s main bay.',
      }, ms);
      P(`LAU-142/A AVEL launchers ×3 (${R})`, {
        system: 'Weapons', material: 'Mostly aluminium, pneumatic / hydraulic ejector', mass: 50, count: 3,
        explode: [0, -0.45, 0.35 * side],
        desc: 'AMRAAM Vertical Eject Launchers push each missile 9 in (23 cm) down and clear of the bay\'s turbulent airflow at over 25 ft/s (7.6 m/s) and up to 40 g, using aircraft hydraulics rather than explosive cartridges.',
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
      const grid = st.map((s) => {
        const wf = FR.wallFractions(s);
        return [wf[4], wf[5], wf[6], wf[7]].map((f) => { const [zz, y] = FR.wallB(s, f); return [X(s), y, side * (zz + 0.002)]; });
      });
      const door = slab(grid, () => [0, 0.01, -side * 0.035], V(0, 0, side));
      const top0 = grid[0][0], top1 = grid[grid.length - 1][0];
      const h = hinge(mesh(door, F.skin()), V(...top0), V(...top1), V(X(10), -0.8, side * 1.6), V(0, 0.3, side));
      P(`Side bay door (${R})`, {
        system: 'Skin & fairings', skin: true, material: 'Composite door', mass: 30,
        explode: [0, -0.3, 1.25 * side],
        desc: 'Hinged along its top edge on the side of the inlet trunk; it swings up and out so the trapeze launcher can carry the Sidewinder into the airflow.',
      }, h.pivot);
      bay.doors.push({ h, angle: 1.9, side: true });

      const holder = new THREE.Group();
      holder.add(mesh(geo9, F.missile()));
      holder.add(mesh(new THREE.SphereGeometry(0.03, 12, 8).translate(1.5, 0, 0), F.seeker(), { cast: false }));
      const rail = mesh(new THREE.BoxGeometry(2.3, 0.05, 0.06).translate(0, 0.095, 0), F.boxLight());
      holder.add(rail);
      const stow = V(X(10.05), -0.66, side * 1.45), out = V(X(10.05), -1.05, side * 1.88);
      holder.position.copy(stow);
      const arms = [];
      const armG = new THREE.Group();
      for (const ds of [-0.7, 0.7]) {
        const arm = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 8), F.steel());
        armG.add(arm);
        arms.push({ arm, pivot: V(X(10.05 + ds), -0.47, side * 1.22), attach: V(ds * -1, 0.095, 0) });
      }
      P(`AIM-9X Sidewinder (${R} side bay)`, {
        system: 'Weapons', material: 'Aluminium airframe, imaging-infrared seeker, thrust-vectoring vanes', mass: 85,
        explode: [0, -0.6, 1.05 * side],
        desc: 'Short-range infrared missile (3.02 m). Its imaging seeker has to see the target before launch, which is why the side-bay launcher swings it out into the open air first.',
      }, holder);
      P(`LAU-141/A trapeze launcher (${R})`, {
        system: 'Weapons', material: 'Steel arms, hydraulic drive, rail with plume deflector', mass: 45,
        explode: [0, -0.2, 0.8 * side],
        desc: 'Essentially an F-16 wingtip launch rail on a swinging hydraulic trapeze: doors open, the arms push the missile out, the seeker locks on, the missile fires off the rail and everything retracts within seconds.',
      }, armG);
      bay.trapeze.push({ holder, stow, out, arms });
    }
  }

  // ------------------------------------------------------------------ M61A2 gun and ammunition system
  {
    const gz = 1.52, gy = 0.3;
    const g = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.push(FR.cylX(9.15, gy + Math.cos(a) * 0.06, gz + Math.sin(a) * 0.06, 1.6, 0.019, 0.022, 8));
    }
    g.push(FR.cylX(8.48, gy, gz, 0.06, 0.1, 0.1, 16));
    g.push(FR.cylX(9.4, gy, gz, 0.06, 0.1, 0.1, 16));
    g.push(FR.cylX(10.05, gy, gz, 0.42, 0.11, 0.09, 16));
    g.push(new THREE.BoxGeometry(0.3, 0.16, 0.18).translate(X(10.2), gy - 0.06, gz - 0.12));
    P('M61A2 20 mm cannon', {
      system: 'Weapons', material: 'Steel barrels, lightweight composite housing', mass: 92,
      explode: [0.9, 1.35, 1.4], callout: true, anchor: [X(9.3), gy + 0.15, gz],
      desc: 'A six-barrel 20 mm Gatling gun buried in the right wing root above the intake, firing up to 6,000 rounds per minute (about 100 per second). It is a lighter version of the M61A1 used since the 1960s.',
    }, mesh(merge(g), F.gun()));
    const a = [];
    a.push(new THREE.BoxGeometry(2.3, 0.15, 0.36).translate(X(11.5), 0.5, 1.15));
    a.push(FR.pipe([[10.35, 0.5, 1.18], [10.25, 0.42, 1.35], [10.2, 0.34, 1.45]], 0.05, 6));
    a.push(FR.pipe([[10.4, 0.44, 1.05], [10.25, 0.3, 1.32]], 0.04, 6));
    P('Linear linkless ammunition system', {
      system: 'Weapons', material: 'Aluminium conveyor and storage container', mass: 230,
      explode: [0.2, 1.45, 1.2],
      desc: 'Holds 480 rounds and feeds them to the gun at up to 100 per second without links; spent cases are carried back into the container rather than thrown overboard where they could strike the airframe.',
    }, mesh(merge(a), F.boxLight()));
    // gun-port door: flush panel on the upper glove ahead of the muzzle
    const grid = [];
    for (const s of [8.0, 8.15, 8.3]) grid.push([1.43, 1.52, 1.61].map((z) => [X(s), FR.topAt(s, z) + 0.004, z]));
    const door = slab(grid, () => [0, -0.02, 0], V(0, 1, 0));
    const dm = F.skin().clone();
    dm.polygonOffset = true; dm.polygonOffsetFactor = -2; dm.polygonOffsetUnits = -2;
    const h = hinge(mesh(door, dm), V(X(8.3), FR.topAt(8.3, 1.43), 1.43), V(X(8.3), FR.topAt(8.3, 1.61), 1.61), V(X(8.0), 0.4, 1.52), V(0, -1, 0));
    P('Gun-port door', {
      system: 'Weapons', skin: true, material: 'Composite door', mass: 4,
      explode: [1.2, 1.6, 1.4],
      desc: 'Covers the muzzle in normal flight and snaps open hydraulically only while the gun fires, so the port adds nothing to the radar signature the rest of the time.',
    }, h.pivot);
    anim.gunDoor = h;
  }
}
