// F-22A flight-envelope lab: ISA atmosphere, lift/drag polar, load factor and the specific-excess-
// power (Ps) curve that energy-manoeuvrability theory is built on, for the real jet's weights and
// F119 thrust (src/models/f22/performance.js: the shared aero model plus supersonic F119 dry-thrust
// ram recovery, a post-stall lift break and the 104 kPa dynamic-pressure limit). The airframe in
// the bay follows the stick: stabilators, flaperons, ailerons, rudders and the ±20° 2-D nozzles.

import * as THREE from 'three';
import { FIGHTER } from '../physics/aero.js';
import { flight, psCurve, trimAlpha } from '../models/f22/performance.js';
import { el, slider, toggle, readouts, section, button, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import { ForceArrows, kN } from '../engine/forces.js';

// gross weight = empty + internal fuel + stores: 19,700 + 8,200 + 1,510 = 29,410 kg (published)
const STORES = FIGHTER.massCombat - FIGHTER.massEmpty - FIGHTER.fuelInternal;   // pilot, 6 × AIM-120C, 2 × AIM-9X, 480 rds, fluids

const PRESETS = [
  { label: 'Supercruise · M 1.76', c: { altitude: 12200, mach: FIGHTER.machSupercruise, alpha: 'trim', throttle: 0.8 },
    note: 'Published supercruise: Mach 1.76 at altitude on military power, with no afterburner. Here dry thrust only just balances drag — this is the top of the supercruise range at combat weight; burn some fuel and the margin grows.' },
  { label: 'Top speed · M 2.25', c: { altitude: 12200, mach: FIGHTER.machMax, alpha: 'trim', throttle: 1 },
    note: 'Published top speed: Mach 2.25 at altitude in full afterburner.' },
  { label: 'Sea level · M 1.21', c: { altitude: 0, mach: FIGHTER.machSeaLevel, alpha: 'trim', throttle: 1 },
    note: 'At sea level the limit is Mach 1.21 (800 kt): dynamic pressure (≈ 104 kPa), not thrust, sets it — there is still plenty of excess power, and the Ps curve stops at that limit.' },
  { label: '9 g turn', c: { altitude: 4000, mach: 0.85, alpha: 18.5, throttle: 1 },
    note: 'A 9 g turn at the structural limit: lift is nine times the weight. Ps goes deeply negative — even full afterburner cannot hold the energy, so the turn bleeds speed.' },
];

export function mountFighterLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8, fuel: 1 };
  const status = el('p', { class: 'lab-status', role: 'status' });
  const presetNote = el('p', { class: 'lab-note', text: 'Pick a published flight condition, or set your own below.' });
  let dirty = true;
  const mark = () => { dirty = true; };

  const sAlt = slider({ label: 'Altitude', min: 0, max: 20000, step: 100, value: p.altitude, unit: 'm', onInput: (x) => { p.altitude = x; mark(); } });
  const sMach = slider({ label: 'Mach number', min: 0.2, max: 2.4, step: 0.01, value: p.mach, format: (x) => x.toFixed(2), onInput: (x) => { p.mach = x; mark(); } });
  const sAoA = slider({ label: 'Angle of attack', min: -4, max: 40, step: 0.5, value: p.alpha, unit: '°', format: (x) => x.toFixed(1), onInput: (x) => { p.alpha = x; mark(); } });
  const sThr = slider({
    label: 'Throttle (both F119s)', min: 0, max: 100, step: 1, value: p.throttle * 100,
    format: (x) => (x > 80 ? `A/B ${Math.round(((x - 80) / 20) * 100)} %` : x === 80 ? 'MIL' : `${x} %`),
    onInput: (x) => { p.throttle = x / 100; mark(); },
  });
  const sFuel = slider({
    label: 'Internal fuel', min: 0, max: 100, step: 1, value: p.fuel * 100,
    format: (x) => `${Math.round(x)} % · ${fmt.n((x / 100) * FIGHTER.fuelInternal, 0)} kg`,
    onInput: (x) => { p.fuel = x / 100; mark(); },
  });
  const mass = () => FIGHTER.massEmpty + STORES + p.fuel * FIGHTER.fuelInternal;

  const stick = { pitch: 0, roll: 0, yaw: 0 };
  const sPitch = slider({ label: 'Pitch (stabilators + TVC)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.pitch = x; } });
  const sRoll = slider({ label: 'Roll (flaperons + ailerons)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.roll = x; } });
  const sYaw = slider({ label: 'Yaw (rudders)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.yaw = x; } });

  const tFlight = toggle({ label: 'In flight', value: false, onChange: (on) => { v.setAirborne(on); v.setGear(!on); ctx.setFlightLook(on); ctx.log(v.designation, on ? 'Gear up — airborne above the cloud deck, strobes on' : 'Gear down — back in the hangar', 'info'); } });
  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.07 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); if (on) placeForces(); } });
  const tBay = toggle({ label: 'Weapons bays', value: false, onChange: (on) => { v.setBay(on); ctx.log(v.designation, on ? 'Bay doors open · AVEL ejectors and LAU-141/A trapezes extended' : 'Bay doors closed', on ? 'warn' : 'info'); } });

  let demo = null;
  const demoBtn = button('Run manoeuvre demo', () => {
    demo = { t: 0 };
    if (!tFlight.get()) tFlight.set(true);
    ctx.log(v.designation, 'Demo: aileron roll, pull-up with thrust vectoring, rudder kick', 'info');
  });

  const ro = readouts([
    { key: 'T', label: 'Static temperature', unit: 'K' }, { key: 'rho', label: 'Air density', unit: 'kg/m³' },
    { key: 'a', label: 'Speed of sound', unit: 'm/s' }, { key: 'tas', label: 'True airspeed', unit: 'kt' },
    { key: 'q', label: 'Dynamic pressure', unit: 'kPa' }, { key: 'mass', label: 'Gross weight', unit: 'kg' },
    { key: 'cl', label: 'Lift coefficient CL' }, { key: 'ld', label: 'Lift / drag' },
    { key: 'n', label: 'Load factor', unit: 'g' }, { key: 'tw', label: 'Thrust / weight' },
    { key: 'thrust', label: 'Thrust available', unit: 'kN' }, { key: 'drag', label: 'Drag', unit: 'kN' },
    { key: 'ps', label: 'Excess power Ps', unit: 'm/s' }, { key: 'tvc', label: 'Nozzle vector', unit: '°' },
    { key: 'stag', label: 'Skin stagnation', unit: 'K' }, { key: 'wl', label: 'Wing loading', unit: 'kg/m²' },
  ]);

  const chart = new LineChart({
    title: 'Specific excess power in 1 g level flight',
    xLabel: 'Mach', yLabel: 'Ps (m/s)', yUnit: 'm/s',
    series: [{ key: 'ps', label: 'Ps at current throttle', color: '#3987e5' }],
    xFormat: (x) => x.toFixed(1), yFormat: (y) => Math.round(y).toString(),
    height: 168,
  });

  const presetRow = el('div', { class: 'btn-row' }, ...PRESETS.map((pr) => button(pr.label, () => {
    api.setCondition({ ...pr.c, alpha: pr.c.alpha === 'trim' ? trimAlpha(pr.c, mass()) : pr.c.alpha });
    presetNote.textContent = pr.note;
    ctx.log(v.designation, `Condition: ${pr.label}`, 'info');
  })));

  root.append(
    el('p', { class: 'lab-intro', text: 'Fly the F-22A through its envelope. Lift, drag and twin-F119 thrust come from a conceptual-design aero model over the 1976 Standard Atmosphere, set to the published wing area, weights and thrust; it reproduces the published supercruise (Mach 1.76), top speed (Mach 2.25) and 9 g. The jet in the bay answers every control input.' }),
    section('Published conditions', presetRow, presetNote),
    section('Flight condition', sAlt.el, sMach.el, sAoA.el, sThr.el, sFuel.el),
    status,
    section('Air data & performance', ro.el),
    section('Energy manoeuvrability', chart.el, el('p', { class: 'lab-note', text: 'Where the curve is above zero the jet can still climb or accelerate at 1 g; its right-hand zero crossing is the top level-flight speed at this altitude, and where it simply stops, the 104 kPa dynamic-pressure limit has been reached. Grey marks: published supercruise (M 1.76) and top speed (M 2.25). Above Mach 1 the inlet\'s ram compression keeps the F119\'s dry thrust up, which is what makes supercruise possible.' })),
    section('Controls', sPitch.el, sRoll.el, sYaw.el, el('div', { class: 'btn-row' }, tFlight.el, tBay.el, tForces.el, demoBtn)),
  );

  let lastThermal = 0, lastTvc = 0;
  let prevWarn = '';
  const compute = () => {
    const m = mass();
    const f = flight({ ...p, mass: m });
    v.state.flight = f;
    ctx.modes.setFlow({ alphaDeg: p.alpha, mach: p.mach, stall: f.stalled ? 1 : 0, tau: 0.045 });
    v.state.mach = p.mach;
    v.state.altitude = p.altitude;
    v.state.alpha = p.alpha;
    v.state.throttle = p.throttle;
    const W = m * 9.80665;
    ro.set('T', fmt.n(f.atm.T, 1));
    ro.set('rho', f.atm.rho.toFixed(3));
    ro.set('a', fmt.n(f.atm.a, 0));
    ro.set('tas', fmt.n(f.V * 1.94384, 0));
    ro.set('q', fmt.n(f.q / 1000, 1));
    ro.set('mass', fmt.n(m, 0));
    ro.set('cl', f.cl.toFixed(3), f.stalled ? 'crit' : '');
    ro.set('ld', f.lOverD.toFixed(1));
    ro.set('n', f.n.toFixed(2), f.overG ? 'crit' : f.n > 7 ? 'warn' : 'ok');
    ro.set('tw', (f.T / W).toFixed(2));
    ro.set('thrust', fmt.n(f.T / 1000, 0));
    ro.set('drag', fmt.n(f.D / 1000, 0));
    ro.set('ps', fmt.n(f.ps, 0), f.ps < 0 ? 'warn' : 'ok');
    ro.set('stag', fmt.n(f.stagnationT, 0), f.stagnationT > 400 ? 'warn' : '');
    ro.set('wl', fmt.n(m / FIGHTER.wingArea, 0));
    let msg, level = 'ok';
    if (f.stalled) { msg = `Stalled: past the wing's ${FIGHTER.alphaStall}° stall the flow separates and lift falls (CL ${f.cl.toFixed(2)}) while drag soars. Thrust vectoring keeps the real jet controllable beyond 60°; lower the nose to recover.`; level = 'crit'; }
    else if (f.overG) { msg = `Over-g: ${f.n.toFixed(1)} g exceeds the +${FIGHTER.gLimit} / ${FIGHTER.gNegLimit} g structural limit. Reduce angle of attack or speed.`; level = 'crit'; }
    else if (f.overQ) { msg = `Over-speed: ${fmt.n(f.q / 1000, 0)} kPa of dynamic pressure is past the structure's ≈ ${fmt.n(FIGHTER.qMax / 1000, 0)} kPa limit (Mach ${FIGHTER.machSeaLevel}, 800 kt, at sea level). Slow down or climb.`; level = 'warn'; }
    else if (p.mach > FIGHTER.machMax + 0.01) { msg = `Beyond the envelope: the published top speed is Mach ${FIGHTER.machMax}; inlet and skin temperatures (${fmt.n(f.stagnationT, 0)} K stagnation) set the limit.`; level = 'warn'; }
    else if (f.ps < 0) { msg = `Drag exceeds thrust by ${fmt.n((f.D - f.T) / 1000, 0)} kN: the jet is bleeding energy at ${fmt.n(-f.ps, 0)} m/s.`; level = 'warn'; }
    else if (p.mach > 1 && p.throttle <= 0.8) msg = `Supercruise: supersonic on dry thrust with ${fmt.n(f.ps, 0)} m/s of excess power — no afterburner, so far less fuel and heat.`;
    else if (p.mach > 0.95 && p.mach < 1.05) msg = 'Transonic: a Prandtl–Glauert vapour cone forms where the air is humid enough.';
    else msg = `Sustainable: ${fmt.n(f.ps, 0)} m/s of excess power to climb or accelerate.`;
    status.textContent = msg;
    status.dataset.state = level;
    if (level !== 'ok' && msg.split(':')[0] !== prevWarn) ctx.log(v.designation, msg.split(':')[0], level);
    prevWarn = level === 'ok' ? '' : msg.split(':')[0];

    const sweep = psCurve({ altitude: p.altitude, throttle: p.throttle, mass: m });
    const ys = sweep.map((s) => s.ps).filter(Number.isFinite);
    chart.setData({ ps: sweep.map((s) => ({ x: s.mach, y: s.ps })) }, {
      xDomain: [0.2, 2.5], zero: true,
      yDomain: [Math.max(-300, Math.min(-100, ...ys)), Math.max(100, ...ys)],
      markers: [{ x: FIGHTER.machSupercruise, label: 'M 1.76' }, { x: FIGHTER.machMax, label: 'M 2.25' }],
      cursor: { x: p.mach, label: `M ${p.mach.toFixed(2)}` },
    });
  };

  // lift ⟂ flight path, drag along it, thrust along the body axis, weight straight down — 4.2 m per W
  // centre of gravity near s 11.3 (about 35 % of the 6.7 m mean aerodynamic chord, aft of the weapons bay); thrust
  // acts at the nozzle exits (s ≈ 16.5), 5.2 m behind it
  const cg = new THREE.Vector3(9.46 - 11.3, 0.1, 0);
  const UP_NUDGE = new THREE.Vector3(0, 1.1, 0), DOWN_NUDGE = new THREE.Vector3(0, -1.1, 0);
  function placeForces() {
    const f = v.state.flight;
    if (!f || !forces.group.visible) return;
    const W = mass() * 9.80665;
    const k = 4.2 / W;
    const o = cg.clone().add(v.attitude.position);
    const a = (p.alpha * Math.PI) / 180 * v.state.airborne * 0.9;
    forces.set('lift', { origin: o, dir: new THREE.Vector3(0, 1, 0), length: Math.min(f.L, W * 2.5) * k, text: kN(f.L), name: 'Lift' });
    forces.set('weight', { origin: o, dir: new THREE.Vector3(0, -1, 0), length: W * k, text: kN(W), name: 'Weight' });
    forces.set('drag', { origin: o.clone().add(new THREE.Vector3(-1.0, 0, 0)), dir: new THREE.Vector3(-1, 0, 0), length: f.D * k, text: kN(f.D), name: 'Drag', labelOffset: UP_NUDGE });
    forces.set('thrust', { origin: o.clone().add(new THREE.Vector3(-5.2, 0, 0)), dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), length: f.T * k, text: kN(f.T), name: 'Thrust', labelOffset: DOWN_NUDGE });
  }

  const api = {
    setStick(st) { Object.assign(stick, st); sPitch.set(stick.pitch, true); sRoll.set(stick.roll, true); sYaw.set(stick.yaw, true); },
    getCondition: () => ({ ...p }),
    setCondition(c) {
      Object.assign(p, c);
      sAlt.set(p.altitude, true); sMach.set(p.mach, true); sAoA.set(p.alpha, true); sThr.set(Math.round(p.throttle * 100), true); sFuel.set(Math.round(p.fuel * 100), true);
      dirty = true;
    },
  };

  return {
    update(dt, t) {
      if (dirty) { dirty = false; compute(); }
      if (forces.group.visible) placeForces();
      if (demo) {
        demo.t += dt;
        const k = demo.t;
        stick.roll = k < 3 ? Math.sin((k / 3) * Math.PI) : 0;
        stick.pitch = k > 3 && k < 5.5 ? Math.sin(((k - 3) / 2.5) * Math.PI) * 0.8 : 0;
        stick.yaw = k > 5.5 && k < 7.5 ? Math.sin(((k - 5.5) / 2) * Math.PI * 2) * 0.7 : 0;
        sRoll.set(stick.roll, true); sPitch.set(stick.pitch, true); sYaw.set(stick.yaw, true);
        if (k > 7.5) { demo = null; stick.roll = stick.pitch = stick.yaw = 0; sRoll.set(0, true); sPitch.set(0, true); sYaw.set(0, true); }
      }
      // smooth the surfaces toward the stick
      const s = v.state;
      const k = 1 - Math.exp(-dt * 8);
      s.pitch += (stick.pitch - s.pitch) * k;
      s.roll += (stick.roll - s.roll) * k;
      s.yaw += (stick.yaw - s.yaw) * k;
      if (t - lastTvc > 0.1) {
        lastTvc = t;
        const d = s.pitch * FIGHTER.tvcDeg;
        ro.set('tvc', `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}`, Math.abs(d) > 15 ? 'warn' : '');
      }
      if (t - lastThermal > 0.5) { lastThermal = t; ctx.refreshThermal(); }
      ctx.stage.env.cloudSpeed = v.state.airborne * (v.state.flight ? v.state.flight.V : 0);
    },
    dispose() { forces.setVisible(false); },
    api,
  };
}
