// TODO: remove lfo and env maps
// TODO: split SourceEffects class into separate classes with a SourceEffect abstract
// ~~TODO: DetuneEffect class with a similar interface to AutomatableEffect class~~

import AutomatableEffect from "./automatable-effect";
import BitcrusherEffect from "./effect-bitcrusher";
import DelayEffect from "./effect-delay";
import DistortionEffect from "./effect-distortion";
import DromeArray from "./drome-array";
import DromeAudioNode from "./drome-audio-node";
import DromeCycle from "./drome-cycle";
import DromeFilter from "./drome-filter";
import Envelope from "./envelope";
import GainEffect from "./effect-gain";
import PanEffect from "./effect-pan";
import SourceEffects from "./effects-source";
import LFO from "./lfo";
import ReverbEffect from "./effect-reverb";
import { isNullish } from "../utils/validators";
import type Drome from "./drome";
import type {
  AdsrMode,
  AutomatableParam,
  AdsrEnvelope,
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
  private _sourceNode: GainNode;
  private _destination: AudioNode;
  protected _cycles: DromeCycle<T>;
  private _gain: DromeArray<number>;
  // private _detune: DromeArray<number>;
  private _signalChain: Set<DromeAudioNode>;
  private _srcEffects: SourceEffects;
  protected _lfoMap: Map<AutomatableParam, LFO>;
  protected _envMap: Map<AutomatableParam, Envelope>;
  protected _startTime: number | undefined;
  private _isConnected = false;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;

  // Method Aliases
  amp: (a: number | number[] | LFO, ...v: (number | number[])[]) => this;
  env: (a: number, d?: number, s?: number, r?: number) => this;
  envMode: (mode: AdsrMode) => this;
  rev: () => this;

  constructor(drome: Drome, opts: InstrumentOptions<T>) {
    this._drome = drome;
    this._destination = opts.destination;
    this._cycles = new DromeCycle(opts.defaultCycle ?? []);
    this._gain = new DromeArray([[1]]);
    // this._detune = new DromeArray([[0]]);
    this._sourceNode = new GainNode(drome.ctx);
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._signalChain = new Set();
    this._srcEffects = new SourceEffects(drome, opts.baseGain, opts.adsr);
    this._lfoMap = new Map();
    const { a, d, s, r } = opts.adsr ?? { a: 0.005, d: 0, s: 1, r: 0.01 };
    this._envMap = new Map([
      ["gain", new Envelope(0, opts.baseGain || 1).adsr(a, d, s, r)],
    ]);

    this.amp = this.amplitude.bind(this);
    this.env = this.adsr.bind(this);
    this.envMode = this.adsrMode.bind(this);
    this.rev = this.reverse.bind(this);
  }

  protected createGain(start: number, dur: number, chordIndex: number) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const gain = this._srcEffects.applyGain(start, dur, cycleIndex, chordIndex);

    this._gainNodes.add(gain.envGain);
    this._gainNodes.add(gain.effectGain);

    return gain;
  }

  protected applyDetune(
    node: OscillatorNode | AudioBufferSourceNode,
    note: NonNullable<Note<unknown>>,
    cycleIndex: number,
    chordIndex: number
  ) {
    this._srcEffects.applyDetune(node, note, cycleIndex, chordIndex);
  }

  private connectChain(
    notes: Note<T>[],
    cycleIndex: number,
    barStart: number,
    barDuration: number
  ) {
    const chain = [this._sourceNode, ...this._signalChain, this._destination];

    chain.forEach((node, i) => {
      if (node instanceof AutomatableEffect)
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

  amplitude(a: number | number[] | LFO, ...v: (number | number[])[]) {
    if (a instanceof LFO) {
      this._gain.note(a.value);
      this._lfoMap.set("gain", a);
    } else {
      this._gain.note(a, ...v);
    }
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    this._srcEffects.gainEnv.att(a);
    if (typeof d === "number") this._srcEffects.gainEnv.dec(d);
    if (typeof s === "number") this._srcEffects.gainEnv.sus(s);
    if (typeof r === "number") this._srcEffects.gainEnv.rel(r);

    return this;
  }

  att(v: number) {
    this._srcEffects.gainEnv.att(v);
    return this;
  }

  dec(v: number) {
    this._srcEffects.gainEnv.dec(v);
    return this;
  }

  sus(v: number) {
    this._srcEffects.gainEnv.sus(v);
    return this;
  }

  rel(v: number) {
    this._srcEffects.gainEnv.rel(v);
    return this;
  }

  // TODO: Add env getter to effects
  adsrMode(mode: AdsrMode) {
    // this._envMap.forEach((env) => env.mode(mode));
    return this;
  }

  gain(...gain: (number | number[])[] | [LFO] | [Envelope]) {
    const effect = new GainEffect(this.ctx, { gain });

    this._signalChain.add(effect);

    return this;
  }

  bpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "bandpass", frequency });

    this._signalChain.add(f);

    return this;
  }

  bpq(v: number) {
    Array.from(this._signalChain).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "bandpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  hpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "highpass", frequency });

    this._signalChain.add(f);

    return this;
  }

  hpq(v: number) {
    Array.from(this._signalChain).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "highpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  lpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    const f = new DromeFilter(this.ctx, { type: "lowpass", frequency });

    this._signalChain.add(f);

    return this;
  }

  lpq(v: number) {
    Array.from(this._signalChain).forEach((e) => {
      if (e instanceof DromeFilter && e.type === "lowpass") {
        e.input.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  // detune(...v: (number | number[])[] | [Envelope] | [LFO]) {

  detune(a: number | number[] | LFO | Envelope, ...v: (number | number[])[]) {
    this._srcEffects.detune(a, ...v);
    return this;
  }

  pan(...pan: (number | number[])[] | [LFO] | [Envelope]) {
    const effect = new PanEffect(this.ctx, { pan });

    this._signalChain.add(effect);

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

    this._signalChain.add(effect);
    return this;
  }

  delay(delayTime = 0.25, feedback = 0.1, mix = 0.2) {
    const effect = new DelayEffect(this._drome, { delayTime, feedback, mix });
    this._signalChain.add(effect);
    return this;
  }

  distort(amount = 50, mix = 0.5) {
    const effect = new DistortionEffect(this._drome, { amount, mix });
    this._signalChain.add(effect);
    return this;
  }

  crush(bitDepth: number, rateReduction = 1, mix = 1) {
    const effect = new BitcrusherEffect(this._drome, {
      bitDepth,
      rateReduction,
      mix,
    });
    this._signalChain.add(effect);
    return this;
  }

  beforePlay(barStart: number, barDuration: number) {
    // stop current lfos to make sure that lfo period stays synced with bpm
    this._lfoMap.forEach((lfo) => !lfo.paused && lfo.stop(barStart));
    this._srcEffects.reset();

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
      this._isConnected = false;
    }, 100);
  }

  get ctx() {
    return this._drome.ctx;
  }

  get type() {
    return "rate" in this ? "sample" : "synth";
  }

  // get _gainEnv() {
  //   const gainEnv = this._envMap.get("gain");

  //   if (!gainEnv) {
  //     const msg = "[DROME] cannot access baseGain env before it has been set";
  //     throw new Error(msg);
  //   }

  //   return gainEnv;
  // }
}

export default Instrument;
export type { InstrumentOptions, InstrumentType };
