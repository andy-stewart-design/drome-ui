import { type AdsrEnvelope, type AdsrMode } from "../utils/adsr";
import LFO, { type LfoOptions } from "./lfo";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
// import type Sample from "./sample";
// import type Synth from "./synth";
import type Drome from "./drome";

const filterTypes = ["bandpass", "highpass", "lowpass"] as const;
type InstrumentType = "synth" | "sample";
type FilterType = (typeof filterTypes)[number];
type LfoableParam = "detune" | FilterType;
type Nullable<T> = T | null | undefined;
type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

interface FilterOptions {
  type: FilterType;
  frequency: number;
  q: number;
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
  protected _cycles: Cycle<T>[];
  protected _gain: number;
  protected _adsr: AdsrEnvelope;
  protected _adsrMode: AdsrMode = "fit";
  protected _detune: number = 0;
  protected _startTime: number | undefined;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<FilterType, FilterOptions>;
  protected readonly _filterNodes: Set<BiquadFilterNode>;
  protected _lfoMap: Map<LfoableParam, LfoOptions>;
  protected readonly _lfoNodes: Set<LFO>;

  // Method Aliases
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._cycles = opts.defaultCycle || [];
    this._destination = opts.destination;
    this._gain = opts.gain || 0.75;
    this._adsr = opts.adsr ?? { a: 0.01, d: 0, s: 1, r: 0.01 };
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._filterNodes = new Set();
    this._lfoMap = new Map();
    this._lfoNodes = new Set();

    this.rev = this.reverse.bind(this);
  }

  private saveFilter(type: FilterType, frequency: number, q?: number) {
    // node: new BiquadFilterNode(this.ctx, { type, frequency }),
    this._filterMap.set(type, { type, frequency, q: q ?? 1, env: undefined });
  }

  protected createFilters(startTime: number, duration: number) {
    return Array.from(this._filterMap.entries()).map(([type, opts]) => {
      const filter = new BiquadFilterNode(this.ctx, {
        type: opts.type,
        frequency: opts.frequency,
        Q: opts.q,
      });
      const lfoOpts = this._lfoMap.get(type);

      if (lfoOpts) {
        const lfo = new LFO(this.ctx, lfoOpts);
        lfo.connect(filter.frequency);
        lfo.start();
      } else if (opts.env) {
        const envTimes = getAdsrTimes({
          a: opts.env.adsr.a,
          d: opts.env.adsr.d,
          r: opts.env.adsr.r,
          duration,
          mode: this._adsrMode,
        });
        applyAdsr({
          target: filter.frequency,
          startTime,
          startValue: opts.frequency,
          envTimes,
          maxValue: opts.frequency * opts.env.depth,
          sustainValue: opts.frequency * opts.env.adsr.s,
          endValue: 30,
        });
      }

      this._filterNodes.add(filter);
      return filter;
    });
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

  protected applyLFOs() {
    // Array.from(this._lfoMap.entries()).forEach(([name, lfo]) => {
    //   if (name === "detune") {
    //     this._audioNodes.forEach((node) => lfo.connect(node[name]));
    //   } else if (filterTypes.includes(name)) {
    //     // const filter = this._filterMap.get(name);
    //     // if (filter) lfo.connect(filter.node.frequency);
    //   }
    //   if (lfo.paused) lfo.start();
    // });
  }

  protected connectChain() {
    // const filters = Array.from(this._filterMap.values()).map((v) => v.node);

    // if (filters.length) {
    //   const nodes = [...filters, this._destination];
    //   nodes.forEach((node, i) => {
    //     const nextNode = nodes[i + 1];
    //     if (nextNode) node.connect(nextNode);
    //   });
    //   return nodes[0];
    // }

    return this._destination;
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
    this.saveFilter("bandpass", frequency, q);
    return this;
  }

  bpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("bandpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  hpf(frequency: number, q?: number) {
    this.saveFilter("highpass", frequency, q);
    return this;
  }

  hpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("highpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lpf(frequency: number, q?: number) {
    this.saveFilter("lowpass", frequency, q);
    return this;
  }

  lpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("lowpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lplfo(depth: number, speed: number, type?: OscillatorType) {
    this._lfoMap.set("lowpass", { depth, speed, type });
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
    this._gainNodes.forEach((node) => node.disconnect());
    this._gainNodes.clear();
    this._audioNodes.forEach((node) => node.disconnect());
    this._audioNodes.clear();
    // cleanup after delay to prevent popping
    setTimeout(() => {
      this._filterNodes.forEach((node) => node.disconnect());
      this._filterNodes.clear();
      this._lfoNodes.forEach((node) => {
        node.stop();
        node.disconnect();
      });
      this._lfoNodes.clear();
    }, 100);
    // this._filterMap.clear();
    // this._lfoMap.clear();
  }

  get ctx() {
    return this._drome.ctx;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
