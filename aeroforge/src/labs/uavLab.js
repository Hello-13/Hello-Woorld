// Mission-endurance lab: Breguet endurance and range for a propeller aircraft, with
// time-on-station after transit and the classic best-endurance vs best-range speeds.

import { mission, enduranceSweep, KESTREL } from '../physics/endurance.js';
import { el, slider, toggle, readouts, section, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import * as THREE from 'three';
import { ForceArrows, kN } from '../engine/forces.js';

export function mountUavLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { fuel: 1300, payload: 450, altitude: 7600, speed: 75, transit: 500 };
  let dirty = true;
  const set = (k) => (x) => { p[k] = x; dirty = true; };

  const sFuel = slider({ label: 'Fuel load', min: 300, max: KESTREL.maxFuel, step: 10, value: p.fuel, unit: 'kg', onInput: set('fuel') });
  const sPay = slider({ label: 'Payload (sensors + stores)', min: 0, max: KESTREL.maxPayload, step: 10, value: p.payload, unit: 'kg', onInput: set('payload') });
  const sAlt = slider({ label: 'Loiter altitude', min: 0, max: 15000, step: 100, value: p.altitude, unit: 'm', onInput: set('altitude') });
  const sSpd = slider({ label: 'True airspeed', min: 40, max: 140, step: 1, value: p.speed, unit: 'm/s', format: (x) => `${x} (${Math.round(x * 1.944)} kt)`, onInput: set('speed') });
  const sTr = slider({ label: 'Transit to station (each way)', min: 0, max: 1500, step: 10, value: p.transit, unit: 'km', onInput: set('transit') });
  const tAir = toggle({ label: 'Airborne', value: false, onChange: (on) => { v.setAirborne(on); ctx.setFlightLook(on); ctx.log(v.designation, on ? 'Wheels up · climbing to loiter altitude' : 'Recovered to the hangar', 'info'); } });
  const tLaser = toggle({ label: 'Laser designator', value: false, onChange: (on) => { v.setLaser(on); ctx.log(v.designation, on ? 'Laser armed · designating' : 'Laser safe', on ? 'warn' : 'info'); } });

  const forces = v.forces || (v.forces = new ForceArrows(v.root, { radius: 0.05 }));
  const tForces = toggle({ label: 'Force vectors', value: false, onChange: (on) => { forces.setVisible(on); ctx.muteCallouts?.(on); placeForces(); } });
  let last = null;
  function placeForces() {
    if (!last || !forces.group.visible) return;
    const W = (last.takeoffMass - p.fuel * 0.47) * 9.80665, D = W / last.lOverD;
    const k = 4.5 / W;
    const o = new THREE.Vector3(0.2, 0.25, 0).add(v.root.children[0].position);
    forces.set('lift', { origin: o, dir: new THREE.Vector3(0, 1, 0), length: W * k, text: kN(W), name: 'Lift' });
    forces.set('weight', { origin: o, dir: new THREE.Vector3(0, -1, 0), length: W * k, text: kN(W), name: 'Weight' });
    forces.set('drag', { origin: o.clone().add(new THREE.Vector3(-0.6, 0, 0)), dir: new THREE.Vector3(-1, 0, 0), length: D * k * 4, text: `${kN(D)} (×4)`, name: 'Drag', labelOffset: new THREE.Vector3(0, 0.7, 0) });
    forces.set('thrust', { origin: new THREE.Vector3(-6.1, 0.05, 0).add(v.root.children[0].position), dir: new THREE.Vector3(1, 0, 0), length: D * k * 4, text: `${kN(D)} (×4)`, name: 'Thrust', labelOffset: new THREE.Vector3(0, -0.7, 0) });
  }
  const status = el('p', { class: 'lab-status', role: 'status' });
  const ro = readouts([
    { key: 'tow', label: 'Take-off mass', unit: 'kg' }, { key: 'cl', label: 'Loiter CL' },
    { key: 'ld', label: 'Lift / drag' }, { key: 'pw', label: 'Shaft power needed', unit: 'kW' },
    { key: 'e', label: 'Endurance', unit: 'h' }, { key: 'r', label: 'Still-air range', unit: 'km' },
    { key: 'tos', label: 'Time on station', unit: 'h' }, { key: 'vme', label: 'Best-endurance speed', unit: 'm/s' },
    { key: 'vmr', label: 'Best-range speed', unit: 'm/s' }, { key: 'rho', label: 'Air density', unit: 'kg/m³' },
  ]);
  const chart = new LineChart({
    title: 'Endurance versus airspeed', xLabel: 'TAS (m/s)', yLabel: 'hours', yUnit: 'h',
    series: [{ key: 'e', label: 'Endurance', color: '#3987e5' }], height: 160,
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => y.toFixed(0),
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'Size a surveillance sortie. Endurance follows the Breguet equation for a propeller aircraft at constant altitude and airspeed, using the wing\'s drag polar at mid-mission weight and keeping a 5 % fuel reserve.' }),
    section('Sortie', sFuel.el, sPay.el, sAlt.el, sSpd.el, sTr.el),
    status,
    section('Performance', ro.el),
    section('Loiter speed', chart.el, el('p', { class: 'lab-note', text: 'Endurance peaks at the minimum-power speed, where CL is √3 times the best-range value. Fly slower than that and induced drag wins; faster and parasite drag does.' })),
    section('Aircraft', el('div', { class: 'btn-row' }, tAir.el, tLaser.el, tForces.el)),
  );

  const compute = () => {
    const m = mission(p);
    last = m;
    v.state.throttle = Math.min(1, m.powerKW / 670);
    // angle of attack from the finite-wing lift slope a = 2πAR/(AR+2)
    const ar = 16.8, slope = (2 * Math.PI * ar) / (ar + 2);
    ctx.modes.setFlow({ alphaDeg: (m.cl / slope) * (180 / Math.PI), mach: p.speed / m.atm.a, stall: m.stall ? 1 : 0, tau: 0.15 });
    ro.set('tow', fmt.n(m.takeoffMass), m.overweight ? 'crit' : '');
    ro.set('cl', m.cl.toFixed(2), m.stall ? 'crit' : m.cl > 1.2 ? 'warn' : '');
    ro.set('ld', m.lOverD.toFixed(1));
    ro.set('pw', fmt.n(m.powerKW), m.powerKW > 670 ? 'crit' : '');
    ro.set('e', m.endurance.toFixed(1), 'ok');
    ro.set('r', fmt.n(m.range));
    ro.set('tos', m.onStation.toFixed(1), m.onStation <= 0 ? 'crit' : m.onStation < 4 ? 'warn' : 'ok');
    ro.set('vme', fmt.n(m.vMaxEndurance));
    ro.set('vmr', fmt.n(m.vMaxRange));
    ro.set('rho', m.atm.rho.toFixed(3));
    if (m.overweight) { status.textContent = `Over maximum take-off mass by ${fmt.n(m.takeoffMass - KESTREL.mtow)} kg. Trade fuel for payload.`; status.dataset.state = 'crit'; }
    else if (m.stall) { status.textContent = 'Too slow: the wing would need more lift than it can make at this weight and altitude. Increase airspeed.'; status.dataset.state = 'crit'; }
    else if (m.powerKW > 670) { status.textContent = `Needs ${fmt.n(m.powerKW)} kW, more than the 670 kW engine provides. Slow down or descend.`; status.dataset.state = 'crit'; }
    else if (m.onStation <= 0) { status.textContent = 'No time on station: the transit legs use all the fuel. Move the orbit closer or carry more fuel.'; status.dataset.state = 'crit'; }
    else { status.textContent = `${m.onStation.toFixed(1)} h on station after ${(2 * p.transit).toLocaleString('en-US')} km of transit.`; status.dataset.state = 'ok'; }
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
      if (forces.group.visible) placeForces();
    },
    dispose() { forces.setVisible(false); },
    api: { setLaser(on) { tLaser.set(on); } },
  };
}
