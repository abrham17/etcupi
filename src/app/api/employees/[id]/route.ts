import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { updateEmployeeSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { birr } from "@/lib/money";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/payments/engine";
import { clientIp } from "@/lib/auth/rate-limit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["COMPANY_ADMIN"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const { id } = await params;
    const data = updateEmployeeSchema.parse(await req.json());
    const ip = clientIp(req);

    const profile = await prisma.employeeProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!profile || profile.companyId !== user.companyId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (data.monthlyLimit !== undefined) updates.monthlyLimit = birr(data.monthlyLimit);
    if (data.dailyLimit !== undefined) updates.dailyLimit = birr(data.dailyLimit);
    if (data.txLimit !== undefined) updates.txLimit = birr(data.txLimit);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeProfile.update({ where: { id }, data: updates });
      if (data.department !== undefined) {
        if (data.department) {
          const dept = await tx.department.upsert({
            where: { companyId_name: { companyId: user.companyId!, name: data.department } },
            create: { companyId: user.companyId!, name: data.department },
            update: {},
          });
          await tx.employeeProfile.update({ where: { id }, data: { departmentId: dept.id } });
        } else {
          await tx.employeeProfile.update({ where: { id }, data: { departmentId: null } });
        }
      }
      if (data.title !== undefined) {
        await tx.employeeProfile.update({ where: { id }, data: { title: data.title || null } });
      }
      if (data.status) {
        await tx.user.update({ where: { id: profile.userId }, data: { status: data.status } });
      }
      if (data.monthlyLimit !== undefined) {
        await tx.budget.upsert({
          where: { employeeId: id },
          create: { companyId: user.companyId!, employeeId: id, monthly: birr(data.monthlyLimit) },
          update: { monthly: birr(data.monthlyLimit) },
        });
      }
      if (data.status === "SUSPENDED") {
        await notify(tx, {
          userId: profile.userId,
          type: "EMPLOYEE_STATUS_CHANGED",
          title: "Account suspended",
          body: "Your corporate payment account has been suspended by your administrator.",
        });
      } else if (data.status === "ACTIVE") {
        await notify(tx, {
          userId: profile.userId,
          type: "EMPLOYEE_STATUS_CHANGED",
          title: "Account activated",
          body: "Your corporate payment account has been re-activated.",
        });
      }
      if (data.monthlyLimit !== undefined || data.dailyLimit !== undefined || data.txLimit !== undefined) {
        await notify(tx, {
          userId: profile.userId,
          type: "EMPLOYEE_LIMITS_UPDATED",
          title: "Spending limits updated",
          body: "Your administrator updated your spending limits.",
        });
      }
      return updated;
    });

    await audit({
      companyId: user.companyId,
      actorId: user.id,
      action: data.status ? (data.status === "SUSPENDED" ? "EMPLOYEE_SUSPENDED" : "EMPLOYEE_ACTIVATED") : "EMPLOYEE_LIMITS_UPDATED",
      entity: "EmployeeProfile",
      entityId: id,
      ip,
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
