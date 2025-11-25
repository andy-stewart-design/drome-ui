import Envelope from "../classes/envelope";
import LFO from "../classes/lfo";
import { isEnvTuple, isLfoTuple, isStringTuple } from "./validators";
import type {
  AutomatableInput,
  RestInput,
  StepPattern,
  StepPatternInput,
} from "../types";

function parseStepPatternInput(input: StepPatternInput): StepPattern {
  if (typeof input === "string") return parsePatternString(input);
  return [input];
}

function parseRestInput(input: RestInput) {
  if (isEnvTuple(input) || isLfoTuple(input)) return input[0];
  else if (isStringTuple(input)) return parsePatternString(input[0]);
  else return input;
}

function parseAutomatableInput(input: AutomatableInput) {
  if (input instanceof Envelope || input instanceof LFO) return input;
  else return parseStepPatternInput(input);
}

function parsePatternString(input: string) {
  const err = `[DROME] could not parse pattern string: ${input}`;
  try {
    const parsed = JSON.parse(`[${input}]`);
    if (!isStepPattern(parsed)) throw new Error(err);
    return parsed;
  } catch {
    console.warn(err);
    return [];
  }
}

function isStepPattern(input: unknown): input is StepPattern {
  return (
    Array.isArray(input) &&
    input.reduce<boolean>((_, x) => {
      if (typeof x === "number") return true;
      else if (Array.isArray(x)) return x.every((x) => typeof x === "number");
      return false;
    }, true)
  );
}

export {
  isStepPattern,
  parseAutomatableInput,
  parsePatternString,
  parseRestInput,
  parseStepPatternInput,
};
