'use strict';
// Launch test: starts the real app against a local page, exercises the title bar, and checks what it saved.
// Usage: npm run smoke   (on Linux without a display it runs under xvfb-run)

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');
const electronPath = require('electron');

const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'));
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(fixture); });

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-widgets-'));
  const out = process.env.SMOKE_OUT || path.join(dir, 'out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(dir, 'widgets.json'), JSON.stringify({
    widgets: [
      { id: 'dashboard', name: "Paul's Dashboard", url: `http://127.0.0.1:${port}/dashboard` },
      { id: 'hub', name: 'Academic Hub', url: `http://127.0.0.1:${port}/hub` },
    ],
    shortcut: '',
    openAtLogin: false,
  }));

  const appDir = path.join(__dirname, '..');
  let cmd = electronPath;
  let args = [appDir];
  if (process.platform === 'linux') {
    args.unshift('--no-sandbox');
    if (!process.env.DISPLAY) { args = ['-a', cmd, ...args]; cmd = 'xvfb-run'; }
  }
  const child = spawn(cmd, args, { env: { ...process.env, STUDY_WIDGETS_DIR: dir, STUDY_WIDGETS_SMOKE: out }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const killer = setTimeout(() => { child.kill('SIGKILL'); }, 60000);

  child.on('exit', (code) => {
    clearTimeout(killer);
    server.close();
    let report;
    try { report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')); } catch (e) {
      console.error('No report. Exit code', code, '\n', log.slice(-3000));
      process.exit(1);
    }
    try {
      assert.strictEqual(report.widgets.length, 2, 'two widgets');
      report.widgets.forEach((w) => {
        assert.ok(w.visible, w.id + ' visible');
        assert.ok(w.url.includes('/' + w.id), w.id + ' loaded its page');
        assert.strictEqual(w.before.onTop, false);
        assert.strictEqual(w.after.onTop, true, w.id + ' pinned by the title bar');
        assert.strictEqual(w.view.y, 34, 'page sits under the title bar');
        assert.strictEqual(w.view.height, w.bounds.height - 34);
        assert.ok(fs.statSync(path.join(out, w.id + '-content.png')).size > 1000, w.id + ' rendered');
      });
      assert.strictEqual(report.widgets[0].after.zoom, 90, 'zoom in from 80% to 90%');
      assert.strictEqual(report.widgets[1].after.zoom, 100, 'second zoom in reaches 100%, shared across widgets');
      assert.ok(/Paul's Dashboard \| 90% \| pin=true/.test(report.widgets[0].toolbarText), 'title bar shows state: ' + report.widgets[0].toolbarText);
      assert.strictEqual(report.navBlocked, 'https://example.com/elsewhere', 'other sites open in the browser');
      assert.ok(report.urlAfterNav.includes('/dashboard'), 'widget stayed on its page');
      assert.strictEqual(report.hiddenVisible, false, 'hide button hides');
      assert.strictEqual(report.state.widgets.dashboard.visible, false, 'hidden state saved');
      assert.strictEqual(report.state.widgets.hub.onTop, true, 'pin saved');
      assert.ok(report.state.widgets.hub.bounds && report.state.widgets.hub.bounds.width >= 300, 'bounds saved');
      assert.strictEqual(report.state.zoom, 1, 'zoom saved');
    } catch (e) {
      console.error('FAIL:', e.message, '\n', JSON.stringify(report, null, 2));
      process.exit(1);
    }
    console.log('Smoke test passed. Screenshots in', out);
    report.widgets.forEach((w) => console.log(' ', w.id, JSON.stringify(w.bounds), w.toolbarText));
  });
});
