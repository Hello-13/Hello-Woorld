import { useEffect, useRef, useState } from 'preact/hooks';
import { huntHeat, recentDays, streak, type PracticeData } from '../state/practice';
import { useTuning } from '../state/settings';
import { INTERVALS } from '../theory/intervals';
import { getChordType } from '../theory/chords';
import { midiName } from '../theory/notes';
import { getTune } from '../theory/melody';
import { TOOLS, toolInfo, type ToolId } from '../tools/registry';
import { Seg, StopIcon } from './ui';

/**
 * The practice coach asks Claude, through the claude.ai Artifact runtime, on the viewer's own
 * account. Anywhere else (GitHub Pages, a saved file) there is no `window.claude`, and the panel
 * never appears.
 */

interface SampleError {
  code: string;
  message: string;
  text?: string;
}

interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  modelTier?: 'default' | 'complex' | 'quick';
  cache?: boolean;
}

interface SampleFn {
  (input: string, options?: SampleOptions): Promise<{ text: string; truncated: boolean }>;
  json<T>(input: string, options?: SampleOptions): Promise<T>;
}

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

function useSample(): [SampleFn | null, () => void] {
  const [sample, setSample] = useState<SampleFn | null>(null);
  useEffect(() => {
    let alive = true;
    const runtime = typeof window !== 'undefined' ? window.claude : undefined;
    if (!runtime?.use) return;
    runtime
      .use('sample')
      .then((s) => {
        if (alive && typeof s === 'function') setSample(() => s as SampleFn);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return [sample, () => setSample(null)];
}

/** Errors after which the feature should simply disappear for this view. */
const GONE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

function errorCopy(code: string): string {
  switch (code) {
    case 'rate_limited':
      return 'Claude has had a lot of questions from you just now. Try again in a minute.';
    case 'session_expired':
      return 'Your claude.ai session has expired. Sign in again, then retry.';
    case 'invalid_json':
      return 'The plan came back in a shape I couldn’t read. Ask again.';
    case 'refused':
      return 'Claude declined that one. Try asking it differently.';
    case 'prompt_too_large':
      return 'That question is too long. Shorten it and ask again.';
    default:
      return 'Something went wrong reaching Claude. Try again.';
  }
}

/** A compact, plain-text picture of the practice log for the prompt. */
export function practiceSummary(p: PracticeData, tuning: number[]): string {
  const lines: string[] = [];
  const week = recentDays(p, 7);
  const perTool: Record<string, number> = {};
  for (const d of week) for (const [tool, s] of Object.entries(p.days[d.key] ?? {})) perTool[tool] = (perTool[tool] ?? 0) + s;
  lines.push(`Day streak: ${streak(p)}. Minutes in the last 7 days: ${Math.round(week.reduce((s, d) => s + d.minutes, 0))}.`);
  const used = Object.entries(perTool)
    .sort((a, b) => b[1] - a[1])
    .map(([t, s]) => `${TOOLS.find((x) => x.id === t)?.name ?? t} ${Math.round(s / 60)} min`);
  lines.push(`Time per tool this week: ${used.length ? used.join(', ') : 'nothing logged yet'}.`);

  const weak = Object.entries(p.huntStats)
    .filter(([, st]) => st.seen >= 2)
    .map(([k, st]) => ({ k, heat: huntHeat(st), st }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6)
    .filter((x) => x.heat > 0.3)
    .map(({ k, st }) => {
      const [s, f] = k.split(':').map(Number);
      return `${midiName(tuning[s] + f)} on string ${tuning.length - s} fret ${f} (${st.miss}/${st.seen} missed)`;
    });
  const huntBest = Object.entries(p.huntBest).map(([mode, score]) => `${mode} ${score}`);
  lines.push(`Note Hunt best scores: ${huntBest.join(', ') || 'none'}. Weakest fretboard spots: ${weak.join('; ') || 'not enough data'}.`);

  const ear = Object.entries(p.ear)
    .filter(([, v]) => v.total >= 3)
    .map(([k, v]) => {
      const [mode, id] = k.split(':');
      const name = mode === 'intervals' ? INTERVALS[Number(id)]?.name : mode === 'chords' ? getChordType(id).name + ' chords' : `string ${6 - Number(id)}`;
      return `${name} ${Math.round((100 * v.right) / v.total)}% of ${v.total}`;
    });
  lines.push(`Ear training accuracy: ${ear.join(', ') || 'not enough data'}.`);

  const pairs = new Map<string, number>();
  for (const c of p.changes) pairs.set(c.pair, Math.max(pairs.get(c.pair) ?? 0, c.count));
  lines.push(`One-minute chord changes, best per pair: ${[...pairs].map(([k, v]) => `${k} ${v}/min`).join(', ') || 'none yet'}.`);
  lines.push(
    `Tab Trainer best accuracy: ${
      Object.entries(p.tabBest)
        .map(([id, v]) => `${getTune(id).name} ${v}%`)
        .join(', ') || 'none yet'
    }.`,
  );
  lines.push(`Last metronome tempo: ${p.lastBpm} BPM.`);
  return lines.join('\n');
}

interface PlanStep {
  tool: ToolId;
  minutes: number;
  what: string;
}

interface Plan {
  title: string;
  steps: PlanStep[];
  tip?: string;
}

const PLAYER = 'Paul is learning guitar. He played piano before, so theory and reading notes come easily, but fretting-hand technique and the fretboard are new.';

export function Coach(props: { practice: PracticeData }) {
  const [sample, hide] = useSample();
  const tuning = useTuning();
  const [minutes, setMinutes] = useState(20);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState<'plan' | 'ask' | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => () => ctl.current?.abort(), []);

  if (!sample) return null;

  const fail = (e: unknown) => {
    const err = e as SampleError;
    if (GONE.has(err?.code)) {
      hide();
      return;
    }
    if (err?.code !== 'cancelled') setError(errorCopy(err?.code));
  };

  const toolList = TOOLS.map((t) => `- ${t.id}: ${t.name}. ${t.blurb}`).join('\n');

  const makePlan = async () => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy('plan');
    setThinking(true);
    setError(null);
    try {
      const prompt = `You are a warm, practical guitar teacher. ${PLAYER}

Build a ${minutes}-minute practice session for today using only the tools of his practice app listed below. Base it on his practice log: spend time where he is weakest or has not practised lately, keep at least one fun part (a song or the backing band), and start with a warm-up. Use 3 to 5 steps whose minutes add up to ${minutes}.

Tools (use these ids exactly):
${toolList}

His practice log:
${practiceSummary(props.practice, tuning.strings)}

Reply with only JSON in this shape:
{"title": "short name for the session", "steps": [{"tool": "tool id", "minutes": 5, "what": "one or two sentences: exactly what to do in that tool and what to listen or watch for"}], "tip": "one sentence of encouragement or technique advice"}`;
      const result = await sample.json<Plan>(prompt, { signal: ctl.current.signal, cache: false });
      const steps = Array.isArray(result?.steps)
        ? result.steps.filter((s) => TOOLS.some((t) => t.id === s.tool)).map((s) => ({ ...s, minutes: Math.max(1, Math.round(Number(s.minutes) || 1)), what: String(s.what ?? '') }))
        : [];
      if (!steps.length) throw { code: 'invalid_json', message: 'no steps' };
      setPlan({ title: String(result.title ?? 'Today’s session'), steps, tip: result.tip ? String(result.tip) : undefined });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
      setThinking(false);
    }
  };

  const ask = async (e: Event) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setBusy('ask');
    setThinking(true);
    setError(null);
    setAnswer('');
    try {
      const prompt = `You are a friendly, concise guitar teacher answering a student's question. ${PLAYER} When it helps, relate guitar ideas to the piano. Mention one of his practice app's tools by name if it fits (${TOOLS.map((t) => t.name).join(', ')}). Answer in plain text without Markdown headings, in at most about 180 words.

His practice log, for context:
${practiceSummary(props.practice, tuning.strings)}

His question: ${q.slice(0, 2000)}`;
      await sample(prompt, {
        signal: ctl.current.signal,
        cache: false,
        onText: ({ text }) => {
          setThinking(false);
          setAnswer(text);
        },
      });
    } catch (err) {
      const t = (err as SampleError)?.text;
      if (t) setAnswer(t);
      fail(err);
    } finally {
      setBusy(null);
      setThinking(false);
    }
  };

  const total = plan?.steps.reduce((s, x) => s + x.minutes, 0) ?? 0;

  return (
    <section class="panel coach stack" style={{ gap: '14px' }} aria-labelledby="coach-h">
      <div class="panel-head" style={{ marginBottom: 0 }}>
        <div>
          <span class="eyebrow">Asks Claude, on your claude.ai account</span>
          <h2 id="coach-h">Practice coach</h2>
        </div>
        {busy && (
          <button class="btn" type="button" onClick={() => ctl.current?.abort()}>
            <StopIcon /> Stop
          </button>
        )}
      </div>

      <div class="coach-grid">
        <div class="stack" style={{ gap: '10px' }}>
          <p class="muted">The coach reads your practice log in this browser (time per pedal, weak frets, ear-training scores) and plans a session around it.</p>
          <div class="row">
            <Seg value={minutes} onChange={setMinutes} label="Session length" options={[10, 20, 30, 45].map((m) => ({ value: m, label: `${m} min` }))} />
            <button class="btn primary" type="button" disabled={!!busy} onClick={makePlan}>
              {busy === 'plan' ? 'Planning…' : plan ? 'Plan another' : 'Plan my practice'}
            </button>
          </div>
          {busy === 'plan' && thinking && <p class="muted">Thinking about your log…</p>}
          {plan && (
            <div class="plan">
              <h3>
                {plan.title} <span class="muted mono" style={{ fontSize: '0.75rem' }}>{total} min</span>
              </h3>
              <ol>
                {plan.steps.map((s, i) => {
                  const t = toolInfo(s.tool);
                  return (
                    <li key={i}>
                      <a class="plan-tool" href={'#' + t.id}>
                        <span class="led" style={{ '--c': t.color }} />
                        {t.name}
                      </a>
                      <span class="mono muted plan-min">{s.minutes} min</span>
                      <p>{s.what}</p>
                    </li>
                  );
                })}
              </ol>
              {plan.tip && <p class="plan-tip">{plan.tip}</p>}
            </div>
          )}
        </div>

        <form class="stack" style={{ gap: '10px' }} onSubmit={ask}>
          <label for="coach-q" class="muted">
            Or ask anything about guitar:
          </label>
          <textarea
            id="coach-q"
            class="input"
            rows={3}
            placeholder="Why does my F barre chord buzz? How do I hear the difference between Dorian and minor?"
            value={question}
            onInput={(e) => setQuestion(e.currentTarget.value)}
          />
          <div class="row">
            <button class="btn" type="submit" disabled={!!busy || !question.trim()}>
              {busy === 'ask' ? 'Asking…' : 'Ask the coach'}
            </button>
          </div>
          {busy === 'ask' && thinking && <p class="muted">Thinking…</p>}
          {answer && <div class="coach-answer">{answer}</div>}
        </form>
      </div>
      {error && <p class="notice bad">{error}</p>}
    </section>
  );
}
