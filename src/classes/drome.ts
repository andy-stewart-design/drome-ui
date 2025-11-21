import AudioClock from "./audio-clock";
import Envelope from "./envelope";
import LFO from "./lfo";
import Sample from "./sample";
import Synth from "./synth";
import bitcrusherUrl from "./worklet-bitcrusher?url";
import { getSamplePath } from "../utils/get-sample-path";
import { loadSample } from "../utils/load-sample";
import { bufferId } from "../utils/cache-id";

const BASE_GAIN = 0.8;
const NUM_CHANNELS = 8;

type Cycle = (number | number[])[] | [LFO] | [Envelope];
type CycleGetter = () => Cycle;

class Drome {
  readonly clock: AudioClock;
  readonly instruments: (Synth | Sample)[] = [];
  readonly audioChannels: GainNode[];
  readonly bufferCache: Map<string, AudioBuffer[]> = new Map();
  readonly reverbCache: Map<string, AudioBuffer> = new Map();
  readonly userSamples: Map<string, Map<string, string[]>> = new Map();

  // Method Aliases
  c: (...cycles: Cycle) => CycleGetter;

  static async init(bpm?: number) {
    const drome = new Drome(bpm);
    await drome.ctx.audioWorklet.addModule(bitcrusherUrl);
    return drome;
  }

  constructor(bpm?: number) {
    this.clock = new AudioClock(bpm);
    this.audioChannels = Array.from({ length: NUM_CHANNELS }, () => {
      const gain = new GainNode(this.ctx, { gain: 0.75 });
      gain.connect(this.ctx.destination);
      return gain;
    });
    this.clock.on("bar", this.handleTick.bind(this));

    this.c = this.cycle.bind(this);
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

  private getSamplePath(bank: string, name: string, index: number) {
    const paths = this.userSamples.get(bank)?.get(name);
    if (paths) return paths[index % paths.length];
    else return getSamplePath(bank, name, index);
  }

  addSamples(record: Record<string, string | string[]>, bank = "user") {
    const samples = Object.entries(record).map(([k, v]) => {
      return [k, Array.isArray(v) ? v : [v]] as const;
    });

    this.userSamples.set(bank, new Map(samples));
  }

  async loadSample(bank: string, name: string, i: string | number | undefined) {
    const [id, index] = bufferId(bank, name, i);

    const samplePath = this.getSamplePath(bank, name, index);
    const cachedBuffers = this.bufferCache.get(id);

    if (cachedBuffers?.[index]) {
      return { path: samplePath, buffer: cachedBuffers[index] };
    } else if (!samplePath) {
      console.warn(`Couldn't find a sample: ${bank} ${name}`);
      return { path: null, buffer: null };
    }

    const buffer = await loadSample(this.ctx, samplePath);

    if (!buffer) {
      console.warn(`Couldn't load sample ${name} from ${samplePath}`);
      return { path: null, buffer: null };
    } else if (cachedBuffers && !cachedBuffers[index]) {
      cachedBuffers[index] = buffer;
    } else if (!cachedBuffers) {
      const buffers: AudioBuffer[] = [];
      buffers[index] = buffer;
      this.bufferCache.set(id, buffers);
    }

    return { path: samplePath, buffer };
  }

  async start() {
    if (!this.clock.paused) return;
    await this.preloadSamples();
    this.clock.start();
  }

  stop() {
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
      defaultCycle: [[[60]]],
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

  env(maxValue: number, startValue = 0, endValue?: number) {
    return new Envelope(maxValue, startValue, endValue);
  }

  lfo(minValue: number, maxValue: number, speed: number) {
    const value = (maxValue + minValue) / 2;
    const depth = maxValue - value;
    const bpm = this.beatsPerMin;
    return new LFO(this.ctx, { value, depth, speed, bpm });
  }

  cycle(...cycles: (number | number[])[] | [LFO] | [Envelope]) {
    return () => cycles;
  }

  get ctx() {
    return this.clock.ctx;
  }

  get metronome() {
    return this.clock.metronome;
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

  get beatsPerMin() {
    return this.clock.beatsPerMin;
  }
}

export default Drome;
