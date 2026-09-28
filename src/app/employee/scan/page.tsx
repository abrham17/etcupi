"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * QR scanner page.
 * Uses the browser BarcodeDetector API where available (Chrome/Android).
 * Falls back to manual payment-ID entry elsewhere (iOS Safari).
 */
export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setError("Camera scanning is not supported in this browser. Enter the merchant payment ID manually below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        type BarcodeDetectorLike = new (opts: { formats: string[] }) => {
          detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
        const BD = (window as unknown as { BarcodeDetector: BarcodeDetectorLike }).BarcodeDetector;
        const detector = new BD({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              stopped = true;
              const raw = codes[0].rawValue;
              router.push(`/employee/pay?merchant=${encodeURIComponent(raw)}`);
              return;
            }
          } catch {
            // ignore frame errors
          }
          raf = requestAnimationFrame(() => setTimeout(tick, 250));
        };
        tick();
      } catch {
        setError("Camera permission denied. Enter the merchant payment ID manually below.");
      }
    }
    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <main className="pb-safe min-h-screen" style={{ background: "#0c1712" }}>
      <div className="sticky top-0 z-10 h-14 flex items-center gap-3 px-4" style={{ background: "#0c1712" }}>
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-md text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="font-bold text-[16px] text-white">Scan QR</div>
      </div>

      <div className="p-4">
        <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/4", background: "#122019" }}>
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6" style={{ color: "var(--sidebar-muted)" }}>
              {error ?? "Starting camera…"}
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 border-2 border-white/80 rounded-lg" />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/employee/pay?merchant=${encodeURIComponent(manual.trim())}`);
          }}
          className="mt-4 card card-pad"
        >
          <label className="label">Merchant payment ID</label>
          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} className="input flex-1 font-mono text-[14px]" placeholder="CUPI-MER-000542" required />
            <button className="btn-primary">Go</button>
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-3)]">Tip: demo merchant IDs are on the merchant's QR page and in the dashboard Merchants list.</p>
        </form>
      </div>
    </main>
  );
}
