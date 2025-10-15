type AdsrMode = "fit" | "clip" | "free";

interface AdsrEnvelope {
  a: number;
  d: number;
  s: number;
  r: number;
}

interface AdsrTimes {
  a: number;
  d: number;
  r: { start: number; end: number };
}

interface getAdsrTimesArgs {
  a: number;
  d: number;
  r: number;
  stepLength: number;
  mode: AdsrMode;
}

interface applyAdsrArgs {
  target: AudioParam;
  startTime: number;
  gain: number;
  sustainLevel: number;
  envTimes: AdsrTimes;
}

function getAdsrTimes({ a, d, r, stepLength, mode }: getAdsrTimesArgs) {
  if (mode === "clip") {
    const adsrSum = a + d + r;
    const nA = adsrSum > 1 ? a / adsrSum : a;
    const nD = adsrSum > 1 ? d / adsrSum : d;
    const nR = adsrSum > 1 ? r / adsrSum : r;

    const att = nA * stepLength;
    const dec = att + nD * stepLength;
    const rStart = stepLength - nR * stepLength;
    const rEnd = stepLength;

    return { a: att, d: dec, r: { start: rStart, end: rEnd } };
  } else if (mode === "fit") {
    const adsrSum = a + d;
    const nA = adsrSum > 1 ? a / adsrSum : a;
    const nD = adsrSum > 1 ? d / adsrSum : d;

    const att = nA * stepLength;
    const dec = att + nD * stepLength;
    const rStart = stepLength;
    const rEnd = stepLength + r * stepLength;

    return { a: att, d: dec, r: { start: rStart, end: rEnd } };
  } else {
    return { a, d: a + d, r: { start: a + d, end: a + d + r } };
  }
}

function applyAdsr({
  target,
  startTime,
  gain,
  sustainLevel,
  envTimes,
}: applyAdsrArgs) {
  target.cancelScheduledValues(startTime);
  target.setValueAtTime(0, startTime);
  target.linearRampToValueAtTime(gain, startTime + envTimes.a);
  target.linearRampToValueAtTime(sustainLevel * gain, startTime + envTimes.d);
  target.setValueAtTime(sustainLevel * gain, startTime + envTimes.r.start);
  target.linearRampToValueAtTime(0.001, startTime + envTimes.r.end);
}

export {
  getAdsrTimes,
  applyAdsr,
  type AdsrTimes,
  type AdsrMode,
  type AdsrEnvelope,
};
