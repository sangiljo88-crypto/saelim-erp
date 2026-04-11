import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MaintenanceManager from "@/components/MaintenanceManager";
import { createServerClient } from "@/lib/supabase";

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager")) {
    redirect("/login");
  }

  const db = createServerClient();
  const { data: logs } = await db
    .from("maintenance_logs")
    .select("id, equipment_name, dept, log_date, log_type, description, parts_used, cost, technician, result, next_check_date, recorded_by, created_at")
    .order("log_date", { ascending: false });

  const all = logs ?? [];

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const thisMonthCount = all.filter((l) => l.log_date.startsWith(thisMonth)).length;
  const pendingCount   = all.filter((l) => l.result === "진행중").length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="설비 관리" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">설비 수리 이력 관리</h1>
            <p className="text-sm text-gray-500">설비별 점검·수리·교체 이력 기록 및 예정일 관리</p>
          </div>
          <a
            href={session.role === "ceo" ? "/dashboard" : "/coo"}
            className="text-xs text-[#1F3864] hover:underline"
          >
            ← 대시보드
          </a>
        </div>

        {/* 요약 배너 */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
            ⚠️ 처리중인 수리 건이 <strong>{pendingCount}건</strong> 있습니다
          </div>
        )}

        <MaintenanceManager
          initialLogs={all as Parameters<typeof MaintenanceManager>[0]["initialLogs"]}
        />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 설비 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
