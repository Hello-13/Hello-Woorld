// Test me: a ten-question quiz generated from the vehicle on deck, so every vehicle gets one for
// free. Question kinds: find a named part on the model (three clicks, then it is revealed), name a
// highlighted part (four choices, distractors from the same system), say which system a part
// belongs to, and a tour step's key idea (pick it among four, or fill in a number blanked out of
// its key line).
//
// The generator (generateQuiz and its helpers) is pure: plain part records and tour steps in,
// question objects out, with an injectable random source so tests/learn.test.mjs can check it.
// QuizPlayer below drives the card and the model through hooks supplied by the app shell.

import { el } from '../ui/dom.js';

export const QUIZ_LENGTH = 10;
export const FIND_ATTEMPTS = 3;

/** Deterministic random source (mulberry32) for tests and repeatable sessions. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** 'Aileron (left)' → 'aileron': twins of a part are not offered as distractors for it. */
export function baseName(name) {
  return String(name || '').toLowerCase()
    .replace(/\s*\((left|right|port|starboard|fwd|aft|forward|upper|lower|inboard|outboard|inner|outer|top|bottom|(?:[a-z]+\s?)?[a-z]?\d+[a-z]?|[a-z]+\s[a-z])\)\s*$/i, '')
    .replace(/\s+\d+$/, '').trim();
}

/** Exterior by the data alone: skins, panels and doors, and parts important enough for a callout. */
export const exteriorByData = (p) => !!(p.skin || p.callout);

// -------------------------------------------------------------------------------- number blanks
const MONTHS = /(january|february|march|april|may|june|july|august|september|october|november|december)\s*$/i;
const NUM = /(?<![\p{L}\p{N}.\-−/^])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\p{L}\p{N}⁰¹²³⁴⁵⁶⁷⁸⁹⁻,.]|\.\d)/gu;

function formatLike(x, sample) {
  const decimals = (sample.split('.')[1] || '').length;
  const grouped = sample.includes(',') || Math.abs(x) >= 10000;
  let s = decimals ? x.toFixed(decimals) : String(Math.round(x));
  if (grouped) {
    const [int, frac] = s.split('.');
    s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
  }
  return s;
}

/**
 * Blank one number out of a key line: { prompt, answer, choices, index }. Numbers glued to letters
 * (F119, LC-39A), exponents, years after a month name and plain years are left alone. Returns null
 * when the line has no usable number or too few distinct distractors can be made.
 */
export function numberBlank(key, rng = Math.random) {
  const text = String(key || '');
  const found = [];
  for (const m of text.matchAll(NUM)) {
    const str = m[1], at = m.index;
    const value = parseFloat(str.replace(/,/g, ''));
    if (!Number.isFinite(value) || value === 0) continue;
    const before = text.slice(0, at);
    if (MONTHS.test(before)) continue;
    if (!str.includes(',') && !str.includes('.') && value >= 1900 && value <= 2100) continue;
    const after = text.slice(at + str.length);
    const unit = /^\s?[\p{L}°″′%µ]/u.test(after);
    found.push({ str, at, value, unit });
  }
  if (!found.length) return null;
  const withUnit = found.filter((f) => f.unit);
  const pool = withUnit.length ? withUnit : found;
  const chosen = pick(pool, rng);
  const factors = shuffle([2, 0.5, 10, 0.1, 3, 1 / 3, 4, 0.25, 1.5, 2 / 3, 5, 0.2], rng);
  const choices = new Set([chosen.str]);
  for (const f of factors) {
    const s = formatLike(chosen.value * f, chosen.str);
    if (parseFloat(s.replace(/,/g, '')) === 0) continue;
    choices.add(s);
    if (choices.size === 4) break;
  }
  if (choices.size < 4) return null;
  const list = shuffle([...choices], rng);
  return {
    prompt: `${text.slice(0, chosen.at)}___${text.slice(chosen.at + chosen.str.length)}`,
    answer: list.indexOf(chosen.str),
    choices: list,
    value: chosen.str,
  };
}

// -------------------------------------------------------------------------------- the generator
/** Systems present on these parts, most parts first, skin-only systems last. */
export function systemsOf(parts) {
  const map = new Map();
  for (const p of parts) {
    const e = map.get(p.system) || { name: p.system, n: 0, solid: 0 };
    e.n++; if (!p.skin) e.solid++;
    map.set(p.system, e);
  }
  return [...map.values()].sort((a, b) => (b.solid > 0) - (a.solid > 0) || b.n - a.n).map((e) => e.name);
}

function nameChoices(part, parts, rng) {
  const base = baseName(part.name);
  const ok = (p) => p !== part && baseName(p.name) !== base && p.name !== part.name;
  const same = shuffle(parts.filter((p) => ok(p) && p.system === part.system), rng);
  const other = shuffle(parts.filter((p) => ok(p) && p.system !== part.system), rng);
  const names = [];
  for (const p of [...same, ...other]) {
    if (names.includes(p.name)) continue;
    names.push(p.name);
    if (names.length === 3) break;
  }
  if (names.length < 3) return null;
  const choices = shuffle([part.name, ...names], rng);
  return { choices, answer: choices.indexOf(part.name) };
}

/**
 * Build a session. parts: plain records { id, name, system, desc, skin, callout, mass, count };
 * steps: this vehicle's tour steps; otherSteps: steps from other vehicles (key-idea distractors);
 * exterior(part): whether a part can be found from outside (default: skins and callout parts).
 */
export function generateQuiz({ parts, steps = [], otherSteps = [], n = QUIZ_LENGTH, rng = Math.random, exterior = exteriorByData } = {}) {
  const all = (parts || []).filter((p) => p && p.name);
  if (all.length < 4) return [];
  const ext = all.filter(exterior);
  const inner = all.filter((p) => !exterior(p)).sort((a, b) => (b.mass || 0) - (a.mass || 0));
  const innerBig = inner.slice(0, Math.max(4, Math.ceil(inner.length / 2)));
  const systems = systemsOf(all);
  const solidSystems = systemsOf(all.filter((p) => !p.skin));
  const keyed = steps.filter((s) => s && s.key);
  const otherKeys = otherSteps.filter((s) => s && s.key).map((s) => s.key);
  const used = new Set();
  const take = (pool) => {
    const fresh = pool.filter((p) => !used.has(p));
    if (!fresh.length) return null;
    const p = pick(fresh, rng);
    used.add(p);
    return p;
  };
  const usedSteps = new Set();
  const takeStep = () => {
    const fresh = keyed.filter((s) => !usedSteps.has(s));
    if (!fresh.length) return null;
    const s = pick(fresh, rng);
    usedSteps.add(s);
    return s;
  };

  const makers = {
    find() {
      const pool = ext.length && (rng() < 0.6 || !innerBig.length) ? ext : innerBig.length ? innerBig : ext;
      const part = take(pool) || take(all);
      if (!part) return null;
      return { type: 'find', part, mode: exterior(part) ? 'studio' : 'xray', title: 'Find the part', attempts: FIND_ATTEMPTS };
    },
    name() {
      const pool = all.filter((p) => p.desc);
      const part = take(pool.length >= 8 ? pool : all);
      if (!part) return null;
      const c = nameChoices(part, all, rng);
      if (!c) return null;
      return { type: 'name', part, mode: exterior(part) ? 'studio' : 'xray', title: 'Name this part', ...c };
    },
    system() {
      if (solidSystems.length < 2) return null;
      const part = take(all.filter((p) => !p.skin));
      if (!part) return null;
      const choices = solidSystems.includes(part.system) ? solidSystems : [...solidSystems, part.system];
      return { type: 'system', part, mode: exterior(part) ? 'studio' : 'xray', title: 'Which system?', choices, answer: choices.indexOf(part.system) };
    },
    key() {
      const step = takeStep();
      if (!step) return null;
      const others = shuffle([...keyed.filter((s) => s !== step).map((s) => s.key), ...shuffle(otherKeys, rng)], rng)
        .filter((k, i, a) => k !== step.key && a.indexOf(k) === i).slice(0, 3);
      if (others.length < 3) { usedSteps.delete(step); return null; }
      const choices = shuffle([step.key, ...others], rng);
      return { type: 'key', step, title: step.title, body: step.body, choices, answer: choices.indexOf(step.key) };
    },
    number() {
      for (let tries = 0; tries < 4; tries++) {
        const step = takeStep();
        if (!step) return null;
        const b = numberBlank(step.key, rng);
        if (b) return { type: 'number', step, title: step.title, body: step.body, prompt: b.prompt, choices: b.choices, answer: b.answer, value: b.value };
      }
      return null;
    },
  };

  const cycle = ['find', 'name', 'system', 'key', 'find', 'name', 'number', 'system'];
  const fallback = { key: ['number', 'name', 'find'], number: ['key', 'name', 'find'], system: ['name', 'find'], name: ['find', 'system'], find: ['name', 'system'] };
  const out = [];
  for (let i = 0; out.length < n && i < n * 3; i++) {
    const want = cycle[i % cycle.length];
    let q = makers[want]();
    for (const alt of fallback[want]) { if (q) break; q = makers[alt](); }
    if (q) out.push(q);
  }
  // mix the kinds, avoiding two of a kind in a row where possible
  let best = out;
  for (let k = 0; k < 12; k++) {
    const s = shuffle(out, rng);
    const runs = s.reduce((a, q, i) => a + (i && s[i - 1].type === q.type ? 1 : 0), 0);
    if (runs === 0) { best = s; break; }
    if (k === 0 || runs < best.reduce((a, q, i) => a + (i && best[i - 1].type === q.type ? 1 : 0), 0)) best = s;
  }
  return best;
}

// -------------------------------------------------------------------------------- the player
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const STORE = 'aeroforge.quiz.';

export function loadBest(id) {
  try { return JSON.parse(localStorage.getItem(STORE + id) || 'null'); } catch { return null; }
}
export function saveBest(id, result) {
  try { localStorage.setItem(STORE + id, JSON.stringify(result)); } catch { /* storage blocked */ }
}

export class QuizPlayer {
  /**
   * hooks: {
   *   getVehicle(), getId(), steps(id) → tour steps, otherSteps(id) → steps of the other vehicles,
   *   isExterior(partGroup) → bool, setMode(m, {quiet}), focusPart(group), frame(),
   *   highlight(group | null), keep(groups | null) (ghost everything else; null shows all),
   *   spotlight(step) (tour-style framing of a key-idea step), snapshot() / restore(snap),
   *   systemColor(name), log(src, msg, level), onStart(), onStop()
   * }
   */
  constructor(card, hooks) {
    this.card = card;
    this.h = hooks;
    this.questions = null;
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.stop();
      else if (e.key === 'Enter' && this.resolved && !e.target.closest('button')) { this.next(); e.preventDefault(); }
    });
  }

  get active() { return !!this.questions; }

  start() {
    if (this.active) return;
    const v = this.h.getVehicle();
    if (!v) return;
    const id = this.h.getId();
    const byId = new Map(v.parts.map((p) => [p.userData.part.id, p]));
    const parts = v.parts.map((p) => p.userData.part);
    this.questions = generateQuiz({ parts, steps: this.h.steps(id) || [], otherSteps: this.h.otherSteps(id) || [] });
    if (!this.questions.length) { this.questions = null; return; }
    this.byId = byId;
    this.id = id;
    this.snap = this.h.snapshot();
    this.i = 0; this.score = 0; this.streak = 0; this.bestStreak = 0; this.missed = [];
    this.results = []; this.done = false; this.review = null; this.newBest = false;
    this.t0 = performance.now();
    this.elapsed = 0;
    this.timer = setInterval(() => this.tick(), 1000);
    this.h.onStart?.();
    this.h.log('LEARN', `Test me: ${this.questions.length} questions on the ${v.name}`, 'ok');
    this.show(0);
  }

  stop({ silent = false } = {}) {
    if (!this.active) return;
    clearInterval(this.timer);
    this.questions = null;
    this.review = null;
    this.card.hidden = true;
    this.h.keep(null);
    this.h.highlight(null);
    this.h.restore(this.snap);
    this.h.onStop?.();
    if (!silent) this.h.log('LEARN', 'Test me closed');
  }

  tick() {
    if (!this.active || this.done) return;
    this.elapsed = performance.now() - this.t0;
    const t = this.card.querySelector('.quiz-time');
    if (t) t.textContent = mmss(this.elapsed);
  }

  group(part) { return this.byId.get(part.id); }

  /** Visible-from-outside check on the real geometry overrides the data-only guess. */
  modeFor(q) {
    const g = this.group(q.part);
    const ext = this.h.isExterior(g);
    q.mode = ext ? 'studio' : 'xray';
    return q.mode;
  }

  show(i) {
    const q = this.questions[i];
    if (!q) return;
    this.i = i;
    this.resolved = false;
    this.feedback = null;
    this.attempts = 0;
    this.dimmed = [];
    this.note = null;
    this.chosen = null;
    this.h.keep(null);
    this.h.highlight(null);
    if (q.type === 'find') {
      const mode = this.modeFor(q);
      this.h.setMode(mode, { quiet: true });
      if (mode === 'xray') this.note = 'This part sits inside, so the view is X-ray: skins are see-through and clicks pass through them.';
      this.h.frame();
    } else if (q.type === 'name' || q.type === 'system') {
      const g = this.group(q.part);
      this.h.setMode(this.modeFor(q), { quiet: true });
      this.h.highlight(g);
      this.h.focusPart(g);
    } else {
      this.h.spotlight(q.step);
    }
    this.render();
  }

  /** A click on the model (null = empty space). */
  onPick(group) {
    const q = this.questions?.[this.i];
    if (!q || q.type !== 'find' || this.resolved || !group) return;
    const info = group.userData.part;
    if (info === q.part) {
      this.resolve(true, `Correct, that is the ${info.name}.`);
      this.h.highlight(group);
      return;
    }
    this.attempts++;
    this.dimmed.push(group);
    const keep = this.h.getVehicle().parts.filter((p) => !this.dimmed.includes(p));
    this.h.keep(keep);
    if (this.attempts >= q.attempts) {
      const g = this.group(q.part);
      this.h.keep(null);
      this.h.highlight(g);
      this.h.focusPart(g);
      this.resolve(false, `That was the ${info.name} (${info.system}). The ${q.part.name} is highlighted here.`);
      return;
    }
    this.feedback = { ok: false, text: `That is the ${info.name} (${info.system}), not it. ${q.attempts - this.attempts} ${q.attempts - this.attempts === 1 ? 'try' : 'tries'} left.` };
    this.render();
  }

  answer(k) {
    const q = this.questions?.[this.i];
    if (!q || this.resolved || q.choices == null) return;
    this.chosen = k;
    const ok = k === q.answer;
    const right = q.choices[q.answer];
    let text;
    if (q.type === 'name') text = ok ? `Correct, the ${right}.` : `No: this is the ${right}.`;
    else if (q.type === 'system') text = ok ? `Correct, ${right}.` : `No: the ${q.part.name} belongs to ${right}.`;
    else if (q.type === 'number') text = ok ? `Correct: ${right}.` : `No: the figure is ${right}.`;
    else text = ok ? 'Correct.' : 'No, the key idea of this step is highlighted below.';
    this.resolve(ok, text);
  }

  resolve(ok, text) {
    const q = this.questions[this.i];
    this.resolved = true;
    if (ok) { this.score++; this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); }
    else { this.streak = 0; if (q.part) this.missed.push(q.part); }
    this.feedback = { ok, text };
    this.render();
  }

  next() {
    if (!this.active || !this.resolved) return;
    if (this.i < this.questions.length - 1) this.show(this.i + 1);
    else this.finish();
  }

  finish() {
    this.done = true;
    clearInterval(this.timer);
    this.elapsed = performance.now() - this.t0;
    this.h.keep(null);
    this.h.highlight(null);
    const result = { score: this.score, total: this.questions.length, time: Math.round(this.elapsed / 1000), streak: this.bestStreak, when: Date.now() };
    const prev = loadBest(this.id);
    this.newBest = !prev || result.score > prev.score || (result.score === prev.score && result.time < prev.time);
    if (this.newBest) saveBest(this.id, result);
    this.best = this.newBest ? result : prev;
    this.h.log('LEARN', `Test me: ${result.score} of ${result.total} in ${mmss(this.elapsed)}, best streak ${result.streak}`, result.score >= result.total * 0.7 ? 'ok' : undefined);
    this.renderEnd();
  }

  restart() {
    const snap = this.snap;
    clearInterval(this.timer);
    this.questions = null; this.done = false; this.review = null;
    this.h.keep(null); this.h.highlight(null);
    this.start();
    this.snap = snap;     // the view to go back to is the one before the first session
  }

  /** Review the missed parts one at a time: focus and highlight each in turn. */
  reviewNext() {
    if (!this.missed.length) return;
    this.review = this.review == null ? 0 : (this.review + 1) % this.missed.length;
    const part = this.missed[this.review];
    const g = this.group(part);
    this.h.setMode(this.h.isExterior(g) ? 'studio' : 'xray', { quiet: true });
    this.h.highlight(g);
    this.h.focusPart(g);
    this.renderEnd();
  }

  // ------------------------------------------------------------------ rendering
  head(label) {
    const close = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close the quiz', text: '×' });
    close.addEventListener('click', () => this.stop());
    return el('div', { class: 'tour-top' },
      el('span', { class: 'tour-step', text: label }),
      el('span', { class: 'quiz-meta' },
        el('span', { title: 'Score' }, el('b', { text: this.score }), ` / ${this.questions.length}`),
        el('span', { title: 'Current streak', class: this.streak >= 3 ? 'is-hot' : null }, el('b', { text: this.streak }), ' streak'),
        el('span', { class: 'quiz-time', text: mmss(this.elapsed) })),
      el('span', { class: 'tour-actions' }, close));
  }

  partChip(part) {
    return el('span', { class: 'quiz-part' },
      el('span', { class: 'sys-dot', style: `background:${this.h.systemColor(part.system)}` }),
      el('b', { text: part.name }), el('span', { class: 'quiz-sys', text: part.system }));
  }

  render() {
    const q = this.questions[this.i];
    const n = this.questions.length;
    const body = [];
    if (q.type === 'find') {
      body.push(el('p', { class: 'tour-body' }, 'Click this part on the model. ', this.partChip(q.part)));
      const dots = el('span', { class: 'quiz-tries', 'aria-label': `${q.attempts - this.attempts} tries left` });
      for (let k = 0; k < q.attempts; k++) dots.append(el('i', { class: k < this.attempts ? 'is-used' : null }));
      body.push(el('p', { class: 'quiz-tries-row' }, el('span', { text: 'Tries' }), dots));
    } else if (q.type === 'name') {
      body.push(el('p', { class: 'tour-body', text: 'The highlighted part is the…' }));
    } else if (q.type === 'system') {
      body.push(el('p', { class: 'tour-body', text: 'The highlighted part belongs to which system?' }));
    } else if (q.type === 'key') {
      body.push(el('p', { class: 'tour-body', text: q.body }), el('p', { class: 'quiz-ask', text: 'Which is the key idea of this step?' }));
    } else if (q.type === 'number') {
      body.push(el('p', { class: 'tour-body', text: q.body }), el('p', { class: 'tour-key' }, el('span', { class: 'tour-key-label', text: 'Key idea · fill the blank' }), el('span', { text: q.prompt })));
    }
    if (q.choices) {
      const list = el('div', { class: `quiz-choices${q.type === 'system' ? ' is-chips' : ''}`, role: 'group', 'aria-label': 'Answers' });
      q.choices.forEach((c, k) => {
        const b = el('button', { type: 'button', class: 'quiz-choice', 'data-state': this.resolved ? (k === q.answer ? 'ok' : k === this.chosen ? 'crit' : 'off') : null },
          q.type === 'system' ? el('span', { class: 'sys-dot', style: `background:${this.h.systemColor(c)}` }) : el('span', { class: 'quiz-letter', text: 'ABCD'[k] || k + 1 }),
          el('span', { text: c }));
        b.disabled = this.resolved;
        b.addEventListener('click', () => this.answer(k));
        list.append(b);
      });
      body.push(list);
    }
    if (this.note && !this.resolved) body.push(el('p', { class: 'quiz-note', text: this.note }));
    if (this.feedback) body.push(el('p', { class: 'quiz-feedback', 'data-state': this.feedback.ok ? 'ok' : 'crit', role: 'status', text: this.feedback.text }));
    const next = el('button', { type: 'button', class: 'btn btn-primary', text: this.i === n - 1 ? 'Finish' : 'Next' });
    next.disabled = !this.resolved;
    next.addEventListener('click', () => this.next());
    const skip = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Skip' });
    skip.disabled = this.resolved;
    skip.addEventListener('click', () => {
      if (q.part) { const g = this.group(q.part); this.h.keep(null); this.h.highlight(g); this.h.focusPart(g); }
      const right = q.choices ? q.choices[q.answer] : q.part.name;
      this.resolve(false, q.type === 'find' ? `Skipped: the ${q.part.name} is highlighted here.` : `Skipped: ${right}.`);
    });
    if (this.resolved) this.results[this.i] = this.feedback?.ok ? 'ok' : 'crit';
    const dots = el('ol', { class: 'tour-dots', 'aria-label': 'Progress' });
    for (let k = 0; k < n; k++) dots.append(el('li', {}, el('span', { class: 'tour-dot', 'aria-current': String(k === this.i), 'data-state': this.results[k] || null })));
    this.card.replaceChildren(
      this.head(`Test me · ${this.i + 1} of ${n}`),
      el('h3', { class: 'tour-title', text: q.title }),
      ...body,
      el('div', { class: 'tour-nav' }, skip, dots, next),
    );
    this.card.hidden = false;
    (this.resolved ? next : this.card.querySelector('.quiz-choice') || next).focus({ preventScroll: true });
  }

  renderEnd() {
    const n = this.questions.length;
    const r = this.score / n;
    const verdict = r === 1 ? 'Perfect run.' : r >= 0.8 ? 'Strong work.' : r >= 0.5 ? 'A fair pass; review the misses below.' : 'Keep going: the review below shows each missed part in place.';
    const b = this.best;
    const facts = el('dl', { class: 'quiz-facts' },
      el('div', {}, el('dt', { text: 'Score' }), el('dd', {}, `${this.score}`, el('span', { class: 'stat-unit', text: `/ ${n}` }))),
      el('div', {}, el('dt', { text: 'Time' }), el('dd', { text: mmss(this.elapsed) })),
      el('div', {}, el('dt', { text: 'Best streak' }), el('dd', { text: this.bestStreak })),
      el('div', {}, el('dt', { text: this.newBest ? 'New best' : 'Best so far' }), b ? el('dd', {}, `${b.score}`, el('span', { class: 'stat-unit', text: `/ ${b.total || n} in ${mmss(b.time * 1000)}` })) : el('dd', { text: '—' })));
    const missed = [...new Set(this.missed)];
    const review = [];
    if (missed.length) {
      const rows = el('ul', { class: 'quiz-missed' }, missed.map((p, k) => {
        const b = el('button', { type: 'button', class: 'part-row', 'aria-current': String(k === this.review) }, el('span', { class: 'pr-name' }, el('span', { class: 'sys-dot', style: `background:${this.h.systemColor(p.system)}` }), el('span', { text: p.name })), el('span', { class: 'pr-mass', text: p.system }));
        b.addEventListener('click', () => { this.review = k - 1; this.reviewNext(); });
        return el('li', {}, b);
      }));
      review.push(el('p', { class: 'quiz-ask', text: `Missed · ${missed.length} ${missed.length === 1 ? 'part' : 'parts'}` }), rows);
    } else review.push(el('p', { class: 'quiz-ask', text: 'Nothing missed on the model.' }));
    const again = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Play again' });
    again.addEventListener('click', () => this.restart());
    const close = el('button', { type: 'button', class: 'btn btn-primary', text: 'Done' });
    close.addEventListener('click', () => this.stop());
    const rev = el('button', { type: 'button', class: 'btn btn-secondary', text: this.review == null ? 'Review' : missed.length > 1 ? 'Next part' : 'Show again' });
    rev.disabled = !missed.length;
    rev.addEventListener('click', () => this.reviewNext());
    this.card.replaceChildren(
      this.head('Test me · complete'),
      el('h3', { class: 'tour-title', text: verdict }),
      facts,
      ...review,
      el('div', { class: 'tour-nav' }, el('span', { class: 'btn-row' }, rev, again), close),
    );
    this.card.hidden = false;
    close.focus({ preventScroll: true });
  }
}
