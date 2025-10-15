interface Metronome {
  beat: number;
  bar: number;
}

type DromeEventType = "start" | "pause" | "stop" | "beat" | "bar";
type DromeEventCallback = (m: Metronome, time: number) => void;

export type { Metronome, DromeEventCallback, DromeEventType };
