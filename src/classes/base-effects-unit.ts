// TODO: FINISH POSTGAIN LFO IMPLEMENTATION (TREMOLO)

import DromeCycle from "./drome-cycle";
import DromeArray from "./drome-array";
import LFO from "./lfo";
import Envelope from "./envelope";
import { isNullish, isEnvTuple, isLfoTuple } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";
import type Drome from "./drome";
import type {
  AdsrMode,
  AutomatableParam,
  AdsrEnvelope,
  FilterOptions,
  FilterType,
  InstrumentType,
  Note,
  Nullable,
} from "../types";

interface InstrumentOptions<T> {
  destination: AudioNode;
  defaultCycle?: Nullable<T>[][];
  baseGain?: number;
  adsr?: AdsrEnvelope;
}

abstract class Instrument<T> {
  protected _drome: Drome;
  protected _cycles: DromeCycle<T>;
  private _gain: DromeArray<number>;
  private _baseGain: number;
  private _postgain: DromeArray<number>;
  private _detune: DromeArray<number> = new DromeArray([[0]]);
  private _pan: DromeArray<number> = new DromeArray([[0]]);
  protected readonly _postgainNode: GainNode;
  protected readonly _panNode: StereoPannerNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<FilterType, FilterOptions>;
  protected _lfoMap: Map<AutomatableParam, LFO>;
  protected _envMap: Map<AutomatableParam, Envelope>;
  protected _startTime: number | undefined;

  // Method Aliases
  env: (a: number, d?: number, s?: number, r?: number) => this;
  envMode: (mode: AdsrMode) => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._cycles = new DromeCycle(opts.defaultCycle ?? []);
    this._gain = new DromeArray([[1]]);
    this._baseGain = opts.baseGain || 0.75;
    this._postgain = new DromeArray([[1]]);
    this._postgainNode = new GainNode(drome.ctx, { gain: 1 });
    this._panNode = new StereoPannerNode(this.ctx);
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._lfoMap = new Map();
    const { a, d, s, r } = opts.adsr ?? { a: 0.005, d: 0, s: 1, r: 0.01 };
    this._envMap = new Map([["gain", new Envelope(0, 1).adsr(a, d, s, r)]]);
    this.env = this.adsr.bind(this);
    this.envMode = this.adsrMode.bind(this);
  }

  protected createGain(start: number, dur: number, chordIndex: number) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const gain = this._gain.at(cycleIndex, chordIndex) * this._baseGain;
    const gainNode = new GainNode(this.ctx, { gain });
    this._gainNodes.add(gainNode);

    if (this._gainEnv.maxValue !== gain) this._gainEnv.maxValue = gain;
    const noteEnd = this._gainEnv.apply(gainNode.gain, start, dur);

    return { gainNode, noteEnd };
  }

  private createFilter(
    type: FilterType,
    input: DromeArray<number> | LFO | Envelope
  ) {
    let frequency: number;
    let frequencies: DromeArray<number>;

    if (input instanceof LFO) {
      frequency = input.value;
      frequencies = new DromeArray([[frequency]]);
      this._lfoMap.set(type, input);
    } else if (input instanceof Envelope) {
      frequency = input.startValue;
      frequencies = new DromeArray([[frequency]]);
      this._envMap.set(type, input);
    } else {
      frequency = input.at(0, 0);
      frequencies = input;
    }

    const node = new BiquadFilterNode(this.ctx, { type, frequency });
    this._filterMap.set(type, { node, frequencies });
  }

  private createFilterEnvelope(type: FilterType, max: number, adsr: number[]) {
    const filter = this._filterMap.get(type);

    if (!filter) {
      const msg = `[DROME] must create a ${type} filter before setting its envelope`;
      console.warn(msg);
      return this;
    }

    const env = new Envelope(filter.frequencies.at(0, 0), max, 30)
      .a(adsr[0] ?? 0.125)
      .d(adsr[1] ?? 0.125)
      .s(adsr[2] ?? 1)
      .r(adsr[3] ?? 0.01);

    this._envMap.set(type, env);
  }

  protected applyDetune(
    node: OscillatorNode | AudioBufferSourceNode,
    note: NonNullable<Note<unknown>>,
    cycleIndex: number,
    chordIndex: number
  ) {
    const env = this._envMap.get("detune");
    const lfo = this._lfoMap.get("detune");

    if (lfo) {
      if (lfo.paused) lfo.create().connect(node.detune).start(note.start);
      else lfo.connect(node.detune);
    } else if (env) {
      env.apply(node.detune, note.start, note.duration - 0.001);
    } else {
      node.detune.value = this._detune.at(cycleIndex, chordIndex);
    }
  }

  protected applyFilters(
    notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    return Array.from(this._filterMap.entries()).map(([type, filter]) => {
      const lfo = this._lfoMap.get(type);
      const env = this._envMap.get(type);
      const target = filter.node.frequency;

      if (lfo) {
        lfo.create().connect(target).start(startTime);
      } else if (env) {
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (isNullish(note)) continue;
          env.apply(target, note.start, note.duration - 0.001);
        }
      } else {
        const steps = filter.frequencies.at(cycleIndex);
        applySteppedRamp({ target, startTime, duration, steps });
      }

      return filter.node;
    });
  }

  protected applyPan(
    notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    const lfo = this._lfoMap.get("pan");
    const env = this._envMap.get("pan");
    const target = this._panNode.pan;

    if (lfo) {
      lfo.create().connect(target).start(startTime);
    } else if (env) {
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (isNullish(note)) continue;
        env.apply(target, note.start, note.duration - 0.001);
      }
    } else {
      const steps = this._pan.at(cycleIndex);
      applySteppedRamp({ target, startTime, duration, steps });
    }

    return this._panNode;
  }

  protected applyPostgain(
    _notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    const lfo = this._lfoMap.get("postgain");

    if (lfo) {
      lfo.create().connect(this._postgainNode.gain).start(startTime);
    } else {
      const target = this._postgainNode.gain;
      const steps = this._postgain.at(cycleIndex);
      applySteppedRamp({ target, startTime, duration, steps });
    }
  }

  gain(...v: (number | number[])[] | [Envelope]) {
    if (isEnvTuple(v)) {
      this._gain.note(v[0].maxValue);
      this._envMap.set("gain", v[0]);
    } else {
      this._gain.note(...v);
    }
    return this;
  }

  postgain(...v: (number | number[])[] | [LFO]) {
    if (isLfoTuple(v)) {
      this._postgainNode.gain.value = v[0].value;
      this._lfoMap.set("postgain", v[0]);
    } else {
      const firstValue = v.reduce<number>((acc, item) => {
        if (acc !== 1) return acc;
        if (typeof item === "number") return item;
        if (Array.isArray(item) && item.length > 0) return item[0];
        return acc;
      }, 1);
      this._postgainNode.gain.value = firstValue;
      this._postgain.note(...v);
    }
    return this;
  }

  adsrMode(mode: AdsrMode) {
    this._envMap.forEach((env) => env.mode(mode));
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    const gainEnv = this._gainEnv;
    gainEnv.a(a);
    if (typeof d === "number") gainEnv.d(d);
    if (typeof s === "number") gainEnv.s(s);
    if (typeof r === "number") gainEnv.r(r);

    return this;
  }

  att(v: number) {
    this._gainEnv.a(v);
    return this;
  }

  dec(v: number) {
    this._gainEnv.d(v);
    return this;
  }

  sus(v: number) {
    this._gainEnv.s(v);
    return this;
  }

  rel(v: number) {
    this._gainEnv.r(v);
    return this;
  }

  bpf(...valueOrLfo: (number | number[])[] | [LFO] | [Envelope]) {
    const input =
      isLfoTuple(valueOrLfo) || isEnvTuple(valueOrLfo)
        ? valueOrLfo[0]
        : new DromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("bandpass", input);
    return this;
  }

  bpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("bandpass", maxValue, adsr);
    return this;
  }

  bpq(v: number) {
    this._filterMap
      .get("bandpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  hpf(...valueOrLfo: (number | number[])[] | [LFO] | [Envelope]) {
    const input =
      isLfoTuple(valueOrLfo) || isEnvTuple(valueOrLfo)
        ? valueOrLfo[0]
        : new DromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("highpass", input);
    return this;
  }

  hpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("highpass", maxValue, adsr);
    return this;
  }

  hpq(v: number) {
    this._filterMap
      .get("highpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  lpf(...valueOrLfo: (number | number[])[] | [LFO] | [Envelope]) {
    const input =
      isLfoTuple(valueOrLfo) || isEnvTuple(valueOrLfo)
        ? valueOrLfo[0]
        : new DromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("lowpass", input);
    return this;
  }

  lpq(v: number) {
    this._filterMap
      .get("lowpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  detune(...v: (number | number[])[] | [LFO] | [Envelope]) {
    if (isLfoTuple(v)) {
      this._detune.note(v[0].value);
      this._lfoMap.set("detune", v[0]);
    } else if (isEnvTuple(v)) {
      this._envMap.set("detune", v[0]);
    } else {
      this._detune.note(...v);
    }
    return this;
  }

  pan(...v: (number | number[])[] | [LFO] | [Envelope]) {
    if (isLfoTuple(v)) {
      this._pan.note(v[0].value);
      this._lfoMap.set("pan", v[0]);
    } else if (isEnvTuple(v)) {
      this._envMap.set("pan", v[0]);
    } else {
      this._pan.note(...v);
    }
    return this;
  }

  get ctx() {
    return this._drome.ctx;
  }

  get _gainEnv() {
    const gainEnv = this._envMap.get("gain");
    if (!gainEnv) {
      throw new Error("[DROME] cannot access gainEnv before it has been set");
    }
    return gainEnv;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
