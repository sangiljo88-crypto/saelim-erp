import KPICard from "@/components/KPICard";
import RevenueChart from "@/components/RevenueChart";
import ActionItems, { ActionItemRow } from "@/components/ActionItems";
import AlertPanel from "@/components/AlertPanel";
import AppHeader from "@/components/AppHeader";
import KPIPeriodSelector from "@/components/KPIPeriodSelector";
import { kpiData, departments as sampleDepts } from "@/lib/sampleData";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { DEPT_ORDER, RAG_DOT, RAG_TEXT, RAG_COLOR } from "@/lib/constants";
import { getKpiTargets } from "@/app/actions/kpi-targets";
import type { KpiTarget } from "@/app/actions/kpi-targets";

// ── 날짜 유틸 ─────────────────────────────────────────────────
function getDateRange(period: string, from?: string, to?: string) {
  const today = new Date().toISOString().split("T")[0];
  const now   = new Date();
  switch (period) {
    case "today":   return { start: today, end: today, label: "오늘" };
    case "week": {
      const d = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon.toISOString().split("T")[0], end: sun.toISOString().split("T")[0], label: "이번 주" };
    }
    case "month": {
      const ym = today.slice(0, 7);
      return { start: `${ym}-01`, end: today, label: `${ym.replace("-", "년 ")}월` };
    }
    case "quarter": {
      const q  = Math.floor(now.getMonth() / 3);
      const sm = String(q * 3 + 1).padStart(2, "0");
      return { start: `${now.getFullYear()}-${sm}-01`, end: today, label: `${now.getFullYear()}년 ${q + 1}분기` };
    }
    case "half": {
      const h  = now.getMonth() < 6 ? 1 : 2;
      const sm = h === 1 ? "01" : "07";
      return { start: `${now.getFullYear()}-${sm}-01`, end: today, label: `${now.getFullYear()}년 ${h}반기` };
    }
    case "custom":
      if (from && to) return { start: from <= to ? from : to, end: from <= to ? to : from, label: `${from} ~ ${to}` };
    default: {
      const ym = today.slice(0, 7);
      return { start: `${ym}-01`, end: today, label: `${ym.replace("-", "년 ")}월` };
    }
  }
}

function getMonthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const [ey, em] = end.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

function getLast6Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}


function fmt억(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000)      return `${Math.round(v / 10_000).toLocaleString()}만`;
  return v.toLocaleString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "ceo") redirect("/login");

  const { period = "month", from, to } = await searchParams;
  const { start, end, label } = getDateRange(period, from, to);
  const months      = getMonthsInRange(start, end);
  const last6Months = getLast6Months();

  const db    = createServerClient();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const nextMonthStart = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  // 이번 주 월요일 계산 (지금 이 순간용)
  const nowDay = new Date().getDay();
  const thisWeekMon = new Date();
  thisWeekMon.setDate(new Date().getDate() - (nowDay === 0 ? 6 : nowDay - 1));
  const thisWeekStart = thisWeekMon.toISOString().split("T")[0];

  const [
    { data: dbActionItems },
    { count: periodClaimsCount },
    { count: pendingClaimsCount },
    { data: yieldRows },
    { data: prodRows },
    { count: todayProdCount },
    { data: deptReports },
    { data: kpiRows },
    { data: chartKpiRows },
    { count: openMaintenanceCount },
    { data: utilityRecent },
    { data: materialPurchases },
    { data: payrollData },
    // ── 지금 이 순간 새림 ──
    { data: todayYieldRows },
    { count: weekClaimsCount },
    { count: pendingApprovalsCount },
  ] = await Promise.all([
    db.from("action_items").select("id,title,dept,deadline,status").order("deadline"),

    // 기간 클레임 수
    db.from("claims").select("*", { count: "exact", head: true })
      .gte("claim_date", start).lte("claim_date", end),

    // 전체 미처리 클레임 수
    db.from("claims").select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    // 기간 수율
    db.from("production_logs").select("yield_rate")
      .gte("work_date", start).lte("work_date", end),

    // 기간 생산 요약
    db.from("production_logs").select("output_qty,input_qty")
      .gte("work_date", start).lte("work_date", end),

    // 오늘 생산일지 수
    db.from("production_logs").select("*", { count: "exact", head: true })
      .eq("work_date", today),

    // 부서 보고서
    db.from("dept_reports")
      .select("dept,rag_status,issue,coo_comment,manager_name,status")
      .order("report_date", { ascending: false }),

    // 기간 monthly_kpi (재무)
    db.from("monthly_kpi")
      .select("year_month,kpi_key,actual,target")
      .eq("dept", "전사")
      .in("year_month", months)
      .in("kpi_key", ["revenue","profit_margin","cash_balance","receivables"]),

    // 차트용 최근 6개월 revenue kpi
    db.from("monthly_kpi")
      .select("year_month,actual,target")
      .eq("dept", "전사")
      .eq("kpi_key", "revenue")
      .in("year_month", last6Months)
      .order("year_month"),

    // 처리중 설비 이슈 수
    db.from("maintenance_logs").select("*", { count: "exact", head: true })
      .eq("result", "진행중"),

    // 유틸리티 최근 3개월 (비용 급증 감지)
    db.from("utility_logs")
      .select("log_month,total_cost")
      .order("log_month", { ascending: false })
      .limit(3),

    // 이번달 원재료 매입 원가
    db.from("material_purchases")
      .select("total_cost, remaining_qty, quantity")
      .gte("purchase_date", `${thisMonth}-01`)
      .lt("purchase_date", nextMonthStart),

    // 이번달 인건비
    db.from("payroll_records")
      .select("total_pay")
      .eq("year_month", thisMonth),

    // 오늘 수율 (지금 이 순간)
    db.from("production_logs").select("yield_rate")
      .eq("work_date", today),

    // 이번 주 클레임 수 (월~오늘, 고정)
    db.from("claims").select("*", { count: "exact", head: true })
      .gte("claim_date", thisWeekStart).lte("claim_date", today),

    // 미결 비용결재 수
    db.from("cost_approvals").select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // ── KPI 목표치 (DB 우선, 없으면 하드코딩 폴백) ─────────────
  // Note: getKpiTargets는 내부에서 별도 DB 연결을 만들어서 위 Promise.all과 자연 병렬
  const dbKpiTargets: KpiTarget[] = await getKpiTargets(new Date().getFullYear(), "전사");
  const kpiTargetMap: Record<string, number> = {};
  for (const t of dbKpiTargets) {
    kpiTargetMap[t.kpi_key] = t.target_value;
  }

  // ── KPI 집계 ─────────────────────────────────────────────
  const kpiByKey: Record<string, number[]> = {};
  const kpiTargetByKey: Record<string, number> = {};
  for (const row of kpiRows ?? []) {
    if (!kpiByKey[row.kpi_key]) kpiByKey[row.kpi_key] = [];
    kpiByKey[row.kpi_key].push(row.actual ?? 0);
    kpiTargetByKey[row.kpi_key] = row.target ?? 0;
  }

  const avg  = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const sum  = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const last = (arr: number[]) => arr.length ? arr[arr.length - 1] : 0;

  function getPeriodScale(p: string, s: string, e: string): number {
    const days = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
    if (p === "today" || p === "week") return days / 30;
    return months.length;
  }
  const periodScale = getPeriodScale(period, start, end);

  const revenue       = kpiByKey["revenue"]?.length      ? sum(kpiByKey["revenue"])      : Math.round(kpiData.revenue.actual * periodScale);
  const revenueTarget = kpiByKey["revenue"]?.length      ? sum((kpiRows ?? []).filter(r => r.kpi_key === "revenue").map(r => r.target ?? 0)) : Math.round(kpiData.revenue.target * periodScale);
  const profitMargin  = kpiByKey["profit_margin"]?.length ? avg(kpiByKey["profit_margin"]) : kpiData.profitMargin.actual;
  const cashBalance   = kpiByKey["cash_balance"]?.length  ? last(kpiByKey["cash_balance"]) : kpiData.cashBalance.actual;
  const receivables   = kpiByKey["receivables"]?.length   ? last(kpiByKey["receivables"])  : kpiData.receivables.actual;
  const fromDB        = (kpiRows?.length ?? 0) > 0;

  // ── 수율 ─────────────────────────────────────────────────
  const avgYield = yieldRows?.length
    ? Math.round(yieldRows.reduce((s, r) => s + (r.yield_rate ?? 0), 0) / yieldRows.length * 10) / 10
    : null;

  // ── 지금 이 순간 새림 집계 ────────────────────────────────
  const todayAvgYield = todayYieldRows?.length
    ? Math.round(todayYieldRows.reduce((s, r) => s + (r.yield_rate ?? 0), 0) / todayYieldRows.length * 10) / 10
    : null;
  const thisWeekClaims = weekClaimsCount ?? 0;
  const pendingApprovals = pendingApprovalsCount ?? 0;

  // ── 생산 요약 ─────────────────────────────────────────────
  const totalOutput  = prodRows?.reduce((s, r) => s + (r.output_qty ?? 0), 0) ?? 0;
  const totalInput   = prodRows?.reduce((s, r) => s + (r.input_qty  ?? 0), 0) ?? 0;
  const prodLogCount = prodRows?.length ?? 0;

  // ── 부서 현황 ─────────────────────────────────────────────
  const latestByDept = new Map<string, { rag_status: string; issue: string; coo_comment: string | null; manager_name: string }>();
  for (const r of deptReports ?? []) {
    if (!latestByDept.has(r.dept)) latestByDept.set(r.dept, r);
  }
  const deptStatus = DEPT_ORDER.map((name) => {
    const dbRow = latestByDept.get(name);
    const sp    = sampleDepts.find((d) => d.name === name);
    return dbRow
      ? { name, rag_status: dbRow.rag_status, issue: dbRow.issue, coo_comment: dbRow.coo_comment ?? "—", fromDB: true }
      : { name, rag_status: sp?.status ?? "green", issue: sp?.issue ?? "—", coo_comment: sp?.comment ?? "—", fromDB: false };
  });

  const redCount       = deptStatus.filter((d) => d.rag_status === "red").length;
  const yellowCount    = deptStatus.filter((d) => d.rag_status === "yellow").length;
  const actionItems: ActionItemRow[] = (dbActionItems ?? []).map((a) => ({
    id: a.id as string, title: a.title, dept: a.dept,
    deadline: a.deadline, status: a.status as ActionItemRow["status"],
  }));
  const delayedActions = actionItems.filter((a) => a.status === "지연").length;

  // ── 매출 추이 차트 (deliveries 자동 동기화된 monthly_kpi) ──
  const chartKpiMap = Object.fromEntries((chartKpiRows ?? []).map((r) => [r.year_month, r]));
  const revenueChartData = last6Months.map((ym) => ({
    month: `${parseInt(ym.slice(5))}월`,
    actual: chartKpiMap[ym]?.actual ?? 0,
    target: chartKpiMap[ym]?.target ?? 1_500_000_000,
  }));
  const hasChartData = revenueChartData.some((d) => d.actual > 0);

  // ── 동적 경고 알림 (실데이터 기반) ───────────────────────
  const dynamicAlerts: { level: string; message: string }[] = [];

  if ((pendingClaimsCount ?? 0) >= 3) {
    dynamicAlerts.push({ level: "red", message: `미처리 클레임 ${pendingClaimsCount}건 — COO 즉시 확인 필요` });
  } else if ((pendingClaimsCount ?? 0) > 0) {
    dynamicAlerts.push({ level: "yellow", message: `미처리 클레임 ${pendingClaimsCount}건 처리 대기 중` });
  }

  if (avgYield !== null && avgYield < 85) {
    dynamicAlerts.push({ level: "red", message: `수율 경고 — ${label} 평균 ${avgYield}% (기준 85% 미달)` });
  }

  if (redCount > 0) {
    dynamicAlerts.push({ level: "red", message: `위험 상태 부서 ${redCount}곳 — 팀별 보고 즉시 확인` });
  }

  if ((openMaintenanceCount ?? 0) > 0) {
    dynamicAlerts.push({ level: "yellow", message: `처리 중인 설비 이슈 ${openMaintenanceCount}건` });
  }

  if (delayedActions > 0) {
    dynamicAlerts.push({ level: "yellow", message: `Action Item 지연 ${delayedActions}건` });
  }

  // 유틸리티 급증 감지 (최신 vs 전전월)
  if (utilityRecent && utilityRecent.length >= 2) {
    const latest = utilityRecent[0]?.total_cost ?? 0;
    const prev   = utilityRecent[1]?.total_cost ?? 0;
    if (prev > 0 && latest / prev >= 1.3) {
      dynamicAlerts.push({
        level: "yellow",
        message: `유틸리티 비용 전월 대비 ${Math.round((latest / prev - 1) * 100)}% 급증 (${fmt억(latest)}원)`,
      });
    }
  }

  // ── 손익 계산 ─────────────────────────────────────────────
  const totalMaterialCost = (materialPurchases ?? []).reduce((s, p) => s + (p.total_cost || 0), 0);
  const totalLaborCost    = (payrollData ?? []).reduce((s, p) => s + (p.total_pay || 0), 0);

  // 이번달 매출 (monthly_kpi revenue, thisMonth 기준)
  const monthRevenue = (kpiRows ?? [])
    .filter((r) => r.kpi_key === "revenue" && r.year_month === thisMonth)
    .reduce((s, r) => s + (r.actual ?? 0), 0);

  // 유틸리티 이번달 비용
  const utilityThisMonth = (utilityRecent ?? []).find((l) => l.log_month === thisMonth);
  const utilityThisMonthCost = utilityThisMonth?.total_cost ?? 0;

  const isSingleMonth = months.length === 1;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="경영 대시보드 · CEO View" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* 기간 선택 */}
        <div className="flex flex-col gap-3">
          <KPIPeriodSelector current={period} currentFrom={from} currentTo={to} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-[#1F3864] text-white text-xs font-semibold px-3 py-1 rounded-full">{label}</span>
            <span className="text-xs text-gray-400">{start === end ? start : `${start} ~ ${end}`}</span>
            {fromDB ? (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                ● 실데이터 연동
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                ⚠ 납품전표 입력 시 자동 반영
              </span>
            )}
            {!isSingleMonth && months.length > 1 && (
              <span className="text-xs text-gray-400">· 매출 {months.length}개월 합계</span>
            )}
            {todayProdCount !== null && todayProdCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                오늘 생산일지 {todayProdCount}건
              </span>
            )}
          </div>
        </div>

        {/* 바로가기 */}
        <div className="flex gap-3 flex-wrap">
          {[
            { href: "/report",      icon: "📋", label: "주간 보고서",  color: "border-[#1F3864]/20 text-[#1F3864] hover:bg-[#1F3864]/5" },
            { href: "/claims",      icon: "⚠️", label: "클레임 관리",  color: "border-red-200 text-red-700 hover:bg-red-50" },
            { href: "/yield",       icon: "📊", label: "수율 현황",    color: "border-blue-200 text-blue-700 hover:bg-blue-50" },
            { href: "/customers",   icon: "🤝", label: "거래처 관리",  color: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
            { href: "/inventory",   icon: "🏭", label: "창고 재고",    color: "border-purple-200 text-purple-700 hover:bg-purple-50" },
            { href: "/maintenance", icon: "🔧", label: "설비 관리",    color: "border-orange-200 text-orange-700 hover:bg-orange-50" },
          ].map((link) => (
            <a key={link.href} href={link.href}
              className={`flex items-center gap-2 bg-white rounded-xl border px-4 py-2.5 transition-colors text-sm font-medium ${link.color}`}>
              <span>{link.icon}</span> {link.label}
            </a>
          ))}
        </div>

        {/* ── 지금 이 순간 새림 ── */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3">📊 지금 이 순간 새림</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* 오늘 수율 */}
            <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${
              todayAvgYield === null ? "bg-white border-gray-200"
              : todayAvgYield >= 92  ? "bg-emerald-50 border-emerald-200"
              : todayAvgYield >= 88  ? "bg-amber-50 border-amber-200"
              :                        "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">오늘 수율</span>
                <span className="text-lg">
                  {todayAvgYield === null ? "⚪" : todayAvgYield >= 92 ? "🟢" : todayAvgYield >= 88 ? "🟡" : "🔴"}
                </span>
              </div>
              <div className={`text-4xl font-black tracking-tight ${
                todayAvgYield === null ? "text-gray-300"
                : todayAvgYield >= 92  ? "text-emerald-600"
                : todayAvgYield >= 88  ? "text-amber-600"
                :                        "text-red-600"
              }`}>
                {todayAvgYield !== null ? `${todayAvgYield}%` : "–"}
              </div>
              <div className={`text-xs font-medium ${
                todayAvgYield === null ? "text-gray-400"
                : todayAvgYield >= 92  ? "text-emerald-600"
                : todayAvgYield >= 88  ? "text-amber-600"
                :                        "text-red-600"
              }`}>
                {todayAvgYield === null ? "오늘 생산 데이터 없음"
                : todayAvgYield >= 92  ? "✅ 목표(92%) 달성"
                : todayAvgYield >= 88  ? "⚠️ 목표 미달 — 확인 필요"
                :                        "🚨 기준(88%) 미달 — 즉시 조치"}
              </div>
            </div>

            {/* 이번 주 클레임 */}
            <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${
              thisWeekClaims === 0 ? "bg-emerald-50 border-emerald-200"
              : thisWeekClaims <= 3 ? "bg-amber-50 border-amber-200"
              :                       "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">이번 주 클레임</span>
                <span className="text-lg">
                  {thisWeekClaims === 0 ? "🟢" : thisWeekClaims <= 3 ? "🟡" : "🔴"}
                </span>
              </div>
              <div className={`text-4xl font-black tracking-tight ${
                thisWeekClaims === 0 ? "text-emerald-600"
                : thisWeekClaims <= 3 ? "text-amber-600"
                :                       "text-red-600"
              }`}>
                {thisWeekClaims}건
              </div>
              <div className={`text-xs font-medium ${
                thisWeekClaims === 0 ? "text-emerald-600"
                : thisWeekClaims <= 3 ? "text-amber-600"
                :                       "text-red-600"
              }`}>
                {thisWeekClaims === 0 ? "✅ 이번 주 클레임 없음"
                : thisWeekClaims <= 3 ? "⚠️ 클레임 처리 확인 필요"
                :                       "🚨 클레임 다수 — 즉시 확인"}
              </div>
            </div>

            {/* 미결 비용결재 */}
            <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${
              pendingApprovals === 0 ? "bg-emerald-50 border-emerald-200"
              :                        "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">미결 비용결재</span>
                <span className="text-lg">{pendingApprovals === 0 ? "🟢" : "🔴"}</span>
              </div>
              <div className={`text-4xl font-black tracking-tight ${
                pendingApprovals === 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                {pendingApprovals}건
              </div>
              <div className={`text-xs font-medium ${
                pendingApprovals === 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                {pendingApprovals === 0 ? "✅ 미결 결재 없음" : "🚨 즉시 처리 필요"}
              </div>
            </div>

          </div>
        </section>

        {/* ── KPI 카드 ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">핵심 지표</h2>
              {session.role === "ceo" && (
                <a
                  href="/settings/kpi"
                  className="text-xs text-[#1F3864] hover:text-[#2a4a7f] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                >
                  ⚙️ 목표 설정
                </a>
              )}
            </div>
            {!fromDB && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                ⚠️ 샘플 데이터 · 회계팀 KPI 입력 시 실제 수치로 대체됩니다
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              title={period === "today" ? "매출 (오늘)" : period === "week" ? "매출 (이번 주)" : months.length > 1 ? `매출 (${months.length}개월 합)` : "매출 (이번 달)"}
              actual={revenue}
              target={revenueTarget || kpiTargetMap["revenue"] || kpiData.revenue.target}
              unit="원"
              icon="💰"
              isGood={revenue >= (revenueTarget || kpiTargetMap["revenue"] || kpiData.revenue.target)}
            />
            <KPICard
              title="영업이익률"
              actual={profitMargin}
              target={kpiTargetByKey["profit_margin"] || kpiTargetMap["profit_margin"] || kpiData.profitMargin.target}
              unit="%"
              icon="📈"
              isGood={profitMargin >= (kpiTargetByKey["profit_margin"] || kpiTargetMap["profit_margin"] || kpiData.profitMargin.target)}
            />
            <KPICard
              title="현금잔고"
              actual={cashBalance}
              target={kpiTargetByKey["cash_balance"] || kpiTargetMap["cash_balance"] || kpiData.cashBalance.target}
              unit="원"
              icon="🏦"
              isGood={cashBalance >= (kpiTargetByKey["cash_balance"] || kpiTargetMap["cash_balance"] || kpiData.cashBalance.target)}
            />
            <KPICard
              title="미수금"
              actual={receivables}
              target={kpiTargetByKey["receivables"] || kpiTargetMap["receivables"] || kpiData.receivables.target}
              unit="원"
              icon="⚠️"
              isGood={receivables <= (kpiTargetByKey["receivables"] || kpiTargetMap["receivables"] || kpiData.receivables.target)}
            />
            <KPICard
              title="클레임"
              actual={periodClaimsCount ?? 0}
              target={kpiTargetMap["claims"] ?? kpiData.claims.target}
              unit="건"
              icon="📋"
              isGood={(periodClaimsCount ?? 0) <= (kpiTargetMap["claims"] ?? kpiData.claims.target)}
            />
            <KPICard
              title="수율"
              actual={avgYield ?? kpiData.yieldRate.actual}
              target={kpiTargetMap["yield"] ?? kpiData.yieldRate.target}
              unit="%"
              icon="🏭"
              isGood={(avgYield ?? kpiData.yieldRate.actual) >= (kpiTargetMap["yield"] ?? kpiData.yieldRate.target)}
            />
          </div>
        </section>

        {/* 이번달 손익 현황 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-bold text-gray-700 mb-4">📊 {thisMonth.replace("-","년 ")}월 손익 현황</div>
          <div className="flex flex-col gap-2">
            {/* 매출 */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">🚚 매출</span>
              <span className="font-bold text-gray-800">
                {monthRevenue > 0 ? `${(monthRevenue / 10000).toLocaleString()}만원` : "—"}
              </span>
            </div>
            {/* 원재료 매입원가 */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">📦 원재료 매입원가</span>
              <span className={`font-bold ${totalMaterialCost > 0 ? "text-red-600" : "text-gray-300"}`}>
                {totalMaterialCost > 0 ? `- ${(totalMaterialCost / 10000).toLocaleString()}만원` : "미입력"}
              </span>
            </div>
            {/* 인건비 */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">👥 인건비</span>
              <span className={`font-bold ${totalLaborCost > 0 ? "text-red-600" : "text-gray-300"}`}>
                {totalLaborCost > 0 ? `- ${(totalLaborCost / 10000).toLocaleString()}만원` : "미입력"}
              </span>
            </div>
            {/* 유틸리티 */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">⚡ 유틸리티</span>
              <span className={`font-bold ${utilityThisMonthCost > 0 ? "text-red-600" : "text-gray-300"}`}>
                {utilityThisMonthCost > 0 ? `- ${(utilityThisMonthCost / 10000).toLocaleString()}만원` : "미입력"}
              </span>
            </div>
            {/* 영업이익 */}
            {monthRevenue > 0 && (
              (() => {
                const knownCosts      = totalMaterialCost + totalLaborCost + utilityThisMonthCost;
                const operatingProfit = monthRevenue - knownCosts;
                const margin          = monthRevenue > 0 ? ((operatingProfit / monthRevenue) * 100).toFixed(1) : "0";
                return (
                  <div className={`flex items-center justify-between py-3 px-3 rounded-xl mt-1 ${operatingProfit >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                    <span className={`text-sm font-bold ${operatingProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {operatingProfit >= 0 ? "✅ 영업이익 (추정)" : "⚠️ 영업손실 (추정)"}
                    </span>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${operatingProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {(operatingProfit / 10000).toLocaleString()}만원
                      </div>
                      <div className="text-xs text-gray-400">이익률 {margin}%</div>
                    </div>
                  </div>
                );
              })()
            )}
            {monthRevenue === 0 && (
              <div className="text-xs text-gray-400 text-center py-2">
                이달 납품전표를 입력하면 손익이 계산됩니다
              </div>
            )}
          </div>
        </section>

        {/* 기간 생산 요약 */}
        {prodLogCount > 0 && (
          <section className="grid grid-cols-3 gap-3">
            {[
              { label: `생산일지 (${label})`, value: `${prodLogCount}건`,               sub: "생산 기록", color: "text-[#1F3864]" },
              { label: "완성품 생산량",        value: `${totalOutput.toLocaleString()}kg`, sub: "기간 합계", color: "text-gray-800" },
              { label: "원료 투입량",          value: `${totalInput.toLocaleString()}kg`,  sub: "기간 합계", color: "text-gray-800" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
              </div>
            ))}
          </section>
        )}

        {/* 매출 추이 + 경고 알림 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">📊 월별 매출 추이 (최근 6개월)</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${hasChartData ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {hasChartData ? "● 납품전표 실데이터" : "납품전표 입력 시 자동 반영"}
              </span>
            </div>
            <RevenueChart data={revenueChartData} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">🚨 경고 알림</h2>
            {dynamicAlerts.length > 0 ? (
              <AlertPanel alerts={dynamicAlerts} />
            ) : (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                <span>✅</span>
                <span>현재 주요 경고 없음</span>
              </div>
            )}
          </div>
        </div>

        {/* 부서별 현황 */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">부서별 현황</h2>
            {redCount    > 0 && <span className="text-xs bg-red-100   text-red-700   px-2 py-0.5 rounded-full font-semibold">경고 {redCount}개</span>}
            {yellowCount > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">주의 {yellowCount}개</span>}
            <span className="text-xs text-gray-400 ml-auto">DB 보고: {latestByDept.size}개 부서</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-[120px_80px_1fr_1fr] text-xs font-semibold text-white bg-[#1F3864] px-5 py-3 gap-4">
              <span>부서</span><span>상태</span><span>이번 주 이슈</span><span>COO 코멘트</span>
            </div>
            {deptStatus.map((d, i) => (
              <div key={d.name}
                className={`grid grid-cols-[120px_80px_1fr_1fr] items-start gap-4 px-5 py-4 text-sm
                  ${i > 0 ? "border-t border-gray-100" : ""}
                  ${d.rag_status === "red" ? "bg-red-50" : d.rag_status === "yellow" ? "bg-amber-50" : ""}`}>
                <div>
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  {d.fromDB
                    ? <div className="text-[10px] text-emerald-600 font-medium">● 팀장 보고</div>
                    : <div className="text-[10px] text-gray-400 font-medium">○ 샘플</div>
                  }
                </div>
                <span className={`font-semibold ${RAG_COLOR[d.rag_status] ?? "text-gray-600"}`}>
                  {RAG_DOT[d.rag_status]} {RAG_TEXT[d.rag_status]}
                </span>
                <span className="text-gray-700">{d.issue}</span>
                <span className={`italic ${d.coo_comment && d.coo_comment !== "—" ? "text-[#1F3864] font-medium not-italic" : "text-gray-400"}`}>
                  {d.coo_comment}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Action Items */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              주요 Action Items
              <span className="ml-2 text-gray-400 font-normal normal-case">({actionItems.length}건)</span>
            </h2>
            {delayedActions > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">지연 {delayedActions}건</span>
            )}
          </div>
          <ActionItems items={actionItems} />
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · CEO 대시보드 · 납품전표 저장 시 매출 자동 반영 · 경고는 실데이터 기반
        </footer>
      </main>
    </div>
  );
}
