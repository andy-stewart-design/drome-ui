import { type AdsrEnvelope, type AdsrMode } from "../utils/adsr";
import LFO from "./lfo-2";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import type Drome from "./drome";

type InstrumentType = "synth" | "sample";
type FilterType = "bandpass" | "highpass" | "lowpass";
type LfoableParam = "detune" | FilterType;
type Nullable<T> = T | null | undefined;
type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

interface FilterOptions {
  node: BiquadFilterNode;
  frequency: number;
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
  protected _filterMap: Map<FilterType, FilterOptions>;
  protected _lfoMap: Map<LfoableParam, LFO>;
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

    // Method Aliases
    this.rev = this.reverse.bind(this);

    this._lfoMap = new Map();
  }

  private createFilter(type: FilterType, valueOrLfo: number | LFO, q?: number) {
    const argIsLfo = valueOrLfo instanceof LFO;
    const frequency = argIsLfo ? valueOrLfo.value : valueOrLfo;
    const node = new BiquadFilterNode(this.ctx, { type, frequency, Q: q ?? 1 });
    this._filterMap.set(type, { node, frequency, env: undefined });
    if (argIsLfo) this._lfoMap.set(type, valueOrLfo);
  }

  private createLfo(
    filType: FilterType,
    depth: number,
    speed: number,
    oscType?: OscillatorType
  ) {
    const bpm = this._drome.beatsPerMin;
    const value = this._filterMap.get(filType)?.frequency;

    if (!value) {
      const msg = `[DROME]: Must create a ${filType} filter before applying an lfo`;
      console.warn(msg);
      return this;
    }

    this._lfoMap.set(
      filType,
      new LFO(this.ctx, { depth, speed, type: oscType, bpm, value })
    );
  }

  private getFilterNodes(startTime: number, duration: number) {
    return Array.from(this._filterMap.entries()).map(([type, filter]) => {
      const lfo = this._lfoMap.get(type);
      console.log(lfo);

      if (lfo && lfo.paused) {
        lfo.create().connect(filter.node.frequency).start();
      } else if (filter.env) {
        const envTimes = getAdsrTimes({
          a: filter.env.adsr.a,
          d: filter.env.adsr.d,
          r: filter.env.adsr.r,
          duration: duration - 0.01,
          mode: this._adsrMode,
        });

        applyAdsr({
          target: filter.node.frequency,
          startTime,
          startValue: filter.frequency,
          envTimes,
          maxValue: filter.frequency * filter.env.depth,
          sustainValue: filter.frequency * filter.env.adsr.s,
          endValue: 30,
        });
      }

      return filter.node;
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

  protected connectChain(startTime: number, duration: number) {
    const filterNodes = this.getFilterNodes(startTime, duration);

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

  bpf(valueOrLfo: number | LFO, q?: number) {
    this.createFilter("bandpass", valueOrLfo, q);
    return this;
  }

  bpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("bandpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  bplfo(depth: number, speed: number, type?: OscillatorType) {
    this.createLfo("bandpass", depth, speed, type);
    return this;
  }

  hpf(valueOrLfo: number | LFO, q?: number) {
    this.createFilter("highpass", valueOrLfo, q);
    return this;
  }

  hpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("highpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  hplfo(depth: number, speed: number, type?: OscillatorType) {
    this.createLfo("highpass", depth, speed, type);
    return this;
  }

  lpf(valueOrLfo: number | LFO, q?: number) {
    this.createFilter("lowpass", valueOrLfo, q);
    return this;
  }

  lpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("lowpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lplfo(depth: number, speed: number, type?: OscillatorType) {
    this.createLfo("lowpass", depth, speed, type);
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
        node.stop(stopTime + relTime);
      });
    }
  }

  cleanup() {
    setTimeout(() => {
      this._gainNodes.forEach((node) => node.disconnect());
      this._gainNodes.clear();
      this._audioNodes.forEach((node) => node.disconnect());
      this._audioNodes.clear();
      this._lfoMap.forEach((lfo) => {
        lfo.stop();
        lfo.disconnect();
      });
      this._isConnected = false;
    }, 100);
  }

  get ctx() {
    return this._drome.ctx;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
