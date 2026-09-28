import { randomBytes } from "crypto";

function rand(n: number): string {
  const alphabet = "0123456789ABCDEF";
  const bytes = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[bytes[i] % 16];
  return s;
}

/** Generate sequential-looking unique payment IDs: CUPI-EMP-000123, CUPI-MER-000542 */
export function generatePaymentId(kind: "EMP" | "MER"): string {
  return `CUPI-${kind}-${rand(6)}`;
}

/** Generate an immutable transaction reference: CUPI-20260927-8F72A1 */
export function generateReference(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `CUPI-${y}${m}${day}-${rand(6)}`;
}

/** Opaque URL-safe token for QR payloads and share links. */
export function generateToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

/** Human-readable payment request code the customer can type: CUPI-REQ-8F72A1 */
export function generateRequestCode(): string {
  return `CUPI-REQ-${rand(6)}`;
}

/** Public employee code: ETH-EMP-0001 */
export function generateEmployeeCode(seq: number): string {
  return `ETH-EMP-${String(seq).padStart(4, "0")}`;
}

/** Public merchant code: ETH-MER-0001 */
export function generateMerchantCode(seq: number): string {
  return `ETH-MER-${String(seq).padStart(4, "0")}`;
}
