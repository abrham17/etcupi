import { NextResponse } from "next/server";
import { registerMerchantSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`register-merchant:${ip}`, 5, 60_000);
  if (!rl.ok) return jsonError("Too many attempts. Try again later.", 429, "RATE_LIMITED");

  try {
    const body = await req.json();
    const data = registerMerchantSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return jsonError("An account with this email already exists", 409, "EMAIL_TAKEN");

    const count = await prisma.merchant.count();
    const passwordHash = await hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        role: "MERCHANT",
      },
    });

    const merchant = await prisma.merchant.create({
      data: {
        userId: user.id,
        merchantCode: `ETH-MER-${String(count + 1).padStart(4, "0")}`,
        paymentId: `CUPI-MER-${String(5000 + count + 1)}`,
        businessName: data.businessName,
        category: data.category,
        phone: data.phone,
        email: data.email,
        city: data.city,
        subCity: data.subCity || null,
        address: data.address || null,
      },
    });

    await prisma.wallet.create({ data: { ownerType: "MERCHANT", merchantId: merchant.id, balance: 0n } });
    await prisma.qrCode.create({
      data: {
        merchantId: merchant.id,
        payload: JSON.stringify({ type: "merchant", merchantId: merchant.paymentId, currency: "ETB", name: merchant.businessName }),
      },
    });

    await audit({ actorId: user.id, action: "MERCHANT_CREATED", entity: "Merchant", entityId: merchant.id, ip, metadata: { name: merchant.businessName } });

    return NextResponse.json({ ok: true, merchantId: merchant.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      return jsonError(first?.message ?? "Invalid input", 422, "VALIDATION");
    }
    console.error(err);
    return jsonError("Internal server error", 500);
  }
}
