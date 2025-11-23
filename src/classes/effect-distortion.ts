import DromeEffect, { type DromeEffectOptions } from "./effect-drome";
import type Drome from "./drome";

interface DistortionEffectOptions extends DromeEffectOptions {
  amount?: number; // controls distortion intensity
  oversample?: OverSampleType; // 'none' | '2x' | '4x'
}

class DistortionEffect extends DromeEffect {
  private waveShaper: WaveShaperNode;

  constructor(
    drome: Drome,
    { amount = 50, oversample = "4x", mix = 1 }: DistortionEffectOptions = {}
  ) {
    super(drome, { mix });
    this.waveShaper = new WaveShaperNode(drome.ctx, { oversample });
    this.setAmount(amount);

    // Dry path
    // this.input.connect(this._dry);

    // Wet path
    this.input.connect(this.waveShaper).connect(this._wet);
  }

  setAmount(amount: number) {
    this.waveShaper.curve = this.makeDistortionCurve(amount);
  }

  private makeDistortionCurve(amount: number) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

export default DistortionEffect;
