import * as algos from "../utils/distortion-algorithms";
import { clamp } from "../utils/math";
import { av } from "../utils/worklet-utils";
import type { DistortionAlgorithm, DistortionFunction } from "../types";

interface DistortionOptions extends AudioWorkletNodeOptions {
  processorOptions: {
    algorithm?: DistortionAlgorithm;
  };
}

class DistortionProcessor extends AudioWorkletProcessor {
  private algorithm: DistortionFunction;

  static get parameterDescriptors() {
    return [
      { name: "distortion", defaultValue: 0, minValue: 0, maxValue: 100 },
      { name: "postgain", defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor({ processorOptions }: DistortionOptions) {
    super();

    const { algorithm = "sigmoid" } = processorOptions ?? {};

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

        for (let i = 0; i < input[chanNum].length; i++) {
          const postgain = clamp(av(postArr, i), 0.001, 1);
          const shape = Math.expm1(av(distArr, i));

          output[chanNum][i] =
            postgain * this.algorithm(input[chanNum][i], shape);
        }
      }
    }

    return true;
  }
}

registerProcessor("distortion-processor", DistortionProcessor);
