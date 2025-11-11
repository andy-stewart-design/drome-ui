import DromeEffect, { type DromeEffectOptions } from "./drome-effect";
import type Drome from "./drome";

interface BitcrusherEffectOptions extends DromeEffectOptions {
  bitDepth?: number;
  rateReduction?: number;
}

class BitcrusherEffect extends DromeEffect {
  private bcNode: AudioWorkletNode;

  constructor(
    drome: Drome,
    { bitDepth = 16, rateReduction = 1, mix = 1 }: BitcrusherEffectOptions = {}
  ) {
    super(drome, { mix, variableDry: true });

    this.bcNode = new AudioWorkletNode(drome.ctx, "bitcrush-processor");
    this.bitDepth(bitDepth);
    this.rateReduction(rateReduction);

    // Dry path
    this.input.connect(this._dry);

    // Wet path
    this.input.connect(this.bcNode).connect(this._wet);
  }

  bitDepth(v: number) {
    this.bitParam.value = v;
  }

  rateReduction(v: number) {
    this.rateParam.value = v;
  }

  get bitParam() {
    const param = this.bcNode.parameters.get("bitDepth");
    if (!param)
      throw new Error("[BitcrusherEffect] couldn't get 'bitDepth' param");
    return param;
  }

  get rateParam() {
    const param = this.bcNode.parameters.get("rateReduction");
    if (!param)
      throw new Error("[BitcrusherEffect] couldn't get 'rateReduction' param");
    return param;
  }
}

export default BitcrusherEffect;
