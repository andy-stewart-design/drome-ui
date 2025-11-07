// TODO: finish logic for loading reverb samples

import type Drome from "./drome";
import { createImpulseResponse, renderFilter } from "../utils/reverb";
import { loadSample } from "../utils/load-sample";

interface LocalSampleSource {
  registered: true;
  name: string;
  bank: string;
}

interface RemoteSampleSource {
  registered: false;
  url: string;
}

type SampleSource = RemoteSampleSource | LocalSampleSource;

interface ReverbOptions {
  mix?: number;
  src?: SampleSource;
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

  constructor(drome: Drome, opts: ReverbOptions = {}) {
    const { mix = 0.1, src, decay = 1, lpfStart, lpfEnd } = opts;
    this.input = new GainNode(drome.ctx);
    this.convolver = new ConvolverNode(drome.ctx);
    this.id = src?.registered
      ? `${src.bank}-${src.name}`
      : `${decay}-${lpfStart || 0}-${lpfEnd || 0}`;

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

  private async loadSample(drome: Drome, src: SampleSource) {
    if ("url" in src) {
      const buffer = await loadSample(drome.ctx, src.url);

      if (!buffer) {
        console.warn(`Couldn't load sample from ${src}`);
        return;
      }

      this.convolver.buffer = buffer;
    } else {
      const [name, index] = src.name.split(":");

      const { buffer } = await drome.loadSample(src.bank, name, index);

      if (buffer) this.convolver.buffer = buffer;
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
  }

  get buffer() {
    return this.convolver.buffer;
  }

  get inputNode() {
    return this.input;
  }
}

export default ReverbEffect;
