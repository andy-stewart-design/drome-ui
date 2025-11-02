import LFO from "../classes/lfo";
import Envelope from "../classes/envelope";

function isNullish(v: unknown) {
  return v === null || v === undefined;
}

function isLfoTuple(n: unknown[]): n is [LFO] {
  return n[0] instanceof LFO;
}

function isEnvTuple(n: unknown[]): n is [Envelope] {
  return n[0] instanceof Envelope;
}

export { isNullish, isEnvTuple, isLfoTuple };
