import Drome from "./classes/drome";

const d = new Drome();
const sweepInst = d.synth("triangle").lpf(1200).note(69, 73, 76, 80);

function App() {
  return (
    <main>
      <h1>DromeUI</h1>
      <div>
        <button onClick={() => sweepInst.play(d.currentTime, d.barDuration)}>
          Play
        </button>
      </div>
    </main>
  );
}

export default App;
