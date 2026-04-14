import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  calculateMaterialRequirements,
  getBomMappings,
  getLatestMaterialPrices,
} from "@/app/actions/procurement";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // COO/CEO/재고팀/생산팀 접근 허용
  const allowed =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" &&
      ["재고팀", "생산팀"].includes(session.dept ?? ""));
  if (!allowed) redirect("/login");

  // MRP 계산
  let mrpData: Awaited<ReturnType<typeof calculateMaterialRequirements>> | null = null;
  let mrpError: string | null = null;
  try {
    mrpData = await calculateMaterialRequirements(7);
  } catch (err) {
    mrpError = (err as Error).message;
  }

  // BOM 매핑 조회
  let bomList: Awaited<ReturnType<typeof getBomMappings>> = [];
  try {
    bomList = await getBomMappings();
  } catch {
    // BOM 테이블 미존재 시 무시
  }

  // 최신 원재료 단가
  let materialPrices: Record<string, number> = {};
  try {
    materialPrices = await getLatestMaterialPrices();
  } catch {
    // 무시
  }

  const plans = mrpData?.plans ?? [];
  const requirements = mrpData?.requirements ?? [];
  const period = mrpData?.period;

  // 발주 필요 항목
  const orderItems = requirements.filter((r) => r.needsOrder);

  // 발주 예상 금액
  const estimatedOrderCost = orderItems.reduce((sum, item) => {
    const price = materialPrices[item.material] ?? 0;
    return sum + item.shortfall * price;
  }, 0);

  // 생산계획 요약 (날짜별)
  const plansByDate: Record<string, Array<{ product: string; qty: number; status: string }>> =
    {};
  for (const p of plans) {
    if (!plansByDate[p.plan_date]) plansByDate[p.plan_date] = [];
    plansByDate[p.plan_date].push({
      product: p.product_name,
      qty: p.target_qty,
      status: p.status,
    });
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="자재 소요 계획" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              자재 소요 계획 (MRP)
            </h1>
            <p className="text-sm text-gray-500">
              생산계획 기반 자재 소요 계산 / 재고 대비 부족량 분석
              {period && (
                <span className="ml-2 text-gray-400">
                  ({period.from} ~ {period.to})
                </span>
              )}
            </p>
          </div>
          <a
            href={session.role === "ceo" ? "/dashboard" : "/coo"}
            className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
          >
            ← 대시보드
          </a>
        </div>

        {mrpError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            MRP 계산 오류: {mrpError}
          </div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">향후 7일 생산 계획</div>
            <div className="text-2xl font-bold text-[#1F3864]">
              {plans.length}건
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">소요 자재 종류</div>
            <div className="text-2xl font-bold text-gray-700">
              {requirements.length}종
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">발주 필요</div>
            <div className="text-2xl font-bold text-red-600">
              {orderItems.length}종
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">예상 발주 금액</div>
            <div className="text-xl font-bold text-[#1F3864]">
              {estimatedOrderCost > 0
                ? `${(estimatedOrderCost / 10000).toLocaleString()}만원`
                : "-"}
            </div>
          </div>
        </div>

        {/* 생산계획 요약 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            생산계획 요약 (향후 7일)
          </h2>
          {plans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              향후 7일 내 생산계획이 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      날짜
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      품목
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      목표량 (kg)
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 text-gray-600">{p.plan_date}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {p.product_name}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {(p.target_qty || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            p.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : p.status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.status === "completed"
                            ? "완료"
                            : p.status === "in_progress"
                            ? "진행중"
                            : "대기"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 자재 소요 분석 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            자재 소요 분석
          </h2>
          {requirements.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              {bomList.length === 0
                ? "BOM 매핑이 등록되지 않았습니다. BOM 등록 후 이용해주세요."
                : "소요 자재가 없습니다"}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      자재명
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      필요량
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      현재고
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      부족량
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      발주필요
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requirements.map((r) => (
                    <tr
                      key={r.material}
                      className={r.needsOrder ? "bg-red-50" : ""}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {r.material}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {r.required.toLocaleString()} {r.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">
                        {r.currentStock.toLocaleString()} {r.unit}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${
                          r.shortfall > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {r.shortfall > 0
                          ? `${r.shortfall.toLocaleString()} ${r.unit}`
                          : "충분"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.needsOrder ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                            필요
                          </span>
                        ) : (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                            충분
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 발주 제안 */}
        {orderItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              발주 제안 ({orderItems.length}건)
            </h2>
            <div className="bg-white rounded-xl border border-red-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-red-600 font-medium">
                      자재명
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-red-600 font-medium">
                      발주 수량
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-red-600 font-medium">
                      최근 단가
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-red-600 font-medium">
                      예상 금액
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-red-600 font-medium">
                      발주
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderItems.map((item) => {
                    const price = materialPrices[item.material] ?? 0;
                    const estimatedCost = item.shortfall * price;
                    const purchaseUrl = `/purchases?material=${encodeURIComponent(
                      item.material
                    )}`;

                    return (
                      <tr key={item.material}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {item.material}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-700 font-semibold">
                          {item.shortfall.toLocaleString()} {item.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {price > 0 ? `${price.toLocaleString()}원/${item.unit}` : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#1F3864]">
                          {estimatedCost > 0
                            ? `${(estimatedCost / 10000).toLocaleString()}만원`
                            : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <a
                            href={purchaseUrl}
                            className="text-xs bg-[#1F3864] text-white px-3 py-1 rounded-lg font-semibold hover:bg-[#2a4a7f] transition-colors"
                          >
                            발주서 생성
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* BOM 매핑 현황 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            BOM 매핑 현황 ({bomList.length}건)
          </h2>
          {bomList.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="text-sm text-gray-500 mb-2">
                BOM (제품 → 원재료) 매핑이 등록되지 않았습니다
              </div>
              <div className="text-xs text-gray-400">
                product_bom 테이블에 매핑 데이터를 등록해주세요
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      제품
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      원재료
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">
                      소요량/kg
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bomList.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {b.product_name}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {b.material_name}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">
                        {Number(b.qty_per_unit).toFixed(2)} {b.unit}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {b.notes ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP / 자재 소요 계획 (MRP)
        </footer>
      </main>
    </div>
  );
}
