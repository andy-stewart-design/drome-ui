import Instrument, { type InstrumentOptions } from "./instrument";
import { midiToFrequency } from "../utils/midi-to-frequency";
import type Drome from "./drome";

interface SynthOptions extends InstrumentOptions<number | number[]> {
  type?: OscillatorType[];
}

export default class Synth extends Instrument<number | number[]> {
  private _types: OscillatorType[];

  constructor(drome: Drome, opts: SynthOptions) {
    super(drome, { ...opts, baseGain: 0.375 });
    this._types = opts.type?.length ? opts.type : ["sine"];
  }

  play(barStart: number, barDuration: number) {
    const notes = this.beforePlay(barStart, barDuration);

    this._types.forEach((type) => {
      notes.forEach((note, chordIndex) => {
        if (!note) return;
        [note?.value].flat().forEach((midiNote) => {
          // if (!midiNote) return;
          const osc = new OscillatorNode(this.ctx, {
            frequency: midiToFrequency(midiNote),
            type,
          });
          this._audioNodes.add(osc);

          this.applyDetune(osc, note.start, note.duration, chordIndex);
          const { gainNodes, noteEnd } = this.createGain(
            osc,
            note.start,
            note.duration,
            chordIndex
          );

          osc.start(note.start);
          osc.stop(note.start + noteEnd);

          const cleanup = () => {
            osc.disconnect();
            this._audioNodes.delete(osc);
            gainNodes.forEach((node) => {
              node.disconnect();
              this._gainNodes.delete(node);
            });
            osc.removeEventListener("ended", cleanup);
          };

          osc.addEventListener("ended", cleanup);
        });
      });
    });
  }
}
