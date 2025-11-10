import DromeEffect, { type DromeEffectOptions } from "./drome-effect";
import type Drome from "./drome";

interface DelayEffectOptions extends DromeEffectOptions {
  delayTime?: number;
  feedback?: number;
}

class DelayEffect extends DromeEffect {
  private delay: DelayNode;
  private feedback: GainNode;

  constructor(
    drome: Drome,
    { delayTime = 0.25, feedback = 0.1, mix = 0.2 }: DelayEffectOptions = {}
  ) {
    super(drome, { mix });
    this.delay = new DelayNode(drome.ctx, { delayTime });
    this.feedback = new GainNode(drome.ctx, { gain: feedback });

    // Dry signal passes through
    this.input.connect(this._dry);
    // Wet signal with feedback
    this.input.connect(this.delay).connect(this._wet);
    this.delay.connect(this.feedback).connect(this.delay);
  }
}

export default DelayEffect;
