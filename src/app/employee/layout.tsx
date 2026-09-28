import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { MobileNav } from "@/components/MobileNav";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/employee");
  if (user.role !== "EMPLOYEE") redirect("/");

  return (
    <div className="min-h-screen max-w-[520px] mx-auto bg-[var(--bg)] relative">
      {children}
      <MobileNav role="EMPLOYEE" />
    </div>
  );
}
