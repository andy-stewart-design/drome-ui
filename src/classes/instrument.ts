import DromeArray from "./drome-array";
import NonNullDromeArray from "./drome-array-non-null";
import LFO from "./lfo";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import type Drome from "./drome";
import type {
  Nullable,
  InstrumentType,
  AdsrEnvelope,
  AdsrMode,
  FilterType,
  FilterOptions,
  LfoableParam,
} from "../types";

interface InstrumentOptions<T> {
  destination: AudioNode;
  defaultCycle?: Nullable<T>[][];
  baseGain?: number;
  adsr?: AdsrEnvelope;
}

type Note<T> = {
  value: T;
  start: number;
  duration: number;
} | null;

abstract class Instrument<T> {
  protected _drome: Drome;
  protected _destination: AudioNode;
  protected _connectorNode: AudioNode; // TODO: try to remove this prop
  protected _cycles: DromeArray<T>;
  protected _gain: DromeArray<number>;
  protected _baseGain: number;
  protected _adsr: AdsrEnvelope;
  protected _postgain: NonNullDromeArray<number>;
  protected _postgainNode: GainNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<FilterType, FilterOptions>;
  protected _lfoMap: Map<LfoableParam, LFO>;
  protected _startTime: number | undefined;
  protected _adsrMode: AdsrMode = "fit";
  protected _detune: number = 0;
  private _isConnected = false;

  // Method Aliases
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._destination = opts.destination;
    this._connectorNode = opts.destination;
    this._cycles = new DromeArray(opts.defaultCycle ?? []);
    this._gain = new DromeArray([[1]]);
    this._baseGain = opts.baseGain || 0.75;
    this._adsr = opts.adsr ?? { a: 0.01, d: 0, s: 1, r: 0.01 };
    this._postgain = new NonNullDromeArray([[1]]);
    this._postgainNode = new GainNode(drome.ctx, { gain: 1 });
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._lfoMap = new Map();

    // Method Aliases
    this.rev = this.reverse.bind(this);
  }

  protected createGain(chordIndex: number) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const gain = this._gain.at(cycleIndex, chordIndex) ?? 1;
    const gainNode = new GainNode(this.ctx, {
      gain: gain * this._baseGain,
    });
    this._gainNodes.add(gainNode);
    return gainNode;
  }

  private createFilter(
    type: FilterType,
    freqOrLfo: NonNullDromeArray<number> | LFO
  ) {
    const isLfo = freqOrLfo instanceof LFO;
    const frequency = isLfo ? freqOrLfo.value : freqOrLfo.at(0, 0);
    const frequencies = isLfo
      ? new NonNullDromeArray([[frequency]])
      : freqOrLfo;
    const node = new BiquadFilterNode(this.ctx, { type, frequency });

    this._filterMap.set(type, { node, frequencies, env: undefined });
    if (freqOrLfo instanceof LFO) this._lfoMap.set(type, freqOrLfo);
  }

  private applyFilters(
    notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    return Array.from(this._filterMap.entries()).map(([type, filter]) => {
      const lfo = this._lfoMap.get(type);

      if (lfo) {
        lfo.create().connect(filter.node.frequency).start(startTime);
      } else if (filter.env) {
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (isNullish(note)) continue;

          const envTimes = getAdsrTimes({
            a: filter.env.adsr.a,
            d: filter.env.adsr.d,
            r: filter.env.adsr.r,
            duration: note.duration - 0.01,
            mode: this._adsrMode,
          });

          applyAdsr({
            target: filter.node.frequency,
            startTime: note.start,
            startValue: filter.frequencies.at(0, 0),
            envTimes,
            maxValue: filter.frequencies.at(0, 0) * filter.env.depth,
            sustainValue: filter.frequencies.at(0, 0) * filter.env.adsr.s,
            endValue: 30,
          });
        }
      } else {
        const target = filter.node.frequency;
        const steps = filter.frequencies.at(cycleIndex);

        // let i = 0;
        // const steps = notes.map((v) =>
        //   !isNullish(v) ? filterCycle[i++ % filterCycle.length] : null
        // );

        applySteppedRamp({ target, startTime, duration, steps });
      }

      return filter.node;
    });
  }

  protected applyGain(target: AudioParam, start: number, dur: number) {
    const initialGain = target.value;

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
      maxValue: initialGain,
      sustainValue: this._adsr.s * initialGain,
    });

    return envTimes.r.end;
  }

  private applyPostgain(
    _notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    const target = this._postgainNode.gain;
    const steps = this._postgain.at(cycleIndex);

    // let i = 0;
    // const steps = notes.map((v) =>
    //   !isNullish(v) ? postgainCycle[i++ % postgainCycle.length] : null
    // );

    applySteppedRamp({ target, startTime, duration, steps });
  }

  protected connectChain(audioNodes: AudioNode[]) {
    if (!this._isConnected) {
      const nodes = [...audioNodes, this._postgainNode, this._destination];

      nodes.forEach((node, i) => {
        const nextNode = nodes[i + 1];
        if (nextNode) node.connect(nextNode);
      });

      this._connectorNode = nodes[0];
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

  gain(...v: (number | number[])[]) {
    this._gain.note(...v);
    return this;
  }

  postgain(...v: (number | number[])[]) {
    const firstValue = v.reduce<number>((acc, item) => {
      if (acc !== 1) return acc;
      if (typeof item === "number") return item;
      if (Array.isArray(item) && item.length > 0) return item[0];
      return acc;
    }, 1);
    this._postgainNode.gain.value = firstValue;
    this._postgain.note(...v);
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

  bpf(...valueOrLfo: (number | number[])[] | [LFO]) {
    const input = isLfoTuple(valueOrLfo)
      ? valueOrLfo[0]
      : new NonNullDromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("bandpass", input);
    return this;
  }

  bpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("bandpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  bpq(v: number) {
    this._filterMap
      .get("bandpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  hpf(...valueOrLfo: (number | number[])[] | [LFO]) {
    const input = isLfoTuple(valueOrLfo)
      ? valueOrLfo[0]
      : new NonNullDromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("highpass", input);
    return this;
  }

  hpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("highpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  hpq(v: number) {
    this._filterMap
      .get("highpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  lpf(...valueOrLfo: (number | number[])[] | [LFO]) {
    const input = isLfoTuple(valueOrLfo)
      ? valueOrLfo[0]
      : new NonNullDromeArray([[0]]).note(...valueOrLfo);
    this.createFilter("lowpass", input);
    return this;
  }

  lpenv(depth: number, a?: number, d?: number, s?: number, r?: number) {
    const adsr = { a: a ?? 0.125, d: d ?? 0.125, s: s ?? 1, r: r ?? 0.01 };
    const filter = this._filterMap.get("lowpass");
    if (filter) filter.env = { depth, adsr };

    return this;
  }

  lpq(v: number) {
    this._filterMap
      .get("lowpass")
      ?.node.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  detune(x: number) {
    this._detune = x;
    // if (lfo) this._lfoMap.set("detune", lfo);
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

    // stop current lfos to make sure that lfo period stays synced with bpm
    this._lfoMap.forEach((lfo) => !lfo.paused && lfo.stop(barStart));
    this.applyPostgain(notes, cycleIndex, barStart, barDuration);
    const filters = this.applyFilters(notes, cycleIndex, barStart, barDuration);
    const destination = this.connectChain(filters);

    return { notes, cycleIndex, destination };
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
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };

function isNullish(v: unknown) {
  return v === null || v === undefined;
}

function isLfoTuple(n: unknown[]): n is [LFO] {
  return n[0] instanceof LFO;
}

interface SteppedRampOptions {
  target: AudioParam;
  startTime: number;
  duration: number;
  steps: Nullable<number>[];
  fade?: number;
}

function applySteppedRamp(opts: SteppedRampOptions) {
  const { target, steps, fade = 0.001, startTime, duration } = opts;
  const stepLength = (duration - fade * steps.length) / steps.length;

  target.cancelScheduledValues(startTime);
  target.setValueAtTime(target.value, startTime);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (isNullish(step)) continue;
    const nextIndex = steps.findIndex((v, idx) => idx > i && v !== null);
    const stepOffset = nextIndex > i ? nextIndex - i : steps.length - i;
    target.linearRampToValueAtTime(step, startTime + stepLength * i + fade);
    target.setValueAtTime(step, startTime + stepLength * (i + stepOffset));
  }
}
