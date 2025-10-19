function flipBuffer(ctx: AudioContext, buffer: AudioBuffer) {
  // Create a new AudioBuffer to store the reversed data
  const reversedBuffer = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  // Reverse each channel's data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const originalChannelData = buffer.getChannelData(i);
    const reversedChannelData = reversedBuffer.getChannelData(i);

    // Copy and reverse the data
    for (let j = 0; j < originalChannelData.length; j++) {
      reversedChannelData[j] =
        originalChannelData[originalChannelData.length - 1 - j];
    }
  }

  return reversedBuffer;
}

export { flipBuffer };
