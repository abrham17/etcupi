import { z } from "zod";

// Ethiopian phone: +2519XXXXXXXX / +2517XXXXXXXX or local 09/07 prefixed.
function ethPhone(v: string): boolean {
  const d = v.replace(/[\s\-()]/g, "");
  const n = d.startsWith("+") ? d : d.startsWith("0") ? `+251${d.slice(1)}` : `+251${d}`;
  return /^\+251[79]\d{8}$/.test(n);
}

export const phoneSchema = z.string().trim().refine(ethPhone, {
  message: "Enter a valid Ethiopian phone number (e.g. 0911 234 567)",
});

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password too long");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  businessType: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema,
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80).default("Addis Ababa"),
  subCity: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  adminFullName: z.string().trim().min(2, "Administrator name is required").max(120),
  adminEmail: emailSchema,
  adminPhone: phoneSchema,
  password: passwordSchema,
});

export const registerMerchantSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema,
  city: z.string().trim().max(80).default("Addis Ababa"),
  subCity: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  department: z.string().trim().max(80).optional().or(z.literal("")),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  monthlyLimit: z.number().min(0).max(1_000_000),
  dailyLimit: z.number().min(0).max(100_000),
  txLimit: z.number().min(0).max(100_000),
});

export const updateEmployeeSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  department: z.string().trim().max(80).optional(),
  title: z.string().trim().max(80).optional(),
  monthlyLimit: z.number().min(0).max(1_000_000).optional(),
  dailyLimit: z.number().min(0).max(100_000).optional(),
  txLimit: z.number().min(0).max(100_000).optional(),
});

export const paySchema = z.object({
  merchantId: z.string().min(1).optional(),
  paymentId: z.string().trim().min(1).optional(),
  amount: z.union([z.string(), z.number()]),
  purpose: z.string().trim().min(2, "Purpose is required").max(200),
  category: z.string().trim().min(1, "Category is required").max(80),
  /** Settles a merchant charge request; the amount is validated against it. */
  requestId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export const topupSchema = z.object({
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Amount must be positive"),
});

export const allocateSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Amount must be positive"),
});

export const approvalRuleSchema = z.object({
  minAmount: z.number().min(0),
  maxAmount: z.number().min(0).nullable().optional(),
  approverRole: z.enum(["COMPANY_ADMIN", "FINANCE_MANAGER"]),
});

export const limitsPolicySchema = z.object({
  dailyLimit: z.number().min(0).max(100_000),
  monthlyLimit: z.number().min(0).max(1_000_000),
  txLimit: z.number().min(0).max(100_000),
  blockedCategories: z.array(z.string().trim().min(1)).max(50).default([]),
});

export const approveActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional(),
});

export const budgetRequestSchema = z.object({
  amount: z.union([z.string(), z.number()]).refine((v) => Number(v) > 0, "Amount must be positive"),
  reason: z.string().trim().min(5).max(300),
});

export const budgetDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  businessType: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  subCity: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
});

export const receiptSchema = z.object({
  txId: z.string().min(1),
  invoiceNumber: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  fileSize: z.number().int().min(1).max(5 * 1024 * 1024),
  dataUrl: z
    .string()
    .max(8 * 1024 * 1024)
    .refine(
      (v) =>
        v.startsWith("data:image/jpeg;base64,") ||
        v.startsWith("data:image/png;base64,") ||
        v.startsWith("data:application/pdf;base64,"),
      "Unsupported file type"
    )
    .optional(),
});
