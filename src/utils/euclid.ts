function euclid(pulses: number | number[], steps: number, rotation = 0) {
  function _euclid(pulse: number) {
    if (pulse < 0 || steps < 0 || steps < pulse) return [];

    let first = new Array(pulse).fill([1]);
    let second = new Array(steps - pulse).fill([0]);

    let firstLength = first.length;
    let minLength = Math.min(firstLength, second.length);
    let loopThreshold = 0;

    while (minLength > loopThreshold) {
      if (loopThreshold === 0) loopThreshold = 1;

      for (let x = 0; x < minLength; x++) {
        first[x] = [...first[x], ...second[x]];
      }

      if (minLength === firstLength) {
        second = second.slice(minLength);
      } else {
        second = first.slice(minLength);
        first = first.slice(0, minLength);
      }

      firstLength = first.length;
      minLength = Math.min(firstLength, second.length);
    }

    const pattern: number[] = [...first.flat(), ...second.flat()];

    if (rotation !== 0) {
      const len = pattern.length;
      const offset = ((rotation % len) + len) % len; // normalize rotation
      return [...pattern.slice(offset), ...pattern.slice(0, offset)];
    }

    return pattern;
  }

  // Handle both number and array input
  if (Array.isArray(pulses)) {
    return pulses.map((p) => _euclid(p));
  }
  return [_euclid(pulses)];
}

export { euclid };
