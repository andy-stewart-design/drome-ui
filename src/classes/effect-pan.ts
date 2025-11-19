import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";

interface DromeFilterOptions {
  pan: (number | number[])[] | [LFO] | [Envelope];
}

class PanEffect extends AutomatableEffect<StereoPannerNode> {
  protected _input: StereoPannerNode;
  protected _target: AudioParam;

  constructor(ctx: AudioContext, { pan }: DromeFilterOptions) {
    super(pan);

    this._input = new StereoPannerNode(ctx, { pan: this._defaultValue });
    this._target = this._input.pan;
  }
}

export default PanEffect;
