import AutomatableEffect from "./effect-automatable";
import * as algos from "../utils/distortion-algorithms";
import type Envelope from "./envelope";
import type LFO from "./lfo";

type DistortionAlgorithm = keyof typeof algos;

interface BitcrusherEffectOptions {
  distortion: (number | number[])[] | [LFO] | [Envelope];
  postgain?: number;
  type?: DistortionAlgorithm;
}

class DistortionEffect extends AutomatableEffect<AudioWorkletNode> {
  protected _input: GainNode;
  protected _effect: AudioWorkletNode;
  protected _target: AudioParam;

  constructor(
    ctx: AudioContext,
    { distortion, postgain = 1, type }: BitcrusherEffectOptions
  ) {
    super(distortion);

    this._input = new GainNode(ctx);
    this._effect = new AudioWorkletNode(ctx, "distortion-processor", {
      processorOptions: { algorithm: type },
    } as AudioWorkletNodeOptions);
    this._target = this.distortionParam;

    this.distort(this._defaultValue);
    this.postgain(postgain);
  }

  distort(v: number) {
    this.distortionParam.value = v;
  }

  postgain(v: number) {
    this.postgainParam.value = v;
  }

  get distortionParam() {
    const param = this._effect.parameters.get("distortion");
    if (!param)
      throw new Error("[DistortionEffect] couldn't get 'distortion' param");
    return param;
  }

  get postgainParam() {
    const param = this._effect.parameters.get("postgain");
    if (!param)
      throw new Error("[DistortionEffect] couldn't get 'postgain' param");
    return param;
  }
}

export default DistortionEffect;
