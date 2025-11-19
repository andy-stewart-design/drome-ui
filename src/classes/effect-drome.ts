import DromeAudioNode from "./drome-audio-node";
import type Drome from "./drome";

interface DromeEffectOptions {
  mix?: number;
  variableDry?: boolean;
}

abstract class DromeEffect extends DromeAudioNode {
  protected _input: GainNode;
  protected _wet: GainNode;
  protected _dry: GainNode;

  constructor(
    drome: Drome,
    { mix = 0.1, variableDry = false }: DromeEffectOptions = {}
  ) {
    super();
    const dryGain = variableDry ? 1 - mix : 1;
    this._input = new GainNode(drome.ctx);
    this._wet = new GainNode(drome.ctx, { gain: mix });
    this._dry = new GainNode(drome.ctx, { gain: dryGain });
  }

  connect(dest: AudioNode) {
    this._dry.connect(dest);
    this._wet.connect(dest);
  }

  disconnect() {
    this._dry.disconnect();
    this._wet.disconnect();
  }

  wet(v: number) {
    this._wet.gain.value = v;
  }

  get input() {
    return this._input;
  }
}

export default DromeEffect;
export type { DromeEffectOptions };
