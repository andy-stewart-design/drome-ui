interface LfoOptions {
  ctx: AudioContext;
  depth: number;
  speed: number;
  type?: OscillatorType;
  normalize?: boolean;
}

class LFO {
  private _ctx: AudioContext;
  private _paused = true;
  private osc: OscillatorNode;
  private gain: GainNode;
  private filter: BiquadFilterNode;
  private constant: ConstantSourceNode | undefined;
  private offsetGain: GainNode | undefined;

  constructor(opts: LfoOptions) {
    this._ctx = opts.ctx;
    this.osc = new OscillatorNode(opts.ctx, {
      frequency: opts.speed,
      type: opts.type ?? "sine",
    });

    this.gain = new GainNode(opts.ctx, { gain: opts.depth });
    this.filter = new BiquadFilterNode(opts.ctx, { frequency: 25 });

    if (opts.normalize) {
      this.constant = new ConstantSourceNode(opts.ctx);
      this.offsetGain = new GainNode(opts.ctx, { gain: 0.5 });
    }
  }

  connect(destination: AudioParam) {
    if (this.constant && this.offsetGain) {
      // LFO (-1..1) → scale to -0.5..0.5
      this.osc.connect(this.filter).connect(this.gain).connect(this.offsetGain);
      // Add +0.5 offset to shift range to 0..1
      this.constant.connect(this.offsetGain);
      // Send combined signal to destination
      this.offsetGain.connect(destination);
    } else {
      this.osc.connect(this.filter).connect(this.gain).connect(destination);
    }
  }

  start(startTime?: number) {
    const phaseOffset = 1 / this.osc.frequency.value / 2;
    console.log("lfo starting", phaseOffset);
    this.constant?.start((startTime ?? 0) + phaseOffset);
    this.osc.start((startTime ?? 0) + phaseOffset);
    this._paused = false;
  }

  setSpeed(n: number) {
    this.osc.frequency.cancelScheduledValues(this._ctx.currentTime);
    this.osc.frequency.linearRampToValueAtTime(n, this._ctx.currentTime + 1);
  }

  setDepth(n: number) {
    this.gain.gain.cancelScheduledValues(this._ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(n, this._ctx.currentTime + 1);
  }

  disconnect() {
    console.log("lfo disconnecting");

    this.osc.disconnect();
    this.gain.disconnect();
    this.filter.disconnect();
    this.constant?.disconnect();
    this.offsetGain?.disconnect();
  }

  get paused() {
    return this._paused;
  }
}

export default LFO;
