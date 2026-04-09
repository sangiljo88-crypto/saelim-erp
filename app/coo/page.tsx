import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ActionItems, { ActionItemRow } from "@/components/ActionItems";
import AlertPanel from "@/components/AlertPanel";
import CostApprovalSection from "@/components/CostApprovalSection";
import HygieneCheckDetail from "@/components/HygieneCheckDetail";
import CooCommentBox from "@/components/CooCommentBox";
import { createServerClient } from "@/lib/supabase";
import { alerts } from "@/lib/sampleData";

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

const DEPT_ORDER = ["생산팀", "가공팀", "스킨팀", "재고팀", "품질팀", "배송팀", "CS팀", "마케팅팀", "회계팀", "온라인팀", "개발팀"];

export default async function COOPage() {
  const session = await getSession();
  if (!session || session.role !== "coo") redirect("/login");

  const db = createServerClient();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const [
    { data: dbActionItems },
    { count: pendingClaimsCount },
    { count: todayProdCount },
    { data: todayHygiene },
    { data: deptReports },
  ] = await Promise.all([
    db.from("action_items").select("id, title, dept, deadline, status").order("deadline"),
    db.from("claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("production_logs").select("*", { count: "exact", head: true }).eq("work_date", today),
    db.from("hygiene_checks").select("worker_name, dept, all_passed, items").eq("check_date", today),
    // 각 부서의 가장 최근 주간 보고서 1건씩
    db.from("dept_reports")
      .select("id, dept, report_date, manager_name, rag_status, issue, detail, next_action, status, coo_comment, coo_updated_at")
      .order("report_date", { ascending: false }),
  ]);

  // 부서별 최신 보고서만 추출
  const latestByDept = new Map<string, typeof deptReports extends (infer T)[] | null ? T : never>();
  for (const r of deptReports ?? []) {
    if (!latestByDept.has(r.dept)) latestByDept.set(r.dept, r);
  }

  const actionItems: ActionItemRow[] = (dbActionItems ?? []).map((a) => ({
    id: a.id as string, title: a.title, dept: a.dept,
    deadline: a.deadline, status: a.status as ActionItemRow["status"],
  }));

  const delayedActions = actionItems.filter((a) => a.status === "지연").length;
  const pendingApprovals = 3;
  const reportSubmitted = latestByDept.size;
  const pendingReviews = [...latestByDept.values()].filter((r) => r.status === "submitted").length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="COO 운영 관리" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">운영 현황 총괄</h1>
            <p className="text-sm text-gray-500">전 부서 실시간 현황 · {thisMonth.replace("-", "년 ")}월 · DB 연동</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold">COO 전용</span>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="비용 결재 대기" value={`${pendingApprovals}건`} sub="승인 필요" color="text-amber-600" />
          <StatCard
            label="부서 보고 검토 대기"
            value={`${pendingReviews}건`}
            sub={`총 ${reportSubmitted}개 부서 보고 (DB)`}
            color={pendingReviews > 0 ? "text-amber-600" : "text-emerald-600"}
          />
          <StatCard
            label="미처리 클레임"
            value={`${pendingClaimsCount ?? 0}건`}
            sub="pending 상태 (DB)"
            color={(pendingClaimsCount ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}
          />
          <StatCard
            label="오늘 생산일지"
            value={`${todayProdCount ?? 0}건`}
            sub={`위생점검 ${todayHygiene?.length ?? 0}건`}
            color="text-[#1F3864]"
          />
        </div>

        {/* ─── 부서별 주간 보고 + COO 코멘트 ──────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              부서별 주간 보고 검토
            </h2>
            <span className="text-xs text-gray-400">
              코멘트 입력 → CEO 대시보드 즉시 반영
            </span>
            {pendingReviews > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold ml-auto">
                검토 대기 {pendingReviews}건
              </span>
            )}
          </div>

          {latestByDept.size > 0 ? (
            <div className="flex flex-col gap-2">
              {DEPT_ORDER.map((dept) => {
                const r = latestByDept.get(dept);
                if (!r) return null;
                return (
                  <CooCommentBox
                    key={r.id}
                    reportId={r.id}
                    dept={dept}
                    managerName={r.manager_name}
                    issue={r.issue}
                    ragStatus={r.rag_status}
                    detail={r.detail}
                    nextAction={r.next_action}
                    existingComment={r.coo_comment}
                    reportDate={r.report_date}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm font-medium text-gray-600">아직 팀장이 제출한 보고서가 없습니다</div>
              <div className="text-xs text-gray-400 mt-1">각 부서 팀장이 주간 보고서를 제출하면 여기에 나타납니다</div>
            </div>
          )}
        </section>

        {/* 오늘 위생점검 */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">오늘 위생점검</h2>
            {todayHygiene && todayHygiene.length > 0 && (
              <span className="text-xs text-gray-400">클릭하면 항목별 상세 확인</span>
            )}
          </div>
          <HygieneCheckDetail checks={todayHygiene ?? []} />
        </section>

        {/* 긴급 알림 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">긴급 알림</h2>
          <AlertPanel alerts={alerts} />
        </section>

        {/* 비용 승인 */}
        <CostApprovalSection />

        {/* Action Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Action Items
              <span className="ml-2 text-gray-400 font-normal normal-case">({actionItems.length}건 · DB)</span>
            </h2>
            {delayedActions > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">지연 {delayedActions}건</span>
            )}
          </div>
          <ActionItems items={actionItems} />
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0 · COO 운영 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
