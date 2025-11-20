// TODO: revert to using delayTime as automatable
// TODO: reverse order of feedback and delayTime args

import type Drome from "./drome";
import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";

interface DelayEffectOptions {
  delayTime: number;
  feedback?: (number | number[])[] | [LFO] | [Envelope];
}

class DelayEffect extends AutomatableEffect<DelayNode> {
  protected _input: GainNode;
  protected _effect: DelayNode;
  protected _target: AudioParam;
  private _dry: GainNode;
  private _wet: GainNode;
  private _feedback: GainNode;

  constructor(
    drome: Drome,
    { delayTime, feedback = [0.1] }: DelayEffectOptions
  ) {
    super(feedback);
    this._input = new GainNode(drome.ctx);
    this._effect = new DelayNode(drome.ctx, {
      delayTime: delayTime * 2,
    });
    this._dry = new GainNode(drome.ctx);
    this._wet = new GainNode(drome.ctx, { gain: this._defaultValue });
    this._feedback = new GainNode(drome.ctx, { gain: this._defaultValue });
    this._target = this._feedback.gain;

    // Dry signal passes through
    this.input.connect(this._dry);
    // Wet signal with feedback
    this.input.connect(this._effect).connect(this._wet);
    this._effect.connect(this._feedback).connect(this._effect);
  }

  connect(dest: AudioNode) {
    // Dry signal passes through unaffected
    this.input.connect(this._dry).connect(dest);
    // Wet signal with effect + feedback
    this.input.connect(this._effect).connect(this._wet).connect(dest);
    this._effect.connect(this._feedback).connect(this._effect);
  }
}

export default DelayEffect;
