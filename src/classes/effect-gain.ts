import type { Automatable } from "../types";
import AutomatableEffect from "./effect-automatable";

interface DromeFilterOptions {
  gain: Automatable;
}

class GainEffect extends AutomatableEffect<GainNode> {
  protected _input: GainNode;
  protected _effect: GainNode;
  protected _target: AudioParam;

  constructor(ctx: AudioContext, { gain }: DromeFilterOptions) {
    super(gain);

    this._input = new GainNode(ctx);
    this._effect = new GainNode(ctx, { gain: this._defaultValue });
    this._target = this._effect.gain;
  }
}

export default GainEffect;
