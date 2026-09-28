"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Rendered as the raised centre action. */
  highlight?: boolean;
}

const NAVS: Record<string, NavItem[]> = {
  EMPLOYEE: [
    { href: "/employee", label: "Home", icon: <HomeIcon /> },
    { href: "/employee/pay", label: "Pay", icon: <PayIcon />, highlight: true },
    { href: "/employee/transactions", label: "Activity", icon: <ActivityIcon /> },
    { href: "/employee/wallet", label: "Wallet", icon: <WalletIcon /> },
    { href: "/employee/profile", label: "Profile", icon: <ProfileIcon /> },
  ],
  MERCHANT: [
    { href: "/merchant", label: "Home", icon: <HomeIcon /> },
    { href: "/merchant/receive", label: "Receive", icon: <ReceiveIcon />, highlight: true },
    { href: "/merchant/qr", label: "My QR", icon: <QrIcon /> },
    { href: "/merchant/transactions", label: "Activity", icon: <ActivityIcon /> },
    { href: "/merchant/profile", label: "Profile", icon: <ProfileIcon /> },
  ],
};

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}
function PayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 11h20M7 15h4" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4h-4z" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ReceiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11M8 10l4 4 4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3" />
    </svg>
  );
}

export function MobileNav({ role }: { role: "EMPLOYEE" | "MERCHANT" }) {
  const pathname = usePathname();
  const items = NAVS[role];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 max-w-[520px] mx-auto border-t flex"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        const isPay = item.highlight === true;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={active ? { color: "var(--brand)" } : { color: "var(--ink-3)" }}
          >
            {isPay ? (
              <span
                className="w-11 h-11 -mt-5 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: "var(--brand)" }}
              >
                {item.icon}
              </span>
            ) : (
              item.icon
            )}
            <span className="text-[10.5px] font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
