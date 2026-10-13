// Brayton-cycle lab for the GE90-115B: solves the two-spool, separate-exhaust turbofan cycle
// (fan, 4-stage booster, 9-stage HPC, 2-stage HPT, 6-stage LPT) and drives the spool speeds,
// combustor glow, flow particles, station planes and thermal colours in the bay.

import { solveTurbofan, DEFAULT_CYCLE, GE90, OPERATING_POINTS } from '../physics/turbofan.js';
import { el, slider, toggle, readouts, section, segmented, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';
import * as THREE from 'three';
import { solidBounds } from '../engine/stage.js';

// 777-300ER operating points (take-off, max climb, cruise): see OPERATING_POINTS in the cycle module
const PRESETS = OPERATING_POINTS;

export function mountEngineLab(root, ctx) {
  const v = ctx.vehicle;
  const p = { ...DEFAULT_CYCLE, throttle: 1 };
  let dirty = true;
  const set = (k) => (x) => { p[k] = x; dirty = true; };

  const preset = segmented({
    label: 'Flight condition', value: 'takeoff',
    options: Object.entries(PRESETS).map(([k, o]) => [k, o.label]),
    onChange: (k) => { const o = PRESETS[k]; sAlt.set(o.altitude, true); sMach.set(o.mach, true); sThr.set(o.throttle * 100, true); p.altitude = o.altitude; p.mach = o.mach; p.throttle = o.throttle; dirty = true; },
  });
  const sAlt = slider({ label: 'Altitude', min: 0, max: 13000, step: 100, value: p.altitude, unit: 'm', onInput: set('altitude') });
  const sMach = slider({ label: 'Flight Mach', min: 0, max: 0.9, step: 0.01, value: p.mach, format: (x) => x.toFixed(2), onInput: set('mach') });
  const sThr = slider({ label: 'Thrust lever (0 = ground idle, 100 = take-off N1)', min: 0, max: 100, step: 1, value: 100, unit: '%', onInput: (x) => { p.throttle = x / 100; dirty = true; } });
  const sFpr = slider({ label: 'Fan pressure ratio', min: 1.3, max: 1.9, step: 0.01, value: p.fpr, format: (x) => x.toFixed(2), onInput: set('fpr') });
  const sLpc = slider({ label: 'Booster pressure ratio (fan hub + 4 stages)', min: 1.5, max: 3.5, step: 0.05, value: p.lpcpr, format: (x) => x.toFixed(2), onInput: set('lpcpr') });
  const sOpr = slider({ label: 'Overall pressure ratio', min: 15, max: 60, step: 1, value: p.opr, onInput: set('opr') });
  const sTit = slider({ label: 'Turbine inlet temperature', min: 1300, max: 2000, step: 10, value: p.tit, unit: 'K', onInput: set('tit') });
  const sBpr = slider({ label: 'Bypass ratio', min: 3, max: 14, step: 0.1, value: p.bpr, format: (x) => x.toFixed(1), onInput: set('bpr') });
  const tCut = toggle({ label: 'Cutaway', value: true, onChange: (on) => v.setCutaway(on) });
  // flow particles start off: they would speckle every view; the last tour step turns them on
  const tFlow = toggle({ label: 'Flow particles', value: false, onChange: (on) => v.setFlow(on) });
  const tRev = toggle({ label: 'Thrust reverser', value: false, onChange: (on) => { v.setReverser?.(on); ctx.log(v.designation, on ? 'Reverser deployed · sleeves aft, blocker doors in the bypass duct' : 'Reverser stowed and locked', on ? 'warn' : 'info'); } });
  const showStations = (on) => { v.setStationPlanes(on); ctx.muteCallouts?.(on); };
  const tStations = toggle({ label: 'Station planes', value: false, onChange: (on) => { showStations(on); if (on) sideView(); } });
  // the classic station diagram: a side elevation framed round the engine and the label rows above
  // it, in the part of the frame the open panels leave free (the stage's frameTan)
  function sideView() {
    const { stage } = ctx;
    ctx.setAutoRotate(false);
    v.root.updateMatrixWorld(true);
    const box = solidBounds(v.root);
    if (v.stationBounds) box.union(v.stationBounds());
    const dir = new THREE.Vector3(0.18, 0.2, 1).normalize();
    const target = box.getCenter(new THREE.Vector3());
    const { tanV, tanH } = stage.frameTan();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    let need = 0;
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
      const z = c.dot(dir);
      need = Math.max(need, z + Math.abs(c.dot(right)) / tanH, z + Math.abs(c.dot(up)) / tanV);
    }
    stage.flyTo(target.clone().addScaledVector(dir, need * 1.06), target, 1.2);
  }
  v.setFlow(false);

  const status = el('p', { class: 'lab-status', role: 'status' });
  const ro = readouts([
    { key: 'F', label: 'Net thrust', unit: 'kN' }, { key: 'tsfc', label: 'TSFC', unit: 'g/(kN·s)' },
    { key: 'spec', label: 'Specific thrust', unit: 'N·s/kg' }, { key: 'fuel', label: 'Fuel flow', unit: 'kg/s' },
    { key: 'air', label: 'Total airflow', unit: 'kg/s' }, { key: 'far', label: 'Fuel–air ratio' },
    { key: 'v9', label: 'Core jet velocity', unit: 'm/s' }, { key: 'v19', label: 'Fan jet velocity', unit: 'm/s' },
    { key: 'eth', label: 'Thermal efficiency' }, { key: 'ep', label: 'Propulsive efficiency' },
    { key: 'n1', label: 'N1 fan speed', unit: '%' }, { key: 'n2', label: 'N2 core speed', unit: '%' },
    { key: 'rpm', label: 'N1 / N2', unit: 'rpm' }, { key: 'egt', label: 'EGT (T49)', unit: '°C' },
  ]);
  const table = el('table', { class: 'station-table' });
  const ts = new LineChart({
    title: 'Temperature–entropy diagram', xLabel: 's − s₀ (J/kg·K)', yLabel: 'T (K)', yUnit: 'K', mode: 'nearest',
    series: [{ key: 'core', label: 'Core stream', color: '#d95926', area: false }, { key: 'bypass', label: 'Bypass stream', color: '#3987e5', area: false }],
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => Math.round(y).toString(), height: 200,
  });

  root.append(
    el('p', { class: 'lab-intro', text: `The GE90-115B cycle, solved station by station: fan, 4-stage booster and 9-stage HP compressor, a burner pressure loss, the 2-stage HP turbine driving the compressor and the 6-stage LP turbine driving fan and booster, then two ideally expanded nozzles. The cycle-design sliders set the engine at its design point, sea-level static take-off: overall pressure ratio 42 and bypass ratio 7.1, tuned to the certified 514 kN (115,540 lbf, EASA type certificate) and to the 4.59 kg/s take-off fuel flow in the ICAO engine emissions databank; fan, booster and turbine-inlet values are not published and are modelled. Every other condition is off-design: the thrust lever sets an N1 demand, as the FADEC does, and the spools settle where both turbines balance their compressors. In the cruise preset each engine gives about 80 kN, roughly what a 777-300ER needs early in its cruise, at about 15 g/(kN·s) (0.53 lb/lbf/h); GE does not publish the -115B's cruise figure, and 0.52–0.545 lb/lbf/h is quoted for the earlier GE90s. At the databank's 85 % and 7 % thrust points the model's fuel flow is within 5 %, at 30 % about 15 % high.` }),
    section('Operating point', preset.el, sAlt.el, sMach.el, sThr.el),
    section('Cycle design', sFpr.el, sLpc.el, sOpr.el, sTit.el, sBpr.el),
    status,
    section('Performance', ro.el, el('p', { class: 'lab-intro', text: '100 % N1 and N2 are the type certificate\'s reference speeds (2,355 and 9,332 rpm), not limits: the take-off and continuous limits are 110.5 % N1 and 121 % N2.' })),
    section('Cycle', ts.el),
    section('Stations', el('div', { class: 'table-wrap' }, table)),
    section('Display', el('div', { class: 'btn-row' }, tCut.el, tFlow.el, tStations.el, tRev.el)),
  );

  let lastLimited = false;
  const compute = () => {
    const r = solveTurbofan(p);
    v.setStations(r.stations);
    v.state.throttle = p.throttle;
    v.state.n1 = r.n1;
    v.state.n2 = r.n2;
    v.state.fromLab = true;
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
    ro.set('rpm', `${fmt.n(r.n1Rpm, 0)} / ${fmt.n(r.n2Rpm, 0)}`);
    const egtC = r.egt - 273.15;
    ro.set('egt', fmt.n(egtC, 0), r.valid && r.egtMargin < 0 ? 'crit' : r.valid && r.egtMargin < 40 ? 'warn' : '');
    if (!r.valid) {
      status.textContent = 'No valid operating point: the turbines cannot supply the compressor and fan work. Raise turbine inlet temperature or lower the bypass or fan pressure ratio.';
      status.dataset.state = 'crit';
    } else if (r.fanLimited) {
      status.textContent = `Fan work-limited at the design point: the LPT can only drive a fan pressure ratio of ${r.fprDesign.toFixed(2)} (the design asks for ${r.fprRequested.toFixed(2)}). Raise turbine inlet temperature or lower the bypass ratio.`;
      status.dataset.state = 'warn';
    } else {
      const lbf = r.thrust / 4.44822;
      const margin = r.egtMargin;
      const held = r.speedLimited ? ` Corrected fan speed is at its limit, so N1 is held at ${fmt.n(r.n1, 1)} %.` : '';
      status.textContent = `Matched: ${fmt.n(r.thrust / 1000, 0)} kN (${fmt.n(lbf / 1000, 1)}k lbf) at ${(r.tsfc * 1e6).toFixed(1)} g/(kN·s) (${(r.tsfc * 1e6 * 0.0353).toFixed(3)} lb/lbf/h). Burner exit ${fmt.n(r.Tt4, 0)} K; EGT ${fmt.n(r.egt - 273.15, 0)} °C, ${margin >= 0 ? `${fmt.n(margin, 0)} °C inside` : `${fmt.n(-margin, 0)} °C over`} the ${fmt.n(GE90.egtLimitK - 273.15, 0)} °C take-off limit (${fmt.n(GE90.egtMaxContK - 273.15, 0)} °C continuous).${held}`;
      status.dataset.state = margin < 0 ? 'warn' : 'ok';
    }
    if (r.fanLimited !== lastLimited) {
      ctx.log(v.designation, r.fanLimited ? 'Cycle design: the LPT cannot drive the fan asked for — design fan pressure ratio rolled back' : 'Cycle design: fan and LPT matched', r.fanLimited ? 'warn' : 'ok');
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
      // the core stream goes through the fan hub and booster (2 → 25), not the fan tip (13)
      core: [pt('0'), pt('2'), pt('25'), pt('3'), ...burn, pt('4'), pt('45'), pt('5'), pt('9')],
      bypass: ['2', '13', '19'].map(pt),
    }, {
      points: [
        { ...pt('25'), label: '25', series: 'core', align: 'right' },
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

  let flowBefore = null;
  return {
    update() { if (dirty) { dirty = false; compute(); } },
    dispose() { v.setStationPlanes(false); v.setReverser?.(false); v.state.fromLab = false; },
    api: {
      setDisplay({ flow, stations, cutaway } = {}) {
        // the tour's flow demo turns particles on with the station planes; give back the user's
        // own particle setting when it turns the planes off again
        if (flow != null && stations) flowBefore = tFlow.get();
        if (flow != null) tFlow.set(flow);
        else if (stations === false && flowBefore != null) { tFlow.set(flowBefore); flowBefore = null; }
        if (stations != null) { tStations.set(stations, true); showStations(stations); }
        if (cutaway != null) tCut.set(cutaway);
      },
    },
  };
}
