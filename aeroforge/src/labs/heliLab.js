// Rotor-performance lab for the UH-60M: momentum-theory hover, the forward-flight power polar,
// engine power available with altitude/temperature lapse, hover ceilings in and out of ground
// effect, top-speed limits (power, advancing-tip Mach, retreating-blade stall) and autorotation.
// The model in the bay follows: collective, disc tilt, tail-rotor pitch, stabilator, doors, hover.

import * as THREE from 'three';
import { heliPerformance, powerCurve, hoverCeiling, stabilatorSchedule, UH60, SHP, KT, FPM } from '../physics/rotor.js';
import { el, slider, toggle, readouts, section, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import { ForceArrows, kN } from '../engine/forces.js';

const DEG = Math.PI / 180;

/** Rotor downwash: particles following the actuator-disc streamtube, spreading along the ground. */
class Downwash {
  constructor(parent, R, hubY, count = 900) {
    this.R = R; this.hubY = hubY;
    this.n = count;
    this.f = new Float32Array(count); this.az = new Float32Array(count); this.z = new Float32Array(count); this.gr = new Float32Array(count);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.respawn(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, this.mat);
    this.points.userData.fx = true;
    this.points.userData.noAO = true;
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.raycast = () => {};
    parent.add(this.points);
  }
  respawn(i, scatter = false) {
    this.f[i] = Math.sqrt(Math.random()) * 0.98;
    this.az[i] = Math.random() * Math.PI * 2;
    this.z[i] = scatter ? -this.R * 0.6 + Math.random() * this.R * 2 : -this.R * 0.6;
    this.gr[i] = 0;
  }
  /** vi: induced velocity at the disc (m/s); k: slow-motion factor; groundY: ground height in the frame. */
  update(dt, vi, k, groundY) {
    const pos = this.points.geometry.attributes.position;
    const R = this.R;
    for (let i = 0; i < this.n; i++) {
      const z = this.z[i];                                    // metres below the disc (negative above)
      const v = vi * (1 + z / Math.sqrt(z * z + R * R));        // actuator-disc axial velocity
      const r = this.f[i] * R * Math.sqrt(vi / Math.max(v, 0.05 * vi));
      let y = this.hubY - z;
      let rr = Math.min(r, 1.6 * R);
      if (y <= groundY + 0.15) {                                // wall jet along the ground
        y = groundY + 0.15;
        this.gr[i] += v * k * dt;
        rr = Math.max(rr, this.f[i] * R) + this.gr[i];
      } else this.z[i] = z + v * k * dt;
      if (rr > 2.2 * R || this.z[i] > 3 * R) { this.respawn(i); continue; }
      pos.setXYZ(i, rr * Math.cos(this.az[i]), y, rr * Math.sin(this.az[i]));
    }
    pos.needsUpdate = true;
  }
  dispose() { this.points.parent?.remove(this.points); this.points.geometry.dispose(); this.mat.dispose(); }
}

export function mountHeliLab(root, ctx) {
  const v = ctx.vehicle;
  const isaT = (h) => 15 - 0.0065 * Math.min(h, 11000);
  const p = { mass: 8200, altitude: 0, isaDev: 0, speed: 0, oei: false };
  let dirty = true;
  const set = (k) => (x) => { p[k] = x; dirty = true; };

  const sMass = slider({ label: 'Gross mass', min: 5700, max: UH60.mtowExternal, step: 10, value: p.mass, unit: 'kg', onInput: set('mass') });
  const sAlt = slider({ label: 'Pressure altitude', min: 0, max: 6000, step: 50, value: p.altitude, unit: 'm', format: (x) => `${fmt.n(x)} (${fmt.n(x * 3.2808)} ft)`, onInput: (x) => { p.altitude = x; dirty = true; sTemp.set(p.isaDev, true); } });
  const sTemp = slider({ label: 'Air temperature', min: -30, max: 35, step: 1, value: p.isaDev, format: (x) => `ISA ${x >= 0 ? '+' : '−'}${Math.abs(x)} °C · OAT ${fmt.n(isaT(p.altitude) + x)} °C`, onInput: set('isaDev') });
  const sSpd = slider({ label: 'True airspeed', min: 0, max: 180, step: 1, value: p.speed, unit: 'kt', format: (x) => `${x} (${fmt.n(x * 1.852)} km/h)`, onInput: set('speed') });
  const tOei = toggle({ label: 'One engine inoperative', value: false, onChange: (on) => { p.oei = on; dirty = true; ctx.log(v.designation, on ? 'Engine failure: one T700 at 2.5-minute contingency power' : 'Both engines restored', on ? 'warn' : 'info'); } });

  const stick = { pitch: 0, roll: 0, yaw: 0 };
  const pct = (x) => `${Math.round(x * 100)} %`;
  const sPitch = slider({ label: 'Longitudinal cyclic (aft +)', min: -1, max: 1, step: 0.01, value: 0, format: pct, onInput: (x) => { stick.pitch = x; v.setStick(stick); } });
  const sRoll = slider({ label: 'Lateral cyclic (right +)', min: -1, max: 1, step: 0.01, value: 0, format: pct, onInput: (x) => { stick.roll = x; v.setStick(stick); } });
  const sYaw = slider({ label: 'Pedals (right +)', min: -1, max: 1, step: 0.01, value: 0, format: pct, onInput: (x) => { stick.yaw = x; v.setStick(stick); } });
  const sShow = slider({ label: 'Rotor display speed', min: 0, max: 25, step: 1, value: Math.round(v.state.display * 100), format: (x) => (x ? `${x} % of 258 rpm` : 'stopped'), onInput: (x) => { v.setRotorDisplay(x / 100); } });
  const tHover = toggle({ label: 'Hover (10 ft)', value: false, onChange: (on) => { v.setAirborne(on); ctx.log(v.designation, on ? 'Lift-off to a 10 ft hover, in ground effect' : 'Landed', 'info'); } });
  const tRotor = toggle({ label: 'Rotor turning', value: true, onChange: (on) => { v.setRotor(on); ctx.log(v.designation, on ? 'Rotor brake off · engines to 100 % Nr' : 'Engines to idle · rotor brake on', 'info'); } });
  const tDoors = toggle({ label: 'Cabin doors open', value: false, onChange: (on) => v.setDoors(on) });
  const tFlow = toggle({ label: 'Downwash', value: false, onChange: (on) => { flow.points.visible = on; } });
  const forces = v.forces || (v.forces = new ForceArrows(v.air || v.root, { radius: 0.07 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); placeForces(); } });

  const status = el('p', { class: 'lab-status', role: 'status' });
  const roH = readouts([
    { key: 'dl', label: 'Disc loading', unit: 'kg/m²' }, { key: 'vh', label: 'Induced velocity v_h', unit: 'm/s' },
    { key: 'cts', label: 'Blade loading C_T/σ' }, { key: 'fm', label: 'Figure of merit' },
    { key: 'oge', label: 'Hover power OGE', unit: 'shp' }, { key: 'ige', label: 'Hover power IGE (10 ft)', unit: 'shp' },
    { key: 'avail', label: 'Power available (30 min)', unit: 'shp' }, { key: 'tr', label: 'Tail rotor share', unit: '%' },
    { key: 'cOge', label: 'Hover ceiling OGE', unit: 'm' }, { key: 'cIge', label: 'Hover ceiling IGE', unit: 'm' },
    { key: 'vroc', label: 'Vertical climb OGE', unit: 'ft/min' }, { key: 'th', label: 'Collective θ 0.75R', unit: '°' },
  ]);
  const roF = readouts([
    { key: 'p', label: 'Power required', unit: 'shp' }, { key: 'da', label: 'Density altitude', unit: 'm' },
    { key: 'vbe', label: 'Best endurance', unit: 'kt' }, { key: 'vbr', label: 'Best range', unit: 'kt' },
    { key: 'vmax', label: 'Max level speed', unit: 'kt' }, { key: 'mach', label: 'Advancing tip Mach' },
    { key: 'rod', label: 'Autorotation descent', unit: 'ft/min' }, { key: 'rodMin', label: 'Minimum descent', unit: 'ft/min' },
    { key: 'glide', label: 'Best glide ratio' }, { key: 'nr', label: 'Rotor energy · time to 80 % Nr', unit: 's' },
  ]);
  const limitNote = el('p', { class: 'lab-note' });

  const chart = new LineChart({
    title: 'Power required versus airspeed', xLabel: 'TAS (kt)', yLabel: 'shp', yUnit: 'shp', height: 190,
    series: [
      { key: 'total', label: 'Total', color: '#3987e5' },
      { key: 'induced', label: 'Induced', color: '#c084fc', area: false },
      { key: 'profile', label: 'Profile', color: '#f59e0b', area: false },
      { key: 'parasite', label: 'Parasite', color: '#ff5c52', area: false },
      { key: 'avail', label: 'Available (max continuous)', color: '#3ecf8e', area: false },
    ],
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => fmt.n(y),
  });
  const ceil = new LineChart({
    title: 'Hover ceiling versus gross mass', xLabel: 'Gross mass (kg)', yLabel: 'm', yUnit: 'm', height: 150,
    series: [{ key: 'ige', label: 'In ground effect (10 ft)', color: '#59c1a8' }, { key: 'oge', label: 'Out of ground effect', color: '#3987e5' }],
    xFormat: (x) => fmt.n(x), yFormat: (y) => fmt.n(y),
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'Load the Black Hawk and pick the day. Hover power comes from momentum theory, P = T^1.5 / √(2ρA) ÷ FM; forward flight adds the classic power polar of induced, blade-profile and airframe-parasite power, plus the tail rotor that cancels the torque. Engine power falls off with altitude and heat.' }),
    section('Condition', sMass.el, sAlt.el, sTemp.el, sSpd.el, el('div', { class: 'btn-row' }, tOei.el)),
    status,
    section('Hover', roH.el),
    section('Forward flight & limits', roF.el, limitNote),
    section('The power bucket', chart.el, el('p', { class: 'lab-note', text: 'Induced power falls as speed grows (the rotor works on more air each second), profile power rises slowly and parasite power with V³. The bottom of the bucket is the best-endurance (and minimum-descent autorotation) speed; the tangent from the origin marks best range.' })),
    section('Hover ceiling', ceil.el, el('p', { class: 'lab-note', text: 'Near the ground the rotor wake cannot contract freely, so induced power drops (Cheeseman–Bennett: 1 − (R/4z)²). That cushion lets a heavy helicopter hover in ground effect where it could not out of it.' })),
    section('Controls', sPitch.el, sRoll.el, sYaw.el, sShow.el, el('div', { class: 'btn-row' }, tRotor.el, tHover.el, tDoors.el, tFlow.el, tForces.el)),
  );

  const flow = new Downwash(v.air || v.root, UH60.R, UH60.hubHeight);
  let last = null;

  const compute = () => {
    const V = p.speed * KT;
    const r = heliPerformance({ mass: p.mass, pressureAltitude: p.altitude, isaDev: p.isaDev, V, oei: p.oei });
    last = r;
    const h = r.hoverOGE, f = r.fwd, s = r.sched;
    roH.set('dl', fmt.n(h.diskLoadingKg, 1));
    roH.set('vh', fmt.n(h.mr.vh, 1));
    roH.set('cts', h.mr.CTs.toFixed(3), h.mr.CTs > 0.11 ? 'warn' : '');
    roH.set('fm', r.FM.toFixed(2));
    roH.set('oge', fmt.n(h.shp), r.canHoverOGE ? 'ok' : 'crit');
    roH.set('ige', fmt.n(r.hoverIGE.shp), r.canHoverIGE ? 'ok' : 'crit');
    roH.set('avail', fmt.n(r.irp.shp), r.irp.limit === 'transmission' ? '' : 'warn');
    roH.set('tr', fmt.n((100 * h.tailRotor) / h.total, 1));
    const ceilTxt = (c) => (c === -Infinity ? 'none' : c === Infinity ? '> 9,000' : fmt.n(c));
    roH.set('cOge', ceilTxt(r.ceilingOGE), r.ceilingOGE < p.altitude ? 'crit' : '');
    roH.set('cIge', ceilTxt(r.ceilingIGE), r.ceilingIGE < p.altitude ? 'crit' : '');
    roH.set('vroc', fmt.n(r.vroc / FPM));
    roH.set('th', fmt.n(h.mr.theta75 / DEG, 1));

    const pAvailMcp = r.mcp.shp;
    roF.set('p', fmt.n(f.shp), f.shp > pAvailMcp ? 'crit' : f.shp > 0.9 * pAvailMcp ? 'warn' : '');
    roF.set('da', fmt.n(r.air.densityAltitude));
    roF.set('vbe', fmt.n(s.vbe / KT));
    roF.set('vbr', fmt.n(s.vbr / KT));
    roF.set('vmax', s.vmax > 0 ? fmt.n(s.vmax / KT) : '—', V > s.vmax ? 'crit' : '');
    roF.set('mach', f.advancingTipMach.toFixed(3), f.advancingTipMach > UH60.tipMachLimit ? 'crit' : f.advancingTipMach > UH60.mDrag ? 'warn' : '');
    roF.set('rod', fmt.n(r.auto.at(Math.max(V, 10 * KT)) / FPM));
    roF.set('rodMin', `${fmt.n(r.auto.minRod / FPM)} @ ${fmt.n(r.auto.vMinRod / KT)} kt`);
    roF.set('glide', `${r.auto.glideRatio.toFixed(1)} : 1 @ ${fmt.n(r.auto.vBestGlide / KT)} kt`);
    roF.set('nr', `${(r.energy.E / 1e6).toFixed(1)} MJ · ${r.energy.seconds.toFixed(1)}`, r.energy.seconds < 1 ? 'warn' : '');
    limitNote.textContent = s.vmax > 0
      ? `Top speed here is set by ${s.limit}: power ${fmt.n(s.vPower / KT)} kt, tip Mach ${fmt.n(s.vTip / KT)} kt, retreating-blade stall ${fmt.n(s.vStall / KT)} kt.`
      : 'The engines cannot hold level flight at any speed in this condition.';

    let msg, level = 'ok';
    const margin = (r.irp.W - h.total) / h.total;
    if (r.overExternal) { msg = `Above the ${fmt.n(UH60.mtowExternal)} kg limit even with the extra load slung on the hook.`; level = 'crit'; }
    else if (!r.canHoverIGE) { msg = `Cannot hover even in ground effect: needs ${fmt.n(r.hoverIGE.shp)} shp, the ${p.oei ? 'remaining engine gives' : 'engines give'} ${fmt.n(r.irp.shp)}. Lighten the load or wait for cooler air.`; level = 'crit'; }
    else if (!r.canHoverOGE) { msg = `Hovers only in ground effect: ${fmt.n(h.shp - r.irp.shp)} shp short out of it. Take off with a running start through translational lift.`; level = 'warn'; }
    else if (f.shp > pAvailMcp && V > 0) { msg = `${p.speed} kt needs ${fmt.n(f.shp)} shp, more than the ${fmt.n(pAvailMcp)} shp continuous rating: limit is ${fmt.n(s.vmax / KT)} kt.`; level = 'warn'; }
    else if (r.overweight) { msg = `Over the ${fmt.n(UH60.mtow)} kg internal maximum: legal only with the excess carried on the cargo hook.`; level = 'warn'; }
    else msg = `Hovers out of ground effect with ${fmt.n(margin * 100)} % power to spare; ${p.speed > 0 ? `${p.speed} kt takes ${fmt.n(f.shp)} shp.` : `best endurance at ${fmt.n(s.vbe / KT)} kt.`}`;
    status.textContent = msg;
    status.dataset.state = level;

    const curve = powerCurve({ mass: p.mass, pressureAltitude: p.altitude, isaDev: p.isaDev }, { vmaxKt: 180, stepKt: 3 });
    const S = (k) => curve.map((c) => ({ x: c.kt, y: c[k] / SHP }));
    chart.setData({ total: S('total'), induced: S('induced'), profile: S('profile'), parasite: S('parasite'), avail: curve.map((c) => ({ x: c.kt, y: pAvailMcp })) }, {
      xDomain: [0, 180], zero: true,
      cursor: { x: p.speed, label: `${fmt.n(f.shp)} shp` },
      markers: [{ x: s.vbe / KT, label: 'endurance' }, { x: s.vbr / KT, label: 'range' }, ...(s.vmax > 0 ? [{ x: s.vmax / KT, label: 'Vmax' }] : [])],
    });
    const ms = [];
    for (let m = 5700; m <= UH60.mtowExternal + 1; m += 330) ms.push(m);
    const cl = (c) => (Number.isFinite(c) ? Math.max(0, c) : c === Infinity ? 9000 : 0);
    ceil.setData({
      oge: ms.map((m) => ({ x: m, y: cl(hoverCeiling({ mass: m, isaDev: p.isaDev, oei: p.oei })) })),
      ige: ms.map((m) => ({ x: m, y: cl(hoverCeiling({ mass: m, isaDev: p.isaDev, oei: p.oei, wheelHeight: 3.05 })) })),
    }, { xDomain: [5700, UH60.mtowExternal], zero: true, cursor: { x: p.mass, label: `${fmt.n(p.mass)} kg` } });

    // drive the model
    const T = f.Tmr;
    v.setFlight({
      airspeedKt: p.speed,
      collective: f.mr.theta75,
      trimLon: Math.atan2(f.D, f.W),
      trimLat: -Math.atan2(f.Tyaw, T) / (1 + (p.speed / 40) ** 2),
      trPitch: Math.max(2 * DEG, Math.min(22 * DEG, f.tr.theta75)),
      cone: 3.5 * DEG * (T / (UH60.mtow * 9.80665)),
      power: Math.min(1.2, f.total / r.irp.W),
      oatK: r.air.T,
      stab: stabilatorSchedule(p.speed) * DEG,
    });
    ctx.refreshThermal();
    if (forces.group.visible) placeForces();
  };

  // forces in the flight-pose frame: rotor thrust along the tilted disc, weight, tail-rotor thrust, drag
  function placeForces() {
    if (!last || !forces.group.visible) return;
    const f = last.fwd;
    const k = 3.6 / f.W;
    const hub = new THREE.Vector3(0, UH60.hubHeight + 0.6, 0);
    const tilt = Math.atan2(f.D, f.W);
    const lat = -Math.atan2(f.Tyaw, f.Tmr) / (1 + (p.speed / 40) ** 2);
    const dir = new THREE.Vector3(Math.sin(tilt), 1, Math.sin(lat)).normalize();
    forces.set('lift', { origin: hub, dir, length: f.Tmr * k, text: kN(f.Tmr), name: 'Rotor thrust' });
    forces.set('weight', { origin: new THREE.Vector3(-0.15, 1.4, 0), dir: new THREE.Vector3(0, -1, 0), length: f.W * k, text: kN(f.W), name: 'Weight' });
    const trHub = new THREE.Vector3(-9.93, 3.56, 0.25);
    const n = new THREE.Vector3(0, Math.sin(20 * DEG), Math.cos(20 * DEG));
    forces.set('thrust', { origin: trHub, dir: n, length: Math.max(0.3, f.Ttr * k * 6), text: `${kN(f.Ttr)} (×6)`, name: 'Tail-rotor thrust' });
    forces.set('drag', { origin: new THREE.Vector3(-0.5, 1.4, 0), dir: new THREE.Vector3(-1, 0, 0), length: f.D * k * 6, text: `${kN(f.D)} (×6)`, name: 'Drag', labelOffset: new THREE.Vector3(0, 0.6, 0) });
  }

  const api = {
    setStick(st) {
      Object.assign(stick, st);
      sPitch.set(stick.pitch, true); sRoll.set(stick.roll, true); sYaw.set(stick.yaw, true);
      v.setStick(stick);
    },
    getCondition: () => ({ ...p }),
    setCondition(c) {
      if (c.mass != null) { p.mass = c.mass; sMass.set(p.mass, true); }
      if (c.altitude != null) { p.altitude = Math.min(6000, c.altitude); sAlt.set(p.altitude, true); }
      if (c.isaDev != null) { p.isaDev = c.isaDev; sTemp.set(p.isaDev, true); }
      if (c.speed != null) { p.speed = c.speed; sSpd.set(p.speed, true); }
      dirty = true;
    },
    setDisplay(d) {
      // the guided tour's 'flow' demo turns the downwash on; its exit call ({ stations: false }) turns it off
      const on = 'flow' in d ? !!d.flow : false;
      tFlow.set(on, true);
      flow.points.visible = on;
    },
    setDoors(open) { tDoors.set(open); },
  };

  return {
    update(dt) {
      if (dirty) { dirty = false; compute(); }
      if (flow.points.visible && last) {
        // hover inflow at the disc; slowed by the same factor as the rotor so both read together
        flow.update(Math.min(dt, 0.1), last.hoverOGE.mr.vh, Math.max(0.05, v.state.display * 1.2) * v.state.nr, -v.state.airborne * 3.05);
      }
      if (forces.group.visible) placeForces();
    },
    dispose() {
      forces.setVisible(false);
      flow.dispose();
      v.setStick({ pitch: 0, roll: 0, yaw: 0 });
    },
    api,
  };
}
