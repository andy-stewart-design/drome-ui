// class BitcrushProcessor extends AudioWorkletProcessor {
//   private phaser: number;
//   private last: number;

//   static get parameterDescriptors() {
//     return [
//       {
//         name: "bits",
//         defaultValue: 4,
//         minValue: 1,
//         maxValue: 16,
//       },
//       {
//         name: "normfreq",
//         defaultValue: 0.1,
//         minValue: 0.0,
//         maxValue: 1.0,
//       },
//     ];
//   }

//   constructor() {
//     super();
//     this.phaser = 0;
//     this.last = 0;
//   }

//   process(
//     inputs: Float32Array[][],
//     outputs: Float32Array[][],
//     parameters: Record<string, Float32Array>
//   ) {
//     const bits = parameters.bits;
//     const normfreq = parameters.normfreq;
//     const sourceLimit = Math.min(inputs.length, outputs.length);

//     for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
//       const input = inputs[inputNum];
//       const output = outputs[inputNum];
//       const chanCount = Math.min(input.length, output.length);

//       if (!input || input.length === 0) continue;

//       for (let chanNum = 0; chanNum < chanCount; chanNum++) {
//         input[chanNum].forEach((sample, i) => {
//           const currentBits = bits.length > 1 ? bits[i] : bits[0];
//           const currentNormfreq =
//             normfreq.length > 1 ? normfreq[i] : normfreq[0];

//           const step = Math.pow(1 / 2, currentBits);
//           this.phaser += currentNormfreq;

//           if (this.phaser >= 1.0) {
//             this.phaser -= 1.0;
//             this.last = step * Math.floor(sample / step + 0.5);
//           }

//           output[chanNum][i] = this.last;
//         });
//       }
//     }

//     return true;
//   }
// }

class BitcrushProcessor extends AudioWorkletProcessor {
  private phase: number;
  private lastSample: number;

  static get parameterDescriptors() {
    return [
      {
        name: "rateReduction",
        defaultValue: 8, // update every 8 samples
        minValue: 1,
        maxValue: 128,
      },
      {
        name: "bitDepth",
        defaultValue: 8,
        minValue: 1,
        maxValue: 16,
      },
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
        input[chanNum].forEach((sample, i) => {
          const currentRate =
            rateParam.length > 1 ? rateParam[i] : rateParam[0];
          const currentBits =
            bitsParam.length > 1 ? bitsParam[i] : bitsParam[0];

          this.phase++;
          if (this.phase >= currentRate) {
            this.phase = 0;

            const step = Math.pow(0.5, currentBits);
            this.lastSample = step * Math.floor(sample / step + 0.5);
          }

          output[chanNum][i] = this.lastSample;
        });
      }
    }

    return true;
  }
}

registerProcessor("bitcrush-processor", BitcrushProcessor);
