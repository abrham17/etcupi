import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";

    // Approver-role filter: finance managers see only rules assigned to them
    let where: Record<string, unknown> = { status };
    const requests = await prisma.approvalRequest.findMany({
      where,
      include: {
        tx: true,
        employee: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Scope to company + approver role
    const rules = await prisma.approvalRule.findMany({ where: { companyId: user.companyId } });
    const ruleFor = (amount: bigint) =>
      rules.find((r) => amount >= r.minAmount && (r.maxAmount === null || amount <= r.maxAmount));

    const visible = requests.filter((r) => {
      if (r.tx.companyId !== user.companyId) return false;
      const rule = ruleFor(r.tx.amount);
      if (!rule) return false;
      if (user.role === "FINANCE_MANAGER" && rule.approverRole !== "FINANCE_MANAGER") return false;
      return true;
    });

    return NextResponse.json({
      approvals: visible.map((r) => ({
        id: r.id,
        txId: r.tx.id,
        reference: r.tx.reference,
        amount: r.tx.amount,
        purpose: r.tx.purpose,
        category: r.tx.category,
        employeeName: r.employee.user.fullName,
        merchantName: r.tx.recipientLabel,
        createdAt: r.createdAt,
        status: r.status,
        approverRole: ruleFor(r.tx.amount)?.approverRole ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
