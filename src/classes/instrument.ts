// TODO: Revisit instrument cleanup method and generally tidy up

import AutomatableEffect from "./effect-automatable";
import BitcrusherEffect from "./effect-bitcrusher";
import DelayEffect from "./effect-delay";
import DistortionEffect from "./effect-distortion";
import DromeAudioNode from "./drome-audio-node";
import DromeCycle from "./drome-cycle";
import DromeFilter from "./effect-filter";
import Envelope from "./envelope";
import GainEffect from "./effect-gain";
import PanEffect from "./effect-pan";
import LFO from "./lfo";
import ReverbEffect from "./effect-reverb";
import { DetuneSourceEffect, GainSourceEffect } from "./effect-source";
import { isNullish } from "../utils/validators";
import type Drome from "./drome";
import type {
  AdsrMode,
  AdsrEnvelope,
  DistortionAlgorithm,
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

type Pattern = (number | number[])[];
type Cycle = Pattern | [LFO] | [Envelope];
type CycleInput = number | LFO | Envelope | string;

abstract class Instrument<T> {
  protected _drome: Drome;
  protected _cycles: DromeCycle<T>;
  private _gain: GainSourceEffect;
  private _detune: DetuneSourceEffect;
  private _sourceNode: GainNode;
  private _signalChain: Set<DromeAudioNode>;
  private _destination: AudioNode;
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
    this._sourceNode = new GainNode(drome.ctx);
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._signalChain = new Set();
    const { baseGain, adsr } = opts;
    this._gain = new GainSourceEffect(drome, baseGain, adsr);
    this._detune = new DetuneSourceEffect(drome);

    this.amp = this.amplitude.bind(this);
    this.env = this.adsr.bind(this);
    this.envMode = this.adsrMode.bind(this);
    this.rev = this.reverse.bind(this);
  }

  protected createGain(
    node: OscillatorNode | AudioBufferSourceNode,
    start: number,
    duration: number,
    chordIndex: number
  ) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const { envGain, effectGain, noteEnd } = this._gain.apply({
      node,
      start,
      duration,
      cycleIndex,
      chordIndex,
    });

    this._gainNodes.add(envGain);
    this._gainNodes.add(effectGain);
    node.connect(effectGain).connect(envGain).connect(this._sourceNode);

    return { gainNodes: [envGain, effectGain], noteEnd };
  }

  protected applyDetune(
    node: OscillatorNode | AudioBufferSourceNode,
    start: number,
    duration: number,
    chordIndex: number
  ) {
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    this._detune.apply({ node, start, duration, cycleIndex, chordIndex });
  }

  private connectChain(
    notes: Note<T>[],
    barStart: number,
    barDuration: number
  ) {
    const chain = [this._sourceNode, ...this._signalChain, this._destination];

    chain.forEach((node, i) => {
      if (node instanceof AutomatableEffect)
        node.apply(notes, this._drome.metronome.bar, barStart, barDuration);

      if (this._isConnected) return;

      const nextNode = chain[i + 1];
      if (nextNode instanceof DromeAudioNode) node.connect(nextNode.input);
      else if (nextNode) node.connect(nextNode);
    });

    this._isConnected = true;
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
      this._gain.cycles.note(a.value);
      this._gain.lfo = a;
    } else {
      this._gain.cycles.note(a, ...v);
    }
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    this._gain.env.att(a);
    if (typeof d === "number") this._gain.env.dec(d);
    if (typeof s === "number") this._gain.env.sus(s);
    if (typeof r === "number") this._gain.env.rel(r);

    return this;
  }

  att(v: number) {
    this._gain.env.att(v);
    return this;
  }

  dec(v: number) {
    this._gain.env.dec(v);
    return this;
  }

  sus(v: number) {
    this._gain.env.sus(v);
    return this;
  }

  rel(v: number) {
    this._gain.env.rel(v);
    return this;
  }

  adsrMode(mode: AdsrMode) {
    this._gain.env.mode(mode);
    this._detune.env?.mode(mode);
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
        e.effect.Q.setValueAtTime(v, this.ctx.currentTime);
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
        e.effect.Q.setValueAtTime(v, this.ctx.currentTime);
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
        e.effect.Q.setValueAtTime(v, this.ctx.currentTime);
      }
    });
    return this;
  }

  detune(a: number | number[] | LFO | Envelope, ...v: (number | number[])[]) {
    if (a instanceof LFO) {
      this._detune.cycles.note(a.value);
      this._detune.lfo = a;
    } else if (a instanceof Envelope) {
      this._detune.env = a;
    } else {
      this._detune.cycles.note(a, ...v);
    }

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
  reverb(a: CycleInput, b?: number, c?: number, d?: number): this;
  reverb(a: CycleInput, b?: string, c?: string): this;
  reverb(mix: CycleInput, b: unknown = 1, c: unknown = 1600, d?: number) {
    let effect: ReverbEffect;
    const parsedMix = parseCycleInput(mix);

    if (typeof b === "number" && typeof c === "number") {
      const lpfEnd = d || 1000;
      const opts = { mix: parsedMix, decay: b, lpfStart: c, lpfEnd };
      effect = new ReverbEffect(this._drome, opts);
    } else {
      const name = typeof b === "string" ? b : "echo";
      const bank = typeof c === "string" ? c : "fx";
      const src = name.startsWith("https")
        ? ({ registered: false, url: name } as const)
        : ({ registered: true, name, bank } as const);
      effect = new ReverbEffect(this._drome, { mix: parsedMix, src });
    }

    this._signalChain.add(effect);
    return this;
  }

  delay(dt: number | string, feedback: number) {
    const delayTime = parsePattern(dt);
    const effect = new DelayEffect(this._drome, { delayTime, feedback });

    this._signalChain.add(effect);

    return this;
  }

  distort(
    amount: number | string | LFO | Envelope,
    postgain?: number,
    type?: DistortionAlgorithm
  ) {
    const distortion = parseCycleInput(amount);
    const effect = new DistortionEffect(this.ctx, {
      distortion,
      postgain,
      type,
    });
    this._signalChain.add(effect);
    return this;
  }

  crush(bd: number | string | LFO | Envelope, rateReduction = 1) {
    const bitDepth = parseCycleInput(bd);
    const effect = new BitcrusherEffect(this.ctx, {
      bitDepth,
      rateReduction,
    });
    this._signalChain.add(effect);
    return this;
  }

  beforePlay(barStart: number, barDuration: number) {
    // stop current lfos to make sure that lfo period stays synced with bpm
    // this._lfoMap.forEach((lfo) => !lfo.paused && lfo.stop(barStart));
    this._gain.lfo?.stop();
    this._detune.lfo?.stop();

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

    this.connectChain(notes, barStart, barDuration);

    return notes;
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
      // this._lfoMap.forEach((lfo) => {
      //   lfo.stop();
      //   lfo.disconnect();
      // });
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

function parsePattern(input: number | string): Pattern {
  if (typeof input === "string") return parsePatternString(input);
  return [input];
}

function parseCycleInput(input: CycleInput): Cycle {
  if (input instanceof Envelope) return [input];
  else if (input instanceof LFO) return [input];
  else return parsePattern(input);
}

function parsePatternString(input: string) {
  const err = `[DROME] could not parse pattern string: ${input}`;
  try {
    const parsed = JSON.parse(`[${input}]`);
    if (!isPattern(parsed)) throw new Error(err);
    return parsed;
  } catch {
    console.warn(err);
    return [];
  }
}

function isPattern(input: unknown): input is Pattern {
  return (
    Array.isArray(input) &&
    input.reduce<boolean>((_, x) => {
      if (typeof x === "number") return true;
      else if (Array.isArray(x)) return x.every((x) => typeof x === "number");
      return false;
    }, true)
  );
}
