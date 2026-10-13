// Orbital-transfer lab for GPS III: the launcher's transfer orbit and the satellite's own apogee
// burns to 20,180 km (Hohmann transfer with an optional plane change at apogee), the propellant
// that costs from the rocket equation, the relativistic clock correction at the target altitude,
// and an animated orbit view.

import { hohmann, propellantFor, clockRelativity, clockCrossoverAlt, GEO_ALT, C_LIGHT } from '../physics/orbital.js';
import { G0 } from '../physics/atmosphere.js';
import { GPS3 } from '../models/gps3/data.js';
import { OrbitScene } from '../engine/orbitScene.js';
import { el, slider, readouts, section, button, toggle, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';

const M0 = GPS3.launchMass, PROP = GPS3.propellant, ISP = GPS3.laeIsp, THRUST = GPS3.laeThrust;
let orbitScene = null;

export function mountOrbitLab(root, ctx) {
  const v = ctx.vehicle;
  const stage = ctx.stage;
  if (!orbitScene) orbitScene = new OrbitScene(stage);
  const os = orbitScene;
  if (os.satLabel?.element) os.satLabel.element.textContent = v.designation;
  const p = { h1: GPS3.transferPerigee, h2: GPS3.altitude, di: 0, launcherBurn1: true };
  let inOrbitView = false;
  let dirty = true;

  const sH1 = slider({ label: 'Perigee / parking orbit altitude', min: 200, max: 2000, step: 10, value: p.h1, unit: 'km', onInput: (x) => { p.h1 = x; if (p.h2 < x + 100) sH2.set(x + 100); dirty = true; } });
  const sH2 = slider({ label: 'Target orbit altitude', min: 500, max: 40000, step: 10, value: p.h2, unit: 'km', onInput: (x) => { p.h2 = Math.max(x, p.h1 + 100); dirty = true; } });
  const sDi = slider({ label: 'Plane change at apogee', min: 0, max: 60, step: 0.5, value: p.di, unit: '°', format: (x) => x.toFixed(1), onInput: (x) => { p.di = x; dirty = true; } });
  const tL = toggle({ label: 'Launcher flies burn 1', value: true, onChange: (on) => { p.launcherBurn1 = on; dirty = true; } });
  const preset = (h1, h2, di, lb) => { sH1.set(h1); sH2.set(h2); sDi.set(di); tL.set(lb); };
  const gpsBtn = button('GPS III on Falcon 9', () => preset(GPS3.transferPerigee, GPS3.altitude, 0, true));
  const leoBtn = button('GPS III alone from LEO', () => preset(GPS3.transferPerigee, GPS3.altitude, 0, false));
  const geoBtn = button('GEO comsat from Cape (28.5°)', () => preset(250, GEO_ALT, 28.5, true));

  const viewBtn = button('Open orbit view', () => setOrbitView(!inOrbitView), { kind: 'primary' });
  const flyBtn = button('Fly the transfer', () => {
    if (!inOrbitView) setOrbitView(true);
    os.requestTransfer();
    ctx.log(v.designation, `Transfer armed · burn 1 (${p.launcherBurn1 ? 'launcher upper stage' : 'apogee engine'}) at the next perigee pass`, 'info');
  });
  const tDeploy = toggle({ label: 'Solar arrays deployed', value: true, onChange: (on) => { v.setDeploy(on ? 1 : 0); ctx.log(v.designation, on ? 'Release nuts fired · panels unfolding' : 'Wings folding against the radiators for launch', 'info'); } });

  const ro = readouts([
    { key: 'v1', label: 'Parking / perigee circular speed', unit: 'km/s' }, { key: 'v2', label: 'Target orbit speed', unit: 'km/s' },
    { key: 'dv1', label: 'Burn 1 Δv (perigee)', unit: 'km/s' }, { key: 'dv2', label: 'Burn 2 Δv (apogee)', unit: 'km/s' },
    { key: 'pc', label: 'of which plane change', unit: 'km/s' }, { key: 'dv', label: 'Total Δv', unit: 'km/s' },
    { key: 'dvs', label: 'Flown by the satellite', unit: 'km/s' }, { key: 'tb', label: 'Apogee-engine firing time' },
    { key: 'tof', label: 'Perigee → apogee coast' }, { key: 'p2', label: 'Target orbit period' },
  ]);
  const meterFill = el('span', { class: 'meter-fill' });
  const meterText = el('span', { class: 'meter-text' });
  const meter = el('div', { class: 'meter', role: 'meter', 'aria-label': 'Propellant required versus propellant loaded', 'aria-valuemin': '0', 'aria-valuemax': String(PROP) },
    el('span', { class: 'meter-track' }, meterFill), meterText);
  const status = el('p', { class: 'lab-status', role: 'status' });

  const rel = readouts([
    { key: 'gr', label: 'Weaker gravity (general relativity)', unit: 'µs/day' }, { key: 'sr', label: 'Orbital speed (special relativity)', unit: 'µs/day' },
    { key: 'net', label: 'Net: satellite clock vs ground', unit: 'µs/day' }, { key: 'err', label: 'Range error if left uncorrected', unit: 'km/day' },
    { key: 'f0', label: 'Offset of the 10.23 MHz reference', unit: 'mHz' }, { key: 'frac', label: 'Fractional offset Δf/f' },
  ]);
  const met = readouts([{ key: 'met', label: 'Mission elapsed time' }, { key: 'phase', label: 'Phase' }]);
  const chart = new LineChart({
    title: 'Δv versus target altitude (this perigee and plane change)', xLabel: 'Target altitude (km)', yLabel: 'Δv (km/s)', yUnit: 'km/s',
    series: [{ key: 'dv', label: 'Total', color: '#3987e5' }, { key: 'dvs', label: 'Flown by the satellite', color: '#e8a33d' }], height: 150,
    xFormat: (x) => (x >= 1000 ? `${Math.round(x / 1000)}K` : Math.round(x).toString()), yFormat: (y) => y.toFixed(1),
  });
  const relChart = new LineChart({
    title: 'Orbiting clock rate versus a clock on the ground', xLabel: 'Circular orbit altitude (km)', yLabel: 'µs/day',
    series: [{ key: 'net', label: 'Net rate', color: '#59c1a8' }], height: 140,
    xFormat: (x) => (x >= 1000 ? `${Math.round(x / 1000)}K` : Math.round(x).toString()), yFormat: (y) => y.toFixed(0),
  });
  const relPts = [];
  for (let i = 0; i <= 160; i++) { const h = 200 + (i / 160) * 39800; relPts.push({ x: h, y: clockRelativity(h).netUs }); }
  const cross = clockCrossoverAlt();

  root.append(
    el('p', { class: 'lab-intro', text: 'GPS III is not launched straight into its final orbit. Falcon 9 leaves it in an elliptical transfer orbit already tilted to 55°, roughly 400 km by 20,200 km; the satellite\'s own liquid apogee engine then fires at apogee, over several passes, to make the orbit circular at 20,180 km. Plan that climb, see what propellant it costs, and see why the clocks have to be tuned for relativity.' }),
    section('Transfer', sH1.el, sH2.el, sDi.el, el('div', { class: 'btn-row' }, tL.el), el('div', { class: 'btn-row' }, gpsBtn, leoBtn, geoBtn)),
    section('Δv budget', ro.el, el('h4', { class: 'lab-sub', text: `Propellant at Isp ${ISP} s (estimate) from ${fmt.n(M0)} kg · ${fmt.n(PROP)} kg loaded` }), meter, status),
    section('Clocks and relativity', rel.el, relChart.el, el('p', { class: 'lab-note', text: `Below about ${fmt.n(cross, 0)} km the speed effect wins and an orbiting clock runs slow; above it the weaker gravity wins and it runs fast. At GPS altitude the clocks gain about 38.6 µs a day, so before launch they are set to tick slightly slow, at 10.22999999543 MHz instead of 10.23 MHz. The small extra effect of a slightly elliptical orbit is corrected by every receiver.` })),
    section('Orbit view', el('div', { class: 'btn-row' }, viewBtn, flyBtn), met.el),
    section('Trade study', chart.el, el('p', { class: 'lab-note', text: 'A Hohmann transfer\'s total Δv peaks and then falls for very high targets — beyond a radius ratio of about 15.6, a bi-elliptic transfer becomes cheaper. The satellite\'s share is the apogee burn alone when the launcher flies burn 1.' })),
    section('Spacecraft', el('div', { class: 'btn-row' }, tDeploy.el)),
  );

  os.on('burn1', (c) => ctx.log(v.designation, `Burn 1 complete · ${p.launcherBurn1 ? 'Falcon 9 second stage' : 'apogee engine'} · Δv ${c.dv1.toFixed(3)} km/s · coasting to apogee`, 'warn'));
  os.on('burn2', (c) => ctx.log(v.designation, `Apogee burns complete · Δv ${c.dv2.toFixed(3)} km/s · circular at ${fmt.n(c.r2 - 6378.137, 0)} km`, 'ok'));

  function setOrbitView(on) {
    inOrbitView = on;
    ctx.setOrbitMode(on);
    os.show(on);
    if (on) {
      if (os.satLabel?.element) os.satLabel.element.textContent = v.designation;
      os.attachModel(ctx.cloneForOrbit());
      os.frame();
      ctx.log(v.designation, 'Orbit view · Earth-centred inertial frame · antennas aimed at the Earth', 'info');
    }
    viewBtn.textContent = on ? 'Back to hangar' : 'Open orbit view';
  }

  const satDv = (h) => (p.launcherBurn1 ? h.dv2 : h.dvTotal);
  const compute = () => {
    const h = hohmann(p.h1, p.h2, p.di);
    ro.set('v1', h.v1.toFixed(3)); ro.set('v2', h.v2.toFixed(3));
    ro.set('dv1', h.dv1.toFixed(3)); ro.set('dv2', h.dv2.toFixed(3));
    ro.set('pc', Math.max(0, h.dvPlaneChange).toFixed(3)); ro.set('dv', h.dvTotal.toFixed(3));
    const dvs = satDv(h);
    ro.set('dvs', dvs.toFixed(3));
    ro.set('tof', fmt.hms(h.tof)); ro.set('p2', fmt.hms(h.period2));
    const prop = propellantFor(dvs, M0, ISP);
    ro.set('tb', fmt.hms((prop * ISP * G0) / THRUST));
    const frac = prop / PROP;
    meterFill.style.width = `${Math.min(100, frac * 100)}%`;
    meter.dataset.state = frac > 1 ? 'crit' : frac > 0.85 ? 'warn' : 'ok';
    meter.setAttribute('aria-valuenow', String(Math.round(prop)));
    meterText.textContent = `${fmt.n(prop)} kg of ${fmt.n(PROP)} kg`;
    if (frac > 1) {
      status.textContent = `Not feasible: needs ${fmt.n(prop - PROP)} kg more propellant than GPS III carries. That is why it rides a launcher-supplied transfer orbit instead of climbing from a low parking orbit on its own.`;
      status.dataset.state = 'crit';
    } else if (frac > 0.85) {
      status.textContent = `Feasible with ${fmt.n(PROP - prop)} kg left — the reserve for 15 years of station-keeping, wheel momentum dumps and the final move to a disposal orbit above the constellation.`;
      status.dataset.state = 'warn';
    } else {
      status.textContent = `Feasible: ${fmt.n(PROP - prop)} kg left for station-keeping and end-of-life disposal.`;
      status.dataset.state = 'ok';
    }
    const r = clockRelativity(p.h2);
    rel.set('gr', `+${r.gravUs.toFixed(1)}`); rel.set('sr', r.velUs.toFixed(1));
    rel.set('net', `${r.netUs >= 0 ? '+' : ''}${r.netUs.toFixed(1)}`, Math.abs(r.netUs) > 30 ? 'warn' : undefined);
    rel.set('err', fmt.n(Math.abs(r.netUs) * 1e-6 * C_LIGHT, 1));
    rel.set('f0', (-10.23e6 * r.net * 1e3).toFixed(2));
    rel.set('frac', `${(-r.net * 1e10).toFixed(3)} × 10⁻¹⁰`);
    relChart.setData({ net: relPts }, { xDomain: [200, 40000], zero: true, markers: [{ x: cross, label: 'crossover' }], cursor: { x: p.h2, label: `${r.netUs >= 0 ? '+' : ''}${r.netUs.toFixed(1)} µs/day` } });
    const tot = [], sat = [];
    for (let i = 0; i <= 120; i++) {
      const h2 = 500 + (i / 120) * 39500;
      if (h2 <= p.h1 + 50) continue;
      const hh = hohmann(p.h1, h2, p.di);
      tot.push({ x: h2, y: hh.dvTotal });
      sat.push({ x: h2, y: satDv(hh) });
    }
    chart.setData({ dv: tot, dvs: sat }, { xDomain: [500, 40000], zero: true, cursor: { x: p.h2, label: `${fmt.n(dvs, 2)} km/s` } });
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
