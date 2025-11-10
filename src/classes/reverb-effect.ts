// TODO: finish logic for loading reverb samples

import DromeEffect, { type DromeEffectOptions } from "./drome-effect";
import { createImpulseResponse, renderFilter } from "../utils/reverb";
import { loadSample } from "../utils/load-sample";
import type Drome from "./drome";

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

interface ReverbOptions extends DromeEffectOptions {
  src?: SampleSource;
  decay?: number; // IR decay time in seconds
  lpfStart?: number;
  lpfEnd?: number; // dim
}

class ReverbEffect extends DromeEffect {
  private _id: string;
  private _convolver: ConvolverNode;

  constructor(drome: Drome, opts: ReverbOptions = {}) {
    const { mix = 0.1, src, decay = 1, lpfStart, lpfEnd } = opts;
    super(drome, { mix });

    this._convolver = new ConvolverNode(drome.ctx);
    this._id = src?.registered
      ? `${src.bank}-${src.name}`
      : `${decay}-${lpfStart || 0}-${lpfEnd || 0}`;

    if (src) {
      this.loadSample(drome, src);
    } else {
      const buffer = drome.reverbCache.get(this._id);
      if (buffer) this._convolver.buffer = buffer;
      else this.createBuffer(drome, decay, lpfStart, lpfEnd);
    }

    // Dry path
    this.input.connect(this._dry);

    // Wet path
    this.input.connect(this._convolver).connect(this._wet);
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
        this._convolver.buffer = out;
        drome.reverbCache.set(this._id, out);
      });
    } else {
      this._convolver.buffer = buffer;
      drome.reverbCache.set(this._id, buffer);
    }
  }

  private async loadSample(drome: Drome, src: SampleSource) {
    if ("url" in src) {
      const buffer = await loadSample(drome.ctx, src.url);

      if (!buffer) {
        console.warn(`Couldn't load sample from ${src}`);
        return;
      }

      this._convolver.buffer = buffer;
    } else {
      const [name, index] = src.name.split(":");

      const { buffer } = await drome.loadSample(src.bank, name, index);

      if (buffer) this._convolver.buffer = buffer;
    }
  }

  get buffer() {
    return this._convolver.buffer;
  }
}

export default ReverbEffect;
