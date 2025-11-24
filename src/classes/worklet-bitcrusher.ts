import { av } from "../utils/worklet-utils";

class BitcrushProcessor extends AudioWorkletProcessor {
  private phase: number;
  private lastSample: number;

  static get parameterDescriptors() {
    return [
      { name: "rateReduction", defaultValue: 8, minValue: 1, maxValue: 128 },
      { name: "bitDepth", defaultValue: 8, minValue: 1, maxValue: 16 },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
    this.lastSample = 0;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const rateParam = parameters.rateReduction;
    const bitsParam = parameters.bitDepth;

    const sourceLimit = Math.min(inputs.length, outputs.length);

    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      const input = inputs[inputNum];
      const output = outputs[inputNum];
      const chanCount = Math.min(input.length, output.length);

      for (let chanNum = 0; chanNum < chanCount; chanNum++) {
        const inChan = input[chanNum];
        const outChan = output[chanNum];
        const sampleCount = inChan.length;

        for (let i = 0; i < sampleCount; i++) {
          const sample = inChan[i];

          this.phase++;
          if (this.phase >= av(rateParam, i)) {
            this.phase = 0;

            const step = Math.pow(0.5, av(bitsParam, i));
            this.lastSample = step * Math.floor(sample / step + 0.5);
          }

          outChan[i] = this.lastSample;
        }
      }
    }

    return true;
  }
}

registerProcessor("bitcrush-processor", BitcrushProcessor);
