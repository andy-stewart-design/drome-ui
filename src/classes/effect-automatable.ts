import DromeArray from "./drome-array";
import DromeAudioNode from "./drome-audio-node";
import Envelope from "./envelope";
import LFO from "./lfo";
import { isEnvTuple, isLfoTuple, isNullish } from "../utils/validators";
import { applySteppedRamp } from "../utils/stepped-ramp";
import type { Note } from "../types";

abstract class AutomatableEffect<T extends AudioNode> extends DromeAudioNode {
  protected abstract _input: GainNode;
  protected abstract _effect: T;
  protected abstract _target: AudioParam | undefined;
  protected _defaultValue: number;
  protected _cycles: DromeArray<number>;
  protected _lfo: LFO | undefined;
  protected _env: Envelope | undefined;

  constructor(cycles: (number | number[])[] | [LFO] | [Envelope]) {
    super();

    if (isLfoTuple(cycles)) {
      this._defaultValue = cycles[0].value;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._lfo = cycles[0];
    } else if (isEnvTuple(cycles)) {
      this._defaultValue = cycles[0].startValue;
      this._cycles = new DromeArray([[this._defaultValue]]);
      this._env = cycles[0];
    } else {
      this._cycles = new DromeArray([[0]]).note(...cycles);
      this._defaultValue = this._cycles.at(0, 0);
    }
  }

  apply(
    notes: Note<unknown>[],
    currentBar: number,
    startTime: number,
    duration: number
  ) {
    console.log(this._target, this._env);

    if (!this._target) return;

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
      const cycleIndex = currentBar % this._cycles.length;
      const steps = this._cycles.at(cycleIndex);
      applySteppedRamp({ target: this._target, startTime, duration, steps });
    }
  }

  connect(dest: AudioNode) {
    this._input.connect(this._effect).connect(dest);
  }

  disconnect() {
    this._input.disconnect();
  }

  get effect() {
    return this._effect;
  }

  get env() {
    return this._env;
  }

  get input() {
    return this._input;
  }

  get lfo() {
    return this._lfo;
  }
}

export default AutomatableEffect;
