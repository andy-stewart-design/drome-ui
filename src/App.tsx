import Drome from "./classes/drome";

const d = await Drome.init(120);

const note = 48;

d.addSamples(
  {
    hey: [
      "https://cdn.freesound.org/previews/88/88401_950462-lq.mp3",
      "https://cdn.freesound.org/previews/348/348568_5614036-lq.mp3",
      "https://cdn.freesound.org/previews/416/416507_1549074-lq.mp3",
    ],
    bd: "https://cdn.freesound.org/previews/33/33573_294523-lq.mp3",
  },
  "vox"
);

// d.synth("sawtooth")
//   .note([72, 76, 79, 83], [69, 72, 76, 79])
//   .euclid(16, 32)
//   .adsr(0.01, 1, 0.75, 0.1)
//   .lpf(d.env(1000, 2000).adsr(0.01, 0.75, 0.125, 0.1))
//   // .detune(d.lfo(0, 1000, 4))
//   .reverb(0.375);
// d.sample("bd:3").bank("tr909").euclid([3, 5], 8).gain(1);
// d.sample("hh:4").euclid(8, 8).pan(0.875).gain(0.375);
// d.sample("oh:1").euclid(4, 8, 1).pan(0.125).gain(0.5);

// const env = d.env(400, 800).adsr(0.05, 1, 0);
// const lfo = d.lfo(400, 1600, 16).type("sine");
// const lfo2 = d.lfo(-0.5, 0.5, 16).type("sine");
// d.synth("triangle")
//   .note(note)
//   .euclid(4, 4)
//   .lpf(lfo)
//   .crush(4)
//   .pan(lfo2)
//   .gain(d.env(0, 1).adsr(0.05, 1, 0.25));

// const lfo = d.lfo(0.1, 1, 16).type("sine");
// d.synth("sine")
//   .note(note)
//   .euclid(4, 4)
//   .amp(lfo)
//   .env(0.025, 0.9, 0.1)
//   // .lpf(800)
//   // .crush(4)
//   .lpf(800)
//   .distort(100, 1);

// d.synth("sawtooth")
//   .note(note, note)
//   .env(0.01, 0.125, 0)
//   .lpf(400)
//   .delay(0.3, 0.25, 0.125);

// d.sample("hh").euclid(4, 4).gain(0.25);

d.sample("bd").euclid(4, 4).reverb("0.5, 0.1");

// d.synth("triangle")
//   .note(note)
//   .euclid(4, 4)
//   .amp([0.5, 1])
//   .adsr(0.1, 0.5, 0.25, 0.1);

// .detune(lfo);
// d.synth("triangle").note(note).euclid(4, 4).lpf([600, 1200]);
// d.synth("triangle").note(note).gain([0.1, 1]).euclid(4, 4).lpf(600);
// d.synth("triangle")
//   .note(48)
//   .euclid(4, 4)
//   .gain([0.5, 0.9, 0.25, 1])
//   .distort(1000, 0.2);
// .postgain(0.25);
// d.sample("hey:0").bank("vox").euclid(4, 4).distort(1000);
// d.synth("triangle").euclid(4, 4).gain([0.5, 0.9, 0.25, 1]);
// d.synth("triangle").euclid(4, 4).lpf(800).rel(0.1);
// d.synth("triangle").att(0.1).rel(0.25);
// d.synth("triangle").euclid(4, 4).att(0.1).rel(0.375).lpf(800);

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
// d.synth("sawtooth").env(0.005, 0.9, 0.25, 0.1).bpf(lfo).note(note).euclid(4, 4);

// --------------------------------------------------
// ENV: FILTER
// const env = d.env(300, 900).adsr(0.25, 0.25, 0.5);
// d.synth("sawtooth")
//   .env(0.05, 0.9, 0.25, 0.1)
//   .lpf(d.env(300, 900).adsr(0.25, 0.25, 0.5))
//   .note(note)
//   .euclid(4, 4);
// d.synth("sawtooth")
//   .env(0.05, 0.9, 0.25, 0.1)
//   .lpf(300)
//   .lpenv(900, 0.125, 0.125, 0.5)
//   .note(note)
//   .euclid(4, 4);

// --------------------------------------------------
// ENVELOPE: GAIN
// d.synth("triangle")
//   .note(note)
//   .amp(1.25)
//   .env(0.25, 0.25, 0.25, 0.1)
//   .euclid(4, 4);
// -------- OR --------
// const env = d.env(0, 1.25).adsr(0.25, 0.25, 0.25, 0.1);
// d.synth("triangle").note(note).gain(env).euclid(4, 4);

// --------------------------------------------------
// ENVELOPE: PAN
// const env = d.env(-0.5, 0.5).adsr(0.5, 0.5, 0, 0);
// const lfo = d.lfo(0, 1, 8).type("sine");

// d.synth("square")
//   .lpf(400)
//   .note([note])
//   .euclid(8, 8)
//   .att(0.1)
//   .rel(0.1)
//   // .note([note, note + 4, note + 7, note + 11])
//   .pan(env);
// // .postgain(lfo);
// // .pan([-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
// // .pan([-1, 1, -1, 1]);

// d.sample("hh")
//   .bank("tr909")
//   .euclid(16, 16)
//   .gain([1, 0.5])
//   .pan(lfo)
//   // .pan([-1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0])
//   // .pan([-1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1])
//   .env(0.05, 0, 1, 0.05)
//   .gain(0.75);

// --------------------------------------------------
// DROME ARRAY: POSTGAIN + FILTER
// d.synth("sawtooth")
//   .lpf([200, 800])
//   .postgain([1, 0.25, 1, 0.25])
//   .note([note, note + 4, note + 7, note + 11]);

// --------------------------------------------------
// SAMPLES: BASIC
// d.sample("hh:1")
//   .bank("tr909")
//   .euclid(8, 8)
//   .pan([0.875, -0.875])
//   .gain([0.5, 0.25]);
// d.sample("oh:1").bank("tr909").euclid(4, 8, 1).pan(-0.875).gain(0.75);
// d.sample("hh").bank("tr909").euclid(16, 16).pan(0.875);
// d.sample("bd:0")
//   .bank("tr909")
//   .euclid(4, 4)
//   .delay(0.125, 0.25, 0.25)
//   .reverb(0.1);
// d.sample("bd:0").bank("tr909").euclid(4, 4).reverb(0.8, "hey:1", "vox");
// d.synth("triangle")
//   .note([note, note + 4])
//   .euclid(3, 8)
//   .env(0.01, 0, 1, 0.5)
//   .crush(4);
// d.sample("hey:2").bank("vox").euclid(2, 4).crush(4);
// d.sample("bd:3").euclid(4, 4);
// d.sample("hh").bank("tr808").euclid(4, 8, 1);
// d.sample("cp").bank("tr808").euclid(2, 4, 1).gain(0.75);

// --------------------------------------------------
// // SAMPLES: START POINT
// d.sample("bass")
//   .bank("sonicpi")
//   .fit(2)
//   .begin(0, 0.45)
//   .lpf(200)
//   .rel(0.1)
//   .lpf(d.env(200, 1000).adsr(0.1, 0.25, 0.25))
//   .cut();

// d.sample("bass")
//   .bank("sonicpi")
//   .fit(2)
//   .chop(4, [2, 3], [1, 0])
//   // .chop(4)
//   // .rev()
//   // .lpf(d.env(200, 1000).adsr(0.1, 0.25, 0.25))
//   .cut();

// --------------------------------------------------
// SAMPLES: CHOPPING
// d.sample("break")
//   .bank("loops")
//   .fit(2)
//   .chop(8, [0, 5, 1, 6], [0, 7, 6, 5])
//   .cut();

// --------------------------------------------------
// SAMPLES: CHOP + REVERSE
// d.sample("rhodes")
//   .bank("loops")
//   .fit(2)
//   .chop(4, [2, 3], [1, 0])
//   // .chop(4)
//   // .rev()
//   .cut();
// // .adsrMode("clip");
// // .adsr(0.1, 0, 1, 0.1);

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
