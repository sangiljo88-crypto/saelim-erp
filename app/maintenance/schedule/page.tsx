import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MaintenanceScheduleManager from "@/components/MaintenanceScheduleManager";
import {
  getMaintenanceSchedules,
  getSpareParts,
} from "@/app/actions/preventive-maintenance";

export default async function MaintenanceSchedulePage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager")) {
    redirect("/login");
  }

  const [schedules, parts] = await Promise.all([
    getMaintenanceSchedules(),
    getSpareParts(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const overdueCount = schedules.filter((s) => s.next_due < today).length;
  const lowStockCount = parts.filter((p) => p.current_stock < p.min_stock).length;

  const canEdit = session.role === "coo" || session.role === "ceo" || session.role === "manager";

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="예방정비 스케줄" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">예방정비 스케줄 + 부품 재고</h1>
            <p className="text-sm text-gray-500 mt-0.5">정기 정비 관리 및 소모품/부품 재고 현황</p>
          </div>
          <div className="flex gap-2">
            <a href="/maintenance" className="text-xs text-[#1F3864] hover:underline">
              설비 관리
            </a>
            <span className="text-xs text-gray-300">|</span>
            <a href={session.role === "ceo" ? "/dashboard" : "/coo"} className="text-xs text-[#1F3864] hover:underline">
              대시보드
            </a>
          </div>
        </div>

        {/* 경고 배너 */}
        {overdueCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-red-800">
                정비 지연 {overdueCount}건
              </div>
              <div className="text-xs text-red-600 mt-0.5">
                예정일이 지난 정비 항목이 있습니다. 즉시 점검이 필요합니다.
              </div>
            </div>
          </div>
        )}
        {lowStockCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <div className="text-sm font-semibold text-amber-800">
                부품 재고 부족 {lowStockCount}건
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                최소 재고 이하인 부품이 있습니다. 발주를 검토하세요.
              </div>
            </div>
          </div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">총 스케줄</div>
            <div className="text-xl font-bold text-[#1F3864]">{schedules.length}건</div>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">정비 지연</div>
            <div className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {overdueCount}건
            </div>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">총 부품</div>
            <div className="text-xl font-bold text-[#1F3864]">{parts.length}종</div>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">재고 부족</div>
            <div className={`text-xl font-bold ${lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {lowStockCount}종
            </div>
          </div>
        </div>

        <MaintenanceScheduleManager
          initialSchedules={schedules}
          initialParts={parts}
          canEdit={canEdit}
        />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP - 예방정비 스케줄
        </footer>
      </main>
    </div>
  );
}
