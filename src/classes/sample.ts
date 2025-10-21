import Instrument, { type InstrumentOptions } from "./instrument";
import { flipBuffer } from "../utils/flip-buffer";
import { getSamplePath } from "../utils/get-sample-path";
import { loadSample } from "../utils/load-sample";
import type Drome from "./drome";

type Nullable<T> = T | null | undefined;
type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

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

  private async loadSample(sampleId: string) {
    const [sampleName, sampleIndex] = sampleId.split(":");
    const samplePath = getSamplePath(this._sampleBank, sampleName, sampleIndex);

    if (!samplePath) {
      console.warn(`Couldn't find a sample: ${this._sampleBank} ${sampleName}`);
      return { path: null, buffer: null };
    }

    if (this._drome.bufferCache.has(samplePath)) {
      const buffer = this._drome.bufferCache.get(samplePath)!;
      return { path: samplePath, buffer };
    }

    const buffer = await loadSample(this.ctx, samplePath);
    if (buffer) this._drome.bufferCache.set(samplePath, buffer);
    return { path: samplePath, buffer };
  }

  preloadSamples() {
    return this._sampleIds.map(async (id) => this.loadSample(id));
  }

  bank(bank: string) {
    this._sampleBank = bank;
    return this;
  }

  chop(numChops: number, ...input: (number | Chord<number> | Cycle<number>)[]) {
    const isArray = Array.isArray;
    const convert = (n: Nullable<number>) => {
      return typeof n === "number" ? (1 / numChops) * (n % numChops) : null;
    };

    if (!input.length) {
      const chopsPerCycle = Math.floor(numChops / this._cycles.length) || 1;
      // const step = Math.min(1 / numChops, 1 / this._cycles.length);
      const step = 1 / (chopsPerCycle * this._cycles.length);

      this._cycles = Array.from({ length: this._cycles.length }, (_, i) => {
        return Array.from({ length: chopsPerCycle }, (_, j) => {
          return [step * j + chopsPerCycle * step * i];
        });
      });
      console.log(chopsPerCycle);
    } else {
      this._cycles = input.map((cycle) =>
        isArray(cycle)
          ? cycle.map((chord) =>
              isArray(chord)
                ? chord.map((note) => convert(note))
                : [convert(chord)]
            )
          : [[convert(cycle)]]
      );
    }

    console.log(this._cycles);

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
    super.play(barStart, barDuration);
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const cycle = this._cycles[cycleIndex];
    const noteDuration = barDuration / cycle.length;

    this._sampleIds.forEach((sampleId) => {
      cycle.forEach((chopGroup, groupIndex) => {
        chopGroup?.forEach(async (chopPoint) => {
          // chopPoint is a number between 0 and 1
          const { buffer } = await this.loadSample(sampleId);
          if (!buffer || typeof chopPoint !== "number") return;

          const playbackRate = this._fitValue
            ? buffer.duration / barDuration / this._fitValue
            : Math.abs(this._playbackRate);
          const chopStartTime = chopPoint * buffer.duration;
          const chopDuration = buffer.duration - chopStartTime;

          const src = new AudioBufferSourceNode(this.ctx, {
            buffer:
              this._playbackRate < 0 ? flipBuffer(this.ctx, buffer) : buffer,
            playbackRate: playbackRate,
            loop: this._loop,
            detune: this._detune,
          });
          this._audioNodes.add(src);

          const gainNode = new GainNode(this.ctx);
          this._gainNodes.add(gainNode);

          const noteStart = barStart + groupIndex * noteDuration;
          // const endTime = this.applyGainAdsr(
          this.applyGainAdsr(
            gainNode.gain,
            noteStart,
            this._cut ? noteDuration : chopDuration
          );
          const filterNodes = this.createFilters(
            noteStart,
            this._cut ? noteDuration : chopDuration
          );
          this.applyLFOs(this);

          const nodes = [src, gainNode, ...filterNodes, this.connectChain()];
          nodes.forEach((node, i) => {
            const nextNode = nodes[i + 1];
            if (nextNode) node.connect(nextNode);
          });

          src.start(noteStart, chopStartTime);
          // src.stop(noteStart + endTime + 0.1);
          src.onended = () => {
            src.disconnect();
            this._audioNodes.delete(src);
            gainNode.disconnect();
            this._gainNodes.delete(gainNode);
          };
        });
      });
    });
  }
}
