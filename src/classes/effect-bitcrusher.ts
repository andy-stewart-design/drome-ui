import DromeEffect, { type DromeEffectOptions } from "./drome-effect";
import type Drome from "./drome";

interface BitcrusherEffectOptions extends DromeEffectOptions {
  bitDepth?: number;
  normfreq?: number;
}

class BitcrusherEffect extends DromeEffect {
  private bcNode: AudioWorkletNode;

  constructor(
    drome: Drome,
    { bitDepth = 16, normfreq = 0.1, mix = 1 }: BitcrusherEffectOptions = {}
  ) {
    super(drome, { mix, variableDry: true });

    this.bcNode = new AudioWorkletNode(drome.ctx, "bitcrush-processor");
    this.bitDepth(bitDepth);
    this.normfreq(normfreq);

    // Dry path
    this.input.connect(this._dry);

    // Wet path
    this.input.connect(this.bcNode).connect(this._wet);
  }

  bitDepth(v: number) {
    this.bitParam.value = v;
  }

  normfreq(v: number) {
    this.freqParam.value = v;
  }

  get bitParam() {
    const param = this.bcNode.parameters.get("bits");
    if (!param) throw new Error("[BitcrusherEffect] couldn't get 'bits' param");
    return param;
  }

  get freqParam() {
    const param = this.bcNode.parameters.get("normfreq");
    if (!param)
      throw new Error("[BitcrusherEffect] couldn't get 'normfreq' param");
    return param;
  }

  //   setAmount(amount: number) {
  //     this.waveShaper.curve = this.makeDistortionCurve(amount);
  //   }
}

export default BitcrusherEffect;
