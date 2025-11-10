class BitcrushProcessor extends AudioWorkletProcessor {
  private phaser: number;
  private last: number;

  static get parameterDescriptors() {
    return [
      {
        name: "bits",
        defaultValue: 4,
        minValue: 1,
        maxValue: 16,
      },
      {
        name: "normfreq",
        defaultValue: 0.1,
        minValue: 0.0,
        maxValue: 1.0,
      },
    ];
  }

  constructor() {
    super();
    this.phaser = 0;
    this.last = 0;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length > 0) {
      const inputChannel = input[0];
      const outputChannel = output[0];

      const bits = parameters.bits;
      const normfreq = parameters.normfreq;

      for (let i = 0; i < outputChannel.length; i++) {
        // Handle parameter automation (array) or static values (single value)
        const currentBits = bits.length > 1 ? bits[i] : bits[0];
        const currentNormfreq = normfreq.length > 1 ? normfreq[i] : normfreq[0];

        const step = Math.pow(1 / 2, currentBits);

        this.phaser += currentNormfreq;
        if (this.phaser >= 1.0) {
          this.phaser -= 1.0;
          this.last = step * Math.floor(inputChannel[i] / step + 0.5);
        }
        outputChannel[i] = this.last;
      }
    }

    return true;
  }
}

// class BitcrushProcessor extends AudioWorkletProcessor {
//   private phase: number;
//   private lastSample: number;

//   // Define AudioParams for controlling sample rate and bit depth
//   static get parameterDescriptors() {
//     return [
//       {
//         name: "sampleRateReduction",
//         defaultValue: 1, // 1 means no reduction
//         minValue: 1,
//         maxValue: 128,
//       },
//       {
//         name: "bitDepthReduction",
//         defaultValue: 16, // 16-bit audio
//         minValue: 1,
//         maxValue: 16,
//       },
//     ];
//   }

//   constructor() {
//     super();
//     this.phase = 0;
//     this.lastSample = 0;
//   }

//   process(
//     inputs: Float32Array[][],
//     outputs: Float32Array[][],
//     parameters: Record<string, Float32Array>
//   ) {
//     const input = inputs[0];
//     const output = outputs[0];
//     const sampleRateReduction = parameters.sampleRateReduction[0];
//     const bitDepthReduction = parameters.bitDepthReduction[0];

//     if (!input || input.length === 0) return true;

//     const numChannels = input.length;
//     const numSamples = input[0].length;

//     for (let channel = 0; channel < numChannels; channel++) {
//       for (let i = 0; i < numSamples; i++) {
//         // Sample Rate Reduction
//         this.phase += 1;
//         if (this.phase >= sampleRateReduction) {
//           this.phase = 0;
//           this.lastSample = input[channel][i];
//         }
//         let processedSample = this.lastSample;

//         // Bit Depth Reduction
//         const step = Math.pow(2, 16 - bitDepthReduction); // Assuming 16-bit input
//         processedSample = Math.floor(processedSample * step) / step;

//         output[channel][i] = processedSample;
//       }
//     }

//     return true; // Keep the processor alive
//   }
// }

registerProcessor("bitcrush-processor", BitcrushProcessor);
