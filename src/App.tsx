// TODO: create env with d.env() like how you create lfo with d.lfo()

import Drome from "./classes/drome";

const d = new Drome(120);
const note = 48;

// --------------------------------------------------
// LFO: DETUNE
// const lfo = d.lfo(0, 100, 4).type("sine");
// d.synth("sine").detune(lfo);

// --------------------------------------------------
// ENVELOPE: GAIN
// d.synth("sine").env(0.25, 0.25, 0.5, 0.1).euclid(4, 4);

// --------------------------------------------------
// DROME ARRAY: POSTGAIN + FILTER
// d.synth("sawtooth")
//   .lpf([200, 800])
//   .postgain([1, 0.25, 1, 0.25])
//   .note([note, note + 4, note + 7, note + 11]);

// --------------------------------------------------
// ENVELOPE: FILTERS
d.synth("sawtooth")
  .bpf(400)
  .bpenv(1600, 0.25, 0.25, 0.5, 0.1)
  .note([note, note + 4, note + 7, note + 11]);

// d.synth("sawtooth", "sine")
//   .lpf(100)
//   .lpenv(300, 0, 0.75, 0.375, 0.01)
//   .note([note, note, note, note]);

// --------------------------------------------------
// SAMPLES: BASIC
// d.sample("bd:3").bank("tr909").euclid(4, 4);

// --------------------------------------------------
// SAMPLES: START POINT
// d.sample("bass")
// .bank("sonicpi")
// .fit(2)
// .begin(0, 0.4)
// .lpf(200)
// .lpenv(1000, 0.1, 0.25, 0.25)
// .cut();

// --------------------------------------------------
// SAMPLES: CHOPPING
// d.sample("break").bank("loops").fit(2).chop(8, [0, 5, 1, 6]).cut();

// --------------------------------------------------
// SAMPLES: CHOP + REVERSE
// d.sample("rhodes").bank("loops").fit(2).chop(4).rev().cut().adsrMode("clip");

function App() {
  return (
    <main>
      <h1>DromeUI</h1>
      <div>
        <button onClick={() => d.start()}>Play</button>
        <button onClick={() => d.stop()}>Stop</button>
      </div>
    </main>
  );
}

export default App;
