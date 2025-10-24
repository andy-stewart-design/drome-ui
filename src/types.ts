type Nullable<T> = T | null | undefined;

interface Metronome {
  beat: number;
  bar: number;
}

type DromeEventType = "start" | "pause" | "stop" | "beat" | "bar";
type DromeEventCallback = (m: Metronome, time: number) => void;

type AdsrMode = "fit" | "clip" | "free";

interface AdsrEnvelope {
  a: number;
  d: number;
  s: number;
  r: number;
}

type InstrumentType = "synth" | "sample";

type FilterType = "bandpass" | "highpass" | "lowpass";
interface FilterOptions {
  node: BiquadFilterNode;
  frequency: number;
  env: { depth: number; adsr: AdsrEnvelope } | undefined;
}

type LfoableParam = "detune" | FilterType;

type Note<T> = Nullable<T>;
type Chord<T> = Note<T>[];
type Cycle<T> = Nullable<Chord<T>>[];

export type {
  Nullable,
  Metronome,
  DromeEventCallback,
  DromeEventType,
  AdsrMode,
  AdsrEnvelope,
  InstrumentType,
  FilterType,
  FilterOptions,
  LfoableParam,
  Note,
  Chord,
  Cycle,
};
