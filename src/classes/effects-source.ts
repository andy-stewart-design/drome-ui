import type { AdsrEnvelope, Note } from "../types";
import type Drome from "./drome";
import DromeArray from "./drome-array";
import Envelope from "./envelope";
import LFO from "./lfo";

class SourceEffects {
  private _drome: Drome;
  private _gainCycles: DromeArray<number>;
  private _gainEnv: Envelope;
  private _gainLfo: LFO | undefined;
  private _detuneCycles: DromeArray<number>;
  private _detuneEnv: Envelope | undefined;
  private _detuneLfo: LFO | undefined;

  constructor(drome: Drome, baseGain?: number, adsr?: AdsrEnvelope) {
    this._drome = drome;

    const { a, d, s, r } = adsr ?? { a: 0.005, d: 0, s: 1, r: 0.01 };
    this._gainCycles = new DromeArray([[1]]);
    this._gainEnv = new Envelope(0, baseGain || 1).adsr(a, d, s, r);

    this._detuneCycles = new DromeArray([[0]]);
  }

  applyGain(
    start: number,
    dur: number,
    cycleIndex: number,
    chordIndex: number
  ) {
    const envGain = new GainNode(this._drome.ctx, {
      gain: this._gainEnv.maxValue,
    });
    const noteEnd = this._gainEnv.apply(envGain.gain, start, dur);

    const effectGain = new GainNode(this._drome.ctx, {
      gain: this._gainCycles.at(cycleIndex, chordIndex),
    });

    if (this._gainLfo?.paused) {
      this._gainLfo.stop();
      this._gainLfo.create().connect(effectGain.gain).start(start);
    } else if (this._gainLfo) {
      this._gainLfo.connect(effectGain.gain);
    }

    return { envGain, effectGain, noteEnd };
  }

  applyDetune(
    node: OscillatorNode | AudioBufferSourceNode,
    note: NonNullable<Note<unknown>>,
    cycleIndex: number,
    chordIndex: number
  ) {
    const env = this._detuneEnv;
    const lfo = this._detuneLfo;

    if (lfo?.paused) {
      lfo.stop();
      lfo.create().connect(node.detune).start(note.start);
    } else if (lfo) {
      lfo.connect(node.detune);
    } else if (env) {
      env.apply(node.detune, note.start, note.duration - 0.001);
    } else {
      node.detune.value = this._detuneCycles.at(cycleIndex, chordIndex);
    }
  }

  detune(a: number | number[] | LFO | Envelope, ...v: (number | number[])[]) {
    if (a instanceof LFO) {
      this._detuneCycles.note(a.value);
      this._detuneLfo = a;
    } else if (a instanceof Envelope) {
      this._detuneEnv = a;
    } else {
      this._detuneCycles.note(a, ...v);
    }
  }

  reset() {
    this._gainLfo?.stop();
    this._detuneLfo?.stop();
  }

  get gainEnv() {
    return this._gainEnv;
  }
}

export default SourceEffects;
