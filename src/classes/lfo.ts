interface LfoOptions {
  depth: number;
  speed: number;
  bpm: number;
  type?: OscillatorType;
  normalize?: boolean;
}

class LFO {
  private _ctx: AudioContext;
  private _paused = true;
  private _osc: OscillatorNode;
  private _gain: GainNode;
  private _filter: BiquadFilterNode;
  private _constant: ConstantSourceNode | undefined;
  private _offsetGain: GainNode | undefined;

  constructor(ctx: AudioContext, opts: LfoOptions) {
    this._ctx = ctx;

    const frequency = (opts.speed * opts.bpm) / 240;
    this._osc = new OscillatorNode(ctx, {
      frequency,
      type: opts.type ?? "sine",
    });

    this._gain = new GainNode(ctx, { gain: opts.depth });
    this._filter = new BiquadFilterNode(ctx, { frequency: 25 });

    if (opts.normalize) {
      this._constant = new ConstantSourceNode(ctx, { offset: 1 });
      this._offsetGain = new GainNode(ctx, { gain: 0.5 });
    }
  }

  connect(destination: AudioParam) {
    if (this._constant && this._offsetGain) {
      // LFO (-1..1) → scale to -0.5..0.5
      this._osc
        .connect(this._filter)
        .connect(this._gain)
        .connect(this._offsetGain);
      // Add +0.5 offset to shift range to 0..1
      this._constant.connect(this._offsetGain);
      // Send combined signal to destination
      this._offsetGain.connect(destination);
    } else {
      this._osc.connect(this._filter).connect(this._gain).connect(destination);
    }
  }

  start(startTime?: number) {
    const phaseOffset = 1 / this._osc.frequency.value / 2;
    this._constant?.start((startTime ?? 0) + phaseOffset);
    this._osc.start((startTime ?? 0) + phaseOffset);
    this._paused = false;
  }

  setSpeed(n: number) {
    this._osc.frequency.cancelScheduledValues(this._ctx.currentTime);
    this._osc.frequency.linearRampToValueAtTime(n, this._ctx.currentTime + 1);
  }

  setDepth(n: number) {
    this._gain.gain.cancelScheduledValues(this._ctx.currentTime);
    this._gain.gain.linearRampToValueAtTime(n, this._ctx.currentTime + 1);
  }

  stop(when?: number) {
    this._osc.stop(when);
    this._constant?.stop(when);
  }

  disconnect() {
    this._osc.disconnect();
    this._gain.disconnect();
    this._filter.disconnect();
    this._constant?.disconnect();
    this._offsetGain?.disconnect();
  }

  get paused() {
    return this._paused;
  }
}

export default LFO;
export { type LfoOptions };
