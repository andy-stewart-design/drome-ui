function bufferId(bank: string, name: string, i?: string | number | null) {
  return [`${bank.trim()}-${name.trim()}`, safeToNumber(i)] as const;
}

function safeToNumber(value: unknown) {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed === "") return 0;

    const num = Number(trimmed);

    if (!Number.isFinite(num)) return 0;

    return Math.floor(num);
  }

  return 0;
}

export { bufferId };
