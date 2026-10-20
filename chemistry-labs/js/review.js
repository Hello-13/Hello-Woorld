'use strict';
/* Daily review: interleaved, spaced-repetition practice across every skill you have touched.
   Each skill (lab + problem type) sits in a box 0–6; recordSkill() in core moves it after every graded answer.
   The queue is: skills that are due (most overdue first), topped up with a few new skills from labs you have
   opened, then shuffled so no two neighbors come from the same lab. */

const REVIEW_SIZE = 12;
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function allSkills() {
  const out = [];
  LABS.forEach(l => l.problems.forEach(p => out.push({ lab: l, gen: p, type: p.name, key: l.id + '|' + p.name })));
  return out;
}
function reviewPlan(n = REVIEW_SIZE) {
  const srs = Store.bag('srs'), now = Date.now(), skills = allSkills();
  const due = skills.filter(s => srs[s.key] && srs[s.key].due <= now).sort((a, b) => srs[a.key].due - srs[b.key].due);
  const touched = new Set(LABS.filter(l => Store.get(l.id).a > 0).map(l => l.id));
  let fresh = skills.filter(s => !srs[s.key] && touched.has(s.lab.id));
  if (!touched.size && !Object.keys(srs).length) fresh = skills.filter(s => ['measurement', 'matter-energy', 'atoms', 'compounds'].includes(s.lab.id));
  return { due, fresh, srs, newCap: due.length ? 4 : 8 };
}
function interleave(list) {
  const pool = U.shuffle(list), out = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    let k = pool.findIndex(s => !prev || s.lab.id !== prev.lab.id);
    if (k < 0) k = 0;
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}
function reviewStreak() {
  const days = Store.bag('review').days || {};
  let streak = 0, t = Date.now();
  if (!days[dayKey(t)]) t -= 864e5; // today not done yet: count from yesterday
  while (days[dayKey(t)]) { streak++; t -= 864e5; }
  return streak;
}
function reviewSummaryHTML() {
  const { due, fresh, newCap } = reviewPlan(), n = Math.min(REVIEW_SIZE, due.length + Math.min(newCap, fresh.length)), streak = reviewStreak(), doneToday = !!(Store.bag('review').days || {})[dayKey()];
  return `<a class="review-cta" href="#review"><span class="rc-k">Daily review</span><b>${doneToday && !due.length ? 'Done for today' : n ? `${n} problem${n === 1 ? '' : 's'} ready` : 'Nothing due'}</b>
    <span class="rc-sub">${due.length ? `${due.length} skill${due.length === 1 ? ' is' : 's are'} due for review.` : 'Mixed practice from every lab you have used, spaced so skills come back right before you would forget them.'}</span>
    <span class="rc-streak">${streak ? `${streak}-day streak` : 'Start a streak today'}</span></a>`;
}

registerPage('review', {
  title: 'Daily Review',
  render(app) {
    let queue = [], i = 0, results = [];
    function intro() {
      const { due, fresh, srs, newCap } = reviewPlan(), boxes = [0, 0, 0, 0, 0, 0, 0];
      Object.values(srs).forEach(s => boxes[s.box]++);
      const tracked = Object.keys(srs).length, n = Math.min(REVIEW_SIZE, due.length + Math.min(newCap, fresh.length));
      const next = Object.values(srs).filter(s => s.due > Date.now()).sort((a, b) => a.due - b.due)[0];
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Spaced, mixed practice</p><h1>Daily Review</h1><p class="lede">A short daily session that mixes problems from every topic you have practiced. A skill you get right comes back after 1, then 2, 4, 8, 16 and 32 days; a skill you miss comes back today. Mixing and spacing practice like this is one of the most reliable ways to remember material for a whole semester.</p></div></div>
        <section class="panel-card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div><div class="readout">${n ? `${n} problems` : 'All caught up'}</div><p class="note">${due.length} due · ${Math.min(newCap, fresh.length)} new · ${reviewStreak()}-day streak</p></div>
            <div class="btn-row">${n ? '<button type="button" class="btn primary" id="rv-go">Start review</button>' : ''}<button type="button" class="btn${n ? ' ghost' : ' primary'}" id="rv-extra">${n ? 'Extra: weakest skills' : 'Practice weakest skills anyway'}</button></div>
          </div>
          ${!n && next ? `<p class="note">Next skill comes due ${new Date(next.due).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.</p>` : ''}
          ${!tracked ? '<div class="callout">New here? Your first review starts with the opening chapters. After that, every lab you practice joins the rotation automatically.</div>' : ''}
        </section>
        ${tracked ? `<section class="panel-card"><h2 class="mini-h">How well you know your ${tracked} skills</h2>
          <div class="srs-boxes">${boxes.map((c, b) => `<div><span class="bx-n">${c}</span><span class="bx-bar"><i style="height:${tracked ? c / tracked * 100 : 0}%"></i></span><span class="bx-l">${b === 0 ? 'learning' : b === 6 ? 'mastered' : SRS_DAYS[b] + 'd'}</span></div>`).join('')}</div>
          <p class="note">Each column is a box. Skills move right when you answer correctly and fall back to "learning" when you miss. The number under each box is how long until that skill comes back.</p></section>` : ''}`;
      app.querySelector('#rv-go')?.addEventListener('click', () => begin(interleave(due.slice(0, REVIEW_SIZE).concat(U.shuffle(fresh).slice(0, Math.max(0, Math.min(newCap, REVIEW_SIZE - due.length)))))));
      app.querySelector('#rv-extra').addEventListener('click', () => {
        const w = weakSpots(6).map(x => allSkills().find(s => s.key === x.lab.id + '|' + x.type)).filter(Boolean);
        const pool = w.length ? w : U.shuffle(allSkills().filter(s => Store.get(s.lab.id).a > 0 || !Object.keys(Store.bag('srs')).length)).slice(0, 8);
        begin(interleave(pool.concat(pool).slice(0, 8)));
      });
    }
    function begin(list) { queue = list.map(s => { try { const p = s.gen.gen(); p.type = s.type; return { s, p }; } catch (e) { console.error(e); return null; } }).filter(Boolean); i = 0; results = []; if (queue.length) ask(); else intro(); }
    function ask() {
      const { s, p } = queue[i];
      const input = p.kind === 'choice' ? `<div class="choices">${p.choices.map((c, k) => `<button type="button" class="choice" data-i="${k}">${c}</button>`).join('')}</div>`
        : `<form class="ans" novalidate><input id="rv-ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${U.esc(p.ph || (p.kind === 'num' ? 'e.g. 2.5 or 6.02e23' : 'type your answer'))}" inputmode="${p.kind === 'num' ? 'decimal' : 'text'}" aria-label="Your answer">${p.unit ? `<span class="unit">${p.unit}</span>` : ''}<button class="btn primary" type="submit">Check</button></form>`;
      app.innerHTML = `<div class="exam-top"><span class="eyebrow">Review ${i + 1} of ${queue.length}</span><span class="note">${results.filter(r => r.ok).length} right so far</span><button type="button" class="btn ghost" id="rv-quit">Finish early</button></div>
        <div class="exbar"><i style="width:${i / queue.length * 100}%"></i></div>
        <section class="panel-card exam-q fam-${s.lab.fam}"><div class="ptype">${chTag(s.lab)} · ${s.lab.title} · ${p.type}</div><div class="q">${p.q}</div>${input}<div class="fb" hidden></div><div class="tutor-slot"></div>
          <div class="prow"><button type="button" class="btn ghost" id="rv-show">Show solution</button><button type="button" class="btn" id="rv-next" hidden>${i + 1 < queue.length ? 'Next' : 'Finish'}</button></div></section>`;
      const fb = app.querySelector('.fb'), nextB = app.querySelector('#rv-next'), attempts = [];
      let graded = false, done = false;
      if (typeof Tutor !== 'undefined') Tutor.attach(app.querySelector('.tutor-slot'), s.lab, p, () => ({ attempts, done }));
      const finish = (ok, revealed) => {
        done = true;
        if (!graded) { graded = true; const ts = Store.typeStat(s.lab.id, p.type); ts.a++; if (ok) ts.c++; recordSkill(s.lab.id, p.type, ok); Store.save(); results.push({ s, p, ok }); }
        fb.hidden = false; fb.className = 'fb ' + (revealed ? 'neutral' : ok ? 'ok' : 'no');
        fb.innerHTML = `<div class="verdict">${revealed ? 'Solution' : ok ? 'Correct' : 'Not quite'}</div>${ok ? '' : `<div class="answer">Answer: <b>${answerHTML(p)}</b></div>`}${p.explain ? `<div class="explain">${p.explain}</div>` : ''}<div class="note">${ok ? `Next review of this skill: in ${SRS_DAYS[Store.bag('srs')[s.key].box]} day${SRS_DAYS[Store.bag('srs')[s.key].box] === 1 ? '' : 's'}.` : 'This skill will come back later today.'}</div>`;
        app.querySelector('#rv-show').hidden = true; nextB.hidden = false; nextB.focus();
        app.querySelectorAll('.choice, .ans input, .ans button').forEach(x => { x.disabled = true; });
      };
      if (p.kind === 'choice') app.querySelector('.choices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (!b || done) return; const ok = +b.dataset.i === p.answer; attempts.push(b.textContent.trim()); b.classList.add(ok ? 'right' : 'wrong'); if (!ok) app.querySelectorAll('.choice')[p.answer].classList.add('right'); finish(ok, false); });
      else {
        const form = app.querySelector('form'), inp = form.querySelector('input'); inp.focus();
        form.addEventListener('submit', e => { e.preventDefault(); if (done) return; const r = checkAnswer(p, inp.value); if (r === null) { fb.hidden = false; fb.className = 'fb no'; fb.innerHTML = `<div class="verdict">Couldn't read that</div><div>${p.kind === 'num' ? 'Enter a number. Scientific notation works as 6.02e23.' : (p.hint || 'Check the format and try again.')}</div>`; return; } attempts.push(inp.value.trim()); finish(r, false); });
      }
      app.querySelector('#rv-show').addEventListener('click', () => { if (p.kind === 'choice') app.querySelectorAll('.choice')[p.answer].classList.add('right'); finish(false, true); });
      nextB.addEventListener('click', () => { i++; if (i < queue.length) ask(); else summary(); });
      app.querySelector('#rv-quit').addEventListener('click', summary);
    }
    function summary() {
      if (results.length) { const r = Store.bag('review'); r.days = r.days || {}; r.days[dayKey()] = (r.days[dayKey()] || 0) + results.length; Store.save(); }
      const c = results.filter(r => r.ok).length, missed = results.filter(r => !r.ok), { due } = reviewPlan();
      app.innerHTML = `<div class="lab-head"><div class="lab-title"><p class="eyebrow">Review complete</p><h1>${results.length ? `${c} of ${results.length} right` : 'No problems answered'}</h1><p class="lede">${results.length ? `${reviewStreak()}-day streak. ${!missed.length ? 'Every skill moved up a box and is scheduled further out.' : missed.length === results.length ? 'These skills will come back later today. Open each lab below and drill it once first.' : `The ${missed.length} skill${missed.length === 1 ? '' : 's'} you missed will come back later today; the rest are scheduled further out.`}` : 'Come back any time.'}</p></div></div>
        ${missed.length ? `<section class="panel-card"><h2 class="mini-h">Worth another look</h2><div style="display:grid;gap:10px">${missed.map(r => `<a class="weak-item fam-${r.s.lab.fam}" href="#${r.s.lab.id}" data-preset="${U.esc(r.p.type)}"><span class="wl">${chTag(r.s.lab)} · ${r.s.lab.title}</span><b>${r.p.type}</b><span class="wp">open the lab and drill this</span></a>`).join('')}</div></section>` : ''}
        <div class="btn-row">${due.length ? '<button type="button" class="btn primary" id="rv-more">Review the next batch</button>' : ''}<a class="btn" href="#">Back to labs</a></div>`;
      app.querySelector('#rv-more')?.addEventListener('click', intro);
      window.scrollTo(0, 0);
    }
    intro();
  },
});
