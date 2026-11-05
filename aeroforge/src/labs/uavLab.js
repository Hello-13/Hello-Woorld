// MQ-9A mission-endurance lab: Breguet endurance and range for a propeller aircraft, with the stores
// fit (weight and drag), power required against the TPE331's power available at altitude, the
// stall-margin floor on loiter speed, time on station after transit, and the service ceiling.

import { mission, enduranceSweep, serviceCeiling, MQ9, LOADOUTS, aspectRatio } from '../physics/endurance.js';
import { el, slider, toggle, segmented, readouts, section, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import * as THREE from 'three';
import { ForceArrows, kN } from '../engine/forces.js';

export function mountUavLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { fuel: 1300, payload: 250, stores: v.state?.stores || 'strike', altitude: 7600, speed: 76, transit: 500 };
  let dirty = true;
  const set = (k) => (x) => { p[k] = x; dirty = true; };

  const sFuel = slider({ label: 'Fuel load (JP-8)', min: 300, max: MQ9.maxFuel, step: 10, value: p.fuel, unit: 'kg', onInput: set('fuel') });
  const sPay = slider({ label: 'Internal payload (sensors)', min: 0, max: MQ9.maxInternal, step: 2, value: p.payload, unit: 'kg', onInput: set('payload') });
  const sStores = segmented({
    label: 'Stores fit',
    options: Object.entries(LOADOUTS).map(([k, l]) => [k, l.label]),
    value: p.stores,
    onChange: (k) => { p.stores = k; dirty = true; v.setStores?.(k); ctx.log(v.designation, `Stores: ${LOADOUTS[k].detail} · ${fmt.n(LOADOUTS[k].mass + (LOADOUTS[k].fuel || 0))} kg`, 'info'); },
  });
  const sAlt = slider({ label: 'Loiter altitude', min: 0, max: 15240, step: 100, value: p.altitude, format: (x) => `${fmt.n(x)} m (${fmt.n(x * 3.2808)} ft)`, onInput: set('altitude') });
  const sSpd = slider({ label: 'True airspeed', min: 40, max: 140, step: 1, value: p.speed, format: (x) => `${x} m/s (${Math.round(x * 1.944)} kt)`, onInput: set('speed') });
  const sTr = slider({ label: 'Transit to the orbit (each way)', min: 0, max: 1500, step: 10, value: p.transit, unit: 'km', onInput: set('transit') });
  const tAir = toggle({ label: 'Airborne', value: false, onChange: (on) => { v.setAirborne(on); ctx.setFlightLook(on); ctx.log(v.designation, on ? 'Wheels up · climbing to the orbit on the C-band link, then handed over to the SATCOM crew' : 'Recovered by the launch-and-recovery crew', 'info'); } });
  const tLaser = toggle({ label: 'Laser designator', value: false, onChange: (on) => { v.setLaser(on); ctx.log(v.designation, on ? 'MTS-B laser on · designating' : 'Laser safe', on ? 'warn' : 'info'); } });
  v.setStores?.(p.stores);

  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.05 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); placeForces(); } });
  let last = null;
  const cg = new THREE.Vector3(...(v.cg || [0.95, 1.55, 0]));
  const hub = new THREE.Vector3(...(v.propHub || [-5.0, 1.73, 0]));
  function placeForces() {
    if (!last || !forces.group.visible) return;
    const W = (last.takeoffMass - last.totalFuel * (1 - MQ9.reserve) / 2) * 9.80665, D = W / last.lOverD;
    const k = 4.5 / W;
    const air = v.root.children[0].position;           // the airframe group: rises when airborne
    const o = cg.clone().add(air);
    forces.set('lift', { origin: o, dir: new THREE.Vector3(0, 1, 0), length: W * k, text: kN(W), name: 'Lift' });
    forces.set('weight', { origin: o, dir: new THREE.Vector3(0, -1, 0), length: W * k, text: kN(W), name: 'Weight' });
    forces.set('drag', { origin: o.clone().add(new THREE.Vector3(-0.6, 0, 0)), dir: new THREE.Vector3(-1, 0, 0), length: D * k * 4, text: `${kN(D)} (×4)`, name: 'Drag', labelOffset: new THREE.Vector3(0, 0.7, 0) });
    forces.set('thrust', { origin: hub.clone().add(new THREE.Vector3(-0.5, 0, 0)).add(air), dir: new THREE.Vector3(1, 0, 0), length: D * k * 4, text: `${kN(D)} (×4)`, name: 'Thrust', labelOffset: new THREE.Vector3(0, -0.7, 0) });
  }
  const status = el('p', { class: 'lab-status', role: 'status' });
  const ro = readouts([
    { key: 'tow', label: 'Take-off mass', unit: 'kg' }, { key: 'cl', label: 'Loiter CL' },
    { key: 'ld', label: 'Lift / drag' }, { key: 'pw', label: 'Shaft power needed', unit: 'kW' },
    { key: 'pa', label: 'Power available', unit: 'kW' }, { key: 'e', label: 'Endurance', unit: 'h' },
    { key: 'tos', label: 'Time on station', unit: 'h' }, { key: 'r', label: 'Still-air range', unit: 'km' },
    { key: 'vme', label: 'Best-endurance TAS', unit: 'm/s' }, { key: 'vs', label: 'Stall speed', unit: 'm/s' },
    { key: 'ceil', label: 'Service ceiling', unit: 'm' }, { key: 'rho', label: 'Air density', unit: 'kg/m³' },
  ]);
  const chart = new LineChart({
    title: 'Endurance versus airspeed', xLabel: 'TAS (m/s)', yLabel: 'hours', yUnit: 'h',
    series: [{ key: 'e', label: 'Endurance', color: '#3987e5' }], height: 160,
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => y.toFixed(0),
  });

  root.append(
    el('p', { class: 'lab-intro', text: `Plan a Reaper sortie. Endurance follows the Breguet equation for a propeller aircraft at constant altitude and airspeed, using the wing's drag polar at mid-mission weight and keeping a 5 % fuel reserve. Masses and limits are the published MQ-9A figures; the wing area (≈ 24 m², aspect ratio ${aspectRatio.toFixed(1)}: the area is not published), drag, propeller efficiency, the engine's power lapse with altitude and fuel burn are estimates, calibrated to reproduce the published 27 h, 15,240 m and 444 km/h.` }),
    section('Sortie', sFuel.el, sPay.el, el('div', { class: 'ctl' }, el('span', { class: 'ctl-head' }, el('span', { class: 'ctl-label', text: 'Stores fit' })), sStores.el), sAlt.el, sSpd.el, sTr.el),
    status,
    section('Performance', ro.el),
    section('Loiter speed', chart.el, el('p', { class: 'lab-note', text: 'In theory endurance peaks at the minimum-power speed, where CL is √3 times the best-range value. On a wing this long that speed sits below a safe margin over the stall, so loiter is flown at about 1.2 × stall speed: the curve starts there and ends where the engine runs out of power.' })),
    section('Aircraft', el('div', { class: 'btn-row' }, tAir.el, tLaser.el, tForces.el)),
    el('p', { class: 'lab-note', text: 'The fact-sheet range (1,850 km) describes operational missions; the still-air range here is how far the aircraft would fly at that speed until it reached its reserve.' }),
  );

  const compute = () => {
    const m = mission(p);
    last = m;
    v.state.throttle = Math.min(1, m.powerKW / MQ9.powerSL);
    if (v.state) v.state.altitude = p.altitude;
    // angle of attack from the finite-wing lift slope a = 2πAR/(AR+2)
    const slope = (2 * Math.PI * aspectRatio) / (aspectRatio + 2);
    ctx.modes.setFlow({ alphaDeg: (m.cl / slope) * (180 / Math.PI), mach: p.speed / m.atm.a, stall: m.stall ? 1 : 0, tau: 0.15 });
    const ceil = serviceCeiling(m.takeoffMass, p.stores);
    ro.set('tow', fmt.n(m.takeoffMass), m.overweight ? 'crit' : '');
    ro.set('cl', m.cl.toFixed(2), m.stall ? 'crit' : m.lowMargin ? 'warn' : '');
    ro.set('ld', m.lOverD.toFixed(1));
    ro.set('pw', fmt.n(m.powerKW), m.powerLimited ? 'crit' : '');
    ro.set('pa', fmt.n(m.powerAvailKW));
    ro.set('e', m.endurance.toFixed(1), m.stall ? 'crit' : 'ok');
    ro.set('tos', m.onStation.toFixed(1), m.onStation <= 0 ? 'crit' : m.onStation < 4 ? 'warn' : 'ok');
    ro.set('r', fmt.n(m.range));
    ro.set('vme', fmt.n(m.vMaxEndurance));
    ro.set('vs', fmt.n(m.vStall));
    ro.set('ceil', fmt.n(ceil), ceil < p.altitude ? 'crit' : '');
    ro.set('rho', m.atm.rho.toFixed(3));
    const say = (text, state) => { status.textContent = text; status.dataset.state = state; };
    if (m.overweight) say(`Over the 4,760 kg maximum take-off mass by ${fmt.n(m.takeoffMass - MQ9.mtow)} kg. Trade fuel against stores.`, 'crit');
    else if (m.stall) say('Too slow: the wing would need more lift than it can make at this weight and altitude. Increase airspeed.', 'crit');
    else if (ceil < p.altitude) say(`At ${fmt.n(m.takeoffMass)} kg the aircraft cannot climb to ${fmt.n(p.altitude)} m: its service ceiling is ${fmt.n(ceil)} m. Lighten it or loiter lower.`, 'crit');
    else if (m.powerLimited) say(`Needs ${fmt.n(m.powerKW)} kW but the TPE331 gives only ${fmt.n(m.powerAvailKW)} kW at this altitude. Slow down or descend.`, 'crit');
    else if (m.onStation <= 0) say('No time on station: the transit legs use all the fuel. Move the orbit closer or carry more fuel.', 'crit');
    else if (m.lowMargin) say(`Below 1.2 × stall speed (${fmt.n(m.vStall * 1.2)} m/s): no margin for gusts or a banked orbit. Speed up a little.`, 'warn');
    else say(`${m.onStation.toFixed(1)} h on station after ${(2 * p.transit).toLocaleString('en-US')} km of transit, carrying ${LOADOUTS[p.stores].detail}.`, 'ok');
    const sweep = enduranceSweep(p);
    chart.setData({ e: sweep.map((s) => ({ x: s.speed, y: s.endurance })) }, {
      xDomain: [40, 140], zero: true,
      cursor: { x: p.speed, label: `${m.endurance.toFixed(1)} h` },
      markers: [{ x: m.vMaxEndurance, label: 'best endurance' }],
    });
  };

  return {
    update() {
      if (dirty) { dirty = false; compute(); }
      ctx.stage.env.cloudSpeed = v.state.airborne * p.speed;
      ctx.stage.env.altitude = p.altitude;
      if (forces.group.visible) placeForces();
    },
    dispose() { forces.setVisible(false); v.setStick?.({}); },
    api: {
      setLaser(on) { tLaser.set(on); },
      setStick(s) { v.setStick?.(s); },
    },
  };
}
