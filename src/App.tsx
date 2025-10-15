import Drome from "./classes/drome";

const d = new Drome();
const sweepInst = d.synth().att(0.5).rel(0.5).adsrMode("clip").note(69, 73);

function App() {
  return (
    <main>
      <h1>DromeUI</h1>
      <div>
        <button
          onClick={() =>
            sweepInst.play(d.ctx.currentTime, d._clock.barDuration)
          }
        >
          Play
        </button>
      </div>
    </main>
  );
}

export default App;
