import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { limitsPolicySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { birr } from "@/lib/money";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/auth/rate-limit";

export async function GET() {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const policy = await prisma.spendingLimit.findFirst({ where: { companyId: user.companyId } });
    if (!policy) return NextResponse.json({ error: "No policy" }, { status: 404 });
    return NextResponse.json({
      policy: {
        id: policy.id,
        name: policy.name,
        dailyLimit: policy.dailyLimit,
        monthlyLimit: policy.monthlyLimit,
        txLimit: policy.txLimit,
        blockedCategories: policy.blockedCategories ? policy.blockedCategories.split(",").filter(Boolean) : [],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireRole(["COMPANY_ADMIN"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const data = limitsPolicySchema.parse(await req.json());
    const ip = clientIp(req);

    const existing = await prisma.spendingLimit.findFirst({ where: { companyId: user.companyId } });
    const values = {
      dailyLimit: birr(data.dailyLimit),
      monthlyLimit: birr(data.monthlyLimit),
      txLimit: birr(data.txLimit),
      blockedCategories: data.blockedCategories.join(","),
    };

    if (existing) {
      await prisma.spendingLimit.update({ where: { id: existing.id }, data: values });
    } else {
      await prisma.spendingLimit.create({
        data: { companyId: user.companyId, name: "Default policy", isDefault: true, ...values },
      });
    }

    await audit({
      companyId: user.companyId,
      actorId: user.id,
      action: "LIMITS_CONFIGURED",
      entity: "SpendingLimit",
      entityId: existing?.id ?? null,
      ip,
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
