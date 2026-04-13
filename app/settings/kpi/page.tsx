import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import KpiTargetTable from "@/components/KpiTargetTable";
import { getKpiTargets } from "@/app/actions/kpi-targets";

export default async function KpiSettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    redirect("/login");
  }

  const year = new Date().getFullYear();
  const targets = await getKpiTargets(year);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="KPI 목표 설정" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">KPI 목표 관리</h1>
            <p className="text-sm text-gray-500">
              {year}년 부서별 KPI 목표치를 설정합니다 · 변경 시 대시보드에 즉시 반영
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={session.role === "coo" ? "/coo" : "/dashboard"}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              돌아가기
            </a>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold">
              {session.role === "ceo" ? "CEO" : "COO"} 전용
            </span>
          </div>
        </div>

        <KpiTargetTable targets={targets} year={year} />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0 · KPI 목표 설정 · 변경 즉시 반영
        </footer>
      </main>
    </div>
  );
}
