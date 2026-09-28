import { NextResponse } from "next/server";
import { requireRole, requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { companySettingsSchema } from "@/lib/validation";
import { clientIp } from "@/lib/auth/rate-limit";

export async function GET(req: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const companies = await prisma.company.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
      include: {
        wallets: { where: { ownerType: "COMPANY" } },
        _count: { select: { members: true, employees: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        businessType: c.businessType,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        balance: c.wallets[0]?.balance ?? 0n,
        employees: c._count.employees,
        members: c._count.members,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!["COMPANY_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const data = companySettingsSchema.parse(await req.json());
    const ip = clientIp(req);

    const company = await prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.businessType !== undefined ? { businessType: data.businessType } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.subCity !== undefined ? { subCity: data.subCity || null } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
      },
    });

    await audit({ companyId: user.companyId, actorId: user.id, action: "COMPANY_UPDATED", entity: "Company", entityId: company.id, ip });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
