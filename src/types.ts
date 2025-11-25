// TODO: do StepPattern, etc. need to be nullable?

import type DromeArray from "./classes/drome-array";
import type Envelope from "./classes/envelope";
import type LFO from "./classes/lfo";
import type * as algos from "./utils/distortion-algorithms";

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
}

type DistortionAlgorithm = keyof typeof algos;
type DistortionFunction = (typeof algos)[DistortionAlgorithm];

type DromeCycleValue<T> = Nullable<T>[][];

type Note<T> = {
  value: T;
  start: number;
  duration: number;
} | null;

type StepPatternInput = number | string;
type StepPattern = (number | number[])[];
type AutomatableInput = StepPatternInput | LFO | Envelope;
type Automatable = StepPattern | LFO | Envelope;
type RestInput = StepPattern | [string] | [LFO] | [Envelope];

export type {
  Automatable,
  AutomatableInput,
  AdsrEnvelope,
  AdsrMode,
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
  RestInput,
  StepPattern,
  StepPatternInput,
};
