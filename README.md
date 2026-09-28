# etCupi — Ethiopian Corporate Payments

etCupi is a CUPI-inspired **corporate payment and expense-management platform for Ethiopia**. Companies give employees controlled access to company funds; employees pay merchants by QR or payment ID; administrators monitor, approve, and reconcile every birr — all denominated in **ETB** with amounts stored as BigInt minor units (santim).

The payment rail is **internal/simulated** (settlement happens inside the platform's own double-entry ledger), and the rail sits behind a `PaymentRail` abstraction so Ethiopian providers (Telebirr, CBE Birr, bank rails) can be plugged in later without touching UI or business logic.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- PostgreSQL + Prisma ORM (double-entry ledger, immutable transactions)
- Auth via JWT (jose) in HTTP-only cookies, bcryptjs password hashing
- Zod validation on every mutating endpoint, server-side rate limiting
- Recharts analytics, qrcode generation, role-based access control

## Getting started

```bash
bun install
bunx prisma generate            # generate the client from src/lib/prisma/schema.prisma
bunx prisma migrate deploy      # or: bun run db:migrate (dev)
bun run db:seed                 # realistic Ethiopian demo data
bun dev                         # http://localhost:3000
```

A local PostgreSQL must be reachable at `DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/etcupi`).

## Demo accounts (development)

| Role | Email | Password |
|---|---|---|
| Company admin (Addis Tech Solutions) | `admin@example.com` | `Company123!` |
| Finance manager | `finance@example.com` | `Company123!` |
| Employee (Abebe Tesfaye) | `employee@example.com` | `Employee123!` |
| Merchant (Addis Office Supplies) | `merchant@example.com` | `Merchant123!` |
| Platform super admin | `admin@etcupi.et` | `SuperAdmin123!` |

## The full workflow

1. **Company registers** → company wallet + default policy + approval rules are created.
2. **Admin adds employees** with monthly / daily / per-transaction limits and departments.
3. **Admin funds the corporate wallet** (simulated top-up through the ledger) and **allocates** budgets to employee wallets.
4. **Merchant registers** and gets a QR code (`{type:"merchant", merchantId:"CUPI-MER-…", currency:"ETB"}`).
5. **Employee scans the QR** (or types the merchant payment ID), enters amount + purpose + category.
6. **Merchant can charge an exact amount** from *Receive payment*: it mints a `PaymentRequest` (`CUPI-REQ-…`) with a locked amount, rendered as a QR / share link that the employee scans or types into `/employee/pay?request=…`.
7. **Server-side checks** run in order: auth → status → wallet → balance → tx limit → daily limit → monthly limit → category → request amount lock → approval rule.
8. **Payment settles atomically**: ledger entries, wallet updates, notifications, audit events, and the charge request flips to `PAID`.
9. **Approval-required payments** wait for finance/admin decision; rejected payments never move funds and the charge request reopens so the payer can retry.
10. **Reversals** create new ledger transactions (original stays `REVERSED`, both visible in audit).
11. **Finance reconciles** via receipts, reports, and the immutable audit log.

### Merchant charge requests

`PaymentRequest` statuses: `OPEN → AWAITING_APPROVAL → PAID`, plus `CANCELLED` (merchant) and `EXPIRED` (15-minute default TTL). Charges are created at `POST /api/payment-requests`, polled at `GET /api/payment-requests/[id]`, and resolved by the payer through `POST /api/qr/resolve` (accepts the JSON QR payload, the opaque token, or the human-readable `CUPI-REQ-…` code). The engine refuses any amount that is not exactly the requested one, so the merchant always receives what was charged.

## Architecture

```
src/
├── app/
│   ├── (public)            # landing, login, register (company/merchant)
│   ├── dashboard/          # company admin + finance manager console
│   ├── employee/           # mobile-first wallet: home, pay, scan, activity, receipts, wallet, profile
│   ├── merchant/           # merchant app: home, receive payment, QR, transactions, profile
│   ├── admin/              # super admin: companies, platform transactions, system/audit
│   └── api/                # auth, payments, wallet, employees, limits, approvals,
│                           # receipts, merchants, qr, reports, notifications, audit…
├── components/             # shared UI (tables, stat cards, shells, mobile nav)
├── lib/
│   ├── auth/               # JWT sessions, cookies, role guards, rate limiting
│   ├── ledger/             # double-entry posting (lines must balance)
│   ├── payments/           # PaymentRail abstraction + InternalPaymentRail + engine
│   ├── wallets/            # topup + allocation services
│   ├── prisma/             # schema + seed
│   └── …                   # money (BigInt), ids, validation (zod), audit, i18n, api helpers
└── middleware.ts           # route protection + security headers
tests/financial.test.ts     # vitest: limits, approvals, idempotency, reversals, ledger invariants
tests/payment-requests.test.ts # vitest: charge lock, expiry, cancel, approval routing on requests
```

### Payment rail abstraction

```ts
interface PaymentRail {
  createPayment(req): Promise<RailResult>;
  verifyPayment(railRef): Promise<RailResult>;
  reversePayment(ref, txId, amount): Promise<RailResult>;
}
```

`InternalPaymentRail` settles inside the platform ledger. A future `TelebirrPaymentRail` only needs to implement this interface and register itself in `getRail()` — API routes, engine, and UI stay untouched.

## Financial guarantees (tested)

- Employee cannot exceed wallet balance, daily, monthly, or per-transaction limits
- Blocked categories are rejected server-side
- Approval-required payments stay `PENDING` and move no funds until approved; rejected payments cancel
- Duplicate submissions with the same idempotency key never double-charge
- Reversals restore exact balances and mark the original `REVERSED`
- Every transaction's ledger lines sum to zero (double-entry invariant)
- Role-based guards prevent cross-company access
- A merchant charge can only be settled for exactly the requested amount, once, before it expires

Run them with `bun test` (uses `DATABASE_URL`; a separate `etcupi_test` database is recommended).
