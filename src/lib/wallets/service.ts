import { prisma } from "@/lib/prisma";
import { postLedgerEntries } from "@/lib/ledger/ledger";
import { generateReference } from "@/lib/ids";
import { formatBirr } from "@/lib/money";
import { notify } from "@/lib/payments/engine";
import { audit } from "@/lib/audit";

/** Top up a company wallet from the platform (simulated external funding). */
export async function topupCompanyWallet(
  companyId: string,
  amount: bigint,
  actorId: string,
  ip?: string
): Promise<{ reference: string; newBalance: bigint }> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  let platformWallet = await prisma.wallet.findFirst({ where: { ownerType: "PLATFORM" } });
  if (!platformWallet) {
    platformWallet = await prisma.wallet.create({ data: { ownerType: "PLATFORM", balance: 10_000_000_00n } });
  }

  const companyWallet = await prisma.wallet.findFirst({
    where: { ownerType: "COMPANY", companyId },
  });
  if (!companyWallet) throw new Error("Company wallet not found");

  const reference = generateReference();
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        reference,
        senderWalletId: platformWallet.id,
        recipientWalletId: companyWallet.id,
        senderLabel: "Platform funding",
        recipientLabel: company.name,
        amount,
        type: "TOPUP",
        status: "PROCESSING",
        purpose: "Corporate wallet funding",
        companyId,
      },
    });
    await tx.payment.create({ data: { txId: t.id, rail: "internal", status: "PROCESSING" } });
    await postLedgerEntries(tx, t.id, [
      { walletId: platformWallet.id, amount: -amount, description: `Funding for ${company.name}` },
      { walletId: companyWallet.id, amount, description: `Wallet topup` },
    ]);
    await tx.payment.update({ where: { txId: t.id }, data: { status: "COMPLETED", railRef: `INTL-${reference}`, completedAt: new Date() } });
    await tx.transaction.update({ where: { id: t.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    // Notify all company admins
    const admins = await tx.user.findMany({ where: { companyId, role: { in: ["COMPANY_ADMIN", "FINANCE_MANAGER"] } } });
    for (const a of admins) {
      await notify(tx, {
        userId: a.id,
        type: "BUDGET_UPDATED",
        title: "Corporate wallet funded",
        body: `${formatBirr(amount)} ETB added. New balance: ${formatBirr(companyWallet.balance + amount)} ETB.`,
        txId: t.id,
      });
    }
  });

  await audit({ companyId, actorId, action: "COMPANY_WALLET_TOPUP", entity: "Wallet", entityId: companyWallet.id, ip, metadata: { reference, amount: amount.toString() } });
  return { reference, newBalance: companyWallet.balance + amount };
}

/** Allocate funds from the corporate wallet to an employee wallet. */
export async function allocateToEmployee(
  companyId: string,
  employeeProfileId: string,
  amount: bigint,
  actorId: string,
  ip?: string
): Promise<{ reference: string }> {
  const companyWallet = await prisma.wallet.findFirst({ where: { ownerType: "COMPANY", companyId } });
  if (!companyWallet) throw new Error("Company wallet not found");

  const employee = await prisma.employeeProfile.findUnique({
    where: { id: employeeProfileId },
    include: { user: true, wallet: true },
  });
  if (!employee || employee.companyId !== companyId) throw new Error("Employee not found");
  if (!employee.wallet) throw new Error("Employee has no wallet");
  if (companyWallet.balance < amount) throw new Error("Insufficient corporate balance");

  const reference = generateReference();
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        reference,
        senderWalletId: companyWallet.id,
        recipientWalletId: employee.wallet!.id,
        senderLabel: "Corporate wallet",
        recipientLabel: employee.user.fullName,
        amount,
        type: "ALLOCATION",
        status: "PROCESSING",
        purpose: "Budget allocation",
        companyId,
      },
    });
    await tx.payment.create({ data: { txId: t.id, rail: "internal", status: "PROCESSING" } });
    await postLedgerEntries(tx, t.id, [
      { walletId: companyWallet.id, amount: -amount, description: `Allocation to ${employee.user.fullName}` },
      { walletId: employee.wallet!.id, amount, description: "Budget allocation" },
    ]);
    await tx.payment.update({ where: { txId: t.id }, data: { status: "COMPLETED", railRef: `INTL-${reference}`, completedAt: new Date() } });
    await tx.transaction.update({ where: { id: t.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await notify(tx, {
      userId: employee.userId,
      type: "BUDGET_ALLOCATED",
      title: "Budget allocated",
      body: `You received ${formatBirr(amount)} ETB in your business wallet.`,
      txId: t.id,
    });
  });

  await audit({ companyId, actorId, action: "BUDGET_ALLOCATED", entity: "EmployeeProfile", entityId: employeeProfileId, ip, metadata: { reference, amount: amount.toString(), employee: employee.user.fullName } });
  return { reference };
}
