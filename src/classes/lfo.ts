interface LfoOptions {
  value: number;
  depth: number;
  speed: number;
  bpm: number;
  type?: OscillatorType;
}

class LFO {
  private _ctx: AudioContext;
  private _value: number;
  private _depth: number;
  private _speed: number;
  private _bpm: number;
  private _type: OscillatorType;
  private _paused = true;
  private _osc: OscillatorNode | null = null;
  private _gain: GainNode | null = null;
  private _filter: BiquadFilterNode | null = null;

  constructor(ctx: AudioContext, opts: LfoOptions) {
    this._ctx = ctx;
    this._value = opts.value;
    this._depth = opts.depth;
    this._speed = opts.speed;
    this._bpm = opts.bpm;
    this._type = opts.type ?? "sine";
  }

  create() {
    const frequency = (this._speed * this._bpm) / 240;
    this._osc = new OscillatorNode(this._ctx, {
      frequency,
      type: this._type ?? "sine",
    });

    this._gain = new GainNode(this._ctx, { gain: this._depth });
    this._filter = new BiquadFilterNode(this._ctx, { frequency: 25 });
    return this;
  }

  connect(destination: AudioParam) {
    if (!this._osc || !this._filter || !this._gain) {
      console.warn("[LFO] Must call create() before calling start()");
      return this;
    }
    this._osc.connect(this._filter).connect(this._gain).connect(destination);
    return this;
  }

  start(startTime?: number) {
    if (!this.paused) return this;
    if (!this._osc) {
      console.warn("[LFO] Must call connect() before calling start()");
      return this;
    }

    this._osc.start(startTime);
    this._paused = false;
    return this;
  }

  speed(v: number) {
    this._speed = v;

    if (this._osc) {
      const f = (this._speed * this._bpm) / 240;
      this._osc.frequency.cancelScheduledValues(this._ctx.currentTime);
      this._osc.frequency.linearRampToValueAtTime(f, this._ctx.currentTime + 1);
    }

    return this;
  }

  bpm(v: number) {
    this._bpm = v;

    if (this._osc) {
      const f = (this._speed * this._bpm) / 240;
      this._osc.frequency.cancelScheduledValues(this._ctx.currentTime);
      this._osc.frequency.linearRampToValueAtTime(f, this._ctx.currentTime + 1);
    }

    return this;
  }

  depth(v: number) {
    this._depth = v;

    if (this._gain) {
      this._gain.gain.cancelScheduledValues(this._ctx.currentTime);
      this._gain.gain.linearRampToValueAtTime(v, this._ctx.currentTime + 1);
    }

    return this;
  }

  type(v: OscillatorType) {
    this._type = v;
    return this;
  }

  stop(when?: number) {
    if (this.paused) return this;
    if (!this._osc) {
      console.warn("[LFO] Must call connect() before calling start()");
      return this;
    }
    this._osc.stop(when);
    this._paused = true;
    return this;
  }

  disconnect() {
    if (!this._osc || !this._filter || !this._gain) {
      console.warn("[LFO] Must call connect() before calling disconnect()");
      return this;
    }

    this._osc.disconnect();
    this._gain.disconnect();
    this._filter.disconnect();
    this._osc = null;
    this._gain = null;
    this._filter = null;
    this._paused = true;

    return this;
  }

  get paused() {
    return this._paused;
  }

  get value() {
    return this._value;
  }
}

export default LFO;
export { type LfoOptions };
