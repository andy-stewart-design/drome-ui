import type { AdsrEnvelope, AdsrMode } from "../types";
import { applyAdsr, getAdsrTimes } from "../utils/adsr";

class Envelope {
  private _startValue: number;
  private _maxValue: number;
  private _endValue: number;
  private _adsr: AdsrEnvelope = { a: 0.01, d: 0, s: 1, r: 0.01 };
  private _mode: AdsrMode = "fit";

  constructor(startValue: number, maxValue: number, endValue?: number) {
    this._startValue = startValue;
    this._maxValue = maxValue;
    this._endValue = endValue ?? startValue;
  }

  mode(mode: AdsrMode) {
    this._mode = mode;
    return this;
  }

  adsr(a: number, d?: number, s?: number, r?: number) {
    this._adsr.a = a;
    if (typeof d === "number") this._adsr.d = d;
    if (typeof s === "number") this._adsr.s = s;
    if (typeof r === "number") this._adsr.r = r;
    return this;
  }

  a(v: number) {
    this._adsr.a = v;
    return this;
  }

  d(v: number) {
    this._adsr.d = v;
    return this;
  }

  s(v: number) {
    this._adsr.s = v;
    return this;
  }

  r(v: number) {
    this._adsr.r = v;
    return this;
  }

  apply(target: AudioParam, startTime: number, duration: number) {
    const envTimes = getAdsrTimes({
      a: this._adsr.a,
      d: this._adsr.d,
      r: this._adsr.r,
      duration,
      mode: this._mode,
    });

    applyAdsr({
      target,
      startTime,
      startValue: this._startValue,
      envTimes,
      maxValue: this._maxValue,
      sustainValue: this._maxValue * this._adsr.s,
      endValue: this._endValue,
    });

    return envTimes.r.end;
  }

  get startValue() {
    return this._startValue;
  }

  get maxValue() {
    return this._maxValue;
  }

  set maxValue(v: number) {
    this._maxValue = v;
  }
}

export default Envelope;
