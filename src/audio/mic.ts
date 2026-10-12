import { getEngine } from './engine';

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Live microphone input for the tuner and the listening games. */
export class MicInput {
  private constructor(
    private stream: MediaStream,
    private source: MediaStreamAudioSourceNode,
    readonly analyser: AnalyserNode,
    readonly buffer: Float32Array<ArrayBuffer>,
  ) {}

  static async open(): Promise<MicInput> {
    const embedded = isEmbedded();
    const embeddedMessage =
      'This view doesn’t allow microphone access (it’s embedded in another page). Open String Theory in its own browser tab to use the mic.';
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError('unsupported', embedded ? embeddedMessage : 'This browser doesn’t offer microphone access here. Microphones need a secure (https) page.');
    }
    const { ctx } = getEngine();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new MicError('blocked', embedded ? embeddedMessage : 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new MicError('missing', 'No microphone was found. Plug one in or check your input settings.');
      }
      throw new MicError('unsupported', 'The microphone could not be started here.');
    }
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    return new MicInput(stream, source, analyser, new Float32Array(analyser.fftSize));
  }

  get sampleRate(): number {
    return this.analyser.context.sampleRate;
  }

  /** Latest block of samples (shared buffer, overwritten on each call). */
  read(): Float32Array<ArrayBuffer> {
    this.analyser.getFloatTimeDomainData(this.buffer);
    return this.buffer;
  }

  close() {
    this.source.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());
  }
}

export type MicErrorKind = 'blocked' | 'missing' | 'unsupported';

export class MicError extends Error {
  constructor(
    readonly kind: MicErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Counts strums and plucks: a note onset is a sudden jump in loudness above the recent level,
 * with a short dead time so one strum is not counted twice.
 */
export class OnsetDetector {
  private level = 0;
  private lastOnset = -Infinity;

  constructor(
    private ratio = 1.8,
    private floor = 0.02,
    private deadMs = 140,
  ) {}

  /** Feed one RMS reading; returns true when it marks a new onset. */
  push(rmsLevel: number, nowMs: number): boolean {
    const prev = this.level;
    // Track the recent level with fast attack and slower release.
    this.level = rmsLevel > prev ? rmsLevel : prev * 0.85 + rmsLevel * 0.15;
    if (rmsLevel < this.floor) return false;
    if (nowMs - this.lastOnset < this.deadMs) return false;
    if (rmsLevel > Math.max(prev, this.floor / 2) * this.ratio) {
      this.lastOnset = nowMs;
      return true;
    }
    return false;
  }
}
