import type { Nullable } from "../types";

type DromeArrayValue<T> = Nullable<T>[][];

class DromeArray<T> {
  protected _value: DromeArrayValue<T> = [];
  protected _defaultValue: DromeArrayValue<T>;

  constructor(defaultValue: DromeArrayValue<T>) {
    this._defaultValue = defaultValue;
  }

  /* ----------------------------------------------------------------
  /* PATTERN SETTERS
  ---------------------------------------------------------------- */
  note(...input: (Nullable<T> | Nullable<T>[])[]) {
    this._value = input.map((cycle) =>
      Array.isArray(cycle) ? cycle : [cycle]
    );
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
    const value = this.value.length ? this._value : this._defaultValue;
    if (typeof j === "number") return value[i][j];
    else return value[i];
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
