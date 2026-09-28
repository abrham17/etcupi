/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  "Office Supplies",
  "Transportation",
  "Food & Beverage",
  "Telecom",
  "Equipment",
  "Travel",
  "Utilities",
  "Marketing",
];

async function main() {
  console.log("Seeding etCupi…");
  await prisma.$transaction(
    async (tx) => {
      // Wipe in FK-safe order (this is the seed script; dev-only)
      await tx.ledgerEntry.deleteMany();
      await tx.payment.deleteMany();
      await tx.receipt.deleteMany();
      await tx.approvalRequest.deleteMany();
      await tx.notification.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.qrCode.deleteMany();
      await tx.transaction.deleteMany();
      await tx.wallet.deleteMany();
      await tx.budget.deleteMany();
      await tx.approvalRule.deleteMany();
      await tx.spendingLimit.deleteMany();
      await tx.category.deleteMany();
      await tx.department.deleteMany();
      await tx.employeeProfile.deleteMany();
      await tx.merchant.deleteMany();
      await tx.user.deleteMany();
      await tx.company.deleteMany();
      await tx.paymentMethod.deleteMany();
    }
  );

  // ── Categories (global catalog for the spending policy picker) ──
  const CATEGORIES_LIST = CATEGORIES;

  // ── Super admin ──
  const superHash = await bcrypt.hash("SuperAdmin123!", 10);
  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@etcupi.et",
      passwordHash: superHash,
      fullName: "Platform Administrator",
      phone: "+251911000001",
      role: "SUPER_ADMIN",
    },
  });

  // ── Companies ──
  const companiesData = [
    {
      name: "Addis Tech Solutions",
      businessType: "Information Technology",
      phone: "+251115550101",
      email: "info@addistech.et",
      address: "Bole Road, Getu Commercial Center 4th Floor",
      city: "Addis Ababa",
      subCity: "Bole",
      description: "Software development and IT consulting firm serving Ethiopian businesses.",
    },
    {
      name: "Blue Nile Trading",
      businessType: "Import & Export",
      phone: "+251115550102",
      email: "contact@bluenile.et",
      address: "Kality, Near Kality Total",
      city: "Addis Ababa",
      subCity: "Akaky Kaliti",
      description: "Importer of office equipment and industrial supplies.",
    },
    {
      name: "Habesha Logistics",
      businessType: "Transport & Logistics",
      phone: "+251115550103",
      email: "ops@habeshalogistics.et",
      address: "Megenagna, Behind Zefmesh Grand Mall",
      city: "Addis Ababa",
      subCity: "Yeka",
      description: "Regional freight and courier services across Ethiopia.",
    },
  ];

  const companyWallets: Record<string, string> = {};
  const companies: Record<string, { id: string }> = {};

  for (const [i, cd] of companiesData.entries()) {
    const company = await prisma.company.create({ data: cd });
    companies[cd.name] = company;

    const adminHash = await bcrypt.hash("Company123!", 10);
    await prisma.user.create({
      data: {
        email: i === 0 ? "admin@example.com" : `admin${i + 1}@${cd.email.split("@")[1]}`,
        passwordHash: adminHash,
        fullName: i === 0 ? "Selam Bekele" : `Admin ${i + 1}`,
        phone: `+2519110000${10 + i}`,
        role: "COMPANY_ADMIN",
        companyId: company.id,
      },
    });

    await prisma.user.create({
      data: {
        email: i === 0 ? "finance@example.com" : `finance${i + 1}@${cd.email.split("@")[1]}`,
        passwordHash: adminHash,
        fullName: i === 0 ? "Yonas Girma" : `Finance ${i + 1}`,
        phone: `+2519110000${20 + i}`,
        role: "FINANCE_MANAGER",
        companyId: company.id,
      },
    });

    // Company wallet with opening balance
    const balances = [500_000_00n, 350_000_00n, 200_000_00n];
    const wallet = await prisma.wallet.create({
      data: { ownerType: "COMPANY", companyId: company.id, balance: balances[i] },
    });
    companyWallets[company.id] = wallet.id;

    // Spending policy (default)
    await prisma.spendingLimit.create({
      data: {
        companyId: company.id,
        name: "Default policy",
        dailyLimit: 3_000_00n,
        monthlyLimit: 20_000_00n,
        txLimit: 1_500_00n,
        blockedCategories: "Entertainment,Personal",
        isDefault: true,
      },
    });

    // Approval rules: 0–500 auto (no rule needed); 501–5,000 → finance; 5,001+ → admin
    await prisma.approvalRule.create({ data: { companyId: company.id, minAmount: 501_00n, maxAmount: 5_000_00n, approverRole: "FINANCE_MANAGER" } });
    await prisma.approvalRule.create({ data: { companyId: company.id, minAmount: 5_001_00n, maxAmount: null, approverRole: "COMPANY_ADMIN" } });
  }

  // ── Departments & categories per company ──
  for (const company of Object.values(companies)) {
    await prisma.department.createMany({
      data: ["Engineering", "Operations", "Sales", "Finance"].map((name) => ({ companyId: company.id, name })),
    });
    await prisma.category.createMany({
      data: CATEGORIES_LIST.map((name) => ({ companyId: company.id, name })),
    });
  }

  // ── Employees (company 0 fully populated) ──
  const c0 = companiesData[0].name;
  const company0 = companies[c0];
  const empHash = await bcrypt.hash("Employee123!", 10);

  const employeesData = [
    { fullName: "Abebe Tesfaye", email: "employee@example.com", phone: "+251911234001", title: "Software Engineer", dept: "Engineering", monthly: 10_000_00n, daily: 2_000_00n, tx: 1_000_00n },
    { fullName: "Marta Alemu", email: "marta@addistech.et", phone: "+251911234002", title: "Operations Coordinator", dept: "Operations", monthly: 7_500_00n, daily: 1_500_00n, tx: 800_00n },
    { fullName: "Dawit Bekele", email: "dawit@addistech.et", phone: "+251911234003", title: "Sales Executive", dept: "Sales", monthly: 8_000_00n, daily: 2_000_00n, tx: 1_200_00n },
    { fullName: "Sara Yohannes", email: "sara@addistech.et", phone: "+251911234004", title: "Accountant", dept: "Finance", monthly: 6_000_00n, daily: 1_200_00n, tx: 700_00n },
  ];

  const empCount = await prisma.employeeProfile.count();
  let empSeq = empCount + 1;

  for (const [i, ed] of employeesData.entries()) {
    const user = await prisma.user.create({
      data: {
        email: ed.email,
        passwordHash: empHash,
        fullName: ed.fullName,
        phone: ed.phone,
        role: "EMPLOYEE",
        companyId: company0.id,
      },
    });
    const dept = await prisma.department.findFirst({ where: { companyId: company0.id, name: ed.dept } });
    const profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        companyId: company0.id,
        employeeCode: `ETH-EMP-${String(empSeq).padStart(4, "0")}`,
        paymentId: `CUPI-EMP-${String(1000 + empSeq)}`,
        departmentId: dept?.id,
        title: ed.title,
        monthlyLimit: ed.monthly,
        dailyLimit: ed.daily,
        txLimit: ed.tx,
      },
    });
    empSeq++;
    await prisma.wallet.create({
      data: { ownerType: "EMPLOYEE", employeeId: profile.id, balance: 0n },
    });
    // Monthly budget record
    await prisma.budget.create({
      data: { companyId: company0.id, employeeId: profile.id, monthly: ed.monthly },
    });
  }

  // ── Fund company 0 wallet & allocate to employees ──
  // (Ledger-driven: topup company wallet, then allocate to each employee)
  const c0WalletId = companyWallets[company0.id];

  // ── Merchants ──
  const merchantsData = [
    { businessName: "Addis Office Supplies", category: "Office Supplies", phone: "+251911300001", email: "merchant@example.com", address: "Piazza, Arat Kilo", subCity: "Arada" },
    { businessName: "Bole Electronics", category: "Electronics", phone: "+251911300002", email: "sales@boleelectronics.et", address: "Bole Medhanialem", subCity: "Bole" },
    { businessName: "Ethio Coffee House", category: "Food & Beverage", phone: "+251911300003", email: "hello@ethiocoffee.et", address: "Kazanchis", subCity: "Kirkos" },
    { businessName: "ABC Transport", category: "Transportation", phone: "+251911300004", email: "booking@abctransport.et", address: "Lamberet", subCity: "Gullele" },
  ];

  const merchantHash = await bcrypt.hash("Merchant123!", 10);
  let merSeq = 1;
  const merchantRecords: { id: string; businessName: string; userId: string }[] = [];

  for (const md of merchantsData) {
    const mu = await prisma.user.create({
      data: {
        email: md.email,
        passwordHash: merchantHash,
        fullName: md.businessName,
        phone: md.phone,
        role: "MERCHANT",
      },
    });
    const m = await prisma.merchant.create({
      data: {
        userId: mu.id,
        merchantCode: `ETH-MER-${String(merSeq).padStart(4, "0")}`,
        paymentId: `CUPI-MER-${String(5000 + merSeq)}`,
        businessName: md.businessName,
        category: md.category,
        phone: md.phone,
        email: md.email,
        address: md.address,
        subCity: md.subCity,
      },
    });
    merSeq++;
    await prisma.wallet.create({ data: { ownerType: "MERCHANT", merchantId: m.id, balance: 0n } });
    await prisma.qrCode.create({
      data: {
        merchantId: m.id,
        payload: JSON.stringify({ type: "merchant", merchantId: m.paymentId, currency: "ETB", name: md.businessName }),
      },
    });
    merchantRecords.push({ id: m.id, businessName: md.businessName, userId: mu.id });
  }

  // ── Fund company 0 & allocate to employees (ledger-driven) ──
  const allocate = async (walletFromId: string, walletToId: string, amount: bigint, label: string) => {
    const reference = `CUPI-SEED-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          reference,
          senderWalletId: walletFromId,
          recipientWalletId: walletToId,
          senderLabel: "Corporate wallet",
          recipientLabel: label,
          amount,
          type: "ALLOCATION",
          status: "COMPLETED",
          purpose: "Budget allocation",
          companyId: company0.id,
          completedAt: new Date(),
        },
      });
      await tx.payment.create({ data: { txId: t.id, rail: "internal", status: "COMPLETED", railRef: `INTL-${reference}`, completedAt: new Date() } });
      const from = await tx.wallet.findUnique({ where: { id: walletFromId } });
      const to = await tx.wallet.findUnique({ where: { id: walletToId } });
      if (!from || !to) throw new Error("wallet missing");
      const fromAfter = from.balance - amount;
      const toAfter = to.balance + amount;
      await tx.wallet.update({ where: { id: from.id }, data: { balance: fromAfter } });
      await tx.wallet.update({ where: { id: to.id }, data: { balance: toAfter } });
      await tx.ledgerEntry.create({ data: { walletId: from.id, txId: t.id, amount: -amount, balanceAfter: fromAfter, description: `Allocation to ${label}` } });
      await tx.ledgerEntry.create({ data: { walletId: to.id, txId: t.id, amount, balanceAfter: toAfter, description: "Budget allocation" } });
    });
  };

  // Allocate starting budgets to each employee of company 0
  const profiles = await prisma.employeeProfile.findMany({
    where: { companyId: company0.id },
    include: { wallet: true, user: true },
  });
  for (const p of profiles) {
    if (p.wallet) {
      await allocate(c0WalletId, p.wallet.id, p.monthlyLimit / 2n, p.user.fullName);
    }
  }

  // ── Demo transactions: employees pay merchants ──
  const merchantByIndex = merchantRecords;
  const payData = [
    { emp: 0, mer: 0, birr: 850n * 100n, purpose: "Printer paper", category: "Office Supplies", daysAgo: 0 },
    { emp: 0, mer: 2, birr: 180n * 100n, purpose: "Team coffee meeting", category: "Food & Beverage", daysAgo: 1 },
    { emp: 1, mer: 0, birr: 450n * 100n, purpose: "Ink cartridges", category: "Office Supplies", daysAgo: 2 },
    { emp: 1, mer: 3, birr: 250n * 100n, purpose: "Delivery to client", category: "Transportation", daysAgo: 3 },
    { emp: 2, mer: 3, birr: 320n * 100n, purpose: "Client visit taxi", category: "Transportation", daysAgo: 1 },
    { emp: 3, mer: 2, birr: 95n * 100n, purpose: "Finance team lunch", category: "Food & Beverage", daysAgo: 0 },
    { emp: 2, mer: 1, birr: 1_250n * 100n, purpose: "HDMI cables", category: "Equipment", daysAgo: 5 },
  ];

  for (const pd of payData) {
    const p = profiles[pd.emp];
    const m = merchantByIndex[pd.mer];
    if (!p?.wallet) continue;
    const mWallet = await prisma.wallet.findUnique({ where: { merchantId: m.id } });
    if (!mWallet) continue;
    const createdAt = new Date(Date.now() - pd.daysAgo * 86_400_000);
    const reference = `CUPI-SEED-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          reference,
          senderWalletId: p.wallet!.id,
          recipientWalletId: mWallet.id,
          senderLabel: p.user.fullName,
          recipientLabel: m.businessName,
          amount: pd.birr,
          type: "PAYMENT",
          status: "COMPLETED",
          purpose: pd.purpose,
          category: pd.category,
          companyId: company0.id,
          merchantId: m.id,
          createdAt,
          completedAt: createdAt,
        },
      });
      await tx.payment.create({ data: { txId: t.id, rail: "internal", status: "COMPLETED", railRef: `INTL-${reference}`, createdAt, completedAt: createdAt } });
      const from = await tx.wallet.findUnique({ where: { id: p.wallet!.id } });
      const to = await tx.wallet.findUnique({ where: { id: mWallet.id } });
      if (!from || !to) throw new Error("wallet missing");
      const fromAfter = from.balance - pd.birr;
      const toAfter = to.balance + pd.birr;
      await tx.wallet.update({ where: { id: from.id }, data: { balance: fromAfter } });
      await tx.wallet.update({ where: { id: to.id }, data: { balance: toAfter } });
      await tx.ledgerEntry.create({ data: { walletId: from.id, txId: t.id, amount: -pd.birr, balanceAfter: fromAfter, description: `Payment to ${m.businessName}`, createdAt } });
      await tx.ledgerEntry.create({ data: { walletId: to.id, txId: t.id, amount: pd.birr, balanceAfter: toAfter, description: `Payment from ${p.user.fullName}`, createdAt } });
    });
  }

  console.log("Seed complete.");
  console.log("Demo accounts:");
  console.log("  Super admin :  admin@etcupi.et / SuperAdmin123!");
  console.log("  Company admin: admin@example.com / Company123! (Addis Tech Solutions)");
  console.log("  Finance      : finance@example.com / Company123!");
  console.log("  Employee     : employee@example.com / Employee123! (Abebe Tesfaye)");
  console.log("  Merchant     : merchant@example.com / Merchant123! (Addis Office Supplies)");
  console.log(`  Super admin id: ${superAdmin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
