import DromeArray from "./drome-array";
import type { DromeCycleValue, Nullable } from "../types";
import { euclid } from "../utils/euclid";

class DromeCycle<T> extends DromeArray<Nullable<T>> {
  constructor(defaultValue: DromeCycleValue<T>) {
    super(defaultValue);
  }

  /* ----------------------------------------------------------------
  /* PATTERN SETTERS
  ---------------------------------------------------------------- */
  protected applyPattern(patterns: (number | null | undefined)[][]) {
    const cycles = this._value.length ? this._value : this._defaultValue;
    const loops = Math.max(cycles.length, patterns.length);
    const nextCycles: DromeCycleValue<T> = [];

    for (let i = 0; i < loops; i++) {
      let noteIndex = 0;
      const cycle = cycles[i % cycles.length];
      const nextCycle = patterns[i % patterns.length].map((p) =>
        p === 0 ? null : cycle[noteIndex++ % cycle.length]
      );
      nextCycles.push(nextCycle);
    }

    return nextCycles;
  }

  euclid(pulses: number | number[], steps: number, rotation = 0) {
    this._value = this.applyPattern(euclid(pulses, steps, rotation));
    return this;
  }
}

export default DromeCycle;
