import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface LedgerLine {
  walletId: string;
  // Signed amount in minor units: negative = debit (money out), positive = credit (money in)
  amount: bigint;
  description: string;
}

/**
 * Post double-entry ledger lines inside an interactive transaction.
 *
 * Each line creates an immutable LedgerEntry and updates the wallet balance
 * atomically. Lines must sum to zero across the whole set (double-entry).
 *
 * The caller must pass the txId so entries can link back to the Transaction.
 */
export async function postLedgerEntries(
  tx: Prisma.TransactionClient,
  txId: string,
  lines: LedgerLine[]
): Promise<void> {
  const sum = lines.reduce((acc, l) => acc + l.amount, 0n);
  if (sum !== 0n) {
    throw new Error(`Ledger lines must balance (got ${sum} net)`);
  }

  for (const line of lines) {
    const wallet = await tx.wallet.findUnique({ where: { id: line.walletId } });
    if (!wallet) throw new Error(`Wallet ${line.walletId} not found`);
    const balanceAfter = wallet.balance + line.amount;
    if (balanceAfter < 0n) {
      throw new Error(`Wallet ${wallet.id} would go negative`);
    }
    await tx.wallet.update({
      where: { id: line.walletId },
      data: { balance: balanceAfter },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: line.walletId,
        txId,
        amount: line.amount,
        balanceAfter,
        description: line.description,
      },
    });
  }
}

/** Sum of all ledger amounts for a wallet (should equal wallet balance). */
export async function walletLedgerSum(walletId: string): Promise<bigint> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { walletId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0n;
}
