import Drome from "./classes/drome";

const d = new Drome();
// const synth = d.synth("triangle").lpf(1200).note(69, 73, 76, 80);

d.sample("bd").rate(1).note(0, 0, 0, 0);
// .adsr(0.01, 0, 1, 0.1)
// .adsrMode("clip");

// d.sample("break:0")
//   .bank("loops")
//   // .fit(2)
//   // .note(0, 0.25, 0.5, 0.75)
//   .adsrMode("fit");

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
