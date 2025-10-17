import Instrument, { type InstrumentOptions } from "./instrument";
import { getSamplePath } from "../utils/get-sample-path";
import { loadSample } from "../utils/load-sample";
import type Drome from "./drome";

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

  fit(numBars = 1) {
    this._fitValue = numBars;
    this._cycle = [[0]];
    return this;
  }

  rate(n: number) {
    this._playbackRate = n;
    return this;
  }

  play(barStart: number, barDuration: number) {
    const noteDuration = barDuration / this._cycle.length;

    this._sampleIds.forEach((sampleId) => {
      this._cycle.forEach((chopGroup, groupIndex) => {
        chopGroup?.forEach(async (chopPoint) => {
          // chopPoint is a number between 0 and 1
          const { buffer } = await this.loadSample(sampleId);
          if (!buffer || typeof chopPoint !== "number") return;

          const playbackRate = this._fitValue
            ? buffer.duration / barDuration / this._fitValue
            : this._playbackRate;
          const chopStartTime = chopPoint * buffer.duration;
          const chopDuration = buffer.duration / this._cycle.length;
          const effectiveDuration = Math.min(
            chopDuration,
            buffer.duration / this._playbackRate
          );

          const src = new AudioBufferSourceNode(this.ctx, {
            buffer,
            playbackRate: playbackRate,
            loop: this._loop,
            detune: this._detune,
          });
          this._audioNodes.add(src);

          const gainNode = new GainNode(this.ctx);
          this._gainNodes.add(gainNode);

          const noteStart = barStart + groupIndex * noteDuration;
          const endTime = this.applyAdsr(
            gainNode.gain,
            noteStart,
            barDuration
            // effectiveDuration
            // buffer.duration / playbackRate
          );
          this.applyLFOs(this);

          src.connect(gainNode).connect(this.connectChain());
          src.start(noteStart, chopStartTime);
          src.stop(noteStart + endTime);
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

  stop() {
    this._audioNodes.forEach((node) => node.stop());
  }
}
