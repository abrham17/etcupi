import { PageHeader } from "@/components/ui";
import { TxTable } from "@/components/TxTable";

export default function TransactionsPage() {
  return (
    <div>
      <PageHeader title="Transactions" sub="All payments, allocations, top-ups and reversals across your company." />
      <TxTable apiPath="/api/payments" canReverse />
    </div>
  );
}
