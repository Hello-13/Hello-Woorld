// Optics & orbit lab for the Hubble Space Telescope: the diffraction limit across the ultraviolet
// to the near infrared against ground seeing, light-gathering power from the eye to the ELT,
// the Ritchey–Chrétien design and the 1990 mirror flaw, what Hubble can resolve at a distance,
// and the orbit it flies, with an illustrative drag-decay projection.

import {
  rayleighArcsec, seeingAt, collectingArea, magnitudeGain, plateScale, airyDiskDiameter, linearResolution,
  diffractionLimit, toArcsec, hubbleDesign, conicError, orbitAt, decayRate, decayHistory, HST_OTA,
} from '../physics/optics.js';
import { el, slider, readouts, section, segmented, toggle, fmt } from '../ui/dom.js';
import { LineChart } from '../ui/chart.js';

const LY = 9.4607e15, AU = 1.495979e11;

// apertures for the light-gathering comparison: [label, diameter m, collecting area m² (null → from D)]
const APERTURES = [
  ['Dark-adapted eye', 0.007, null],
  ['10 × 50 binoculars', 0.05, null],
  ['20 cm amateur telescope', 0.2, null],
  ['Hubble, 2.4 m', 2.4, collectingArea(2.4, HST_OTA.obscuration)],
  ['Hooker telescope (1917), 2.54 m', 2.54, null],
  ['JWST, 6.5 m segmented', 6.5, 25.4],
  ['Keck, 10 m segmented', 10, 76],
  ['ELT, 39 m (under construction)', 39, 978],
];

// what to resolve: distance (m), apparent size (″), note
const TARGETS = {
  moon: { label: 'Moon', d: 384400e3, size: 31 * 60, what: 'the Moon at its mean distance' },
  mars: { label: 'Mars', d: 55.76e9, size: 25.1, what: 'Mars at its closest approach in August 2003' },
  jupiter: { label: 'Jupiter', d: 4.0 * AU, size: 47, what: 'Jupiter at a typical opposition (4.0 AU)' },
  pluto: { label: 'Pluto', d: 34 * AU, size: 0.1, what: 'Pluto, about 34 AU away in the 2020s' },
  orion: { label: 'Orion Nebula', d: 1344 * LY, size: 65 * 60, what: 'the Orion Nebula, 1,344 light-years away' },
  m31: { label: 'Andromeda', d: 2.54e6 * LY, size: 3.2 * 3600, what: 'the Andromeda Galaxy, 2.5 million light-years away' },
};

const INSTRUMENTS = [
  ['COS', 115, 320], ['STIS', 115, 1030], ['ACS', 115, 1100], ['WFC3', 200, 1700], ['NICMOS (dormant)', 800, 2500],
];

const band = (nm) => (nm < 200 ? 'far ultraviolet' : nm < 400 ? 'near ultraviolet' : nm < 700 ? 'visible' : 'near infrared');

/** Length with a sensible unit: m, km, AU or light-years. */
function length(m) {
  if (m < 1000) return `${fmt.n(m, m < 10 ? 1 : 0)} m`;
  if (m < 1e10) return `${fmt.n(m / 1000, m < 1e4 ? 1 : 0)} km`;
  if (m < 0.05 * LY) return `${fmt.n(m / AU, m < 10 * AU ? 2 : 0)} AU`;
  return `${fmt.n(m / LY, m < 10 * LY ? 2 : 1)} ly`;
}
const arcsec = (as) => (as >= 60 ? `${fmt.n(as / 60, 1)}′` : as >= 1 ? `${fmt.n(as, 2)}″` : `${fmt.n(as, as < 0.01 ? 4 : 3)}″`);

export function mountHubbleLab(root, ctx) {
  const v = ctx.vehicle;
  const design = hubbleDesign();
  const p = { nm: 500, seeing: 0.8, logD: Math.log10(2.4), K: HST_OTA.K1asBuilt, target: 'mars', h: 500, activity: 1 };
  let dirty = true;
  const mark = () => { dirty = true; };

  // ------------------------------------------------------------------ diffraction vs seeing
  const sNm = slider({ label: 'Wavelength', min: 115, max: 2500, step: 5, value: p.nm, unit: 'nm', format: (x) => fmt.n(x), onInput: (x) => { p.nm = x; mark(); } });
  const sSee = slider({ label: 'Ground seeing at 500 nm', min: 0.3, max: 2, step: 0.05, value: p.seeing, unit: '″', format: (x) => x.toFixed(2), onInput: (x) => { p.seeing = x; mark(); } });
  const roD = readouts([
    { key: 'band', label: 'Band' }, { key: 'hst', label: 'Hubble diffraction limit', unit: '″' },
    { key: 'seeing', label: 'Ground seeing at this λ', unit: '″' }, { key: 'gain', label: 'Hubble sharper by' },
    { key: 'jwst', label: 'JWST (6.5 m) limit', unit: '″' }, { key: 'airy', label: 'Airy disk at Hubble\'s focus', unit: 'µm' },
  ]);
  const instr = el('p', { class: 'lab-note' });
  const atm = el('p', { class: 'lab-status', role: 'status' });
  const chartD = new LineChart({
    title: 'Resolution versus wavelength', xLabel: 'Wavelength (nm)', yLabel: '″', yUnit: '″', height: 160,
    series: [{ key: 'hst', label: 'Hubble 2.4 m', color: '#3987e5' }, { key: 'jwst', label: 'JWST 6.5 m', color: '#c084fc' }, { key: 'see', label: 'Ground seeing', color: '#f59e0b' }],
    xFormat: (x) => fmt.n(x), yFormat: (y) => y.toFixed(2),
  });

  // ------------------------------------------------------------------ light grasp
  const sAp = slider({ label: 'Aperture diameter', min: Math.log10(0.007), max: Math.log10(40), step: 0.005, value: p.logD, unit: 'm', format: (x) => { const d = 10 ** x; return d < 1 ? d.toFixed(d < 0.1 ? 3 : 2) : d.toFixed(1); }, onInput: (x) => { p.logD = x; mark(); } });
  const roA = readouts([
    { key: 'area', label: 'Collecting area', unit: 'm²' }, { key: 'eye', label: 'Light gathered vs the eye' },
    { key: 'mag', label: 'Fainter stars than the eye by', unit: 'mag' }, { key: 'theta', label: 'Diffraction limit at λ', unit: '″' },
    { key: 'limit', label: 'From the ground it is' },
  ]);
  const bars = el('div', { class: 'meter-list', style: 'display:grid;gap:10px' });
  const eyeArea = collectingArea(0.007);
  const maxLog = Math.log10(978 / eyeArea);
  for (const [label, D, A] of APERTURES) {
    const area = A ?? collectingArea(D);
    const ratio = area / eyeArea;
    const fill = el('span', { class: 'meter-fill', style: `width:${Math.max(2, (Math.log10(ratio) / maxLog) * 100).toFixed(1)}%` });
    const m = el('div', { class: 'meter', role: 'meter', 'aria-label': `${label}: ${fmt.n(area, area < 1 ? 5 : 1)} m²`, 'data-state': label.startsWith('Hubble') ? 'ok' : '' },
      el('span', { class: 'meter-text', text: `${label} · ${area < 0.01 ? area.toExponential(1) : fmt.n(area, area < 10 ? 2 : 0)} m² · ×${fmt.n(ratio, 0)}` }), el('span', { class: 'meter-track' }, fill));
    if (label.startsWith('Hubble')) fill.style.background = 'var(--go, #3ecf8e)';
    bars.append(m);
  }

  // ------------------------------------------------------------------ design and the flaw
  const sK = slider({ label: 'Primary conic constant as polished', min: -1.02, max: -1.0, step: 0.0001, value: p.K, format: (x) => x.toFixed(4), onInput: (x) => { p.K = x; mark(); } });
  const roR = readouts([
    { key: 'm', label: 'Secondary magnification' }, { key: 'b', label: 'Focus behind primary', unit: 'm' },
    { key: 'k1', label: 'Design primary conic K₁' }, { key: 'k2', label: 'Design secondary conic K₂' },
    { key: 'ps', label: 'Plate scale', unit: '″/mm' }, { key: 'fov', label: '1′ at the focal plane', unit: 'mm' },
    { key: 'edge', label: 'Mirror edge error', unit: 'µm' }, { key: 'wf', label: 'Wavefront error at the edge', unit: 'waves' },
  ]);
  const flawStatus = el('p', { class: 'lab-status', role: 'status' });

  // ------------------------------------------------------------------ resolve at a distance
  const tgt = segmented({ label: 'Target', value: p.target, options: Object.entries(TARGETS).map(([k, t]) => [k, t.label]), onChange: (x) => { p.target = x; mark(); } });
  const roT = readouts([
    { key: 'dist', label: 'Distance' }, { key: 'feat', label: 'Smallest feature Hubble resolves' },
    { key: 'ground', label: 'Through 0.8″ ground seeing' }, { key: 'across', label: 'Resolution elements across it' },
  ]);
  const tgtNote = el('p', { class: 'lab-note' });

  // ------------------------------------------------------------------ orbit
  const sH = slider({ label: 'Altitude', min: 350, max: 650, step: 5, value: p.h, unit: 'km', onInput: (x) => { p.h = x; mark(); } });
  const act = segmented({ label: 'Solar activity', value: '1', options: [['0.35', 'Solar minimum'], ['1', 'Average'], ['2.5', 'Solar maximum']], onChange: (x) => { p.activity = +x; mark(); } });
  const roO = readouts([
    { key: 'v', label: 'Orbital speed', unit: 'km/s' }, { key: 'T', label: 'Period', unit: 'min' },
    { key: 'n', label: 'Orbits per day' }, { key: 'ecl', label: 'Longest Earth shadow', unit: 'min' },
    { key: 'rate', label: 'Drag decay at this altitude', unit: 'km/yr' }, { key: 're', label: 'Reaches 200 km (model)' },
  ]);
  const chartO = new LineChart({
    title: 'Altitude projection without a reboost (illustrative drag model)', xLabel: 'Year', yLabel: 'km', yUnit: 'km', height: 150,
    series: [{ key: 'min', label: 'Solar minimum', color: '#3ecf8e' }, { key: 'avg', label: 'Average', color: '#3987e5' }, { key: 'max', label: 'Solar maximum', color: '#ff5c52' }],
    xFormat: (x) => Math.round(x).toString(), yFormat: (y) => Math.round(y).toString(),
  });

  // ------------------------------------------------------------------ telescope controls
  const tDoor = toggle({ label: 'Aperture door open', value: v.state.doorTarget > 0.5, onChange: (on) => { v.setAperture(on); ctx.log(v.designation, on ? 'Aperture door opening' : 'Aperture door closing · optics protected', 'info'); } });
  const tDep = toggle({ label: 'Arrays & antennas deployed', value: v.state.deployTarget > 0.5, onChange: (on) => { v.animateDeploy(on ? 1 : 0); ctx.log(v.designation, on ? 'Deploying solar arrays and high-gain antenna masts' : 'Stowing appendages for launch configuration', 'info'); } });
  const tRay = toggle({ label: 'Light path in Studio', value: v.state.lightPath, onChange: (on) => { v.setLightPath(on); } });

  root.append(
    el('p', { class: 'lab-intro', text: 'Hubble\'s advantage is not size — the 1917 Hooker telescope is about as large — but altitude. Above the turbulent air its 2.4 m mirror works at the diffraction limit and sees the ultraviolet the atmosphere absorbs. Explore that limit, the light grasp of different mirrors, the two-mirror design and its 1990 flaw, and the orbit Hubble flies.' }),
    section('Diffraction limit versus seeing', sNm.el, sSee.el, roD.el, atm, instr, chartD.el,
      el('p', { class: 'lab-note', text: 'θ = 1.22 λ / D is the angle to the first dark ring of a star\'s Airy pattern (Rayleigh criterion). Turbulence blurs ground telescopes to roughly 0.5–1″ whatever their size, unless adaptive optics corrects it, which works best in the infrared.' })),
    section('Light-gathering power', sAp.el, roA.el, bars,
      el('p', { class: 'lab-note', text: 'Collecting area grows as D². Hubble\'s secondary mirror and baffle block the central 33 % of its diameter, 11 % of its area. Each factor of 2.5 in light is one magnitude fainter.' })),
    section('Ritchey–Chrétien design and the 1990 flaw', roR.el, sK.el, flawStatus,
      el('p', { class: 'lab-note', text: 'Two hyperbolic mirrors cancel both spherical aberration and coma. The primary was polished to the wrong conic because a lens in the reflective null corrector used to test it sat 1.3 mm out of place. COSTAR\'s corrective mirrors (1993) and WFPC2\'s built-in correction fixed the images; every later instrument carries the correction inside, so COSTAR was removed in 2009.' })),
    section('What can Hubble resolve?', tgt.el, roT.el, tgtNote),
    section('Orbit and decay', sH.el, act.el, roO.el, chartO.el,
      el('p', { class: 'lab-note', text: 'Deployed in April 1990 at about 612 km; servicing missions boosted it until 2002. It was near 540 km after the last visit in 2009 and below 500 km by 2026, sinking faster around solar maximum when the upper atmosphere swells. The drag model uses an exponential thermosphere and an estimated 45 m² mean cross-section; it is a teaching sketch, not a re-entry forecast.' })),
    section('Telescope', el('div', { class: 'btn-row' }, tDoor.el, tDep.el, tRay.el),
      el('p', { class: 'lab-note', text: 'X-ray, Systems and Blueprint always trace the light path while the door is open: entrance rays to the primary, the converging cone to the secondary, then the f/24 beam through the hole in the primary to the focus 1.5 m behind it.' })),
  );

  function compute() {
    const lam = p.nm;
    // ---------------- diffraction
    const th = rayleighArcsec(lam, 2.4), see = seeingAt(lam, p.seeing), thJ = rayleighArcsec(lam, 6.5);
    roD.set('band', band(lam));
    roD.set('hst', th.toFixed(3));
    roD.set('seeing', see.toFixed(2));
    roD.set('gain', `${fmt.n(see / th, 0)} ×`, see / th > 1 ? 'ok' : 'warn');
    roD.set('jwst', lam >= 600 ? thJ.toFixed(3) : `${thJ.toFixed(3)} (JWST starts at 600 nm)`);
    roD.set('airy', fmt.n(airyDiskDiameter(lam * 1e-9, design.N) * 1e6, 1));
    const cover = INSTRUMENTS.filter(([, a, b]) => lam >= a && lam <= b).map(([n]) => n);
    instr.textContent = cover.length ? `Instruments covering ${fmt.n(lam)} nm: ${cover.join(', ')}.` : 'No current Hubble instrument covers this wavelength.';
    if (lam < 300) { atm.textContent = 'Absorbed by ozone and oxygen high in the atmosphere: no ground telescope can see this light at all.'; atm.dataset.state = 'crit'; }
    else if ((lam > 1340 && lam < 1450) || (lam > 1800 && lam < 1950)) { atm.textContent = 'Inside a water-vapour absorption band: largely blocked from the ground, clear for Hubble.'; atm.dataset.state = 'warn'; }
    else { atm.textContent = `The atmosphere transmits ${band(lam)} light here, but blurs it to ≈${see.toFixed(2)}″ — ${fmt.n(see / th, 0)} times Hubble's limit.`; atm.dataset.state = 'ok'; }
    const hp = [], jp = [], sp = [];
    for (let i = 0; i <= 120; i++) {
      const x = 115 + (i / 120) * (2500 - 115);
      hp.push({ x, y: rayleighArcsec(x, 2.4) });
      jp.push({ x, y: x >= 600 ? rayleighArcsec(x, 6.5) : NaN });
      sp.push({ x, y: x >= 300 ? seeingAt(x, p.seeing) : NaN });
    }
    chartD.setData({ hst: hp, jwst: jp, see: sp }, { xDomain: [115, 2500], zero: true, cursor: { x: lam, label: `${th.toFixed(3)}″` } });

    // ---------------- light grasp
    const D = 10 ** p.logD;
    const area = collectingArea(D, Math.abs(D - 2.4) < 0.01 ? HST_OTA.obscuration : 0);
    roA.set('area', area < 0.01 ? area.toExponential(2) : fmt.n(area, 2));
    roA.set('eye', `${fmt.n(area / collectingArea(0.007), 0)} ×`);
    roA.set('mag', fmt.n(magnitudeGain(D, 0.007), 1));
    const thD = rayleighArcsec(lam, D);
    roA.set('theta', thD < 1 ? thD.toFixed(3) : fmt.n(thD, 1));
    const limitedBy = thD > see ? 'diffraction-limited (seeing is smaller)' : `seeing-limited: ${fmt.n(see / thD, 0)} × worse than its diffraction limit`;
    roA.set('limit', limitedBy, thD > see ? 'ok' : 'warn');

    // ---------------- design and flaw
    roR.set('m', design.m.toFixed(2));
    roR.set('b', design.b.toFixed(3));
    roR.set('k1', design.K1.toFixed(4));
    roR.set('k2', design.K2.toFixed(4));
    roR.set('ps', plateScale(HST_OTA.F).toFixed(3));
    roR.set('fov', (60 / plateScale(HST_OTA.F)).toFixed(1));
    const edge = conicError(HST_OTA.D / 2, HST_OTA.R1, design.K1, p.K) * 1e6;
    const waves = (2 * Math.abs(edge)) / 0.6328;
    roR.set('edge', edge.toFixed(2), Math.abs(edge) > 0.1 ? 'crit' : 'ok');
    roR.set('wf', waves.toFixed(1), waves > 0.25 ? 'crit' : 'ok');
    if (Math.abs(p.K - HST_OTA.K1asBuilt) < 0.0003) { flawStatus.textContent = 'As built: the edge sits 2.2 µm low, about 1/50 of a hair\'s width. Only about 15 % of a star\'s light landed in the sharp core instead of the planned 70 %, smearing the rest into a halo.'; flawStatus.dataset.state = 'crit'; }
    else if (waves < 0.25) { flawStatus.textContent = 'Within a quarter wave (He-Ne, 633 nm) of the design: the classic criterion for a diffraction-limited mirror.'; flawStatus.dataset.state = 'ok'; }
    else { flawStatus.textContent = `${waves.toFixed(1)} waves of reflected-wavefront error at the edge (before refocusing): visibly blurred, spherical aberration.`; flawStatus.dataset.state = 'warn'; }

    // ---------------- target
    const T = TARGETS[p.target];
    const rad = diffractionLimit(lam * 1e-9, 2.4);
    roT.set('dist', length(T.d));
    roT.set('feat', length(linearResolution(T.d, rad)));
    roT.set('ground', length(T.d * (see / 206264.8)));
    const n = T.size / toArcsec(rad);
    roT.set('across', n >= 1 ? fmt.n(n, 0) : `${n.toFixed(2)} (unresolved)`);
    tgtNote.textContent = `For ${T.what}, ${arcsec(T.size)} across, at ${fmt.n(lam)} nm.`;

    // ---------------- orbit
    const o = orbitAt(p.h);
    roO.set('v', o.v.toFixed(2));
    roO.set('T', (o.T / 60).toFixed(1));
    roO.set('n', o.perDay.toFixed(2));
    roO.set('ecl', (o.eclipse / 60).toFixed(1));
    roO.set('rate', Math.abs(decayRate(p.h, { activity: p.activity })).toFixed(1));
    const y0 = 2026;
    const runs = { min: decayHistory(p.h, y0, { activity: 0.35, years: 30 }), avg: decayHistory(p.h, y0, { activity: 1, years: 30 }), max: decayHistory(p.h, y0, { activity: 2.5, years: 30 }) };
    const sel = p.activity < 0.5 ? runs.min : p.activity > 2 ? runs.max : runs.avg;
    roO.set('re', sel.reentry ? `≈ ${Math.round(sel.reentry)}` : 'after 2056', sel.reentry && sel.reentry < 2035 ? 'warn' : '');
    const thin = (pts) => pts.filter((_, i) => i % 4 === 0 || i === pts.length - 1);
    chartO.setData({ min: thin(runs.min.points), avg: thin(runs.avg.points), max: thin(runs.max.points) }, { xDomain: [y0, y0 + 30], yDomain: [150, Math.max(650, p.h)], markers: [{ x: 2033, label: 'STScI median 2033' }] });
  }

  return {
    update() { if (dirty) { dirty = false; compute(); } },
    dispose() { v.setLightPath(false); },
    api: {
      setWavelength: (nm) => sNm.set(nm),
      setTarget: (k) => tgt.set(k),
      setAperture: (open) => tDoor.set(open),
    },
  };
}
