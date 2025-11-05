function bufferId(bank: string, name: string, i?: string | number) {
  const index = typeof i === "string" ? i.trim() : i;

  return `${bank}-${name}-${index || 0}`;
}

export { bufferId };
