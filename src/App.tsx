import Drome from "./classes/drome";

const d = new Drome();

const note = 40;

// d.synth("sawtooth", "sine")
//   .lpf(200)
//   .lpenv(3, 0.25, 0.25, 1, 0.01)
//   .note([note, note, note, note]);

// d.synth("sawtooth", "sine")
//   .lpf(100)
//   .lpenv(3, 0, 0.75, 0.375, 0.01)
//   .note([note, note, note, note]);

// d.sample("bd:3").bank("tr909").note([0, 0, 0, 0]).rate(1);
// .adsr(0.01, 0, 1, 0.1)
// .adsrMode("clip");

// d.sample("bass")
//   .bank("sonicpi")
//   .fit(2)
//   .note(0, 0.4)
//   .lpf(100)
//   .lpenv(8, 0.1)
//   .cut();

// d.sample("break").bank("loops").fit(2).chop(8, [0, 5, 1, 6]).cut();

d.sample("rhodes")
  .bank("loops")
  .fit(2)
  .chop(4)
  .rev()
  .cut()
  .adsrMode("clip")
  .bpf(600)
  .bpenv(3)
  .dec(0.02);

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
