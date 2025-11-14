import BitcrusherEffect from "./effect-bitcrusher";
import DelayEffect from "./effect-delay";
import DromeArray from "./drome-array";
import DromeCycle from "./drome-cycle";
import PanEffect from "./effect-pan";
import Envelope from "./envelope";
import LFO from "./lfo";
import ReverbEffect from "./effect-reverb";
import { isNullish } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";
import type Drome from "./drome";
import type {
  AdsrMode,
  AutomatableParam,
  AdsrEnvelope,
  InstrumentType,
  Note,
  Nullable,
} from "../types";
import DistortionEffect from "./effect-distortion";
import DromeFilter from "./drome-filter";
import DromeAudioNode from "./drome-audio-node";

interface InstrumentOptions<T> {
  destination: AudioNode;
  defaultCycle?: Nullable<T>[][];
  baseGain?: number;
  adsr?: AdsrEnvelope;
}

abstract class Instrument<T> {
  protected _drome: Drome;
  private _destination: AudioNode;
  protected _cycles: DromeCycle<T>;
  private _gain: DromeArray<number>;
  private _postgain: DromeArray<number>;
  private _detune: DromeArray<number> = new DromeArray([[0]]);
  private _sourceNode: GainNode;
  private readonly _postgainNode: GainNode;
  private readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  private readonly _gainNodes: Set<GainNode>;
  private _effects: Set<DromeAudioNode>;
  protected _lfoMap: Map<AutomatableParam, LFO>;
  protected _envMap: Map<AutomatableParam, Envelope>;
  protected _startTime: number | undefined;
  private _isConnected = false;

  // Method Aliases
  env: (a: number, d?: number, s?: number, r?: number) => this;
  envMode: (mode: AdsrMode) => this;
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._destination = opts.destination;
    this._cycles = new DromeCycle(opts.defaultCycle ?? []);
    this._gain = new DromeArray([[1]]);
    this._postgain = new DromeArray([[1]]);
    this._sourceNode = new GainNode(drome.ctx);
    this._postgainNode = new GainNode(drome.ctx, { gain: 1 });
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._effects = new Set();
    this._lfoMap = new Map();
    const { a, d, s, r } = opts.adsr ?? { a: 0.005, d: 0, s: 1, r: 0.01 };
    this._envMap = new Map([
      ["gain", new Envelope(0, opts.baseGain || 1).adsr(a, d, s, r)],
    ]);
    this.env = this.adsr.bind(this);
    this.envMode = this.adsrMode.bind(this);
    this.rev = this.reverse.bind(this);
  }

  protected createGain(start: number, dur: number, chordIndex: number) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const lfo = this._lfoMap.get("gain");
    const effectGain = new GainNode(this.ctx, {
      gain: this._gain.at(cycleIndex, chordIndex),
    });
    const envGain = new GainNode(this.ctx, {
      gain: this._gainEnv.maxValue,
    });

    const noteEnd = this._gainEnv.apply(envGain.gain, start, dur);

    if (lfo?.paused) lfo.create().connect(effectGain.gain).start(start);
    else if (lfo) lfo.connect(effectGain.gain);

    this._gainNodes.add(envGain);
    this._gainNodes.add(effectGain);

    return { envGain, effectGain, noteEnd };
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

  private applyPostgain(
    _notes: Note<T>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    const target = this._postgainNode.gain;
    const steps = this._postgain.at(cycleIndex);
    applySteppedRamp({ target, startTime, duration, steps });
  }

  private connectChain(
    notes: Note<T>[],
    cycleIndex: number,
    barStart: number,
    barDuration: number
  ) {
    this.applyPostgain(notes, cycleIndex, barStart, barDuration);

    const chain = [
      this._sourceNode,
      ...this._effects,
      this._postgainNode,
      this._destination,
    ];

    chain.forEach((node, i) => {
      if (node instanceof DromeFilter || node instanceof PanEffect)
        node.apply(notes, cycleIndex, barStart, barDuration);

      if (this._isConnected) return;

      const nextNode = chain[i + 1];
      if (nextNode instanceof DromeAudioNode) node.connect(nextNode.input);
      else if (nextNode) node.connect(nextNode);
    });

    this._isConnected = true;

    return this._sourceNode;
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

  gain(a: number | number[] | LFO | Envelope, ...v: (number | number[])[]) {
    if (a instanceof LFO) {
      this._gain.note(a.value);
      this._lfoMap.set("gain", a);
    } else if (a instanceof Envelope) {
      this._gain.note(a.maxValue);
      a.maxValue = this._gainEnv.maxValue;
      this._envMap.set("gain", a);
    } else {
      this._gain.note(a, ...v);
    }
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
    this._envMap.forEach((env) => env.mode(mode));
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    this._gainEnv.att(a);
    if (typeof d === "number") this._gainEnv.dec(d);
    if (typeof s === "number") this._gainEnv.sus(s);
    if (typeof r === "number") this._gainEnv.rel(r);

    return this;
  }

  att(v: number) {
    this._gainEnv.att(v);
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
    return this;
  }

  bpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "bandpass", frequency });

    this._effects.add(f);

    return this;
  }

  bpq(v: number) {
    Array.from(this._effects).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "bandpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  hpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "highpass", frequency });

    this._effects.add(f);

    return this;
  }

  hpq(v: number) {
    Array.from(this._effects).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "highpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  lpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "lowpass", frequency });

    this._effects.add(f);

    return this;
  }

  lpq(v: number) {
    Array.from(this._effects).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "lowpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  detune(a: number | number[] | LFO | Envelope, ...v: (number | number[])[]) {
    if (a instanceof LFO) {
      this._detune.note(a.value);
      this._lfoMap.set("detune", a);
    } else if (a instanceof Envelope) {
      this._envMap.set("detune", a);
    } else {
      this._detune.note(a, ...v);
    }
    return this;
  }

  pan(...pan: (number | number[])[] | [LFO] | [Envelope]) {
    const effect = new PanEffect(this.ctx, { pan });

    this._effects.add(effect);

    return this;
  }

  // b either represents decay/room size or a url/sample name
  // c either represents the lpf start value or a sample bank name
  // d is the lpf end value
  reverb(a?: number, b?: number, c?: number, d?: number): this;
  reverb(a?: number, b?: string, c?: string): this;
  reverb(mix = 0.2, b: unknown = 1, c: unknown = 1600, d?: number) {
    let effect: ReverbEffect;

    if (typeof b === "number" && typeof c === "number") {
      const lpfEnd = d || 1000;
      const opts = { mix, decay: b, lpfStart: c, lpfEnd };
      effect = new ReverbEffect(this._drome, opts);
    } else {
      const name = typeof b === "string" ? b : "echo";
      const bank = typeof c === "string" ? c : "fx";
      const src = name.startsWith("https")
        ? ({ registered: false, url: name } as const)
        : ({ registered: true, name, bank } as const);
      effect = new ReverbEffect(this._drome, { mix, src });
    }

    this._effects.add(effect);
    return this;
  }

  delay(delayTime = 0.25, feedback = 0.1, mix = 0.2) {
    const effect = new DelayEffect(this._drome, { delayTime, feedback, mix });
    this._effects.add(effect);
    return this;
  }

  distort(amount = 50, mix = 0.5) {
    const effect = new DistortionEffect(this._drome, { amount, mix });
    this._effects.add(effect);
    return this;
  }

  crush(bitDepth: number, rateReduction = 1, mix = 1) {
    const effect = new BitcrusherEffect(this._drome, {
      bitDepth,
      rateReduction,
      mix,
    });
    this._effects.add(effect);
    return this;
  }

  beforePlay(barStart: number, barDuration: number) {
    // stop current lfos to make sure that lfo period stays synced with bpm
    this._lfoMap.forEach((lfo) => !lfo.paused && lfo.stop(barStart));

    this._startTime = barStart;
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const cycle = this._cycles.at(cycleIndex);
    const notes: Note<T>[] = cycle.map((value, i) => {
      if (isNullish(value)) return null;
      return {
        value,
        start: barStart + i * (barDuration / cycle.length),
        duration: barDuration / cycle.length,
      };
    });

    const destination = this.connectChain(
      notes,
      cycleIndex,
      barStart,
      barDuration
    );

    return { notes, cycleIndex, destination };
  }

  stop(when?: number) {
    const startTime = this._startTime ?? this.ctx.currentTime;
    const stopTime = when ?? this.ctx.currentTime;
    const relTime = 0.25;

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
      const msg = "[DROME] cannot access baseGain env before it has been set";
      throw new Error(msg);
    }

    return gainEnv;
  }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
