import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api";
import { createEmployeeSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { birr } from "@/lib/money";
import { audit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function GET() {
  try {
    const user = await requireRole(["COMPANY_ADMIN", "FINANCE_MANAGER"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const employees = await prisma.employeeProfile.findMany({
      where: { companyId: user.companyId },
      include: { user: true, wallet: true, department: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      employees: employees.map((e) => ({
        id: e.id,
        userId: e.userId,
        fullName: e.user.fullName,
        email: e.user.email,
        phone: e.user.phone,
        status: e.user.status,
        title: e.title,
        department: e.department?.name ?? null,
        employeeCode: e.employeeCode,
        paymentId: e.paymentId,
        balance: e.wallet?.balance ?? 0n,
        monthlyLimit: e.monthlyLimit,
        dailyLimit: e.dailyLimit,
        txLimit: e.txLimit,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(["COMPANY_ADMIN"]);
    if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 403 });
    const ip = clientIp(req);
    const rl = rateLimit(`create-emp:${user.id}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const data = createEmployeeSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

    const seq = (await prisma.employeeProfile.count()) + 1;
    const passwordHash = await hash(data.fullName.toLowerCase().replace(/\s+/g, "") + "123", 10);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          phone: data.phone,
          role: "EMPLOYEE",
          companyId: user.companyId!,
        },
      });
      let dept = null;
      if (data.department) {
        dept = await tx.department.upsert({
          where: { companyId_name: { companyId: user.companyId!, name: data.department } },
          create: { companyId: user.companyId!, name: data.department },
          update: {},
        });
      }
      const profile = await tx.employeeProfile.create({
        data: {
          userId: newUser.id,
          companyId: user.companyId!,
          employeeCode: `ETH-EMP-${String(1000 + seq)}`,
          paymentId: `CUPI-EMP-${String(1000 + seq)}`,
          departmentId: dept?.id ?? null,
          title: data.title || null,
          monthlyLimit: birr(data.monthlyLimit),
          dailyLimit: birr(data.dailyLimit),
          txLimit: birr(data.txLimit),
        },
      });
      const wallet = await tx.wallet.create({
        data: { ownerType: "EMPLOYEE", employeeId: profile.id, balance: 0n },
      });
      await tx.budget.create({
        data: { companyId: user.companyId!, employeeId: profile.id, monthly: birr(data.monthlyLimit) },
      });
      return { profile, wallet };
    });

    await audit({
      companyId: user.companyId,
      actorId: user.id,
      action: "EMPLOYEE_CREATED",
      entity: "EmployeeProfile",
      entityId: result.profile.id,
      ip,
      metadata: { name: data.fullName, email: data.email },
    });

    return NextResponse.json({ ok: true, employeeId: result.profile.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
