import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import UtilityDashboard from "@/components/UtilityDashboard";
import { createServerClient } from "@/lib/supabase";

export default async function UtilityPage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    redirect("/login");
  }

  const db = createServerClient();
  const { data: logs } = await db
    .from("utility_logs")
    .select("id, log_month, electricity_kwh, electricity_cost, water_ton, water_cost, gas_m3, gas_cost, total_cost, memo, recorded_by, created_at")
    .order("log_month", { ascending: false })
    .limit(24);

  const all = logs ?? [];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="유틸리티 관리" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">유틸리티 리스크 대시보드</h1>
            <p className="text-sm text-gray-500">전기·수도·가스 월별 비용 추이 및 이상 감지</p>
          </div>
          <a
            href={session.role === "ceo" ? "/dashboard" : "/coo"}
            className="text-xs text-[#1F3864] hover:underline"
          >
            ← 대시보드
          </a>
        </div>

        <UtilityDashboard
          initialLogs={all as Parameters<typeof UtilityDashboard>[0]["initialLogs"]}
        />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 유틸리티 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
