import { isNumber } from "../utils/validators";
import type Drome from "./drome";
import AutomatableEffect from "./effect-automatable";

interface DelayEffectOptions {
  delayTime: (number | number[])[];
  feedback: number;
}

class DelayEffect extends AutomatableEffect<DelayNode> {
  protected _input: GainNode;
  protected _effect: DelayNode;
  protected _target: AudioParam;
  private _dry: GainNode;
  private _wet: GainNode;
  private _feedback: GainNode;

  constructor(drome: Drome, { delayTime: d, feedback }: DelayEffectOptions) {
    super(d.map((x) => (isNumber(x) ? x * 2 : x.map((y) => y * 2))));
    this._input = new GainNode(drome.ctx);
    this._effect = new DelayNode(drome.ctx, {
      delayTime: this._defaultValue,
    });
    this._dry = new GainNode(drome.ctx);
    this._wet = new GainNode(drome.ctx, { gain: feedback });
    this._feedback = new GainNode(drome.ctx, { gain: feedback });
    this._target = this._effect.delayTime;
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
