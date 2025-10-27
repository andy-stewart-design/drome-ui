import LFO from "../classes/lfo";

function isNullish(v: unknown) {
  return v === null || v === undefined;
}

function isLfoTuple(n: unknown[]): n is [LFO] {
  return n[0] instanceof LFO;
}

export { isNullish, isLfoTuple };
