'use strict';
// Study Widgets: each claude.ai page you list becomes a small frameless window you can move, resize and pin on top.

const { app, BrowserWindow, WebContentsView, Tray, Menu, nativeImage, nativeTheme, shell, screen, globalShortcut, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const C = require('./config');

const TOOLBAR_H = 34;
const SMOKE_DIR = process.env.STUDY_WIDGETS_SMOKE || '';

let paths = null;
let config = null;
let state = null;
let tray = null;
let quitting = false;
let saveTimer = null;
const widgets = new Map();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showAll());
  app.whenReady().then(start);
}

function start() {
  const dir = process.env.STUDY_WIDGETS_DIR || app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  paths = { dir, config: path.join(dir, 'widgets.json'), state: path.join(dir, 'state.json') };
  if (!fs.existsSync(paths.config)) C.writeJson(paths.config, C.DEFAULT_CONFIG);
  config = C.sanitizeConfig(C.readJson(paths.config, C.DEFAULT_CONFIG));
  state = C.sanitizeState(C.readJson(paths.state, {}));

  // Present as plain Chrome so sign-in pages treat the widget like a normal browser.
  const ua = session.defaultSession.getUserAgent().replace(/\s(Electron|study-widgets|Study Widgets)\/\S+/gi, '');
  session.defaultSession.setUserAgent(ua);
  session.defaultSession.setPermissionRequestHandler((wc, permission, done) => {
    done(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'notifications'].includes(permission));
  });

  Menu.setApplicationMenu(appMenu());
  config.widgets.forEach((w, i) => createWidget(w, i));
  createTray();
  registerShortcut();
  applyLoginItem();
  watchConfig();

  ipcMain.on('widget:action', (e, act) => {
    const w = [...widgets.values()].find((x) => x.win.webContents === e.sender);
    if (w) handleAction(w, act);
  });
  ipcMain.handle('widget:hello', (e) => {
    const w = [...widgets.values()].find((x) => x.win.webContents === e.sender);
    return w ? toolbarState(w) : null;
  });

  if (SMOKE_DIR) runSmoke();
}

/* ---------------- widgets ---------------- */

function workAreas() {
  return screen.getAllDisplays().map((d) => d.workArea);
}

function createWidget(cfg, index) {
  const st = state.widgets[cfg.id] || (state.widgets[cfg.id] = { bounds: null, onTop: false, visible: true });
  const bounds = C.sanitizeBounds(st.bounds, workAreas()) || C.defaultBounds(index, screen.getPrimaryDisplay().workArea);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: C.MIN_W,
    minHeight: C.MIN_H,
    frame: false,
    show: false,
    title: cfg.name,
    alwaysOnTop: st.onTop,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#151D2D' : '#F1F3F7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const view = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.contentView.addChildView(view);
  const w = { cfg, win, view, loading: true, ready: false };
  widgets.set(cfg.id, w);

  win.loadFile(path.join(__dirname, 'toolbar.html'));
  layout(w);
  applyPin(w, st.onTop);
  wireContent(w);
  view.webContents.loadURL(cfg.url);

  win.on('resize', () => { layout(w); remember(w); });
  win.on('move', () => remember(w));
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    setVisible(w, false);
  });
  win.once('ready-to-show', () => {
    if (st.visible !== false) win.showInactive();
    refreshTrayMenu();
  });
  return w;
}

function layout(w) {
  const [width, height] = w.win.getContentSize();
  w.view.setBounds({ x: 0, y: TOOLBAR_H, width, height: Math.max(0, height - TOOLBAR_H) });
}

function wireContent(w) {
  const wc = w.view.webContents;
  wc.setZoomFactor(state.zoom);
  wc.setWindowOpenHandler(({ url }) => {
    // Sign-in popups stay in the app so the login lands in this app's session; every other link opens in your browser.
    if (C.isAuthUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, parent: w.win, autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } } };
    }
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (C.staysInWidget(w.cfg.url, url)) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  wc.on('did-start-loading', () => { w.loading = true; sendState(w); });
  wc.on('did-stop-loading', () => { w.loading = false; wc.setZoomFactor(state.zoom); sendState(w); });
  wc.on('did-navigate', () => sendState(w));
  wc.on('did-navigate-in-page', () => sendState(w));
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    const k = input.key;
    if (k === 'r' || k === 'R') { e.preventDefault(); handleAction(w, 'reload'); }
    else if (k === '=' || k === '+') { e.preventDefault(); handleAction(w, 'zoom-in'); }
    else if (k === '-' || k === '_') { e.preventDefault(); handleAction(w, 'zoom-out'); }
    else if (k === '0') { e.preventDefault(); handleAction(w, 'zoom-reset'); }
    else if (k === 'w' || k === 'W') { e.preventDefault(); setVisible(w, false); }
  });
}

function toolbarState(w) {
  let away = false;
  try {
    const cur = new URL(w.view.webContents.getURL());
    const home = new URL(w.cfg.url);
    away = !!w.view.webContents.getURL() && (cur.origin + cur.pathname) !== (home.origin + home.pathname);
  } catch (e) { /* not loaded yet */ }
  return { name: w.cfg.name, onTop: w.win.isAlwaysOnTop(), zoom: Math.round(state.zoom * 100), loading: w.loading, away, platform: process.platform };
}

function sendState(w) {
  if (!w.win.isDestroyed()) w.win.webContents.send('widget:state', toolbarState(w));
}

function handleAction(w, act) {
  const wc = w.view.webContents;
  if (act === 'pin') { applyPin(w, !w.win.isAlwaysOnTop()); remember(w); }
  else if (act === 'zoom-in' || act === 'zoom-out' || act === 'zoom-reset') {
    state.zoom = act === 'zoom-reset' ? C.DEFAULT_ZOOM : C.stepZoom(state.zoom, act === 'zoom-in' ? 1 : -1);
    // Chromium shares zoom across pages from the same site, so zoom is one setting for all widgets.
    widgets.forEach((x) => { x.view.webContents.setZoomFactor(state.zoom); sendState(x); });
    saveSoon();
  }
  else if (act === 'reload') wc.reload();
  else if (act === 'home') wc.loadURL(w.cfg.url);
  else if (act === 'browser') shell.openExternal(wc.getURL() || w.cfg.url);
  else if (act === 'hide') setVisible(w, false);
  sendState(w);
}

function applyPin(w, on) {
  w.win.setAlwaysOnTop(on, 'floating');
  if (process.platform === 'darwin') w.win.setVisibleOnAllWorkspaces(on, { visibleOnFullScreen: false });
  sendState(w);
}

function setVisible(w, on) {
  if (on) { w.win.show(); w.win.focus(); } else w.win.hide();
  state.widgets[w.cfg.id].visible = on;
  saveSoon();
  refreshTrayMenu();
}

function showAll() { widgets.forEach((w) => setVisible(w, true)); }
function hideAll() { widgets.forEach((w) => setVisible(w, false)); }
function toggleAll() {
  const anyVisible = [...widgets.values()].some((w) => w.win.isVisible());
  if (anyVisible) hideAll(); else showAll();
}

function remember(w) {
  if (w.win.isDestroyed() || w.win.isMinimized()) return;
  const st = state.widgets[w.cfg.id];
  st.bounds = w.win.getBounds();
  st.onTop = w.win.isAlwaysOnTop();
  saveSoon();
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function saveNow() {
  clearTimeout(saveTimer);
  try { C.writeJson(paths.state, state); } catch (e) { /* disk full or read-only: positions just aren't kept */ }
}

function resetPositions() {
  const wa = screen.getPrimaryDisplay().workArea;
  [...widgets.values()].forEach((w, i) => { w.win.setBounds(C.defaultBounds(i, wa)); setVisible(w, true); remember(w); });
}

/* ---------------- config file ---------------- */

function watchConfig() {
  let t = null;
  try {
    fs.watch(paths.dir, (ev, file) => {
      if (file !== path.basename(paths.config)) return;
      clearTimeout(t);
      t = setTimeout(reloadConfig, 300);
    });
  } catch (e) { /* watching unsupported: edits apply on next launch */ }
}

// Widgets added, renamed, re-pointed or removed in widgets.json apply without a restart.
function reloadConfig() {
  const next = C.sanitizeConfig(C.readJson(paths.config, null));
  if (!next.widgets.length) return;
  const keep = new Set(next.widgets.map((w) => w.id));
  widgets.forEach((w, id) => {
    if (keep.has(id)) return;
    w.win.destroy();
    widgets.delete(id);
  });
  next.widgets.forEach((cfg, i) => {
    const w = widgets.get(cfg.id);
    if (!w) { createWidget(cfg, i); return; }
    const moved = w.cfg.url !== cfg.url;
    w.cfg = cfg;
    w.win.setTitle(cfg.name);
    if (moved) w.view.webContents.loadURL(cfg.url);
    sendState(w);
  });
  const shortcutChanged = next.shortcut !== config.shortcut;
  const loginChanged = next.openAtLogin !== config.openAtLogin;
  config = next;
  if (shortcutChanged) registerShortcut();
  if (loginChanged) applyLoginItem();
  refreshTrayMenu();
}

function saveConfig() {
  try { C.writeJson(paths.config, config); } catch (e) { /* ignore */ }
}

function registerShortcut() {
  globalShortcut.unregisterAll();
  if (!config.shortcut) return;
  try { globalShortcut.register(config.shortcut, toggleAll); } catch (e) { /* invalid or taken: the tray menu still works */ }
}

function applyLoginItem() {
  if (process.platform === 'linux' || SMOKE_DIR) return;
  app.setLoginItemSettings({ openAtLogin: config.openAtLogin });
}

/* ---------------- tray + menus ---------------- */

function trayImage() {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(path.join(__dirname, 'icons', 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  return nativeImage.createFromPath(path.join(__dirname, 'icons', 'tray.png'));
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Study Widgets');
  if (process.platform === 'win32') tray.on('click', toggleAll);
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  const items = [...widgets.values()].map((w) => ({
    label: w.cfg.name, type: 'checkbox', checked: w.win.isVisible(), click: () => setVisible(w, !w.win.isVisible()),
  }));
  const shortcut = config.shortcut ? ` (${config.shortcut})` : '';
  tray.setContextMenu(Menu.buildFromTemplate([
    ...items,
    { type: 'separator' },
    { label: 'Show all' + shortcut, click: showAll },
    { label: 'Hide all', click: hideAll },
    { label: 'Put widgets back in place', click: resetPositions },
    { type: 'separator' },
    { label: 'Open at login', type: 'checkbox', checked: config.openAtLogin, visible: process.platform !== 'linux', click: (mi) => { config.openAtLogin = mi.checked; saveConfig(); applyLoginItem(); } },
    { label: 'Edit widget list…', click: () => shell.openPath(paths.config) },
    { type: 'separator' },
    { label: 'Quit Study Widgets', click: () => { quitting = true; app.quit(); } },
  ]));
}

// Frameless windows still need Edit menu roles for copy and paste shortcuts on macOS.
function appMenu() {
  const isMac = process.platform === 'darwin';
  return Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { label: 'Widgets', submenu: [
      { label: 'Show all', click: showAll },
      { label: 'Hide all', click: hideAll },
      { label: 'Put widgets back in place', click: resetPositions },
      { type: 'separator' },
      { label: 'Quit Study Widgets', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } },
    ] },
  ]);
}

app.on('before-quit', () => { quitting = true; saveNow(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* stay in the tray */ });
app.on('activate', () => showAll());

/* ---------------- smoke test (CI and local checks only) ---------------- */

async function runSmoke() {
  const out = SMOKE_DIR;
  const report = { widgets: [] };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settled = () => [...widgets.values()].every((w) => !w.loading);
  for (let i = 0; i < 60 && !settled(); i++) await wait(250);
  await wait(500);
  const list = [...widgets.values()];
  for (const w of list) {
    const before = toolbarState(w);
    await w.win.webContents.executeJavaScript('document.querySelector(\'[data-act="pin"]\').click()');
    await w.win.webContents.executeJavaScript('document.querySelector(\'[data-act="zoom-in"]\').click()');
    await wait(400);
    const after = toolbarState(w);
    const toolbarText = await w.win.webContents.executeJavaScript('document.getElementById("title").textContent + " | " + document.getElementById("zoom").textContent + " | pin=" + document.querySelector(\'[data-act="pin"]\').getAttribute("aria-pressed")');
    const top = await w.win.webContents.capturePage();
    const body = await w.view.webContents.capturePage();
    fs.writeFileSync(path.join(out, w.cfg.id + '-toolbar.png'), top.toPNG());
    fs.writeFileSync(path.join(out, w.cfg.id + '-content.png'), body.toPNG());
    report.widgets.push({ id: w.cfg.id, before, after, toolbarText, url: w.view.webContents.getURL(), bounds: w.win.getBounds(), view: w.view.getBounds(), visible: w.win.isVisible() });
  }
  // a link to another site must open outside the widget, not inside it
  const first = list[0];
  report.navBlocked = await new Promise((resolve) => {
    const orig = shell.openExternal;
    shell.openExternal = (u) => { shell.openExternal = orig; resolve(u); return Promise.resolve(); };
    first.view.webContents.executeJavaScript('location.href = "https://example.com/elsewhere"');
    setTimeout(() => { shell.openExternal = orig; resolve(null); }, 3000);
  });
  report.urlAfterNav = first.view.webContents.getURL();
  // hiding via the toolbar keeps the app alive and records it
  await first.win.webContents.executeJavaScript('document.querySelector(\'[data-act="hide"]\').click()');
  await wait(600);
  report.hiddenVisible = first.win.isVisible();
  saveNow();
  report.state = C.readJson(paths.state, null);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  quitting = true;
  app.quit();
}
