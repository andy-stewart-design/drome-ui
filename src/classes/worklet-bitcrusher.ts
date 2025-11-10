class BitcrushProcessor extends AudioWorkletProcessor {
  private phase: number;
  private lastSample: number;

  // Define AudioParams for controlling sample rate and bit depth
  static get parameterDescriptors() {
    return [
      {
        name: "sampleRateReduction",
        defaultValue: 1, // 1 means no reduction
        minValue: 1,
        maxValue: 128, // Example max reduction
      },
      {
        name: "bitDepthReduction",
        defaultValue: 16, // 16-bit audio
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
    const input = inputs[0];
    const output = outputs[0];
    const sampleRateReduction = parameters.sampleRateReduction[0];
    const bitDepthReduction = parameters.bitDepthReduction[0];

    if (!input || input.length === 0) return true;

    const numChannels = input.length;
    const numSamples = input[0].length;

    for (let channel = 0; channel < numChannels; channel++) {
      for (let i = 0; i < numSamples; i++) {
        // Sample Rate Reduction
        this.phase += 1;
        if (this.phase >= sampleRateReduction) {
          this.phase = 0;
          this.lastSample = input[channel][i];
        }
        let processedSample = this.lastSample;

        // Bit Depth Reduction
        const step = Math.pow(2, 16 - bitDepthReduction); // Assuming 16-bit input
        processedSample = Math.floor(processedSample * step) / step;

        output[channel][i] = processedSample;
      }
    }

    return true; // Keep the processor alive
  }
}

registerProcessor("bitcrush-processor", BitcrushProcessor);
