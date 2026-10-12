// Launch simulator: runs the full ascent physics up front, then plays it back in the bay
// with countdown, staging, fairing jettison and an ascent sky.

import * as THREE from 'three';
import { simulateAscent, sampleAt, tsiolkovsky, HELIOS } from '../physics/launch.js';
import { el, slider, readouts, section, button, segmented, toggle, fmt } from '../ui/dom.js';
import { ForceArrows, kN } from '../engine/forces.js';
import { LineChart } from '../ui/chart.js';

const SHORT = { BECO: 'BECO', MECO: 'MECO', SES: 'SES', SECO: 'SECO', MAXQ: 'Max-Q', FAIRING: 'Fairing' };

export function mountRocketLab(root, ctx) {
  const v = ctx.vehicle;
  const stage = ctx.stage;
  const p = { payload: 15000, kick: 14, target: 200 };
  let warp = 5;
  let sim = null;
  let flight = null;     // { t, phaseIdx, logged:Set }

  const sPay = slider({ label: 'Payload mass', min: 1, max: 70, step: 0.5, value: p.payload / 1000, unit: 't', format: (x) => x.toFixed(1), onInput: (x) => { p.payload = x * 1000; rerun(); } });
  const sKick = slider({ label: 'Pitch-over kick', min: 6, max: 18, step: 0.25, value: p.kick, unit: '°', format: (x) => x.toFixed(2), onInput: (x) => { p.kick = x; rerun(); } });
  const sTgt = slider({ label: 'Target orbit altitude', min: 180, max: 600, step: 5, value: p.target, unit: 'km', onInput: (x) => { p.target = x; rerun(); } });
  const warpCtl = segmented({ label: 'Time warp', value: '5', options: [['1', '1×'], ['5', '5×'], ['20', '20×'], ['50', '50×']], onChange: (x) => { warp = +x; } });

  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.9 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); placeForces(lastSample); } });
  let lastSample = null;
  function placeForces(s) {
    if (!s || !forces.group.visible) return;
    const k = 26 / s.weight;                                  // 26 m of arrow per vehicle weight
    const pr = (s.pitch * Math.PI) / 180;
    const axis = new THREE.Vector3(Math.sin(pr), Math.cos(pr), 0);
    const o = v.rigPivot.position.clone();
    forces.set('thrust', { origin: o.clone().addScaledVector(axis, -30), dir: axis.clone().negate(), length: s.thrust * k, text: kN(s.thrust), name: 'Thrust' });
    forces.set('weight', { origin: o, dir: new THREE.Vector3(0, -1, 0), length: s.weight * k, text: kN(s.weight), name: 'Weight' });
    forces.set('drag', { origin: o.clone().addScaledVector(axis, 38), dir: axis.clone().negate(), length: s.drag * k, text: kN(s.drag), name: 'Drag' });
    // thrust arrow points down the plume; flip it so it reads as the push on the vehicle
    forces.arrows.thrust.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  }
  const launchBtn = button('Launch', () => startCountdown(), { kind: 'primary' });
  const resetBtn = button('Reset to pad', () => reset());
  resetBtn.disabled = true;

  const outcome = el('p', { class: 'lab-status', role: 'status' });
  const budget = readouts([
    { key: 'dvB', label: 'Ideal Δv, boost phase', unit: 'm/s' }, { key: 'dvU', label: 'Ideal Δv, upper stage', unit: 'm/s' },
    { key: 'tw', label: 'Liftoff thrust / weight' }, { key: 'm0', label: 'Liftoff mass', unit: 't' },
  ]);
  const tele = readouts([
    { key: 't', label: 'Mission time' }, { key: 'phase', label: 'Phase' },
    { key: 'h', label: 'Altitude', unit: 'km' }, { key: 'v', label: 'Inertial velocity', unit: 'm/s' },
    { key: 'mach', label: 'Mach' }, { key: 'q', label: 'Dynamic pressure', unit: 'kPa' },
    { key: 'acc', label: 'Acceleration', unit: 'g' }, { key: 'dr', label: 'Downrange', unit: 'km' },
    { key: 'pitch', label: 'Pitch from vertical', unit: '°' }, { key: 'mass', label: 'Vehicle mass', unit: 't' },
  ]);
  const events = el('ol', { class: 'timeline' });
  const altChart = new LineChart({
    title: 'Altitude', xLabel: 'T+ (s)', yLabel: 'km', yUnit: 'km',
    series: [{ key: 'h', label: 'Altitude', color: '#3987e5' }], height: 130,
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => Math.round(y).toString(),
  });
  const velChart = new LineChart({
    title: 'Inertial velocity', xLabel: 'T+ (s)', yLabel: 'km/s', yUnit: 'km/s',
    series: [{ key: 'v', label: 'Velocity', color: '#3987e5' }], height: 130,
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => y.toFixed(1),
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'Configure the mission, then launch. The ascent is integrated with RK4 over a rotating spherical Earth: Isp varies with back-pressure, drag uses the Standard Atmosphere, and the upper stage flies closed-loop guidance to orbit.' }),
    section('Mission', sPay.el, sKick.el, sTgt.el),
    outcome,
    section('Δv budget (Tsiolkovsky)', budget.el),
    el('div', { class: 'btn-row' }, launchBtn, resetBtn, el('span', { class: 'ctl-label inline', text: 'Time warp' }), warpCtl.el),
    el('div', { class: 'btn-row' }, tForces.el),
    section('Telemetry', tele.el),
    section('Ascent profile', altChart.el, velChart.el),
    section('Flight events', events),
  );

  function rerun() {
    if (flight) return;
    sim = simulateAscent({ payload: p.payload, kickAngle: p.kick, targetAltitude: p.target * 1000 });
    const r = sim.result;
    if (r.success) {
      outcome.textContent = `Predicted: orbit ${fmt.n(r.perigee / 1000, 0)} × ${fmt.n(r.apogee / 1000, 0)} km, ${fmt.n(r.upperPropRemaining / 1000, 1)} t of upper-stage propellant left over.`;
      outcome.dataset.state = 'ok';
    } else {
      outcome.textContent = `Predicted: no orbit. ${sim.events.at(-1)?.code === 'FAILED' ? sim.events.at(-1).label : 'The vehicle runs out of energy'}. Lighten the payload or adjust the pitch-over kick.`;
      outcome.dataset.state = 'crit';
    }
    const B = HELIOS.booster, C = HELIOS.core, U = HELIOS.upper;
    const upperFull = U.dry + U.prop + HELIOS.fairing + p.payload;
    const m0 = B.count * (B.dry + B.prop) + C.dry + C.prop + upperFull;
    const dvB = tsiolkovsky((B.ispSL + B.ispVac) / 2, m0, m0 - B.count * B.prop - C.prop);
    const dvU = tsiolkovsky(U.ispVac, upperFull - HELIOS.fairing, upperFull - HELIOS.fairing - U.prop);
    budget.set('dvB', fmt.n(dvB, 0));
    budget.set('dvU', fmt.n(dvU, 0));
    budget.set('tw', ((B.count * B.engines + C.engines) * 845e3 / (m0 * 9.80665)).toFixed(2));
    budget.set('m0', fmt.n(m0 / 1000, 0));
    drawCharts(null);
    renderEvents(-Infinity);
    showSample(sim.samples[0], -10);
    lastSample = { ...sim.samples[0], thrust: 0 };
    placeForces(lastSample);
  }

  function drawCharts(tNow) {
    const pts = sim.samples.filter((_, i) => i % 2 === 0);
    const markers = sim.events.filter((e) => SHORT[e.code]).map((e) => ({ x: e.t, label: SHORT[e.code] }));
    const cur = tNow != null && tNow >= 0 ? { x: tNow } : null;
    altChart.setData({ h: pts.map((s) => ({ x: s.t, y: s.h / 1000 })) }, { zero: true, markers, cursor: cur });
    velChart.setData({ v: pts.map((s) => ({ x: s.t, y: s.v / 1000 })) }, { zero: true, markers: markers.filter((m) => m.label !== 'Max-Q'), cursor: cur });
  }

  function renderEvents(tNow) {
    events.replaceChildren(...sim.events.map((e) => el('li', { class: `tl-row${e.t <= tNow ? ' is-past' : ''}${e.code === 'FAILED' ? ' is-crit' : ''}` },
      el('time', { class: 'tl-time', text: fmt.time(e.t) }), el('span', { text: e.label }))));
  }

  function showSample(s, t) {
    tele.set('t', fmt.time(t));
    const phaseNames = { BOOST: 'Boost (27 engines)', CORE: 'Core alone', COAST: 'Staging coast', UPPER: 'Upper-stage burn', ORBIT: 'In orbit', FAILED: 'Suborbital' };
    tele.set('phase', t < 0 ? 'Countdown' : phaseNames[s.phase] || s.phase, s.phase === 'FAILED' ? 'crit' : s.phase === 'ORBIT' ? 'ok' : '');
    tele.set('h', fmt.n(s.h / 1000, 1));
    tele.set('v', fmt.n(s.v, 0));
    tele.set('mach', s.mach.toFixed(2));
    tele.set('q', fmt.n(s.q / 1000, 1), s.q > 40000 ? 'warn' : '');
    tele.set('acc', s.accel.toFixed(2), s.accel > 4.5 ? 'warn' : '');
    tele.set('dr', fmt.n(s.downrange / 1000, 0));
    tele.set('pitch', fmt.n(s.pitch, 1));
    tele.set('mass', fmt.n(s.mass / 1000, 1));
  }

  // ------------------------------------------------------------------ flight playback
  const camDelta = new THREE.Vector3();
  const rocketWorld = new THREE.Vector3();
  let prevRocket = null;

  function startCountdown() {
    if (flight) return;
    sim = simulateAscent({ payload: p.payload, kickAngle: p.kick, targetAltitude: p.target * 1000 });
    flight = { t: -10, logged: new Set(), done: false };
    launchBtn.disabled = true; resetBtn.disabled = false;
    [sPay, sKick, sTgt].forEach((s) => { s.input.disabled = true; });
    ctx.log(v.designation, `Countdown started · payload ${fmt.n(p.payload / 1000, 1)} t → ${p.target} km`, 'info');
    ctx.setExplode(0);
    ctx.setAutoRotate(false);
    if (ctx.stage.env.look !== 'pad') ctx.setLook('pad');
    stage.ascending = true;
    prevRocket = null;
  }

  function reset() {
    flight = null;
    v.resetFlight();
    stage.hangar.position.y = 0;
    stage.hangar.visible = true;
    stage.ascending = false;
    stage.env.applyLook(stage.env.look || 'pad');
    launchBtn.disabled = false; resetBtn.disabled = true;
    [sPay, sKick, sTgt].forEach((s) => { s.input.disabled = false; });
    ctx.refit();
    rerun();
    ctx.log(v.designation, 'Vehicle reset to the pad', 'info');
  }

  const sepTimes = () => {
    const find = (c) => sim.events.find((e) => e.code === c)?.t ?? null;
    return { booster: find('BSEP'), core: find('SEP'), fairing: find('FAIRING') };
  };

  rerun();

  return {
    update(dt, time) {
      if (!flight) return;
      const f = flight;
      const step = f.t < 0 ? dt : dt * warp;
      f.t = Math.min(f.t + step, sim.samples.at(-1).t + 30);
      const t = f.t;
      // countdown + ignition ramp
      v.state.ignition = t < -3 ? 0 : t < 0 ? Math.min(1, (t + 3) / 2.5) : 0;
      if (t >= -3 && !f.logged.has('IGN')) { f.logged.add('IGN'); ctx.log(v.designation, 'Ignition sequence start · 27 engines', 'warn'); }
      const s = sampleAt(sim.samples, Math.max(0, t));
      if (t >= 0) {
        const st = sepTimes();
        const rel = (x) => (x != null && t >= x ? t - x : null);
        v.applyFlight(s, { booster: rel(st.booster), core: rel(st.core), fairing: rel(st.fairing) });
      } else {
        v.state.firing = { booster: false, core: false, upper: false };
      }
      for (const e of sim.events) {
        if (t >= e.t && !f.logged.has(e.code + e.t)) {
          f.logged.add(e.code + e.t);
          ctx.log(v.designation, `${fmt.time(e.t)} ${e.label}`, e.code === 'FAILED' ? 'crit' : e.code === 'ORBIT' ? 'ok' : 'info');
          renderEvents(t);
          if (e.code === 'ORBIT' || e.code === 'FAILED') {
            outcome.textContent = e.code === 'ORBIT'
              ? `Orbit achieved: ${fmt.n(sim.result.perigee / 1000, 0)} × ${fmt.n(sim.result.apogee / 1000, 0)} km at ${fmt.n(sim.result.velocity, 0)} m/s.`
              : 'No orbit: the upper stage ran out of propellant before reaching orbital velocity.';
            outcome.dataset.state = e.code === 'ORBIT' ? 'ok' : 'crit';
          }
        }
      }

      // visual altitude: real for the first 350 m, then the world scrolls away beneath
      const h = t >= 0 ? s.h : 0;
      const hVis = Math.min(h, 350);
      v.rigPivot.position.y = 3.2 + 32 + hVis;
      const scroll = Math.max(0, h - 350);
      v.ground.position.y = -scroll;
      stage.hangar.position.y = -scroll * v._fitScale;
      stage.hangar.visible = scroll < 5000;

      // camera follows the rocket's centre, preserving the user's orbit offset
      v.followPoint(rocketWorld);
      if (prevRocket) {
        stage.shiftView(camDelta.subVectors(rocketWorld, prevRocket));
      }
      prevRocket = (prevRocket || new THREE.Vector3()).copy(rocketWorld);
      if (!stage.reducedMotion && t > -2 && t < 20 && h < 2000) {
        const shake = (1 - Math.min(1, Math.max(0, t) / 20)) * 0.04;
        stage.camera.position.x += (Math.random() - 0.5) * shake;
        stage.camera.position.y += (Math.random() - 0.5) * shake;
      }

      stage.env.setAscent(h, t >= 0 ? s.downrange / 6371000 : 0);

      showSample(s, t);
      lastSample = t >= 0 ? s : { ...s, thrust: 0 };
      placeForces(lastSample);
      if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) { drawCharts(t); ctx.refreshThermal(); }
    },
    dispose() {
      forces.setVisible(false);
      if (flight) {
        flight = null;
        v.resetFlight();
        stage.hangar.position.y = 0;
        stage.hangar.visible = true;
        stage.ascending = false;
        stage.env.applyLook(stage.env.look || 'pad');
      }
    },
  };
}
