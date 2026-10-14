// Lockheed Martin / Boeing F-22A Raptor — air-dominance fighter, modelled system by system at
// real scale (18.92 m long, 13.56 m span, 5.08 m tall). Axes: nose toward +x, y up, right wing
// toward +z; fuselage stations s are metres aft of the nose (x = 9.46 − s). The geometry lives in
// ./f22/: layout.js / frame.js (outer mould line), airframe.js, propulsion.js, systems.js,
// avionics.js, weapons.js, gear.js and cockpit.js. Military detail stays at the level of public fact sheets and museum
// cutaways; positions of internal equipment are approximate where they are not published.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { decal, tailCode, stencilText, panelOutline } from '../engine/decals.js';
import { decalTexture } from '../engine/surface.js';
import { vaporConeMaterial } from '../engine/effects.js';
import { recoveryTemperature } from '../physics/atmosphere.js';
import * as FR from './f22/frame.js';
import { buildAirframe } from './f22/airframe.js';
import { buildPropulsion } from './f22/propulsion.js';
import { buildSystems } from './f22/systems.js';
import { buildAvionics } from './f22/avionics.js';
import { buildWeapons } from './f22/weapons.js';
import { buildGear } from './f22/gear.js';
import { buildCockpit } from './f22/cockpit.js';
import { buildAccess } from './f22/access.js';
import { buildThermal } from './f22/thermal.js';
import { buildWiring } from './f22/wiring.js';

const { X, DEG } = FR;
const clamp = FR.clamp;
const smooth = FR.smooth;

/** Low-visibility USAF national insignia (star and bar, outline only). */
const usafInsignia = (ink = 'rgba(36,41,46,0.9)') => decalTexture(`f22.usaf.${ink}`, 512, 256, (ctx, w, h) => {
  ctx.strokeStyle = ink;
  ctx.lineWidth = 9;
  const cx = w / 2, cy = h / 2, R = h * 0.38;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? R * 0.38 : R;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  const bh = R * 0.42;
  ctx.strokeRect(cx + R * 0.82, cy - bh / 2 + R * 0.12, R * 1.15, bh);
  ctx.strokeRect(cx - R * 0.82 - R * 1.15, cy - bh / 2 + R * 0.12, R * 1.15, bh);
});

export function buildFighter() {
  const A = new Assembly();
  const attitude = new THREE.Group();
  A.root.add(attitude);
  const P = (name, info, objs, parent = attitude) => A.part(name, info, objs, parent);
  const anim = {
    lef: [], flaperon: [], aileron: [], stab: [], rudder: [], tvc: [], gear: [], gearDoors: [],
    bay: { doors: [], ejectors: [], trapeze: [] },
  };
  const ctx = { P, anim, A };

  // order matters only for shared lookups: the airframe publishes station lists the doors reuse
  const air = buildAirframe(ctx);
  ctx.sA = air.sA;
  buildPropulsion(ctx);
  buildCockpit(ctx);
  buildWeapons(ctx);
  buildGear(ctx);
  buildSystems(ctx);
  buildAvionics(ctx);
  buildThermal(ctx);
  buildWiring(ctx);
  buildAccess(ctx);

  // ------------------------------------------------------------------ markings (projected decals)
  attitude.updateMatrixWorld(true);
  const partOf = (name) => A.parts.find((p) => p.name === name);
  const firstMesh = (part) => { let m = null; part.traverse((o) => { if (!m && o.isMesh && !o.userData.fx) m = o; }); return m; };
  const add = (name, tex, opts) => {
    const part = partOf(name);
    if (!part) return;
    const m = firstMesh(part);
    part.add(decal(m, tex, { ...opts, into: part }));
  };
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    // tail code on the outer face of each canted fin
    const c = FR.FIN.cant;
    const n = [0, Math.sin(c), Math.cos(c) * side];
    const sp = 1.25;
    const at = [X(FR.FIN.rootS + 1.25 + sp * Math.tan(FR.FIN.sweep)), FR.FIN.rootY + sp * Math.cos(c), side * (FR.FIN.rootZ + sp * Math.sin(c))].map((v, i) => v + n[i] * 0.06);
    add(`Vertical tail (${R})`, tailCode('FF', 'AF 05-4100'), { at, dir: n, size: [1.25, 1.25, 0.12] });
    // national insignia on the intake trunk sides
    add(`Caret inlet cowl (${R})`, usafInsignia(), { at: [X(7.75), -0.42, side * 1.72], dir: [0, -0.15, side], size: [0.9, 0.45, 0.25] });
    add(`Wing skin (${R})`, stencilText('NO STEP', 'rgba(30,34,38,0.85)', true), { at: [X(13.0), FR.wingY(3.2) + 0.12, side * 3.2], dir: [0, 1, 0], size: [0.6, 0.15, 0.3], angle: Math.PI / 2 });
  }
  // small servicing panels too small to model as doors: single-point refuel and hydraulic / oil fill
  // on the belly ahead of the engine bays, battery and oxygen-system service under the forward fuselage
  for (const [s, z, w, l] of [[12.6, -0.45, 0.26, 0.2], [12.6, 0.45, 0.22, 0.18], [13.1, -1.15, 0.18, 0.18], [13.1, 1.15, 0.18, 0.18]]) {
    add('Intake trunk & lower fuselage skin', panelOutline('f22.service'), { at: [X(s), -FR.bD(s) - 0.01, z], dir: [0, -1, 0], size: [l, w, 0.12] });
  }
  for (const side of [1, -1]) add('Forward fuselage skin', panelOutline('f22.service'), { at: [X(6.3), FR.bottomAt(6.3, 0.55) - 0.01, side * 0.55], dir: [0, -1, 0.25 * side], size: [0.3, 0.22, 0.15] });
  add('Wing skin (left)', usafInsignia(), { at: [X(11.6), FR.wingY(4.4) + 0.12, -4.4], dir: [0, 1, 0], size: [1.4, 0.7, 0.3], angle: -Math.PI / 2 });
  add('Forward fuselage skin', stencilText('U.S. AIR FORCE', 'rgba(36,40,46,0.85)'), { at: [X(5.0), FR.aYC(5.0) - 0.2, 0.86], dir: [0, -0.3, 1], size: [1.1, 0.22, 0.3] });

  // ------------------------------------------------------------------ vapour cone (effect)
  const vcMat = vaporConeMaterial();
  const vcGeo = new THREE.CylinderGeometry(0.4, 3.4, 9, 48, 8, true);
  vcGeo.rotateZ(-Math.PI / 2);
  const vapor = new THREE.Mesh(vcGeo, vcMat);
  vapor.position.set(X(6.3), 0.1, 0);
  vapor.userData.fx = true;
  vapor.renderOrder = 11;
  vapor.visible = false;
  attitude.add(vapor);

  // X-ray legibility: dense stacked parts (blade rows, frame stacks, long harness and pipe runs, big
  // tanks) glow additively in X-ray, so they are dimmed in proportion to how much they stack up
  const XRAY = [
    [/^Upper longerons & canopy rails$/, 0.45], [/^Engine-bay frames$/, 0.45], [/^Forward fuselage frames & bulkheads$/, 0.5], [/^Keel & weapons-bay longerons$/, 0.6],
    [/^Wing (titanium spars|RTM sine-wave spars|ribs) /, 0.5], [/^(Fin box|Stabilator torque box & spindle) /, 0.55], [/^Side bay & gear-well liners$/, 0.5], [/^Main weapons bay$/, 0.6],
    [/^Main wiring harnesses$/, 0.6], [/^Hydraulic lines /, 0.6], [/^Landing-gear & brake hydraulic lines$/, 0.65], [/^Fuel transfer lines$/, 0.7], [/^Refuelling manifold$/, 0.7],
    [/^(Forward fuselage tank|Centre fuselage tank|Aft fuselage feed tank|Wing tank)/, 0.6], [/^Engine bleed-air ducts$/, 0.65], [/^Inert-gas generating system/, 0.7],
    [/^F119 (shafts & bearings|annular combustor) /, 0.55], [/^Serpentine inlet duct /, 0.6], [/^Inlet throat & boundary-layer bleed /, 0.6], [/^AIM-120C AMRAAM/, 0.75],
  ];
  for (const p of A.parts) {
    const i = p.userData.part;
    if (i.xrayWeight < 1) continue;
    const hit = XRAY.find(([re]) => re.test(i.name));
    if (hit) i.xrayWeight = hit[1];
  }

  A.finalize();

  // ------------------------------------------------------------------ behaviour
  const state = {
    gear: 1, bay: 0, pitch: 0, roll: 0, yaw: 0, throttle: 0.0, mach: 0.2, altitude: 0, alpha: 0,
    airborne: 0, flight: null, strobeT: 0,
  };
  const targets = { gear: 1, bay: 0, airborne: 0 };
  const approach = (cur, tgt, rate, dt) => cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);
  const qI = new THREE.Quaternion();
  const qT = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), mid = new THREE.Vector3();
  const stretch = (m, a, b) => {
    tmp.subVectors(b, a);
    const L = Math.max(1e-4, tmp.length());
    m.position.copy(mid.addVectors(a, b).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(up, tmp.normalize());
    m.scale.set(1, L, 1);
  };
  const ej0 = new THREE.Vector3(), ej1 = new THREE.Vector3(), tp = new THREE.Vector3();

  const vehicle = {
    id: 'fighter',
    designation: 'F-22A',
    name: 'RAPTOR',
    role: 'Air dominance fighter',
    tagline: 'Lockheed Martin / Boeing · stealth · supercruise · thrust vectoring',
    summary: 'The F-22A Raptor is the US Air Force\'s fifth-generation air-dominance fighter, built by Lockheed Martin with Boeing (195 built, 2005 initial operating capability). It combines very low observability — aligned edges, caret inlets, serpentine ducts, internal weapons — with supercruise on two Pratt & Whitney F119 engines, 2-D thrust-vectoring nozzles and sensor fusion of the AN/APG-77 radar and passive receivers.',
    specs: [
      ['Length', '18.92 m (62 ft 1 in)'], ['Wingspan', '13.56 m (44 ft 6 in)'], ['Height', '5.08 m (16 ft 8 in)'],
      ['Wing area', '78.04 m² (840 ft²)'], ['Wing sweep', '42° LE / −17° TE'], ['Empty weight', '19,700 kg'],
      ['Max take-off', '38,000 kg'], ['Internal fuel', '8,200 kg (18,000 lb)'],
      ['Engines', '2 × P&W F119-PW-100 (BPR 0.30, OPR 26)'], ['Thrust', '≈ 116 kN dry / 156 kN with A/B, each'], ['Thrust vectoring', '2-D nozzles, ±20° pitch'],
      ['Max speed', 'Mach 2.25 at altitude'], ['Supercruise', 'Mach 1.76 (published)'],
      ['Service ceiling', '19,812 m (65,000 ft)'], ['Load limit', '+9 / −3 g'],
      ['Armament', 'M61A2 20 mm (480 rds), 6 × AIM-120C, 2 × AIM-9X'], ['Crew', '1'],
    ],
    heroStats: [['2.25', 'Mach', 'Top speed'], ['1.76', 'Mach', 'Supercruise'], ['2 × 156', 'kN', 'Afterburning thrust']],
    sources: 'USAF F-22A fact sheet; Lockheed Martin F-22 product card; Pratt & Whitney F119-PW-100 fact sheet; General Dynamics OTS F-22A 20 mm gun system data; USAF AIM-120 fact sheet; FAS DoD-101 F-22 page (contractors, hardpoints) / GlobalSecurity (LAU-142/A, LAU-141/A); Hydraulics & Pneumatics, "Hydraulics efficiently operate weapon bay doors on F-22 Raptor" (Jul 1998: bifold doors, AVEL, gun drive, ammunition system); Flight International: "Building the F-22" (Jan 1996: section materials, RTM spars, booms), "Allied near to completing F-22…" (Apr 1997: APGS); SAE 981544 and 2000-01-2266 (F-22 ECS/TMS); Curtiss-Wright and Eaton releases (LEF / weapons-bay actuation, PV3-115 pumps); 75th Air Base Wing (AMAD test stand); DSIAC (canopy); SAWE paper 3026 (aft-fuselage EB welding); Virginia Tech AOE design notes (geometry); Wikipedia: Lockheed Martin F-22 Raptor (dimensions, weights, 42 % titanium / 24 % composite structure, canopy 140 × 45 × 27 in, APU in the left wing root, centre-split main bay, BRAG valve / ABOS, IEEE 1394B), Pratt & Whitney F119 (3 + 6 stages, variable IGVs, blisks, 1 + 1 counter-rotating turbines, BPR 0.30, OPR 26, vaned three-zone augmentor, ±20° nozzle, colour-coded harnesses), M61 Vulcan (M61A2 1.83 m, 92 kg), ACES II, AN/APG-77.',
    fleetTag: 'Mach 2.25',
    aero: true,
    root: A.root,
    attitude,
    parts: A.parts,
    view: { dir: [1.05, 0.5, 1.15], fill: 1.0 },
    displaySize: 11,
    // a narrow scale centred on airframe heating: at Mach 2 the skins (≈ 370–385 K) sit mid-scale,
    // well clear of the −57 °C air (≈ 217 K, near black), while the hot section saturates above 600 K
    thermalRange: [200, 600],
    state,
    targets,
    fuel: ctx.fuel,
    setGear(v) { targets.gear = v ? 1 : 0; },
    setBay(v) { targets.bay = v ? 1 : 0; },
    setAirborne(v) { targets.airborne = v ? 1 : 0; },
    temperatureOf(info) {
      const f = state.flight;
      const T = f ? f.atm.T : 288;
      const M = f ? state.mach : 0;
      const T0 = T * (1 + 0.2 * M * M);                 // ideal stagnation temperature
      const heat = (k) => T + (T0 - T) * k;             // k = 1 stagnation point, ≈ 0.89 turbulent recovery
      const amb = f ? heat(0.89) : 288;
      // engine sections heat only while the engines run
      const run = state.running || 0;
      const thr = state.throttle, ab = Math.max(0, (thr - 0.8) / 0.2);
      const eng = (hot) => amb + run * Math.max(0, hot - amb);
      switch (info.thermalRole) {
        case 'stagnation': return heat(0.97);
        case 'leadingEdge': return heat(0.93);
        case 'fan': return eng(heat(1) + 25 + thr * 60);
        case 'compressor': return eng(heat(1) + 140 + thr * 480);
        case 'combustor': return eng(620 + thr * 480);
        case 'turbine': return eng(680 + thr * 560);
        case 'augmentor': return eng(560 + thr * 360 + ab * 620);
        case 'nozzle': return eng(520 + thr * 520 + ab * 460);
        default: break;
      }
      if (info.skin) return heat(0.89);
      if (info.system === 'Fuel') return Math.min(330, 290 + (T0 - T) * 0.15);
      if (info.system === 'Avionics' || info.system === 'Sensors') return 315;
      if (info.system === 'Hydraulics') return 345;
      if (info.system === 'Weapons') return heat(0.4);
      if (info.system === 'Crew systems') return 295;
      if (info.system === 'Propulsion') return eng(heat(1) + 60);
      return heat(0.6);
    },
    update(dt, t) {
      state.gear = approach(state.gear, targets.gear, 0.4, dt);
      state.bay = approach(state.bay, targets.bay, 1.2, dt);
      state.airborne = approach(state.airborne, targets.airborne, 0.5, dt);

      // landing gear: legs swing on their trunnions, main wheels turn flat, doors lead and follow
      const ret = 1 - state.gear;
      const ku = smooth(0, 1, ret);
      for (const g of anim.gear) {
        qT.copy(qI).slerp(g.q, ku);
        for (const p of g.pivots) p.quaternion.copy(qT);
        if (g.twist) g.twist.g.quaternion.setFromAxisAngle(g.twist.axis, g.twist.angle * smooth(0.15, 0.85, ret));
      }
      const doorOpen = smooth(0, 0.15, state.gear) * 1;
      for (const d of anim.gearDoors) d.h.set(d.angle * doorOpen);
      // braces fold, actuators telescope, door jacks follow their doors
      for (const link of anim.gearLinks) link(ku);

      // weapons bays: doors first, then the ejectors and trapeze launchers
      const b = state.bay;
      const kd = smooth(0, 0.4, b), ke = smooth(0.45, 1, b);
      for (const d of anim.bay.doors) d.h.set(d.angle * kd);
      // main bay bifold doors: the outer panel swings down to vertical while the inner panel, a beat
      // later, folds up against its inside face, so the door never reaches up into the bay
      const kq = clamp(b / 0.4, 0, 1);
      for (const d of anim.bay.bifold) { d.outer.set((Math.PI / 2) * smooth(0, 0.6, kq)); d.inner.set(Math.PI * smooth(0.3, 1, kq)); }
      for (const link of anim.bay.links) link(kd, ke);
      for (const e of anim.bay.ejectors) {
        e.holder.position.y = e.y0 - 0.23 * ke;
        for (const a of e.arms) {
          ej0.set(a.x, e.top, e.z);
          ej1.set(a.x, e.holder.position.y + 0.085, e.z);
          stretch(a.mesh, ej0, ej1);
        }
      }
      for (const tz of anim.bay.trapeze) {
        tz.holder.position.lerpVectors(tz.stow, tz.out, ke);
        if (tz.rail) tz.rail.position.copy(tz.holder.position);
        for (const a of tz.arms) {
          tp.copy(tz.holder.position).add(a.attach);
          stretch(a.arm, a.pivot, tp);
        }
      }

      // flight controls (degrees). +roll = right wing down, +pitch = nose up, +yaw = nose right
      const air = state.airborne;
      const flap = 12 * state.gear * air;
      const lef = clamp(state.alpha * 0.9, -2, 30) * air;
      for (const { h } of anim.lef) h.set(lef * DEG);
      for (const { h, side } of anim.flaperon) h.set((-state.roll * side * 20 + flap) * DEG);
      for (const { h, side } of anim.aileron) h.set(-state.roll * side * 25 * DEG);
      for (const { h, side } of anim.stab) h.set((-state.pitch * 25 - state.roll * side * 8) * DEG);
      for (const { h } of anim.rudder) h.set(state.yaw * 30 * DEG);
      const v = -state.pitch * 20 * DEG;
      for (const n of anim.tvc) {
        n.pivot.rotation.z = v;
        n.extU.rotation.z = v * 0.59;
        n.extL.rotation.z = v * 0.59;
      }

      // engines: plumes, afterburner and the turbine glow seen up the nozzle
      // engines run in the lab's flight mode, or on the ground when the lab asks for afterburner
      const thr = state.throttle;
      const ab = Math.max(0, (thr - 0.8) / 0.2);
      state.running = approach(state.running || 0, air > 0.05 || thr > 0.85 ? 1 : 0, 1.5, dt);
      const run = state.running;
      for (let i = 0; i < anim.plumes.length; i++) {
        const pm = anim.plumes[i];
        pm.uniforms.time.value = t;
        const isCore = i % 2 === 1;
        pm.uniforms.intensity.value = run * (isCore ? (thr > 0.04 ? 0.05 + thr * 0.35 + ab * 0.6 : 0) : ab * 1.1);
      }
      anim.turbine.emissiveIntensity = 0.2 + run * (thr * 2.4 + ab * 2.2);

      // transonic vapour cone in humid air
      const m = state.mach;
      const transonic = Math.max(0, 1 - Math.abs(m - 1.0) / 0.06);
      const humid = Math.max(0, 1 - state.altitude / 9000);
      vcMat.uniforms.strength.value = transonic * (0.3 + 0.7 * humid) * air;
      vcMat.uniforms.time.value = t;
      vapor.visible = vcMat.uniforms.strength.value > 0.01;

      // anti-collision strobes: one soft ~0.12 s pulse per second, only while the lab flies the jet
      if (targets.airborne && air > 0.5) {
        state.strobeT += dt;
        anim.strobe.emissiveIntensity = FR.strobeLevel(state.strobeT);
      } else {
        state.strobeT = 0;
        anim.strobe.emissiveIntensity = 0;
      }
      anim.taxiLight.emissiveIntensity = air > 0.5 && state.gear > 0.9 ? 3 : 0;

      // flight pose: lift off the platform and take up attitude
      attitude.position.y = air * 1.6 + Math.sin(t * 0.9) * 0.08 * air;
      attitude.rotation.z = air * (state.alpha * DEG * 0.9 + state.pitch * 0.06);
      attitude.rotation.x = air * state.roll * 0.35;
      attitude.rotation.y = -air * state.yaw * 0.08;
    },
  };
  return vehicle;
}
