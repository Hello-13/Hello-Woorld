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
import { EventLog } from './ui/log.js';
import { el, fmt } from './ui/dom.js';
import { buildFighter } from './models/fighter.js';
import { buildRocket } from './models/rocket.js';
import { buildTurbofan } from './models/turbofan.js';
import { buildSatellite } from './models/satellite.js';
import { buildUAV } from './models/uav.js';
import { mountFighterLab } from './labs/fighterLab.js';
import { mountRocketLab } from './labs/rocketLab.js';
import { mountEngineLab } from './labs/engineLab.js';
import { mountOrbitLab } from './labs/orbitLab.js';
import { mountUavLab } from './labs/uavLab.js';

const FLEET = [
  { id: 'fighter', key: '1', build: buildFighter, lab: mountFighterLab, labName: 'Flight envelope', lift: 1.4 },
  { id: 'rocket', key: '2', build: buildRocket, lab: mountRocketLab, labName: 'Launch simulator', lift: 5.5 },
  { id: 'turbofan', key: '3', build: buildTurbofan, lab: mountEngineLab, labName: 'Brayton cycle', lift: 0.8 },
  { id: 'satellite', key: '4', build: buildSatellite, lab: mountOrbitLab, labName: 'Orbital transfer', lift: 0 },
  { id: 'uav', key: '5', build: buildUAV, lab: mountUavLab, labName: 'Mission endurance', lift: 1.2 },
];
const MODE_LABEL = { studio: 'Studio', xray: 'X-ray', blueprint: 'Blueprint', thermal: 'Thermal' };
const SYSTEM_HUES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#7f93a8'];

const $ = (id) => document.getElementById(id);
const boot = $('boot');
const bootLog = $('boot-log');
const bootLine = (text) => { bootLog.append(el('li', { text })); };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function start() {
  bootLine('Loading typefaces');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 112px "Chakra Petch"'), document.fonts.ready]),
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

  for (const f of FLEET) {
    bootLine(`Building ${f.id === 'turbofan' ? 'turbofan rotor stages' : f.id} geometry`);
    await nextFrame();
    f.vehicle = f.build();
    f.vehicle.explodeLift = f.lift;
    f.tris = triangleCount(f.vehicle.root);
  }

  const app = {
    current: null, entry: null, lab: null, mode: 'studio', explode: 0, explodeTarget: 0,
    labels: true, autoRotate: !stage.reducedMotion, selected: null, hovered: null, orbit: false, isolated: false, tab: 'lab',
  };

  // ------------------------------------------------------------------ DOM refs
  const fleetList = $('fleet-list');
  const hudDesig = $('hud-desig'), hudName = $('hud-name'), hudRole = $('hud-role');
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
  for (const f of FLEET) {
    const v = f.vehicle;
    const b = el('button', { type: 'button', class: 'fleet-item', 'aria-pressed': 'false', 'data-id': f.id },
      el('span', { class: 'fi-top' }, el('span', { class: 'fi-desig', text: v.designation }), el('kbd', { class: 'fi-key', title: `Shortcut: ${f.key}`, text: f.key })),
      el('span', { class: 'fi-name', text: v.name }),
      el('span', { class: 'fi-role', text: v.role }),
      el('span', { class: 'fi-tag', text: v.fleetTag }));
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
  function setMode(m) {
    if (app.orbit) return;
    app.mode = m;
    for (const b of modeGroup.children) b.setAttribute('aria-checked', String(b.dataset.mode === m));
    modes.apply(app.current, m, app.selected);
    legend.hidden = m !== 'thermal';
    updateLegend();
    log.push('VIEW', `${MODE_LABEL[m]} render mode`);
  }
  function updateLegend() {
    const v = app.current;
    if (!v) return;
    const [lo, hi] = v.thermalRange;
    $('legend-bar').style.background = `linear-gradient(90deg, ${INFERNO_CSS})`;
    $('legend-lo').textContent = `${lo} K`;
    $('legend-hi').textContent = `${hi.toLocaleString('en-US')} K`;
  }

  // ------------------------------------------------------------------ tools
  explodeInput.addEventListener('input', () => { app.explodeTarget = +explodeInput.value / 100; explodeOut.textContent = `${explodeInput.value} %`; });
  const setExplode = (x) => { app.explodeTarget = x; explodeInput.value = String(Math.round(x * 100)); explodeOut.textContent = `${explodeInput.value} %`; };
  const pressed = (b, v) => b.setAttribute('aria-pressed', String(v));
  labelsBtn.addEventListener('click', () => { app.labels = !app.labels; pressed(labelsBtn, app.labels); callouts.setVisible(app.labels && !app.orbit); });
  const setAutoRotate = (v) => { app.autoRotate = v; pressed(spinBtn, v); };
  spinBtn.addEventListener('click', () => setAutoRotate(!app.autoRotate));
  setAutoRotate(app.autoRotate);
  resetBtn.addEventListener('click', () => { if (app.orbit) orbitApi?.frame?.(); else stage.frameVehicle(app.current); });

  // ------------------------------------------------------------------ tabs
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function setTab(name) {
    app.tab = name;
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

  // ------------------------------------------------------------------ picking & callouts
  const callouts = new Callouts((part) => selectPart(part));
  new Picker(stage, {
    getRoot: () => (app.orbit ? null : app.current?.root),
    enabled: () => !app.orbit,
    onHover: (part) => { app.hovered = part; refreshOutline(); },
    onSelect: (part) => selectPart(part),
  });
  function refreshOutline() {
    stage.outline.selectedObjects = [app.selected, app.hovered].filter(Boolean);
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
        el('span', { class: 'pc-sys', text: info.system }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close part details', onclick: () => { isolate(false); selectPart(null); } }, '×')),
      el('h3', { class: 'pc-name', text: info.name }),
      el('p', { class: 'pc-desc', text: info.desc }),
      el('dl', { class: 'pc-facts' },
        el('div', {}, el('dt', { text: 'Material' }), el('dd', { text: info.material })),
        el('div', {}, el('dt', { text: 'Mass' }), el('dd', { text: info.mass ? `${fmt.n(info.mass)} kg` : '—' })),
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

  // ------------------------------------------------------------------ inspector: specs & parts
  function renderSpecs(v) {
    const systems = [...new Set(v.parts.map((p) => p.userData.part.system))];
    const hue = Object.fromEntries(systems.map((s, i) => [s, SYSTEM_HUES[i % SYSTEM_HUES.length]]));
    const totalMass = v.parts.reduce((a, p) => a + (p.userData.part.mass || 0), 0);
    specsRoot.replaceChildren(
      el('p', { class: 'spec-tagline', text: v.tagline }),
      el('p', { class: 'spec-summary', text: v.summary }),
      el('dl', { class: 'spec-grid' }, v.specs.map(([k, val]) => el('div', {}, el('dt', { text: k }), el('dd', { text: val })))),
      el('h3', { class: 'lab-h', text: `Components · ${v.parts.length} parts · ${fmt.n(totalMass)} kg listed` }),
      el('ul', { class: 'part-list' }, systems.map((sys) => el('li', { class: 'part-group' },
        el('span', { class: 'part-sys' }, el('span', { class: 'sys-dot', style: `background:${hue[sys]}` }), el('span', { text: sys })),
        el('ul', {}, v.parts.filter((p) => p.userData.part.system === sys).map((p) => {
          const info = p.userData.part;
          const b = el('button', { type: 'button', class: 'part-row', 'data-pid': info.id, 'aria-current': 'false' },
            el('span', { class: 'pr-name', text: info.name }), el('span', { class: 'pr-mass', text: info.mass ? `${fmt.n(info.mass)} kg` : '' }));
          b.addEventListener('click', () => { selectPart(p); focusPart(p); });
          b.addEventListener('pointerenter', () => { app.hovered = p; refreshOutline(); });
          b.addEventListener('pointerleave', () => { app.hovered = null; refreshOutline(); });
          return el('li', {}, b);
        }))))),
    );
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
    if (on) {
      if (app.mode !== 'studio') modes.apply(app.current, 'studio', null);
      stage.setEnvironment('space');
      selectPart(null);
    } else {
      stage.setEnvironment(app.mode === 'blueprint' ? 'blueprint' : 'hangar');
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
    app.lab?.dispose();
    if (app.orbit) setOrbitMode(false);
    if (app.current) { isolate(false); for (const p of app.current.parts) p.visible = true; }
    app.selected = null; app.hovered = null; refreshOutline(); partCard.hidden = true;
    app.entry = f;
    const v = f.vehicle;
    app.current = v;
    stage.setVehicle(v);
    if (v._baseY == null) v._baseY = v.root.position.y;
    modes.apply(v, app.mode);
    applyExplode(v.parts, app.explode);
    callouts.attach(v);
    callouts.setVisible(app.labels);
    for (const x of FLEET) x.button.setAttribute('aria-pressed', String(x === f));
    hudDesig.textContent = v.designation;
    hudName.textContent = v.name;
    hudRole.textContent = v.role;
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
      setOrbitMode, cloneForOrbit,
    });
    orbitApi = f.id === 'satellite' ? { frame: () => stage.frameVehicle(v) } : null;
    $('tris').textContent = fmt.n(f.tris);
    try { history.replaceState(null, '', `#${f.id}`); } catch { /* sandboxed */ }
    log.push('SYS', `${v.designation} ${v.name} on deck · ${v.parts.length} parts · ${fmt.n(f.tris)} triangles`, 'ok');
  }

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input[type="text"], textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const f = FLEET.find((x) => x.key === e.key);
    if (f) { select(f.id); return; }
    const k = e.key.toLowerCase();
    if (k === 'm') setMode(MODES[(MODES.indexOf(app.mode) + 1) % MODES.length]);
    else if (k === 'x') setExplode(app.explodeTarget > 0.5 ? 0 : 1);
    else if (k === 'l') labelsBtn.click();
    else if (k === 'r') resetBtn.click();
    else if (e.key === 'Escape') { isolate(false); selectPart(null); }
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
    app.lab?.update(dt, t);
    stage.stepEnv(dt);
    stage.controls.autoRotate = app.autoRotate && !stage.tween && !(v.state?.launching);
    clockAcc += dt;
    if (clockAcc > 0.5) {
      clockAcc = 0;
      $('utc').textContent = new Date().toISOString().slice(11, 19);
      $('fps').textContent = Math.round(stage.fps);
    }
  });

  const initial = FLEET.find((f) => f.id === location.hash.slice(1)) ? location.hash.slice(1) : 'fighter';
  select(initial);
  setTab('lab');
  log.push('SYS', 'AEROFORGE online · render core, physics and labs nominal', 'ok');
  boot.classList.add('is-done');
  setTimeout(() => { boot.hidden = true; }, 600);
}

start();
