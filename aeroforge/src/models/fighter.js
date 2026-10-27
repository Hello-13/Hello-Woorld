// Lockheed Martin / Boeing F-22A Raptor — air-dominance fighter, modelled system by system at
// real scale (18.92 m long, 13.56 m span, 5.08 m tall). Axes: nose toward +x, y up, right wing
// toward +z; fuselage stations s are metres aft of the nose (x = 9.46 − s). The geometry lives in
// ./f22/: layout.js / frame.js (outer mould line), airframe.js, propulsion.js, systems.js,
// avionics.js, weapons.js, gear.js and cockpit.js. Military detail stays at the level of public fact sheets and museum
// cutaways; positions of internal equipment are approximate where they are not published.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { decal, stencilText, panelOutline } from '../engine/decals.js';
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

/**
 * Low-visibility tail markings, as painted on the outer face of each fin: a light grey wing code over the serial (the
 * fiscal-year digits stacked small beside "AF", the last three digits large) and a plain shield outline where the
 * command badge goes. The ink is a lighter grey than the fin, so it reads at low contrast as on the real jet. The badge
 * is a generic outline, not any command's artwork; the code and serial are illustrative.
 */
const tailMarkings = (code, fy, serial, ink = 'rgba(176,182,188,0.92)') => decalTexture(`f22.tail.${code}.${fy}.${serial}.${ink}`, 512, 512, (ctx, w, h) => {
  ctx.fillStyle = ink; ctx.strokeStyle = ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // shield outline (badge position, upper right of the code)
  const bx = w * 0.62, by = h * 0.08, bw = w * 0.14, bh = h * 0.15;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bh * 0.55);
  ctx.quadraticCurveTo(bx + bw, by + bh * 0.9, bx + bw / 2, by + bh);
  ctx.quadraticCurveTo(bx, by + bh * 0.9, bx, by + bh * 0.55);
  ctx.closePath(); ctx.stroke();
  // wing code
  ctx.font = '700 190px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.fillText(code, w / 2, h * 0.62);
  // serial: "AF" over the fiscal year, small, then the last digits
  ctx.font = '700 46px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('AF', w * 0.36, h * 0.75);
  ctx.fillText(fy, w * 0.36, h * 0.83);
  ctx.textAlign = 'left';
  ctx.font = '700 104px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.fillText(serial, w * 0.38, h * 0.84);
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
  const ctx = { P, anim, A, attitude };

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
    const d = decal(m, tex, { ...opts, into: part });
    // keep only the faces turned toward the projection: where a thin surface (a wing's trailing edge, a fin) lies
    // wholly inside the box, the far skin would otherwise carry a mirrored copy
    const g = d.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const dir = new THREE.Vector3(...opts.dir).normalize(), n = new THREE.Vector3();
    const keep = [];
    for (let i = 0; i < P.count; i += 3) {
      n.set(0, 0, 0);
      for (let k = 0; k < 3; k++) n.x += N.getX(i + k), n.y += N.getY(i + k), n.z += N.getZ(i + k);
      if (n.normalize().dot(dir) > 0.2) keep.push(i);
    }
    if (keep.length * 3 < P.count) {
      const take = (A, w) => { const out = new Float32Array(keep.length * 3 * w); keep.forEach((i, j) => { for (let k = 0; k < 3 * w; k++) out[j * 3 * w + k] = A.array[i * w + k]; }); return new THREE.BufferAttribute(out, w); };
      const ng = new THREE.BufferGeometry();
      ng.setAttribute('position', take(P, 3)); ng.setAttribute('normal', take(N, 3)); if (U) ng.setAttribute('uv', take(U, 2));
      g.dispose();
      d.geometry = ng;
    }
    part.add(d);
  };
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    // tail code on the outer face of each fin: the fins lean outboard by the cant, so the span runs along
    // (0, cos c, ±sin c) and the outer face's normal is (0, −sin c, ±cos c); the projection box runs from the fin's
    // mid-plane out past its outer skin, so it cannot reach the inner face
    const c = FR.FIN.cant;
    const n = [0, -Math.sin(c), Math.cos(c) * side];
    const sp = 1.15;
    const at = [X(FR.FIN.rootS + 1.2 + sp * Math.tan(FR.FIN.sweep)), FR.FIN.rootY + sp * Math.cos(c), side * (FR.FIN.rootZ + sp * Math.sin(c))].map((v, i) => v + n[i] * 0.07);
    add(`Vertical tail (${R})`, tailMarkings('FF', '05', '100'), { at, dir: n, size: [1.45, 1.45, 0.14] });
    add(`Wing skin (${R})`, stencilText('NO STEP', 'rgba(30,34,38,0.85)', true), { at: [X(FR.WM(13.0)), FR.wingY(3.2) + 0.12, side * 3.2], dir: [0, 1, 0], size: [0.6, 0.15, 0.3], angle: Math.PI / 2 });
  }
  // small servicing panels too small to model as doors: single-point refuel and hydraulic / oil fill
  // on the belly ahead of the engine bays, battery and oxygen-system service under the forward fuselage (positions approximate)
  for (const [s, z, w, l] of [[11.22, -0.45, 0.26, 0.2], [11.22, 0.45, 0.22, 0.18], [11.0, -1.25, 0.18, 0.18], [11.0, 1.25, 0.18, 0.18]]) {
    add('Intake trunk & lower fuselage skin', panelOutline('f22.service'), { at: [X(s), -FR.bD(s) - 0.01, z], dir: [0, -1, 0], size: [l, w, 0.12] });
  }
  for (const side of [1, -1]) add('Forward fuselage skin', panelOutline('f22.service'), { at: [X(6.4), FR.bottomAt(6.4, 0.32) - 0.01, side * 0.32], dir: [0, -1, 0.1 * side], size: [0.3, 0.2, 0.15] });
  // national insignia: upper surface of the left wing and lower surface of the right wing only, as on the jet
  add('Wing skin (left)', usafInsignia(), { at: [X(FR.WM(11.6)), FR.wingY(4.4) + 0.12, -4.4], dir: [0, 1, 0], size: [1.4, 0.7, 0.3], angle: -Math.PI / 2 });
  add('Wing skin (right)', usafInsignia(), { at: [X(FR.WM(11.6)), FR.wingY(4.4) - 0.12, 4.4], dir: [0, -1, 0], size: [1.4, 0.7, 0.3], angle: -Math.PI / 2 });

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
    [/^(Forward fuselage tank|F-1B pump box|Centre fuselage tank|A-3 tank|A-1 aft feed tank|Wing tank)/, 0.6], [/^Engine bleed-air ducts$/, 0.65], [/^Inert-gas generating system/, 0.7],
    [/^F119 (shafts & bearings|annular combustor) /, 0.55], [/^Serpentine inlet duct /, 0.6], [/^Inlet throat & boundary-layer bleed /, 0.6], [/^AIM-120C AMRAAM/, 0.6],
    // broad thin surfaces read as solid sheets in X-ray (each face adds its glow); the control surfaces, nozzle flaps
    // and booms are drawn faint like the skins they belong to
    [/^(Stabilator|Leading-edge flap|Flaperon|Aileron|Rudder) \(/, 0.15], [/^Nozzle (external flaps|transition duct)/, 0.25], [/^Aft boom /, 0.25],
    [/^Main bay centre divider$/, 0.4], [/^Cockpit tub & floor$/, 0.6], [/^LAU-142\/A AVEL/, 0.6],
  ];
  // and the big stacked volumes in the centre fuselage, which otherwise wash it out into a milky fog
  // (measured: with the skins, the inlet ducts, tanks, bays and frame stacks gave most of the glow behind the cockpit)
  const XRAY_LOW = [
    [/^(Centre fuselage tank|Wing tank A-2|F-1B pump box|Forward fuselage tank F-1A|A-1 aft feed tank|A-3 tank)/, 0.3], [/^Side bay & gear-well liners$/, 0.25],
    [/^Main weapons bay$/, 0.3], [/^Keel & weapons-bay longerons$/, 0.35], [/^Serpentine inlet duct /, 0.15], [/^Inlet throat & boundary-layer bleed /, 0.2],
    [/^F119 (augmentor|fan) /, 0.35], [/^Wing (titanium spars|RTM sine-wave spars|ribs) /, 0.4], [/^(Engine-bay frames|Mid-fuselage (aluminium frames|titanium bulkheads))$/, 0.35],
  ];
  for (const p of A.parts) {
    const i = p.userData.part;
    // the skins stack up to six deep over the mid and aft fuselage (outer skins, doors, panels, wing roots), so
    // they are drawn at 45 % of the shared faint-skin glow
    if (i.skin) i.xraySkinWeight = 0.45;
    const low = XRAY_LOW.find(([re]) => re.test(i.name));
    if (low) { i.xrayWeight = low[1]; continue; }
    if (i.xrayWeight < 1) continue;
    const hit = XRAY.find(([re]) => re.test(i.name));
    if (hit) i.xrayWeight = hit[1];
  }
  // with about 300 parts packed into an 18.9 m airframe, every part is drawn at 75 % of the standard X-ray glow, so
  // the centre and aft fuselage stay readable instead of saturating (and blooming) where dozens of layers overlap
  for (const p of A.parts) { const i = p.userData.part; if (!i.skin) i.xrayWeight = Math.max(0.1, (i.xrayWeight ?? 1) * 0.75); }

  A.finalize();

  // ------------------------------------------------------------------ behaviour
  const state = {
    gear: 1, bay: 0, pitch: 0, roll: 0, yaw: 0, throttle: 0.0, mach: 0.2, altitude: 0, alpha: 0,
    airborne: 0, flight: null, strobeT: 0,
  };
  const targets = { gear: 1, bay: 0, airborne: 0 };
  const approach = (cur, tgt, rate, dt) => cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);
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
    sources: 'USAF F-22A fact sheet; Lockheed Martin F-22 product card; Pratt & Whitney F119-PW-100 fact sheet; T.O. 00-105E-9 (aircraft emergency rescue information, F-22A segment: fuel cells and capacities, APU / stored-energy system, battery, access-panel maps incl. the gear-door panels, gear stations and track, accumulators in the main wheel wells, ammunition container, bypass and ACFC doors); Michelin aircraft tire data (F-22: main 37 × 11.5 R18, nose 23.5 × 7.5 R10); GlobalSecurity F-22 flight controls and landing gear (nose gear retracts forward, main gear outward; Menasco AerMet 100 legs, dual-piston main strut: GlobalSecurity only, now paywalled); DLA procurement notices (F-22 landing gear: Goodrich Corporation, CAGE 6K4C8, Haltom City TX); NAWDC orthographic F-22A views (outline, doors and panels); General Dynamics OTS F-22A 20 mm gun system data; Wolff, NDIA Gun & Missile Systems 2007 (F-22 linear linkless ammunition handling system); USAF AIM-120 fact sheet; FAS DoD-101 F-22 page (contractors, hardpoints) / GlobalSecurity (LAU-142/A, LAU-141/A); Hydraulics & Pneumatics, "Hydraulics efficiently operate weapon bay doors on F-22 Raptor" (Jul 1998: bifold doors, AVEL, gun drive, ammunition system); Flight International: "Building the F-22" (Jan 1996: section materials, RTM spars, booms), "Allied near to completing F-22…" (Apr 1997: APGS); SAE 981544 and 2000-01-2266 (F-22 ECS/TMS); Curtiss-Wright and Eaton releases (LEF / weapons-bay actuation, PV3-115 pumps); 75th Air Base Wing (AMAD test stand); DSIAC (canopy); SAWE paper 3026 (aft-fuselage EB welding); Virginia Tech AOE design notes (geometry); Wikipedia: Lockheed Martin F-22 Raptor (dimensions, weights, 42 % titanium / 24 % composite structure, canopy 140 × 45 × 27 in, APU in the left wing root, centre-split main bay, BRAG valve / ABOS, IEEE 1394B), Pratt & Whitney F119 (3 + 6 stages, variable IGVs, blisks, 1 + 1 counter-rotating turbines, BPR 0.30, OPR 26, vaned three-zone augmentor, ±20° nozzle, colour-coded harnesses), M61 Vulcan (M61A2 1.83 m, 92 kg), ACES II, AN/APG-77.',
    fleetTag: 'Mach 2.25',
    aero: true,
    root: A.root,
    attitude,
    parts: A.parts,
    view: { dir: [1.05, 0.5, 1.15], fill: 1.0 },
    // Showroom fill for this jet: the look's hemisphere is near black below the horizon, which left every face turned
    // down or away from the key (the sides below the chine, trunks, belly, the far fin) black. A grey bounce from the
    // floor and a dimmer, neutral sky keep the grey paint grey all round, as in daylight photos; a slightly softer key
    // keeps the lit tops from washing out to near white.
    lighting: {
      showroom: { hemi: [0x46505c, 0x7d858e, 2.3], key: { color: 0xfff8f0, intensity: 1.8 }, rim: 1.5 },
      hangar: { hemi: [0xbfd2ff, 0x6c6a66, 0.6] },
    },
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
      // The gear retracts only in flight: on the ground (the showroom and hangar looks) the jet always stands on its
      // wheels, so it can never hang at gear-down height with the gear up. (The lab raises the gear together with
      // "In flight", which lifts the jet off the floor into the sky look.)
      // On landing the jet holds its height until the gear is down, so the wheels meet the floor extended.
      state.gear = approach(state.gear, targets.airborne ? targets.gear : 1, 0.4, dt);
      state.bay = approach(state.bay, targets.bay, 1.2, dt);
      state.airborne = approach(state.airborne, targets.airborne ? 1 : state.gear > 0.98 ? 0 : state.airborne, 0.5, dt);

      // landing gear: on retraction the legs swing up first (ret 0 → 0.82) and the doors close behind them
      // (0.84 → 1); on extension the doors open first and the legs follow; the doors stay open with the gear down
      const ret = 1 - state.gear;
      anim.gearSet(smooth(0, 0.82, ret), 1 - smooth(0.84, 1, ret));

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
      // the glow disc deep in each augmentor shows only with the engines running (cold, the duct is dark grey metal),
      // and never in the exploded view, where it would float free of the parted engine
      const glow = run * (0.25 + thr * 2.4 + ab * 2.2);
      anim.turbine.emissiveIntensity = glow;
      for (const g of anim.glows) g.mesh.visible = glow > 0.01 && g.part.position.distanceToSquared(g.part.userData.base) < 1e-6;

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
