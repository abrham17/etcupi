"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface QrData {
  qr: { id: string; payload: string } | null;
  merchant: { businessName: string; paymentId: string; merchantCode: string; category: string };
}

export default function MerchantQrPage() {
  const [data, setData] = useState<QrData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/qr/mine");
    const d = await res.json();
    setData(d);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (data?.qr && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.qr.payload, {
        width: 260,
        margin: 2,
        color: { dark: "#122019", light: "#ffffff" },
      });
    }
  }, [data]);

  async function rotate() {
    if (!window.confirm("Generate a new QR code? The old one stops working immediately.")) return;
    setBusy(true);
    await fetch("/api/qr/mine", { method: "POST" });
    setBusy(false);
    load();
  }

  function download() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `etcupi-qr-${data?.merchant.paymentId ?? "code"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  if (!data) return <main className="pb-safe min-h-screen flex items-center justify-center text-[13px] text-[var(--ink-3)]">Loading…</main>;

  return (
    <main className="pb-safe min-h-screen">
      <div className="sticky top-0 z-10 h-14 flex items-center px-5 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="font-bold text-[16px]">My QR code</div>
      </div>

      <div className="p-4">
        <div className="card card-pad text-center">
          <div className="text-[17px] font-bold">{data.merchant.businessName}</div>
          <div className="text-[12.5px] text-[var(--ink-3)] mt-0.5">
            {data.merchant.category} · <span className="font-mono">{data.merchant.paymentId}</span>
          </div>

          <div className="mt-5 mx-auto w-fit p-4 rounded-xl border-2" style={{ borderColor: "var(--brand)" }}>
            {data.qr ? (
              <canvas ref={canvasRef} />
            ) : (
              <div className="w-[260px] h-[260px] flex items-center justify-center text-[13px] text-[var(--ink-3)]">
                No active QR — generate one
              </div>
            )}
          </div>

          <div className="mt-4 text-[12.5px] text-[var(--ink-2)]">
            Employees scan this code to pay your business. Amount and purpose are entered by the payer.
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={download} disabled={!data.qr} className="btn-secondary flex-1">
              Download PNG
            </button>
            <button onClick={rotate} disabled={busy} className="btn-primary flex-1">
              {busy ? "…" : "Regenerate"}
            </button>
          </div>
        </div>

        <div className="card card-pad mt-3">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1">Encoded payload</div>
          <code className="text-[11.5px] break-all text-[var(--ink-2)]">{data.qr?.payload ?? "—"}</code>
        </div>
      </div>
    </main>
  );
}
