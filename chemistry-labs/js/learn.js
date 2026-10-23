'use strict';
/* Learn: a guided lesson for every lab that takes you from no background to mastery.
   A lesson opens with what you will be able to do and what you need first, then moves through parts.
   Each step teaches one idea: explanation, optional diagram, worked examples revealed one move at a time
   (try the next move yourself first), a memory hook, the most common mistake, a video pointer, and
   checks you must answer to continue. The checks appear once the worked example is fully revealed.
   It ends with a mastery check of fresh problems from the lab's generators, then a summary. */

const LESSONS = {};
/* lesson(id, minutes, steps, meta)
     steps: S(...) steps, with P('Part title') markers between them
     meta:  { goals: [...], need: [[labId|null, 'what you need']], keep: ['takeaway', ...], vids: [['Channel', 'search words'], ...] }
   S(title, body, {
     ex: [question, move1, move2, ...]            one worked example (exs: [ex, ex] for several)
     ck: [question, [choices], answerIndex, why]  one check (cks: [ck, ck] for several)
     num: [question, answer, unit, why, tol]      one numeric check (nums: [...] for several)
     fig: 'html/svg', tip: 'memory hook', trap: 'common mistake', vid: ['Channel', 'search words'] }) */
const S = (t, body, o = {}) => ({ t, body, ...o });
const P = title => ({ part: title });
const MASTERY_N = 6, MASTERY_PASS = 5;
/* Shuffle choice order so the right answer is never in a predictable spot; keep ordered sets (numbers, Yes/No pairs) in order */
const choiceOrder = ch => {
  const idx = ch.map((_, k) => k), plain = ch.map(x => String(x).replace(/<[^>]+>/g, '').trim());
  const ordered = plain.every(x => /^[−-]?[\d.,]+$/.test(x)) || ch.length === 2;
  return ordered ? idx : U.shuffle(idx);
};
function lesson(id, minutes, raw, meta = {}) {
  const steps = []; let part = '';
  raw.forEach(s => { if (s.part !== undefined && !s.t) part = s.part; else steps.push({ ...s, part }); });
  steps.forEach(s => {
    s.exList = s.exs || (s.ex ? [s.ex] : []);
    s.checks = [...(s.cks || (s.ck ? [s.ck] : [])).map(c => ({ kind: 'ck', c })), ...(s.nums || (s.num ? [s.num] : [])).map(c => ({ kind: 'num', c }))];
  });
  LESSONS[id] = { minutes, steps, meta, parts: [...new Set(steps.map(s => s.part).filter(Boolean))] };
  registerPage('learn-' + id, {
    get title() { const lab = LABS.find(l => l.id === id); return (lab ? lab.title : 'Lesson') + ' lesson'; },
    render: app => renderLesson(app, id),
  });
}
const lessonState = id => { const b = Store.bag('lessons'); return b[id] || (b[id] = { step: 0, done: false, max: 0 }); };
const ytLink = ([who, q]) => `<a class="ls-vid" href="https://www.youtube.com/results?search_query=${encodeURIComponent(who + ' ' + q)}" target="_blank" rel="noopener"><span class="lv-play" aria-hidden="true">▶</span><span><b>${who}</b> · ${q}</span></a>`;

/* The card shown at the top of each lab */
function lessonBanner(lab) {
  const L = LESSONS[lab.id]; if (!L) return '';
  const st = lessonState(lab.id), n = L.steps.length;
  const label = st.mastered ? 'Lesson mastered ★' : st.done ? 'Lesson complete' : st.max > 0 ? `Lesson in progress: step ${Math.min(st.step + 1, n)} of ${n}` : 'New to this topic? Start here';
  const sub = st.mastered ? 'You passed the mastery check. Review any step, or keep going below.'
    : st.done ? `Retake the mastery check to lock it in (${MASTERY_PASS} of ${MASTERY_N} to pass), or keep going below.`
    : `${L.parts.length ? L.parts.length + ' parts, ' : ''}${n} steps, about ${L.minutes} minutes. It starts from zero, with worked examples and checks, and ends with a mastery check.`;
  return `<a class="lesson-cta${st.done ? ' done' : ''}" href="#learn-${lab.id}"><span class="lc-k">Learn</span><b>${label}</b><span class="lc-sub">${sub}</span><span class="lc-go">${st.done ? 'Review' : st.max > 0 ? 'Continue' : 'Start'} →</span></a>`;
}

function renderLesson(app, id) {
  const L = LESSONS[id], lab = LABS.find(l => l.id === id), st = lessonState(id), n = L.steps.length, meta = L.meta || {};
  // screens: 0 = overview, 1..n = steps, n+1 = mastery check, n+2 = summary
  const MC = n + 1, SUM = n + 2;
  let i = st.done ? 0 : Math.min(st.step || 0, SUM);
  if (st.v !== 2) { i = 0; st.max = 0; st.done = false; st.v = 2; }
  const withLessons = LABS.filter(l => LESSONS[l.id]), nextLab = withLessons[withLessons.indexOf(lab) + 1];
  const tag = lab.code ? 'Gen Chem Bridge ' + lab.code : 'Chapter ' + lab.ch;
  function head() {
    const dot = (k, title, cls = '') => `<button type="button" role="tab" data-k="${k}" aria-selected="${k === i}" ${k > st.max && !st.done ? 'disabled' : ''} title="${U.esc(title)}" class="${cls}"><i class="${k < st.max || st.done ? 'seen' : ''}"></i></button>`;
    let bar = dot(0, 'Overview', 'ov'), last = null;
    L.steps.forEach((s, k) => { if (s.part && s.part !== last) { bar += `<span class="ls-pt" title="${U.esc(s.part)}"></span>`; last = s.part; } bar += dot(k + 1, s.t); });
    bar += `<span class="ls-pt"></span>` + dot(MC, 'Mastery check', 'mc') + dot(SUM, 'Summary');
    return `<div class="lab-head">${tileHTML(lab, true)}<div class="lab-title"><p class="eyebrow">Lesson · ${tag} · ${lab.chapter}</p><h1>${lab.title}</h1><p class="lede">From the ground up, about ${L.minutes} minutes. Try each worked example yourself before revealing the next move.</p></div></div>
      <div class="ls-progress" role="tablist" aria-label="Lesson steps">${bar}</div>`;
  }
  function nav(label, gated) {
    return `<div class="prow"><button type="button" class="btn ghost" id="ls-back" ${i === 0 ? 'disabled' : ''}>← Back</button><button type="button" class="btn primary" id="ls-next" ${gated ? 'disabled' : ''}>${label} →</button></div>`;
  }
  function wireNav() {
    app.querySelector('#ls-back')?.addEventListener('click', () => go(i - 1));
    app.querySelector('#ls-next')?.addEventListener('click', () => go(i + 1));
    app.querySelector('.ls-progress').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; go(+b.dataset.k); });
  }
  function go(k) { i = Math.max(0, Math.min(SUM, k)); draw(); window.scrollTo(0, 0); }
  function draw() {
    st.step = i; st.max = Math.max(st.max, i); Store.save();
    if (i === 0) return overview();
    if (i === MC) return mastery();
    if (i === SUM) return summary();
    step(L.steps[i - 1], i);
  }

  function overview() {
    const needs = meta.need || [];
    app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
      <p class="ls-k">Start here</p><h2>${lab.title}</h2>
      <div class="ls-body"><p>${lab.blurb}</p></div>
      ${meta.goals ? `<div class="ls-goals"><div class="ls-tag">By the end you will be able to</div><ul>${meta.goals.map(g => `<li>${g}</li>`).join('')}</ul></div>` : ''}
      <div class="ls-need"><div class="ls-tag">What you need first</div>${needs.length ? `<ul>${needs.map(([lid, t]) => { const l = lid && LABS.find(x => x.id === lid); return `<li>${t}${l ? ` <a href="#learn-${l.id}">${chTag(l)} lesson →</a>` : ''}</li>`; }).join('')}</ul>` : '<p>Nothing. This lesson starts from zero.</p>'}</div>
      ${L.parts.length ? `<div class="ls-parts"><div class="ls-tag">The plan</div><ol>${L.parts.map(p => `<li>${p}</li>`).join('')}<li>Mastery check: ${MASTERY_N} fresh problems, pass with ${MASTERY_PASS}</li></ol></div>` : ''}
      ${meta.vids && meta.vids.length ? `<div class="ls-vids"><div class="ls-tag">Prefer to watch first? The clearest teachers on this topic</div>${meta.vids.map(ytLink).join('')}<p class="note">Links open a YouTube search for that teacher and topic.</p></div>` : ''}
      <p class="note">How to use it: read the step, then cover the worked example and try each move before you reveal it. Getting a check wrong is fine; the explanation is the lesson.</p>
      ${nav(st.max > 0 && !st.done ? 'Continue' : 'Start', false)}</article>`;
    wireNav();
  }

  function step(s, k) {
    const exs = s.exList.map((ex, j) => `<div class="ls-ex" data-x="${j}"><div class="ls-tag">Worked example${s.exList.length > 1 ? ' ' + (j + 1) : ''}</div><div class="ls-exq">${ex[0]}</div><ol class="ls-exs"></ol><button type="button" class="btn ls-reveal">Try it, then show the first step</button></div>`).join('');
    const checks = s.checks.map((c, j) => c.kind === 'ck'
      ? `<div class="ls-ck" data-j="${j}"><div class="ls-tag">Check ${s.checks.length > 1 ? j + 1 : 'yourself'}</div><div class="q">${c.c[0]}</div><div class="choices">${choiceOrder(c.c[1]).map(q => `<button type="button" class="choice" data-c="${q}">${c.c[1][q]}</button>`).join('')}</div><div class="fb" hidden></div></div>`
      : `<div class="ls-ck" data-j="${j}"><div class="ls-tag">Check ${s.checks.length > 1 ? j + 1 : 'yourself'}</div><div class="q">${c.c[0]}</div><form class="ans" novalidate><input id="ls-ans-${j}" class="ls-ans" autocomplete="off" inputmode="decimal" placeholder="your answer" aria-label="Your answer">${c.c[2] ? `<span class="unit">${c.c[2]}</span>` : ''}<button class="btn primary" type="submit">Check</button></form><div class="fb" hidden></div></div>`).join('');
    const gated = s.checks.length > 0, hideChecks = s.exList.length > 0 && gated;
    app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">${s.part ? s.part + ' · ' : ''}Step ${k} of ${n}</p><h2>${s.t}</h2><div class="ls-body">${s.body}</div>
        ${s.fig ? `<figure class="ls-fig">${s.fig}</figure>` : ''}
        ${s.tip ? `<div class="ls-tip"><span class="ls-tag">Memory hook</span><div>${s.tip}</div></div>` : ''}
        ${exs}
        ${s.trap ? `<div class="ls-trap"><span class="ls-tag">Common mistake</span><div>${s.trap}</div></div>` : ''}
        ${gated ? `<div class="ls-checks"${hideChecks ? ' hidden' : ''}>${checks}</div>${hideChecks ? '<p class="note ls-wait">Reveal the worked example to unlock the check.</p>' : ''}` : ''}
        ${s.vid ? `<div class="ls-vids">${ytLink(s.vid)}</div>` : ''}
        <div class="tutor-slot"></div>
        ${nav(k === n ? 'Mastery check' : 'Next', gated)}
        ${gated ? '<p class="note ls-gate">Answer the check to continue. A wrong answer is fine: you will see why.</p>' : ''}
      </article>`;
    const nextB = app.querySelector('#ls-next');
    let left = s.checks.length, exLeft = s.exList.length;
    const unlock = () => { if (--left > 0) return; nextB.disabled = false; app.querySelector('.ls-gate')?.remove(); };
    const showChecks = () => { const c = app.querySelector('.ls-checks'); if (c && c.hidden) { c.hidden = false; app.querySelector('.ls-wait')?.remove(); } };
    if (st.max > k || st.done) { exLeft = 0; showChecks(); }
    app.querySelectorAll('.ls-ex').forEach(box => {
      const ex = s.exList[+box.dataset.x], ol = box.querySelector('.ls-exs'), rb = box.querySelector('.ls-reveal'); let m = 0;
      rb.addEventListener('click', () => {
        const li = document.createElement('li'); li.innerHTML = ex[1 + m]; ol.append(li); m++;
        if (m >= ex.length - 1) { rb.remove(); if (--exLeft <= 0) showChecks(); } else rb.textContent = 'Try the next move, then show it';
      });
    });
    s.checks.forEach((c, j) => {
      const box = app.querySelector(`.ls-ck[data-j="${j}"]`), fb = box.querySelector('.fb');
      if (c.kind === 'ck') {
        let answered = false;
        box.querySelector('.choices').addEventListener('click', e => {
          const b = e.target.closest('[data-c]'); if (!b || answered) return; answered = true;
          const ok = +b.dataset.c === c.c[2];
          b.classList.add(ok ? 'right' : 'wrong'); if (!ok) box.querySelector(`.choice[data-c="${c.c[2]}"]`).classList.add('right');
          box.querySelectorAll('.choice').forEach(x => { x.disabled = true; });
          fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = `<div class="verdict">${ok ? 'Correct' : 'Not quite'}</div><div class="explain">${c.c[3]}</div>`;
          unlock();
        });
      } else {
        const form = box.querySelector('form'), inp = form.querySelector('input'); let tries = 0;
        form.addEventListener('submit', e => {
          e.preventDefault();
          const ok = checkAnswer({ kind: 'num', answer: c.c[1], tol: c.c[4] ?? 0.02, abs: 1e-9 }, inp.value);
          if (ok === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = '<div class="verdict">Enter a number</div><div>Scientific notation works as 6.02e23.</div>'; return; }
          tries++;
          fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
          fb.innerHTML = ok || tries >= 2 ? `<div class="verdict">${ok ? 'Correct' : 'Here is how'}</div><div class="answer">Answer: <b>${fmt(c.c[1], 3)}${c.c[2] ? ' ' + c.c[2] : ''}</b></div><div class="explain">${c.c[3]}</div>` : '<div class="verdict">Not quite</div><div>Try once more. After a second try you will see the solution.</div>';
          if (ok || tries >= 2) { unlock(); inp.disabled = true; form.querySelector('button').disabled = true; }
        });
      }
    });
    if (typeof Tutor !== 'undefined' && Tutor.explainStep) Tutor.explainStep(app.querySelector('.tutor-slot'), lab, { ...s, ex: s.exList[0] });
    wireNav();
  }

  /* Mastery check: fresh problems from the lab's own generators, one per problem type where possible */
  function mastery() {
    const types = U.shuffle(lab.problems), qs = [];
    for (let k = 0; qs.length < MASTERY_N && k < MASTERY_N * 4; k++) {
      const gen = types[k % types.length];
      try { const p = gen.gen(); p.type = gen.name; qs.push({ p, ok: null }); } catch (err) { console.error(err); }
    }
    let q = 0;
    function ask() {
      if (q >= qs.length) return result();
      const { p } = qs[q];
      const input = p.kind === 'choice' ? `<div class="choices">${p.choices.map((c, k) => `<button type="button" class="choice" data-i="${k}">${c}</button>`).join('')}</div>`
        : `<form class="ans" novalidate><input id="ls-mc-ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${U.esc(p.ph || (p.kind === 'num' ? 'e.g. 2.5 or 6.02e23' : 'type your answer'))}" inputmode="${p.kind === 'num' ? 'decimal' : 'text'}" aria-label="Your answer">${p.unit ? `<span class="unit">${p.unit}</span>` : ''}<button class="btn primary" type="submit">Submit</button></form>`;
      const right = qs.filter(x => x.ok).length;
      app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">Mastery check · question ${q + 1} of ${qs.length} · ${right} right so far</p><h2>Show what you know</h2>
        <p class="note">Fresh problems, no hints. Get ${MASTERY_PASS} of ${qs.length} to master the lesson. Each one also joins your Daily Review.</p>
        <div class="ls-ck"><div class="ptype">${p.type}</div><div class="q">${p.q}</div>${input}<div class="fb" hidden></div></div>
        <div class="prow"><button type="button" class="btn ghost" id="ls-back">← Back to the lesson</button><button type="button" class="btn primary" id="ls-mc-next" hidden>${q + 1 < qs.length ? 'Next question' : 'See result'} →</button></div></article>`;
      const fb = app.querySelector('.fb'), nb = app.querySelector('#ls-mc-next');
      const done = ok => {
        qs[q].ok = ok; recordSkill(lab.id, p.type, ok); const ts = Store.typeStat(lab.id, p.type); ts.a++; if (ok) ts.c++; Store.save();
        fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
        fb.innerHTML = `<div class="verdict">${ok ? 'Correct' : 'Not this time'}</div>${ok ? '' : `<div class="answer">Answer: <b>${answerHTML(p)}</b></div>`}${p.explain ? `<div class="explain">${p.explain}</div>` : ''}`;
        app.querySelectorAll('.ls-ck .choice, .ls-ck input, .ls-ck .ans button').forEach(x => { x.disabled = true; });
        nb.hidden = false; nb.focus();
      };
      if (p.kind === 'choice') app.querySelector('.choices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (!b || qs[q].ok !== null) return; const ok = +b.dataset.i === p.answer; b.classList.add(ok ? 'right' : 'wrong'); if (!ok) app.querySelectorAll('.ls-ck .choice')[p.answer].classList.add('right'); done(ok); });
      else {
        const form = app.querySelector('form'), inp = form.querySelector('input'); inp.focus();
        form.addEventListener('submit', e => { e.preventDefault(); if (qs[q].ok !== null) return; const r = checkAnswer(p, inp.value); if (r === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = `<div class="verdict">Couldn't read that</div><div>${p.kind === 'num' ? 'Enter a number. Scientific notation works as 6.02e23.' : (p.hint || 'Check the format and try again.')}</div>`; return; } done(r); });
      }
      nb.addEventListener('click', () => { q++; ask(); window.scrollTo(0, 0); });
      app.querySelector('#ls-back').addEventListener('click', () => go(n));
      app.querySelector('.ls-progress').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; go(+b.dataset.k); });
    }
    function result() {
      const c = qs.filter(x => x.ok).length, pass = c >= Math.min(MASTERY_PASS, qs.length);
      st.best = Math.max(st.best || 0, c); if (pass) st.mastered = true; st.done = true; Store.save();
      const missed = [...new Set(qs.filter(x => !x.ok).map(x => x.p.type))];
      app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">Mastery check</p><h2>${c} of ${qs.length}${pass ? ': mastered ★' : ''}</h2>
        <div class="callout ${pass ? 'good' : 'warn'}">${pass ? 'You can do this on fresh problems without help. That is mastery. Keep it with the Daily Review and the Memorize set for this chapter.' : `Close. Go back over the steps for the types you missed, then retake it. New problems every time.`}</div>
        ${missed.length ? `<p>To review: ${missed.map(t => `<b>${t}</b>`).join(', ')}. You can drill any of these by type in the lab's Practice panel.</p>` : ''}
        <div class="btn-row"><button type="button" class="btn${pass ? '' : ' primary'}" id="ls-retake">Retake with new problems</button><button type="button" class="btn${pass ? ' primary' : ''}" id="ls-sum">Summary →</button></div></article>`;
      app.querySelector('#ls-retake').addEventListener('click', mastery);
      app.querySelector('#ls-sum').addEventListener('click', () => go(SUM));
      wireProgressOnly();
    }
    ask();
  }
  function wireProgressOnly() { app.querySelector('.ls-progress').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; go(+b.dataset.k); }); }

  function summary() {
    st.done = true; st.max = SUM; Store.save();
    const keep = meta.keep || lab.ideas;
    app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">Lesson complete${st.mastered ? ' · mastered ★' : ''}</p><h2>What to keep</h2>
        <ul class="ls-sum">${keep.map(x => `<li>${x}</li>`).join('')}</ul>
        <div class="callout good"><b>Make it stick.</b> Open the lab: watch the animation, play with the bench, then practice until the meter fills. ${typeof MEM !== 'undefined' && MEM[lab.id] ? `Memorize the chapter's facts in <a href="#mem-${lab.id}">its Memorize set</a>. ` : ''}Everything you practice comes back in your Daily Review right before you would forget it.</div>
        ${meta.vids && meta.vids.length ? `<div class="ls-vids"><div class="ls-tag">To see it explained another way</div>${meta.vids.map(ytLink).join('')}</div>` : ''}
        <div class="btn-row"><a class="btn primary" href="#${lab.id}">Open the ${lab.title} lab →</a>${st.mastered ? '' : '<button type="button" class="btn" id="ls-mc">Take the mastery check</button>'}${nextLab ? `<a class="btn" href="#learn-${nextLab.id}">Next lesson: ${chTag(nextLab)} ${nextLab.title}</a>` : ''}<button type="button" class="btn ghost" id="ls-restart">Restart lesson</button></div>
      </article>`;
    app.querySelector('#ls-restart').addEventListener('click', () => { st.done = false; go(0); });
    app.querySelector('#ls-mc')?.addEventListener('click', () => go(MC));
    wireProgressOnly();
  }
  const onKey = e => { if (e.target.matches('input, textarea, select')) return; if (e.key === 'ArrowLeft') app.querySelector('#ls-back:not([disabled])')?.click(); if (e.key === 'ArrowRight') app.querySelector('#ls-next:not([disabled])')?.click(); };
  document.addEventListener('keydown', onKey);
  draw();
  return () => document.removeEventListener('keydown', onKey);
}
