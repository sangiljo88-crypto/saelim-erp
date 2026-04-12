import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import YieldDashboard from "@/components/YieldDashboard";
import { createServerClient } from "@/lib/supabase";

export default async function YieldPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const db = createServerClient();

  // 최근 30일 기준
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const { data: logs } = await db
    .from("production_logs")
    .select("work_date, dept, product_name, input_qty, output_qty, yield_rate, issue_note, worker_name")
    .gte("work_date", since)
    .order("work_date", { ascending: true });

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="수율 현황" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-800">📊 수율 현황 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">생산 수율 추이 · 품목별 분석 · 이슈 추적</p>
        </div>
        <YieldDashboard logs={logs ?? []} />
      </main>
    </div>
  );
}
