import { NextResponse } from "next/server";
import { registerCompanySchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.ok) return jsonError("Too many attempts. Try again later.", 429, "RATE_LIMITED");

  try {
    const body = await req.json();
    const data = registerCompanySchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existing) return jsonError("An account with this email already exists", 409, "EMAIL_TAKEN");

    const passwordHash = await hash(data.password, 10);

    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        businessType: data.businessType,
        phone: data.phone,
        email: data.email,
        address: data.address || null,
        city: data.city,
        subCity: data.subCity || null,
        description: data.description || null,
      },
    });

    const admin = await prisma.user.create({
      data: {
        email: data.adminEmail,
        passwordHash,
        fullName: data.adminFullName,
        phone: data.adminPhone,
        role: "COMPANY_ADMIN",
        companyId: company.id,
      },
    });

    // Company wallet (starts at 0; admin funds it from the dashboard in this simulation)
    await prisma.wallet.create({ data: { ownerType: "COMPANY", companyId: company.id, balance: 0n } });

    // Default spending policy
    await prisma.spendingLimit.create({
      data: {
        companyId: company.id,
        name: "Default policy",
        dailyLimit: 3_000_00n,
        monthlyLimit: 20_000_00n,
        txLimit: 1_500_00n,
        isDefault: true,
      },
    });

    // Default approval rules (0–500 auto; 501–5,000 finance; 5,001+ admin)
    await prisma.approvalRule.createMany({
      data: [
        { companyId: company.id, minAmount: 501_00n, maxAmount: 5_000_00n, approverRole: "FINANCE_MANAGER" },
        { companyId: company.id, minAmount: 5_001_00n, maxAmount: null, approverRole: "COMPANY_ADMIN" },
      ],
    });

    await audit({ companyId: company.id, actorId: admin.id, action: "COMPANY_CREATED", entity: "Company", entityId: company.id, ip, metadata: { name: company.name } });

    return NextResponse.json({ ok: true, companyId: company.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      return jsonError(first?.message ?? "Invalid input", 422, "VALIDATION");
    }
    console.error(err);
    return jsonError("Internal server error", 500);
  }
}
