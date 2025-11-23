// Utils
const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(num, min), max);
const squash = (x: number) => x / (1 + x); // [0, inf) to [0, 1)
const mod = (n: number, m: number) => ((n % m) + m) % m;

// Core Distortion Algorithms
const sigmoid = (x: number, k: number) => ((1 + k) * x) / (1 + k * Math.abs(x));
const softClip = (x: number, k: number) => Math.tanh(x * (1 + k));
const hardClip = (x: number, k: number) => clamp((1 + k) * x, -1, 1);

// Wavefolding Algorithms
const fold = (x: number, k: number) => {
  const y = (1 + 0.5 * k) * x;
  const window = mod(y + 1, 4);
  return 1 - Math.abs(window - 2);
};
const sineFold = (x: number, k: number) => Math.sin((Math.PI / 2) * fold(x, k));

// Polynomial Distortion
const cubic = (x: number, k: number) => {
  const t = squash(Math.log1p(k));
  const cubic = (x - (t / 3) * x * x * x) / (1 - t / 3); // normalized to go from (-1, 1)
  return softClip(cubic, k);
};

// Diode/Asymmetric Distortion
const diode = (x: number, k: number, asym = false) => {
  const g = 1 + 2 * k; // gain
  const t = squash(Math.log1p(k));
  const bias = 0.07 * t;
  const pos = softClip(x + bias, 2 * k);
  const neg = softClip(asym ? bias : -x + bias, 2 * k);
  const y = pos - neg;
  // We divide by the derivative at 0 so that the distortion is roughly
  // the identity map near 0 => small values are preserved and undistorted
  const sech = 1 / Math.cosh(g * bias);
  const sech2 = sech * sech; // derivative of soft (i.e. tanh) is sech^2
  const denom = Math.max(1e-8, (asym ? 1 : 2) * g * sech2); // g from chain rule; 2 if both pos/neg have x
  return softClip(y / denom, k);
};

const asymDiode = (x: number, k: number) => diode(x, k, true);

// Chebyshev Harmonic Generator
const chebyshev = (x: number, k: number) => {
  const kl = 10 * Math.log1p(k);
  let tnm1 = 1;
  let tnm2 = x;
  let tn;
  let y = 0;
  for (let i = 1; i < 64; i++) {
    if (i < 2) {
      // Already set inital conditions
      y += i == 0 ? tnm1 : tnm2;
      continue;
    }
    tn = 2 * x * tnm1 - tnm2; // https://en.wikipedia.org/wiki/Chebyshev_polynomials#Recurrence_definition
    tnm2 = tnm1;
    tnm1 = tn;
    if (i % 2 === 0) {
      y += Math.min((1.3 * kl) / i, 2) * tn;
    }
  }
  // Soft clip
  return softClip(y, kl / 20);
};

export {
  sigmoid,
  softClip,
  hardClip,
  fold,
  sineFold,
  cubic,
  diode,
  asymDiode,
  chebyshev,
};

// -------------------------------------------------------------------------------------------------------
// Function	        Type	                        Harmonics	                Sound
// -------------------------------------------------------------------------------------------------------
// _scurve	        Smooth saturation	            Even + odd	                Warm
// _softClip	    Tanh soft clip	                Even + odd	                Classic analog/tube
// _hardClip	    Hard clip	                    Very bright, odd-heavy	    Harsh/digital
// fold	            Wavefolder	                    Lots of high harmonics	    Metallic, West Coast
// sineFold	        Soft wavefolder	                Complex richness	        Smooth metallic
// cubic	        Cubic polynomial + softclip	    Mostly odd	                Warm to crunchy
// diode	        Analog diode model	            Odd + even (asym)	        Realistic analog saturation
// asymDiode	    Asymmetric diode	            Strong even	                Tube-like warmth
// chebyshev	    Harmonic generator	            Controlled even harmonics	Buzzy, timbral
// -------------------------------------------------------------------------------------------------------
