import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "EMPLOYEE") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      include: { department: true, company: { select: { name: true } } },
    });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      paymentId: profile.paymentId,
      employeeCode: profile.employeeCode,
      title: profile.title,
      department: profile.department?.name ?? null,
      company: profile.company.name,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
