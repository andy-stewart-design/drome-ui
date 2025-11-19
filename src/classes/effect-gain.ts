import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";

interface DromeFilterOptions {
  gain: (number | number[])[] | [LFO] | [Envelope];
}

class GainEffect extends AutomatableEffect<GainNode> {
  protected _input: GainNode;
  protected _target: AudioParam;

  constructor(ctx: AudioContext, { gain }: DromeFilterOptions) {
    super(gain);

    this._input = new GainNode(ctx, { gain: this._defaultValue });
    this._target = this._input.gain;
  }
}

export default GainEffect;
