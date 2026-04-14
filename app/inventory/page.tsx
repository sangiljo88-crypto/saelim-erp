import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";
import FrozenInventoryRowEditor from "@/components/FrozenInventoryRowEditor";
import { getExpiryAlerts } from "@/app/actions/expiry";

type FrozenRow = {
  id: string;
  inventory_date: string;
  section: string;
  side: string;
  product_name: string;
  unit: string;
  prev_stock: number;
  usage_qty: number;
  incoming_qty: number;
  outgoing_qty: number;
  current_stock: number;
  modified_by?: string | null;
};

export default async function InventoryPage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) redirect("/login");

  const db = createServerClient();

  let rows: FrozenRow[] = [];
  let latestDate = "-";

  try {
    const { data: latest } = await db
      .from("frozen_inventory")
      .select("inventory_date")
      .order("inventory_date", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      latestDate = latest.inventory_date;
      const { data } = await db
        .from("frozen_inventory")
        .select("id, inventory_date, section, side, product_name, unit, prev_stock, usage_qty, incoming_qty, outgoing_qty, current_stock, modified_by")
        .eq("inventory_date", latest.inventory_date)
        .order("section")
        .order("side")
        .order("product_name");
      rows = (data ?? []) as FrozenRow[];
    }
  } catch {
    // 테이블 미존재 시 무시
  }

  // 유통기한 임박 재고 조회
  let expiryItems: {
    id: string; product_name: string; section: string; expiry_date: string;
    days_left: number; current_stock: number; unit: string;
  }[] = [];
  try {
    expiryItems = await getExpiryAlerts(30);
  } catch {
    // 테이블 미존재 시 무시
  }

  const sections = Array.from(new Set(rows.map((r) => r.section)));
  const totalCurrent = rows.reduce((s, r) => s + (r.current_stock ?? 0), 0);
  const lowCount = rows.filter((r) => (r.current_stock ?? 0) < 50 && (r.current_stock ?? 0) > 0).length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="창고 재고 현황" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">창고별 재고 현황</h1>
            <p className="text-sm text-gray-500">
              냉동·냉장 창고 품목별 재고 · 기준일: {latestDate}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/inventory/audit"
              className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a4a7f] transition-colors font-medium"
            >
              📋 재고실사
            </a>
            <a href={session.role === "ceo" ? "/dashboard" : "/coo"} className="text-xs text-[#1F3864] hover:underline">← 대시보드</a>
          </div>
        </div>

        {/* 유통기한 임박 섹션 */}
        {expiryItems.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
            <div className="bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-800 flex items-center gap-2 border-b border-orange-200">
              <span>⏰</span> 유통기한 임박
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold ml-1">
                {expiryItems.length}건
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orange-100 bg-orange-50/50">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">품목</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">위치</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">유통기한</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">남은일수</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">재고량</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryItems.map((item) => {
                    const urgencyColor =
                      item.days_left <= 7
                        ? "bg-red-50 text-red-700"
                        : item.days_left <= 14
                          ? "bg-amber-50 text-amber-700"
                          : "bg-yellow-50 text-yellow-700";
                    const badgeColor =
                      item.days_left <= 7
                        ? "bg-red-100 text-red-700"
                        : item.days_left <= 14
                          ? "bg-amber-100 text-amber-700"
                          : "bg-yellow-100 text-yellow-700";
                    return (
                      <tr key={item.id} className={`border-b border-orange-100 last:border-0 ${urgencyColor}`}>
                        <td className="px-3 py-2 font-medium text-gray-800">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-600">{item.section}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{item.expiry_date}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {item.days_left}일
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-700">
                          {item.current_stock.toLocaleString()} {item.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-semibold text-gray-600">재고 데이터가 없습니다</div>
            <div className="text-sm text-gray-400 mt-1">재고담당이 입력하거나 DB 마이그레이션을 먼저 실행해주세요</div>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">{totalCurrent.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">전체 현재고 합계</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-700">{sections.length}</div>
                <div className="text-xs text-gray-500 mt-1">창고 수</div>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
                <div className={`text-2xl font-bold ${lowCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {lowCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">부족 품목 (50↓)</div>
              </div>
            </div>

            {/* 창고별 테이블 */}
            {sections.map((section) => {
              const sectionRows = rows.filter((r) => r.section === section);
              const rawRows = sectionRows.filter((r) => r.side === "raw");
              const productRows = sectionRows.filter((r) => r.side === "product");

              return (
                <div key={section} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-[#1F3864] text-white px-4 py-2.5 text-sm font-bold">{section}</div>
                  {[{ label: "원재료", data: rawRows }, { label: "제품", data: productRows }]
                    .filter((g) => g.data.length > 0)
                    .map((g) => (
                      <div key={g.label}>
                        <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                          {g.label}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-3 py-2 text-gray-400 font-medium">품명</th>
                                <th className="text-center px-2 py-2 text-gray-400 font-medium">단위</th>
                                <th className="text-center px-2 py-2 text-gray-400 font-medium">전일재고</th>
                                <th className="text-center px-2 py-2 text-gray-400 font-medium">사용량</th>
                                <th className="text-center px-2 py-2 text-gray-400 font-medium">입고량</th>
                                <th className="text-center px-2 py-2 text-gray-400 font-medium">출고량</th>
                                <th className="text-center px-2 py-2 text-emerald-600 font-semibold">현재고</th>
                              <th className="text-right px-2 py-2 text-gray-400 font-medium">수정</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.data.map((r) => (
                                <FrozenInventoryRowEditor key={r.id} row={r} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </>
        )}

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 창고 재고 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
