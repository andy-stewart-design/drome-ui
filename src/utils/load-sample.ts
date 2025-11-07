async function loadSample(ctx: AudioContext, url: string | undefined | null) {
  if (!url) {
    console.error(`Couldn't load sample. Ivalid url "${url}".`);
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const msg = `Failed to fetch sample: ${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });

    return audioBuffer;
  } catch (error) {
    console.error(`Error loading sample from "${url}":`, error);
    return null;
  }
}

export { loadSample };
