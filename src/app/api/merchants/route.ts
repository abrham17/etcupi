import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (q) {
      where.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { paymentId: { contains: q, mode: "insensitive" } },
      ];
    }
    const merchants = await prisma.merchant.findMany({
      where,
      select: { id: true, paymentId: true, businessName: true, category: true, city: true, subCity: true },
      orderBy: { businessName: "asc" },
      take: 50,
    });
    return NextResponse.json({ merchants });
  } catch (err) {
    return handleApiError(err);
  }
}
