"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBirr } from "@/lib/money";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export function TopBar({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setNotifications(d.notifications ?? []);
          setUnread(d.unread ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 bg-[var(--surface)] border-b">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden md:inline text-[13px] font-semibold text-[var(--ink-2)] truncate">
            {name} · <span className="text-[var(--ink-3)] font-normal">{roleLabel}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative" ref={ref}>
            <button
              aria-label="Notifications"
              onClick={() => setOpen((v) => !v)}
              className="relative h-9 w-9 rounded-full hover:bg-[var(--surface-2)] flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full" style={{ background: "var(--danger)" }} />
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-80 card shadow-lg overflow-hidden">
                <div className="px-3 py-2.5 border-b flex items-center justify-between">
                  <span className="text-[13px] font-bold">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-[12px] font-semibold" style={{ color: "var(--brand)" }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-[13px] text-[var(--ink-3)] text-center">No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`px-3 py-2.5 border-b last:border-0 ${n.read ? "" : "bg-[var(--brand-soft)]"}`}>
                        <div className="text-[13px] font-semibold">{n.title}</div>
                        <div className="text-[12px] text-[var(--ink-2)]">{n.body}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} className="btn-secondary h-9 px-3 text-[13px]">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
