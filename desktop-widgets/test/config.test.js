'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/config');

test('defaults are the dashboard and the Academic Hub', () => {
  const cfg = C.sanitizeConfig(C.DEFAULT_CONFIG);
  assert.deepStrictEqual(cfg.widgets.map((w) => w.id), ['dashboard', 'hub']);
  assert.ok(cfg.widgets.every((w) => w.url.startsWith('https://claude.ai/artifact/')));
  assert.strictEqual(cfg.shortcut, 'Alt+Shift+W');
});

test('bad widget entries are dropped and ids stay unique', () => {
  const cfg = C.sanitizeConfig({ widgets: [
    { name: 'Chem Bench', url: 'https://claude.ai/artifact/abc' },
    { name: 'Chem Bench', url: 'https://claude.ai/artifact/def' },
    { name: 'No address' },
    { name: 'Plain http', url: 'http://example.com' },
    { name: 'Local dev', url: 'http://localhost:5173/' },
    { name: '', url: 'https://claude.ai/x' },
    null,
  ] });
  assert.deepStrictEqual(cfg.widgets.map((w) => w.id), ['chem-bench', 'chem-bench-2', 'local-dev']);
});

test('a missing widget list falls back to the defaults', () => {
  assert.strictEqual(C.sanitizeConfig({}).widgets.length, 2);
  assert.strictEqual(C.sanitizeConfig(null).widgets.length, 2);
});

test('saved bounds survive only when the title bar is on a screen', () => {
  const screens = [{ x: 0, y: 0, width: 1440, height: 900 }];
  assert.deepStrictEqual(C.sanitizeBounds({ x: 900, y: 40, width: 480, height: 700 }, screens), { x: 900, y: 40, width: 480, height: 700 });
  assert.strictEqual(C.sanitizeBounds({ x: 3000, y: 40, width: 480, height: 700 }, screens), null);
  assert.strictEqual(C.sanitizeBounds({ x: 100, y: -200, width: 480, height: 700 }, screens), null);
  assert.strictEqual(C.sanitizeBounds({ x: 'a', y: 0, width: 1, height: 1 }, screens), null);
  assert.strictEqual(C.sanitizeBounds({ x: 10, y: 10, width: 50, height: 50 }, screens).width, C.MIN_W);
  // a second monitor to the left counts
  assert.ok(C.sanitizeBounds({ x: -1200, y: 100, width: 480, height: 600 }, screens.concat([{ x: -1920, y: 0, width: 1920, height: 1080 }])));
});

test('default layout puts widgets side by side from the right edge', () => {
  const wa = { x: 0, y: 25, width: 1440, height: 875 };
  const a = C.defaultBounds(0, wa), b = C.defaultBounds(1, wa);
  assert.ok(a.x > b.x && a.x + a.width <= wa.width);
  assert.ok(b.x >= 16 && a.y >= wa.y);
  const tiny = C.defaultBounds(1, { x: 0, y: 0, width: 700, height: 500 });
  assert.ok(tiny.x >= 16 && tiny.width >= C.MIN_W && tiny.height <= 500);
});

test('only Claude sign-in and the widget site load inside a widget', () => {
  const home = 'https://claude.ai/artifact/VcqFy2By7LXfXmDorGT9FA';
  assert.ok(C.staysInWidget(home, 'https://claude.ai/login'));
  assert.ok(C.staysInWidget(home, 'https://accounts.google.com/o/oauth2/v2/auth'));
  assert.ok(!C.staysInWidget(home, 'https://coc.instructure.com/'));
  assert.ok(!C.staysInWidget(home, 'https://www.biblegateway.com/passage/?search=John+3'));
  assert.ok(!C.staysInWidget(home, 'https://claude.ai.evil.example/'));
  assert.ok(!C.staysInWidget(home, 'javascript:alert(1)'));
  assert.ok(C.isAuthUrl('https://www.anthropic.com/'));
  assert.ok(!C.isAuthUrl('http://claude.ai/'));
});

test('zoom steps stay within range', () => {
  assert.strictEqual(C.stepZoom(0.8, 1), 0.9);
  assert.strictEqual(C.stepZoom(0.5, -1), 0.5);
  assert.strictEqual(C.stepZoom(1.5, 1), 1.5);
  assert.strictEqual(C.stepZoom(0.33, 1), 0.9);
  assert.strictEqual(C.sanitizeState({ zoom: 7 }).zoom, C.DEFAULT_ZOOM);
});
