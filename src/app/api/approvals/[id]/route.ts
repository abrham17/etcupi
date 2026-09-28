import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { decideApproval } from "@/lib/payments/engine";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const ip = clientIp(req);

    const rl = rateLimit(`approval:${user.id}`, 30, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    // Company scoping + role check against the matched approval rule
    const appr = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { tx: true },
    });
    if (!appr || appr.tx.companyId !== user.companyId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const rules = await prisma.approvalRule.findMany({ where: { companyId: user.companyId! } });
    const rule = rules.find(
      (r) => appr.tx.amount >= r.minAmount && (r.maxAmount === null || appr.tx.amount <= r.maxAmount)
    );
    if (rule && user.role === "FINANCE_MANAGER" && rule.approverRole !== "FINANCE_MANAGER") {
      return NextResponse.json({ error: "This request requires company-admin approval" }, { status: 403 });
    }

    const result = await decideApproval(id, user.id, body.action, body.reason, ip);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
