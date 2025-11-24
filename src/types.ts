import type DromeArray from "./classes/drome-array";
import * as algos from "./utils/distortion-algorithms";

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
  frequencies: DromeArray<number>;
  // env: { depth: number; adsr: AdsrEnvelope } | undefined;
}

type AutomatableParam = "gain" | "postgain" | "detune" | "pan";

type DromeCycleValue<T> = Nullable<T>[][];

type Note<T> = {
  value: T;
  start: number;
  duration: number;
} | null;

type DistortionAlgorithm = keyof typeof algos;
type DistortionFunction = (typeof algos)[DistortionAlgorithm];

export type {
  AdsrEnvelope,
  AdsrMode,
  AutomatableParam,
  DistortionAlgorithm,
  DistortionFunction,
  DromeCycleValue,
  DromeEventCallback,
  DromeEventType,
  FilterOptions,
  FilterType,
  InstrumentType,
  Metronome,
  Note,
  Nullable,
};
