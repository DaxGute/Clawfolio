/** Coerce Alpaca string numerics and unknown JSON values to finite numbers. */
export function parseFiniteNumber(
  value: string | number | null | undefined,
  fallback = 0,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOptionalFiniteNumber(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}
