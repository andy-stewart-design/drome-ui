// duration in seconds

function createImpulseResponse(ctx: AudioContext, decay = 0.5) {
  const sampleRate = ctx.sampleRate;
  const totalTime = decay * 1.5;
  const length = Math.round(totalTime * sampleRate);
  const decaySampleFrames = Math.round(decay * sampleRate);
  const fadeInFrames = Math.round(0.05 * sampleRate); // attack time on reverb
  const decayBase = Math.pow(1 / 1000, 1 / decaySampleFrames);

  const impulse = new AudioBuffer({ length, sampleRate, numberOfChannels: 2 });

  for (let ch = 0; ch < 2; ch++) {
    const chan = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      chan[i] = (Math.random() * 2 - 1) * Math.pow(decayBase, i);
    }
    for (let i = 0; i < fadeInFrames; i++) {
      chan[i] *= i / fadeInFrames;
    }
  }

  return impulse;
}

async function renderFilter(
  input: AudioBuffer,
  duration: number,
  lpfStart: number,
  lpfEnd: number
) {
  const ctx = new OfflineAudioContext(
    2,
    getAllChannelData(input)[0].length,
    input.sampleRate
  );

  const src = new AudioBufferSourceNode(ctx, { buffer: input });

  const filter = new BiquadFilterNode(ctx, {
    type: "lowpass",
    frequency: lpfStart,
    Q: 0.0001,
  });
  filter.frequency.linearRampToValueAtTime(lpfEnd, duration);

  src.connect(filter).connect(ctx.destination);
  src.start();

  const rendered = await ctx.startRendering();

  return rendered;
}

function getAllChannelData(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels[i] = buffer.getChannelData(i);
  }
  return channels;
}

export { createImpulseResponse, renderFilter };
