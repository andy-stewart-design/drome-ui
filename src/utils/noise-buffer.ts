function createNoiseBuffer(ctx: AudioContext, duration = 1) {
  const noiseBuffer = new AudioBuffer({
    length: ctx.sampleRate * duration,
    sampleRate: ctx.sampleRate,
  });

  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < noiseBuffer.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
}

export { createNoiseBuffer };
