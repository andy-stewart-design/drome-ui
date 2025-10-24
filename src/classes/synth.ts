import Instrument, { type InstrumentOptions } from "./instrument";
import { midiToFrequency } from "../utils/midi-to-frequency";
import type Drome from "./drome";

interface SynthOptions extends InstrumentOptions<number> {
  type?: OscillatorType[];
}

export default class Synth extends Instrument<number> {
  private _types: OscillatorType[];

  constructor(drome: Drome, opts: SynthOptions) {
    super(drome, { ...opts, baseGain: 0.25 });
    this._types = opts.type?.length ? opts.type : ["sine"];
  }

  play(barStart: number, barDuration: number) {
    const { cycle, cycleIndex, noteDuration } = this.beforePlay(
      barStart,
      barDuration
    );

    this._types.forEach((type) => {
      cycle.forEach((midiChord, chordIndex) => {
        midiChord?.forEach((midiNote) => {
          if (!midiNote) return;

          console.log(
            "current test value:",
            this._testArray.noteAt(cycleIndex, chordIndex)
          );

          const osc = new OscillatorNode(this.ctx, {
            frequency: midiToFrequency(midiNote),
            type,
            detune: this._detune,
          });
          this._audioNodes.add(osc);

          const gainNode = new GainNode(this.ctx, {
            gain: this._gain * this._baseGain,
          });
          this._gainNodes.add(gainNode);

          const noteStart = barStart + chordIndex * noteDuration;
          const noteEnd = this.applyGainAdsr(
            gainNode.gain,
            noteStart,
            noteDuration
          );

          const destination = this.connectChain(noteStart, noteDuration);
          const nodes = [osc, gainNode, destination];
          nodes.forEach((node, i) => {
            const nextNode = nodes[i + 1];
            if (nextNode) node.connect(nextNode);
          });

          osc.start(noteStart);
          osc.stop(noteStart + noteEnd);

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
