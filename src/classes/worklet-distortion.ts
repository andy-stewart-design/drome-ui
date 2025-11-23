import * as algos from "../utils/distortion-algorithms";

interface DistortionOptions extends AudioWorkletNodeOptions {
  processorOptions: {
    algorithm?: DistortionAlgorithm;
  };
}

type DistortionAlgorithm = keyof typeof algos;
type DistortionFunction = (typeof algos)[DistortionAlgorithm];

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(num, min), max);
const pv = (arr: Float32Array<ArrayBufferLike>, n: number) => arr[n] ?? arr[0];

class DistortionProcessor extends AudioWorkletProcessor {
  private algorithm: DistortionFunction;

  static get parameterDescriptors() {
    return [
      { name: "distortion", defaultValue: 0, minValue: 0, maxValue: 100 },
      { name: "postgain", defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor(options: DistortionOptions) {
    super();

    const { algorithm = "sigmoid" } = options.processorOptions ?? {};

    this.algorithm = algos[algorithm];
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const sourceLimit = Math.min(inputs.length, outputs.length);

    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      const input = inputs[inputNum];
      const output = outputs[inputNum];
      const chanCount = Math.min(input.length, output.length);

      for (let chanNum = 0; chanNum < chanCount; chanNum++) {
        const postArr = parameters.postgain;
        const distArr = parameters.distortion;

        input[chanNum].forEach((sample, i) => {
          const postgain = clamp(pv(postArr, i), 0.001, 1);
          const shape = Math.expm1(pv(distArr, i));

          output[chanNum][i] = postgain * this.algorithm(sample, shape);
        });
      }
    }

    return true;
  }
}

registerProcessor("distortion-processor", DistortionProcessor);
