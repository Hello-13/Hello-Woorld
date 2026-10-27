// Part search: ranks a vehicle's parts against what the learner types. Pure (no DOM, no three),
// so tests/learn.test.mjs can check the ranking. A part is any object with { name, system, desc,
// material? }: the app passes each part's userData.part record.
//
// Ranking, best first: the whole query at the start of the name, then every query word at the
// start of a name word, then every word somewhere in the name, then the system, then the
// description (or material) words. Ties break on the shorter name, then alphabetically.

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’\-/.]*/gu;

/** Lower-case words of a text (letters, digits, and the hyphens / slashes inside designations). */
export function tokens(text) {
  return (String(text || '').toLowerCase().match(WORD) || []).map((w) => w.replace(/[.'’]+$/, ''));
}

/** Where a query word hits: 0 none, 1 inside a word, 2 at the start of a word, 3 the whole word. */
function hit(words, q) {
  let best = 0;
  for (const w of words) {
    if (w === q) return 3;
    if (w.startsWith(q)) best = Math.max(best, 2);
    else if (best < 1 && w.includes(q)) best = 1;
  }
  return best;
}

/**
 * Score one part for a query (already lower-cased and tokenised). Returns { score, field } or null:
 * field says which field carried the match ('name' | 'system' | 'desc').
 */
export function scorePart(part, qWords, qText) {
  if (!qWords.length) return null;
  const name = String(part.name || '').toLowerCase();
  const nameWords = tokens(name);
  const sysWords = tokens(part.system);
  let score = 0, field = null;
  if (name.startsWith(qText)) { score += 1000; field = 'name'; }
  else if (name.includes(qText)) { score += 600; field = 'name'; }
  let nameAll = true, sysAll = true, descAll = true, nameScore = 0;
  let descWords = null;
  for (const q of qWords) {
    const n = hit(nameWords, q);
    if (n) nameScore += n === 3 ? 120 : n === 2 ? 100 : 60; else nameAll = false;
    if (!hit(sysWords, q)) sysAll = false;
    if (!n && !hit(sysWords, q)) {
      descWords ||= tokens(`${part.desc || ''} ${part.material || ''}`);
      if (!hit(descWords, q)) descAll = false;
    }
  }
  if (nameAll) { score += 300 + nameScore; field ||= 'name'; }
  else if (sysAll) { score += 200; field ||= 'system'; }
  else if (descAll) { score += 100 + nameScore * 0.25; field ||= 'desc'; }
  else return null;
  return { score, field };
}

/** Rank parts for a query. Returns [{ part, score, field }] best first, at most `limit`. */
export function rankParts(parts, query, { limit = 12 } = {}) {
  const qText = String(query || '').trim().toLowerCase();
  const qWords = tokens(qText);
  if (!qWords.length) return [];
  const out = [];
  for (const part of parts) {
    const s = scorePart(part, qWords, qText);
    if (s) out.push({ part, score: s.score, field: s.field });
  }
  out.sort((a, b) => b.score - a.score || a.part.name.length - b.part.name.length || a.part.name.localeCompare(b.part.name));
  return out.slice(0, limit);
}
