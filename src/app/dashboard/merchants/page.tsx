"use client";

import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui";

interface Merchant {
  id: string;
  paymentId: string;
  businessName: string;
  category: string;
  city: string;
  subCity: string | null;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/merchants?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          setMerchants(d.merchants ?? []);
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <PageHeader title="Merchants" sub="Verified merchants accepting etCupi corporate payments." />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or payment ID…" className="input max-w-md mb-4" />
      <div className="card">
        {loading ? (
          <div className="card-pad text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : merchants.length === 0 ? (
          <EmptyState title="No merchants found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="th">Merchant</th>
                  <th className="th">Payment ID</th>
                  <th className="th">Category</th>
                  <th className="th">Location</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="td font-semibold text-[13.5px]">{m.businessName}</td>
                    <td className="td text-[12.5px] tabular">{m.paymentId}</td>
                    <td className="td text-[13px]">{m.category}</td>
                    <td className="td text-[13px] text-[var(--ink-2)]">
                      {m.subCity ? `${m.subCity}, ` : ""}
                      {m.city}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
