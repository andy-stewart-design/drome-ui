import type Drome from "./drome";

interface DromeEffectOptions {
  mix?: number;
  variableDry?: boolean;
}

abstract class DromeEffect {
  readonly input: GainNode;
  protected _wet: GainNode;
  protected _dry: GainNode;

  constructor(
    drome: Drome,
    { mix = 0.1, variableDry = false }: DromeEffectOptions = {}
  ) {
    const dryGain = variableDry ? 1 - mix : 1;
    this.input = new GainNode(drome.ctx);
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

  get inputNode() {
    return this.input;
  }
}

export default DromeEffect;
export type { DromeEffectOptions };
