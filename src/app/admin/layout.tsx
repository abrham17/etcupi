import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";

const NAV = [
  { href: "/admin", label: "Companies", icon: "system" },
  { href: "/admin/transactions", label: "Platform transactions", icon: "payments" },
  { href: "/admin/system", label: "System", icon: "settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "SUPER_ADMIN") redirect("/");

  return (
    <DashboardShell nav={NAV} name={user.name} roleLabel="Platform Admin" company="etCupi Platform">
      {children}
    </DashboardShell>
  );
}
