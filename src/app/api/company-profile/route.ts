import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const company = await prisma.company.findUnique({ where: { id: user.companyId } });
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const wallet = await prisma.wallet.findFirst({ where: { ownerType: "COMPANY", companyId: company.id } });
    return NextResponse.json({ company, balance: wallet?.balance ?? 0n });
  } catch (err) {
    return handleApiError(err);
  }
}
