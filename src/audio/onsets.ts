/**
 * Sample-accurate note onsets (strums, plucks, claps) for the timing check.
 *
 * `OnsetTracker` is self-contained on purpose: the same class runs in unit tests and, via its
 * source text, inside an AudioWorklet, where it timestamps each onset to the exact audio sample.
 */

export class OnsetTracker {
  env = 0;
  slow = 0;
  sinceLast = 1e9;
  attack: number;
  release: number;
  slowCoef: number;
  dead: number;

  constructor(
    public sampleRate: number,
    public ratio = 2.2,
    public floor = 0.02,
    deadMs = 90,
  ) {
    this.attack = Math.exp(-1 / (0.0008 * sampleRate));
    this.release = Math.exp(-1 / (0.06 * sampleRate));
    this.slowCoef = Math.exp(-1 / (0.15 * sampleRate));
    this.dead = Math.round((deadMs / 1000) * sampleRate);
  }

  /** Feed one block of samples starting at audio time `startTime`; returns the onset times found in it. */
  process(block: Float32Array, startTime: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < block.length; i++) {
      const a = Math.abs(block[i]);
      const coef = a > this.env ? this.attack : this.release;
      this.env = coef * this.env + (1 - coef) * a;
      this.sinceLast++;
      if (this.sinceLast > this.dead && this.env > this.floor && this.env > this.slow * this.ratio) {
        out.push(startTime + i / this.sampleRate);
        this.sinceLast = 0;
      }
      this.slow = this.slowCoef * this.slow + (1 - this.slowCoef) * this.env;
    }
    return out;
  }
}

/** Audio-thread code: wraps the tracker and posts onset times (AudioContext seconds) to the page. */
function workletSource(): string {
  return `
const OnsetTracker = ${OnsetTracker.toString()};
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tracker = new OnsetTracker(sampleRate);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      const hits = this.tracker.process(ch, currentTime);
      if (hits.length) this.port.postMessage(hits);
    }
    return true;
  }
}
registerProcessor('onset-processor', OnsetProcessor);
`;
}

export interface OnsetListener {
  stop(): void;
}

/**
 * Listen for onsets on an audio source. Uses an AudioWorklet for sample-accurate times, falling
 * back to a ScriptProcessor (block-accurate) on browsers without worklets.
 */
export async function listenForOnsets(ctx: AudioContext, source: AudioNode, onOnset: (time: number) => void): Promise<OnsetListener> {
  if (ctx.audioWorklet) {
    const url = URL.createObjectURL(new Blob([workletSource()], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'onset-processor', { numberOfInputs: 1, numberOfOutputs: 0 });
      node.port.onmessage = (e: MessageEvent<number[]>) => e.data.forEach(onOnset);
      source.connect(node);
      return {
        stop() {
          node.port.onmessage = null;
          try {
            source.disconnect(node);
          } catch {
            // Already disconnected.
          }
        },
      };
    } catch {
      // Fall through to the older API.
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const tracker = new OnsetTracker(ctx.sampleRate);
  const proc = ctx.createScriptProcessor(1024, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.onaudioprocess = (e) => tracker.process(e.inputBuffer.getChannelData(0), e.playbackTime - 1024 / ctx.sampleRate).forEach(onOnset);
  source.connect(proc);
  proc.connect(mute).connect(ctx.destination);
  return {
    stop() {
      proc.onaudioprocess = null;
      try {
        source.disconnect(proc);
        proc.disconnect();
      } catch {
        // Already disconnected.
      }
    },
  };
}
