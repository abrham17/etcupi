"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  "Office Supplies",
  "Electronics",
  "Food & Beverage",
  "Transportation",
  "Telecom",
  "Equipment",
  "Travel",
  "Utilities",
  "Marketing",
  "Other",
];

export default function MerchantRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    category: "Office Supplies",
    phone: "",
    email: "",
    city: "Addis Ababa",
    subCity: "",
    address: "",
    fullName: "",
    password: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register-merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password }),
    });
    if (loginRes.ok) {
      router.push("/merchant");
      router.refresh();
    } else {
      router.push("/login");
    }
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
          <h1 className="text-[20px] font-bold">Register as a merchant</h1>
          <p className="text-[13.5px] text-[var(--ink-2)] mt-0.5 mb-5">
            Accept corporate payments from etCupi employees with your own QR code.
          </p>
          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <label className="label">Business name</label>
              <input required value={form.businessName} onChange={set("businessName")} className="input" placeholder="Addis Office Supplies" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select value={form.category} onChange={set("category")} className="input">
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Phone</label>
                <input required value={form.phone} onChange={set("phone")} className="input" placeholder="0911 300 001" />
              </div>
            </div>
            <div>
              <label className="label">Email (used to sign in)</label>
              <input required type="email" value={form.email} onChange={set("email")} className="input" placeholder="sales@business.et" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City</label>
                <input value={form.city} onChange={set("city")} className="input" />
              </div>
              <div>
                <label className="label">Sub-city</label>
                <input value={form.subCity} onChange={set("subCity")} className="input" placeholder="Bole" />
              </div>
            </div>
            <div>
              <label className="label">Contact person</label>
              <input required value={form.fullName} onChange={set("fullName")} className="input" placeholder="Full name" />
            </div>
            <div>
              <label className="label">Password</label>
              <input required type="password" minLength={8} value={form.password} onChange={set("password")} className="input" placeholder="At least 8 characters" />
            </div>
            {error && (
              <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? "Creating…" : "Create merchant account"}
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-[var(--ink-2)] mt-4">
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            Sign in
          </Link>{" "}
          ·{" "}
          <Link href="/register" className="font-semibold" style={{ color: "var(--brand)" }}>
            Company sign-up
          </Link>
        </p>
      </div>
    </main>
  );
}
