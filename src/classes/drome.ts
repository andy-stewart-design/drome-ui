import AudioClock from "./audio-clock";
import Sample from "./sample";
import Synth from "./synth";

class Drome {
  readonly _clock: AudioClock;
  readonly _instruments: (Synth | Sample)[] = [];
  readonly audioChannels: GainNode[];

  constructor() {
    this._clock = new AudioClock();
    this.audioChannels = Array.from({ length: 8 }, () => {
      const gain = new GainNode(this.ctx, { gain: 0.75 });
      gain.connect(this.ctx.destination);
      return gain;
    });
  }

  synth(...type: OscillatorType[]) {
    const synth = new Synth(this.ctx, {
      type: type,
      destination: this.audioChannels[0],
    });
    this._instruments.push(synth);
    return synth;
  }

  get ctx() {
    return this._clock.ctx;
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  get barDuration() {
    return this._clock.barDuration;
  }
}

export default Drome;
