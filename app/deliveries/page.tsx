import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DeliveryHistory from "@/components/DeliveryHistory";
import { createServerClient } from "@/lib/supabase";

interface Props {
  searchParams: Promise<{ customer?: string; from?: string; to?: string; status?: string }>;
}

export default async function DeliveriesPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const params = await searchParams;
  const db = createServerClient();

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const from = params.from || firstOfMonth;
  const to = params.to || today;
  const customerFilter = params.customer || "";
  const statusFilter = params.status || "";

  let query = db
    .from("deliveries")
    .select("id, delivery_date, customer_name, items, total_amount, status, driver, notes, created_at")
    .gte("delivery_date", from)
    .lte("delivery_date", to)
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (customerFilter) {
    query = query.ilike("customer_name", `%${customerFilter}%`);
  }
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: deliveries } = await query;

  const all = deliveries ?? [];
  const totalAmount = all.reduce((s, d) => s + (d.total_amount || 0), 0);

  const customerTotals: Record<string, number> = {};
  for (const d of all) {
    customerTotals[d.customer_name] = (customerTotals[d.customer_name] || 0) + (d.total_amount || 0);
  }
  const topCustomers = Object.entries(customerTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="납품 이력" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-gray-800">🚚 납품 이력 조회</h1>
          <p className="text-sm text-gray-500 mt-0.5">기간별 납품전표 · 거래처별 합계 · 전체 이력</p>
        </div>
        <DeliveryHistory
          deliveries={all}
          totalAmount={totalAmount}
          topCustomers={topCustomers}
          initialFrom={from}
          initialTo={to}
          initialCustomer={customerFilter}
          initialStatus={statusFilter}
          canDelete={session.role === "coo"}
        />
      </main>
    </div>
  );
}
