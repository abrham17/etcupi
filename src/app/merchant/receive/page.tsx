"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { formatBirr } from "@/lib/money";

interface ApiRequest {
  id: string;
  token: string;
  code: string;
  amount: string;
  currency: string;
  purpose: string;
  status: "OPEN" | "AWAITING_APPROVAL" | "PAID" | "CANCELLED" | "EXPIRED";
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  txId: string | null;
  txReference: string | null;
  txStatus: string | null;
  senderLabel: string | null;
  payload: string;
}

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Waiting",
  AWAITING_APPROVAL: "Awaiting approval",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "badge-warn",
  AWAITING_APPROVAL: "badge-warn",
  PAID: "badge-ok",
  CANCELLED: "badge-neutral",
  EXPIRED: "badge-neutral",
};

function money(minor: string): string {
  return formatBirr(BigInt(minor));
}

function timeLeft(expiresAt: string | null, nowMs: number): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function MerchantReceivePage() {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ApiRequest | null>(null);
  const [recent, setRecent] = useState<ApiRequest[]>([]);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadRecent = useCallback(async () => {
    const res = await fetch("/api/payment-requests");
    if (!res.ok) return;
    const data = await res.json();
    setRecent(data.requests ?? []);
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Tick the expiry countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the active charge until it is settled
  useEffect(() => {
    if (!active || active.status === "PAID" || active.status === "EXPIRED" || active.status === "CANCELLED") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/payment-requests/${active.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const request: ApiRequest = data.request;
      if (request.status !== active.status) {
        setActive((prev) => (prev && prev.id === request.id ? { ...prev, ...request } : prev));
        if (request.status === "PAID") loadRecent();
      }
      if (request.status === "EXPIRED") {
        setActive((prev) => (prev && prev.id === request.id ? { ...prev, status: "EXPIRED" } : prev));
      }
    }, 3000);
    return () => clearInterval(id);
  }, [active, loadRecent]);

  // Render the QR whenever the active charge changes
  useEffect(() => {
    if (active && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, active.payload, {
        width: 240,
        margin: 2,
        color: { dark: "#122019", light: "#ffffff" },
      });
    }
  }, [active]);

  const shareUrl = active ? `${typeof window !== "undefined" ? window.location.origin : ""}/employee/pay?request=${active.token}` : "";

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!n || n <= 0) {
      setError("Enter an amount to charge");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/payment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, purpose: purpose.trim() || "Payment" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create the charge");
      return;
    }
    setActive(data.request);
    setAmount("");
    setPurpose("");
    loadRecent();
  }

  async function cancelActive() {
    if (!active) return;
    const res = await fetch(`/api/payment-requests/${active.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setActive((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
      loadRecent();
    } else {
      setError(data.error ?? "Could not cancel");
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Copy failed — long-press the code to copy it manually");
    }
  }

  async function share() {
    if (!active) return;
    const text = `Pay ${money(active.amount)} ETB — ${active.purpose}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "etCupi payment request", text, url: shareUrl });
        return;
      } catch {
        return;
      }
    }
    copy(shareUrl, "link");
  }

  const remaining = active ? timeLeft(active.expiresAt, now) : null;
  const isOpen = active?.status === "OPEN";

  return (
    <main className="pb-safe min-h-screen">
      <div className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="font-bold text-[16px]">Receive payment</div>
        <Link href="/merchant/qr" className="text-[13px] font-semibold" style={{ color: "var(--brand)" }}>
          Open QR
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Active charge ─────────────────────────────── */}
        {active ? (
          <div className="card card-pad text-center">
            {active.status === "PAID" ? (
              <div className="py-2 space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--ok-soft)" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div className="text-[19px] font-bold">Payment received</div>
                <div className="text-[32px] font-black tabular leading-none">+{money(active.amount)} <span className="text-[16px] text-[var(--ink-3)]">ETB</span></div>
                <div className="text-[13px] text-[var(--ink-2)]">{active.senderLabel ?? "Customer"} · {active.purpose}</div>
                <div className="text-[12.5px] text-[var(--ink-3)]">Ref {active.txReference ?? active.code}</div>
                <button onClick={() => setActive(null)} className="btn-primary btn-lg w-full mt-2">
                  New charge
                </button>
              </div>
            ) : (
              <>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">Charge</div>
                <div className="text-[34px] font-black tabular leading-none mt-0.5">{money(active.amount)} <span className="text-[16px] text-[var(--ink-3)] font-bold">ETB</span></div>
                <div className="text-[13px] text-[var(--ink-2)] mt-1">{active.purpose}</div>

                <div className="mt-4 mx-auto w-fit p-3.5 rounded-xl border-2 bg-white" style={{ borderColor: "var(--brand)" }}>
                  <canvas ref={canvasRef} />
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="font-mono text-[13px] font-semibold">{active.code}</span>
                  <button onClick={() => copy(active.code, "code")} className="text-[12px] font-semibold" style={{ color: "var(--brand)" }}>
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="mt-3 rounded-lg px-3 py-2.5 text-[12.5px] font-medium flex items-center justify-center gap-2" style={{ background: active.status === "AWAITING_APPROVAL" ? "var(--warn-soft)" : "var(--brand-soft)", color: active.status === "AWAITING_APPROVAL" ? "var(--warn)" : "var(--brand)" }}>
                  {active.status === "OPEN" && (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--brand)" }} />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "var(--brand)" }} />
                      </span>
                      Waiting for the customer to pay
                      {remaining && remaining !== "expired" ? ` · expires in ${remaining}` : ""}
                    </>
                  )}
                  {active.status === "AWAITING_APPROVAL" && "Customer paid — awaiting their finance approval"}
                  {active.status === "EXPIRED" && "Expired — no payment was received"}
                  {active.status === "CANCELLED" && "Charge cancelled"}
                  {active.status === "OPEN" && remaining === "expired" && "Expired — no payment was received"}
                </div>

                <p className="mt-3 text-[12.5px] text-[var(--ink-3)]">
                  Ask the customer to scan this code in the etCupi app, or share the link below. The amount is locked, so you receive exactly {money(active.amount)} ETB.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => copy(shareUrl, "link")} className="btn-secondary">
                    {copied === "link" ? "Link copied" : "Copy link"}
                  </button>
                  <button onClick={share} className="btn-secondary">
                    Share
                  </button>
                </div>
                {isOpen && (
                  <button onClick={cancelActive} className="mt-2 w-full text-[13px] font-semibold py-2" style={{ color: "var(--danger)" }}>
                    Cancel charge
                  </button>
                )}
                {!isOpen && (
                  <button onClick={() => setActive(null)} className="btn-primary w-full mt-3">
                    New charge
                  </button>
                )}
              </>
            )}
            {error && (
              <div className="mt-3 text-[13px] font-medium px-3 py-2 rounded-md text-left" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          /* ── New charge form ──────────────────────────── */
          <form onSubmit={createRequest} className="card card-pad space-y-3.5">
            <div>
              <div className="text-[15px] font-bold">Charge an exact amount</div>
              <p className="text-[12.5px] text-[var(--ink-2)] mt-0.5">
                Generate a QR for one sale. The customer pays the locked amount — no keying errors.
              </p>
            </div>

            <div>
              <label className="label">Amount (ETB)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input h-14 text-[22px] font-bold tabular"
                placeholder="0.00"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(Number(amount || 0) + q))}
                    className="px-3 h-8 rounded-full text-[12.5px] font-semibold border"
                    style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)", color: "var(--ink-2)" }}
                  >
                    +{q}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="px-3 h-8 rounded-full text-[12.5px] font-semibold border"
                  style={{ borderColor: "var(--border-strong)", color: "var(--ink-3)" }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label className="label">What is it for?</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="input"
                placeholder="e.g. Printing 200 flyers"
                maxLength={200}
              />
            </div>

            {error && (
              <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? "Creating…" : "Generate payment QR"}
            </button>
            <p className="text-[12px] text-[var(--ink-3)] text-center">Charges are valid for 15 minutes and can be cancelled any time before payment.</p>
          </form>
        )}

        {/* ── Recent charges ───────────────────────────── */}
        <div>
          <h2 className="text-[15px] font-bold mb-2 px-1">Recent charges</h2>
          <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
            {recent.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[var(--ink-3)]">
                No charges yet. Create one above, or show your open QR code for walk-in customers.
              </div>
            ) : (
              recent.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActive(r)}
                  className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate">{r.purpose}</div>
                    <div className="text-[12px] text-[var(--ink-3)] truncate font-mono">{r.code}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[14px] font-bold tabular">{money(r.amount)} ETB</div>
                    <span className={STATUS_CLASS[r.status] ?? "badge-neutral"}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
