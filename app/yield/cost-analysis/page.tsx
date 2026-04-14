import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";

export default async function CostAnalysisPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "coo" && session.role !== "ceo") redirect("/login");

  const db = createServerClient();
  const today = new Date();
  const thisMonth = today.toISOString().slice(0, 7);
  const monthStart = `${thisMonth}-01`;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];

  // 1. 원재료 매입 — 원재료별 가중평균 단가
  const { data: purchaseRows } = await db
    .from("material_purchases")
    .select("material_name, quantity, unit_price, total_cost, unit")
    .gte("purchase_date", monthStart)
    .lt("purchase_date", nextMonth);

  const materialCostMap: Record<
    string,
    { totalCost: number; totalQty: number; unit: string }
  > = {};
  for (const p of purchaseRows ?? []) {
    const name = p.material_name;
    if (!materialCostMap[name]) {
      materialCostMap[name] = { totalCost: 0, totalQty: 0, unit: p.unit ?? "kg" };
    }
    materialCostMap[name].totalCost += p.total_cost || 0;
    materialCostMap[name].totalQty += p.quantity || 0;
  }

  // material_name → avg unit_price (원/kg)
  const materialAvgPrice: Record<string, number> = {};
  for (const [name, data] of Object.entries(materialCostMap)) {
    materialAvgPrice[name] =
      data.totalQty > 0 ? Math.round(data.totalCost / data.totalQty) : 0;
  }

  // 2. 급여 — 이번 달 총 인건비
  const { data: payrollRows } = await db
    .from("payroll_records")
    .select("total_pay")
    .eq("pay_month", thisMonth);

  const totalLabor = (payrollRows ?? []).reduce(
    (s, r) => s + (Number(r.total_pay) || 0),
    0
  );

  // 3. 생산일지 — 이번 달 총 생산량 + 품목별 생산량
  const { data: prodLogs } = await db
    .from("production_logs")
    .select("product_name, output_qty")
    .gte("work_date", monthStart)
    .lt("work_date", nextMonth);

  const productOutputMap: Record<string, number> = {};
  let totalOutput = 0;
  for (const log of prodLogs ?? []) {
    const name = log.product_name;
    productOutputMap[name] = (productOutputMap[name] || 0) + (log.output_qty || 0);
    totalOutput += log.output_qty || 0;
  }

  // 인건비/kg = 총 인건비 / 총 생산량
  const laborPerKg = totalOutput > 0 ? Math.round(totalLabor / totalOutput) : 0;

  // 4. 제품별 매출단가
  const { data: products } = await db
    .from("products")
    .select("name, sale_price, category")
    .eq("is_active", true);

  const salePriceMap: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.sale_price > 0) {
      salePriceMap[p.name] = p.sale_price;
    }
  }

  // 5. 납품 기반 실제 매출단가 (보완)
  const { data: deliveries } = await db
    .from("deliveries")
    .select("items")
    .gte("delivery_date", monthStart)
    .lt("delivery_date", nextMonth);

  const deliveryRevenueMap: Record<string, { revenue: number; qty: number }> = {};
  for (const d of deliveries ?? []) {
    const items = Array.isArray(d.items) ? d.items : [];
    for (const it of items) {
      const item = it as { product?: string; qty_kg?: number; amount?: number };
      if (item.product && item.qty_kg && item.amount) {
        if (!deliveryRevenueMap[item.product]) {
          deliveryRevenueMap[item.product] = { revenue: 0, qty: 0 };
        }
        deliveryRevenueMap[item.product].revenue += item.amount;
        deliveryRevenueMap[item.product].qty += item.qty_kg;
      }
    }
  }

  // 품목별 원가 분석 테이블 생성
  type CostRow = {
    product: string;
    materialCostPerKg: number;
    laborCostPerKg: number;
    totalCostPerKg: number;
    salePricePerKg: number;
    marginPerKg: number;
    marginRate: number;
  };

  const costRows: CostRow[] = [];

  // 생산된 품목 기준으로 분석
  for (const [product, outputQty] of Object.entries(productOutputMap)) {
    if (outputQty <= 0) continue;

    // 재료비: 매칭되는 원재료의 가중평균 단가 (간이: 제품명 키워드로 매핑)
    // 실제로는 BOM 기반이지만, 현재는 전체 재료비를 생산량 비례로 배분
    const totalMaterialCost = Object.values(materialCostMap).reduce(
      (s, d) => s + d.totalCost,
      0
    );
    const materialCostPerKg =
      totalOutput > 0 ? Math.round(totalMaterialCost / totalOutput) : 0;

    // 매출단가: 납품 실적 > 제품 마스터 순으로 사용
    const deliveryData = deliveryRevenueMap[product];
    const salePricePerKg = deliveryData
      ? Math.round(deliveryData.revenue / deliveryData.qty)
      : salePriceMap[product] ?? 0;

    const totalCostPerKg = materialCostPerKg + laborPerKg;
    const marginPerKg = salePricePerKg - totalCostPerKg;
    const marginRate =
      salePricePerKg > 0
        ? Math.round((marginPerKg / salePricePerKg) * 1000) / 10
        : 0;

    costRows.push({
      product,
      materialCostPerKg,
      laborCostPerKg: laborPerKg,
      totalCostPerKg,
      salePricePerKg,
      marginPerKg,
      marginRate,
    });
  }

  // 마진율 기준 정렬
  costRows.sort((a, b) => b.marginRate - a.marginRate);

  // 전체 평균 마진율
  const avgMarginRate =
    costRows.length > 0
      ? Math.round(
          (costRows.reduce((s, r) => s + r.marginRate, 0) / costRows.length) * 10
        ) / 10
      : 0;
  const bestMargin = costRows.length > 0 ? costRows[0] : null;
  const worstMargin = costRows.length > 0 ? costRows[costRows.length - 1] : null;

  function marginColor(rate: number): string {
    if (rate >= 15) return "text-emerald-600";
    if (rate >= 5) return "text-amber-600";
    return "text-red-600";
  }

  function marginBg(rate: number): string {
    if (rate >= 15) return "bg-emerald-50";
    if (rate >= 5) return "bg-amber-50";
    return "bg-red-50";
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="품목별 원가 분석" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">품목별 원가 분석</h1>
            <p className="text-sm text-gray-500">
              {thisMonth.replace("-", "년 ")}월 기준 / 재료비 + 인건비 + 마진 분석
            </p>
          </div>
          <a
            href="/yield"
            className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
          >
            ← 수율 현황
          </a>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">전체 평균 마진율</div>
            <div className={`text-2xl font-bold ${marginColor(avgMarginRate)}`}>
              {avgMarginRate}%
            </div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-5">
            <div className="text-xs text-gray-500 mb-1">최고 마진 품목</div>
            <div className="text-sm font-bold text-gray-800">
              {bestMargin?.product ?? "-"}
            </div>
            <div className="text-lg font-bold text-emerald-600">
              {bestMargin ? `${bestMargin.marginRate}%` : "-"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <div className="text-xs text-gray-500 mb-1">최저 마진 품목</div>
            <div className="text-sm font-bold text-gray-800">
              {worstMargin?.product ?? "-"}
            </div>
            <div className={`text-lg font-bold ${marginColor(worstMargin?.marginRate ?? 0)}`}>
              {worstMargin ? `${worstMargin.marginRate}%` : "-"}
            </div>
          </div>
        </div>

        {/* 원가 분석 기본 정보 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">총 재료비</div>
            <div className="text-lg font-bold text-[#1F3864]">
              {Object.values(materialCostMap).reduce((s, d) => s + d.totalCost, 0) > 0
                ? `${(Object.values(materialCostMap).reduce((s, d) => s + d.totalCost, 0) / 10000).toLocaleString()}만`
                : "-"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">총 인건비</div>
            <div className="text-lg font-bold text-[#1F3864]">
              {totalLabor > 0 ? `${(totalLabor / 10000).toLocaleString()}만` : "-"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">인건비/kg</div>
            <div className="text-lg font-bold text-gray-700">
              {laborPerKg > 0 ? `${laborPerKg.toLocaleString()}원` : "-"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">총 생산량</div>
            <div className="text-lg font-bold text-gray-700">
              {totalOutput > 0 ? `${totalOutput.toLocaleString()}kg` : "-"}
            </div>
          </div>
        </div>

        {/* 품목별 원가 테이블 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            품목별 원가 분석 ({costRows.length}개 품목)
          </h2>
          {costRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              이번 달 생산 데이터가 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      품목
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      재료비/kg
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      인건비/kg
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      총원가/kg
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      매출단가/kg
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      마진/kg
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      마진율(%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {costRows.map((row) => (
                    <tr key={row.product} className={marginBg(row.marginRate)}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {row.product}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.materialCostPerKg.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {row.laborCostPerKg.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        {row.totalCostPerKg.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[#1F3864] font-semibold">
                        {row.salePricePerKg > 0
                          ? row.salePricePerKg.toLocaleString()
                          : "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          row.marginPerKg >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {row.salePricePerKg > 0
                          ? row.marginPerKg.toLocaleString()
                          : "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${marginColor(
                          row.marginRate
                        )}`}
                      >
                        {row.salePricePerKg > 0 ? `${row.marginRate}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP / 품목별 원가 분석
        </footer>
      </main>
    </div>
  );
}
