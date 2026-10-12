/**
 * Sample-accurate timing with the "two clocks" pattern: a coarse JavaScript timer wakes up every
 * ~25 ms and schedules any steps falling in the next ~120 ms on the precise audio clock.
 * The timer runs in a Worker when possible because background tabs throttle main-thread timers.
 */

export interface Clock {
  now(): number;
}

export interface StepEvent {
  step: number;
  time: number;
}

export interface TransportOptions {
  bpm: number;
  /** Steps per beat: 1 = quarters, 2 = eighths, 3 = triplets, 4 = sixteenths. */
  stepsPerBeat: number;
  lookahead?: number;
  /** Optional swing: delays every odd step by this fraction of a step (0–0.5). */
  swing?: number;
}

export class Transport {
  bpm: number;
  stepsPerBeat: number;
  swing: number;
  readonly lookahead: number;
  running = false;
  onStep: ((step: number, time: number) => void) | null = null;

  private step = 0;
  private gridTime = 0;
  private queue: StepEvent[] = [];
  private stopTimer: (() => void) | null = null;

  constructor(
    private clock: Clock,
    opts: TransportOptions,
  ) {
    this.bpm = opts.bpm;
    this.stepsPerBeat = opts.stepsPerBeat;
    this.lookahead = opts.lookahead ?? 0.12;
    this.swing = opts.swing ?? 0;
  }

  get stepDuration(): number {
    return 60 / this.bpm / this.stepsPerBeat;
  }

  /** Begin at step 0, `delay` seconds from now. */
  start(delay = 0.08, timer: (fn: () => void) => () => void = startTicker) {
    this.stop();
    this.running = true;
    this.step = 0;
    this.gridTime = this.clock.now() + delay;
    this.queue = [];
    this.pump();
    this.stopTimer = timer(() => this.pump());
  }

  stop() {
    this.running = false;
    this.stopTimer?.();
    this.stopTimer = null;
    this.queue = [];
  }

  /** Schedule every step that falls inside the lookahead window. Called by the timer (or tests). */
  pump() {
    if (!this.running) return;
    const horizon = this.clock.now() + this.lookahead;
    while (this.gridTime < horizon) {
      const swingDelay = this.step % 2 === 1 ? this.swing * this.stepDuration : 0;
      const time = this.gridTime + swingDelay;
      this.onStep?.(this.step, time);
      this.queue.push({ step: this.step, time });
      if (this.queue.length > 64) this.queue.shift();
      this.gridTime += this.stepDuration;
      this.step++;
    }
  }

  /** Recently scheduled steps, oldest first (a copy). */
  recentSteps(): StepEvent[] {
    return [...this.queue];
  }

  /** The most recent step that has actually sounded by audio time `t` (for drawing). */
  stepAt(t: number): StepEvent | null {
    let current: StepEvent | null = null;
    for (const e of this.queue) {
      if (e.time <= t) current = e;
      else break;
    }
    return current;
  }
}

const WORKER_SOURCE = `let id=null;onmessage=(e)=>{if(e.data==='start'){clearInterval(id);id=setInterval(()=>postMessage(0),25);}else{clearInterval(id);id=null;}}`;

/** Call `fn` every ~25 ms until the returned function is called. */
export function startTicker(fn: () => void): () => void {
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = () => fn();
    worker.postMessage('start');
    return () => {
      worker.postMessage('stop');
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = setInterval(fn, 25);
    return () => clearInterval(id);
  }
}
