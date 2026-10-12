'use strict';
// Plain helpers for the widget list and saved window state. No Electron imports, so they can be unit tested.

const fs = require('fs');

const DEFAULT_WIDGETS = [
  { id: 'dashboard', name: "Paul's Dashboard", url: 'https://claude.ai/artifact/VcqFy2By7LXfXmDorGT9FA' },
  { id: 'hub', name: 'Academic Hub', url: 'https://claude.ai/artifact/UMknkvH5BzFV5C1NGveuoT' },
];
const DEFAULT_CONFIG = { widgets: DEFAULT_WIDGETS, shortcut: 'Alt+Shift+W', openAtLogin: false };

const MIN_W = 300;
const MIN_H = 220;
const ZOOMS = [0.5, 0.6, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];
const DEFAULT_ZOOM = 0.8;

// Pages that may load inside a widget besides the widget's own site: signing in to Claude.
const AUTH_HOSTS = ['claude.ai', 'anthropic.com', 'accounts.google.com', 'appleid.apple.com'];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

// https anywhere; plain http only for pages served from this computer.
function okProtocol(url) {
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname));
}

function cleanUrl(u) {
  try {
    const url = new URL(String(u));
    return okProtocol(url) ? url.toString() : null;
  } catch (e) {
    return null;
  }
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Keep only widgets with a name and a usable address; ids are unique.
function sanitizeConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(src.widgets) ? src.widgets : DEFAULT_WIDGETS;
  const seen = new Set();
  const widgets = [];
  list.forEach((w) => {
    if (!w || typeof w !== 'object') return;
    const url = cleanUrl(w.url);
    const name = String(w.name || '').trim().slice(0, 60);
    if (!url || !name) return;
    let id = slug(w.id || name) || 'widget';
    while (seen.has(id)) id += '-2';
    seen.add(id);
    widgets.push({ id, name, url });
  });
  return {
    widgets,
    shortcut: typeof src.shortcut === 'string' ? src.shortcut.trim() : DEFAULT_CONFIG.shortcut,
    openAtLogin: !!src.openAtLogin,
  };
}

function sanitizeState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const zoom = ZOOMS.includes(src.zoom) ? src.zoom : DEFAULT_ZOOM;
  const widgets = {};
  if (src.widgets && typeof src.widgets === 'object') {
    Object.keys(src.widgets).forEach((id) => {
      const w = src.widgets[id] || {};
      widgets[id] = { bounds: w.bounds || null, onTop: !!w.onTop, visible: w.visible !== false };
    });
  }
  return { zoom, widgets };
}

function intersect(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? { w, h } : null;
}

// Saved bounds are kept only if the title bar is still reachable on some screen.
function sanitizeBounds(b, workAreas) {
  if (!b || !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k]))) return null;
  const out = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_W, Math.round(b.width)), height: Math.max(MIN_H, Math.round(b.height)) };
  const titleBar = { x: out.x, y: out.y, width: out.width, height: 34 };
  const ok = (workAreas || []).some((wa) => {
    const i = intersect(titleBar, wa);
    return i && i.w >= 80 && i.h >= 20;
  });
  return ok ? out : null;
}

// Widgets line up from the right edge of the screen, tallest first.
function defaultBounds(index, wa) {
  const width = Math.min(480, Math.max(MIN_W, Math.floor((wa.width - 48) / 2)));
  const height = Math.max(MIN_H, Math.min(index === 0 ? 780 : 680, wa.height - 48));
  const x = Math.max(wa.x + 16, wa.x + wa.width - (index + 1) * (width + 16));
  return { x, y: wa.y + 24 + (index % 2) * 24, width, height };
}

function hostMatches(host, list) {
  return list.some((d) => host === d || host.endsWith('.' + d));
}

function isAuthUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && hostMatches(url.hostname, AUTH_HOSTS);
  } catch (e) {
    return false;
  }
}

// A widget may move around its own site and the sign-in pages; anything else opens in the browser.
function staysInWidget(widgetUrl, u) {
  try {
    const target = new URL(u);
    if (!okProtocol(target)) return false;
    return target.origin === new URL(widgetUrl).origin || isAuthUrl(u);
  } catch (e) {
    return false;
  }
}

function stepZoom(z, dir) {
  const i = ZOOMS.indexOf(z) === -1 ? ZOOMS.indexOf(DEFAULT_ZOOM) : ZOOMS.indexOf(z);
  return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
}

module.exports = {
  DEFAULT_CONFIG, DEFAULT_WIDGETS, DEFAULT_ZOOM, ZOOMS, MIN_W, MIN_H,
  readJson, writeJson, sanitizeConfig, sanitizeState, sanitizeBounds, defaultBounds,
  isAuthUrl, staysInWidget, stepZoom,
};
