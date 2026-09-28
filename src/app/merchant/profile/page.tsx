"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MerchantInfo {
  businessName: string;
  paymentId: string;
  merchantCode: string;
  category: string;
}

export default function MerchantProfile() {
  const router = useRouter();
  const [info, setInfo] = useState<MerchantInfo | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/qr/mine")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo(d.merchant));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setEmail(d.user?.email ?? ""));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="pb-safe min-h-screen">
      <div className="px-5 pt-8 pb-6 text-white" style={{ background: "var(--brand)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-[20px] font-black bg-white/20 mb-3">
          {info?.businessName?.slice(0, 1) ?? "?"}
        </div>
        <div className="text-[19px] font-bold">{info?.businessName ?? "…"}</div>
        <div className="text-[13px] opacity-85">{email}</div>
      </div>

      <div className="p-4 space-y-3">
        <div className="card card-pad space-y-2.5 text-[14px]">
          <div className="flex justify-between border-b pb-2">
            <span className="text-[var(--ink-2)]">Payment ID</span>
            <span className="font-mono font-semibold">{info?.paymentId ?? "—"}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-[var(--ink-2)]">Merchant code</span>
            <span className="font-mono font-semibold">{info?.merchantCode ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-2)]">Category</span>
            <span className="font-semibold">{info?.category ?? "—"}</span>
          </div>
        </div>

        <button onClick={logout} className="btn-secondary w-full" style={{ color: "var(--danger)" }}>
          Sign out
        </button>
        <p className="text-center text-[11.5px] text-[var(--ink-3)]">etCupi · Simulated internal payment rail · ETB</p>
      </div>
    </main>
  );
}
