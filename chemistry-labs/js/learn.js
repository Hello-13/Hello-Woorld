'use strict';
/* Learn: a guided lesson for every lab, meant for the first time you meet a topic.
   One idea per step. Worked examples reveal one move at a time so you can try the next move first.
   Quick checks after most steps. The last step hands you to the lab's Watch it, Bench and Practice. */

const LESSONS = {};
/* S(title, body, {ex: [question, step1, step2, ...], ck: [question, [choices], answerIndex, why], num: [question, answer, unit, why, tol]}) */
const S = (t, body, o = {}) => ({ t, body, ...o });
function lesson(id, minutes, steps) {
  LESSONS[id] = { minutes, steps };
  registerPage('learn-' + id, {
    get title() { const lab = LABS.find(l => l.id === id); return (lab ? lab.title : 'Lesson') + ' lesson'; },
    render: app => renderLesson(app, id),
  });
}
const lessonState = id => { const b = Store.bag('lessons'); return b[id] || (b[id] = { step: 0, done: false, max: 0 }); };

/* The card shown at the top of each lab */
function lessonBanner(lab) {
  const L = LESSONS[lab.id]; if (!L) return '';
  const st = lessonState(lab.id), n = L.steps.length;
  const label = st.done ? 'Lesson complete' : st.max > 0 ? `Lesson in progress: step ${Math.min(st.step + 1, n)} of ${n}` : 'New to this topic? Start with the lesson';
  return `<a class="lesson-cta${st.done ? ' done' : ''}" href="#learn-${lab.id}"><span class="lc-k">Learn</span><b>${label}</b><span class="lc-sub">${st.done ? 'Review the lesson any time, or keep going below with the animation, bench and practice.' : `${n} short steps, about ${L.minutes} minutes. It teaches the ideas from scratch, then sends you back here to practice.`}</span><span class="lc-go">${st.done ? 'Review' : st.max > 0 ? 'Continue' : 'Start'} →</span></a>`;
}

function renderLesson(app, id) {
  const L = LESSONS[id], lab = LABS.find(l => l.id === id), st = lessonState(id), n = L.steps.length;
  let i = st.done ? 0 : Math.min(st.step, n);
  const withLessons = LABS.filter(l => LESSONS[l.id]), nextLab = withLessons[withLessons.indexOf(lab) + 1];
  function head() {
    return `<div class="lab-head">${tileHTML(lab, true)}<div class="lab-title"><p class="eyebrow">Lesson · ${lab.code ? 'Gen Chem Bridge ' + lab.code : 'Chapter ' + lab.ch} · ${lab.chapter}</p><h1>${lab.title}</h1><p class="lede">A step-by-step introduction. About ${L.minutes} minutes. Try each worked example yourself before revealing the next move.</p></div></div>
      <div class="ls-progress" role="tablist" aria-label="Lesson steps">${L.steps.map((s, k) => `<button type="button" role="tab" data-k="${k}" aria-selected="${k === i}" ${k > st.max ? 'disabled' : ''} title="${U.esc(s.t)}"><i class="${k < st.max || st.done ? 'seen' : ''}"></i></button>`).join('')}<button type="button" role="tab" data-k="${n}" aria-selected="${i === n}" ${st.max < n && !st.done ? 'disabled' : ''} title="Summary"><i class="${st.done ? 'seen' : ''}"></i></button></div>`;
  }
  function draw() {
    st.step = i; st.max = Math.max(st.max, i); Store.save();
    if (i >= n) return summary();
    const s = L.steps[i];
    const ex = s.ex ? `<div class="ls-ex"><div class="ls-tag">Worked example</div><div class="ls-exq">${s.ex[0]}</div><ol class="ls-exs"></ol><button type="button" class="btn ls-reveal">Show the first step</button></div>` : '';
    const ck = s.ck ? `<div class="ls-ck"><div class="ls-tag">Quick check</div><div class="q">${s.ck[0]}</div><div class="choices">${s.ck[1].map((c, k) => `<button type="button" class="choice" data-c="${k}">${c}</button>`).join('')}</div><div class="fb" hidden></div></div>`
      : s.num ? `<div class="ls-ck"><div class="ls-tag">Quick check</div><div class="q">${s.num[0]}</div><form class="ans" novalidate><input id="ls-ans" autocomplete="off" inputmode="decimal" placeholder="your answer" aria-label="Your answer">${s.num[2] ? `<span class="unit">${s.num[2]}</span>` : ''}<button class="btn primary" type="submit">Check</button></form><div class="fb" hidden></div></div>` : '';
    const gated = !!(s.ck || s.num);
    app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">Step ${i + 1} of ${n}</p><h2>${s.t}</h2><div class="ls-body">${s.body}</div>${ex}${ck}
        <div class="tutor-slot"></div>
        <div class="prow"><button type="button" class="btn ghost" id="ls-back" ${i === 0 ? 'disabled' : ''}>← Back</button><button type="button" class="btn primary" id="ls-next" ${gated ? 'disabled' : ''}>${i === n - 1 ? 'Finish' : 'Next'} →</button></div>
        ${gated ? '<p class="note ls-gate">Answer the quick check to continue. A wrong answer is fine: you will see why.</p>' : ''}
      </article>`;
    const nextB = app.querySelector('#ls-next'), unlock = () => { nextB.disabled = false; const g = app.querySelector('.ls-gate'); if (g) g.remove(); };
    if (s.ex) {
      const ol = app.querySelector('.ls-exs'), rb = app.querySelector('.ls-reveal'); let k = 0;
      rb.addEventListener('click', () => {
        const li = document.createElement('li'); li.innerHTML = s.ex[1 + k]; ol.append(li); k++;
        if (k >= s.ex.length - 1) rb.remove(); else rb.textContent = 'Show the next step';
      });
    }
    if (s.ck) {
      const fb = app.querySelector('.ls-ck .fb'); let answered = false;
      app.querySelector('.ls-ck .choices').addEventListener('click', e => {
        const b = e.target.closest('[data-c]'); if (!b || answered) return; answered = true;
        const ok = +b.dataset.c === s.ck[2];
        b.classList.add(ok ? 'right' : 'wrong'); if (!ok) app.querySelectorAll('.ls-ck .choice')[s.ck[2]].classList.add('right');
        fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no'); fb.innerHTML = `<div class="verdict">${ok ? 'Correct' : 'Not quite'}</div><div class="explain">${s.ck[3]}</div>`;
        unlock();
      });
    }
    if (s.num) {
      const fb = app.querySelector('.ls-ck .fb'), form = app.querySelector('.ls-ck form'), inp = form.querySelector('input'); let tries = 0;
      form.addEventListener('submit', e => {
        e.preventDefault();
        const ok = checkAnswer({ kind: 'num', answer: s.num[1], tol: s.num[4] ?? 0.02, abs: 1e-9 }, inp.value);
        if (ok === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = '<div class="verdict">Enter a number</div><div>Scientific notation works as 6.02e23.</div>'; return; }
        tries++;
        fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'no');
        fb.innerHTML = ok || tries >= 2 ? `<div class="verdict">${ok ? 'Correct' : 'Here is how'}</div><div class="answer">Answer: <b>${fmt(s.num[1], 3)}${s.num[2] ? ' ' + s.num[2] : ''}</b></div><div class="explain">${s.num[3]}</div>` : '<div class="verdict">Not quite</div><div>Try once more. After a second try you will see the solution.</div>';
        if (ok || tries >= 2) { unlock(); inp.disabled = true; form.querySelector('button').disabled = true; }
      });
    }
    if (typeof Tutor !== 'undefined' && Tutor.explainStep) Tutor.explainStep(app.querySelector('.tutor-slot'), lab, s);
    app.querySelector('#ls-back').addEventListener('click', () => { i = Math.max(0, i - 1); draw(); window.scrollTo(0, 0); });
    nextB.addEventListener('click', () => { i++; draw(); window.scrollTo(0, 0); });
    wireProgress();
  }
  function summary() {
    st.done = true; st.max = n; Store.save();
    app.innerHTML = head() + `<article class="panel-card ls-step fam-${lab.fam}">
        <p class="ls-k">Lesson complete</p><h2>The ideas to keep</h2>
        <ul class="ls-sum">${lab.ideas.map(x => `<li>${x}</li>`).join('')}</ul>
        <div class="callout good"><b>Now make it stick.</b> Open the lab: watch the animation, play with the bench, then answer practice problems until the meter fills. Use the hint button before the full solution. The skills you practice join your Daily Review.</div>
        <div class="btn-row"><a class="btn primary" href="#${lab.id}">Open the ${lab.title} lab →</a>${nextLab ? `<a class="btn" href="#learn-${nextLab.id}">Next lesson: ${chTag(nextLab)} ${nextLab.title}</a>` : ''}<button type="button" class="btn ghost" id="ls-restart">Restart lesson</button></div>
      </article>`;
    app.querySelector('#ls-restart').addEventListener('click', () => { i = 0; st.done = false; draw(); });
    wireProgress();
  }
  function wireProgress() {
    app.querySelector('.ls-progress').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; i = +b.dataset.k; draw(); });
  }
  const onKey = e => { if (e.target.matches('input, textarea, select')) return; if (e.key === 'ArrowLeft') app.querySelector('#ls-back:not([disabled])')?.click(); if (e.key === 'ArrowRight') app.querySelector('#ls-next:not([disabled])')?.click(); };
  document.addEventListener('keydown', onKey);
  draw();
  return () => document.removeEventListener('keydown', onKey);
}
