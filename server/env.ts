/** Missing/invalid values fall back; out-of-range integers are clamped. */
export function boundedEnvInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
