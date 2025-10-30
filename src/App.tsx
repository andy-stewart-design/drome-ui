import Drome from "./classes/drome";

const d = new Drome(120);
const note = 48;

// --------------------------------------------------
// LFO: DETUNE
// const lfo = d.lfo(-100, 100, 4).type("sine");
// d.synth("sine").detune(lfo);

// --------------------------------------------------
// ENV: DETUNE
// const env = d.env(300).adsr(0.125, 0.125, 0, 0.1);
// d.synth("sine").detune(env);

// --------------------------------------------------
// LFO: FILTER
// const lfo = d.lfo(300, 900, 16).type("sine");
// d.synth("sawtooth").env(0.05, 0.9, 0.25, 0.1).bpf(lfo).note(note).euclid(4, 4);

// --------------------------------------------------
// ENV: FILTER
// const env = d.env(300, 900).adsr(0.25, 0.25, 0.5);
// d.synth("sawtooth").env(0.05, 0.9, 0.25, 0.1).lpf(env).note(note).euclid(4, 4);

// --------------------------------------------------
// ENVELOPE: GAIN
// d.synth("triangle").note(note).gain(1.25).env(0.25, 0.25, 0.25, 0.1).euclid(4, 4);
// -------- OR --------
// const env = d.env(0, 1.25).adsr(0.25, 0.25, 0.25, 0.1);
// d.synth("triangle").note(note).gain(env).euclid(4, 4);

// --------------------------------------------------
// ENVELOPE: PAN
const env = d.env(-1, 1).adsr(0.5, 0.5, 0, 0.1);
const lfo = d.lfo(0, 1, 8).type("sine");
console.log(lfo);

d.synth("square")
  .lpf(800)
  .note([note, note + 4, note + 7, note + 11])
  // .pan(env)
  .postgain(lfo);
// .pan([-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
// .pan([-1, 1, -1, 1]);

// d.sample("hh")
//   .euclid(16, 16)
//   .pan(lfo)
//   // .pan([-1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0])
//   // .pan([-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1])
//   // .env(0.05, 0, 1, 0.05)
//   .postgain(0.5);

// --------------------------------------------------
// DROME ARRAY: POSTGAIN + FILTER
// d.synth("sawtooth")
//   .lpf([200, 800])
//   .postgain([1, 0.25, 1, 0.25])
//   .note([note, note + 4, note + 7, note + 11]);

// --------------------------------------------------
// ENVELOPE: FILTERS
// d.synth("sawtooth")
//   .bpf(400)
//   .bpenv(1600, 0.25, 0.25, 0.5, 0.1)
//   .note([note, note + 4, note + 7, note + 11]);

// d.synth("sawtooth", "sine")
//   .lpf(100)
//   .lpenv(300, 0, 0.5, 0.375, 0.01)
//   .note([note, note, note, note]);

// --------------------------------------------------
// SAMPLES: BASIC
// d.sample("bd:3").bank("tr909").euclid(4, 4);
// d.sample("cp").bank("tr808").euclid(2, 4, 1);

// --------------------------------------------------
// // SAMPLES: START POINT
// d.sample("bass")
//   .bank("sonicpi")
//   .fit(2)
//   .begin(0, 0.45)
//   .lpf(200)
//   .rel(0.1)
//   .lpenv(1000, 0.1, 0.25, 0.25)
//   .cut();

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
