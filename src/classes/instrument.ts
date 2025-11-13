import BitcrusherEffect from "./effect-bitcrusher";
import DelayEffect from "./effect-delay";
import DromeArray from "./drome-array";
import DromeCycle from "./drome-cycle";
import DromeEffect from "./drome-effect";
import Envelope from "./envelope";
import LFO from "./lfo";
import ReverbEffect from "./effect-reverb";
import { isNullish, isEnvTuple, isLfoTuple } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";
import type Drome from "./drome";
import type {
  AdsrMode,
  AutomatableParam,
  AdsrEnvelope,
  FilterType,
  InstrumentType,
  Note,
  Nullable,
} from "../types";
import DistortionEffect from "./effect-distortion";
import DromeFilter from "./drome-filter";
import DromeAudioNode from "./drome-audio-node";

type EffectName = "reverb" | "distortion" | "delay" | "bitcrush";

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
  private _postgain: DromeArray<number>;
  private _detune: DromeArray<number> = new DromeArray([[0]]);
  private _pan: DromeArray<number> = new DromeArray([[0]]);
  protected readonly _postgainNode: GainNode;
  protected readonly _panNode: StereoPannerNode;
  protected readonly _audioNodes: Set<OscillatorNode | AudioBufferSourceNode>;
  protected readonly _gainNodes: Set<GainNode>;
  protected _filterMap: Map<FilterType, DromeFilter>;
  protected _lfoMap: Map<AutomatableParam, LFO>;
  protected _envMap: Map<AutomatableParam, Envelope>;
  protected _effectsMap: Map<EffectName, DromeEffect>;
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
    this._postgain = new DromeArray([[1]]);
    this._postgainNode = new GainNode(drome.ctx, { gain: 1 });
    this._panNode = new StereoPannerNode(this.ctx);
    this._audioNodes = new Set();
    this._gainNodes = new Set();
    this._filterMap = new Map();
    this._effectsMap = new Map();
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

  private createFilterEnvelope(type: FilterType, max: number, adsr: number[]) {
    const filter = this._filterMap.get(type);

    if (!filter) {
      const msg = `[DROME] must create a ${type} filter before setting its envelope`;
      console.warn(msg);
      return this;
    }

    filter.createEnvelope(max, adsr);
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
    this.applyPan(notes, cycleIndex, barStart, barDuration);

    if (!this._isConnected) {
      const chain = [
        this._panNode,
        ...this._filterMap.values(),
        ...this._effectsMap.values(),
        this._postgainNode,
        this._destination,
      ];

      chain.forEach((node, i) => {
        const nextNode = chain[i + 1];

        if (nextNode instanceof DromeAudioNode) {
          if (nextNode instanceof DromeFilter)
            nextNode.apply(notes, cycleIndex, barStart, barDuration);
          node.connect(nextNode.input);
        } else if (nextNode) {
          node.connect(nextNode);
        }
      });

      this._connectorNode =
        chain[0] instanceof DromeAudioNode ? chain[0].input : chain[0];
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

  gain(...v: (number | number[])[] | [LFO] | [Envelope]) {
    if (isLfoTuple(v)) {
      this._gain.note(v[0].value);
      this._lfoMap.set("gain", v[0]);
    } else if (isEnvTuple(v)) {
      this._gain.note(v[0].maxValue);
      v[0].maxValue = this._gainEnv.maxValue;
      this._envMap.set("gain", v[0]);
    } else {
      this._gain.note(...v);
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
    this._filterMap.set(
      "bandpass",
      new DromeFilter(this.ctx, { type: "bandpass", frequency })
    );

    return this;
  }

  bpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("bandpass", maxValue, adsr);
    return this;
  }

  bpq(v: number) {
    this._filterMap
      .get("bandpass")
      ?.input.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  hpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    this._filterMap.set(
      "highpass",
      new DromeFilter(this.ctx, { type: "highpass", frequency })
    );

    return this;
  }

  hpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("highpass", maxValue, adsr);
    return this;
  }

  hpq(v: number) {
    this._filterMap
      .get("highpass")
      ?.input.Q.setValueAtTime(v, this.ctx.currentTime);
    return this;
  }

  lpf(...frequency: (number | number[])[] | [LFO] | [Envelope]) {
    this._filterMap.set(
      "lowpass",
      new DromeFilter(this.ctx, { type: "lowpass", frequency })
    );

    return this;
  }

  lpenv(maxValue: number, ...adsr: number[]) {
    this.createFilterEnvelope("lowpass", maxValue, adsr);
    return this;
  }

  lpq(v: number) {
    this._filterMap
      .get("lowpass")
      ?.input.Q.setValueAtTime(v, this.ctx.currentTime);
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

  // b either represents decay/room size or a url/sample name
  // c either represents the lpf start value or a sample bank name
  // d is the lpf end value
  reverb(a?: number, b?: number, c?: number, d?: number): this;
  reverb(a?: number, b?: string, c?: string): this;
  reverb(mix = 0.2, b: unknown = 1, c: unknown = 1600, d?: number) {
    let reverb: ReverbEffect;

    if (typeof b === "number" && typeof c === "number") {
      const lpfEnd = d || 1000;
      const opts = { mix, decay: b, lpfStart: c, lpfEnd };
      reverb = new ReverbEffect(this._drome, opts);
    } else {
      const name = typeof b === "string" ? b : "echo";
      const bank = typeof c === "string" ? c : "fx";
      const src = name.startsWith("https")
        ? ({ registered: false, url: name } as const)
        : ({ registered: true, name, bank } as const);
      reverb = new ReverbEffect(this._drome, { mix, src });
    }

    this._effectsMap.set("reverb", reverb);
    return this;
  }

  delay(delayTime = 0.25, feedback = 0.1, mix = 0.2) {
    const delay = new DelayEffect(this._drome, { delayTime, feedback, mix });
    this._effectsMap.set("delay", delay);
    return this;
  }

  distort(amount = 50, mix = 0.5) {
    const dist = new DistortionEffect(this._drome, { amount, mix });
    this._effectsMap.set("distortion", dist);
    return this;
  }

  crush(bitDepth: number, rateReduction = 1, mix = 1) {
    const effect = new BitcrusherEffect(this._drome, {
      bitDepth,
      rateReduction,
      mix,
    });
    this._effectsMap.set("bitcrush", effect);
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
