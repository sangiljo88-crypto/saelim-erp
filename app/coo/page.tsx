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
    { data: todayDeliveries },
    { data: todayProdLogs },
    { data: todayIntake },
    { data: costApprovals },
    { data: utilityLogsRaw },
  ] = await Promise.all([
    db.from("action_items").select("id, title, dept, deadline, status").order("deadline"),
    db.from("claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("production_logs").select("*", { count: "exact", head: true }).eq("work_date", today),
    db.from("hygiene_checks").select("worker_name, dept, all_passed, items").eq("check_date", today),
    db.from("dept_reports")
      .select("id, dept, report_date, manager_name, rag_status, issue, detail, next_action, status, coo_comment, coo_updated_at")
      .order("report_date", { ascending: false }),
    // 오늘 납품전표
    db.from("deliveries")
      .select("id, delivery_date, customer_name, total_amount, status, driver, items")
      .eq("delivery_date", today)
      .order("created_at", { ascending: false }),
    // 오늘 생산일지
    db.from("production_logs")
      .select("worker_name, dept, product_name, input_qty, output_qty, issue_note")
      .eq("work_date", today),
    // 오늘 농협 입고
    db.from("livestock_intake")
      .select("intake_date, nh_actual, manager_name")
      .eq("intake_date", today),
    // 비용 승인 대기
    db.from("cost_approvals")
      .select("id, title, dept, requested_by, request_date, amount, status")
      .eq("status", "pending")
      .order("request_date", { ascending: false }),
    // 유틸리티 최근 4개월
    db.from("utility_logs")
      .select("log_month, total_cost")
      .order("log_month", { ascending: false })
      .limit(4),
  ]);

  // 창고별 최신 날짜 재고 (테이블 없으면 빈 배열)
  let inventoryRows: {
    id: string; inventory_date: string; location: string;
    product_name: string; unit: string; prev_stock: number;
    incoming_qty: number; outgoing_qty: number;
    recorded_by: string | null; notes: string | null;
  }[] = [];
  try {
    const { data: latestDateRow } = await db
      .from("container_inventory")
      .select("inventory_date")
      .order("inventory_date", { ascending: false })
      .limit(1)
      .single();
    if (latestDateRow) {
      const { data: invData } = await db
        .from("container_inventory")
        .select("id, inventory_date, location, product_name, unit, prev_stock, incoming_qty, outgoing_qty, recorded_by, notes")
        .eq("inventory_date", latestDateRow.inventory_date)
        .order("location");
      inventoryRows = invData ?? [];
    }
  } catch {
    // 테이블 미존재 시 무시
  }

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
  const pendingApprovals = (costApprovals ?? []).length;
  const reportSubmitted = latestByDept.size;
  const pendingReviews = [...latestByDept.values()].filter((r) => r.status === "submitted").length;
  const lowStockCount = inventoryRows.filter((r) => {
    const curr = r.prev_stock + r.incoming_qty - r.outgoing_qty;
    return curr < 100;
  }).length;

  // 유틸리티 리스크 계산 (이번달 vs 직전 3개월 평균)
  const utilityLogs = (utilityLogsRaw ?? []) as { log_month: string; total_cost: number }[];
  const utilityThisMonth = utilityLogs.find((l) => l.log_month === thisMonth);
  const utilityPrev3 = utilityLogs.filter((l) => l.log_month < thisMonth).slice(0, 3);
  const utilityAvg = utilityPrev3.length
    ? utilityPrev3.reduce((s, l) => s + l.total_cost, 0) / utilityPrev3.length
    : 0;
  const utilityRatio = utilityThisMonth && utilityAvg > 0
    ? utilityThisMonth.total_cost / utilityAvg
    : 0;
  const utilityRisk = utilityRatio >= 1.3 ? "red" : utilityRatio >= 1.15 ? "yellow" : "none";

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

        {/* 바로가기 링크 */}
        <div className="flex gap-3 flex-wrap">
          <a
            href="/briefings/new"
            className="flex items-center gap-2 bg-[#1F3864] text-white rounded-xl border border-[#1F3864] px-4 py-2.5 hover:bg-[#2a4a7f] transition-colors text-sm font-medium"
          >
            <span>✏️</span> 브리핑 등록
          </a>
          <a
            href="/products"
            className="flex items-center gap-2 bg-white rounded-xl border border-[#1F3864]/20 px-4 py-2.5 hover:bg-[#1F3864]/5 transition-colors text-sm font-medium text-[#1F3864]"
          >
            <span>📦</span> 품목 마스터
          </a>
          <a
            href="/claims"
            className="flex items-center gap-2 bg-white rounded-xl border border-red-200 px-4 py-2.5 hover:bg-red-50 transition-colors text-sm font-medium text-red-700"
          >
            <span>📋</span> 클레임 관리
            {pendingClaimsCount ? (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                {pendingClaimsCount}
              </span>
            ) : null}
          </a>
          <a
            href="/inventory"
            className="flex items-center gap-2 bg-white rounded-xl border border-blue-200 px-4 py-2.5 hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700"
          >
            <span>🏭</span> 창고 재고
            {lowStockCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                부족 {lowStockCount}
              </span>
            )}
          </a>
          <a
            href="/maintenance"
            className="flex items-center gap-2 bg-white rounded-xl border border-orange-200 px-4 py-2.5 hover:bg-orange-50 transition-colors text-sm font-medium text-orange-700"
          >
            <span>🔧</span> 설비 관리
          </a>
          <a
            href="/utility"
            className="flex items-center gap-2 bg-white rounded-xl border border-yellow-200 px-4 py-2.5 hover:bg-yellow-50 transition-colors text-sm font-medium text-yellow-700"
          >
            <span>⚡</span> 유틸리티
            {utilityRisk === "red"    && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">위험</span>}
            {utilityRisk === "yellow" && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">주의</span>}
          </a>
          <a
            href="/settings/kpi"
            className="flex items-center gap-2 bg-white rounded-xl border border-[#1F3864]/20 px-4 py-2.5 hover:bg-[#1F3864]/5 transition-colors text-sm font-medium text-[#1F3864]"
          >
            <span>⚙️</span> KPI 목표 설정
          </a>
          <a
            href="/settings/audit"
            className="flex items-center gap-2 bg-white rounded-xl border border-[#1F3864]/20 px-4 py-2.5 hover:bg-[#1F3864]/5 transition-colors text-sm font-medium text-[#1F3864]"
          >
            <span>📝</span> 감사 로그
          </a>
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
            label="재고 부족 품목"
            value={inventoryRows.length === 0 ? "-" : `${lowStockCount}종`}
            sub={inventoryRows.length === 0 ? "창고 재고 미등록" : `전체 ${inventoryRows.length}개 품목`}
            color={lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}
          />
        </div>

        {/* ─── 오늘의 운영 현황 ────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            📅 오늘의 운영 현황 <span className="text-gray-400 font-normal normal-case ml-1">({today})</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 오늘 납품 현황 */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">🚚 오늘 납품 현황</span>
                <span className="text-xs text-gray-400">{(todayDeliveries ?? []).length}건</span>
              </div>
              {(todayDeliveries ?? []).length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">오늘 납품전표 없음</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(todayDeliveries ?? []).map((d) => {
                    const statusMap: Record<string, { label: string; color: string }> = {
                      shipped:   { label: "배송중",   color: "bg-amber-100 text-amber-700" },
                      delivered: { label: "배송완료", color: "bg-emerald-100 text-emerald-700" },
                      pending:   { label: "대기",     color: "bg-gray-100 text-gray-600" },
                      cancelled: { label: "취소",     color: "bg-red-100 text-red-600" },
                    };
                    const st = statusMap[d.status] ?? { label: d.status, color: "bg-gray-100 text-gray-600" };
                    const itemCount = Array.isArray(d.items) ? d.items.length : 0;
                    return (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🚛</span>
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{d.customer_name}</div>
                            <div className="text-xs text-gray-400">
                              {d.driver ? `기사: ${d.driver}` : "기사 미지정"} · 품목 {itemCount}종
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          <span className="text-sm font-bold text-[#1F3864]">
                            {d.total_amount ? `${(d.total_amount / 10000).toFixed(0)}만` : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 오늘 생산 + 입고 */}
            <div className="flex flex-col gap-3">
              {/* 오늘 생산 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">🏭 오늘 생산</span>
                  <span className="text-xs text-gray-400">{(todayProdLogs ?? []).length}건</span>
                </div>
                {(todayProdLogs ?? []).length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">생산일지 없음</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(todayProdLogs ?? []).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium text-gray-700">{p.product_name}</span>
                          <span className="text-gray-400 ml-1">({p.worker_name})</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-600">{(p.output_qty ?? 0).toLocaleString()}kg</span>
                          {p.issue_note && <div className="text-red-500 text-[10px]">⚠ {p.issue_note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 오늘 농협 입고 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">🐷 오늘 입고</span>
                </div>
                {(todayIntake ?? []).length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">농협 입고 기록 없음</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {(todayIntake ?? []).map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{it.manager_name ?? "담당자"}</span>
                        <span className="font-bold text-[#1F3864]">{it.nh_actual ?? 0}두 입고</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

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
        <CostApprovalSection items={costApprovals ?? []} />

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
