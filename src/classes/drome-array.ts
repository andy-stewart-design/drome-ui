class DromeArray<T> {
  protected _value: T[][] = [];
  protected _defaultValue: T[][];

  constructor(defaultValue: T[][]) {
    this._defaultValue = defaultValue;
  }

  /* ----------------------------------------------------------------
  /* PATTERN SETTERS
  ---------------------------------------------------------------- */
  note(...input: (T | T[])[]) {
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

  set defaultValue(value: T[][]) {
    this._defaultValue = value;
  }

  set value(value: T[][]) {
    this._value = value;
  }

  /* ----------------------------------------------------------------
  /* GETTERS
  ---------------------------------------------------------------- */
  at(i: number): T[];
  at(i: number, j: number): T;
  at(i: number, j?: number) {
    const currentValue = this.value[i % this.value.length];
    if (typeof j === "number") return currentValue[j % currentValue.length];
    else return currentValue;
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
