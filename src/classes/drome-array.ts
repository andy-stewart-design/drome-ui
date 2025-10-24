import type { DromeArrayValue, Nullable } from "../types";
import { euclid } from "../utils/euclid";

class DromeArray<T> {
  protected _value: DromeArrayValue<T> = [];
  protected _defaultValue: DromeArrayValue<T>;

  constructor(defaultValue: DromeArrayValue<T>) {
    this._defaultValue = defaultValue;
  }

  /* ----------------------------------------------------------------
  /* PATTERN SETTERS
  ---------------------------------------------------------------- */
  protected applyPattern(patterns: (number | null | undefined)[][]) {
    const cycles = this._value.length ? this._value : this._defaultValue;
    const loops = Math.max(cycles.length, patterns.length);
    const nextCycles: DromeArrayValue<T> = [];

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

  note(...input: (Nullable<T> | Nullable<T>[])[]) {
    this._value = input.map((cycle) =>
      Array.isArray(cycle) ? cycle : [cycle]
    );
    return this;
  }

  euclid(pulses: number | number[], steps: number, rotation = 0) {
    this._value = this.applyPattern(euclid(pulses, steps, rotation));
    return this;
  }

  reverse() {
    this._value = this._value
      .slice()
      .reverse()
      .map((arr) => arr?.slice().reverse());
    return this;
  }

  set defaultValue(value: DromeArrayValue<T>) {
    this._defaultValue = value;
  }

  set value(value: DromeArrayValue<T>) {
    this._value = value;
  }

  /* ----------------------------------------------------------------
  /* GETTERS
  ---------------------------------------------------------------- */
  at(i: number): Nullable<T>[];
  at(i: number, j: number): Nullable<T>;
  at(i: number, j?: number) {
    const value = this.value[i];
    if (typeof j === "number") return value[j % value.length];
    else return value;
  }

  get length() {
    return this.value.length;
  }

  get value() {
    return this._value.length ? this._value : this._defaultValue;
  }

  get rawValue() {
    return this._value;
  }
}

export default DromeArray;
