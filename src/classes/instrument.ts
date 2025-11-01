// TODO: Create gain returns 2 gain nodes: main and base
// --> remove base gain option and replace with "base" env that has min=0 and max=baseGain
// --> no longer need to multiply main gain value by baseGain value

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
  private _destination: AudioNode;
  private _connectorNode: AudioNode; // TODO: try to remove this prop
  protected _cycles: DromeCycle<T>;
  private _gain: DromeArray<number>;
  // private _baseGain: number;
  private _postgain: DromeArray<number>;
  private _detune: DromeArray<number> = new DromeArray([[0]]);
  private _pan: DromeArray<number> = new DromeArray([[0]]);
  protected readonly _postgainNode: GainNode;
  protected readonly _panNode: StereoPannerNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<FilterType, FilterOptions>;
  protected _lfoMap: Map<AutomatableParam, LFO>;
  protected _envMap: Map<AutomatableParam | "baseGain", Envelope>;
  protected _startTime: number | undefined;
  private _isConnected = false;

  // Method Aliases
  env: (a: number, d?: number, s?: number, r?: number) => this;
  envMode: (mode: AdsrMode) => this;
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._destination = opts.destination;
    this._connectorNode = opts.destination;
    this._cycles = new DromeCycle(opts.defaultCycle ?? []);
    this._gain = new DromeArray([[1]]);
    // this._baseGain = opts.baseGain || 0.75;
    this._postgain = new DromeArray([[1]]);
    this._postgainNode = new GainNode(drome.ctx, { gain: 1 });
    this._panNode = new StereoPannerNode(this.ctx);
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._lfoMap = new Map();
    const { a, d, s, r } = opts.adsr ?? { a: 0.001, d: 0, s: 1, r: 0.01 };
    this._envMap = new Map([
      ["gain", new Envelope(0, 1).adsr(a, d, s, r)],
      ["baseGain", new Envelope(0, opts.baseGain || 0.75).att(0.005)],
    ]);
    this.env = this.adsr.bind(this);
    this.envMode = this.adsrMode.bind(this);
    this.rev = this.reverse.bind(this);
  }

  protected createGain(start: number, dur: number, chordIndex: number) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const gain = this._gain.at(cycleIndex, chordIndex);
    const gainNode = new GainNode(this.ctx, { gain });
    this._gainNodes.add(gainNode);

    const baseGain = this._baseGainEnv.maxValue;
    const baseGainNode = new GainNode(this.ctx, { gain: baseGain });
    this._gainNodes.add(baseGainNode);

    if (this._gainEnv.maxValue !== gain) this._gainEnv.maxValue = gain;
    const noteEnd = this._gainEnv.apply(gainNode.gain, start, dur);
    this._baseGainEnv.apply(baseGainNode.gain, start, dur);

    return { gainNode, noteEnd, baseGainNode };
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
      .att(adsr[0] ?? 0.125)
      .dec(adsr[1] ?? 0.125)
      .sus(adsr[2] ?? 1)
      .rel(adsr[3] ?? 0.01);

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

  private applyFilters(
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

  private applyPan(
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

  private applyPostgain(
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

  private connectChain(...nodes: (AudioNode | AudioNode[])[]) {
    if (!this._isConnected) {
      const chain = [...nodes.flat(), this._postgainNode, this._destination];

      chain.forEach((node, i) => {
        const nextNode = chain[i + 1];
        if (nextNode) node.connect(nextNode);
      });

      this._connectorNode = chain[0];
      this._isConnected = true;
    }

    return this._connectorNode;
  }

  note(...input: (Nullable<T> | Nullable<T>[])[]) {
    this._cycles.note(...input);
    return this;
  }

  euclid(pulses: number | number[], steps: number, rotation = 0) {
    this._cycles.euclid(pulses, steps, rotation);
    return this;
  }

  reverse() {
    this._cycles.reverse();
    return this;
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
    this._gainEnv.att(a);
    if (this._baseGainEnv.a < a) this._baseGainEnv.att(a);
    if (typeof d === "number") this._gainEnv.dec(d);
    if (typeof s === "number") this._gainEnv.sus(s);
    if (typeof r === "number") {
      this._gainEnv.rel(r);
      this._baseGainEnv.rel(r);
    }

    return this;
  }

  att(v: number) {
    this._gainEnv.att(v);
    if (this._baseGainEnv.a < v) this._baseGainEnv.att(v);
    return this;
  }

  dec(v: number) {
    this._gainEnv.dec(v);
    return this;
  }

  sus(v: number) {
    this._gainEnv.sus(v);
    return this;
  }

  rel(v: number) {
    this._gainEnv.rel(v);
    this._baseGainEnv.rel(v);
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

  lpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("lowpass", maxValue, adsr);
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

  beforePlay(barStart: number, barDuration: number) {
    this._startTime = barStart;
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const cycle = this._cycles.at(cycleIndex);
    const noteDuration = barDuration / cycle.length;
    const notes: Note<T>[] = cycle.map((value, i) => {
      if (isNullish(value)) return null;
      return {
        value,
        start: barStart + i * noteDuration,
        duration: noteDuration,
      };
    });

    this._lfoMap.forEach((lfo) => !lfo.paused && lfo.stop(barStart)); // stop current lfos to make sure that lfo period stays synced with bpm
    this.applyPostgain(notes, cycleIndex, barStart, barDuration);
    const filters = this.applyFilters(notes, cycleIndex, barStart, barDuration);
    const panNode = this.applyPan(notes, cycleIndex, barStart, barDuration);
    const destination = this.connectChain(filters, panNode);

    return { notes, cycleIndex, destination };
  }

  stop(when?: number) {
    const startTime = this._startTime ?? this.ctx.currentTime;
    const stopTime = when ?? this.ctx.currentTime;
    const relTime = 0.15;

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
      this._postgainNode.disconnect();
      this._isConnected = false;
    }, 100);
  }

  get ctx() {
    return this._drome.ctx;
  }

  get type() {
    return "rate" in this ? "sample" : "synth";
  }

  get _gainEnv() {
    const gainEnv = this._envMap.get("gain");
    if (!gainEnv) {
      const msg = "[DROME] cannot access gain env before it has been set";
      throw new Error(msg);
    }
    return gainEnv;
  }

  get _baseGainEnv() {
    const gainEnv = this._envMap.get("baseGain");
    if (!gainEnv) {
      const msg = "[DROME] cannot access baseGain env before it has been set";
      throw new Error(msg);
    }
    return gainEnv;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
