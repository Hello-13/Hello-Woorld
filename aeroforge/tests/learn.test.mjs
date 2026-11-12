// Learning features: the Test me question generator (src/learn/quiz.js) and the part-search
// ranking (src/learn/search.js). Both are pure modules; `node --test tests/learn.test.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuiz, numberBlank, baseName, seededRandom, systemsOf, QUIZ_LENGTH, FIND_ATTEMPTS } from '../src/learn/quiz.js';
import { rankParts, tokens } from '../src/learn/search.js';
import FIGHTER from '../src/learn/tours/fighter.js';
import HUBBLE from '../src/learn/tours/hubble.js';

// A small fleet-like parts list in the shape of a part's userData.part record.
const P = (id, name, system, extra = {}) => ({ id: String(id), name, system, desc: '', skin: false, callout: false, mass: 10, count: null, material: '—', ...extra });
const PARTS = [
  P(0, 'Radome', 'Skin & fairings', { skin: true, desc: 'Frequency-selective nose cone over the radar.' }),
  P(1, 'Canopy', 'Skin & fairings', { skin: true, callout: true, desc: 'Single-piece polycarbonate transparency with a gold film.' }),
  P(2, 'Wing skin (left)', 'Skin & fairings', { skin: true }),
  P(3, 'Wing skin (right)', 'Skin & fairings', { skin: true }),
  P(4, 'Flaperon (left)', 'Flight controls', { desc: 'Trailing-edge surface that works as flap and aileron.' }),
  P(5, 'Flaperon (right)', 'Flight controls'),
  P(6, 'Rudder (left)', 'Flight controls', { desc: 'Hinged to the fin, moved by a 4,000 psi actuator.' }),
  P(7, 'Rudder (right)', 'Flight controls'),
  P(8, 'Stabilator actuator (left)', 'Flight controls', { mass: 40 }),
  P(9, 'F119 fan (right)', 'Propulsion', { mass: 300, desc: 'Three-stage fan with hollow titanium blades.' }),
  P(10, 'F119 HP compressor (right)', 'Propulsion', { mass: 260 }),
  P(11, 'F119 annular combustor (right)', 'Propulsion', { mass: 90, desc: 'Burns fuel at about 2,000 K; cooled liner.' }),
  P(12, 'Afterburner spray bars', 'Propulsion', { mass: 20 }),
  P(13, 'Forward fuselage tank', 'Fuel', { mass: 120, desc: 'Integral tank in the fuselage; feeds the engine pumps.' }),
  P(14, 'Fuel boost pump', 'Fuel', { mass: 15 }),
  P(15, 'Main landing gear (left)', 'Landing gear', { callout: true, mass: 260, desc: 'Oleo strut, torque links, carbon brakes.' }),
  P(16, 'Main landing gear (right)', 'Landing gear', { callout: true, mass: 260 }),
  P(17, 'Air-data probes', 'Sensors', { count: 4, desc: 'Pitot-static probes on the nose, electrically heated.' }),
  P(18, 'AN/APG-77 AESA array', 'Sensors', { mass: 250, desc: 'Fixed array of about 2,000 transmit/receive modules.' }),
  P(19, 'Common integrated processor (CIP 1)', 'Avionics', { mass: 80, desc: 'Mission computer rack with liquid cooling.' }),
  P(20, 'Hydraulic lines (system A)', 'Hydraulics', { desc: '4,000 psi lines from the pumps to every actuator.' }),
  P(21, 'Ejection seat', 'Crew systems', { mass: 120, desc: 'ACES II zero-zero seat.' }),
];

test('baseName strips handedness and numbering so twins are not offered as distractors', () => {
  assert.equal(baseName('Flaperon (left)'), 'flaperon');
  assert.equal(baseName('Main landing gear (right)'), 'main landing gear');
  assert.equal(baseName('Common integrated processor (CIP 1)'), 'common integrated processor');
  assert.equal(baseName('Radome'), 'radome');
});

test('seededRandom is deterministic and in [0, 1)', () => {
  const a = seededRandom(42), b = seededRandom(42);
  for (let i = 0; i < 50; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});

test('a session has ten mixed questions drawn from the vehicle', () => {
  const qs = generateQuiz({ parts: PARTS, steps: FIGHTER, otherSteps: HUBBLE, rng: seededRandom(3) });
  assert.equal(qs.length, QUIZ_LENGTH);
  const kinds = new Set(qs.map((q) => q.type));
  assert.ok(kinds.has('find') && kinds.has('name') && kinds.has('system'), `kinds ${[...kinds]}`);
  assert.ok(kinds.has('key') || kinds.has('number'), 'a tour-based question');
  for (const q of qs) {
    assert.ok(q.title);
    if (q.part) assert.ok(PARTS.includes(q.part), 'part comes from the vehicle');
    if (q.choices) {
      assert.ok(q.choices.length >= 4 || q.type === 'system', `${q.type} offers four choices`);
      assert.equal(new Set(q.choices).size, q.choices.length, 'choices are distinct');
      assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    }
  }
  // no part is asked about twice
  const used = qs.filter((q) => q.part).map((q) => q.part.id);
  assert.equal(new Set(used).size, used.length);
});

test('find questions carry the mode that makes the part findable', () => {
  const qs = generateQuiz({ parts: PARTS, steps: FIGHTER, rng: seededRandom(11) });
  for (const q of qs.filter((x) => x.type === 'find')) {
    assert.equal(q.attempts, FIND_ATTEMPTS);
    assert.equal(q.mode, q.part.skin || q.part.callout ? 'studio' : 'xray');
  }
  // a custom exterior test is honoured
  const all = generateQuiz({ parts: PARTS, steps: FIGHTER, rng: seededRandom(11), exterior: () => true });
  assert.ok(all.filter((q) => q.part).every((q) => q.mode === 'studio'));
});

test('name questions prefer distractors from the same system and never the twin part', () => {
  let seen = 0;
  for (let seed = 1; seed < 40; seed++) {
    for (const q of generateQuiz({ parts: PARTS, steps: FIGHTER, rng: seededRandom(seed) }).filter((x) => x.type === 'name')) {
      seen++;
      assert.equal(q.choices[q.answer], q.part.name);
      const others = q.choices.filter((c) => c !== q.part.name);
      for (const c of others) assert.notEqual(baseName(c), baseName(q.part.name), `${c} is a twin of ${q.part.name}`);
      const sameSys = PARTS.filter((p) => p.system === q.part.system && baseName(p.name) !== baseName(q.part.name)).length;
      const fromSys = others.filter((c) => PARTS.find((p) => p.name === c)?.system === q.part.system).length;
      assert.equal(fromSys, Math.min(3, sameSys), `${q.part.name}: ${fromSys} same-system distractors of ${sameSys} available`);
    }
  }
  assert.ok(seen > 10);
});

test('system questions offer the systems in the legend (those with solid parts) and never ask about a skin', () => {
  const legend = systemsOf(PARTS.filter((p) => !p.skin));
  assert.ok(!legend.includes('Skin & fairings'));
  assert.equal(legend[0], 'Flight controls');          // most parts first, like the legend
  for (let seed = 1; seed < 20; seed++) {
    for (const q of generateQuiz({ parts: PARTS, steps: FIGHTER, rng: seededRandom(seed) }).filter((x) => x.type === 'system')) {
      assert.ok(!q.part.skin);
      assert.deepEqual(q.choices, legend);
      assert.equal(q.choices[q.answer], q.part.system);
    }
  }
});

test('key-idea questions use the step body and draw distractors from other steps and vehicles', () => {
  const qs = generateQuiz({ parts: PARTS, steps: FIGHTER.slice(0, 2), otherSteps: HUBBLE, rng: seededRandom(5) });
  const keys = qs.filter((q) => q.type === 'key');
  assert.ok(keys.length >= 1);
  const allKeys = new Set([...FIGHTER, ...HUBBLE].map((s) => s.key));
  for (const q of keys) {
    assert.equal(q.body, q.step.body);
    assert.equal(q.choices[q.answer], q.step.key);
    for (const c of q.choices) assert.ok(allKeys.has(c));
  }
});

test('numberBlank blanks a real figure and offers plausible, distinct alternatives', () => {
  const b = numberBlank('Thrust ≈ ṁ (V_exit − V_flight): 116 kN dry and 156 kN with afterburner, from a 2,270 kg engine.', seededRandom(1));
  assert.ok(b);
  assert.ok(b.prompt.includes('___'));
  assert.equal(b.choices.length, 4);
  assert.equal(new Set(b.choices).size, 4);
  assert.equal(b.choices[b.answer], b.value);
  assert.ok(['116', '156', '2,270'].includes(b.value));
  // the blank replaces exactly that figure
  assert.equal(b.prompt.replace('___', b.value), 'Thrust ≈ ṁ (V_exit − V_flight): 116 kN dry and 156 kN with afterburner, from a 2,270 kg engine.');
  // thousands separators and decimals follow the original
  const d = numberBlank('θ = 1.22 λ / D = 0.052″ at 500 nm.', seededRandom(2));
  assert.ok(d && d.choices.every((c) => /^\d+(\.\d+)?$/.test(c)));
});

test('numberBlank leaves designations, exponents and dates alone', () => {
  assert.equal(numberBlank('F119 and the T700-GE-701D, LC-39A and 10⁻³.'), null);
  assert.equal(numberBlank('On Jason-3 (January 2016) the stage tipped over.'), null);
  assert.equal(numberBlank('Electronic steering moves the beam in microseconds.'), null);
  const b = numberBlank('Each F119 gives 116 kN dry.', seededRandom(1));
  assert.equal(b.value, '116');
});

test('generator copes with a vehicle that has no tour and with tiny part lists', () => {
  const qs = generateQuiz({ parts: PARTS, steps: [], otherSteps: [], rng: seededRandom(9) });
  assert.equal(qs.length, QUIZ_LENGTH);
  assert.ok(qs.every((q) => q.type !== 'key' && q.type !== 'number'));
  assert.deepEqual(generateQuiz({ parts: PARTS.slice(0, 3) }), []);
});

// ------------------------------------------------------------------ search ranking
test('tokens splits names into searchable words', () => {
  assert.deepEqual(tokens('AN/APG-77 AESA array'), ['an/apg-77', 'aesa', 'array']);
  assert.deepEqual(tokens('Burns fuel at about 2,000 K; cooled liner.'), ['burns', 'fuel', 'at', 'about', '2', '000', 'k', 'cooled', 'liner']);
});

test('name matches outrank system matches, which outrank description matches', () => {
  const r = rankParts(PARTS, 'fuel');
  const names = r.map((x) => x.part.name);
  assert.equal(names[0], 'Fuel boost pump');                      // name starts with the query
  assert.ok(names.indexOf('Forward fuselage tank') < names.indexOf('Hydraulic lines (system A)') || !names.includes('Hydraulic lines (system A)'));
  const fields = Object.fromEntries(r.map((x) => [x.part.name, x.field]));
  assert.equal(fields['Fuel boost pump'], 'name');
  assert.equal(fields['Forward fuselage tank'], 'system');       // its system is Fuel
  assert.equal(fields['F119 annular combustor (right)'], 'desc');  // "Burns fuel"
  assert.ok(r.findIndex((x) => x.field === 'desc') > r.findIndex((x) => x.field === 'system'));
});

test('every query word must match somewhere; word-start beats mid-word; results are capped', () => {
  assert.deepEqual(rankParts(PARTS, 'landing gear left').map((x) => x.part.name), ['Main landing gear (left)']);
  const r = rankParts(PARTS, 'rud');
  assert.deepEqual(r.map((x) => x.part.name), ['Rudder (left)', 'Rudder (right)']);
  assert.equal(rankParts(PARTS, 'xyzzy').length, 0);
  assert.equal(rankParts(PARTS, '').length, 0);
  assert.equal(rankParts(PARTS, 'e', { limit: 5 }).length, 5);
  // description words: "pitot" is only in the probes' description
  assert.equal(rankParts(PARTS, 'pitot')[0].part.name, 'Air-data probes');
  assert.equal(rankParts(PARTS, 'pitot')[0].field, 'desc');
  // designations with slashes and hyphens
  assert.equal(rankParts(PARTS, 'apg-77')[0].part.name, 'AN/APG-77 AESA array');
  assert.equal(rankParts(PARTS, '4,000 psi')[0].field, 'desc');
});
