import DromeArray from "./drome-array";
import Envelope from "./envelope";
import LFO from "./lfo";
import type { FilterType, Note } from "../types";
import { isEnvTuple, isLfoTuple, isNullish } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";

interface DromeFilterOptions {
  type: FilterType;
  frequency: (number | number[])[] | [LFO] | [Envelope];
}

class DromeFilter {
  private _node: BiquadFilterNode;
  private _baseFrequency: number;
  private _frequencies: DromeArray<number>;
  private _lfo: LFO | undefined;
  private _env: Envelope | undefined;

  constructor(ctx: AudioContext, opts: DromeFilterOptions) {
    const { type, frequency } = opts;

    if (isLfoTuple(frequency)) {
      this._baseFrequency = frequency[0].value;
      this._frequencies = new DromeArray([[this._baseFrequency]]);
      this._lfo = frequency[0];
    } else if (isEnvTuple(frequency)) {
      this._baseFrequency = frequency[0].startValue;
      this._frequencies = new DromeArray([[this._baseFrequency]]);
      this._env = frequency[0];
    } else {
      this._frequencies = new DromeArray([[0]]).note(...frequency);
      this._baseFrequency = this._frequencies.at(0, 0);
    }

    this._node = new BiquadFilterNode(ctx, {
      type,
      frequency: this._baseFrequency,
    });
  }

  createEnvelope(max: number, adsr: number[]) {
    this._env = new Envelope(this._baseFrequency, max, 30)
      .att(adsr[0] ?? 0.125)
      .dec(adsr[1] ?? 0.125)
      .sus(adsr[2] ?? 1)
      .rel(adsr[3] ?? 0.01);
  }

  stopLfo(when?: number) {
    if (this._lfo && !this._lfo.paused) this._lfo.stop(when);
  }

  apply(
    notes: Note<unknown>[],
    cycleIndex: number,
    startTime: number,
    duration: number
  ) {
    const target = this._node.frequency;

    if (this._lfo) {
      this._lfo.create().connect(target).start(startTime);
    } else if (this._env) {
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (isNullish(note)) continue;
        this._env.apply(target, note.start, note.duration - 0.001);
      }
    } else {
      const steps = this._frequencies.at(cycleIndex);
      applySteppedRamp({ target, startTime, duration, steps });
    }
  }

  connect(dest: AudioNode) {
    this._node.connect(dest);
  }

  disconnect() {
    this._node.disconnect();
  }

  get node() {
    return this._node;
  }

  get input() {
    return this._node;
  }

  get lfo() {
    return this._lfo;
  }
}

export default DromeFilter;
