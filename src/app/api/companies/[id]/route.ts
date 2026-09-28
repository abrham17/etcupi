import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { clientIp } from "@/lib/auth/rate-limit";

const bodySchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const { id } = await params;
    const { status } = bodySchema.parse(await req.json());
    const ip = clientIp(req);

    const company = await prisma.company.update({ where: { id }, data: { status } });
    await audit({
      actorId: admin.id,
      action: status === "SUSPENDED" ? "COMPANY_SUSPENDED" : "COMPANY_UPDATED",
      entity: "Company",
      entityId: id,
      ip,
      metadata: { name: company.name, status },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
