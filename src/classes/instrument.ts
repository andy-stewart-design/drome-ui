import { type AdsrEnvelope, type AdsrMode } from "../utils/adsr";
import LFO from "./lfo";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import type Sample from "./sample";
import type Synth from "./synth";

const filterTypes = ["bandpass", "highpass", "lowpass"] as const;
type InstrumentType = "synth" | "sample";
type FilterType = (typeof filterTypes)[number];
type LfoableParam = "detune" | FilterType;

interface InstrumentOptions {
  destination: AudioNode;
  gain?: number;
  adsr?: AdsrEnvelope;
}

abstract class Instrument<T> {
  protected _ctx: AudioContext;
  protected _destination: AudioNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _notes: T[];
  protected _gain: number;
  protected _adsr: AdsrEnvelope;
  protected _adsrMode: AdsrMode = "fit";
  protected _detune: number = 0;
  protected _filterMap: Map<BiquadFilterType, BiquadFilterNode>;
  protected _lfoMap: Map<LfoableParam, LFO>;

  constructor(ctx: AudioContext, opts: InstrumentOptions) {
    this._ctx = ctx;
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._notes = [];
    this._destination = opts.destination;
    this._gain = opts.gain || 0.75;
    this._adsr = opts.adsr ?? { a: 0.01, d: 0, s: 1, r: 0.01 };
    this._filterMap = new Map();
    this._lfoMap = new Map();
  }

  protected applyAdsr(target: AudioParam, start: number, dur: number) {
    const envTimes = getAdsrTimes({
      a: this._adsr.a,
      d: this._adsr.d,
      r: this._adsr.r,
      stepLength: dur,
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

  note(...notes: T[]) {
    this._notes = notes;
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
      new BiquadFilterNode(this._ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  hpf(frequency: number, lfo?: LFO) {
    const type = "highpass";
    this._filterMap.set(
      type,
      new BiquadFilterNode(this._ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  lpf(frequency: number, lfo?: LFO) {
    const type = "lowpass";
    this._filterMap.set(
      type,
      new BiquadFilterNode(this._ctx, { type, frequency })
    );
    if (lfo) this._lfoMap.set(type, lfo);
    return this;
  }

  detune(x: number, lfo?: LFO) {
    this._detune = x;
    if (lfo) this._lfoMap.set("detune", lfo);
    return this;
  }

  cleanup() {
    this._audioNodes.forEach((node) => {
      node.stop();
      node.disconnect();
    });
    this._lfoMap.forEach((lfo) => lfo.disconnect());
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
