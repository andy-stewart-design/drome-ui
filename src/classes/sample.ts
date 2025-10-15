import { applyAdsr, getAdsrTimes } from "../utils/adsr";
import Instrument, { type InstrumentOptions } from "./instrument";

interface SampleOptions extends InstrumentOptions {
  playbackRate?: number;
  loop?: boolean;
}

export default class Sample extends Instrument<number> {
  private _playbackRate: number;
  private _loop: boolean;

  constructor(ctx: AudioContext, opts: SampleOptions) {
    super(ctx, opts);
    this._playbackRate = opts.playbackRate || 1;
    this._loop = opts.loop ?? false;
  }

  static createNoiseBuffer(ctx: AudioContext, duration = 1) {
    const noiseBuffer = new AudioBuffer({
      length: ctx.sampleRate * duration,
      sampleRate: ctx.sampleRate,
    });

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < noiseBuffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return noiseBuffer;
  }

  static async loadSample(ctx: AudioContext, url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const msg = `Failed to fetch sample: ${response.status} ${response.statusText}`;
        throw new Error(msg);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });

      return audioBuffer;
    } catch (error) {
      console.error(`Error loading sample from "${url}":`, error);
      return null;
    }
  }

  play(
    buffer: AudioBuffer,
    start: number,
    stepLength: number,
    chopIndex?: number
  ) {
    const sampleStartOffset = chopIndex
      ? buffer.duration * (1 / 4) * chopIndex
      : 0;
    const samplePlayDuration = chopIndex
      ? buffer.duration * (1 / 4)
      : buffer.duration;
    const sampleSource = new AudioBufferSourceNode(this._ctx, {
      buffer,
      playbackRate: this._playbackRate,
      loop: this._loop,
      detune: this._detune,
    });
    this._audioNodes.add(sampleSource);

    const gainNode = new GainNode(this._ctx);

    const effectiveDuration = Math.min(
      samplePlayDuration / this._playbackRate,
      stepLength
    );

    const envTimes = getAdsrTimes({
      a: this._adsr.a,
      d: this._adsr.d,
      r: this._adsr.r,
      stepLength: effectiveDuration,
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
      this._audioNodes.delete(sampleSource);
      gainNode.disconnect();
      sampleSource.disconnect();
    };
  }
}
