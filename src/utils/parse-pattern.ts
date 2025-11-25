// function parsePattern(input: number | string): Pattern {
//   if (typeof input === "string") return parsePatternString(input);
//   return [input];
// }

// function parseCycleInput(input: CycleInput): Cycle {
//   if (input instanceof Envelope) return [input];
//   else if (input instanceof LFO) return [input];
//   else return parsePattern(input);
// }

// function parsePatternString(input: string) {
//   const err = `[DROME] could not parse pattern string: ${input}`;
//   try {
//     const parsed = JSON.parse(`[${input}]`);
//     if (!isPattern(parsed)) throw new Error(err);
//     return parsed;
//   } catch {
//     console.warn(err);
//     return [];
//   }
// }

// function isPattern(input: unknown): input is Pattern {
//   return (
//     Array.isArray(input) &&
//     input.reduce<boolean>((_, x) => {
//       if (typeof x === "number") return true;
//       else if (Array.isArray(x)) return x.every((x) => typeof x === "number");
//       return false;
//     }, true)
//   );
// }
