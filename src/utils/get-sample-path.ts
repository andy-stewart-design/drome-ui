import { parseSampleBanks } from "./validate-sample-banks";

const modules = import.meta.glob("../dictionaries/samples/**/*.json", {
  import: "default",
});

const promises = Object.entries(modules).map(async ([path, getter]) => {
  const key = path.split("/").at(-1)?.replace(".json", "") ?? path;
  const data = await getter();
  return [key, data] as const;
});

const rawData = Object.fromEntries(await Promise.all(promises));

const sampleBanks = parseSampleBanks(rawData);

function getSamplePath(bank: string, name: string, index: number | string) {
  const data = sampleBanks[bank.toLocaleLowerCase()];
  const slugs = data?.slugs[name];
  if (!data || !slugs) return undefined;
  const slug = slugs[toNumber(index) % slugs.length];
  return `${data.basePath}${slug}`;
}

function toNumber(value: number | string): number {
  if (typeof value === "number") {
    return isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

export { getSamplePath, sampleBanks };
