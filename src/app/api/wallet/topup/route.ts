import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { parseAmountToMinor } from "@/lib/money";
import { topupCompanyWallet } from "@/lib/wallets/service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { z } from "zod";

const bodySchema = z.object({ amount: z.union([z.string(), z.number()]) });

export async function POST(req: Request) {
  try {
    const user = await requireRole(["COMPANY_ADMIN"]);
    const body = bodySchema.parse(await req.json());
    const amount = parseAmountToMinor(body.amount);
    if (!amount || amount <= 0n) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    if (amount > 1_000_000_00n) return NextResponse.json({ error: "Maximum single topup is 1,000,000 ETB (simulation cap)" }, { status: 400 });

    const ip = clientIp(req);
    const rl = rateLimit(`topup:${user.id}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const result = await topupCompanyWallet(user.companyId, amount, user.id, ip);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
