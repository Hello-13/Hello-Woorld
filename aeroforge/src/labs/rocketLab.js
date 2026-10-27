// Falcon Heavy launch simulator: runs the full ascent physics up front, then plays it back on
// LC-39A with countdown, 27-engine ignition, side-booster and centre-core separation, fairing
// separation, the Merlin Vacuum burn and an ascent sky.

import * as THREE from 'three';
import { simulateAscent, sampleAt, deltaVBudget, engineThrust, liftoffMass, FALCON_HEAVY } from '../physics/launch.js';
import { el, slider, readouts, section, button, segmented, toggle, fmt } from '../ui/dom.js';
import { ForceArrows, kN } from '../engine/forces.js';
import { LineChart } from '../ui/chart.js';

const SHORT = { BECO: 'BECO', MECO: 'MECO', SES: 'SES-1', SECO: 'SECO-1', MAXQ: 'Max-Q', FAIRING: 'Fairing' };
const P_SL = 101325;

export function mountRocketLab(root, ctx) {
  const v = ctx.vehicle;
  const stage = ctx.stage;
  const p = { payload: 15000, kick: 14, target: 200 };
  let warp = 5;
  let sim = null;
  let flight = null;     // { t, phaseIdx, logged:Set }

  const sPay = slider({ label: 'Payload mass', min: 1, max: 75, step: 0.5, value: p.payload / 1000, unit: 't', format: (x) => x.toFixed(1), onInput: (x) => { p.payload = x * 1000; rerun(); } });
  const sKick = slider({ label: 'Pitch-over kick', min: 6, max: 18, step: 0.25, value: p.kick, unit: '°', format: (x) => x.toFixed(2), onInput: (x) => { p.kick = x; rerun(); } });
  const sTgt = slider({ label: 'Target orbit altitude', min: 180, max: 600, step: 5, value: p.target, unit: 'km', onInput: (x) => { p.target = x; rerun(); } });
  const warpCtl = segmented({ label: 'Time warp', value: '5', options: [['1', '1×'], ['5', '5×'], ['20', '20×'], ['50', '50×']], onChange: (x) => { warp = +x; } });

  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.9 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); placeForces(lastSample); } });
  // landing legs: swing side booster A's legs out to the landing stance (the mount steps aside while they are out)
  const tLegs = toggle({ label: 'Booster A landing legs', value: false, onChange: (on) => { v.setLegs?.(on ? 1 : 0); ctx.log(v.designation, on ? 'Side booster A landing legs deployed: nested helium pistons, ≈ 18 m stance' : 'Landing legs stowed', 'info'); } });
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
    { key: 'dvB', label: 'Ideal Δv, 27-engine boost', unit: 'm/s' }, { key: 'dvC', label: 'Ideal Δv, centre core alone', unit: 'm/s' },
    { key: 'dvU', label: 'Ideal Δv, second stage', unit: 'm/s' }, { key: 'dvT', label: 'Ideal Δv, total', unit: 'm/s' },
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
    el('p', { class: 'lab-intro', text: 'Configure the mission, then launch Falcon Heavy from LC-39A. The ascent is integrated with RK4 over a rotating spherical Earth. Each Merlin\'s thrust falls with back-pressure on its nozzle exit (F = F_vac − p_a·A_e: 914 kN in vacuum, 845 kN at sea level); about 25 s after liftoff the centre core throttles to ≈ 55 % (both figures are estimates; SpaceX does not publish them) so it is still burning when the side boosters separate; drag uses the Standard Atmosphere. The second stage flies closed-loop guidance and cuts off when the orbit\'s energy matches a circular orbit at the target altitude; the fairing goes 25 s after it lights, once aerodynamic heating has fallen to a low level. The physics is the fully expendable vehicle behind the published 63.8 t to LEO. The 3-D model shows the recovery configuration (legs and grid fins on every core, as on Arabsat-6A); expended cores fly without them, and recovering the boosters costs payload.' }),
    section('Mission', sPay.el, sKick.el, sTgt.el),
    outcome,
    section('Δv budget (Tsiolkovsky)', budget.el),
    el('div', { class: 'btn-row' }, launchBtn, resetBtn, el('span', { class: 'ctl-label inline', text: 'Time warp' }), warpCtl.el),
    el('div', { class: 'btn-row' }, tForces.el, tLegs.el),
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
      outcome.textContent = `Predicted: ${r.orbit ? '' : 'no orbit. '}${r.label}.`;
      outcome.dataset.state = r.orbit ? 'warn' : 'crit';
    }
    const V = FALCON_HEAVY;
    const dv = deltaVBudget(V, p.payload);
    const m0 = liftoffMass(V, p.payload);
    const f0 = engineThrust(V.booster, P_SL).thrust * V.booster.count + engineThrust(V.core, P_SL).thrust;
    budget.set('dvB', fmt.n(dv.boost, 0));
    budget.set('dvC', fmt.n(dv.core, 0));
    budget.set('dvU', fmt.n(dv.upper, 0));
    budget.set('dvT', fmt.n(dv.total, 0));
    budget.set('tw', (f0 / (m0 * 9.80665)).toFixed(2));
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
    events.replaceChildren(...sim.events.map((e) => el('li', { class: `tl-row${e.t <= tNow ? ' is-past' : ''}${e.code === 'FAILED' || e.code === 'OFFTARGET' ? ' is-crit' : ''}` },
      el('time', { class: 'tl-time', text: fmt.time(e.t) }), el('span', { text: e.label }))));
  }

  function showSample(s, t) {
    tele.set('t', fmt.time(t));
    const phaseNames = { BOOST: 'Boost (27 Merlins)', CORE: 'Centre core', COAST: 'Stage separation', UPPER: 'Second-stage burn', ORBIT: 'In orbit', FAILED: 'Suborbital' };
    tele.set('phase', t < 0 ? 'Countdown' : phaseNames[s.phase] || s.phase, s.phase === 'FAILED' ? 'crit' : s.phase === 'ORBIT' ? 'ok' : '');
    tele.set('h', fmt.n(s.h / 1000, 1));
    tele.set('v', fmt.n(s.v, 0));
    // still clamped to the mount before T-0: no airspeed, no dynamic pressure, no thrust yet
    const pad = t < 0;
    tele.set('mach', pad ? '0.00' : s.mach.toFixed(2));
    tele.set('q', pad ? '0.0' : fmt.n(s.q / 1000, 1), !pad && s.q > 40000 ? 'warn' : '');
    tele.set('acc', pad ? '—' : s.accel.toFixed(2), !pad && s.accel > 4.5 ? 'warn' : '');
    tele.set('dr', fmt.n(s.downrange / 1000, 0));
    tele.set('pitch', fmt.n(s.pitch, 1));
    tele.set('mass', fmt.n(s.mass / 1000, 1));
  }

  // ------------------------------------------------------------------ flight playback
  const camDelta = new THREE.Vector3();
  const lastShake = { x: 0, y: 0 };
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
    tLegs.set(false, true); tLegs.el.disabled = true;
    v.setLegs?.(0, { animate: false });
    // an open part card would sit where the chase camera holds the vehicle: close it (the app has
    // no context call for this, so press the card's own close button)
    document.querySelector('#part-card:not([hidden]) .pc-head .icon-btn')?.click();
    if (ctx.stage.env.look !== 'pad') ctx.setLook('pad');
    // start the chase from a view of the whole stack: keep the viewer's direction, centre on the
    // point the camera will follow and back off until the full 70 m stack fits, so a close-up on
    // one part (or a part fly-to still under way) cannot leave the vehicle out of frame later
    {
      const cam = stage.camera, tgt = stage.controls.target;
      const dir = cam.position.clone().sub(tgt);
      const d0 = dir.length();
      if (d0 > 1e-6) dir.divideScalar(d0); else dir.set(0.6, 0.15, 0.8);
      const centre = v.followPoint(new THREE.Vector3());
      const { tanV, tanH } = stage.frameTan();
      const need = ((76 * v._fitScale) / (2 * Math.min(tanV, tanH))) * 1.1;
      stage.flyTo(centre.clone().addScaledVector(dir, Math.max(d0, need)), centre, 1.2);
    }
    stage.ascending = true;
    prevRocket = null;
    lastShake.x = lastShake.y = 0;
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
    tLegs.el.disabled = false;
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
      if (t >= -3 && !f.logged.has('IGN')) { f.logged.add('IGN'); ctx.log(v.designation, 'Ignition sequence start · 27 Merlin 1D, TEA-TEB', 'warn'); }
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
          ctx.log(v.designation, `${fmt.time(e.t)} ${e.label}`, e.code === 'FAILED' ? 'crit' : e.code === 'OFFTARGET' ? 'warn' : e.code === 'ORBIT' ? 'ok' : 'info');
          renderEvents(t);
          if (e.code === 'ORBIT' || e.code === 'FAILED' || e.code === 'OFFTARGET') {
            outcome.textContent = e.code === 'ORBIT'
              ? `Orbit achieved: ${fmt.n(sim.result.perigee / 1000, 0)} × ${fmt.n(sim.result.apogee / 1000, 0)} km at ${fmt.n(sim.result.velocity, 0)} m/s.`
              : `${e.code === 'FAILED' ? 'No orbit: ' : ''}${sim.result.label}.`;
            outcome.dataset.state = e.code === 'ORBIT' ? 'ok' : e.code === 'OFFTARGET' ? 'warn' : 'crit';
          }
        }
      }

      // visual altitude: real for the first 350 m, then the world scrolls away beneath
      const h = t >= 0 ? s.h : 0;
      const hVis = Math.min(h, 350);
      v.rigPivot.position.y = v.pivotY + hVis;
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
      // smooth low-frequency rumble (sums of sines) that fades out by T+20 s and leaves the camera
      // where it was — no per-frame random jitter
      const shake = !stage.reducedMotion && t > -2 && t < 20 && h < 2000 ? (1 - Math.min(1, Math.max(0, t) / 20)) * 0.03 : 0;
      const w = time * 6.3;
      const ox = shake * (Math.sin(w * 1.7) + 0.5 * Math.sin(w * 3.1 + 1.3));
      const oy = shake * (Math.sin(w * 2.3 + 0.7) + 0.5 * Math.sin(w * 2.9 + 2.1));
      stage.camera.position.x += ox - lastShake.x;
      stage.camera.position.y += oy - lastShake.y;
      lastShake.x = ox; lastShake.y = oy;

      stage.env.setAscent(h, t >= 0 ? s.downrange / 6371000 : 0);

      showSample(s, t);
      lastSample = t >= 0 ? s : { ...s, thrust: 0 };
      placeForces(lastSample);
      if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) { drawCharts(t); ctx.refreshThermal(); }
    },
    dispose() {
      forces.setVisible(false);
      if (tLegs.get()) v.setLegs?.(0);
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
