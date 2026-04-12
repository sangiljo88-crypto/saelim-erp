import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PurchaseManager from "@/components/PurchaseManager";
import { createServerClient } from "@/lib/supabase";

interface Props {
  searchParams: Promise<{ material?: string; from?: string; to?: string }>;
}

export default async function PurchasesPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");
  // manager도 접근 가능 (해당 팀장이 매입 기록)

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const from = params.from || firstOfMonth;
  const to   = params.to   || today;

  const db = createServerClient();

  const [
    { data: purchases },
    { data: products },
  ] = await Promise.all([
    db.from("material_purchases")
      .select("id, purchase_date, material_name, product_code, supplier, quantity, unit, unit_price, total_cost, remaining_qty, invoice_no, notes, recorded_by, created_at")
      .gte("purchase_date", from)
      .lte("purchase_date", to)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false }),

    // 원물/포장재 제품 목록 (빠른 입력용)
    db.from("products")
      .select("code, name, category, purchase_price, unit")
      .in("category", ["원물", "포장재", "부자재"])
      .eq("is_active", true)
      .order("category"),
  ]);

  const all = purchases ?? [];
  const totalCost = all.reduce((s, p) => s + (p.total_cost || 0), 0);

  // 원재료별 집계
  const materialTotals: Record<string, { cost: number; qty: number; unit: string }> = {};
  for (const p of all) {
    if (!materialTotals[p.material_name]) {
      materialTotals[p.material_name] = { cost: 0, qty: 0, unit: p.unit };
    }
    materialTotals[p.material_name].cost += p.total_cost || 0;
    materialTotals[p.material_name].qty  += p.quantity   || 0;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="매입 관리" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">📦 원재료 매입 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">매입 입고 기록 · FIFO 원가 추적 · 잔여수량 관리</p>
          </div>
          {totalCost > 0 && (
            <div className="text-right">
              <div className="text-xs text-gray-400">기간 총 매입금액</div>
              <div className="text-xl font-bold text-[#1F3864]">
                {(totalCost / 10000).toLocaleString()}만원
              </div>
            </div>
          )}
        </div>

        <PurchaseManager
          purchases={all}
          products={products ?? []}
          materialTotals={materialTotals}
          initialFrom={from}
          initialTo={to}
          canEdit={session.role === "coo" || session.role === "manager"}
        />
      </main>
    </div>
  );
}
