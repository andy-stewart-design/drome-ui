import Instrument, { type InstrumentOptions } from "./instrument";
import { midiToFrequency } from "../utils/midi-to-frequency";
import type Drome from "./drome";

interface SynthOptions extends InstrumentOptions<number> {
  type?: OscillatorType[];
}

export default class Synth extends Instrument<number> {
  private _types: OscillatorType[];

  constructor(drome: Drome, opts: SynthOptions) {
    super(drome, { ...opts, gain: 0.375 });
    this._types = opts.type?.length ? opts.type : ["sine"];
  }

  play(barStart: number, barDuration: number) {
    const noteDuration = barDuration / this._cycle.length;

    this._types.forEach((type) => {
      this._cycle.forEach((midiChord, chordIndex) => {
        midiChord?.forEach((midiNote) => {
          if (!midiNote) return;

          const osc = new OscillatorNode(this.ctx, {
            frequency: midiToFrequency(midiNote),
            type,
            detune: this._detune,
          });
          this._audioNodes.add(osc);

          const gainNode = new GainNode(this.ctx);
          this._gainNodes.add(gainNode);

          const noteStart = barStart + chordIndex * noteDuration;
          const endTime = this.applyAdsr(
            gainNode.gain,
            noteStart,
            noteDuration
          );
          this.applyLFOs(this);

          osc.connect(gainNode).connect(this.connectChain());
          osc.start(noteStart);
          osc.stop(noteStart + endTime);
          osc.onended = () => {
            osc.disconnect();
            this._audioNodes.delete(osc);
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
