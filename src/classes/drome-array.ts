import type { Chord, Cycle } from "../types";

const isArray = Array.isArray;

class DromeArray<T> {
  protected _value: Cycle<T>[] = [];
  protected _defaultValue: Cycle<T>[];

  constructor(defaultValue: Cycle<T>[]) {
    this._defaultValue = defaultValue;
  }

  /* ----------------------------------------------------------------
  /* PATTERN SETTERS
  ---------------------------------------------------------------- */
  note(...input: (T | Chord<T> | Cycle<T>)[]) {
    this._value = input.map((cycle) =>
      isArray(cycle)
        ? cycle.map((chord) => (isArray(chord) ? chord : [chord]))
        : [[cycle]]
    );

    return this;
  }

  reverse() {
    this._value = this._value
      .slice()
      .reverse()
      .map((arr) => arr.slice().reverse());
    return this;
  }

  set defaultValue(value: Cycle<T>[]) {
    this._defaultValue = value;
  }

  set value(value: Cycle<T>[]) {
    this._value = value;
  }

  /* ----------------------------------------------------------------
  /* GETTERS
  ---------------------------------------------------------------- */
  at(i: number) {
    return this._value[i];
  }

  chordAt(cycleIndex: number, chordIndex: number) {
    const value = this._value.length ? this.value : this._defaultValue;
    const cycle = value[cycleIndex];
    return cycle[chordIndex % cycle.length];
  }

  noteAt(cycleIndex: number, chordIndex: number) {
    return this.chordAt(cycleIndex, chordIndex)?.[0];
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
