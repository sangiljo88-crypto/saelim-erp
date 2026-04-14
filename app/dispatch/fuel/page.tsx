import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getMonthlyFuelSummary, getVehicles } from "@/app/actions/dispatch";
import VehicleManager from "@/components/VehicleManager";

export default async function FuelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session || !["coo", "ceo", "manager"].includes(session.role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7);

  const [fuelSummary, vehicles] = await Promise.all([
    getMonthlyFuelSummary(currentMonth),
    getVehicles(),
  ]);

  // 집계
  const totalKm = fuelSummary.reduce((s, v) => s + v.total_km, 0);
  const totalFuelCost = fuelSummary.reduce((s, v) => s + v.total_fuel_cost, 0);
  const totalEstimated = fuelSummary.reduce((s, v) => s + v.estimated_fuel_cost, 0);
  const totalTrips = fuelSummary.reduce((s, v) => s + v.trip_count, 0);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="유류비 현황" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">월간 유류비 현황</h1>
            <p className="text-xs text-gray-500">차량별 운행거리 및 유류비 분석</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dispatch"
              className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-3 py-2 rounded-lg hover:bg-[#1F3864]/5 transition-colors font-medium"
            >
              배차일지
            </a>
            {/* 월 선택 */}
            <form className="flex items-center gap-2">
              <input
                type="month"
                name="month"
                defaultValue={currentMonth}
                className="h-9 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
              />
              <button
                type="submit"
                className="h-9 px-4 bg-[#1F3864] text-white text-sm rounded-lg hover:bg-[#162c52] transition-colors font-medium"
              >
                조회
              </button>
            </form>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">총 운행거리</div>
            <div className="text-xl font-bold text-[#1F3864]">
              {totalKm.toLocaleString()} <span className="text-sm font-normal">km</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{totalTrips}회 운행</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">총 주유비 (실제)</div>
            <div className="text-xl font-bold text-green-700">
              {totalFuelCost > 0
                ? `${(totalFuelCost / 10000).toFixed(0)}만`
                : "-"}
              <span className="text-sm font-normal">원</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">주유 기록 합산</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">추정 유류비</div>
            <div className="text-xl font-bold text-amber-700">
              {totalEstimated > 0
                ? `${(totalEstimated / 10000).toFixed(0)}만`
                : "-"}
              <span className="text-sm font-normal">원</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">거리/연비 x 1,800원</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">차량 수</div>
            <div className="text-xl font-bold text-gray-800">
              {fuelSummary.length} <span className="text-sm font-normal">대</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">운행 기록 있는 차량</div>
          </div>
        </div>

        {/* 차량별 테이블 */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">차량별 유류비 상세</h2>
          </div>

          {fuelSummary.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              해당 월에 운행 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2.5 text-left font-medium">차량</th>
                    <th className="px-3 py-2.5 text-right font-medium">운행횟수</th>
                    <th className="px-3 py-2.5 text-right font-medium">총 거리(km)</th>
                    <th className="px-3 py-2.5 text-right font-medium">주유량(L)</th>
                    <th className="px-3 py-2.5 text-right font-medium">주유비(원)</th>
                    <th className="px-3 py-2.5 text-right font-medium">추정 유류비(원)</th>
                    <th className="px-3 py-2.5 text-right font-medium">실제 연비(km/L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fuelSummary.map((row) => {
                    const efficiencyWarning =
                      row.actual_fuel_efficiency !== null &&
                      row.actual_fuel_efficiency < row.fuel_efficiency * 0.8;

                    return (
                      <tr key={row.vehicle_number || row.vehicle_name} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                          <div>{row.vehicle_name}</div>
                          <div className="text-[10px] text-gray-400">{row.vehicle_number}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{row.trip_count}회</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#1F3864]">
                          {row.total_km.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">
                          {row.fuel_filled_total > 0 ? row.fuel_filled_total.toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">
                          {row.total_fuel_cost > 0
                            ? `${(row.total_fuel_cost / 10000).toFixed(1)}만`
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-amber-700 font-semibold">
                          {row.estimated_fuel_cost > 0
                            ? `${(row.estimated_fuel_cost / 10000).toFixed(1)}만`
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.actual_fuel_efficiency !== null ? (
                            <span
                              className={`font-semibold ${
                                efficiencyWarning ? "text-red-600" : "text-green-700"
                              }`}
                            >
                              {row.actual_fuel_efficiency}
                              {efficiencyWarning && (
                                <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                  연비저하
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 차량 관리 */}
        <VehicleManager
          vehicles={vehicles}
          canManage={session.role === "coo" || session.role === "ceo" || session.role === "manager"}
        />
      </main>
    </div>
  );
}
