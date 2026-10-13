// GE Aerospace GE90-115B — the high-bypass turbofan of the Boeing 777-300ER, shown as a museum
// cutaway on a display cradle, inside its Boeing nacelle.
//
// Axes: the engine is built in a lathe frame (engine axis +y, intake forward; x = r·sin(phi),
// z = r·cos(phi); see ge90/layout.js) which is turned so that the engine axis lies along world +x
// (intake towards +x), world y is up and +z faces the default camera. In that frame +x is world
// down, so phi = 0 faces the viewer and phi = 3π/2 is the top (pylon).
// Cutaway: the casings lose the upper quadrant facing the viewer and the nacelle loses its whole
// viewer half. The spools turn — N1 (fan, booster, LP turbine) and N2 (HP compressor and turbine)
// at their own speeds — and the core blade rows are cut with the casings, blade by blade (see
// rotorRow in ge90/geom.js); the fan stays whole. Axisymmetric rotor drums are drawn cut and still.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { beam, mergeGeometries } from '../engine/geometry.js';
import { M } from '../engine/materials.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { inferno } from '../engine/effects.js';
import { setCut, sector, updateRotor, kept, phiOf } from './ge90/geom.js';
import { n1Demand, n2Line } from '../physics/turbofan.js';
import { STATIONS, NACELLE, coreAt, bypassAt, FAN_NOZZLE_Y, PLUG_TIP } from './ge90/layout.js';
import { buildNacelle } from './ge90/nacelle.js';
import { buildFan } from './ge90/fan.js';
import { buildCore } from './ge90/core.js';
import { buildAccessories } from './ge90/accessories.js';

const H = 2.6;                         // engine centreline height above the floor, m
const N1_RPM = 2355, N2_RPM = 9332;    // 100 % speeds (FAA TCDS E00049EN)
const SHOW = 0.02;                     // spools are shown turning at 1/50 of real speed
const DRY_MASS = 8761;                 // kg, 19,316 lb (EASA TCDS IM.E.002: includes starter and mounts)
// Boeing installation hardware and the display cradle, which the engine's dry mass excludes
// Boeing installation hardware, aircraft equipment driven or served by the engine (the 777's
// generators, hydraulic pump, pneumatic and fire-protection parts) and the display cradle, which
// the engine's certified dry mass excludes
const NOT_ENGINE = new Set([
  'Inlet cowl', 'Fan cowl doors', 'Fan cowl hinges', 'Fan cowl latches', 'Fan cowl hold-open rods',
  'Thrust reverser translating sleeves', 'Thrust reverser cascades', 'Blocker doors & drag links', 'Thrust reverser actuators',
  'Thrust reverser hinge & latch beams', 'Thrust reverser control valve module', 'Thrust reverser hydraulic lines', 'Thrust reverser synchronising shafts',
  'Core cowl & bifurcations', 'Core cowl pressure-relief door', 'Pylon (strut) stub', 'Display cradle',
  'Integrated drive generator (IDG)', 'Backup generator (VSCF/PMG)', 'Engine-driven hydraulic pump', 'Hydraulic pump lines', 'IDG feeder cables', 'IDG fuel/oil cooler',
  'Bleed ducts & manifold', 'IP check valve', 'High-pressure shutoff valve', 'Pressure-regulating shutoff valve (PRSOV)', 'Precooler', 'Fan-air valve & duct',
  'Nacelle anti-ice valve & duct', 'Starter air valve', 'Starter duct', 'Fire-extinguisher discharge lines',
]);

export function buildTurbofan() {
  const A = new Assembly();
  const eng = new THREE.Group();
  eng.rotation.z = -Math.PI / 2;      // lathe +y → world +x, lathe +x → world down
  eng.position.y = H;
  A.root.add(eng);
  const P = (name, info, objs) => A.part(name, info, objs, eng);

  // cycle total temperatures pushed in by the lab (ARP755 station id → K); take-off defaults
  const T = { '2': 288, '13': 345, '25': 374, '3': 918, '4': 1740, '45': 1272, '5': 851, '9': 748, '19': 293 };
  const lt = (a, b, f) => () => T[a] + (T[b] - T[a]) * f;
  const cutGroups = [];
  const cut = (g) => { cutGroups.push(g); return g; };
  const spin = { n1: [], n2: [] };
  const ctx = { P, T, lt, cut, spin };

  buildNacelle(ctx);
  buildFan(ctx);
  buildCore(ctx);
  buildAccessories(ctx);

  // ------------------------------------------------------------------ display cradle (lathe frame: x down, floor at x = H)
  const F = H - 0.1;
  const sg = [];
  for (const z of [-1.15, 1.15]) sg.push(beam([F, 1.3, z], [F, -6.0, z], 0.16, 0.16));
  for (const y of [1.1, -0.8, -3.0, -4.55, -5.8]) sg.push(beam([F, y, -1.15], [F, y, 1.15], 0.14, 0.14));
  // forward saddle under the nacelle (outer radius NACELLE.maxR), on two posts and a central pedestal
  const R_SAD = NACELLE.maxR + 0.012;
  for (const z of [-1, 1]) sg.push(beam([F - 0.05, -0.8, z * 1.15], [(R_SAD + 0.06) * Math.cos(0.42), -0.8, z * (R_SAD + 0.06) * Math.sin(0.42)], 0.12, 0.12));
  sg.push(beam([F - 0.05, -0.8, 0], [R_SAD + 0.07, -0.8, 0], 0.18, 0.18));
  // aft yoke under the core cowl
  sg.push(beam([F - 0.05, -4.55, 0], [1.06, -4.55, 0], 0.2, 0.2));
  for (const z of [-1.15, 1.15]) sg.push(beam([F - 0.05, -4.55, z], [1.5, -4.55, z * 0.08], 0.1, 0.1));
  const saddles = [sector(R_SAD, R_SAD + 0.08, -0.6, -1.0, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5, 16), sector(1.0, 1.06, -4.38, -4.72, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6, 16)];
  const frame = mesh(mergeGeometries([...sg, ...saddles].map((g) => (g.index ? g.toNonIndexed() : g))), M.gse());
  const casters = [];
  for (const y of [1.15, -5.85]) for (const z of [-1.15, 1.15]) {
    casters.push(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 18).rotateX(Math.PI / 2).translate(H - 0.11, y, z).toNonIndexed());
  }
  P('Display cradle', {
    system: 'Ground support', material: 'Painted steel',
    // in the engine frame +x is world down: this cancels the exploded view's lift, so the stand stays on the floor
    explode: [0.8, 0, 0], temp: 293,
    desc: 'Museum display cradle: a saddle under the nacelle and a yoke under the core. It is not part of the exhibit\'s mass; shop stands for a bare GE90 instead bolt to the engine\'s own mount pads.',
  }, [frame, mesh(mergeGeometries(casters), M.rubber())]);

  // ------------------------------------------------------------------ flow particles (lathe frame)
  const FLOW = 2200;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(FLOW * 3);
  const fCol = new Float32Array(FLOW * 3);
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  // round, soft-edged points rather than squares
  const SPR = 32, spr = new Uint8Array(SPR * SPR * 4);
  for (let j = 0; j < SPR; j++) for (let i = 0; i < SPR; i++) {
    const d = Math.hypot(i + 0.5 - SPR / 2, j + 0.5 - SPR / 2) / (SPR / 2);
    const a = Math.max(0, 1 - d) ** 1.6;
    spr.set([255, 255, 255, Math.round(255 * a)], (j * SPR + i) * 4);
  }
  const sprite = new THREE.DataTexture(spr, SPR, SPR, THREE.RGBAFormat);
  sprite.needsUpdate = true;
  const flowMat = new THREE.PointsMaterial({ size: 0.04, map: sprite, alphaTest: 0.02, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flow = new THREE.Points(fGeo, flowMat);
  flow.userData.fx = true;
  flow.userData.keepInModes = true;
  flow.frustumCulled = false;
  flow.visible = false;
  eng.add(flow);
  const Y0 = 2.2, CORE_END = -7.4, BY_END = -6.6;
  const seeds = Array.from({ length: FLOW }, (_, i) => ({
    core: i % 4 === 0,
    y: Y0 - Math.random() * (Y0 - CORE_END),
    th: Math.random() * Math.PI * 2,
    f: 0.08 + Math.random() * 0.84,
  }));
  const tempColor = (K) => {
    const t = Math.min(1, Math.max(0, (K - 250) / 1500));
    const c = new THREE.Color();
    if (t < 0.5) c.setRGB(0.25 + t * 1.3, 0.75 - t * 0.2, 1.0 - t * 1.6);
    else c.setRGB(1.0, 0.65 + (t - 0.5) * 0.7, 0.2 + (t - 0.5) * 1.4);
    return c;
  };
  const mix = (a, b, f) => a + (b - a) * Math.min(1, Math.max(0, f));
  const coreTemp = (y) => {
    if (y > 0) return T['2'];
    if (y > -0.72) return mix(T['2'], T['13'], -y / 0.72);
    if (y > -1.65) return mix(T['13'], T['25'], (-0.72 - y) / 0.93);
    if (y > -2.12) return T['25'];
    if (y > -3.1) return mix(T['25'], T['3'], (-2.12 - y) / 0.98);
    if (y > -3.36) return T['3'];
    if (y > -3.72) return T['3'] * Math.pow(T['4'] / T['3'], Math.min(1, (-3.36 - y) / 0.2));
    if (y > -4.1) return mix(T['4'], T['45'], (-3.72 - y) / 0.38);
    if (y > -5.1) return mix(T['45'], T['5'], (-4.1 - y) / 1.0);
    return mix(T['5'], T['9'], (-5.1 - y) / 0.55);
  };
  const spinnerR = (y) => (y >= 0.8 ? 0 : y > 0 ? 0.47 * Math.pow((0.8 - y) / 0.8, 0.8) : 0.47);
  const plugR = (y) => (y < PLUG_TIP ? 0 : Math.max(0, 0.47 * (y - PLUG_TIP) / (-5.65 - PLUG_TIP)));
  const coreStream = (y) => {
    if (y > 0) return [spinnerR(y), 0.86];
    if (y > -0.72) return [mix(0.47, 0.555, -y / 0.72), mix(0.86, 0.875, -y / 0.72)];
    if (y > -5.65) return coreAt(y);
    return [plugR(y), 0.72 - (-5.65 - y) * 0.03];
  };
  const bypassStream = (y) => {
    if (y > -0.72) return [0.9, 1.6];
    if (y > FAN_NOZZLE_Y) return bypassAt(y);
    const k = FAN_NOZZLE_Y - y;
    return [Math.max(0.8, 1.04 - k * 0.04), 1.49 - k * 0.05];
  };

  // ------------------------------------------------------------------ station planes (SAE ARP755) with live labels
  const stationGroup = new THREE.Group();
  stationGroup.visible = false;
  // labels sit above the nacelle (world up = lathe −x) in rows: each label takes the lowest row
  // whose last label is at least GAP metres further forward, so neighbours never overlap
  const GAP = 1.6, ROW = 0.6;
  const rowOf = {};
  const rowLast = [];
  for (const [id, y] of [...STATIONS].sort((a, b) => b[1] - a[1])) {
    let k = 0;
    while (rowLast[k] != null && rowLast[k] - y < GAP) k++;
    rowLast[k] = y;
    rowOf[id] = k;
  }
  const leaderMat = new THREE.LineBasicMaterial({ color: 0xcfd8e2, transparent: true, opacity: 0.55, depthTest: false });
  const stationViz = STATIONS.map(([id, y, r0, r1]) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96).rotateX(-Math.PI / 2), mat);
    ringMesh.position.y = y;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.008, 6, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    edge.position.y = y;
    for (const o of [ringMesh, edge]) { o.userData.fx = true; o.userData.noAO = true; o.userData.keepInModes = true; o.renderOrder = 12; }
    const top = NACELLE.maxR + 0.7 + rowOf[id] * ROW;
    const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-r1, y, 0), new THREE.Vector3(-top, y, 0)]), leaderMat);
    leader.renderOrder = 13;
    leader.userData.fx = true; leader.userData.noAO = true; leader.userData.keepInModes = true;
    leader.raycast = () => {};
    const el = document.createElement('div');
    el.className = 'station-label';
    el.innerHTML = `<b>${id}</b><span></span><span></span>`;
    const label = new CSS2DObject(el);
    label.center.set(0.5, 1);
    label.position.set(-top, y, 0);
    stationGroup.add(ringMesh, edge, leader, label);
    const [tEl, pEl] = el.querySelectorAll('span');
    return { id, mat, edgeMat: edge.material, tEl, pEl, label };
  });
  eng.add(stationGroup);

  // Part masses are estimates from size and material; scale the engine's so they add up to the
  // published dry mass (massSource stays unset, so the UI still marks each one as an estimate)
  const engineParts = A.parts.filter((p) => !NOT_ENGINE.has(p.userData.part.name));
  const sum = engineParts.reduce((a, p) => a + (p.userData.part.mass || 0), 0);
  for (const p of engineParts) if (p.userData.part.mass) p.userData.part.mass = Math.max(1, Math.round((p.userData.part.mass * DRY_MASS) / sum));

  A.finalize();

  const state = { throttle: 1, n1: 100, n2: 100, cutaway: true, flow: false, a1: 0, a2: 0, fromLab: false, reverser: 0, reverserTarget: 0 };
  ctx.reverser.set(0);
  const turn = () => {
    for (const s of spin.n1) { if (s.rotor) updateRotor(s.rotor, state.a1, state.cutaway); else s.g.rotation.y = state.a1; }
    for (const s of spin.n2) { if (s.rotor) updateRotor(s.rotor, state.a2, state.cutaway); else s.g.rotation.y = state.a2; }
  };
  const applyCut = (on) => { state.cutaway = on; cutGroups.forEach((g) => setCut(g, on)); turn(); };
  applyCut(true);
  // the flow particles follow the assembled flow path, so they hide while the parts are pulled apart
  const fanPart = A.parts.find((p) => p.userData.part.name === 'Fan blades');
  // The fan and spinner stay whole in the cutaway. In the see-through modes (any mode that has swapped
  // the studio material out) clicks on them inside the removed quadrant pass through, so the fan disk,
  // bearings, sump and shafts behind them can be picked; in Studio the fan picks as it looks.
  const toLathe = new THREE.Matrix4(), hitP = new THREE.Vector3();
  for (const name of ['Fan blades', 'Spinner']) {
    A.parts.find((p) => p.userData.part.name === name)?.traverse((m) => {
      if (!m.isMesh) return;
      const pick = THREE.Mesh.prototype.raycast;
      m.raycast = function (raycaster, hits) {
        const first = hits.length;
        pick.call(this, raycaster, hits);
        if (!state.cutaway || !this.userData.studio || this.material === this.userData.studio) return;
        toLathe.copy(eng.matrixWorld).invert();
        let w = first;
        for (let i = first; i < hits.length; i++) if (kept(phiOf(hitP.copy(hits[i].point).applyMatrix4(toLathe)))) hits[w++] = hits[i];
        hits.length = w;
      };
    });
  }
  const burnerMat = ctx.burnerMat;

  const vehicle = {
    id: 'turbofan',
    designation: 'GE90-115B',
    name: 'GE90',
    role: 'High-bypass turbofan · Boeing 777',
    tagline: '115,540 lbf certified · 3.25 m composite fan · overall pressure ratio 42',
    summary: 'The world\'s most powerful certified jet engine in service, built for the Boeing 777-300ER. A 3.25 m fan of 22 swept carbon-fibre blades moves about 1.5 tonnes of air a second at take-off; roughly one kilogram in eight passes through the core, where a 4-stage booster and 9-stage HP compressor squeeze it 42-fold, a dual annular combustor heats it, and 2 HP and 6 LP turbine stages expand it to drive everything upstream. The bypass air makes most of the thrust. Shown as a cutaway in its Boeing nacelle.',
    specs: [
      ['Manufacturer', 'GE Aerospace, with Safran, IHI and Avio Aero'],
      ['Aircraft', 'Boeing 777-300ER (exclusive), some 777-200LR; the 777F uses the same hardware at the -110B1 rating'],
      ['Certified take-off thrust', '115,540 lbf (514 kN), flat-rated to 30 °C'],
      ['GE quoted thrust', '115,300 lbf'],
      ['Record thrust (certification test, 2003)', '127,900 lbf (569 kN)'],
      ['Fan', '3.25 m (128 in), 22 swept composite blades'],
      ['Length (spinner to centre body)', '7.28 m (286.7 in)'],
      ['Engine envelope', '3.77 m wide × 3.93 m high'],
      ['Nacelle diameter', '4.22 m (166 in), Boeing'],
      ['Dry mass', '8,761 kg (19,316 lb), with starter and mounts'],
      ['Bypass ratio', '7.1 : 1 at take-off (ICAO databank; earlier GE90s about 8.7 : 1)'],
      ['Take-off fuel flow', '4.59 kg/s (ICAO Engine Emissions Databank)'],
      ['Overall pressure ratio', '42 : 1'],
      ['Stages', 'Fan + 4 booster · 9 HPC · 2 HPT · 6 LPT'],
      ['Combustor', 'Dual annular (DAC)'],
      ['100 % N1 / N2 (reference speeds)', '2,355 / 9,332 rpm'],
      ['Max N1 / N2 (take-off and continuous)', '2,602 rpm (110.5 %) / 11,292 rpm (121 %)'],
      ['EGT limit (T49, LPT inlet)', '1,090 °C take-off · 1,050 °C max continuous'],
      ['Accessory pads (× N2)', 'IDG 0.7947 · hydraulic pump 0.3783 · VSCF backup generator 2.4126'],
      ['Max continuous thrust', '110,000 lbf (489 kN)'],
      ['Control', 'Dual-channel FADEC'],
      ['Entry into service', '2004 (777-300ER)'],
    ],
    heroStats: [['514', 'kN', 'Take-off thrust'], ['3.25', 'm', 'Fan diameter'], ['42', ': 1', 'Pressure ratio']],
    sources: 'EASA type-certificate data sheet IM.E.002, issue 05, 2023 (stage counts, length, envelope, dry weight, take-off and maximum-continuous thrust, N1/N2 reference speeds and limits, T49 EGT limits, oil-temperature limits, aircraft accessory drive ratios and ratings, fuel heating value, bleed limits, Boeing thrust reverser) and FAA TCDS E00049EN; ICAO Aircraft Engine Emissions Databank, EASA v32 (03/2026), GE90-115B entries 7GE099 to 07P27GE240 (take-off bypass ratio 6.96–7.1, pressure ratio 42.2–43.2, fuel flow at 100 / 85 / 30 / 7 % thrust, used to calibrate the cycle in the lab); Flight International, \'GE90 modifications take shape\', 8 April 2003 (temporary Kevlar/fibreglass containment wrap, thicker aluminium case forging); Volvo Aero, GE90 fan case release, 2007 (aluminium fan case, about 3.5 m, 600 kg machined); GE Aerospace GE90 product page (stage counts, 135 in engine diameter, 115,300 lbf, OPR 42, inward-opening variable bleed doors) and press releases (dual annular combustor, swept composite fan); Wikipedia, General Electric GE90 (166 in nacelle diameter, fan-blade length and mass after MoMA); Aircraft Commerce GE90 owner\'s and operator\'s guide, issue 84, 2012 (-115B configuration, bypass ratio); Flight International, GE90-115B development (added booster stage, de-staged HPC); Museum of Modern Art collection, GE90-115B fan blade (length, mass, materials); NASA Energy Efficient Engine combustor reports (dual-annular combustor principle); GE mount patents US 5,277,382 and US 5,452,575 (mount and thrust-link arrangement); Mattingly, Elements of Propulsion (cycle method); SAE ARP755 (station numbering).',
    fleetTag: 'OPR 42',
    root: A.root,
    parts: A.parts,
    view: { dir: [0.78, 0.4, 1.25], fill: 1.12 },
    displaySize: 9,
    thermalRange: [250, 1900],
    state,
    stationT: T,
    setStations(stations) {
      for (const s of stations) T[s.id] = s.T;
      const by = Object.fromEntries(stations.map((s) => [s.id, s]));
      for (const v of stationViz) {
        const st = by[v.id];
        if (!st) continue;
        const c = inferno(Math.min(1, Math.max(0.12, (st.T - 250) / 1650)));
        v.mat.color.copy(c);
        v.edgeMat.color.copy(c);
        v.tEl.textContent = `${Math.round(st.T).toLocaleString('en-US')} K`;
        v.pEl.textContent = `${(st.P / 1000).toLocaleString('en-US', { maximumFractionDigits: st.P > 1e6 ? 0 : 1 })} kPa`;
      }
    },
    setStationPlanes(on) {
      stationGroup.visible = on;
      for (const v of stationViz) v.label.visible = on;
    },
    /** World-space box round the station planes and their labels (with room for the label text). */
    stationBounds() {
      const box = new THREE.Box3();
      const p = new THREE.Vector3();
      for (const v of stationViz) {
        box.expandByPoint(v.label.getWorldPosition(p));
        box.expandByPoint(p.clone().set(-(NACELLE.maxR + 0.7 + (rowOf[v.id] + 1) * ROW), 0, 0).applyMatrix4(eng.matrixWorld));
      }
      return box;
    },
    setCutaway: applyCut,
    /** Thrust reverser: true deploys (sleeves aft, blocker doors down), false stows. */
    setReverser(on) { state.reverserTarget = on ? 1 : 0; },
    // the guided tour's 'bay' demonstration opens whatever the vehicle opens: here, the reverser
    setBay(on) { state.reverserTarget = on ? 1 : 0; },
    setFlow(on) { state.flow = on; flow.visible = on; },
    temperatureOf(info) {
      if (info.stationTemp) return T[info.stationTemp];
      return info.temp;
    },
    update(dt) {
      const thr = state.throttle;
      // the lab writes N1 / N2 (%) from the cycle; otherwise follow the thrust lever on the ground
      const n1 = state.fromLab ? state.n1 / 100 : n1Demand(thr);
      const n2 = state.fromLab ? state.n2 / 100 : n2Line(n1);
      state.a1 = (state.a1 + n1 * N1_RPM * (Math.PI / 30) * SHOW * dt) % (Math.PI * 2);
      state.a2 = (state.a2 + n2 * N2_RPM * (Math.PI / 30) * SHOW * dt) % (Math.PI * 2);
      turn();
      flow.visible = state.flow && fanPart.position.distanceToSquared(fanPart.userData.base) < 1e-6;
      burnerMat.emissiveIntensity = 0.8 + thr * 4.6 * Math.max(0, (T['4'] - 900) / 900);
      if (state.reverser !== state.reverserTarget) {
        // about 2 s end to end, eased (the real deploy takes roughly that long)
        const step = dt / 2;
        state.reverser = state.reverserTarget > state.reverser ? Math.min(state.reverserTarget, state.reverser + step) : Math.max(state.reverserTarget, state.reverser - step);
        const x = state.reverser;
        ctx.reverser.set(x * x * (3 - 2 * x));
      }
      if (!flow.visible) return;
      const speed = 0.35 + thr * 1.1;
      for (let i = 0; i < FLOW; i++) {
        const s = seeds[i];
        let v, r, K;
        if (s.core) {
          const y = s.y;
          v = y > 0 ? 1.3 : y > -1.65 ? 1.0 : y > -3.1 ? 0.6 : y > -3.72 ? 0.45 : y > -5.1 ? 1.4 : 2.6;
          const [h, t] = coreStream(y);
          r = h + (t - h) * s.f;
          K = coreTemp(y);
          if (y < -3.72 && y > -5.1) s.th += dt * 1.6;
        } else {
          const y = s.y;
          v = y > 0 ? 1.5 : 2.1;
          const [a, b] = bypassStream(y);
          r = a + (b - a) * s.f;
          K = y > 0 ? T['2'] : T['13'];
          if (y < 0.05 && y > -0.5) s.th += dt * 2.5;
        }
        s.y -= v * speed * dt;
        if (s.y < (s.core ? CORE_END : BY_END)) { s.y = Y0; s.th = Math.random() * Math.PI * 2; }
        fPos[i * 3] = Math.sin(s.th) * r;
        fPos[i * 3 + 1] = s.y;
        fPos[i * 3 + 2] = Math.cos(s.th) * r;
        const end = s.core ? -5.65 : FAN_NOZZLE_Y;
        const fade = s.y < end ? Math.max(0, 1 + (s.y - end) / (s.core ? 1.75 : 2.6)) : Math.min(1, (Y0 - s.y) * 2);
        const c = tempColor(K);
        fCol[i * 3] = c.r * fade; fCol[i * 3 + 1] = c.g * fade; fCol[i * 3 + 2] = c.b * fade;
      }
      fGeo.attributes.position.needsUpdate = true;
      fGeo.attributes.color.needsUpdate = true;
    },
  };
  return vehicle;
}
