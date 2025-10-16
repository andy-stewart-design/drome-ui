import AudioClock from "./audio-clock";
import Sample from "./sample";
import Synth from "./synth";
import { sampleBanks } from "../utils/get-sample-path";

class Drome {
  readonly clock: AudioClock;
  readonly instruments: (Synth | Sample)[] = [];
  readonly audioChannels: GainNode[];
  readonly bufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    this.clock = new AudioClock();
    this.audioChannels = Array.from({ length: 8 }, () => {
      const gain = new GainNode(this.ctx, { gain: 0.75 });
      gain.connect(this.ctx.destination);
      return gain;
    });
    console.log(sampleBanks);
  }

  synth(...types: OscillatorType[]) {
    const synth = new Synth(this, {
      type: types,
      destination: this.audioChannels[0],
      defaultCycle: [[60]],
    });
    this.instruments.push(synth);
    return synth;
  }

  sample(...sampleIds: string[]) {
    const sample = new Sample(this, {
      destination: this.audioChannels[1],
      sampleIds: sampleIds,
      defaultCycle: [[0]],
    });
    this.instruments.push(sample);
    return sample;
  }

  get ctx() {
    return this.clock.ctx;
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  get barDuration() {
    return this.clock.barDuration;
  }
}

export default Drome;
