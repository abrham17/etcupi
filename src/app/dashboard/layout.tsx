import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/employees", label: "Employees", icon: "employees" },
  { href: "/dashboard/transactions", label: "Transactions", icon: "payments" },
  { href: "/dashboard/approvals", label: "Approvals", icon: "approvals" },
  { href: "/dashboard/merchants", label: "Merchants", icon: "merchants" },
  { href: "/dashboard/limits", label: "Limits & Policy", icon: "budgets" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

const FINANCE_NAV = NAV.filter((n) => n.href !== "/dashboard/employees" && n.href !== "/dashboard/settings");

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role !== "COMPANY_ADMIN" && user.role !== "FINANCE_MANAGER") redirect("/");
  const nav = user.role === "COMPANY_ADMIN" ? NAV : FINANCE_NAV;

  return (
    <DashboardShell nav={nav} name={user.name} roleLabel={user.role === "COMPANY_ADMIN" ? "Company Admin" : "Finance Manager"} company="etCupi Business">
      {children}
    </DashboardShell>
  );
}
