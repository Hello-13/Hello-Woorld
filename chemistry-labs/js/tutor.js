'use strict';
/* Claude tutor: hints and step-by-step explanations on each practice problem, plus a per-lab chat.
   Uses the claude.ai Artifact runtime's `sample` capability. Everywhere else (a local file, a
   viewer who declines) every control stays hidden and the page works as before. */

const Tutor = (() => {
  let pending = null, off = false;
  const PERMANENT = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
  const chats = {};

  function get() {
    if (off) return Promise.resolve(null);
    if (!pending) {
      const c = window.claude;
      pending = c && typeof c.use === 'function' ? Promise.resolve(c.use('sample')).catch(() => null) : Promise.resolve(null);
    }
    return pending.then(s => (off ? null : s));
  }
  function disable() { off = true; document.querySelectorAll('.tutor, #ask').forEach(el => { el.hidden = true; }); }
  function errText(e) {
    if (PERMANENT.includes(e.code)) { disable(); return ''; }
    return ({
      rate_limited: 'Too many questions in a row. Wait a minute, then try again.',
      session_expired: 'Sign in to claude.ai again to ask Claude.',
      refused: 'Claude could not help with that one. Try rephrasing it.',
      prompt_too_large: 'That was too long to send. Try a shorter question.',
    })[e.code] || 'Claude could not answer just now. Try again.';
  }
  const strip = html => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<sup>/g, '^').replace(/<sub>/g, '_'); return d.textContent.replace(/\s+/g, ' ').trim(); };
  const STYLE = 'Write plain text only: no Markdown headings, bold or bullet symbols, and no LaTeX. Use Unicode for chemistry (H₂O, SO₄²⁻, 10⁻³, →). Keep sentences short and friendly, for a high school or first-year college student.';

  /* Run one streamed call into `out`, with a Stop button. Resolves with the final text or null. */
  async function run(sample, input, out, stopBtn, opts = {}) {
    const ctl = new AbortController();
    stopBtn.hidden = false;
    stopBtn.onclick = () => ctl.abort();
    out.hidden = false; out.classList.add('thinking'); out.textContent = 'Thinking…';
    try {
      const { text, truncated } = await sample(input, { ...opts, signal: ctl.signal, onText: ({ text }) => { out.classList.remove('thinking'); out.textContent = text; } });
      out.classList.remove('thinking');
      if (truncated) out.textContent = text + '\n\n(Cut short. Ask a narrower question for the rest.)';
      return text;
    } catch (e) {
      out.classList.remove('thinking');
      if (e.code === 'cancelled') { out.textContent = e.text || ''; if (!e.text) out.hidden = true; return null; }
      const msg = errText(e);
      out.textContent = (e.code === 'refused' ? '' : (e.text ? e.text + '\n\n' : '')) + msg;
      return null;
    } finally { stopBtn.hidden = true; }
  }

  function problemContext(lab, cur, st) {
    const lines = [
      `Course: introductory chemistry (Tro, Introductory Chemistry). ${lab.code ? 'General chemistry bridge unit ' + lab.code : 'Chapter ' + lab.ch}: ${lab.chapter}. Topic: ${lab.title}.`,
      `Problem type: ${strip(cur.type)}.`,
      `Problem: ${strip(cur.q)}`,
    ];
    if (cur.kind === 'choice') lines.push(`Choices: ${cur.choices.map(strip).join(' | ')}`);
    if (cur.unit) lines.push(`Answer units: ${strip(cur.unit)}`);
    lines.push(`Correct answer (from the answer key): ${strip(answerHTML(cur))}`);
    if (cur.explain) lines.push(`Answer key working: ${strip(cur.explain)}`);
    lines.push(st.attempts.length ? `The student's attempts so far, oldest first: ${st.attempts.map(a => JSON.stringify(a)).join(', ')}.` : 'The student has not tried an answer yet.');
    return lines.join('\n');
  }

  /* Hint / explain buttons under one practice problem */
  function attach(slot, lab, cur, state) {
    get().then(sample => {
      if (!sample || !slot.isConnected) return;
      slot.innerHTML = `<div class="tutor">
        <div class="btn-row"><button type="button" class="btn ghost t-hint">Hint from Claude</button><button type="button" class="btn ghost t-explain">Explain step by step</button><button type="button" class="btn ghost t-stop" hidden>Stop</button></div>
        <div class="tutor-out" aria-live="polite" hidden></div></div>`;
      const out = slot.querySelector('.tutor-out'), stop = slot.querySelector('.t-stop'), btns = slot.querySelectorAll('.t-hint, .t-explain');
      const ask = async (mode) => {
        btns.forEach(b => { b.disabled = true; });
        const st = state();
        const task = mode === 'hint'
          ? 'Give ONE hint, at most three sentences, that points the student to the next step. Do NOT state the final answer, the correct choice, or any number or name that is the answer. If they tried something, nudge them from where they went wrong.'
          : `Explain how to solve this problem in 4 to 7 short numbered steps (write "1.", "2." and so on), showing the setup, the units and why each step is done. ${st.attempts.length ? 'Start by saying in one sentence what likely went wrong in their attempt, if it was wrong.' : ''} Finish with the final answer on its own line.`;
        await run(sample, `You are a patient chemistry tutor.\n\n${problemContext(lab, cur, st)}\n\nTask: ${task}\n\n${STYLE}`, out, stop, { modelTier: mode === 'hint' ? 'quick' : 'default' });
        btns.forEach(b => { b.disabled = false; });
      };
      slot.querySelector('.t-hint').addEventListener('click', () => ask('hint'));
      slot.querySelector('.t-explain').addEventListener('click', () => ask('explain'));
    });
  }

  /* "Ask Claude" chat in a lab's rail */
  function chat(section, lab) {
    get().then(sample => {
      if (!sample || !section || !section.isConnected) return;
      section.hidden = false;
      const body = section.querySelector('#ask-body');
      const turns = chats[lab.id] || (chats[lab.id] = []);
      const suggestions = ['Explain the main idea simply', 'Give me a real-world example', 'Quiz me with one question', 'What mistakes do students make here?'];
      body.innerHTML = `<p class="note">Ask anything about ${lab.chapter.toLowerCase()}. Answers use your own Claude account.</p>
        <div class="chat-log" aria-live="polite"></div>
        <div class="chips sugg">${suggestions.map(s => `<button type="button" class="chip" data-q="${U.esc(s)}">${s}</button>`).join('')}</div>
        <form class="ans chat-form" novalidate><input id="ask-${lab.id}" autocomplete="off" placeholder="e.g. Why does ice float?" aria-label="Your question"><button class="btn primary" type="submit">Ask</button><button type="button" class="btn ghost c-stop" hidden>Stop</button></form>
        ${turns.length ? '<button type="button" class="btn ghost c-clear" style="justify-self:start">Clear chat</button>' : ''}`;
      const log = body.querySelector('.chat-log'), form = body.querySelector('form'), inp = form.querySelector('input'), stop = body.querySelector('.c-stop');
      const bubble = (role, text) => { const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = text; log.append(d); return d; };
      turns.forEach(t => bubble(t.role === 'user' ? 'me' : 'claude', t.content));
      const rules = `You are a friendly chemistry tutor inside a study app for an introductory chemistry course (Tro, Introductory Chemistry). The student is on ${lab.code ? 'general chemistry bridge unit ' + lab.code : 'Chapter ' + lab.ch}, ${lab.chapter} (${lab.title}). The chapter's key ideas, as the app shows them:\n${lab.ideas.map(i => '- ' + strip(i)).join('\n')}\n\nAnswer the student's questions about chemistry, focused on this chapter. Keep answers under about 150 words unless they ask for more. If they ask you to quiz them, ask one question and wait for their answer before revealing it. ${STYLE}`;
      let busy = false;
      async function send(q) {
        q = q.trim(); if (!q || busy) return;
        busy = true; inp.value = '';
        bubble('me', q); turns.push({ role: 'user', content: q });
        const out = bubble('claude', '');
        const text = await run(sample, [{ role: 'user', content: rules }, ...turns.slice(-12)], out, stop, { cache: false });
        if (text) turns.push({ role: 'assistant', content: text }); else if (!out.textContent) out.remove();
        busy = false; inp.focus();
        if (!body.querySelector('.c-clear')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost c-clear'; b.style.justifySelf = 'start'; b.textContent = 'Clear chat'; body.append(b); }
      }
      form.addEventListener('submit', e => { e.preventDefault(); send(inp.value); });
      body.addEventListener('click', e => {
        const s = e.target.closest('[data-q]'); if (s) send(s.dataset.q);
        if (e.target.closest('.c-clear')) { turns.length = 0; log.innerHTML = ''; e.target.remove(); }
      });
    });
  }

  /* "Explain this another way" on a lesson step */
  function explainStep(slot, lab, step) {
    get().then(sample => {
      if (!sample || !slot.isConnected) return;
      slot.innerHTML = `<div class="tutor"><div class="btn-row"><button type="button" class="btn ghost t-alt">Explain this another way</button><button type="button" class="btn ghost t-stop" hidden>Stop</button></div><div class="tutor-out" aria-live="polite" hidden></div></div>`;
      const out = slot.querySelector('.tutor-out'), stop = slot.querySelector('.t-stop'), b = slot.querySelector('.t-alt');
      b.addEventListener('click', async () => {
        b.disabled = true;
        const text = [`Lesson step: ${strip(step.t)}`, strip(step.body), step.ex ? 'Worked example: ' + step.ex.map(strip).join(' | ') : ''].join('\n');
        await run(sample, `You are a patient chemistry tutor. A student is reading this step of an introductory lesson on ${lab.chapter} (${lab.title}) and did not understand it.\n\n${text}\n\nRe-explain the same idea from scratch in a different way: start with an everyday analogy, then connect it to the chemistry, then give one tiny example with numbers if it fits. At most 170 words. Do not introduce new topics. ${STYLE}`, out, stop, { modelTier: 'default' });
        b.disabled = false;
      });
    });
  }

  return { attach, chat, explainStep, available: () => get().then(Boolean) };
})();
