import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ActionItems, { ActionItemRow } from "@/components/ActionItems";
import AlertPanel from "@/components/AlertPanel";
import { DEPT_ORDER, THRESHOLDS } from "@/lib/constants";
import CostApprovalSection from "@/components/CostApprovalSection";
import HygieneCheckDetail from "@/components/HygieneCheckDetail";
import CooCommentBox from "@/components/CooCommentBox";
import { createServerClient } from "@/lib/supabase";
import { alerts } from "@/lib/sampleData";
import { getProducts } from "@/app/actions/products";
import { getExpiryAlerts } from "@/app/actions/expiry";
import { getOverdueSchedules, getSpareParts } from "@/app/actions/preventive-maintenance";
import SectionHeader from "@/components/ui/SectionHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Card from "@/components/ui/Card";

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

  // 유통기한 임박 재고 조회
  let expiryAlertCount = 0;
  try {
    const expiryAlerts = await getExpiryAlerts(30);
    expiryAlertCount = expiryAlerts.length;
  } catch {
    // 테이블 미존재 시 무시
  }

  // 품목별 안전재고 조회
  const allProducts = await getProducts();
  const safetyStockMap = new Map<string, number>();
  for (const p of allProducts) {
    safetyStockMap.set(p.name, p.safety_stock);
  }

  // 예방정비 지연 + 부품 부족 조회
  let overdueMaintenanceCount = 0;
  let lowSparePartsCount = 0;
  try {
    const [overdueSchedules, spareParts] = await Promise.all([
      getOverdueSchedules(),
      getSpareParts(),
    ]);
    overdueMaintenanceCount = overdueSchedules.length;
    lowSparePartsCount = spareParts.filter((p) => p.current_stock < p.min_stock).length;
  } catch {
    // 테이블 미존재 시 무시
  }

  const delayedActions = actionItems.filter((a) => a.status === "지연").length;
  const pendingApprovals = (costApprovals ?? []).length;
  const reportSubmitted = latestByDept.size;
  const pendingReviews = [...latestByDept.values()].filter((r) => r.status === "submitted").length;
  const lowStockCount = inventoryRows.filter((r) => {
    const curr = r.prev_stock + r.incoming_qty - r.outgoing_qty;
    const threshold = safetyStockMap.get(r.product_name) ?? THRESHOLDS.lowStock;
    return curr < threshold;
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
          <StatusBadge tone="blue">COO 전용</StatusBadge>
        </div>

        {/* ─── ① 오늘 한눈에 ──────────────────────────────────── */}
        <section>
          <SectionHeader title="오늘 한눈에" badge={today} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <a href="#approvals" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="✅"
                label="결재 대기"
                value={`${pendingApprovals}건`}
                sub={pendingApprovals > 0 ? "승인 필요" : "모두 처리됨"}
                tone={pendingApprovals > 0 ? "bad" : "good"}
              />
            </a>
            <a href="/claims" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="📋"
                label="클레임"
                value={`${pendingClaimsCount ?? 0}건`}
                sub="미처리 (pending)"
                tone={(pendingClaimsCount ?? 0) > 0 ? "bad" : "good"}
              />
            </a>
            <a href="/inventory" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="🏭"
                label="재고 부족"
                value={inventoryRows.length === 0 ? "-" : `${lowStockCount}건`}
                sub={inventoryRows.length === 0 ? "창고 재고 미등록" : `전체 ${inventoryRows.length}개 품목`}
                tone={lowStockCount > 0 ? "warn" : "good"}
              />
            </a>
            <a href="/maintenance/schedule" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="🔧"
                label="정비 지연"
                value={`${overdueMaintenanceCount}건`}
                sub={lowSparePartsCount > 0 ? `부품 부족 ${lowSparePartsCount}건` : "예방정비 스케줄"}
                tone={overdueMaintenanceCount > 0 ? "warn" : "good"}
              />
            </a>
          </div>
        </section>

        {/* 유통기한 경고 */}
        {expiryAlertCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-orange-800">
                유통기한 임박 품목 {expiryAlertCount}건
              </div>
              <div className="text-xs text-orange-600 mt-0.5">
                30일 이내 유통기한이 도래하는 재고가 있습니다.{" "}
                <a href="/inventory" className="underline font-medium">재고 현황에서 확인</a>
              </div>
            </div>
          </div>
        )}

        {/* ─── ② 결재 대기 상세 ───────────────────────────────── */}
        <div id="approvals">
          <CostApprovalSection items={costApprovals ?? []} />
        </div>

        {/* ─── ③ 오늘의 현장 ──────────────────────────────────── */}
        <section>
          <SectionHeader title="📅 오늘의 현장" badge={today} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 오늘 납품 현황 */}
            <Card className="lg:col-span-2" padding="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">🚚 오늘 납품 현황</span>
                <span className="text-xs text-gray-400">{(todayDeliveries ?? []).length}건</span>
              </div>
              {(todayDeliveries ?? []).length === 0 ? (
                <EmptyState icon="🚚" message="오늘 납품전표 없음" />
              ) : (
                <div className="flex flex-col gap-2">
                  {(todayDeliveries ?? []).map((d) => {
                    const statusMap: Record<string, { label: string; tone: "green" | "yellow" | "red" | "gray" }> = {
                      shipped:   { label: "배송중",   tone: "yellow" },
                      delivered: { label: "배송완료", tone: "green" },
                      pending:   { label: "대기",     tone: "gray" },
                      cancelled: { label: "취소",     tone: "red" },
                    };
                    const st = statusMap[d.status] ?? { label: d.status, tone: "gray" as const };
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
                          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                          <span className="text-sm font-bold text-[#1F3864]">
                            {d.total_amount ? `${(d.total_amount / 10000).toFixed(0)}만` : "-"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 오늘 생산 + 입고 + 위생점검 */}
            <div className="flex flex-col gap-3">
              {/* 오늘 생산 */}
              <Card padding="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">🏭 오늘 생산</span>
                  <span className="text-xs text-gray-400">{(todayProdLogs ?? []).length}건</span>
                </div>
                {(todayProdLogs ?? []).length === 0 ? (
                  <EmptyState message="생산일지 없음" />
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
              </Card>

              {/* 오늘 농협 입고 */}
              <Card padding="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">🐷 오늘 입고</span>
                </div>
                {(todayIntake ?? []).length === 0 ? (
                  <EmptyState message="농협 입고 기록 없음" />
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
              </Card>
            </div>
          </div>

          {/* 오늘 위생점검 */}
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-700">🧤 오늘 위생점검</span>
              {todayHygiene && todayHygiene.length > 0 && (
                <span className="text-xs text-gray-400">클릭하면 항목별 상세 확인</span>
              )}
            </div>
            <HygieneCheckDetail checks={todayHygiene ?? []} />
          </div>
        </section>

        {/* ─── ④ 부서별 주간 보고 + COO 코멘트 ────────────────── */}
        <section>
          <SectionHeader
            title="부서별 주간 보고 검토"
            badge={pendingReviews > 0 ? `검토 대기 ${pendingReviews}건` : undefined}
            badgeColor="amber"
            action={
              <span className="text-xs text-gray-400">
                {reportSubmitted}개 부서 보고 · 코멘트 입력 → CEO 대시보드 즉시 반영
              </span>
            }
          />

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
            <Card padding="p-2">
              <EmptyState
                icon="📭"
                message="아직 팀장이 제출한 보고서가 없습니다"
                hint="각 부서 팀장이 주간 보고서를 제출하면 여기에 나타납니다"
              />
            </Card>
          )}
        </section>

        {/* ─── ⑤ Action Items ─────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Action Items"
            badge={`${actionItems.length}건 · DB`}
            action={
              delayedActions > 0 ? (
                <StatusBadge tone="red">지연 {delayedActions}건</StatusBadge>
              ) : undefined
            }
          />
          <ActionItems items={actionItems} />
        </section>

        {/* ─── ⑥ 재고/유틸리티 현황 ───────────────────────────── */}
        <section>
          <SectionHeader title="재고 · 유틸리티 현황" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <a href="/inventory" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="🏭"
                label="재고 부족 품목"
                value={inventoryRows.length === 0 ? "-" : `${lowStockCount}종`}
                sub={inventoryRows.length === 0 ? "창고 재고 미등록" : `전체 ${inventoryRows.length}개 품목`}
                tone={lowStockCount > 0 ? "warn" : "good"}
              />
            </a>
            <a href="/inventory" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="⏰"
                label="유통기한 임박"
                value={`${expiryAlertCount}건`}
                sub="30일 이내 도래"
                tone={expiryAlertCount > 0 ? "warn" : "good"}
              />
            </a>
            <a href="/maintenance/schedule" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="🔩"
                label="부품 부족"
                value={`${lowSparePartsCount}건`}
                sub="최소 재고 미달"
                tone={lowSparePartsCount > 0 ? "warn" : "good"}
              />
            </a>
            <a href="/utility" className="block hover:opacity-80 transition-opacity">
              <StatCard
                icon="⚡"
                label="유틸리티 비용"
                value={utilityRisk === "red" ? "위험" : utilityRisk === "yellow" ? "주의" : "정상"}
                sub="직전 3개월 평균 대비"
                tone={utilityRisk === "red" ? "bad" : utilityRisk === "yellow" ? "warn" : "good"}
              />
            </a>
          </div>
        </section>

        {/* 긴급 알림 */}
        <section>
          <SectionHeader title="긴급 알림" />
          <AlertPanel alerts={alerts} />
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0 · COO 운영 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
