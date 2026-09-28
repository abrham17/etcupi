import { PageHeader } from "@/components/ui";
import { TxTable } from "@/components/TxTable";

export default function AdminTransactionsPage() {
  return (
    <div>
      <PageHeader title="Platform transactions" sub="Every payment across all companies and merchants." />
      <TxTable apiPath="/api/payments" />
    </div>
  );
}
