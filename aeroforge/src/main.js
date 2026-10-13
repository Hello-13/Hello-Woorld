// AEROFORGE — app shell: fleet, render modes, picking, exploded view, part inspector,
// engineering labs and the mission event log.

import * as THREE from 'three';
import { Stage, solidBounds } from './engine/stage.js';
import { RenderModes, MODES } from './engine/modes.js';
import { Picker } from './engine/picking.js';
import { Callouts } from './engine/callouts.js';
import { applyExplode } from './engine/assembly.js';
import { triangleCount } from './engine/geometry.js';
import { INFERNO_CSS } from './engine/effects.js';
import { LOOKS } from './engine/environment.js';
import { TourPlayer } from './learn/tour.js';
import { SYSTEMS, systemColor } from './engine/systems.js';
import { QUALITY } from './engine/stage.js';
import { setTextureDetail } from './engine/surface.js';
import { EventLog } from './ui/log.js';
import { el, fmt } from './ui/dom.js';
import { FLEET } from './fleet.js';

const MODE_LABEL = { studio: 'Studio', xray: 'X-ray', blueprint: 'Blueprint', systems: 'Systems', thermal: 'Thermal', pressure: 'Pressure' };
const SEE_THROUGH = new Set(['xray', 'blueprint', 'systems']);   // modes where clicks pass through skins

const $ = (id) => document.getElementById(id);
const boot = $('boot');
const bootLog = $('boot-log');
let bootStep = 0;
const bootLine = (text) => {
  bootLog.append(el('li', { text }));
  const bar = document.getElementById('boot-progress');
  if (bar) bar.style.width = `${Math.min(100, (++bootStep / 8) * 100)}%`;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function start() {
  bootLine('Loading typefaces');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('250 112px "Archivo"'), document.fonts.load('400 15px "Public Sans"'), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
  } catch { /* fall back to system faces */ }

  bootLine('Starting render core');
  let stage;
  try {
    stage = new Stage($('gl'));
  } catch (err) {
    boot.classList.add('is-error');
    bootLine('WebGL is not available in this browser, so the 3-D bay cannot start. Try a current Chrome, Edge, Firefox or Safari with hardware acceleration on.');
    console.error(err);
    return;
  }
  const modes = new RenderModes(stage);
  // console handle for tinkering: __aeroforge.stage, .modes, .FLEET, .app
  window.__aeroforge = { stage, modes, FLEET, get app() { return app; } };
  const log = new EventLog($('log'));
  // Ultra and 4K paint the large skins and stencils at twice the resolution for 4K close-ups
  setTextureDetail(stage.quality === '4k' || stage.quality === 'ultra' ? 2 : 1);

  for (const f of FLEET) {
    bootLine(`Building ${f.id === 'turbofan' ? 'turbofan rotor stages' : f.id} geometry`);
    await nextFrame();
    f.vehicle = f.build();
    f.vehicle.explodeLift = f.lift;
    f.tris = triangleCount(f.vehicle.root);
  }

  const app = {
    current: null, entry: null, lab: null, mode: 'studio', explode: 0, explodeTarget: 0,
    labels: false, autoRotate: !stage.reducedMotion, selected: null, hovered: null, orbit: false, isolated: false, tab: 'lab',
  };

  // ------------------------------------------------------------------ DOM refs
  const fleetList = $('fleet-list');
  const hudDesig = $('hud-desig'), hudName = $('hud-name'), hudRole = $('hud-role');
  const hero = $('hero'), heroTagline = $('hud-tagline'), heroStats = $('hero-stats');
  const modeGroup = $('modes');
  const explodeInput = $('explode');
  const explodeOut = $('explode-out');
  const labelsBtn = $('labels'), spinBtn = $('spin'), resetBtn = $('reset-view');
  const legend = $('legend');
  const partCard = $('part-card');
  const labRoot = $('lab-root'), labTitle = $('tab-lab-btn');
  const specsRoot = $('specs-root');
  const orbitNote = $('orbit-note');

  // ------------------------------------------------------------------ fleet rail
  fleetList.style.setProperty('--fleet-n', FLEET.length);
  for (const f of FLEET) {
    const v = f.vehicle;
    const b = el('button', { type: 'button', class: 'fleet-item', 'aria-pressed': 'false', 'data-id': f.id, 'aria-keyshortcuts': f.key },
      el('span', { class: 'fi-top' }, el('span', { class: 'fi-key', title: `Keyboard shortcut ${f.key}`, text: `0${f.key}` }), el('span', { class: 'fi-desig', text: v.designation })),
      el('span', { class: 'fi-name', text: v.name }),
      el('span', { class: 'fi-role', text: v.role }));
    b.addEventListener('click', () => select(f.id));
    fleetList.append(el('li', {}, b));
    f.button = b;
  }

  // ------------------------------------------------------------------ modes
  for (const m of MODES) {
    const b = el('button', { type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(m === 'studio'), 'data-mode': m, text: MODE_LABEL[m] });
    b.addEventListener('click', () => setMode(m));
    modeGroup.append(b);
  }
  function setMode(m, { quiet = false } = {}) {
    if (app.orbit) return;
    if (m === 'pressure' && !app.current?.aero) m = 'studio';
    app.mode = m;
    for (const b of modeGroup.children) b.setAttribute('aria-checked', String(b.dataset.mode === m));
    modes.apply(app.current, m, app.selected);
    legend.hidden = m !== 'thermal' && m !== 'pressure' && m !== 'systems';
    updateLegend();
    if (!quiet) log.push('VIEW', `${MODE_LABEL[m]} render mode`);
  }
  function updateLegend() {
    const v = app.current;
    if (!v) return;
    legend.classList.toggle('is-systems', app.mode === 'systems');
    if (app.mode === 'systems') {
      $('legend-title').textContent = 'Systems';
      const list = $('legend-systems');
      list.replaceChildren(...systemsOf(v).filter((x) => !x.skinOnly).map(({ name, parts }) => {
        const b = el('button', { type: 'button', class: 'legend-sys', 'aria-pressed': String(app.sysFocus === name), title: SYSTEMS[name]?.blurb || name },
          el('span', { class: 'sys-dot', style: `background:${systemColor(name)}` }), el('span', { text: name }), el('span', { class: 'legend-n', text: parts.length }));
        b.addEventListener('click', () => focusSystem(app.sysFocus === name ? null : name));
        return el('li', {}, b);
      }));
      return;
    }
    if (app.mode === 'pressure') {
      $('legend-title').textContent = 'Pressure coefficient Cp';
      $('legend-bar').style.background = 'linear-gradient(90deg, #0a1f6b, #2a5fdc 38%, #c7c9cc 64%, #dc3d29)';
      $('legend-lo').textContent = '−1.6 suction';
      $('legend-hi').textContent = '+0.9 compression';
      return;
    }
    const [lo, hi] = v.thermalRange;
    $('legend-title').textContent = 'Surface temperature';
    $('legend-bar').style.background = `linear-gradient(90deg, ${INFERNO_CSS})`;
    $('legend-lo').textContent = `${lo} K`;
    $('legend-hi').textContent = `${hi.toLocaleString('en-US')} K`;
  }
  function syncModeButtons() {
    for (const b of modeGroup.children) b.hidden = b.dataset.mode === 'pressure' && !app.current?.aero;
  }

  // ------------------------------------------------------------------ environment sets & quality
  const lookGroup = $('looks');
  app.looks = {};
  function renderLooks() {
    const f = app.entry;
    lookGroup.replaceChildren(...f.looks.map((k) => {
      const b = el('button', { type: 'button', role: 'radio', class: 'seg-btn', 'aria-checked': String(k === app.look), 'data-look': k, text: LOOKS[k].label });
      b.addEventListener('click', () => setLook(k));
      return b;
    }));
  }
  function setLook(k, { remember = true } = {}) {
    if (app.orbit || !LOOKS[k]) return;
    app.look = k;
    if (remember) app.looks[app.entry.id] = k;
    stage.env.applyLook(k);
    app.current.setLook?.(k);
    modes.apply(app.current, app.mode, app.selected);
    for (const b of lookGroup.children) b.setAttribute('aria-checked', String(b.dataset.look === k));
    stage.frameVehicle(app.current);
  }
  let groundLook = null;
  function setFlightLook(on) {
    if (on) { groundLook = app.look === 'sky' ? groundLook : app.look; setLook('sky', { remember: false }); }
    else setLook(groundLook && groundLook !== 'sky' ? groundLook : app.entry.looks[0], { remember: false });
  }
  const qualitySel = $('quality');
  for (const [k, q] of Object.entries(QUALITY)) qualitySel.append(el('option', { value: k, text: q.label }));
  qualitySel.value = stage.quality;
  qualitySel.addEventListener('change', () => { stage.setQuality(qualitySel.value); log.push('VIEW', `Render quality: ${QUALITY[qualitySel.value].label}`); });
  stage.onQualityChange = (k, manual, up, info = {}) => {
    qualitySel.value = k;
    if (manual) return;
    if (info.reverted) log.push('VIEW', `4K supersampling would cut the frame rate from ${Math.round(info.base)} to ${Math.round(info.got)} fps, so graphics stay at ${QUALITY[k].label}`, 'ok');
    else if (info.trial) log.push('VIEW', `Trying ${QUALITY[k].label} supersampling: Ultra runs at ${Math.round(info.base)} fps, so this GPU may have headroom`, 'ok');
    else if (up) log.push('VIEW', `Graphics raised to ${QUALITY[k].label}`, 'ok');
    else log.push('VIEW', `Graphics lowered to ${QUALITY[k].label} to keep the frame rate up`, 'warn');
  };

  // ------------------------------------------------------------------ tools
  explodeInput.addEventListener('input', () => { app.explodeTarget = +explodeInput.value / 100; explodeOut.textContent = `${explodeInput.value} %`; });
  const setExplode = (x, { instant = false } = {}) => {
    app.explodeTarget = x;
    if (instant && app.current) {
      app.explode = x;
      applyExplode(app.current.parts, x);
      app.current.root.position.y = app.current._baseY + app.current.explodeLift * x * app.current._fitScale;
    }
    explodeInput.value = String(Math.round(x * 100));
    explodeOut.textContent = `${explodeInput.value} %`;
  };
  const pressed = (b, v) => b.setAttribute('aria-pressed', String(v));
  pressed(labelsBtn, app.labels);
  labelsBtn.addEventListener('click', () => { app.labels = !app.labels; pressed(labelsBtn, app.labels); callouts.setVisible(app.labels && !app.orbit); });
  const setAutoRotate = (v) => { app.autoRotate = v; pressed(spinBtn, v); };
  spinBtn.addEventListener('click', () => setAutoRotate(!app.autoRotate));
  setAutoRotate(app.autoRotate);
  resetBtn.addEventListener('click', () => { if (app.orbit) orbitApi?.frame?.(); else stage.frameVehicle(app.current); });

  // ------------------------------------------------------------------ tabs
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const navLinks = [...document.querySelectorAll('.nav-link')];
  function setTab(name) {
    app.tab = name;
    syncNav();
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
  }
  tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  tabs.forEach((t, i) => t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); setTab(n.dataset.tab);
    }
  }));

  // ------------------------------------------------------------------ dossier (slide-in engineering panel)
  const dossier = $('dossier');
  const narrow = () => window.matchMedia('(max-width: 900px)').matches;
  const dossierOpen = () => document.body.classList.contains('has-dossier');
  function syncNav() {
    for (const n of navLinks) n.setAttribute('aria-current', String(dossierOpen() && n.dataset.nav === app.tab));
  }
  function setDossier(open, tab) {
    const wasOpen = dossierOpen();
    if (tab) setTab(tab);
    document.body.classList.toggle('has-dossier', open);
    try { localStorage.setItem('aeroforge.dossier', open ? '1' : '0'); } catch { /* storage blocked */ }
    const changed = dossierOpen() !== wasOpen;
    syncNav();
    updateViewShift();
    if (changed && app.current) reframe();
  }
  for (const n of navLinks) {
    n.addEventListener('click', () => setDossier(!(dossierOpen() && app.tab === n.dataset.nav), n.dataset.nav));
  }
  $('open-lab').addEventListener('click', () => setDossier(true, 'lab'));
  $('dossier-close').addEventListener('click', () => setDossier(false));
  $('brand').addEventListener('click', (e) => { e.preventDefault(); select(FLEET[0].id); });

  // The render keeps the subject clear of whatever covers the window: the hero copy (or tour
  // card) on the left and the dossier on the right. On phones the content flows below instead.
  function updateViewShift() {
    if (narrow()) { stage.setViewShift(0); stage.frameCover = 0; stage.frameCoverY = 0; return; }
    const w = Math.max(1, stage.container.clientWidth), h = Math.max(1, stage.container.clientHeight);
    const right = dossierOpen() ? dossier.offsetWidth / w : 0;
    const left = tour.active ? 0.15 : dossierOpen() ? (app.orbit ? 0.13 : 0.07) : 0.14;
    // nav bar above; fleet index and view tools below
    const top = 68 / h, bottom = 156 / h;
    stage.setViewShift(left - right / 2, (bottom - top) / 2);
    stage.frameCover = Math.min(0.6, right + left * 1.6);
    stage.frameCoverY = top + bottom;
  }
  const reframe = () => {
    if (!tour.active && !app.orbit && !app.current?.state?.launching) stage.frameVehicle(app.current);
  };
  window.addEventListener('resize', () => updateViewShift());

  // ------------------------------------------------------------------ picking & callouts
  const callouts = new Callouts((part) => selectPart(part));
  const hoverTip = el('div', { class: 'hover-tip', role: 'tooltip', hidden: true });
  document.body.append(hoverTip);
  const placeTip = (e) => {
    if (hoverTip.hidden || !e) return;
    const x = Math.min(e.clientX + 16, window.innerWidth - hoverTip.offsetWidth - 8);
    hoverTip.style.transform = `translate(${x}px, ${e.clientY + 18}px)`;
  };
  function showHoverTip(part) {
    const ev = picker?.last;
    if (!part || app.orbit || !ev || ev.pointerType === 'touch') { hoverTip.hidden = true; return; }
    const info = part.userData.part;
    hoverTip.replaceChildren(
      el('span', { class: 'sys-dot', style: `background:${systemColor(info.system)}` }),
      el('span', { class: 'ht-name', text: info.count > 1 ? `${info.name} ×${info.count}` : info.name }),
      el('span', { class: 'ht-sys', text: info.system }));
    hoverTip.hidden = false;
    placeTip(ev);
  }
  stage.renderer.domElement.addEventListener('pointermove', placeTip);
  stage.renderer.domElement.addEventListener('pointerdown', () => { hoverTip.hidden = true; });
  const picker = new Picker(stage, {
    getRoot: () => (app.orbit ? null : app.current?.root),
    enabled: () => !app.orbit,
    onHover: (part) => { app.hovered = part; refreshOutline(); showHoverTip(part); },
    accept: (part) => !(SEE_THROUGH.has(app.mode) && part.userData.part.skin) && (!modes.focus || modes.focus.has(part)),
    onSelect: (part) => selectPart(part),
  });
  function refreshOutline() {
    stage.setOutlined([app.selected, app.hovered].filter(Boolean));
  }

  function partTemp(part) {
    const v = app.current, info = part.userData.part;
    return v.temperatureOf ? v.temperatureOf(info) : info.temp;
  }

  function selectPart(part) {
    if (app.isolated && part !== app.selected) isolate(false);
    app.selected = part;
    refreshOutline();
    callouts.setSelected(part);
    if (app.mode === 'xray' || app.mode === 'blueprint') modes.apply(app.current, app.mode, part);
    for (const row of specsRoot.querySelectorAll('.part-row')) row.setAttribute('aria-current', String(row.dataset.pid === part?.userData.part.id));
    renderPartCard();
    if (part) log.push(app.current.designation, `Inspecting ${part.userData.part.name}`);
  }

  function renderPartCard() {
    const part = app.selected;
    if (!part) { partCard.hidden = true; return; }
    const info = part.userData.part;
    const T = partTemp(part);
    partCard.replaceChildren(
      el('div', { class: 'pc-head' },
        el('span', { class: 'pc-sys' }, el('span', { class: 'sys-dot', style: `background:${systemColor(info.system)}` }), el('span', { text: info.system })),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close part details', onclick: () => { isolate(false); selectPart(null); } }, '×')),
      el('h3', { class: 'pc-name', text: info.name }),
      el('p', { class: 'pc-desc', text: info.desc }),
      el('dl', { class: 'pc-facts' },
        el('div', {}, el('dt', { text: 'Material' }), el('dd', { text: info.material })),
        el('div', {}, el('dt', { text: 'Mass' }), el('dd', { text: massText(info), title: info.massSource || 'Estimated from public dimensions, materials and comparable components' })),
        info.count ? el('div', {}, el('dt', { text: 'Quantity' }), el('dd', { text: fmt.n(info.count) })) : null,
        el('div', {}, el('dt', { text: app.mode === 'thermal' ? 'Temperature (live)' : 'Temperature' }), el('dd', { text: `${fmt.n(T)} K · ${fmt.n(T - 273.15)} °C` }))),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => focusPart(part), text: 'Focus' }),
        el('button', { type: 'button', class: 'btn btn-secondary', 'aria-pressed': String(app.isolated), onclick: () => isolate(!app.isolated), text: app.isolated ? 'Show all parts' : 'Isolate' })),
    );
    partCard.hidden = false;
  }

  function focusPart(part) {
    const box = solidBounds(part);
    if (box.isEmpty()) return;
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dir = stage.camera.position.clone().sub(stage.controls.target).normalize();
    const dist = Math.max(2.2, sph.radius / Math.sin((stage.camera.fov * Math.PI) / 360) * 1.25);
    stage.flyTo(sph.center.clone().addScaledVector(dir, dist), sph.center, 1.0);
  }

  function isolate(on) {
    app.isolated = on && !!app.selected;
    for (const p of app.current.parts) p.visible = !app.isolated || p === app.selected;
    renderPartCard();
  }

  // ------------------------------------------------------------------ guided tours
  const tourBtn = $('tour-start');
  const tour = new TourPlayer($('tour'), {
    stage, modes, callouts,
    getVehicle: () => app.current,
    getLab: () => app.lab,
    setMode, setExplode,
    log: (src, msg, level) => log.push(src, msg, level),
    onStart: () => {
      selectPart(null); setAutoRotate(false); document.body.classList.add('is-touring');
      app.sysFocus = null;
      callouts.setVisible(true);
      tourBtn.textContent = 'Exit tour';
      updateViewShift();
    },
    onStop: () => {
      document.body.classList.remove('is-touring'); tourBtn.textContent = 'Start guided tour';
      callouts.setVisible(app.labels && !app.orbit);
      updateViewShift();
    },
  });
  tourBtn.addEventListener('click', () => (tour.active ? tour.stop() : tour.start(app.entry.id)));

  // ------------------------------------------------------------------ inspector: specs & parts
  const massText = (info) => (info.mass == null ? '—' : info.massSource ? `${fmt.n(info.mass)} kg` : `≈ ${fmt.n(info.mass)} kg (estimate)`);

  /** Systems present on a vehicle, largest first, with their parts. */
  function systemsOf(v) {
    const map = new Map();
    for (const p of v.parts) {
      const sys = p.userData.part.system;
      if (!map.has(sys)) map.set(sys, []);
      map.get(sys).push(p);
    }
    return [...map].map(([name, parts]) => ({ name, parts, skinOnly: parts.every((p) => p.userData.part.skin) }))
      .sort((a, b) => b.parts.length - a.parts.length);
  }

  /** Spotlight one subsystem: everything else is ghosted and the camera frames what is left. */
  function focusSystem(name) {
    const v = app.current;
    if (!v || tour.active) return;
    app.sysFocus = name;
    const parts = name ? v.parts.filter((p) => p.userData.part.system === name) : null;
    modes.setFocus(v, parts);
    callouts.setFilter(parts ? new Set(parts) : null);
    for (const b of specsRoot.querySelectorAll('.sys-chip')) b.setAttribute('aria-pressed', String((b.dataset.sys || null) === (name || null)));
    updateLegend();
    if (parts) {
      const box = new THREE.Box3();
      for (const p of parts) box.union(solidBounds(p));
      if (!box.isEmpty()) {
        const sph = box.getBoundingSphere(new THREE.Sphere());
        const dir = stage.camera.position.clone().sub(stage.controls.target).normalize();
        const { tanV, tanH } = stage.frameTan();
        const dist = Math.max(2.5, (sph.radius / Math.min(tanV, tanH)) * 1.05);
        stage.flyTo(sph.center.clone().addScaledVector(dir, dist), sph.center, 1.1);
      }
      log.push(v.designation, `Spotlight: ${name} · ${parts.length} parts`);
    } else stage.frameVehicle(v);
  }

  function renderSpecs(v) {
    const groups = systemsOf(v);
    const totalMass = v.parts.reduce((a, p) => a + (p.userData.part.mass || 0), 0);
    const chip = (name, n) => {
      const b = el('button', { type: 'button', class: 'sys-chip', 'aria-pressed': String((app.sysFocus || null) === (name || null)), 'data-sys': name || '', title: name ? SYSTEMS[name]?.blurb || name : 'Show every system' },
        name ? el('span', { class: 'sys-dot', style: `background:${systemColor(name)}` }) : null,
        el('span', { text: name || 'All systems' }), el('span', { class: 'chip-n', text: n }));
      if (!name) b.removeAttribute('data-sys');
      b.addEventListener('click', () => focusSystem(name && app.sysFocus !== name ? name : null));
      return b;
    };
    const search = el('input', { type: 'search', id: 'part-search', class: 'part-search', placeholder: 'Find a part, system or material', 'aria-label': 'Find a part' });
    const list = el('div', { class: 'part-list' }, groups.map(({ name, parts }) => el('details', { class: 'part-group', open: groups.length <= 6 ? true : null },
      el('summary', { class: 'part-sys' }, el('span', { class: 'sys-dot', style: `background:${systemColor(name)}` }), el('span', { text: name }), el('span', { class: 'pg-count', text: parts.length })),
      el('ul', {}, parts.map((p) => {
        const info = p.userData.part;
        const b = el('button', { type: 'button', class: 'part-row', 'data-pid': info.id, 'aria-current': 'false' },
          el('span', { class: 'pr-name', text: info.count > 1 ? `${info.name} ×${info.count}` : info.name }),
          el('span', { class: 'pr-mass', text: info.mass ? `${info.massSource ? '' : '≈ '}${fmt.n(info.mass)} kg` : '' }));
        b.addEventListener('click', () => { selectPart(p); focusPart(p); });
        b.addEventListener('pointerenter', () => { app.hovered = p; refreshOutline(); });
        b.addEventListener('pointerleave', () => { app.hovered = null; refreshOutline(); });
        return el('li', { 'data-q': `${info.name} ${info.system} ${info.material}`.toLowerCase() }, b);
      })))));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      for (const g of list.children) {
        let any = false;
        for (const li of g.querySelectorAll('li')) { const hit = !q || li.dataset.q.includes(q); li.hidden = !hit; any ||= hit; }
        g.hidden = !any;
        if (q && any) g.open = true;
      }
    });
    specsRoot.replaceChildren(...[
      el('p', { class: 'spec-tagline', text: v.tagline }),
      el('p', { class: 'spec-summary', text: v.summary }),
      v.sources ? el('p', { class: 'spec-sources', text: `Sources: ${v.sources}` }) : null,
      el('dl', { class: 'spec-grid' }, v.specs.map(([k, val]) => el('div', {}, el('dt', { text: k }), el('dd', { text: val })))),
      el('h3', { class: 'lab-h', text: `Components · ${v.parts.length} parts in ${groups.length} systems · ≈ ${fmt.n(totalMass)} kg listed` }),
      el('div', { class: 'sys-chips', role: 'group', 'aria-label': 'Spotlight a system' }, chip(null, v.parts.length), groups.map(({ name, parts }) => chip(name, parts.length))),
      search,
      list,
      el('p', { class: 'lab-note', text: 'Masses marked ≈ are engineering estimates from published dimensions and materials; manufacturers do not publish component masses.' }),
    ].filter(Boolean));
  }

  // ------------------------------------------------------------------ orbit mode (satellite lab)
  let orbitApi = null;
  function setOrbitMode(on) {
    app.orbit = on;
    stage.holder.visible = !on;
    stage.setHangarVisible(!on);
    stage.controls.maxPolarAngle = on ? Math.PI : Math.PI * 0.495;
    stage.controls.minDistance = on ? 3 : 2;
    callouts.setVisible(app.labels && !on);
    orbitNote.hidden = !on;
    document.body.classList.toggle('is-orbit', on);
    updateViewShift();
    if (on) {
      if (app.mode !== 'studio') modes.apply(app.current, 'studio', null);
      stage.env.setSpaceView(true);
      selectPart(null);
    } else {
      stage.env.setSpaceView(false);
      modes.apply(app.current, app.mode, app.selected);
      stage.frameVehicle(app.current);
    }
  }
  function cloneForOrbit() {
    const m = app.mode;
    if (m !== 'studio') modes.apply(app.current, 'studio');
    const c = app.current.body.clone(true);
    if (m !== 'studio' && !app.orbit) modes.apply(app.current, m);
    c.position.set(0, 0, 0);
    c.traverse((o) => { o.castShadow = false; for (const k of Object.keys(o.userData)) if (k === 'edges') delete o.userData[k]; });
    const labels = [];
    c.traverse((o) => { if (o.isCSS2DObject) labels.push(o); });
    for (const o of labels) o.parent.remove(o);
    return c;
  }

  // ------------------------------------------------------------------ select vehicle
  function select(id) {
    const f = FLEET.find((x) => x.id === id) || FLEET[0];
    if (app.entry === f) return;
    if (tour.active) tour.stop({ silent: true });
    app.lab?.dispose();
    if (app.orbit) setOrbitMode(false);
    if (app.current) { isolate(false); for (const p of app.current.parts) p.visible = true; }
    app.selected = null; app.hovered = null; refreshOutline(); partCard.hidden = true;
    app.sysFocus = null; modes.setFocus(app.current, null); callouts.setFilter(null);
    app.entry = f;
    const v = f.vehicle;
    app.current = v;
    groundLook = null;
    app.look = app.looks[f.id] || f.looks[0];
    stage.env.applyLook(app.look);
    v.setLook?.(app.look);
    renderLooks();
    stage.setVehicle(v, { reveal: true });
    if (v._baseY == null) v._baseY = v.root.position.y;
    syncModeButtons();
    if (app.mode === 'pressure' && !v.aero) setMode('studio', { quiet: true });
    modes.apply(v, app.mode);
    applyExplode(v.parts, app.explode);
    callouts.attach(v);
    callouts.setVisible(app.labels);
    for (const x of FLEET) x.button.setAttribute('aria-pressed', String(x === f));
    hudDesig.textContent = v.designation;
    hudName.textContent = v.name;
    hudRole.textContent = v.role;
    heroTagline.textContent = v.tagline;
    heroStats.replaceChildren(...(v.heroStats || f.stats || []).map(([val, unit, label]) => el('div', { class: 'hero-stat' },
      el('dt', { text: label }), el('dd', {}, val, unit ? el('span', { class: 'stat-unit', text: unit }) : null))));
    $('dossier-desig').textContent = `${v.designation} · ${f.labName}`;
    $('dossier-name').textContent = v.name;
    hero.classList.remove('is-entering');
    void hero.offsetWidth;            // restart the entrance animation
    hero.classList.add('is-entering');
    labTitle.textContent = f.labName;
    renderSpecs(v);
    updateLegend();
    labRoot.replaceChildren();
    app.lab = f.lab(labRoot, {
      vehicle: v, stage, modes,
      log: (src, msg, level) => log.push(src, msg, level),
      refreshThermal: () => { modes.refreshThermal(app.current); if (app.selected && !partCard.hidden) renderPartCard(); },
      setExplode, setAutoRotate,
      refit: () => stage.frameVehicle(v),
      setFlightLook,
      setLook,
      setOrbitMode, cloneForOrbit,
      muteCallouts: (m) => callouts.setMuted(m),
    });
    orbitApi = f.id === 'satellite' ? { frame: () => stage.frameVehicle(v) } : null;
    $('tris').textContent = fmt.n(f.tris);
    try { history.replaceState(null, '', `#${f.id}`); } catch { /* sandboxed */ }
    log.push('SYS', `${v.designation} ${v.name} on deck · ${v.parts.length} parts · ${fmt.n(f.tris)} triangles`, 'ok');
  }

  // ------------------------------------------------------------------ full screen
  // In a 16:9 full-screen window the 4K preset draws exactly 3840 × 2160.
  const fullBtn = $('fullscreen');
  const toggleFull = () => {
    const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    req?.catch?.(() => log.push('VIEW', 'Full screen is not available in this view; open the page in its own browser tab', 'warn'));
  };
  if (document.fullscreenEnabled) {
    fullBtn.hidden = false;
    fullBtn.addEventListener('click', toggleFull);
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      fullBtn.setAttribute('aria-pressed', String(on));
      fullBtn.textContent = on ? 'Exit full screen' : 'Full screen';
    });
  }

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input[type="text"], textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (tour.active) {
      if (e.key === 'ArrowRight') { tour.next(); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft') { tour.prev(); e.preventDefault(); return; }
      if (e.key === 'Escape') { tour.stop(); return; }
    }
    if (e.target.closest?.('input[type="range"]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;
    const f = FLEET.find((x) => x.key === e.key);
    if (f) { select(f.id); return; }
    const k = e.key.toLowerCase();
    if (k === 'm') setMode(MODES[(MODES.indexOf(app.mode) + 1) % MODES.length]);
    else if (k === 'x') setExplode(app.explodeTarget > 0.5 ? 0 : 1);
    else if (k === 'l') labelsBtn.click();
    else if (k === 'r') resetBtn.click();
    else if (k === 'f' && document.fullscreenEnabled) toggleFull();
    else if (e.key === 'Escape') {
      if (app.selected) { isolate(false); selectPart(null); } else if (dossierOpen() && !narrow()) setDossier(false);
    }
  });

  // ------------------------------------------------------------------ frame loop
  let clockAcc = 1;
  stage.onFrame((dt, t) => {
    const v = app.current;
    if (!v) return;
    if (Math.abs(app.explode - app.explodeTarget) > 1e-4) {
      app.explode += (app.explodeTarget - app.explode) * (1 - Math.exp(-dt * (stage.reducedMotion ? 60 : 7)));
      if (Math.abs(app.explode - app.explodeTarget) < 1e-3) app.explode = app.explodeTarget;
      applyExplode(v.parts, app.explode);
      v.root.position.y = v._baseY + v.explodeLift * app.explode * v._fitScale;
    }
    v.update?.(dt, t);
    modes.tick(t);
    tour.update(dt);
    app.lab?.update(dt, t);
    stage.controls.autoRotate = app.autoRotate && !stage.tween && !(v.state?.launching);
    clockAcc += dt;
    if (clockAcc > 0.5) {
      clockAcc = 0;
      $('utc').textContent = new Date().toISOString().slice(11, 19);
      const fps = Math.round(stage.fps);
      $('fps').textContent = fps;
      const { width, height } = stage.renderSize;
      const mp = (width * height) / 1e6;
      $('res').textContent = `${width} × ${height}`;
      $('mp').textContent = `${mp.toFixed(1)} MP`;
      const gpu = stage.gpuMs != null ? ` The GPU spends ${stage.gpuMs.toFixed(1)} ms on each frame.` : '';
      $('perf').title = `Drawing ${mp.toFixed(1)} million pixels per frame${mp >= 8.2 ? ', the pixel count of 4K (3840 × 2160 = 8.3 MP) in the shape of your window' : ''}.${gpu} `
        + 'Frames are paced to the display: a frame that misses one refresh waits for the next, so the rate steps down in whole divisions (240 → 120 → 80 fps on a 240 Hz display). '
        + 'Each refresh allows 4.2 ms at 240 Hz, 6.9 ms at 144 Hz, 8.3 ms at 120 Hz and 16.7 ms at 60 Hz.';
    }
  });

  const initial = FLEET.find((f) => f.id === location.hash.slice(1)) ? location.hash.slice(1) : 'fighter';
  let reopen = false;
  try { reopen = localStorage.getItem('aeroforge.dossier') === '1'; } catch { /* storage blocked */ }
  if (reopen && !narrow()) document.body.classList.add('has-dossier');
  updateViewShift();
  select(initial);
  // deep links also work after load (pasted or edited URL, back/forward)
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (FLEET.some((f) => f.id === id)) select(id);
  });
  setTab('lab');
  log.push('SYS', 'AEROFORGE online · render core, physics and labs nominal', 'ok');
  boot.classList.add('is-done');
  setTimeout(() => { boot.hidden = true; }, 900);
}

start();
