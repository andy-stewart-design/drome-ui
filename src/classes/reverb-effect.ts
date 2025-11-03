import type Drome from "./drome";
import { createImpulseResponse, renderFilter } from "../utils/reverb";

interface ReverbEffectOptions {
  mix?: number;
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
    { mix = 0.1, decay = 1, lpfStart, lpfEnd }: ReverbEffectOptions = {}
  ) {
    this.input = new GainNode(drome.ctx);
    this.convolver = new ConvolverNode(drome.ctx);

    this.id = `${decay}-${lpfStart || 0}-${lpfEnd || 0}`;
    const buffer = drome.reverbCache.get(this.id);
    if (buffer) this.convolver.buffer = buffer;
    else this.createBuffer(drome, decay, lpfStart, lpfEnd);

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
