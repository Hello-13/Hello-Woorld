// Flight-envelope lab: ISA atmosphere, lift/drag polar, load factor and the
// specific-excess-power (Ps) curve that energy-manoeuvrability theory is built on.

import { flightState, psSweep, FIGHTER } from '../physics/aero.js';
import { el, slider, toggle, readouts, section, button, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import * as THREE from 'three';
import { ForceArrows, kN } from '../engine/forces.js';
import { FIGHTER as F_DATA } from '../physics/aero.js';

export function mountFighterLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { altitude: 9000, mach: 0.9, alpha: 4, throttle: 0.8 };
  const status = el('p', { class: 'lab-status', role: 'status' });

  const sAlt = slider({ label: 'Altitude', min: 0, max: 20000, step: 100, value: p.altitude, unit: 'm', onInput: (x) => { p.altitude = x; dirty = true; } });
  const sMach = slider({ label: 'Mach number', min: 0.2, max: 2.4, step: 0.01, value: p.mach, format: (x) => x.toFixed(2), onInput: (x) => { p.mach = x; dirty = true; } });
  const sAoA = slider({ label: 'Angle of attack', min: -4, max: 30, step: 0.5, value: p.alpha, unit: '°', format: (x) => x.toFixed(1), onInput: (x) => { p.alpha = x; dirty = true; } });
  const sThr = slider({
    label: 'Throttle', min: 0, max: 100, step: 1, value: p.throttle * 100,
    format: (x) => (x > 80 ? `A/B ${Math.round(((x - 80) / 20) * 100)} %` : x === 80 ? 'MIL' : `${x} %`),
    onInput: (x) => { p.throttle = x / 100; dirty = true; },
  });

  const stick = { pitch: 0, roll: 0, yaw: 0 };
  const sPitch = slider({ label: 'Pitch (stabilators + TVC)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.pitch = x; } });
  const sRoll = slider({ label: 'Roll (flaperons + ailerons)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.roll = x; } });
  const sYaw = slider({ label: 'Yaw (rudders)', min: -1, max: 1, step: 0.01, value: 0, format: (x) => `${Math.round(x * 100)} %`, onInput: (x) => { stick.yaw = x; } });

  const tFlight = toggle({ label: 'In flight', value: false, onChange: (on) => { v.setAirborne(on); v.setGear(!on); ctx.setFlightLook(on); ctx.log(v.designation, on ? 'Gear up — airborne above the cloud deck' : 'Gear down — back in the hangar', 'info'); } });
  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.07 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); if (on) placeForces(); } });
  const tBay = toggle({ label: 'Weapons bay', value: false, onChange: (on) => { v.setBay(on); ctx.log(v.designation, on ? 'Main bay doors open · trapeze launchers extended' : 'Main bay doors closed', on ? 'warn' : 'info'); } });

  let demo = null;
  const demoBtn = button('Run manoeuvre demo', () => {
    demo = { t: 0 };
    if (!tFlight.get()) tFlight.set(true);
    ctx.log(v.designation, 'Demo: aileron roll, pull-up, rudder kick', 'info');
  });

  const ro = readouts([
    { key: 'T', label: 'Static temperature', unit: 'K' }, { key: 'rho', label: 'Air density', unit: 'kg/m³' },
    { key: 'a', label: 'Speed of sound', unit: 'm/s' }, { key: 'tas', label: 'True airspeed', unit: 'kt' },
    { key: 'q', label: 'Dynamic pressure', unit: 'kPa' }, { key: 'cl', label: 'Lift coefficient CL' },
    { key: 'ld', label: 'Lift / drag' }, { key: 'n', label: 'Load factor', unit: 'g' },
    { key: 'thrust', label: 'Thrust available', unit: 'kN' }, { key: 'drag', label: 'Drag', unit: 'kN' },
    { key: 'ps', label: 'Excess power Ps', unit: 'm/s' }, { key: 'stag', label: 'Skin stagnation', unit: 'K' },
  ]);

  const chart = new LineChart({
    title: 'Specific excess power in 1 g level flight',
    xLabel: 'Mach', yLabel: 'Ps (m/s)', yUnit: 'm/s',
    series: [{ key: 'ps', label: 'Ps at current throttle', color: '#3987e5' }],
    xFormat: (x) => x.toFixed(1), yFormat: (y) => Math.round(y).toString(),
    height: 168,
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'Set a flight condition. Lift, drag and thrust come from a conceptual-design aero model over the 1976 Standard Atmosphere; the airframe in the bay responds to every control input.' }),
    section('Flight condition', sAlt.el, sMach.el, sAoA.el, sThr.el),
    status,
    section('Air data & performance', ro.el),
    section('Energy manoeuvrability', chart.el, el('p', { class: 'lab-note', text: 'Where the curve is above zero the jet can still climb or accelerate at 1 g. Its right-hand zero crossing is the maximum level-flight speed at this altitude.' })),
    section('Controls', sPitch.el, sRoll.el, sYaw.el, el('div', { class: 'btn-row' }, tFlight.el, tBay.el, tForces.el, demoBtn)),
  );

  let dirty = true;
  let lastThermal = 0;
  let prevWarn = '';
  const compute = () => {
    const f = flightState(p);
    v.state.flight = f;
    ctx.modes.setFlow({ alphaDeg: p.alpha, mach: p.mach, stall: f.stalled ? 1 : 0, tau: 0.045 });
    v.state.mach = p.mach;
    v.state.altitude = p.altitude;
    v.state.alpha = p.alpha;
    v.state.throttle = p.throttle;
    ro.set('T', fmt.n(f.atm.T, 1));
    ro.set('rho', f.atm.rho.toFixed(3));
    ro.set('a', fmt.n(f.atm.a, 0));
    ro.set('tas', fmt.n(f.V * 1.94384, 0));
    ro.set('q', fmt.n(f.q / 1000, 1));
    ro.set('cl', f.cl.toFixed(3), f.stalled ? 'crit' : '');
    ro.set('ld', f.lOverD.toFixed(1));
    ro.set('n', f.n.toFixed(2), f.overG ? 'crit' : f.n > 7 ? 'warn' : 'ok');
    ro.set('thrust', fmt.n(f.T / 1000, 0));
    ro.set('drag', fmt.n(f.D / 1000, 0));
    ro.set('ps', fmt.n(f.ps, 0), f.ps < 0 ? 'warn' : 'ok');
    ro.set('stag', fmt.n(f.stagnationT, 0), f.stagnationT > 400 ? 'warn' : '');
    let msg, level = 'ok';
    if (f.stalled) { msg = `Stalled: angle of attack is past the ${FIGHTER.alphaStall}° stall. Lower it to recover lift.`; level = 'crit'; }
    else if (f.overG) { msg = `Over-g: ${f.n.toFixed(1)} g exceeds the +9 / −3 g structural limit. Reduce angle of attack or speed.`; level = 'crit'; }
    else if (f.ps < 0) { msg = `Drag exceeds thrust by ${fmt.n((f.D - f.T) / 1000, 0)} kN: the jet is bleeding energy at ${fmt.n(-f.ps, 0)} m/s.`; level = 'warn'; }
    else if (p.mach > 1 && p.throttle <= 0.8) msg = `Supercruise: supersonic on dry thrust, ${fmt.n(f.ps, 0)} m/s of excess power in reserve.`;
    else if (p.mach > 0.95 && p.mach < 1.05) msg = 'Transonic: a Prandtl–Glauert vapour cone forms where the air is humid enough.';
    else msg = `Sustainable: ${fmt.n(f.ps, 0)} m/s of excess power to climb or accelerate.`;
    status.textContent = msg;
    status.dataset.state = level;
    if (level !== 'ok' && msg.split(':')[0] !== prevWarn) ctx.log(v.designation, msg.split(':')[0], level);
    prevWarn = level === 'ok' ? '' : msg.split(':')[0];

    const sweep = psSweep({ altitude: p.altitude, throttle: p.throttle });
    const ys = sweep.map((s) => s.ps).filter(Number.isFinite);
    chart.setData({ ps: sweep.map((s) => ({ x: s.mach, y: s.ps })) }, {
      xDomain: [0.2, 2.5], zero: true,
      yDomain: [Math.max(-300, Math.min(-100, ...ys)), Math.max(100, ...ys)],
      cursor: { x: p.mach, label: `M ${p.mach.toFixed(2)}` },
    });
  };

  // lift ⟂ flight path, drag along it, thrust along the body axis, weight straight down — 6 m per W
  const cg = new THREE.Vector3(-0.8, 0.1, 0);
  const UP_NUDGE = new THREE.Vector3(0, 1.1, 0), DOWN_NUDGE = new THREE.Vector3(0, -1.1, 0);
  function placeForces() {
    const f = v.state.flight;
    if (!f || !forces.group.visible) return;
    const W = F_DATA.massCombat * 9.80665;
    const k = 4.2 / W;
    const o = cg.clone().add(v.attitude.position);
    const a = (p.alpha * Math.PI) / 180 * v.state.airborne * 0.9;
    forces.set('lift', { origin: o, dir: new THREE.Vector3(0, 1, 0), length: Math.min(f.L, W * 2.5) * k, text: kN(f.L), name: 'Lift' });
    forces.set('weight', { origin: o, dir: new THREE.Vector3(0, -1, 0), length: W * k, text: kN(W), name: 'Weight' });
    forces.set('drag', { origin: o.clone().add(new THREE.Vector3(-1.0, 0, 0)), dir: new THREE.Vector3(-1, 0, 0), length: f.D * k, text: kN(f.D), name: 'Drag', labelOffset: UP_NUDGE });
    forces.set('thrust', { origin: o.clone().add(new THREE.Vector3(-7.5, 0, 0)), dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), length: f.T * k, text: kN(f.T), name: 'Thrust', labelOffset: DOWN_NUDGE });
  }

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
      if (t - lastThermal > 0.5) { lastThermal = t; ctx.refreshThermal(); }
      ctx.stage.env.cloudSpeed = v.state.airborne * (v.state.flight ? v.state.flight.V : 0);
    },
    dispose() { forces.setVisible(false); },
    api: {
      setStick(st) { Object.assign(stick, st); sPitch.set(stick.pitch, true); sRoll.set(stick.roll, true); sYaw.set(stick.yaw, true); },
      getCondition: () => ({ ...p }),
      setCondition(c) {
        Object.assign(p, c);
        sAlt.set(p.altitude, true); sMach.set(p.mach, true); sAoA.set(p.alpha, true); sThr.set(Math.round(p.throttle * 100), true);
        dirty = true;
      },
    },
  };
}
