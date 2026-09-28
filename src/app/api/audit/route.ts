import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const take = Math.min(200, Math.max(1, Number(searchParams.get("take") ?? 100)));

    const where: Record<string, unknown> = {};
    if (user.role !== "SUPER_ADMIN") {
      if (!user.companyId) return NextResponse.json({ logs: [] });
      where.companyId = user.companyId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
