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
    super.play(barStart, barDuration);
    const cycleIndex = this._drome.metronome.bar % this._cycles.length;
    const cycle = this._cycles[cycleIndex];
    const noteDuration = barDuration / cycle.length;

    this._types.forEach((type) => {
      cycle.forEach((midiChord, chordIndex) => {
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
          const noteEnd = this.applyGainAdsr(
            gainNode.gain,
            noteStart,
            noteDuration
          );
          const filterNodes = this.createFilters(noteStart, noteDuration);
          this.applyLFOs(this);

          const nodes = [osc, gainNode, ...filterNodes, this.connectChain()];
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
            // cleanup after delay to prevent popping
            setTimeout(() => {
              filterNodes.forEach((node) => {
                node.disconnect();
                this._filterNodes.delete(node);
              });
            }, 100);
            osc.removeEventListener("ended", cleanup);
          };

          osc.addEventListener("ended", cleanup);
        });
      });
    });
  }
}
