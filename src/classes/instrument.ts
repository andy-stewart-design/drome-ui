import { type AdsrEnvelope, type AdsrMode } from "../utils/adsr";
import LFO from "./lfo";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import type Sample from "./sample";
import type Synth from "./synth";
import type Drome from "./drome";

const filterTypes = ["bandpass", "highpass", "lowpass"] as const;
type InstrumentType = "synth" | "sample";
type FilterType = (typeof filterTypes)[number];
type LfoableParam = "detune" | FilterType;
type Nullable<T> = T | null | undefined;
type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

interface InstrumentOptions<T> {
  destination: AudioNode;
  defaultCycle?: Cycle<T>[];
  gain?: number;
  adsr?: AdsrEnvelope;
}

abstract class Instrument<T> {
  protected _drome: Drome;
  protected _destination: AudioNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _cycles: Cycle<T>[];
  protected _gain: number;
  protected _adsr: AdsrEnvelope;
  protected _adsrMode: AdsrMode = "fit";
  protected _detune: number = 0;
  protected _filterMap: Map<BiquadFilterType, BiquadFilterNode>;
  protected _lfoMap: Map<LfoableParam, LFO>;
  protected _startTime: number | undefined;

  // Method Aliases
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._cycles = opts.defaultCycle || [];
    this._destination = opts.destination;
    this._gain = opts.gain || 0.75;
    this._adsr = opts.adsr ?? { a: 0.01, d: 0, s: 1, r: 0.01 };
    this._filterMap = new Map();
    this._lfoMap = new Map();

    this.rev = this.reverse.bind(this);
  }

  protected applyAdsr(target: AudioParam, start: number, dur: number) {
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
      gain: this._gain,
      sustainLevel: this._adsr.s,
    });

    return envTimes.r.end;
  }

  protected applyLFOs(_: Synth | Sample) {
    Array.from(this._lfoMap.entries()).forEach(([name, lfo]) => {
      if (name === "detune") {
        this._audioNodes.forEach((node) => lfo.connect(node[name]));
      } else if (filterTypes.includes(name)) {
        const filter = this._filterMap.get(name);
        if (filter) lfo.connect(filter.frequency);
      }
      if (lfo.paused) lfo.start();
    });
  }

  protected connectChain() {
    const filters = Array.from(this._filterMap.values());

    if (filters.length) {
      const nodes = [...filters, this._destination];
      nodes.forEach((node, i) => {
        const nextNode = nodes[i + 1];
        if (nextNode) node.connect(nextNode);
      });
      return nodes[0];
    }

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

  bpf(frequency: number, lfo?: LFO) {
    const type = "bandpass";
    this._filterMap.set(
      type,
      new BiquadFilterNode(this.ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  hpf(frequency: number, lfo?: LFO) {
    const type = "highpass";
    this._filterMap.set(
      type,
      new BiquadFilterNode(this.ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  lpf(frequency: number, lfo?: LFO) {
    const type = "lowpass";
    this._filterMap.set(
      type,
      new BiquadFilterNode(this.ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  detune(x: number, lfo?: LFO) {
    this._detune = x;
    if (lfo) this._lfoMap.set("detune", lfo);
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
      // this.lfoNodes.forEach((lfo) => lfo.osc.stop());
    } else {
      this._gainNodes.forEach((node) => {
        node.gain.cancelScheduledValues(stopTime);
        node.gain.setValueAtTime(node.gain.value, stopTime);
        node.gain.linearRampToValueAtTime(0, stopTime + relTime);
      });

      this._audioNodes.forEach((node) => node.stop(stopTime + relTime + 0.1));
      // this.lfoNodes.forEach((lfo) => lfo.osc.stop(stopTime + relTime));
    }
  }

  cleanup() {
    this._audioNodes.forEach((node) => {
      node.stop();
      node.disconnect();
    });
    this._lfoMap.forEach((lfo) => lfo.disconnect());
  }

  get ctx() {
    return this._drome.ctx;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
