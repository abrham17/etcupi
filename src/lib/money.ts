// ─── Money helpers (BigInt minor units) ──────────────────────
// 1 ETB = 100 santim. All amounts in the DB and logic layer are BigInt minor units.

export const CURRENCY = "ETB";

/** Parse user-supplied amount (string or number) to BigInt minor units. null when invalid. */
export function parseAmountToMinor(input: string | number): bigint | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return BigInt(Math.round(input * 100));
  }
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

/** Format minor units as "12,500.00" (birr with two decimals). */
export function formatBirr(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const wholeStr = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${wholeStr}.${frac.toString().padStart(2, "0")}`;
}

/** Format as "12,500.00 ETB" */
export function formatETB(minor: bigint): string {
  return `${formatBirr(minor)} ETB`;
}

/** Format as compact "12.5K ETB" for stat cards. */
export function formatCompact(minor: bigint): string {
  const birr = Number(minor / 100n);
  if (Math.abs(birr) >= 1_000_000) return `${(birr / 1_000_000).toFixed(1)}M ETB`;
  if (Math.abs(birr) >= 1_000) return `${(birr / 1_000).toFixed(1)}K ETB`;
  return `${birr.toFixed(0)} ETB`;
}

/** Test helper to build minor units from birr. */
export function birr(n: number): bigint {
  return BigInt(Math.round(n * 100));
}
