"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BUSINESS_TYPES = [
  "Information Technology",
  "Import & Export",
  "Manufacturing",
  "Transport & Logistics",
  "Construction",
  "Retail & Wholesale",
  "Agriculture",
  "Hospitality & Tourism",
  "Financial Services",
  "Health",
  "Education",
  "NGO / Non-profit",
  "Other",
];

const CITIES = ["Addis Ababa", "Dire Dawa", "Mekelle", "Bahir Dar", "Hawassa", "Jimma", "Adama", "Gondar", "Dessie", "Jijiga"];
const SUB_CITIES_AA = ["Bole", "Lideta", "Kirkos", "Arada", "Gullele", "Yeka", "Nifas Silk-Lafto", "Kolfe Keranio", "Akaky Kaliti", "Addis Ketema"];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    businessType: "Information Technology",
    phone: "",
    email: "",
    address: "",
    city: "Addis Ababa",
    subCity: "",
    description: "",
    adminFullName: "",
    adminEmail: "",
    adminPhone: "",
    password: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
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
    // Auto sign-in: log the admin in straight away
    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.adminEmail, password: form.password }),
    });
    if (loginRes.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      router.push("/login");
    }
  }

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(2);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <span className="w-9 h-9 rounded-md flex items-center justify-center text-white text-[16px] font-black" style={{ background: "var(--brand)" }}>
            et
          </span>
          <span className="text-[20px] font-bold tracking-tight">etCupi</span>
        </Link>

        <div className="card card-pad">
          <div className="flex items-center gap-2 mb-5">
            {[1, 2].map((s) => (
              <div key={s} className="h-1.5 flex-1 rounded-full" style={{ background: s <= step ? "var(--brand)" : "var(--border)" }} />
            ))}
          </div>

          {step === 1 ? (
            <form onSubmit={next}>
              <h1 className="text-[20px] font-bold">Register your company</h1>
              <p className="text-[13.5px] text-[var(--ink-2)] mt-0.5 mb-5">Step 1 of 2 — company details.</p>
              <div className="space-y-3.5">
                <div>
                  <label className="label">Company name</label>
                  <input required minLength={2} value={form.companyName} onChange={set("companyName")} className="input" placeholder="Addis Tech Solutions" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Business type</label>
                    <select value={form.businessType} onChange={set("businessType")} className="input">
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Company phone</label>
                    <input required value={form.phone} onChange={set("phone")} className="input" placeholder="0911 234 567" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Company email</label>
                    <input required type="email" value={form.email} onChange={set("email")} className="input" placeholder="info@company.et" />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <select value={form.city} onChange={set("city")} className="input">
                      {CITIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Sub-city</label>
                    <input value={form.subCity} onChange={set("subCity")} className="input" placeholder="Bole" />
                  </div>
                  <div>
                    <label className="label">Address</label>
                    <input value={form.address} onChange={set("address")} className="input" placeholder="Street, landmark" />
                  </div>
                </div>
                <div>
                  <label className="label">Company description (optional)</label>
                  <textarea value={form.description} onChange={set("description")} className="input h-20 py-2" rows={2} />
                </div>
                {error && (
                  <div className="text-[13px] font-medium px-3 py-2 rounded-md" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                    {error}
                  </div>
                )}
                <button className="btn-primary w-full btn-lg">Continue</button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit}>
              <h1 className="text-[20px] font-bold">Primary administrator</h1>
              <p className="text-[13.5px] text-[var(--ink-2)] mt-0.5 mb-5">Step 2 of 2 — this account manages {form.companyName || "your company"}.</p>
              <div className="space-y-3.5">
                <div>
                  <label className="label">Full name</label>
                  <input required value={form.adminFullName} onChange={set("adminFullName")} className="input" placeholder="Selam Bekele" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email (used to sign in)</label>
                    <input required type="email" value={form.adminEmail} onChange={set("adminEmail")} className="input" placeholder="admin@company.et" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input required value={form.adminPhone} onChange={set("adminPhone")} className="input" placeholder="0911 234 568" />
                  </div>
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
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary btn-lg flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary btn-lg flex-1">
                    {loading ? "Creating…" : "Create company"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] text-[var(--ink-2)] mt-4">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            Sign in
          </Link>
          {" · "}
          <Link href="/register/merchant" className="font-semibold" style={{ color: "var(--brand)" }}>
            Merchant sign-up
          </Link>
        </p>
      </div>
    </main>
  );
}
