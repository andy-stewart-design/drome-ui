import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";

interface DromeFilterOptions {
  delayTime: (number | number[])[] | [LFO] | [Envelope];
  feedback?: number;
}

class DelayEffect extends AutomatableEffect<DelayNode> {
  protected _input: DelayNode;
  protected _target: AudioParam;
  private _feedback: GainNode;

  constructor(
    ctx: AudioContext,
    { delayTime, feedback = 0.1 }: DromeFilterOptions
  ) {
    super(delayTime);

    this._input = new DelayNode(ctx, { delayTime: this._defaultValue });
    this._feedback = new GainNode(ctx, { gain: feedback });
    this._target = this._input.delayTime;

    this._input.connect(this._feedback).connect(this._input);
    // this._input = new GainNode(ctx, { gain: this._defaultValue });
    // this._target = this._input.gain;
  }
}

export default DelayEffect;
