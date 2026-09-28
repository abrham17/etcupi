import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { receiptSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "EMPLOYEE") return NextResponse.json({ error: "Only employees can upload receipts" }, { status: 403 });
    const ip = clientIp(req);
    const rl = rateLimit(`receipt:${user.id}`, 20, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const data = receiptSchema.parse(await req.json());

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const tx = await prisma.transaction.findUnique({ where: { id: data.txId } });
    if (!tx || tx.senderWalletId === null) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    // Ensure this transaction belongs to the employee
    const wallet = await prisma.wallet.findUnique({ where: { employeeId: profile.id } });
    if (!wallet || tx.senderWalletId !== wallet.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const receipt = await prisma.receipt.create({
      data: {
        txId: data.txId,
        employeeId: profile.id,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        dataUrl: data.dataUrl ?? null,
        invoiceNumber: data.invoiceNumber || null,
        notes: data.notes || null,
      },
    });

    await audit({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECEIPT_UPLOADED",
      entity: "Receipt",
      entityId: receipt.id,
      ip,
      metadata: { txId: data.txId, fileName: data.fileName },
    });

    return NextResponse.json({ ok: true, receiptId: receipt.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const txId = searchParams.get("txId");

    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return NextResponse.json({ receipts: [] });
      const receipts = await prisma.receipt.findMany({
        where: { employeeId: profile.id, ...(txId ? { txId } : {}) },
        include: { tx: { select: { reference: true, amount: true, purpose: true, recipientLabel: true, createdAt: true } } },
        orderBy: { uploadedAt: "desc" },
      });
      return NextResponse.json({ receipts });
    }

    if (user.companyId && ["COMPANY_ADMIN", "FINANCE_MANAGER"].includes(user.role)) {
      const receipts = await prisma.receipt.findMany({
        where: {
          ...(txId ? { txId } : {}),
          employee: { companyId: user.companyId },
        },
        include: {
          tx: { select: { reference: true, amount: true, purpose: true, recipientLabel: true, createdAt: true } },
          employee: { include: { user: { select: { fullName: true } } } },
        },
        orderBy: { uploadedAt: "desc" },
        take: 200,
      });
      return NextResponse.json({ receipts });
    }

    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  } catch (err) {
    return handleApiError(err);
  }
}
