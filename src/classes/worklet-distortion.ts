import * as algos from "../utils/distortion-algorithms";

interface DistortionOptions extends AudioWorkletNodeOptions {
  algorithm: DistortionAlgorithm;
}

type DistortionAlgorithm = keyof typeof algos;
type DistortionFunction = (typeof algos)[DistortionAlgorithm];
const BLOCKSIZE = 128;

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(num, min), max);
const pv = (arr: Float32Array<ArrayBufferLike>, n: number) => arr[n] ?? arr[0];

class DistortionProcessor extends AudioWorkletProcessor {
  private started: boolean;
  private algorithm: DistortionFunction;

  static get parameterDescriptors() {
    return [
      { name: "distort", defaultValue: 0, minValue: 0, maxValue: 100 },
      { name: "postgain", defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor({ algorithm }: DistortionOptions) {
    super();
    this.started = false;
    this.algorithm = algos[algorithm];
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const input = inputs[0];
    const output = outputs[0];

    const hasInput = !(input[0] === undefined);

    if (this.started && !hasInput) return false;

    this.started = hasInput;

    for (let n = 0; n < BLOCKSIZE; n++) {
      const postgain = clamp(pv(parameters.postgain, n), 0.001, 1);
      const shape = Math.expm1(pv(parameters.distort, n));
      for (let ch = 0; ch < input.length; ch++) {
        const x = input[ch][n];
        output[ch][n] = postgain * this.algorithm(x, shape);
      }
    }
    return true;
  }
}

registerProcessor("distortion-processor", DistortionProcessor);
