import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";

interface DromeFilterOptions {
  pan: (number | number[])[] | LFO | Envelope;
}

class PanEffect extends AutomatableEffect<StereoPannerNode> {
  protected _input: GainNode;
  protected _effect: StereoPannerNode;
  protected _target: AudioParam;

  constructor(ctx: AudioContext, { pan }: DromeFilterOptions) {
    super(pan);

    this._input = new GainNode(ctx);
    this._effect = new StereoPannerNode(ctx, { pan: this._defaultValue });
    this._target = this._effect.pan;
  }
}

export default PanEffect;
