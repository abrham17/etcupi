"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Me {
  name: string;
  email: string;
  role: string;
}

export default function EmployeeProfile() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
    fetch("/api/employee-profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPaymentId(d.paymentId));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="pb-safe min-h-screen">
      <div className="px-5 pt-8 pb-6 text-white" style={{ background: "var(--brand)", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-black bg-white/20 mb-3">
          {me?.name?.slice(0, 1) ?? "?"}
        </div>
        <div className="text-[19px] font-bold">{me?.name ?? "…"}</div>
        <div className="text-[13px] opacity-85">{me?.email}</div>
        {paymentId && <div className="mt-2 inline-block px-2.5 py-1 rounded-md bg-white/15 text-[12px] font-mono">{paymentId}</div>}
      </div>

      <div className="p-4 space-y-3">
        <div className="card card-pad">
          <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-2">Your payment ID</div>
          <div className="text-[15px] font-mono font-semibold">{paymentId ?? "—"}</div>
          <p className="text-[12px] text-[var(--ink-3)] mt-1">Share this ID to receive budget allocations from your company.</p>
        </div>

        <button onClick={logout} className="btn-secondary w-full" style={{ color: "var(--danger)" }}>
          Sign out
        </button>
        <p className="text-center text-[11.5px] text-[var(--ink-3)]">etCupi · Simulated internal payment rail · ETB</p>
      </div>
    </main>
  );
}
