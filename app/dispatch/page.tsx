import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import DispatchForm from "@/components/DispatchForm";
import { getTodayDispatches, getVehicles } from "@/app/actions/dispatch";
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const statusBadge: Record<string, { label: string; color: string }> = {
  departed: { label: "운행중", color: "bg-amber-100 text-amber-700" },
  returned: { label: "완료", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500" },
};

export default async function DispatchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [vehicles, todayDispatches] = await Promise.all([
    getVehicles(),
    getTodayDispatches(),
  ]);

  // 현재 유저의 운행 중인 배차
  const myDepartedLogs = todayDispatches.filter(
    (d) => d.driver_id === session.id && d.status === "departed"
  );

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="배차일지" />

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">배차일지</h1>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString("ko-KR")} · 차량 운행 기록
            </p>
          </div>
          {(session.role === "coo" || session.role === "ceo" || session.role === "manager") && (
            <a
              href="/dispatch/fuel"
              className="text-xs bg-[#1F3864] text-white px-3 py-2 rounded-lg hover:bg-[#162c52] transition-colors font-medium"
            >
              유류비 현황
            </a>
          )}
        </div>

        {/* 배차 입력 폼 */}
        <DispatchForm vehicles={vehicles} myDepartedLogs={myDepartedLogs} />

        {/* 오늘의 전체 배차 현황 */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">오늘 배차 현황</h2>
            <span className="text-xs text-gray-400">{todayDispatches.length}건</span>
          </div>

          {todayDispatches.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              오늘 등록된 배차가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2.5 text-left font-medium">기사</th>
                    <th className="px-3 py-2.5 text-left font-medium">차량</th>
                    <th className="px-3 py-2.5 text-right font-medium">출발</th>
                    <th className="px-3 py-2.5 text-right font-medium">도착</th>
                    <th className="px-3 py-2.5 text-right font-medium">거리</th>
                    <th className="px-3 py-2.5 text-left font-medium">방문처</th>
                    <th className="px-3 py-2.5 text-center font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {todayDispatches.map((d) => {
                    const badge = statusBadge[d.status] ?? statusBadge.departed;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                          {d.driver_name}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                          {d.vehicle_name}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                          {Number(d.start_mileage).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                          {d.end_mileage ? Number(d.end_mileage).toLocaleString() : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#1F3864] whitespace-nowrap">
                          {d.status === "returned" && d.distance_km
                            ? `${Number(d.distance_km).toLocaleString()} km`
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">
                          {d.destinations ?? "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
