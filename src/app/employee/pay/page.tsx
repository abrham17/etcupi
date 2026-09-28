"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatBirr } from "@/lib/money";

interface MerchantInfo {
  id: string;
  paymentId: string;
  businessName: string;
  category: string;
  city: string;
}

interface PayResult {
  status: string;
  txId?: string;
  reference?: string;
  approvalId?: string;
  error?: string;
  code?: string;
}

interface ChargeRequest {
  id: string;
  code: string;
  token: string;
  amount: string;
  purpose: string;
  status: string;
  expiresAt: string | null;
  payable: boolean;
  reason: string | null;
}

const CATEGORIES = ["Office Supplies", "Transportation", "Food & Beverage", "Telecom", "Equipment", "Travel", "Utilities", "Marketing"];

export default function PayPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<"merchant" | "details" | "confirm" | "success" | "pending">("merchant");
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [manualId, setManualId] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [chargeRequest, setChargeRequest] = useState<ChargeRequest | null>(null);
  const [idempotencyKey] = useState(() => `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // Auto-resolve merchant when arriving from ?merchant=PAYMENTID (QR scan)
  const resolveMerchant = useCallback(async (paymentId: string) => {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/qr/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: paymentId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Merchant not found");
      return false;
    }
    setMerchant(data.merchant);
    setStep("details");
    return true;
  }, []);

  // Auto-resolve a merchant charge request when arriving from ?request=TOKEN
  const resolveRequest = useCallback(async (token: string) => {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/qr/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: token }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Payment request not found");
      return;
    }
    const req: ChargeRequest = data.request;
    setMerchant(data.merchant);
    setChargeRequest(req);
    if (!req.payable) {
      setError(req.reason ?? "This payment request can no longer be paid");
      setStep("merchant");
      return;
    }
    setAmount((Number(req.amount) / 100).toFixed(2));
    setPurpose(req.purpose);
    setStep("details");
  }, []);

  useEffect(() => {
    const m = params.get("merchant");
    const r = params.get("request");
    if (r && !chargeRequest) {
      resolveRequest(r);
    } else if (m && !merchant) {
      resolveMerchant(m);
    }
  }, [params, merchant, chargeRequest, resolveMerchant, resolveRequest]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    await resolveMerchant(manualId.trim());
  }

  function continueToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!n || n <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (purpose.trim().length < 2) {
      setError("Add a short purpose for this payment");
      return;
    }
    setStep("confirm");
  }

  async function confirmPayment() {
    if (!merchant) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: merchant.id,
        amount,
        purpose: purpose.trim(),
        category,
        requestId: chargeRequest?.id,
        idempotencyKey,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      // 202-style approval-required responses come back as errors with code APPROVAL_REQUIRED
      if (data.code === "APPROVAL_REQUIRED" || data.approvalId) {
        setResult({ status: "PENDING_APPROVAL", approvalId: data.approvalId, reference: data.reference });
        setStep("pending");
        return;
      }
      setError(data.error ?? "Payment failed");
      setStep("details");
      return;
    }
    if (data.status === "PENDING_APPROVAL") {
      setResult(data);
      setStep("pending");
      return;
    }
    setResult(data);
    setStep("success");
  }

  return (
    <main className="pb-safe min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 h-14 flex items-center gap-3 px-4 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <button onClick={() => (chargeRequest ? router.back() : step === "details" ? setStep("merchant") : step === "confirm" ? setStep("details") : router.back())} className="p-1.5 -ml-1.5 rounded-md hover:bg-[var(--surface-2)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="font-bold text-[16px]">
          {step === "merchant" ? "Scan & Pay" : step === "details" ? "Enter details" : step === "confirm" ? "Confirm payment" : "Payment"}
        </div>
      </div>

      <div className="p-4">
        {step === "merchant" && (
          <div className="space-y-4">
            <Link
              href="/employee/scan"
              className="card card-pad flex items-center gap-4 hover:bg-[var(--surface-2)] transition-colors"
            >
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--brand)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                  <path d="M7 12h10" />
                </svg>
              </span>
              <span>
                <span className="block font-bold text-[15px]">Scan merchant QR</span>
                <span className="block text-[12.5px] text-[var(--ink-2)]">Use your camera at the checkout</span>
              </span>
            </Link>

            <div className="text-center text-[12px] font-semibold text-[var(--ink-3)] uppercase tracking-wide">or</div>

            <form onSubmit={submitManual} className="card card-pad space-y-3">
              <div className="font-bold text-[14px]">Pay by payment ID</div>
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="input font-mono text-[14px]"
                placeholder="CUPI-MER-000542"
                required
              />
              <button disabled={busy} className="btn-primary w-full">
                {busy ? "Looking up…" : "Find merchant"}
              </button>
              {error && (
                <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}

        {step === "details" && merchant && (
          <form onSubmit={continueToConfirm} className="space-y-4">
            {chargeRequest && (
              <div className="rounded-lg px-3.5 py-3 text-[12.5px]" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
                <span className="font-bold">{chargeRequest.code}</span>
                <span className="text-[var(--ink-2)]"> · amount and purpose were set by the merchant.</span>
              </div>
            )}
            <div className="card card-pad flex items-center gap-3">
              <span className="w-11 h-11 rounded-lg flex items-center justify-center font-black text-white text-[16px]" style={{ background: "var(--brand)" }}>
                {merchant.businessName.slice(0, 1)}
              </span>
              <div>
                <div className="font-bold text-[15px]">{merchant.businessName}</div>
                <div className="text-[12px] text-[var(--ink-3)]">{merchant.category} · {merchant.paymentId}</div>
              </div>
            </div>

            <div className="card card-pad space-y-3.5">
              <div>
                <label className="label">Amount (ETB)</label>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  readOnly={chargeRequest?.payable === true}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input text-[22px] font-bold tabular h-14"
                  style={chargeRequest?.payable ? { background: "var(--surface-2)", color: "var(--ink-2)" } : undefined}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Purpose</label>
                <input
                  required
                  readOnly={chargeRequest?.payable === true}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="input"
                  style={chargeRequest?.payable ? { background: "var(--surface-2)", color: "var(--ink-2)" } : undefined}
                  placeholder="e.g. Printer paper"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
              <button className="btn-primary w-full btn-lg">Continue</button>
            </div>
          </form>
        )}

        {step === "confirm" && merchant && (
          <div className="space-y-4">
            <div className="card card-pad text-center">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">You are paying</div>
              <div className="text-[36px] font-black tabular mt-1">{Number(amount).toLocaleString()} <span className="text-[18px] text-[var(--ink-3)]">ETB</span></div>
            </div>
            <div className="card card-pad space-y-2.5 text-[14px]">
              <div className="flex justify-between border-b pb-2">
                <span className="text-[var(--ink-2)]">To</span>
                <span className="font-semibold">{merchant.businessName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-[var(--ink-2)]">Purpose</span>
                <span className="font-semibold">{purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Category</span>
                <span className="font-semibold">{category}</span>
              </div>
            </div>
            {error && (
              <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <button onClick={confirmPayment} disabled={busy} className="btn-primary w-full btn-lg">
              {busy ? "Processing…" : "Confirm Payment"}
            </button>
            <p className="text-center text-[12px] text-[var(--ink-3)]">
              Limits, balance and category rules are checked before the money moves.
            </p>
          </div>
        )}

        {step === "success" && result && (
          <div className="pt-10 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--ok-soft)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <div className="text-[20px] font-bold">Payment Successful</div>
              <div className="text-[28px] font-black tabular mt-1">{Number(amount).toLocaleString()} ETB</div>
            </div>
            <div className="card card-pad text-left text-[13.5px] space-y-2 max-w-xs mx-auto">
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Reference</span>
                <span className="font-semibold tabular">{result.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">To</span>
                <span className="font-semibold">{merchant?.businessName}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Link href={`/employee/receipts?tx=${result.txId}`} className="btn-secondary btn-lg">
                View Receipt
              </Link>
              <Link href="/employee" className="btn-primary btn-lg">
                Done
              </Link>
            </div>
          </div>
        )}

        {step === "pending" && result && (
          <div className="pt-10 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--warn-soft)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <div className="text-[20px] font-bold">Awaiting approval</div>
              <div className="text-[14px] text-[var(--ink-2)] mt-1 max-w-xs mx-auto">
                This payment exceeds the auto-approve limit. Your finance team will review it shortly.
              </div>
            </div>
            <div className="card card-pad text-left text-[13.5px] space-y-2 max-w-xs mx-auto">
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Reference</span>
                <span className="font-semibold tabular">{result.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">To</span>
                <span className="font-semibold">{merchant?.businessName}</span>
              </div>
            </div>
            <Link href="/employee" className="btn-primary btn-lg max-w-xs w-full mx-auto block">
              Done
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
