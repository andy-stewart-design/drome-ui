import AudioClock from "./audio-clock";
import Sample from "./sample";
import Synth from "./synth";

const BASE_GAIN = 0.75;
const NUM_CHANNELS = 8;

class Drome {
  readonly clock: AudioClock;
  readonly instruments: (Synth | Sample)[] = [];
  readonly audioChannels: GainNode[];
  readonly bufferCache: Map<string, AudioBuffer> = new Map();

  constructor(bpm?: number) {
    this.clock = new AudioClock(bpm);
    this.audioChannels = Array.from({ length: NUM_CHANNELS }, () => {
      const gain = new GainNode(this.ctx, { gain: 0.75 });
      gain.connect(this.ctx.destination);
      return gain;
    });
    this.clock.on("bar", this.handleTick.bind(this));
  }

  private handleTick() {
    this.instruments.forEach((inst) =>
      inst.play(this.barStartTime, this.barDuration)
    );
  }

  private async preloadSamples() {
    const samplePromises = [...this.instruments].flatMap((inst) => {
      if (inst instanceof Synth) return [];
      return inst.preloadSamples();
    });
    await Promise.all(samplePromises);
  }

  public async start() {
    if (!this.clock.paused) return;
    await this.preloadSamples();
    this.clock.start();
  }

  public stop() {
    this.clock.stop();
    this.instruments.forEach((inst) => inst.stop());
    // this.clearReplListeners();
    this.audioChannels.forEach((chan) => {
      chan.gain.cancelScheduledValues(this.ctx.currentTime);
      chan.gain.value = BASE_GAIN;
    });
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

  get barStartTime() {
    return this.clock.barStartTime;
  }

  get barDuration() {
    return this.clock.barDuration;
  }
}

export default Drome;
