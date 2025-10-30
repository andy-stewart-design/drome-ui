import Instrument, { type InstrumentOptions } from "./instrument";
import { midiToFrequency } from "../utils/midi-to-frequency";
import type Drome from "./drome";

interface SynthOptions extends InstrumentOptions<number | number[]> {
  type?: OscillatorType[];
}

export default class Synth extends Instrument<number | number[]> {
  private _types: OscillatorType[];

  constructor(drome: Drome, opts: SynthOptions) {
    super(drome, { ...opts, baseGain: 0.25 });
    this._types = opts.type?.length ? opts.type : ["sine"];
  }

  play(barStart: number, barDuration: number) {
    const { notes, cycleIndex, destination } = this.beforePlay(
      barStart,
      barDuration
    );

    this._types.forEach((type) => {
      notes.forEach((note, chordIndex) => {
        if (!note) return;
        [note?.value].flat().forEach((midiNote) => {
          // if (!midiNote) return;
          const osc = new OscillatorNode(this.ctx, {
            frequency: midiToFrequency(midiNote),
            type,
          });
          this.applyDetune(osc, note, cycleIndex, chordIndex);
          this._audioNodes.add(osc);

          const { gainNode, noteEnd } = this.createGain(
            note.start,
            note.duration,
            chordIndex
          );
          // const noteEnd = this.applyGainEnv(
          //   gainNode.gain,
          //   note.start,
          //   note.duration
          // );

          osc.connect(gainNode).connect(destination);
          osc.start(note.start);
          osc.stop(note.start + noteEnd);

          const cleanup = () => {
            osc.disconnect();
            this._audioNodes.delete(osc);
            gainNode.disconnect();
            this._gainNodes.delete(gainNode);
            osc.removeEventListener("ended", cleanup);
          };

          osc.addEventListener("ended", cleanup);
        });
      });
    });
  }
}
