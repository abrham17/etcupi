import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      include: { qrCodes: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    const qr = merchant.qrCodes[0] ?? null;
    return NextResponse.json({
      qr: qr ? { id: qr.id, payload: qr.payload, createdAt: qr.createdAt } : null,
      merchant: {
        businessName: merchant.businessName,
        paymentId: merchant.paymentId,
        merchantCode: merchant.merchantCode,
        category: merchant.category,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Rotate: deactivate old QR and mint a fresh token (useful if a code is copied/fraudulent). */
export async function POST() {
  try {
    const user = await requireRole(["MERCHANT"]);
    const merchant = await prisma.merchant.findUnique({ where: { userId: user.id } });
    if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });

    await prisma.qrCode.updateMany({ where: { merchantId: merchant.id, status: "ACTIVE" }, data: { status: "INACTIVE" } });
    const qr = await prisma.qrCode.create({
      data: {
        merchantId: merchant.id,
        payload: JSON.stringify({ type: "merchant", merchantId: merchant.paymentId, currency: "ETB", name: merchant.businessName }),
      },
    });
    await audit({ actorId: user.id, action: "QR_GENERATED", entity: "QrCode", entityId: qr.id });
    return NextResponse.json({ ok: true, qr: { id: qr.id, payload: qr.payload } });
  } catch (err) {
    return handleApiError(err);
  }
}
