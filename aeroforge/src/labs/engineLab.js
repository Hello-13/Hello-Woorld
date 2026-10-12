// Brayton-cycle lab: solves the two-spool separate-exhaust turbofan cycle and drives
// spool speeds, combustor glow, flow particles and thermal colours in the bay.

import { solveTurbofan, DEFAULT_CYCLE } from '../physics/turbofan.js';
import { el, slider, toggle, readouts, section, segmented, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';

const PRESETS = {
  takeoff: { altitude: 0, mach: 0, label: 'Take-off' },
  climb: { altitude: 5000, mach: 0.55, label: 'Climb' },
  cruise: { altitude: 10668, mach: 0.82, label: 'Cruise FL350' },
};

export function mountEngineLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { ...DEFAULT_CYCLE, throttle: 1 };
  let dirty = true;
  const set = (k) => (x) => { p[k] = x; dirty = true; };

  const preset = segmented({
    label: 'Flight condition', value: 'takeoff',
    options: Object.entries(PRESETS).map(([k, o]) => [k, o.label]),
    onChange: (k) => { const o = PRESETS[k]; sAlt.set(o.altitude, true); sMach.set(o.mach, true); p.altitude = o.altitude; p.mach = o.mach; dirty = true; },
  });
  const sAlt = slider({ label: 'Altitude', min: 0, max: 13000, step: 100, value: p.altitude, unit: 'm', onInput: set('altitude') });
  const sMach = slider({ label: 'Flight Mach', min: 0, max: 0.9, step: 0.01, value: p.mach, format: (x) => x.toFixed(2), onInput: set('mach') });
  const sThr = slider({ label: 'Throttle (TIT schedule)', min: 0, max: 100, step: 1, value: 100, unit: '%', onInput: (x) => { p.throttle = x / 100; dirty = true; } });
  const sFpr = slider({ label: 'Fan pressure ratio', min: 1.3, max: 1.9, step: 0.01, value: p.fpr, format: (x) => x.toFixed(2), onInput: set('fpr') });
  const sOpr = slider({ label: 'Overall pressure ratio', min: 15, max: 60, step: 1, value: p.opr, onInput: set('opr') });
  const sTit = slider({ label: 'Turbine inlet temperature', min: 1300, max: 2000, step: 10, value: p.tit, unit: 'K', onInput: set('tit') });
  const sBpr = slider({ label: 'Bypass ratio', min: 3, max: 14, step: 0.1, value: p.bpr, format: (x) => x.toFixed(1), onInput: set('bpr') });
  const tCut = toggle({ label: 'Cutaway', value: true, onChange: (on) => v.setCutaway(on) });
  const tFlow = toggle({ label: 'Flow particles', value: true, onChange: (on) => v.setFlow(on) });
  v.setFlow(true);

  const status = el('p', { class: 'lab-status', role: 'status' });
  const ro = readouts([
    { key: 'F', label: 'Net thrust', unit: 'kN' }, { key: 'tsfc', label: 'TSFC', unit: 'g/(kN·s)' },
    { key: 'spec', label: 'Specific thrust', unit: 'N·s/kg' }, { key: 'fuel', label: 'Fuel flow', unit: 'kg/s' },
    { key: 'air', label: 'Total airflow', unit: 'kg/s' }, { key: 'far', label: 'Fuel–air ratio' },
    { key: 'v9', label: 'Core jet velocity', unit: 'm/s' }, { key: 'v19', label: 'Fan jet velocity', unit: 'm/s' },
    { key: 'eth', label: 'Thermal efficiency' }, { key: 'ep', label: 'Propulsive efficiency' },
    { key: 'n1', label: 'N1 fan speed', unit: '%' }, { key: 'n2', label: 'N2 core speed', unit: '%' },
  ]);
  const table = el('table', { class: 'station-table' });
  const ts = new LineChart({
    title: 'Temperature–entropy diagram', xLabel: 's − s₀ (J/kg·K)', yLabel: 'T (K)', yUnit: 'K', mode: 'nearest',
    series: [{ key: 'core', label: 'Core stream', color: '#d95926', area: false }, { key: 'bypass', label: 'Bypass stream', color: '#3987e5', area: false }],
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => Math.round(y).toString(), height: 200,
  });

  root.append(
    el('p', { class: 'lab-intro', text: 'A real two-spool cycle analysis: compressor and turbine efficiencies, burner pressure loss, fan-to-LPT work matching and ideally expanded nozzles. Change the design and watch the engine respond.' }),
    section('Operating point', preset.el, sAlt.el, sMach.el, sThr.el),
    section('Cycle design', sFpr.el, sOpr.el, sTit.el, sBpr.el),
    status,
    section('Performance', ro.el),
    section('Cycle', ts.el),
    section('Stations', el('div', { class: 'table-wrap' }, table)),
    section('Display', el('div', { class: 'btn-row' }, tCut.el, tFlow.el)),
  );

  let lastLimited = false;
  const compute = () => {
    const r = solveTurbofan(p);
    v.setStations(r.stations);
    v.state.throttle = p.throttle;
    ro.set('F', fmt.n(r.thrust / 1000, 1));
    ro.set('tsfc', Number.isFinite(r.tsfc) ? (r.tsfc * 1e6).toFixed(2) : '—');
    ro.set('spec', fmt.n(r.specThrust, 0));
    ro.set('fuel', r.fuelFlow.toFixed(2));
    ro.set('air', fmt.n(r.m0, 0));
    ro.set('far', r.f.toFixed(4));
    ro.set('v9', fmt.n(r.V9, 0));
    ro.set('v19', fmt.n(r.V19, 0));
    ro.set('eth', fmt.pct(r.etaTh));
    ro.set('ep', p.mach > 0 ? fmt.pct(r.etaP) : 'n/a at rest');
    ro.set('n1', fmt.n(r.n1, 1));
    ro.set('n2', fmt.n(r.n2, 1));
    if (!r.valid) {
      status.textContent = 'No valid operating point: the turbines cannot supply the compressor and fan work. Raise turbine inlet temperature or lower the bypass or fan pressure ratio.';
      status.dataset.state = 'crit';
    } else if (r.fanLimited) {
      status.textContent = `Fan work-limited: the LPT can only hold a fan pressure ratio of ${r.fpr.toFixed(2)} (asked for ${r.fprRequested.toFixed(2)}).`;
      status.dataset.state = 'warn';
    } else {
      status.textContent = `Matched: ${fmt.n(r.thrust / 1000, 0)} kN at ${(r.tsfc * 1e6).toFixed(1)} g/(kN·s). Burner exit ${fmt.n(r.Tt4, 0)} K; the core nozzle runs ${fmt.n(r.byStation['9'].T, 0)} K.`;
      status.dataset.state = 'ok';
    }
    if (r.fanLimited !== lastLimited) {
      ctx.log(v.designation, r.fanLimited ? 'LPT work limit reached — fan pressure ratio rolled back' : 'Fan and LPT matched', r.fanLimited ? 'warn' : 'ok');
      lastLimited = r.fanLimited;
    }
    const S = r.byStation;
    const pt = (id) => ({ x: S[id].s, y: S[id].T, name: `Station ${id} · ${S[id].name}` });
    // heat addition 3 → 4 is (nearly) isobaric: T rises exponentially with entropy
    const burn = [];
    for (let i = 1; i < 16; i++) {
      const f = i / 16;
      const T = S['3'].T * Math.pow(S['4'].T / S['3'].T, f);
      burn.push({ x: S['3'].s + (S['4'].s - S['3'].s) * (Math.log(T / S['3'].T) / Math.log(S['4'].T / S['3'].T)), y: T, name: 'Combustor' });
    }
    ts.setData({
      core: [pt('0'), pt('2'), pt('13'), pt('3'), ...burn, pt('4'), pt('45'), pt('5'), pt('9')],
      bypass: ['2', '13', '19'].map(pt),
    }, {
      points: [
        { ...pt('3'), label: '3', series: 'core', align: 'right' },
        { ...pt('4'), label: '4', series: 'core' },
        { ...pt('45'), label: '45', series: 'core' },
        { ...pt('5'), label: '5', series: 'core' },
        { ...pt('9'), label: '9', series: 'core', dy: 10 },
        { ...pt('19'), label: '19', series: 'bypass' },
      ],
    });
    table.replaceChildren(
      el('thead', {}, el('tr', {}, ['Stn', 'Location', 'Tt (K)', 'Pt (kPa)'].map((h) => el('th', { scope: 'col', text: h })))),
      el('tbody', {}, r.stations.map((s) => el('tr', {}, el('td', { text: s.id }), el('td', { text: s.name }), el('td', { text: fmt.n(s.T, 0) }), el('td', { text: fmt.n(s.P / 1000, 1) })))),
    );
    ctx.refreshThermal();
  };

  return {
    update() { if (dirty) { dirty = false; compute(); } },
    dispose() {},
  };
}
