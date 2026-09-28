// ── Payment rail abstraction ─────────────────────────────────
// The rest of the app talks to PaymentRail only. Adding a new Ethiopian
// provider (Telebirr, CBE Birr, bank rails) means adding a new class here —
// no changes to API routes, UI, or business logic.

import { prisma } from "@/lib/prisma";
import { postLedgerEntries, type LedgerLine } from "@/lib/ledger/ledger";
import type { Prisma } from "@prisma/client";

export interface RailPaymentRequest {
  txId: string;
  reference: string;
  amount: bigint;
  currency: string;
  senderWalletId: string | null;
  recipientWalletId: string | null;
  purpose?: string | null;
  meta?: Record<string, unknown>;
}

export interface RailResult {
  ok: boolean;
  railRef: string;
  failureReason?: string;
}

export interface PaymentRail {
  readonly code: string;
  readonly name: string;
  createPayment(req: RailPaymentRequest): Promise<RailResult>;
  verifyPayment(railRef: string): Promise<RailResult>;
  reversePayment(originalRailRef: string, reversalTxId: string, amount: bigint): Promise<RailResult>;
}

/**
 * InternalPaymentRail — simulated rail that moves money entirely inside the
 * application's own double-entry ledger. Works end-to-end with no external
 * dependencies, which makes the whole product testable today.
 */
export class InternalPaymentRail implements PaymentRail {
  readonly code = "internal";
  readonly name = "Internal (simulated)";

  async createPayment(req: RailPaymentRequest): Promise<RailResult> {
    // The ledger posting itself happens in the caller's Prisma transaction.
    // Here we just produce a deterministic rail reference.
    return { ok: true, railRef: `INTL-${req.reference}` };
  }

  async verifyPayment(railRef: string): Promise<RailResult> {
    return { ok: true, railRef };
  }

  async reversePayment(originalRailRef: string, reversalTxId: string, amount: bigint): Promise<RailResult> {
    return { ok: true, railRef: `INTL-REV-${reversalTxId}` };
  }
}

/** Resolve a rail by code. New rails get registered here. */
export function getRail(code: string): PaymentRail {
  switch (code) {
    case "internal":
      return new InternalPaymentRail();
    // Future: case "telebirr": return new TelebirrPaymentRail(...);
    default:
      return new InternalPaymentRail();
  }
}

/**
 * Execute a payment inside a Prisma interactive transaction:
 * creates ledger entries, updates the Payment record and marks the
 * Transaction COMPLETED. Called by the payment engine after all checks pass.
 */
export async function completePaymentInTx(
  tx: Prisma.TransactionClient,
  opts: {
    txId: string;
    amount: bigint;
    rail: PaymentRail;
    railRef: string;
    lines: LedgerLine[];
  }
): Promise<void> {
  await postLedgerEntries(tx, opts.txId, opts.lines);
  await tx.payment.update({
    where: { txId: opts.txId },
    data: { status: "COMPLETED", railRef: opts.railRef, completedAt: new Date() },
  });
  await tx.transaction.update({
    where: { id: opts.txId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}
