"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const DEMO = [
  { label: "Company admin", email: "admin@example.com", pass: "Company123!" },
  { label: "Finance", email: "finance@example.com", pass: "Company123!" },
  { label: "Employee", email: "employee@example.com", pass: "Employee123!" },
  { label: "Merchant", email: "merchant@example.com", pass: "Merchant123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Sign-in failed");
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") ? next : data.redirect ?? "/dashboard");
    router.refresh();
  }

  function fill(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-md flex items-center justify-center text-white text-[16px] font-black" style={{ background: "var(--brand)" }}>
            et
          </span>
          <span className="text-[20px] font-bold tracking-tight">etCupi</span>
        </Link>

        <div className="card card-pad">
          <h1 className="text-[20px] font-bold">Sign in</h1>
          <p className="text-[13.5px] text-[var(--ink-2)] mt-0.5 mb-5">Corporate payments for Ethiopian businesses.</p>

          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.et"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-4 text-center text-[13px] text-[var(--ink-2)]">
            New company?{" "}
            <Link href="/register" className="font-semibold" style={{ color: "var(--brand)" }}>
              Register here
            </Link>
            {" · "}
            <Link href="/register/merchant" className="font-semibold" style={{ color: "var(--brand)" }}>
              Merchant sign-up
            </Link>
          </div>
        </div>

        {/* Demo accounts */}
        <div className="card card-pad mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-2">Demo accounts (development)</div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => fill(d.email, d.pass)}
                className="text-left px-3 py-2 rounded-md border hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="text-[12.5px] font-semibold">{d.label}</div>
                <div className="text-[11px] text-[var(--ink-3)]">{d.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
