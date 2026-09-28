import Link from "next/link";

const FEATURES = [
  {
    title: "Corporate wallets",
    body: "Fund one corporate account and allocate budgets to every employee from a single dashboard. Every birr is tracked in a double-entry ledger.",
  },
  {
    title: "Spending controls",
    body: "Daily, monthly and per-transaction limits plus category restrictions — enforced server-side before any payment moves.",
  },
  {
    title: "Scan & Pay QR",
    body: "Employees scan a merchant's QR code, enter the amount and purpose, and confirm. Merchants see payments instantly.",
  },
  {
    title: "Approval workflow",
    body: "Large payments route to finance managers or company admins automatically. Nothing moves until it's approved.",
  },
  {
    title: "Receipts & reconciliation",
    body: "Employees attach receipts to every payment. Finance reviews, searches and reconciles expenses in one place.",
  },
  {
    title: "Built for ETB",
    body: "Amounts stored in minor units (santim), formatted in Ethiopian Birr throughout — never a floating-point rounding surprise.",
  },
];

const ROLE_CARDS = [
  {
    role: "Company admin",
    desc: "Fund the corporate wallet, allocate budgets, set limits and approvals, monitor every transaction.",
    cta: "Register your company",
    href: "/register",
  },
  {
    role: "Employee",
    desc: "A clean mobile wallet: scan merchant QR codes, pay with purpose, attach receipts, see what's left.",
    cta: "Try the demo",
    href: "/login",
  },
  {
    role: "Merchant",
    desc: "Display your QR, receive corporate payments in real time, and track today's sales at a glance.",
    cta: "Register as merchant",
    href: "/register/merchant",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b" style={{ background: "rgba(246,247,244,0.92)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[15px] font-black" style={{ background: "var(--brand)" }}>
              et
            </span>
            <span className="text-[17px] font-bold tracking-tight">etCupi</span>
            <span className="hidden sm:inline ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              BETA · ETB
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary h-9">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary h-9">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-14 pb-16 md:pt-20 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1 rounded-full border mb-5" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", borderColor: "var(--brand)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand)" }} />
              Corporate payments for Ethiopian businesses
            </div>
            <h1 className="text-[34px] md:text-[46px] font-black tracking-tight leading-[1.08]">
              Give employees controlled access to company funds.
            </h1>
            <p className="mt-4 text-[16px] md:text-[17px] leading-relaxed text-[var(--ink-2)] max-w-xl">
              etCupi is the corporate wallet and expense-management platform built for Ethiopia. Allocate budgets in Birr,
              let staff pay merchants by QR, and keep every transaction under approval, limits and audit.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary btn-lg">
                Create a company account
              </Link>
              <Link href="/login" className="btn-secondary btn-lg">
                Sign in to demo
              </Link>
            </div>
            <div className="mt-6 text-[13px] text-[var(--ink-3)]">
              Demo accounts available on the sign-in page · Simulated internal payment rail · No real money moves
            </div>
          </div>

          {/* Product preview card */}
          <div className="card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ background: "var(--sidebar)" }}>
              <span className="text-[13px] font-bold text-white">Payment confirmation</span>
              <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
                etCupi
              </span>
            </div>
            <div className="p-5">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">Amount</div>
              <div className="text-[34px] font-black tabular tracking-tight">850.00 ETB</div>
              <div className="mt-4 space-y-2.5 text-[14px]">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-[var(--ink-2)]">To</span>
                  <span className="font-semibold">Addis Office Supplies</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-[var(--ink-2)]">Purpose</span>
                  <span className="font-semibold">Printer paper</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-[var(--ink-2)]">Category</span>
                  <span className="font-semibold">Office Supplies</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-2)]">Reference</span>
                  <span className="font-semibold tabular">CUPI-20260927-8F72A1</span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md p-2.5" style={{ background: "var(--ok-soft)" }}>
                  <div className="text-[10.5px] font-bold" style={{ color: "var(--ok)" }}>LIMIT CHECK</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Passed</div>
                </div>
                <div className="rounded-md p-2.5" style={{ background: "var(--ok-soft)" }}>
                  <div className="text-[10.5px] font-bold" style={{ color: "var(--ok)" }}>BALANCE</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Sufficient</div>
                </div>
                <div className="rounded-md p-2.5" style={{ background: "var(--brand-soft)" }}>
                  <div className="text-[10.5px] font-bold" style={{ color: "var(--brand)" }}>LEDGER</div>
                  <div className="text-[11px] text-[var(--ink-3)]">Posted</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-white">
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20">
          <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight">Everything a corporate wallet needs</h2>
          <p className="mt-2 text-[15px] text-[var(--ink-2)] max-w-2xl">
            One platform for finance teams, employees and merchants — with an internal simulated rail that makes the whole
            product work end-to-end today, and a clean abstraction for Telebirr or bank rails tomorrow.
          </p>
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-pad">
                <h3 className="font-bold text-[15px]">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="max-w-6xl mx-auto px-4 py-14 md:py-20">
        <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight">Built for every seat</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {ROLE_CARDS.map((r) => (
            <div key={r.role} className="card card-pad flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--brand)" }}>
                {r.role}
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-2)] flex-1">{r.desc}</p>
              <Link href={r.href} className="mt-4 text-[13.5px] font-semibold" style={{ color: "var(--brand)" }}>
                {r.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Demo accounts */}
      <section className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-[20px] font-bold">Explore the full workflow</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">
            Four demo roles, seeded with Ethiopian companies, merchants and live wallet balances.
          </p>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { role: "Company admin", email: "admin@example.com", pass: "Company123!", note: "Addis Tech Solutions" },
              { role: "Finance manager", email: "finance@example.com", pass: "Company123!", note: "Approvals & reports" },
              { role: "Employee", email: "employee@example.com", pass: "Employee123!", note: "Abebe · mobile wallet" },
              { role: "Merchant", email: "merchant@example.com", pass: "Merchant123!", note: "Addis Office Supplies" },
            ].map((d) => (
              <div key={d.email} className="card card-pad">
                <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--brand)" }}>{d.role}</div>
                <div className="mt-2 text-[13px] font-medium">{d.email}</div>
                <div className="text-[13px] text-[var(--ink-2)]">{d.pass}</div>
                <div className="mt-1.5 text-[12px] text-[var(--ink-3)]">{d.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-[var(--ink-3)]">Development / demo accounts for evaluation only.</p>
        </div>
      </section>

      <footer className="border-t" style={{ background: "var(--sidebar)" }}>
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[12px] font-black" style={{ background: "var(--brand)" }}>
              et
            </span>
            <span className="text-[14px] font-bold text-white">etCupi</span>
          </div>
          <div className="text-[12.5px]" style={{ color: "var(--sidebar-muted)" }}>
            Ethiopian corporate payments · Built with Next.js · Simulated rail for development
          </div>
        </div>
      </footer>
    </main>
  );
}
