import Drome from "./classes/drome";

const d = new Drome();

// d.synth("triangle").lpf(1200).note(69);

// d.sample("bd:3").bank("tr909").note([0, 0, 0, 0]).rate(1);
// .adsr(0.01, 0, 1, 0.1)
// .adsrMode("clip");

// d.sample("bass").bank("sonicpi").fit(2).note(0, 0.4).cut();

// d.sample("break").bank("loops").fit(2).chop(8, [0, 5, 1, 6]).cut();

d.sample("rhodes").bank("loops").fit(2).chop(4).rev().cut().adsrMode("clip");

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
