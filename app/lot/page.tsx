import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getLots } from "@/app/actions/lot-tracking";
import LotDetailPanel from "@/components/LotDetailPanel";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; product?: string; search?: string; detail?: string }>;
}

export default async function LotTrackingPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["coo", "ceo", "manager"].includes(session.role)) redirect("/worker");

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const from = params.from || firstOfMonth;
  const to = params.to || today;
  const productFilter = params.product || "";
  const searchQuery = params.search || "";
  const detailId = params.detail || "";

  let lots: Awaited<ReturnType<typeof getLots>> = [];
  try {
    lots = await getLots(from, to, productFilter || undefined);
  } catch {
    // 테이블 미존재 시 빈 배열
  }

  // LOT 번호 검색 필터 (클라이언트 사이드 부분일치)
  const filtered = searchQuery
    ? lots.filter((l) => l.lot_number.includes(searchQuery))
    : lots;

  const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    produced: { label: "생산완료", className: "bg-blue-100 text-blue-700" },
    shipped:  { label: "출하완료", className: "bg-emerald-100 text-emerald-700" },
    recalled: { label: "회수",     className: "bg-red-100 text-red-700" },
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="LOT 이력추적" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* 헤더 */}
        <div>
          <h1 className="text-lg font-bold text-gray-800">LOT 이력추적</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            생산 LOT 번호로 원재료 출처 ~ 출하처까지 전체 이력 추적
          </p>
        </div>

        {/* 검색/필터 */}
        <form className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">LOT 번호 검색</label>
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="예: 260414"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">시작일</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">종료일</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">품목명</label>
              <input
                type="text"
                name="product"
                defaultValue={productFilter}
                placeholder="품목 검색"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-[#1F3864] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2a4a7f] transition-colors"
              >
                검색
              </button>
            </div>
          </div>
        </form>

        {/* 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">전체 LOT</div>
            <div className="text-xl font-bold text-[#1F3864]">{filtered.length}건</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">생산완료</div>
            <div className="text-xl font-bold text-blue-600">
              {filtered.filter((l) => l.status === "produced").length}건
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">출하완료</div>
            <div className="text-xl font-bold text-emerald-600">
              {filtered.filter((l) => l.status === "shipped").length}건
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">평균 수율</div>
            <div className="text-xl font-bold text-amber-600">
              {filtered.length > 0
                ? (filtered.reduce((s, l) => s + (l.yield_rate ?? 0), 0) / filtered.filter((l) => l.yield_rate != null).length || 0).toFixed(1)
                : "-"}%
            </div>
          </div>
        </div>

        {/* LOT 목록 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">LOT 번호</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">생산일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">품목</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">투입량</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">산출량</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">수율</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">상태</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">원재료</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">출하</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">상세</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400">
                      조회된 LOT이 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((lot) => {
                    const st = STATUS_CONFIG[lot.status] ?? { label: lot.status, className: "bg-gray-100 text-gray-600" };
                    const isSelected = detailId === lot.id;
                    return (
                      <tr
                        key={lot.id}
                        className={`border-b border-gray-100 hover:bg-blue-50/50 ${isSelected ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[#1F3864]">{lot.lot_number}</td>
                        <td className="px-4 py-3 text-gray-600">{lot.production_date}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{lot.product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(lot.input_qty).toLocaleString()}kg</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(lot.output_qty).toLocaleString()}kg</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {lot.yield_rate != null ? `${lot.yield_rate}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.className}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                            {lot.material_count}건
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            {lot.shipment_count}건
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href={`/lot?from=${from}&to=${to}&product=${productFilter}&search=${searchQuery}&detail=${lot.id}`}
                            className="text-xs bg-[#1F3864] text-white px-3 py-1 rounded-lg hover:bg-[#2a4a7f] transition-colors inline-block"
                          >
                            상세
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LOT 상세 패널 */}
        {detailId && <LotDetailPanel lotId={detailId} />}
      </main>
    </div>
  );
}
