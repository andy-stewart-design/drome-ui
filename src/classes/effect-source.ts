import type { AdsrEnvelope } from "../types";
import type Drome from "./drome";
import DromeArray from "./drome-array";
import Envelope from "./envelope";
import LFO from "./lfo";

interface SourceEffectApplyArgs {
  node: OscillatorNode | AudioBufferSourceNode;
  start: number;
  duration: number;
  cycleIndex: number;
  chordIndex: number;
}

abstract class SourceEffect {
  protected _drome: Drome;
  protected abstract _cycles: DromeArray<number>;
  protected abstract _env: Envelope | undefined;
  protected abstract _lfo: LFO | undefined;

  constructor(drome: Drome) {
    this._drome = drome;
  }

  abstract apply(args: SourceEffectApplyArgs): unknown;

  get cycles() {
    return this._cycles;
  }

  get env(): Envelope | undefined {
    return this._env;
  }

  set env(env: Envelope) {
    this._env = env;
  }

  get lfo(): LFO | undefined {
    return this._lfo;
  }

  set lfo(lfo: LFO) {
    this._lfo = lfo;
  }
}

interface ApplyGainReturn {
  envGain: GainNode;
  effectGain: GainNode;
  noteEnd: number;
}

class GainSourceEffect extends SourceEffect {
  protected _cycles: DromeArray<number>;
  protected _env: Envelope;
  protected _lfo: LFO | undefined;

  constructor(drome: Drome, baseGain?: number, adsr?: AdsrEnvelope) {
    super(drome);
    this._cycles = new DromeArray([[1]]);
    const { a, d, s, r } = adsr ?? { a: 0.005, d: 0, s: 1, r: 0.01 };
    this._env = new Envelope(0, baseGain || 1).adsr(a, d, s, r);
  }

  apply(args: SourceEffectApplyArgs): ApplyGainReturn {
    const { start, duration, cycleIndex, chordIndex } = args;

    const envGain = new GainNode(this._drome.ctx, {
      gain: this._env!.maxValue,
    });
    const noteEnd = this._env!.apply(envGain.gain, start, duration);

    const effectGain = new GainNode(this._drome.ctx, {
      gain: this._cycles.at(cycleIndex, chordIndex),
    });

    if (this._lfo?.paused) {
      this._lfo.stop();
      this._lfo.create().connect(effectGain.gain).start(start);
    } else if (this._lfo) {
      this._lfo.connect(effectGain.gain);
    }

    return { envGain, effectGain, noteEnd };
  }

  get env(): Envelope {
    return this._env;
  }
}

class DetuneSourceEffect extends SourceEffect {
  protected _cycles: DromeArray<number>;
  protected _env: Envelope | undefined;
  protected _lfo: LFO | undefined;

  constructor(drome: Drome) {
    super(drome);
    this._cycles = new DromeArray([[0]]);
  }

  apply(args: SourceEffectApplyArgs): void {
    const { node, start, duration, cycleIndex, chordIndex } = args;

    if (this._lfo?.paused) {
      this._lfo.stop();
      this._lfo.create().connect(node.detune).start(start);
    } else if (this._lfo) {
      this._lfo.connect(node.detune);
    } else if (this._env) {
      this._env.apply(node.detune, start, duration - 0.001);
    } else {
      node.detune.value = this._cycles.at(cycleIndex, chordIndex);
    }
  }
}

export { GainSourceEffect, DetuneSourceEffect };
