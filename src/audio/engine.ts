/**
 * One shared AudioContext and the mixer every tool plays through:
 *
 *   guitar ─► body EQ ─┬─────────────► master ─► compressor ─► speakers
 *   drums  ────────────┼──► reverb ──►   ▲
 *   click  ────────────┴──────────────────┘
 *
 * Browsers only allow sound after a tap or click, so the context is created lazily from a gesture.
 */

export interface Engine {
  ctx: AudioContext;
  master: GainNode;
  guitar: GainNode;
  drums: GainNode;
  click: GainNode;
  reverbSend: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;
let masterVolume = 0.8;

type AudioContextCtor = typeof AudioContext;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

export function audioSupported(): boolean {
  return contextCtor() !== null;
}

/** A small, warm room: exponentially decaying stereo noise with the highs rolled off over time. */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const smooth = 0.2 + 0.75 * t; // darker as it decays
      lp = (1 - smooth) * (Math.random() * 2 - 1) + smooth * lp;
      data[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return ir;
}

function peaking(ctx: AudioContext, freq: number, gain: number, q: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = freq;
  f.gain.value = gain;
  f.Q.value = q;
  return f;
}

export function getEngine(): Engine {
  if (!engine) {
    const Ctor = contextCtor();
    if (!Ctor) throw new Error('Web Audio is not available in this browser.');
    const ctx = new Ctor({ latencyHint: 'interactive' });

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(compressor);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.8, 3.2);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.22;
    reverb.connect(reverbReturn).connect(master);
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(reverb);

    // Guitar body: a low air resonance, a top-plate bump, a little presence and soft top end.
    const guitar = ctx.createGain();
    guitar.gain.value = 0.9;
    const body = [
      peaking(ctx, 105, 4, 1.4),
      peaking(ctx, 230, 2.5, 1.1),
      peaking(ctx, 2600, 2, 0.9),
    ];
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 6500;
    shelf.gain.value = -5;
    guitar.connect(body[0]).connect(body[1]).connect(body[2]).connect(shelf);
    shelf.connect(master);
    const guitarVerb = ctx.createGain();
    guitarVerb.gain.value = 0.5;
    shelf.connect(guitarVerb).connect(reverbSend);

    const drums = ctx.createGain();
    drums.gain.value = 0.75;
    drums.connect(master);
    const drumVerb = ctx.createGain();
    drumVerb.gain.value = 0.25;
    drums.connect(drumVerb).connect(reverbSend);

    const click = ctx.createGain();
    click.gain.value = 0.9;
    click.connect(master);

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    engine = { ctx, master, guitar, drums, click, reverbSend, noise };
  }
  if (engine.ctx.state === 'suspended') void engine.ctx.resume();
  return engine;
}

/** The engine if sound has already been started, without creating one. */
export function peekEngine(): Engine | null {
  return engine;
}

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
  if (engine) engine.master.gain.setTargetAtTime(masterVolume, engine.ctx.currentTime, 0.02);
}

export function now(): number {
  return getEngine().ctx.currentTime;
}
