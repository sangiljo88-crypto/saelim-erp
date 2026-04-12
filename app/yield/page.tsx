import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import YieldDashboard from "@/components/YieldDashboard";
import { createServerClient } from "@/lib/supabase";

export default async function YieldPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const db = createServerClient();

  // 최근 30일 기준
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const [{ data: logs }, { data: products }] = await Promise.all([
    db.from("production_logs")
      .select("work_date, dept, product_id, product_name, input_qty, output_qty, yield_rate, issue_note, worker_name")
      .gte("work_date", since)
      .order("work_date", { ascending: true }),
    db.from("products")
      .select("id, name, sale_price, unit")
      .eq("is_active", true)
      .gt("sale_price", 0),
  ]);

  // product_id → sale_price 맵 생성 (unit=kg인 품목만 직접 적용)
  const priceById: Record<string, number> = {};
  const priceByName: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.sale_price > 0) {
      priceById[p.id] = p.sale_price;
      priceByName[p.name] = p.sale_price;
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="수율 현황" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-800">📊 수율 현황 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">생산 수율 추이 · 품목별 분석 · 이슈 추적</p>
        </div>
        <YieldDashboard logs={logs ?? []} priceById={priceById} priceByName={priceByName} />
      </main>
    </div>
  );
}
