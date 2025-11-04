import type Drome from "./drome";
import { createImpulseResponse, renderFilter } from "../utils/reverb";
import { getSamplePath } from "../utils/get-sample-path";
import { loadSample } from "../utils/load-sample";

const reverbSamples = ["echo", "muffler", "spring", "telephone"] as const;

type ReverbSample = (typeof reverbSamples)[number];
type ReverbSource = ReverbSample | (string & {}) | null;

function isReverbSource(src: string): src is ReverbSample {
  return reverbSamples.includes(src as ReverbSample);
}

interface ReverbOptions {
  mix?: number;
  src?: ReverbSource;
  decay?: number; // IR decay time in seconds
  lpfStart?: number;
  lpfEnd?: number; // dim
}

class ReverbEffect {
  private id: string;
  private convolver: ConvolverNode;
  private wet: GainNode;
  private dry: GainNode;
  readonly input: GainNode;

  constructor(
    drome: Drome,
    { mix = 0.1, src = null, decay = 1, lpfStart, lpfEnd }: ReverbOptions = {}
  ) {
    this.input = new GainNode(drome.ctx);
    this.convolver = new ConvolverNode(drome.ctx);

    this.id = src?.trim() ?? `${decay}-${lpfStart || 0}-${lpfEnd || 0}`;

    if (src) {
      this.loadSample(drome, src);
    } else {
      const buffer = drome.reverbCache.get(this.id);
      if (buffer) this.convolver.buffer = buffer;
      else this.createBuffer(drome, decay, lpfStart, lpfEnd);
    }

    this.wet = new GainNode(drome.ctx, { gain: mix });
    this.dry = new GainNode(drome.ctx, { gain: 1 });

    // Dry path
    this.input.connect(this.dry);

    // Wet path
    this.input.connect(this.convolver);
    this.convolver.connect(this.wet);
  }

  private async createBuffer(
    drome: Drome,
    decay: number,
    lpfStart = 0,
    lpfEnd = 0
  ) {
    const buffer = createImpulseResponse(drome.ctx, decay);
    if (lpfStart) {
      renderFilter(buffer, decay, lpfStart, lpfEnd).then((out) => {
        this.convolver.buffer = out;
        drome.reverbCache.set(this.id, out);
      });
    } else {
      this.convolver.buffer = buffer;
      drome.reverbCache.set(this.id, buffer);
    }
  }

  private async loadSample(drome: Drome, src: NonNullable<ReverbSource>) {
    if (isReverbSource(src)) {
      const samplePath = getSamplePath("fx", src, 0);

      if (!samplePath) {
        console.warn(`Couldn't find a sample: ${src}`);
        return;
      }

      if (drome.bufferCache.has(samplePath)) {
        const buffer = drome.bufferCache.get(samplePath)!;
        this.convolver.buffer = buffer;
        return;
      }

      const buffer = await loadSample(drome.ctx, samplePath);

      if (!buffer) {
        console.warn(`Couldn't find a sample: ${src}`);
        return;
      }

      this.convolver.buffer = buffer;
      drome.bufferCache.set(samplePath, buffer);
    } else if (src?.startsWith("https")) {
      const buffer = await loadSample(drome.ctx, src);

      if (!buffer) {
        console.warn(`Couldn't find a sample: ${src}`);
        return;
      }

      this.convolver.buffer = buffer;
      drome.bufferCache.set(src, buffer);
    }
  }

  connect(dest: AudioNode) {
    this.dry.connect(dest);
    this.wet.connect(dest);
  }

  disconnect() {
    this.dry.disconnect();
    this.wet.disconnect();
  }

  setWetLevel(v: number) {
    this.wet.gain.value = v;
    this.dry.gain.value = 1 - v;
  }

  get buffer() {
    return this.convolver.buffer;
  }

  get inputNode() {
    return this.input;
  }
}

export default ReverbEffect;
