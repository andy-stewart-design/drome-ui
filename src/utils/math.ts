function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function squash(x: number) {
  return x / (1 + x);
}

export { clamp, mod, squash };
