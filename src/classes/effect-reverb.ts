import AutomatableEffect from "./effect-automatable";
import { createImpulseResponse, renderFilter } from "../utils/reverb";
import { loadSample } from "../utils/load-sample";
import type Drome from "./drome";
import type { Automatable } from "../types";

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
  mix?: Automatable;
  src?: SampleSource;
  decay?: number; // IR decay time in seconds
  lpfStart?: number;
  lpfEnd?: number; // dim
}

class ReverbEffect extends AutomatableEffect<ConvolverNode> {
  protected _input: GainNode;
  protected _effect: ConvolverNode;
  protected _target: AudioParam;
  private _dry: GainNode;
  private _wet: GainNode;
  private _id: string;

  constructor(drome: Drome, opts: ReverbOptions = {}) {
    const { mix = [0.1], src, decay = 1, lpfStart, lpfEnd } = opts;
    super(mix);

    this._input = new GainNode(drome.ctx);
    this._effect = new ConvolverNode(drome.ctx);
    this._dry = new GainNode(drome.ctx);
    this._wet = new GainNode(drome.ctx, { gain: this._defaultValue });
    this._target = this._wet.gain;

    this._id = src?.registered
      ? `${src.bank}-${src.name}`
      : `${decay}-${lpfStart || 0}-${lpfEnd || 0}`;

    if (src) {
      this.loadSample(drome, src);
    } else {
      const buffer = drome.reverbCache.get(this._id);
      if (buffer) this._effect.buffer = buffer;
      else this.createBuffer(drome, decay, lpfStart, lpfEnd);
    }
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
        this._effect.buffer = out;
        drome.reverbCache.set(this._id, out);
      });
    } else {
      this._effect.buffer = buffer;
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

      this._effect.buffer = buffer;
    } else {
      const [name, index] = src.name.split(":");

      const { buffer } = await drome.loadSample(src.bank, name, index);

      if (buffer) this._effect.buffer = buffer;
    }
  }

  connect(dest: AudioNode) {
    // Dry signal passes through unaffected
    this.input.connect(this._dry).connect(dest);
    // Wet signal with effect
    this.input.connect(this._effect).connect(this._wet).connect(dest);
  }

  get buffer() {
    return this._effect.buffer;
  }
}

export default ReverbEffect;
