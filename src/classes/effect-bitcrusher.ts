import type { Automatable } from "../types";
import AutomatableEffect from "./effect-automatable";

interface BitcrusherEffectOptions {
  bitDepth: Automatable;
  rateReduction?: number;
}

class BitcrusherEffect extends AutomatableEffect<AudioWorkletNode> {
  protected _input: GainNode;
  protected _effect: AudioWorkletNode;
  protected _target: AudioParam;

  constructor(
    ctx: AudioContext,
    { bitDepth, rateReduction = 1 }: BitcrusherEffectOptions
  ) {
    super(bitDepth);

    this._input = new GainNode(ctx);
    this._effect = new AudioWorkletNode(ctx, "bitcrush-processor");
    this._target = this.bitParam;

    this.bitDepth(this._defaultValue);
    this.rateReduction(rateReduction);
  }

  bitDepth(v: number) {
    this.bitParam.value = v;
  }

  rateReduction(v: number) {
    this.rateParam.value = v;
  }

  get bitParam() {
    const param = this._effect.parameters.get("bitDepth");
    if (!param)
      throw new Error("[BitcrusherEffect] couldn't get 'bitDepth' param");
    return param;
  }

  get rateParam() {
    const param = this._effect.parameters.get("rateReduction");
    if (!param)
      throw new Error("[BitcrusherEffect] couldn't get 'rateReduction' param");
    return param;
  }
}

export default BitcrusherEffect;
