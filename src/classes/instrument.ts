import { type AdsrEnvelope, type AdsrMode } from "../utils/adsr";
import LFO, { type LfoOptions } from "./lfo";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
// import type Sample from "./sample";
// import type Synth from "./synth";
import type Drome from "./drome";

// const filterTypes = ["bandpass", "highpass", "lowpass"] as const;
type InstrumentType = "synth" | "sample";
type FilterType = "bandpass" | "highpass" | "lowpass";
type LfoableParam = "detune" | BiquadFilterType;
type Nullable<T> = T | null | undefined;
type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

interface FilterOptions {
  // type: FilterType;
  frequency: number;
  // q: number;
  node: BiquadFilterNode;
  env: { depth: number; adsr: AdsrEnvelope } | undefined;
}

interface InstrumentOptions<T> {
  destination: AudioNode;
  defaultCycle?: Cycle<T>[];
  gain?: number;
  adsr?: AdsrEnvelope;
}

abstract class Instrument<T> {
  protected _drome: Drome;
  protected _destination: AudioNode;
  protected _connectorNode: AudioNode;
  protected _cycles: Cycle<T>[];
  protected _gain: number;
  protected _adsr: AdsrEnvelope;
  protected _adsrMode: AdsrMode = "fit";
  protected _detune: number = 0;
  protected _startTime: number | undefined;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<BiquadFilterType, FilterOptions>;
  protected _lfoMap: Map<LfoableParam, LfoOptions>;
  protected readonly _lfoNodes: Set<LFO>;
  private _isConnected = false;

  // Method Aliases
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._cycles = opts.defaultCycle || [];
    this._destination = opts.destination;
    this._connectorNode = opts.destination;
    this._gain = opts.gain || 0.75;
    this._adsr = opts.adsr ?? { a: 0.01, d: 0, s: 1, r: 0.01 };
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._lfoMap = new Map();
    this._lfoNodes = new Set();

    this.rev = this.reverse.bind(this);
  }

  private createFilter(type: FilterType, frequency: number, q?: number) {
    const node = new BiquadFilterNode(this.ctx, { type, frequency, Q: q ?? 1 });
    this._filterMap.set(type, { node, frequency, env: undefined });
  }

  protected applyGainAdsr(target: AudioParam, start: number, dur: number) {
    const envTimes = getAdsrTimes({
      a: this._adsr.a,
      d: this._adsr.d,
      r: this._adsr.r,
      duration: dur,
      mode: this._adsrMode,
    });

    applyAdsr({
      target,
      startTime: start,
      envTimes,
      maxValue: this._gain,
      sustainValue: this._adsr.s * this._gain,
    });

    return envTimes.r.end;
  }

  protected connectChain(startTime: number, duration: number) {
    const filterNodes = Array.from(this._filterMap.entries()).map(
      ([type, opts]) => {
        const lfoOpts = this._lfoMap.get(type);

        if (lfoOpts && this._lfoNodes.size === 0) {
          const lfo = new LFO(this.ctx, {
            ...lfoOpts,
            bpm: this._drome.beatsPerMin,
          });
          lfo.connect(opts.node.frequency);
          lfo.start();
          this._lfoNodes.add(lfo);
        } else if (opts.env) {
          const envTimes = getAdsrTimes({
            a: opts.env.adsr.a,
            d: opts.env.adsr.d,
            r: opts.env.adsr.r,
            duration: duration - 0.01,
            mode: this._adsrMode,
          });

          applyAdsr({
            target: opts.node.frequency,
            startTime,
            startValue: opts.frequency,
            envTimes,
            maxValue: opts.frequency * opts.env.depth,
            sustainValue: opts.frequency * opts.env.adsr.s,
            endValue: 30,
          });
        }

        return opts.node;
      }
    );

    if (!this._isConnected) {
      const nodes = [...filterNodes, this._destination];

      nodes.forEach((node, i) => {
        const nextNode = nodes[i + 1];
        if (nextNode) node.connect(nextNode);
      });

      this._connectorNode = nodes[0];
      this._isConnected = true;
    }

    return this._connectorNode;
  }

  note(...input: (T | Chord<T> | Cycle<T>)[]) {
    const isArray = Array.isArray;

    this._cycles = input.map((cycle) =>
      isArray(cycle)
        ? cycle.map((chord) => (isArray(chord) ? chord : [chord]))
        : [[cycle]]
    );

    return this;
  }

  reverse() {
    this._cycles = this._cycles
      .slice()
      .reverse()
      .map((arr) => arr.slice().reverse());
    return this;
  }

  gain(v: number) {
    this._gain = v;
    return this;
  }

  adsrMode(mode: AdsrMode) {
    this._adsrMode = mode;
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    this._adsr.a = a;
    if (typeof d === "number") this._adsr.d = d;
    if (typeof s === "number") this._adsr.s = s;
    if (typeof r === "number") this._adsr.r = r;
    return this;
  }

  att(v: number) {
    this._adsr.a = v;
    return this;
  }

  dec(v: number) {
    this._adsr.d = v;
    return this;
  }

  sus(v: number) {
    this._adsr.s = v;
    return this;
  }

  rel(v: number) {
    this._adsr.r = v;
    return this;
  }

  bpf(frequency: number, q?: number) {
    this.createFilter("bandpass", frequency, q);
    return this;
  }

  bpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("bandpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  hpf(frequency: number, q?: number) {
    this.createFilter("highpass", frequency, q);
    return this;
  }

  hpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("highpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lpf(frequency: number, q?: number) {
    this.createFilter("lowpass", frequency, q);
    return this;
  }

  lpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("lowpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lplfo(depth: number, speed: number, type?: OscillatorType) {
    this._lfoMap.set("lowpass", {
      depth,
      speed,
      type,
      bpm: this._drome.beatsPerMin,
    });
    return this;
  }

  detune(x: number) {
    this._detune = x;
    // if (lfo) this._lfoMap.set("detune", lfo);
    return this;
  }

  play(barStart: number, barDuration: number): void;
  play(barStart: number) {
    this._startTime = barStart;
  }

  stop(when?: number) {
    const startTime = this._startTime ?? this.ctx.currentTime;
    const stopTime = when ?? this.ctx.currentTime;
    const relTime = 0.125;

    if (startTime > this.ctx.currentTime) {
      this._audioNodes.forEach((node) => node.stop());
      this.cleanup();
    } else {
      this._gainNodes.forEach((node) => {
        node.gain.cancelScheduledValues(stopTime);
        node.gain.setValueAtTime(node.gain.value, stopTime);
        node.gain.linearRampToValueAtTime(0, stopTime + relTime);
      });

      const handleEnded = (e: Event) => {
        this.cleanup();
        e.target?.removeEventListener("ended", handleEnded);
      };

      Array.from(this._audioNodes).forEach((node, i) => {
        if (i === 0) node.addEventListener("ended", handleEnded);
        node.stop(stopTime + relTime + 0.1);
      });
    }
  }

  cleanup() {
    setTimeout(() => {
      this._gainNodes.forEach((node) => node.disconnect());
      this._gainNodes.clear();
      this._audioNodes.forEach((node) => node.disconnect());
      this._audioNodes.clear();
      this._lfoNodes.forEach((node) => {
        node.stop();
        node.disconnect();
      });
      this._lfoNodes.clear();
      this._isConnected = false;
    }, 50);
  }

  get ctx() {
    return this._drome.ctx;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
