'use strict';
/* Memorize: a mastery system for the facts each chapter expects you to know cold.
   Every item climbs six levels. New → Learning (seen it) → Familiar → Known → Strong → Mastered.
   A level is earned only by answering when the item is due, so mastery means recalling it correctly
   on four separate days spread over about two weeks. A miss drops the item back to Learning.
   Levels 0–1 ask multiple choice (recognize it); level 2 and up ask you to produce the answer:
   typed for short answers, recall-then-reveal for longer ones. */

const MEM_LEVELS = ['New', 'Learning', 'Familiar', 'Known', 'Strong', 'Mastered'];
const MEM_DAYS = [0, 0, 1, 3, 7, 21];
const MEM_KEEP = 45; // days between checks once mastered
const MEM_SESSION = 20;

/* ---------- text matching ---------- */
const MEM_SS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-' };
const MEM_SS_RE = new RegExp('[' + Object.keys(MEM_SS).join('') + ']', 'g');
function memText(h) {
  h = String(h);
  if (!/[<&]/.test(h)) return h;
  const d = document.createElement('div'); d.innerHTML = h; return d.textContent;
}
function memNorm(s, cs) {
  s = memText(s).replace(MEM_SS_RE, c => MEM_SS[c]).replace(/[−–—]/g, '-').replace(/[×✕]/g, 'x').replace(/μ/g, 'µ').replace(/\s+ions?$/i, '');
  s = s.replace(/[\s^_()[\]·*≈~°'’]/g, '');
  if (!cs) s = s.toLowerCase();
  return s.replace(/x10(-?\d+)/g, 'e$1');
}
function memAccepts(it) {
  if (it.acc) return it.acc;
  const out = new Set([memNorm(it.aH, it.cs)]);
  (it.alt || []).forEach(a => out.add(memNorm(a, it.cs)));
  const plain = memText(it.aH).trim();
  const paren = !/[=/]/.test(plain) && plain.match(/^(.+?)\s*\((.+)\)$/);
  if (paren && /[a-z]/i.test(paren[1] + paren[2])) { out.add(memNorm(paren[1], it.cs)); out.add(memNorm(paren[2], it.cs)); }
  const num = plain.match(/^([-−]?[\d.,]+(?:\s*×\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)\s+[^\s\d]/);
  if (num) out.add(memNorm(num[1], false));
  if (/^[a-z]+-$/i.test(plain)) out.add(memNorm(plain.slice(0, -1), it.cs));
  out.forEach(a => { if (a.includes(',')) out.add(a.replace(/,/g, '')); });
  return (it.acc = out);
}

/* ---------- items ---------- */
const MEM_ITEMS = [];
const MEM_BY_LAB = {};
function memBuild() {
  if (MEM_ITEMS.length) return;
  Object.entries(MEM).forEach(([labId, groups]) => {
    const list = MEM_BY_LAB[labId] = [];
    groups.forEach((gr, gi) => gr.items.forEach(([q, a, note, alt]) => {
      const aObj = typeof a === 'object' ? a : { h: a, alt: [] };
      const base = { lab: labId, gi, group: gr.name, note: note || '' };
      list.push({ ...base, id: labId + '|' + gr.name + '|' + memText(q), dir: 0, q, aH: aObj.h, alt: (aObj.alt || []).concat(alt || []), cs: !!(aObj.f || gr.cs), cue: gr.cue, self: !!gr.self });
      if (gr.both) list.push({ ...base, id: labId + '|' + gr.name + '|' + memText(aObj.h) + '|r', dir: 1, q: aObj.h, aH: q, alt: [], cs: false, cue: gr.rcue || 'Answer', self: !!gr.self });
    }));
    MEM_ITEMS.push(...list);
  });
}
const memLab = id => LABS.find(l => l.id === id);
const memState = () => Store.bag('mem');
const memLevel = it => (memState()[it.id] || { l: 0 }).l;
const memIsDue = (it, now = Date.now()) => { const s = memState()[it.id]; return !!s && s.l >= 1 && s.d <= now; };
const memTypable = it => !it.self && memText(it.aH).length <= 22;
function memStats(items) {
  const c = [0, 0, 0, 0, 0, 0], now = Date.now(); let due = 0;
  items.forEach(it => { c[memLevel(it)]++; if (memIsDue(it, now)) due++; });
  return { counts: c, total: items.length, mastered: c[5], due, fresh: c[0], started: items.length - c[0] };
}
function memBar(st, label) {
  const segs = [5, 4, 3, 2, 1].map(l => st.counts[l] ? `<i class="mb-l${l}" style="width:${st.counts[l] / st.total * 100}%" title="${MEM_LEVELS[l]}: ${st.counts[l]}"></i>` : '').join('');
  return `<span class="mem-bar" role="img" aria-label="${U.esc(label || `${st.mastered} of ${st.total} mastered`)}">${segs}</span>`;
}
function memLegend() {
  return `<div class="mem-legend">${MEM_LEVELS.map((n, l) => `<span><i class="mb-l${l}"></i>${n}${l >= 2 ? ` <em>${MEM_DAYS[l]}d</em>` : ''}</span>`).join('')}</div>`;
}
const memLabsInOrder = () => LABS.filter(l => MEM[l.id]);

/* ---------- home + lab hooks ---------- */
function memSummaryHTML() {
  memBuild();
  const st = memStats(MEM_ITEMS);
  return `<a class="review-cta mem-cta" href="#memorize"><span class="rc-k">Memorize</span><b>${st.due ? `${st.due} fact${st.due === 1 ? '' : 's'} due` : st.started ? 'Nothing due right now' : 'Start memorizing'}</b>
    <span class="rc-sub">Ions, symbols, prefixes, conversions, rules and formulas for every chapter. ${st.mastered} of ${st.total} mastered.</span>
    <span class="rc-streak">${Math.round(st.mastered / st.total * 100)}% mastered</span></a>`;
}
function memRailHTML(lab) {
  if (!MEM[lab.id]) return '';
  memBuild();
  const st = memStats(MEM_BY_LAB[lab.id]);
  return `<section class="mem-rail" aria-labelledby="memr-h"><h2 id="memr-h">Memorize</h2>
    <a class="mem-rail-link" href="#mem-${lab.id}"><b>${st.total} facts for this chapter</b>${memBar(st)}<span class="note">${st.mastered} mastered · ${st.due} due · ${st.fresh} new</span><span class="mr-go">${st.started ? 'Study' : 'Start'} →</span></a></section>`;
}

/* ---------- session ---------- */
function memPlan(items, cram) {
  const S = memState(), now = Date.now();
  if (cram) {
    const pool = U.shuffle(items).sort((a, b) => memLevel(a) - memLevel(b) || ((S[b.id] || {}).m || 0) - ((S[a.id] || {}).m || 0)).slice(0, MEM_SESSION);
    return pool.map(it => ({ it, kind: S[it.id] ? 'ask' : 'intro' }));
  }
  const due = U.shuffle(items.filter(it => memIsDue(it, now))).slice(0, MEM_SESSION);
  const fresh = items.filter(it => !S[it.id]).slice(0, Math.min(due.length >= 14 ? 3 : due.length >= 7 ? 6 : 10, MEM_SESSION - due.length));
  const steps = [];
  while (due.length || fresh.length) {
    if (fresh.length && (steps.length % 3 === 0 || !due.length)) steps.push({ it: fresh.shift(), kind: 'intro' });
    else steps.push({ it: due.shift(), kind: 'ask' });
  }
  return steps;
}
function memChoices(it) {
  const pool = MEM_BY_LAB[it.lab].filter(o => o.dir === it.dir);
  const same = pool.filter(o => o.gi === it.gi), right = memText(it.aH).trim(), seen = new Set([right]), out = [];
  for (const src of [U.shuffle(same), U.shuffle(pool)]) for (const o of src) {
    const t = memText(o.aH).trim();
    if (out.length < 3 && !seen.has(t)) { seen.add(t); out.push(o.aH); }
  }
  const all = U.shuffle([it.aH, ...out]);
  return { all, ans: all.indexOf(it.aH) };
}
function memGrade(it, ok, cram) {
  const S = memState(), now = Date.now();
  const s = S[it.id] || (S[it.id] = { l: 1, d: now, n: 0, m: 0 });
  const before = s.l;
  if (ok) {
    s.n++;
    if (s.d <= now) {
      const kept = s.l >= 5;
      s.l = Math.min(5, s.l + 1);
      const days = kept ? MEM_KEEP : MEM_DAYS[s.l];
      s.d = days ? now + days * 864e5 - 4 * 3600e3 : now;
    }
  } else { s.m++; s.l = 1; s.d = now; }
  Store.save();
  return { before, after: s.l };
}

function memRunSession(app, items, opts) {
  memBuild();
  const { title, back, backLabel, cram } = opts;
  const q = memPlan(items, cram);
  if (!q.length) { opts.empty(); return; }
  let cur = 0, results = [], retries = {}, keyHandler = null;
  const S = memState();
  function head() {
    const pct = Math.round(cur / q.length * 100);
    return `<div class="mem-top"><a href="${back}" class="mem-x">← ${backLabel}</a><span class="note">${title}${cram ? ' · cram' : ''}</span><span class="mem-count">${Math.min(cur + 1, q.length)} / ${q.length}</span></div>
      <div class="mem-prog"><i style="width:${pct}%"></i></div>`;
  }
  const wireBack = () => app.querySelectorAll(`a[href="${back}"]`).forEach(a => a.addEventListener('click', e => { if (location.hash === back) { e.preventDefault(); route(); } }));
  function chTagOf(it) { const l = memLab(it.lab); return l ? `${chTag(l)} · ${it.group}` : it.group; }
  function step() {
    keyHandler = null;
    if (cur >= q.length) return finish();
    const { it, kind } = q[cur], lab = memLab(it.lab), lvl = memLevel(it);
    const fam = lab ? lab.fam : 'found';
    if (kind === 'intro') {
      app.innerHTML = head() + `<article class="mem-card fam-${fam} intro">
        <div class="mem-meta"><span class="pill on">New</span><span class="note">${chTagOf(it)}</span></div>
        <p class="mem-cue">${it.cue}</p>
        <div class="mem-q">${it.q}</div>
        <div class="mem-a">${it.aH}</div>
        ${it.note ? `<p class="mem-note">${it.note}</p>` : ''}
        <p class="note">Read it, say it out loud, then picture it with your eyes closed. You'll be asked in a moment.</p>
        <div class="prow"><span></span><button type="button" class="btn primary" id="mem-go">Got it →</button></div></article>`;
      const go = () => {
        if (!S[it.id]) { S[it.id] = { l: 1, d: Date.now(), n: 0, m: 0 }; Store.save(); }
        q.splice(Math.min(q.length, cur + 3), 0, { it, kind: 'ask' });
        cur++; step();
      };
      wireBack();
      app.querySelector('#mem-go').addEventListener('click', go); app.querySelector('#mem-go').focus();
      keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      return;
    }
    const mode = lvl <= 1 ? 'mc' : memTypable(it) ? 'type' : 'self';
    let body = '';
    if (mode === 'mc') {
      const { all, ans } = memChoices(it); q[cur].mc = { all, ans };
      body = `<div class="choices mem-choices">${all.map((c, k) => `<button type="button" class="choice" data-c="${k}"><span class="kn">${k + 1}</span>${c}</button>`).join('')}</div>`;
    } else if (mode === 'type') {
      body = `<form class="ans" novalidate><input id="mem-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type the answer" aria-label="Your answer"><button class="btn primary" type="submit">Check</button></form>
        <p class="note mem-tiny">${it.cs ? 'Capitals count. Type charges like SO4 2- or SO4^2-. ' : ''}<button type="button" class="linkbtn" id="mem-idk">I don't know</button></p>`;
    } else {
      body = `<p class="note">Say or write the answer first, then check yourself honestly.</p><div class="prow"><span></span><button type="button" class="btn primary" id="mem-show">Show answer</button></div>`;
    }
    app.innerHTML = head() + `<article class="mem-card fam-${fam}">
      <div class="mem-meta"><span class="pill lv${lvl}">${MEM_LEVELS[lvl]}</span><span class="note">${chTagOf(it)}</span></div>
      <p class="mem-cue">${it.cue}</p>
      <div class="mem-q">${it.q}</div>
      <div class="mem-body">${body}</div>
      <div class="fb" hidden></div>
      <div class="prow mem-next" hidden><span></span><button type="button" class="btn primary" id="mem-next">Next →</button></div></article>`;
    wireBack();
    const fb = app.querySelector('.fb'), nextRow = app.querySelector('.mem-next');
    let done = false;
    const finishAsk = (ok, extra = '') => {
      if (done) return; done = true;
      const r = memGrade(it, ok, cram);
      results.push({ it, ok, ...r });
      if (!ok && (retries[it.id] || 0) < 2) { retries[it.id] = (retries[it.id] || 0) + 1; q.splice(Math.min(q.length, cur + 4), 0, { it, kind: 'ask' }); }
      fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
      const moved = r.after > r.before ? `<span class="pill good">Level up: ${MEM_LEVELS[r.after]}${r.after === 5 ? ' ★' : ''}</span>` : !ok ? `<span class="pill bad">Back to Learning</span>` : '';
      fb.innerHTML = `<div class="verdict">${ok ? 'Correct' : 'Not yet'} ${moved}</div>${mode === 'self' || (ok && mode === 'mc') ? '' : `<div class="answer">Answer: <b>${it.aH}</b></div>`}${it.note ? `<div class="explain">${it.note}</div>` : ''}${extra}`;
      nextRow.hidden = false;
      const nb = app.querySelector('#mem-next'); nb.focus();
      nb.addEventListener('click', () => { cur++; step(); });
      const ov = fb.querySelector('#mem-ov');
      if (ov) ov.addEventListener('click', () => {
        // undo the miss: restore state, then grade as correct
        const s = memState()[it.id]; s.m = Math.max(0, s.m - 1); s.l = r.before; s.d = 0;
        results.pop(); if (retries[it.id]) { retries[it.id]--; const k = q.findIndex((x, j) => j > cur && x.it === it); if (k > -1) q.splice(k, 1); }
        done = false; finishAsk(true);
      });
      keyHandler = e => { if (e.key === 'Enter' && !e.target.matches('button')) { e.preventDefault(); cur++; step(); } };
    };
    if (mode === 'mc') {
      const { ans } = q[cur].mc;
      const pick = k => {
        if (done) return;
        const btns = app.querySelectorAll('.mem-choices .choice'), ok = k === ans;
        btns[k].classList.add(ok ? 'right' : 'wrong'); if (!ok) btns[ans].classList.add('right');
        btns.forEach(b => { b.disabled = true; });
        finishAsk(ok);
      };
      app.querySelector('.mem-choices').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) pick(+b.dataset.c); });
      keyHandler = e => { if (/^[1-4]$/.test(e.key)) pick(+e.key - 1); };
    } else if (mode === 'type') {
      const form = app.querySelector('form'), inp = app.querySelector('#mem-in');
      inp.focus();
      let warned = false;
      form.addEventListener('submit', e => {
        e.preventDefault();
        const v = inp.value.trim(); if (!v || done) return;
        const acc = memAccepts(it), ok = acc.has(memNorm(v, it.cs));
        if (!ok && it.cs && !warned && [...acc].some(a => a.toLowerCase() === memNorm(v, false))) {
          warned = true; fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = '<div class="verdict">Check your capitals</div><div class="explain">Symbols and formulas are case-sensitive: Co is cobalt, CO is carbon monoxide. Try again.</div>'; inp.select(); return;
        }
        inp.disabled = true; form.querySelector('button').disabled = true;
        finishAsk(ok, ok ? '' : `<div class="explain">You wrote: <b>${U.esc(v)}</b>. <button type="button" class="linkbtn" id="mem-ov">I was right, count it</button></div>`);
      });
      app.querySelector('#mem-idk').addEventListener('click', () => { inp.disabled = true; form.querySelector('button').disabled = true; finishAsk(false); });
    } else {
      const show = () => {
        if (done || app.querySelector('#mem-knew')) return;
        app.querySelector('.mem-body').innerHTML = `<div class="mem-a">${it.aH}</div>${it.note ? `<p class="mem-note">${it.note}</p>` : ''}
          <div class="btn-row mem-self"><button type="button" class="btn" id="mem-miss">Missed it <kbd>←</kbd></button><button type="button" class="btn primary" id="mem-knew">Knew it <kbd>→</kbd></button></div>`;
        const grade = ok => { app.querySelector('.mem-self').remove(); app.querySelector('.mem-body .mem-note')?.remove(); finishAsk(ok); };
        app.querySelector('#mem-knew').addEventListener('click', () => grade(true));
        app.querySelector('#mem-miss').addEventListener('click', () => grade(false));
        app.querySelector('#mem-knew').focus();
        keyHandler = e => { if (e.key === 'ArrowRight') grade(true); else if (e.key === 'ArrowLeft') grade(false); };
      };
      app.querySelector('#mem-show').addEventListener('click', show); app.querySelector('#mem-show').focus();
      keyHandler = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(); } };
    }
  }
  function finish() {
    const right = results.filter(r => r.ok).length, ups = results.filter(r => r.after > r.before).length;
    const newlyMastered = new Set(results.filter(r => r.after === 5 && r.before < 5).map(r => r.it.id)).size;
    const missed = [...new Map(results.filter(r => !r.ok).map(r => [r.it.id, r.it])).values()];
    const st = memStats(items);
    app.innerHTML = head() + `<article class="mem-card done">
      <p class="mem-cue">Session complete</p>
      <div class="hero-stats mem-stats"><div><b>${right}/${results.length}</b><span>correct</span></div><div><b>${ups}</b><span>level-ups</span></div><div><b>${newlyMastered}</b><span>newly mastered</span></div></div>
      ${memBar(st)}${memLegend()}
      <p class="note">${st.mastered} of ${st.total} mastered here. ${st.due ? `${st.due} still due.` : 'Nothing else is due here: come back tomorrow, when the items you learned today are ready for their first recall.'}</p>
      ${missed.length ? `<h3>Review these</h3><table class="t mem-missed">${missed.map(it => `<tr><td>${it.q}</td><td>${it.aH}</td></tr>`).join('')}</table>` : ''}
      <div class="btn-row"><button type="button" class="btn primary" id="mem-again">Keep going</button><a class="btn" href="${back}">${backLabel}</a></div></article>`;
    wireBack();
    app.querySelector('#mem-again').addEventListener('click', () => memRunSession(app, items, { ...opts, cram: !memPlan(items, false).length || cram }));
  }
  const onKey = e => { if (keyHandler && !(e.target.matches('input') && e.key !== 'Enter')) keyHandler(e); };
  document.addEventListener('keydown', onKey);
  opts.setCleanup(() => document.removeEventListener('keydown', onKey));
  step();
}

/* ---------- pages ---------- */
function memIntroHTML() {
  return `<details class="mem-how"><summary>How mastery works</summary>
    <ol>
      <li><b>Learn.</b> New facts are introduced a few at a time with a memory hook, then checked a minute later with multiple choice.</li>
      <li><b>Recall.</b> From level 2 on, you have to produce the answer: type it, or say it before revealing. Recall is what builds memory; recognition alone does not.</li>
      <li><b>Space.</b> Each correct recall pushes the fact further out: 1 day, 3 days, 7 days, then 21 days. A fact is <b>Mastered</b> only after you recall it correctly on four separate days spread over about two weeks.</li>
      <li><b>Repair.</b> A miss drops the fact back to Learning, and it comes back twice more in the same session.</li>
    </ol>
    <p class="note">Ten minutes a day beats an hour the night before. Use <b>Cram</b> before a quiz: it drills your weakest facts right now without changing the schedule unless you miss.</p></details>`;
}
let memCleanup = null;
function memPageCleanup(fn) { if (memCleanup) memCleanup(); memCleanup = fn; }
function memSetupPage() { memBuild(); return () => { if (memCleanup) { memCleanup(); memCleanup = null; } }; }

registerPage('memorize', {
  title: 'Memorize',
  render(app) {
    const off = memSetupPage();
    const labs = memLabsInOrder();
    const all = memStats(MEM_ITEMS);
    const start = (cram) => memRunSession(app, MEM_ITEMS, { title: 'All chapters', back: '#memorize', backLabel: 'Memorize', cram, setCleanup: memPageCleanup, empty: () => { location.hash = 'memorize'; } });
    app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Mastery system</p><h1>Memorize</h1><p class="lede">Everything your course expects you to know by heart, chapter by chapter: element symbols, ion charges, polyatomic ions, prefixes, conversion factors, rules and formulas. Each fact climbs to Mastered through spaced recall.</p></div></div>
      <section class="panel-card mem-overview">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div><div class="readout">${all.due ? `${all.due} due now` : all.started ? 'All caught up' : `${all.total} facts`}</div><p class="note">${all.mastered} mastered · ${all.started - all.mastered} in progress · ${all.fresh} not started</p></div>
          <div class="btn-row">${all.due ? '<button type="button" class="btn primary" id="mem-due">Review everything due</button>' : ''}</div>
        </div>
        ${memBar(all)}${memLegend()}
      </section>
      ${memIntroHTML()}
      <h2 class="mem-h">Chapters</h2>
      <div class="mem-grid">${labs.map(l => {
        const st = memStats(MEM_BY_LAB[l.id]);
        return `<a class="mem-chap fam-${l.fam}" href="#mem-${l.id}"><span class="mc-tag">${chTag(l)}</span><b>${l.title}</b><span class="note">${MEM[l.id].map(gr => gr.name).slice(0, 4).join(' · ')}${MEM[l.id].length > 4 ? ' …' : ''}</span>${memBar(st)}<span class="mc-foot"><span>${st.mastered}/${st.total} mastered</span>${st.due ? `<span class="pill bad">${st.due} due</span>` : st.fresh === st.total ? '<span class="pill">Not started</span>' : st.mastered === st.total ? '<span class="pill good">★ Mastered</span>' : ''}</span></a>`;
      }).join('')}</div>`;
    const b = app.querySelector('#mem-due'); if (b) b.addEventListener('click', () => start(false));
    return off;
  },
});
registerPage('cards', { title: 'Memorize', render: app => PAGES.memorize.render(app) });

Object.keys(MEM).forEach(labId => registerPage('mem-' + labId, {
  get title() { const l = memLab(labId); return 'Memorize · ' + (l ? l.title : labId); },
  render(app) {
    const off = memSetupPage();
    const lab = memLab(labId), items = MEM_BY_LAB[labId];
    let hide = false;
    const run = (cram, gi) => {
      const set = gi == null ? items : items.filter(it => it.gi === gi);
      memRunSession(app, set, { title: `${chTag(lab)} · ${gi == null ? lab.title : MEM[labId][gi].name}`, back: '#mem-' + labId, backLabel: lab.title, cram, setCleanup: memPageCleanup, empty: () => run(true, gi) });
    };
    function draw() {
      const st = memStats(items);
      const fwd = items.filter(it => it.dir === 0);
      app.innerHTML = `<div class="lab-head">${tileHTML(lab, true)}<div class="lab-title"><p class="eyebrow"><a href="#memorize">Memorize</a> · ${lab.code ? 'Gen Chem Bridge ' + lab.code : 'Chapter ' + lab.ch}</p><h1>${lab.title}</h1><p class="lede">${st.total} facts to know by heart for this chapter. Study adds a few new facts each session and brings back the ones that are due.</p></div></div>
        <section class="panel-card mem-overview fam-${lab.fam}">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div><div class="readout">${st.mastered}/${st.total} mastered</div><p class="note">${st.due} due · ${st.fresh} new · ${st.started - st.mastered} in progress</p></div>
            <div class="btn-row"><button type="button" class="btn primary" id="mem-study">${st.due && st.fresh ? `Study: ${Math.min(MEM_SESSION, st.due)} due + new` : st.due ? `Study: ${Math.min(MEM_SESSION, st.due)} due` : st.fresh ? 'Learn new facts' : 'Study'}</button><button type="button" class="btn" id="mem-cram">Cram weakest 20</button></div>
          </div>
          ${memBar(st)}${memLegend()}
        </section>
        ${memIntroHTML()}
        <div class="row mem-sheet-head"><h2 class="mem-h">Study sheet</h2><button type="button" class="btn ghost" id="mem-hide" aria-pressed="${hide}">${hide ? 'Show answers' : 'Cover answers'}</button></div>
        <p class="note">${hide ? 'Answers are covered. Say each one, then tap the row to check.' : 'Read through, then cover the answers and quiz yourself.'} The dot shows each fact's level.</p>
        ${MEM[labId].map((gr, gi) => { const gs = memStats(items.filter(it => it.gi === gi)); return `<section class="mem-group"><div class="mem-gh"><h3>${gr.name}</h3><span class="note">${gs.mastered}/${gs.total} mastered${gs.due ? ` · ${gs.due} due` : ''}</span><button type="button" class="btn ghost mem-gstudy" data-gi="${gi}">${gs.started ? 'Study this set' : 'Learn this set'}</button></div><table class="t mem-sheet${hide ? ' covered' : ''}"><tbody>${fwd.filter(it => it.gi === gi).map(it => {
          const rev = items.find(o => o.dir === 1 && o.id === labId + '|' + gr.name + '|' + memText(it.aH) + '|r');
          const lv = Math.min(memLevel(it), rev ? memLevel(rev) : 5);
          return `<tr><td class="lvd"><i class="mb-l${lv}" title="${MEM_LEVELS[lv]}"></i></td><td>${it.q}</td><td class="ans-c"><span>${it.aH}</span>${it.note ? `<small>${it.note}</small>` : ''}</td></tr>`;
        }).join('')}</tbody></table></section>`; }).join('')}
        <p class="note"><a href="#${lab.id}">← Back to the ${lab.title} lab</a></p>`;
      app.querySelector('#mem-study').addEventListener('click', () => run(false));
      app.querySelector('#mem-cram').addEventListener('click', () => run(true));
      app.querySelectorAll('.mem-gstudy').forEach(b => b.addEventListener('click', () => run(false, +b.dataset.gi)));
      app.querySelector('#mem-hide').addEventListener('click', () => { hide = !hide; draw(); });
      app.querySelectorAll('.mem-sheet.covered tr').forEach(tr => tr.addEventListener('click', () => tr.classList.toggle('peek')));
    }
    draw();
    return off;
  },
}));
