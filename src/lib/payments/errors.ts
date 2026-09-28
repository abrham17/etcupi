export class PaymentError extends Error {
  code: string;
  status: number;
  approvalId?: string;
  constructor(code: string, message: string, status = 400, approvalId?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.approvalId = approvalId;
  }
}

export const Errors = {
  insufficientFunds: (msg = "Insufficient balance") => new PaymentError("INSUFFICIENT_FUNDS", msg, 400),
  txLimit: (limit: string) => new PaymentError("TX_LIMIT_EXCEEDED", `Exceeds single-transaction limit of ${limit}`, 400),
  dailyLimit: (limit: string) => new PaymentError("DAILY_LIMIT_EXCEEDED", `Exceeds daily limit of ${limit}`, 400),
  monthlyLimit: (limit: string) => new PaymentError("MONTHLY_LIMIT_EXCEEDED", `Exceeds monthly limit of ${limit}`, 400),
  categoryBlocked: (cat: string) => new PaymentError("CATEGORY_BLOCKED", `Category "${cat}" is not allowed for this employee`, 400),
  categoryRequired: () => new PaymentError("CATEGORY_REQUIRED", "Category is required", 400),
  approvalRequired: (approvalId: string) =>
    new PaymentError("APPROVAL_REQUIRED", "Payment requires approval", 202, approvalId),
  invalidMerchant: () => new PaymentError("INVALID_MERCHANT", "Merchant not found or inactive", 404),
  walletNotFound: () => new PaymentError("WALLET_NOT_FOUND", "Wallet not found", 404),
  companyInactive: () => new PaymentError("COMPANY_INACTIVE", "Company is suspended", 403),
  employeeInactive: () => new PaymentError("EMPLOYEE_INACTIVE", "Employee account is suspended", 403),
  invalidAmount: () => new PaymentError("INVALID_AMOUNT", "Invalid amount", 400),
  sameWallet: () => new PaymentError("SAME_WALLET", "Cannot pay yourself", 400),
} as const;
