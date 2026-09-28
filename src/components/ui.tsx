"use client";

import { formatBirr } from "@/lib/money";
import type { ReactNode } from "react";

export function Money({ minor, className = "" }: { minor: bigint; className?: string }) {
  return <span className={`tabular ${className}`}>{formatBirr(minor)}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "brand" | "warn" | "danger";
}) {
  const toneStyle =
    tone === "brand"
      ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }
      : tone === "warn"
      ? { background: "var(--warn-soft)", borderColor: "var(--border)" }
      : tone === "danger"
      ? { background: "var(--danger-soft)", borderColor: "var(--border)" }
      : {};
  return (
    <div className="card card-pad" style={toneStyle}>
      <div className={`text-[12px] font-semibold uppercase tracking-wide ${tone === "brand" ? "text-white/70" : "text-[var(--ink-3)]"}`}>
        {label}
      </div>
      <div className="mt-1 text-[22px] md:text-[26px] font-bold tabular leading-tight">{value}</div>
      {sub ? <div className={`mt-1 text-[13px] ${tone === "brand" ? "text-white/80" : "text-[var(--ink-2)]"}`}>{sub}</div> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "badge-ok",
  PENDING: "badge-warn",
  PROCESSING: "badge-warn",
  FAILED: "badge-danger",
  REVERSED: "badge-neutral",
  CANCELLED: "badge-neutral",
  APPROVED: "badge-ok",
  REJECTED: "badge-danger",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "badge-neutral";
  const label = status === "COMPLETED" ? "Completed" : status === "PENDING" ? "Pending" : status === "PROCESSING" ? "Processing" : status === "FAILED" ? "Failed" : status === "REVERSED" ? "Reversed" : status === "CANCELLED" ? "Cancelled" : status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : status;
  return <span className={cls}>{label}</span>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="py-12 text-center">
      <div className="text-[15px] font-semibold text-[var(--ink-2)]">{title}</div>
      {body ? <div className="mt-1 text-[13px] text-[var(--ink-3)]">{body}</div> : null}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-[20px] md:text-[24px] font-bold tracking-tight">{title}</h1>
        {sub ? <p className="text-[14px] text-[var(--ink-2)] mt-0.5">{sub}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
