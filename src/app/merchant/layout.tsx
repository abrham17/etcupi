import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { MobileNav } from "@/components/MobileNav";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/merchant");
  if (user.role !== "MERCHANT") redirect("/");

  return (
    <div className="min-h-screen max-w-[520px] mx-auto bg-[var(--bg)] relative">
      {children}
      <MobileNav role="MERCHANT" />
    </div>
  );
}
