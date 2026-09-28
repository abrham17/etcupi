"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

const ALL_CATEGORIES = [
  "Office Supplies",
  "Transportation",
  "Food & Beverage",
  "Telecom",
  "Equipment",
  "Travel",
  "Utilities",
  "Marketing",
  "Entertainment",
  "Personal",
];

interface Policy {
  dailyLimit: string;
  monthlyLimit: string;
  txLimit: string;
  blockedCategories: string[];
}

export default function LimitsPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/limits")
      .then((r) => r.json())
      .then((d) => {
        if (d.policy) {
          setPolicy(d.policy);
          setBlocked(d.policy.blockedCategories ?? []);
        }
      });
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/limits", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyLimit: Number(fd.get("dailyLimit")),
        monthlyLimit: Number(fd.get("monthlyLimit")),
        txLimit: Number(fd.get("txLimit")),
        blockedCategories: blocked,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  function toggleCat(cat: string) {
    setBlocked((b) => (b.includes(cat) ? b.filter((c) => c !== cat) : [...b, cat]));
  }

  if (!policy) {
    return <div className="text-[13px] text-[var(--ink-3)]">Loading policy…</div>;
  }

  return (
    <div>
      <PageHeader title="Limits & Policy" sub="Company-wide spending caps and blocked categories. Applied to every employee payment, server-side." />

      <form onSubmit={save} className="max-w-xl space-y-4">
        <div className="card card-pad">
          <div className="font-bold text-[14px] mb-3">Spending caps (ETB)</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Per transaction</label>
              <input name="txLimit" type="number" min={0} defaultValue={Number(policy.txLimit) / 100} className="input" />
            </div>
            <div>
              <label className="label">Daily</label>
              <input name="dailyLimit" type="number" min={0} defaultValue={Number(policy.dailyLimit) / 100} className="input" />
            </div>
            <div>
              <label className="label">Monthly</label>
              <input name="monthlyLimit" type="number" min={0} defaultValue={Number(policy.monthlyLimit) / 100} className="input" />
            </div>
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-3)]">Set 0 to disable a cap. Employee-level limits also apply (the strictest wins).</p>
        </div>

        <div className="card card-pad">
          <div className="font-bold text-[14px] mb-1">Blocked categories</div>
          <p className="text-[12.5px] text-[var(--ink-3)] mb-3">Employees cannot select these categories when paying.</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const on = blocked.includes(cat);
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCat(cat)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-colors"
                  style={
                    on
                      ? { background: "var(--danger-soft)", color: "var(--danger)", borderColor: "var(--danger)" }
                      : { background: "var(--ok-soft)", color: "var(--ok)", borderColor: "transparent" }
                  }
                >
                  {on ? "✕ " : "✓ "}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button disabled={saving} className="btn-primary btn-lg">
            {saving ? "Saving…" : "Save policy"}
          </button>
          {saved && <span className="text-[13px] font-semibold" style={{ color: "var(--ok)" }}>Policy saved ✓</span>}
        </div>
      </form>
    </div>
  );
}
