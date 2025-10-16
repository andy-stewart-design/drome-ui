import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import Instrument, { type InstrumentOptions } from "./instrument";
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

  play(
    buffer: AudioBuffer,
    start: number,
    stepLength: number,
    chopIndex?: number
  ) {
    const { duration } = buffer;
    const sampleStartOffset = chopIndex ? duration * (1 / 4) * chopIndex : 0;
    const samplePlayDuration = chopIndex ? duration * (1 / 4) : duration;

    const sampleSource = new AudioBufferSourceNode(this.ctx, {
      buffer,
      playbackRate: this._playbackRate,
      loop: this._loop,
      detune: this._detune,
    });
    this._audioNodes.add(sampleSource);

    const gainNode = new GainNode(this.ctx);
    this._gainNodes.add(gainNode);

    const effectiveDuration = Math.min(
      samplePlayDuration / this._playbackRate,
      stepLength
    );

    const envTimes = getAdsrTimes({
      a: this._adsr.a,
      d: this._adsr.d,
      r: this._adsr.r,
      duration: effectiveDuration,
      mode: this._adsrMode,
    });

    applyAdsr({
      target: gainNode.gain,
      startTime: start,
      envTimes,
      gain: this._gain,
      sustainLevel: this._adsr.s,
    });

    this.applyLFOs(this);

    sampleSource.connect(gainNode).connect(this.connectChain());
    sampleSource.start(start, sampleStartOffset, samplePlayDuration);
    sampleSource.onended = () => {
      sampleSource.disconnect();
      this._audioNodes.delete(sampleSource);
      gainNode.disconnect();
      this._gainNodes.delete(gainNode);
    };
  }
}
