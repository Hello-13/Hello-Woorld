// Orbital-transfer lab: Hohmann transfer with a combined plane change at apogee,
// propellant from the rocket equation, and an animated orbit view.

import { hohmann, propellantFor, GEO_ALT } from '../physics/orbital.js';
import { OrbitScene } from '../engine/orbitScene.js';
import { el, slider, readouts, section, button, toggle, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';

const SAT_MASS = 4200, PROP_CAPACITY = 1800, ISP = 321;
let orbitScene = null;

export function mountOrbitLab(root, ctx) {
  const v = ctx.vehicle;
  const stage = ctx.stage;
  if (!orbitScene) orbitScene = new OrbitScene(stage);
  const os = orbitScene;
  const p = { h1: 400, h2: 3000, di: 0 };
  let inOrbitView = false;
  let dirty = true;

  const sH1 = slider({ label: 'Parking orbit altitude', min: 200, max: 2000, step: 10, value: p.h1, unit: 'km', onInput: (x) => { p.h1 = x; if (p.h2 < x + 100) sH2.set(x + 100); dirty = true; } });
  const sH2 = slider({ label: 'Target orbit altitude', min: 500, max: 40000, step: 50, value: p.h2, unit: 'km', onInput: (x) => { p.h2 = Math.max(x, p.h1 + 100); dirty = true; } });
  const sDi = slider({ label: 'Inclination change', min: 0, max: 60, step: 0.5, value: p.di, unit: '°', format: (x) => x.toFixed(1), onInput: (x) => { p.di = x; dirty = true; } });
  const geoBtn = button('GEO from Cape (28.5°)', () => { sH1.set(400); sH2.set(GEO_ALT); sDi.set(28.5); });
  const meoBtn = button('MEO at 20,200 km', () => { sH1.set(500); sH2.set(20200); sDi.set(0); });

  const viewBtn = button('Open orbit view', () => setOrbitView(!inOrbitView), { kind: 'primary' });
  const flyBtn = button('Fly the transfer', () => { if (!inOrbitView) setOrbitView(true); os.requestTransfer(); ctx.log(v.designation, 'Transfer armed · burn 1 at next perigee pass', 'info'); });
  const tDeploy = toggle({ label: 'Solar arrays deployed', value: true, onChange: (on) => { v.setDeploy(on ? 1 : 0); ctx.log(v.designation, on ? 'Array deployment: hinges releasing' : 'Arrays stowing for launch configuration', 'info'); } });

  const ro = readouts([
    { key: 'v1', label: 'Parking orbit speed', unit: 'km/s' }, { key: 'v2', label: 'Target orbit speed', unit: 'km/s' },
    { key: 'dv1', label: 'Burn 1 Δv (perigee)', unit: 'km/s' }, { key: 'dv2', label: 'Burn 2 Δv (apogee)', unit: 'km/s' },
    { key: 'pc', label: 'of which plane change', unit: 'km/s' }, { key: 'dv', label: 'Total Δv', unit: 'km/s' },
    { key: 'tof', label: 'Transfer time' }, { key: 'p2', label: 'Target orbit period' },
  ]);
  const meterFill = el('span', { class: 'meter-fill' });
  const meterText = el('span', { class: 'meter-text' });
  const meter = el('div', { class: 'meter', role: 'meter', 'aria-label': 'Propellant required versus onboard capacity', 'aria-valuemin': '0', 'aria-valuemax': String(PROP_CAPACITY) },
    el('span', { class: 'meter-track' }, meterFill), meterText);
  const status = el('p', { class: 'lab-status', role: 'status' });
  const met = readouts([{ key: 'met', label: 'Mission elapsed time' }, { key: 'phase', label: 'Phase' }]);
  const chart = new LineChart({
    title: 'Total Δv versus target altitude (this plane change)', xLabel: 'Target altitude (km)', yLabel: 'Δv (km/s)', yUnit: 'km/s',
    series: [{ key: 'dv', label: 'Total Δv', color: '#3987e5' }], height: 150,
    xFormat: (x) => (x >= 1000 ? `${Math.round(x / 1000)}K` : Math.round(x).toString()), yFormat: (y) => y.toFixed(1),
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'Plan the climb from the launcher\'s drop-off orbit. Burn 1 at perigee stretches the orbit into a transfer ellipse; burn 2 at apogee circularises and removes the inclination together, where the spacecraft is slowest and the turn is cheapest.' }),
    section('Transfer', sH1.el, sH2.el, sDi.el, el('div', { class: 'btn-row' }, geoBtn, meoBtn)),
    section('Δv budget', ro.el, el('h4', { class: 'lab-sub', text: `Propellant at Isp ${ISP} s from ${fmt.n(SAT_MASS)} kg` }), meter, status),
    section('Orbit view', el('div', { class: 'btn-row' }, viewBtn, flyBtn), met.el),
    section('Trade study', chart.el, el('p', { class: 'lab-note', text: 'A Hohmann transfer\'s Δv peaks and then falls for very high targets — beyond a radius ratio of about 15.6, a bi-elliptic transfer becomes cheaper.' })),
    section('Spacecraft', el('div', { class: 'btn-row' }, tDeploy.el)),
  );

  os.on('burn1', (c) => ctx.log(v.designation, `Burn 1 complete · Δv ${c.dv1.toFixed(3)} km/s · coasting to apogee`, 'warn'));
  os.on('burn2', (c) => ctx.log(v.designation, `Burn 2 complete · Δv ${c.dv2.toFixed(3)} km/s · circular at ${fmt.n(c.r2 - 6378.137, 0)} km`, 'ok'));

  function setOrbitView(on) {
    inOrbitView = on;
    ctx.setOrbitMode(on);
    os.show(on);
    if (on) {
      os.attachModel(ctx.cloneForOrbit());
      os.frame();
      ctx.log(v.designation, 'Orbit view · Earth-centred inertial frame', 'info');
    }
    viewBtn.textContent = on ? 'Back to hangar' : 'Open orbit view';
  }

  const compute = () => {
    const h = hohmann(p.h1, p.h2, p.di);
    ro.set('v1', h.v1.toFixed(3)); ro.set('v2', h.v2.toFixed(3));
    ro.set('dv1', h.dv1.toFixed(3)); ro.set('dv2', h.dv2.toFixed(3));
    ro.set('pc', Math.max(0, h.dvPlaneChange).toFixed(3)); ro.set('dv', h.dvTotal.toFixed(3));
    ro.set('tof', fmt.hms(h.tof)); ro.set('p2', fmt.hms(h.period2));
    const prop = propellantFor(h.dvTotal, SAT_MASS, ISP);
    const frac = prop / PROP_CAPACITY;
    meterFill.style.width = `${Math.min(100, frac * 100)}%`;
    meter.dataset.state = frac > 1 ? 'crit' : frac > 0.85 ? 'warn' : 'ok';
    meter.setAttribute('aria-valuenow', String(Math.round(prop)));
    meterText.textContent = `${fmt.n(prop)} kg of ${fmt.n(PROP_CAPACITY)} kg`;
    if (frac > 1) { status.textContent = `Not feasible: needs ${fmt.n(prop - PROP_CAPACITY)} kg more propellant than the tanks hold. That is why GEO missions start from a launcher-supplied transfer orbit. Raise the parking orbit or cut the plane change.`; status.dataset.state = 'crit'; }
    else if (frac > 0.85) { status.textContent = `Feasible with ${fmt.n(PROP_CAPACITY - prop)} kg margin — tight for seven years of station-keeping.`; status.dataset.state = 'warn'; }
    else { status.textContent = `Feasible: ${fmt.n(PROP_CAPACITY - prop)} kg left for station-keeping and end-of-life disposal.`; status.dataset.state = 'ok'; }
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const h2 = 500 + (i / 120) * 39500;
      if (h2 <= p.h1 + 50) continue;
      pts.push({ x: h2, y: hohmann(p.h1, h2, p.di).dvTotal });
    }
    chart.setData({ dv: pts }, { xDomain: [500, 40000], zero: true, cursor: { x: p.h2, label: `${fmt.n(h.dvTotal, 2)} km/s` } });
    os.configure(p.h1, p.h2, p.di);
  };

  return {
    update(dt) {
      if (dirty) { dirty = false; compute(); }
      os.update(dt);
      if (inOrbitView) {
        met.set('met', fmt.hms(os.met));
        met.set('phase', { parking: os.pending ? 'Parking · burn 1 armed' : 'Parking orbit', transfer: 'Transfer coast', final: 'On station' }[os.phase]);
      } else {
        met.set('met', '—'); met.set('phase', 'Hangar view');
      }
    },
    dispose() { if (inOrbitView) setOrbitView(false); },
  };
}
