interface SampleBankData {
  basePath: string;
  slugs: Record<string, string[]>;
}

interface SampleBankSchema {
  "9000": SampleBankData;
  ace: SampleBankData;
  cr78: SampleBankData;
  d70: SampleBankData;
  dmx: SampleBankData;
  dr550: SampleBankData;
  hr16: SampleBankData;
  ms404: SampleBankData;
  rm50: SampleBankData;
  tr505: SampleBankData;
  tr606: SampleBankData;
  tr626: SampleBankData;
  tr707: SampleBankData;
  tr808: SampleBankData;
  tr909: SampleBankData;
  loops: SampleBankData;
  [key: string]: SampleBankData;
}

// prettier-ignore
const sampleBankNames = [
  "9000","ace","cr78","d70","dmx","dr550",
  "hr16","ms404","rm50","tr505","tr606",
  "tr626","tr707","tr808","tr909","loops",
] as const;

function validateSampleBankData(data: unknown): asserts data is SampleBankData {
  if (typeof data !== "object" || data === null) {
    throw new Error("Data must be an object");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.basePath !== "string") {
    throw new Error("basePath must be a string");
  }

  if (typeof obj.slugs !== "object" || obj.slugs === null) {
    throw new Error("slugs must be an object");
  }

  const slugs = obj.slugs as Record<string, unknown>;

  for (const [key, value] of Object.entries(slugs)) {
    if (typeof key !== "string") {
      throw new Error(`slugs key must be a string, got ${typeof key}`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`slugs.${key} must be an array`);
    }
    if (!value.every((item) => typeof item === "string")) {
      throw new Error(`All items in slugs.${key} must be strings`);
    }
  }
}

function validateSampleBanks(data: unknown): asserts data is SampleBankSchema {
  if (typeof data !== "object" || data === null) {
    throw new Error("Schema must be an object");
  }

  const obj = data as Record<string, unknown>;

  for (const bank of sampleBankNames) {
    if (!(bank in obj)) {
      throw new Error(`Missing required bank: ${bank}`);
    }
    validateSampleBankData(obj[bank]);
  }
}

function parseSampleBanks(data: unknown) {
  validateSampleBanks(data);
  return data;
}

export { parseSampleBanks, type SampleBankData };
