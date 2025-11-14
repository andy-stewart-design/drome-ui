import DromeArray from "./drome-array";
import DromeAudioNode from "./drome-audio-node";
import Envelope from "./envelope";
import LFO from "./lfo";
import type { Note } from "../types";
import { isEnvTuple, isLfoTuple, isNullish } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";

interface DromeFilterOptions {
  pan: (number | number[])[] | [LFO] | [Envelope];
}

class PanEffect extends DromeAudioNode {
  protected _input: StereoPannerNode;
  private _target: AudioParam;
  private _defaultValue: number;
  private _cycles: DromeArray<number>;
  private _lfo: LFO | undefined;
  private _env: Envelope | undefined;

  constructor(ctx: AudioContext, { pan }: DromeFilterOptions) {
    super();

    if (isLfoTuple(pan)) {
      this._defaultValue = pan[0].value;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._lfo = pan[0];
    } else if (isEnvTuple(pan)) {
      this._defaultValue = pan[0].startValue;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._env = pan[0];
    } else {
      this._cycles = new DromeArray([[0]]).note(...pan);
      this._defaultValue = this._cycles.at(0, 0);
    }

    this._input = new StereoPannerNode(ctx, { pan: this._defaultValue });
    this._target = this._input.pan;
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
}

export default PanEffect;
