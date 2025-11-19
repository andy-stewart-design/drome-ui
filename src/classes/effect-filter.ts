import AutomatableEffect from "./effect-automatable";
import Envelope from "./envelope";
import LFO from "./lfo";
import type { FilterType } from "../types";

interface DromeFilterOptions {
  type: FilterType;
  frequency: (number | number[])[] | [LFO] | [Envelope];
}

class DromeFilter extends AutomatableEffect<BiquadFilterNode> {
  protected _input: BiquadFilterNode;
  protected _target: AudioParam;

  constructor(ctx: AudioContext, opts: DromeFilterOptions) {
    const { type, frequency } = opts;
    super(frequency);

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

  get type() {
    return this._input.type;
  }
}

export default DromeFilter;
