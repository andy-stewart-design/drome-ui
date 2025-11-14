import DromeArray from "./drome-array";
import DromeAudioNode from "./drome-audio-node";
import Envelope from "./envelope";
import LFO from "./lfo";
import type { FilterType, Note } from "../types";
import { isEnvTuple, isLfoTuple, isNullish } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";

interface DromeFilterOptions {
  type: FilterType;
  frequency: (number | number[])[] | [LFO] | [Envelope];
}

class DromeFilter extends DromeAudioNode {
  protected _input: BiquadFilterNode;
  private _target: AudioParam;
  private _defaultValue: number;
  private _cycles: DromeArray<number>;
  private _lfo: LFO | undefined;
  private _env: Envelope | undefined;

  constructor(ctx: AudioContext, opts: DromeFilterOptions) {
    super();
    const { type, frequency } = opts;

    if (isLfoTuple(frequency)) {
      this._defaultValue = frequency[0].value;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._lfo = frequency[0];
    } else if (isEnvTuple(frequency)) {
      this._defaultValue = frequency[0].startValue;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._env = frequency[0];
    } else {
      this._cycles = new DromeArray([[0]]).note(...frequency);
      this._defaultValue = this._cycles.at(0, 0);
    }

    this._input = new BiquadFilterNode(ctx, {
      type,
      frequency: this._defaultValue,
    });
    this._target = this._input.frequency;
  }

  createEnvelope(max: number, adsr: number[]) {
    this._env = new Envelope(this._defaultValue, max, 30)
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
    if (this._lfo && !this._lfo.paused) this._lfo.stop(startTime);

    if (this._lfo) {
      this._lfo.create().connect(this._target).start(startTime);
    } else if (this._env) {
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (isNullish(note)) continue;
        this._env.apply(this._target, note.start, note.duration - 0.001);
      }
    } else {
      const steps = this._cycles.at(cycleIndex);
      console.log(steps);

      applySteppedRamp({ target: this._target, startTime, duration, steps });
    }
  }

  connect(dest: AudioNode) {
    this._input.connect(dest);
  }

  disconnect() {
    this._input.disconnect();
  }

  get input() {
    return this._input;
  }

  get lfo() {
    return this._lfo;
  }

  get type() {
    return this._input.type;
  }
}

export default DromeFilter;
