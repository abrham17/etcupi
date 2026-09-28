import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { reversePayment } from "@/lib/payments/engine";
import { handleApiError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({ reason: z.string().trim().min(3).max(300) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (!["COMPANY_ADMIN", "FINANCE_MANAGER", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    if (user.companyId) {
      const tx = await prisma.transaction.findUnique({ where: { id } });
      if (!tx || tx.companyId !== user.companyId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const ip = clientIp(req);
    const rl = rateLimit(`reverse:${user.id}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const result = await reversePayment(id, user.id, body.reason, ip);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
