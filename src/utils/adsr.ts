import type { AdsrMode } from "../types";

interface getAdsrTimesArgs {
  a: number;
  d: number;
  r: number;
  duration: number;
  mode: AdsrMode;
}

function getAdsrTimes({ a, d, r, duration, mode }: getAdsrTimesArgs) {
  if (mode === "clip") {
    const adsrSum = a + d + r;
    const nA = adsrSum > 1 ? a / adsrSum : a;
    const nD = adsrSum > 1 ? d / adsrSum : d;
    const nR = adsrSum > 1 ? r / adsrSum : r;

    const att = nA * duration;
    const dec = att + nD * duration;
    const rStart = duration - nR * duration;
    const rEnd = duration;

    return { a: att, d: dec, r: { start: rStart, end: rEnd } };
  } else if (mode === "fit") {
    const adsrSum = a + d;
    const nA = adsrSum > 1 ? a / adsrSum : a;
    const nD = adsrSum > 1 ? d / adsrSum : d;

    const att = nA * duration;
    const dec = att + nD * duration;
    const rStart = duration;
    const rEnd = duration + r * duration;

    return { a: att, d: dec, r: { start: rStart, end: rEnd } };
  } else {
    return { a, d: a + d, r: { start: a + d, end: a + d + r } };
  }
}

interface applyAdsrArgs {
  target: AudioParam;
  startTime: number;
  envTimes: ReturnType<typeof getAdsrTimes>;
  startValue?: number;
  maxValue: number;
  sustainValue: number;
  endValue?: number;
}

function applyAdsr({
  target,
  startTime,
  envTimes,
  startValue = 0,
  maxValue,
  sustainValue,
  endValue = 0,
}: applyAdsrArgs) {
  target.cancelScheduledValues(startTime);
  target.linearRampToValueAtTime(startValue, startTime + 0.0001);
  target.linearRampToValueAtTime(maxValue, startTime + envTimes.a);
  target.linearRampToValueAtTime(sustainValue, startTime + envTimes.d);
  target.setValueAtTime(sustainValue, startTime + envTimes.r.start);
  target.linearRampToValueAtTime(endValue, startTime + envTimes.r.end);
}

export { getAdsrTimes, applyAdsr };
