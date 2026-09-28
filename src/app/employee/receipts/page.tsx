"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatBirr } from "@/lib/money";
import { StatusBadge, EmptyState } from "@/components/ui";

interface Receipt {
  id: string;
  txId: string;
  fileName: string;
  fileType: string;
  invoiceNumber: string | null;
  notes: string | null;
  status: string;
  uploadedAt: string;
  tx: { reference: string; amount: string; purpose: string | null; recipientLabel: string | null; createdAt: string };
}

const MAX_SIZE = 5 * 1024 * 1024;

export default function ReceiptsPage() {
  const params = useSearchParams();
  const highlightTx = params.get("tx");

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadFor, setUploadFor] = useState<string | null>(highlightTx);
  const [form, setForm] = useState({ invoiceNumber: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/receipts");
    const data = await res.json();
    setReceipts(data.receipts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFor || !file) return;
    if (file.size > MAX_SIZE) {
      setError("File too large (max 5 MB)");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Only JPG, PNG or PDF files are accepted");
      return;
    }
    setBusy(true);
    setError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txId: uploadFor,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl,
        invoiceNumber: form.invoiceNumber,
        notes: form.notes,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setUploadFor(null);
    setFile(null);
    setForm({ invoiceNumber: "", notes: "" });
    load();
  }

  return (
    <main className="pb-safe min-h-screen">
      <div className="sticky top-0 z-10 h-14 flex items-center px-5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="font-bold text-[16px]">Receipts</div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : receipts.length === 0 ? (
          <div className="card"><EmptyState title="No receipts yet" body="Upload receipts against your payments for expense tracking." /></div>
        ) : (
          receipts.map((r) => (
            <div key={r.id} className="card card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold">{r.tx.recipientLabel}</div>
                  <div className="text-[12.5px] text-[var(--ink-2)]">
                    {formatBirr(BigInt(r.tx.amount))} ETB · {r.tx.purpose}
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-3)] tabular mt-0.5">{r.tx.reference}</div>
                  <div className="text-[12px] mt-1.5">
                    <span className="font-medium">{r.fileName}</span>
                    {r.invoiceNumber ? <span className="text-[var(--ink-3)]"> · INV {r.invoiceNumber}</span> : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={r.status === "PENDING" ? "PENDING" : r.status} />
                </div>
              </div>
            </div>
          ))
        )}

        {uploadFor && (
          <form onSubmit={upload} className="card card-pad space-y-3 border-2" style={{ borderColor: "var(--brand)" }}>
            <div className="font-bold text-[14px]">Upload receipt</div>
            <div>
              <label className="label">File (JPG, PNG or PDF · max 5 MB)</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-[13px] w-full"
              />
            </div>
            <div>
              <label className="label">Invoice number (optional)</label>
              <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input h-16 py-2" rows={2} />
            </div>
            {error && (
              <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setUploadFor(null)} className="btn-secondary flex-1">Cancel</button>
              <button disabled={busy} className="btn-primary flex-1">{busy ? "Uploading…" : "Upload"}</button>
            </div>
          </form>
        )}

        {!uploadFor && (
          <p className="text-[12px] text-[var(--ink-3)] px-1">
            Tip: after paying, come back here and attach the merchant's paper receipt or invoice for reconciliation.
          </p>
        )}
      </div>
    </main>
  );
}
