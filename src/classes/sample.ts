import Instrument, { type InstrumentOptions } from "./instrument";
import { flipBuffer } from "../utils/flip-buffer";
import type Drome from "./drome";

type Nullable<T> = T | null | undefined;

interface SampleOptions extends InstrumentOptions<number> {
  sampleIds?: string[];
  sampleBank?: string;
  playbackRate?: number;
  loop?: boolean;
}

export default class Sample extends Instrument<number> {
  private _sampleIds: string[];
  private _sampleBank: string;
  private _playbackRate: number;
  private _loop: boolean;
  private _fitValue: number | undefined;
  private _cut = false;

  constructor(drome: Drome, opts: SampleOptions) {
    super(drome, opts);
    this._sampleIds = opts.sampleIds?.length ? opts.sampleIds : ["bd"];
    this._sampleBank = opts.sampleBank || "tr909";
    this._playbackRate = opts.playbackRate || 1;
    this._loop = opts.loop ?? false;
  }

  preloadSamples() {
    return this._sampleIds.map(async (id) => {
      const [name, index] = id.split(":");
      return this._drome.loadSample(this._sampleBank, name, index);
    });
  }

  bank(bank: string) {
    this._sampleBank = bank.toLocaleLowerCase();
    return this;
  }

  begin(...input: (Nullable<number> | Nullable<number>[])[]) {
    this._cycles.note(...input);
    return this;
  }

  chop(numChops: number, ...input: (number | number[])[]) {
    const isArray = Array.isArray;
    const convert = (n: Nullable<number>) => {
      return typeof n === "number" ? (1 / numChops) * (n % numChops) : null;
    };

    if (!input.length) {
      const chopsPerCycle = Math.floor(numChops / this._cycles.length) || 1;
      // const step = Math.min(1 / numChops, 1 / this._cycles.length);
      const step = 1 / (chopsPerCycle * this._cycles.length);

      this._cycles.value = Array.from(
        { length: this._cycles.length },
        (_, i) => {
          return Array.from({ length: chopsPerCycle }, (_, j) => {
            return step * j + chopsPerCycle * step * i;
          });
        }
      );
    } else {
      this._cycles.value = input.map((cycle) =>
        isArray(cycle) ? cycle.map((chord) => convert(chord)) : [convert(cycle)]
      );
    }

    return this;
  }

  cut() {
    this._cut = true;
    return this;
  }

  fit(numBars = 1) {
    this._fitValue = numBars;
    this.note(...Array.from({ length: numBars }, (_, i) => i / numBars));
    return this;
  }

  rate(n: number) {
    this._playbackRate = n;
    return this;
  }

  play(barStart: number, barDuration: number) {
    const { notes, cycleIndex, destination } = this.beforePlay(
      barStart,
      barDuration
    );

    this._sampleIds.forEach((sampleId) => {
      notes.forEach(async (note, noteIndex) => {
        const bank = this._sampleBank;
        const [name, index] = sampleId.split(":");
        const { buffer } = await this._drome.loadSample(bank, name, index);
        if (!buffer || typeof note?.value !== "number") return;

        const playbackRate = this._fitValue
          ? buffer.duration / barDuration / this._fitValue
          : Math.abs(this._playbackRate);
        const chopStartTime = note.value * buffer.duration;
        const chopDuration = buffer.duration - chopStartTime;

        const src = new AudioBufferSourceNode(this.ctx, {
          buffer:
            this._playbackRate < 0 ? flipBuffer(this.ctx, buffer) : buffer,
          playbackRate: playbackRate,
          loop: this._loop,
        });
        this.applyDetune(src, note, cycleIndex, noteIndex);
        this._audioNodes.add(src);

        const { effectGain, envGain } = this.createGain(
          note.start,
          this._cut ? note.duration : chopDuration,
          noteIndex
        );

        src.connect(envGain).connect(effectGain).connect(destination);
        src.start(note.start, chopStartTime);
        // src.stop(noteStart + endTime + 0.1);

        const cleanup = () => {
          src.disconnect();
          this._audioNodes.delete(src);
          effectGain.disconnect();
          this._gainNodes.delete(effectGain);
          src.removeEventListener("ended", cleanup);
        };

        src.addEventListener("ended", cleanup);
      });
    });
  }
}
