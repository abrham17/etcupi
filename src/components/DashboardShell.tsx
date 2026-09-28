"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";

export interface NavItem {
  href: string;
  label: string;
  icon?: ReactNodeLike;
}
type ReactNodeLike = React.ReactNode;

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  employees: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  payments: <path d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4h-4z" />,
  approvals: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  merchants: <path d="M3 9l1-5h16l1 5M4 9v11a1 1 0 001 1h14a1 1 0 001-1V9M9 21v-6h6v6" />,
  budgets: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  reports: <path d="M18 20V10M12 20V4M6 20v-6" />,
  settings: <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  system: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
};

function NavIcon({ name }: { name: string }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

export function DashboardShell({
  children,
  nav,
  name,
  roleLabel,
  company,
}: {
  children: React.ReactNode;
  nav: { href: string; label: string; icon: string }[];
  name: string;
  roleLabel: string;
  company: string;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-56 flex-col shrink-0" style={{ background: "var(--sidebar)" }}>
        <div className="h-14 px-4 flex items-center gap-2 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[13px] font-black" style={{ background: "var(--brand)" }}>
            et
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-bold text-white">etCupi</div>
            <div className="text-[10px]" style={{ color: "var(--sidebar-muted)" }}>
              {company}
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 h-9 rounded-md text-[13.5px] font-medium transition-colors ${
                  active ? "text-white" : ""
                }`}
                style={active ? { background: "var(--brand)" } : { color: "var(--sidebar-ink)" }}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 text-[10.5px]" style={{ color: "var(--sidebar-muted)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          Simulated payment rail · ETB
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar name={name} roleLabel={roleLabel} />
        <main className="flex-1 p-4 md:p-6 max-w-[1200px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
