import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import InventorySection from "@/components/InventorySection";
import { createServerClient } from "@/lib/supabase";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session || session.role !== "coo") redirect("/login");

  const db = createServerClient();

  let rows: {
    id: string; inventory_date: string; location: string;
    product_name: string; unit: string; prev_stock: number;
    incoming_qty: number; outgoing_qty: number;
    recorded_by: string | null; notes: string | null;
  }[] = [];

  let latestDate = "-";

  try {
    const { data: latest } = await db
      .from("container_inventory")
      .select("inventory_date")
      .order("inventory_date", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      latestDate = latest.inventory_date;
      const { data } = await db
        .from("container_inventory")
        .select("id, inventory_date, location, product_name, unit, prev_stock, incoming_qty, outgoing_qty, recorded_by, notes")
        .eq("inventory_date", latest.inventory_date)
        .order("location");
      rows = data ?? [];
    }
  } catch {
    // 테이블 미존재 시 무시
  }

  const totalStock = rows.reduce((s, r) => s + r.prev_stock + r.incoming_qty - r.outgoing_qty, 0);
  const lowCount   = rows.filter((r) => r.prev_stock + r.incoming_qty - r.outgoing_qty < 100).length;
  const locations  = Array.from(new Set(rows.map((r) => r.location)));

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="창고 재고 현황" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">창고별 재고 현황</h1>
            <p className="text-sm text-gray-500">
              냉동·냉장 창고 품목별 입출고 및 현재고 · 기준일: {latestDate}
            </p>
          </div>
          <a
            href="/coo"
            className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
          >
            ← COO 대시보드
          </a>
        </div>

        {/* 요약 카드 */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{totalStock.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">전체 현재고 (kg)</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-700">{locations.length}</div>
              <div className="text-xs text-gray-500 mt-1">창고 수</div>
            </div>
            <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
              <div className={`text-2xl font-bold ${lowCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {lowCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">부족 품목 (100kg↓)</div>
            </div>
          </div>
        )}

        {/* 점검 체크리스트 안내 */}
        {rows.length > 0 && lowCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <div className="text-sm font-semibold text-amber-800 mb-2">⚠ 점검 필요 품목</div>
            <div className="flex flex-wrap gap-2">
              {rows
                .filter((r) => r.prev_stock + r.incoming_qty - r.outgoing_qty < 100)
                .map((r) => (
                  <span key={r.id} className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1 rounded-full font-medium">
                    {r.location} · {r.product_name} ({(r.prev_stock + r.incoming_qty - r.outgoing_qty).toLocaleString()}kg)
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* 재고 테이블 */}
        <InventorySection rows={rows} />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 창고 재고 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
