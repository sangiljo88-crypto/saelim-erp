import KPICard from "@/components/KPICard";
import RevenueChart from "@/components/RevenueChart";
import ActionItems, { ActionItemRow } from "@/components/ActionItems";
import AlertPanel from "@/components/AlertPanel";
import AppHeader from "@/components/AppHeader";
import KPIPeriodSelector from "@/components/KPIPeriodSelector";
import { kpiData, departments as sampleDepts, monthlyRevenue, alerts } from "@/lib/sampleData";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

// ── 날짜 유틸 ───────────────────────────────────────────────
function getDateRange(period: string, from?: string, to?: string) {
  const today = new Date().toISOString().split("T")[0];
  const now   = new Date();
  switch (period) {
    case "today":
      return { start: today, end: today, label: "오늘" };
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
      return { start: `${now.getFullYear()}-${sm}-01`, end: today, label: `${now.getFullYear()}년 ${q+1}분기` };
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

// 기간에 포함된 YYYY-MM 목록 반환
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

const RAG_DOT:   Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴" };
const RAG_TEXT:  Record<string, string> = { green: "정상", yellow: "주의", red: "경고" };
const RAG_COLOR: Record<string, string> = { green: "text-emerald-600", yellow: "text-amber-600", red: "text-red-600" };
const DEPT_ORDER = ["생산팀","가공팀","스킨팀","재고팀","품질팀","배송팀","CS팀","마케팅팀","회계팀","온라인팀","개발팀"];

// 억 단위 포맷
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
  const months = getMonthsInRange(start, end);

  const db    = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: dbActionItems },
    { count: periodClaimsCount },
    { data: yieldRows },
    { data: prodRows },
    { count: todayProdCount },
    { data: deptReports },
    { data: kpiRows },
  ] = await Promise.all([
    db.from("action_items").select("id,title,dept,deadline,status").order("deadline"),
    // 기간 클레임 수
    db.from("claims").select("*", { count: "exact", head: true })
      .gte("claim_date", start).lte("claim_date", end),
    // 기간 수율
    db.from("production_logs").select("yield_rate")
      .gte("work_date", start).lte("work_date", end),
    // 기간 생산 요약
    db.from("production_logs").select("output_qty,input_qty")
      .gte("work_date", start).lte("work_date", end),
    // 오늘 생산일지 수
    db.from("production_logs").select("*", { count: "exact", head: true }).eq("work_date", today),
    // 부서 보고서
    db.from("dept_reports")
      .select("dept,rag_status,issue,coo_comment,manager_name,status")
      .order("report_date", { ascending: false }),
    // monthly_kpi (선택 기간 월별)
    db.from("monthly_kpi")
      .select("year_month,kpi_key,actual,target")
      .eq("dept", "전사")
      .in("year_month", months)
      .in("kpi_key", ["revenue","profit_margin","cash_balance","receivables"]),
  ]);

  // ── monthly_kpi 집계 ──────────────────────────────────────
  const kpiByKey: Record<string, number[]> = {};
  for (const row of kpiRows ?? []) {
    if (!kpiByKey[row.kpi_key]) kpiByKey[row.kpi_key] = [];
    kpiByKey[row.kpi_key].push(row.actual ?? 0);
  }
  const kpiTargetByKey: Record<string, number> = {};
  for (const row of kpiRows ?? []) {
    kpiTargetByKey[row.kpi_key] = row.target ?? 0;
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const last = (arr: number[]) => arr.length ? arr[arr.length - 1] : 0;

  // 샘플데이터 스케일: period별 비율 (1개월 = 1.0, 오늘 ≈ 1/30, 이번주 = 7/30)
  function getPeriodScale(p: string, s: string, e: string): number {
    const days = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
    if (p === "today") return days / 30;
    if (p === "week")  return days / 30;
    return months.length;
  }
  const periodScale = getPeriodScale(period, start, end);

  // 매출: 기간 합계 (여러 달은 SUM)
  const revenue       = kpiByKey["revenue"]?.length      ? sum(kpiByKey["revenue"])      : Math.round(kpiData.revenue.actual * periodScale);
  const revenueTarget = kpiByKey["revenue"]?.length      ? sum(kpiRows?.filter(r=>r.kpi_key==="revenue").map(r=>r.target??0) ?? []) : Math.round(kpiData.revenue.target * periodScale);
  // 이익률: 기간 평균
  const profitMargin  = kpiByKey["profit_margin"]?.length ? avg(kpiByKey["profit_margin"]) : kpiData.profitMargin.actual;
  // 현금잔고: 최신 월 값
  const cashBalance   = kpiByKey["cash_balance"]?.length  ? last(kpiByKey["cash_balance"]) : kpiData.cashBalance.actual;
  // 미수금: 최신 월 값
  const receivables   = kpiByKey["receivables"]?.length   ? last(kpiByKey["receivables"])  : kpiData.receivables.actual;

  const fromDB = (kpiRows?.length ?? 0) > 0; // monthly_kpi 데이터 있는지 여부

  // 수율
  const avgYield = yieldRows?.length
    ? Math.round(yieldRows.reduce((s,r) => s+(r.yield_rate??0), 0) / yieldRows.length * 10) / 10
    : null;

  // 생산 요약
  const totalOutput  = prodRows?.reduce((s,r) => s+(r.output_qty??0), 0) ?? 0;
  const totalInput   = prodRows?.reduce((s,r) => s+(r.input_qty ??0), 0) ?? 0;
  const prodLogCount = prodRows?.length ?? 0;

  // 부서 현황
  const latestByDept = new Map<string, { rag_status:string; issue:string; coo_comment:string|null; manager_name:string }>();
  for (const r of deptReports ?? []) {
    if (!latestByDept.has(r.dept)) latestByDept.set(r.dept, r);
  }

  const deptStatus = DEPT_ORDER.map((name) => {
    const db = latestByDept.get(name);
    const sp = sampleDepts.find((d) => d.name === name);
    return db
      ? { name, rag_status: db.rag_status, issue: db.issue, coo_comment: db.coo_comment ?? "—", fromDB: true }
      : { name, rag_status: sp?.status ?? "green", issue: sp?.issue ?? "—", coo_comment: sp?.comment ?? "—", fromDB: false };
  });

  const actionItems: ActionItemRow[] = (dbActionItems ?? []).map((a) => ({
    id: a.id as string, title: a.title, dept: a.dept,
    deadline: a.deadline, status: a.status as ActionItemRow["status"],
  }));

  const delayedActions = actionItems.filter((a) => a.status === "지연").length;
  const redCount    = deptStatus.filter((d) => d.rag_status === "red").length;
  const yellowCount = deptStatus.filter((d) => d.rag_status === "yellow").length;

  const isSingleMonth = months.length === 1;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="경영 대시보드 · CEO View" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* 기간 선택 */}
        <div className="flex flex-col gap-3">
          <KPIPeriodSelector current={period} currentFrom={from} currentTo={to} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-[#1F3864] text-white text-xs font-semibold px-3 py-1 rounded-full">
              {label}
            </span>
            <span className="text-xs text-gray-400">{start === end ? start : `${start} ~ ${end}`}</span>
            {fromDB ? (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                ● DB 실데이터 ({months.length}개월)
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                ⚠ 샘플 데이터 — Supabase에서 simulation_data.sql 실행 필요
              </span>
            )}
            {!isSingleMonth && months.length > 1 && (
              <span className="text-xs text-gray-400">
                · 매출 {months.length}개월 합계 / 이익률 평균
              </span>
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
          <a href="/products"
            className="flex items-center gap-2 bg-white rounded-xl border border-[#1F3864]/20 px-4 py-2.5 hover:bg-[#1F3864]/5 transition-colors text-sm font-medium text-[#1F3864]">
            <span>📦</span> 품목 마스터
          </a>
          <a href="/claims"
            className="flex items-center gap-2 bg-white rounded-xl border border-red-200 px-4 py-2.5 hover:bg-red-50 transition-colors text-sm font-medium text-red-700">
            <span>📋</span> 클레임 관리
          </a>
          <a href="/inventory"
            className="flex items-center gap-2 bg-white rounded-xl border border-blue-200 px-4 py-2.5 hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700">
            <span>🏭</span> 창고 재고
          </a>
          <a href="/maintenance"
            className="flex items-center gap-2 bg-white rounded-xl border border-orange-200 px-4 py-2.5 hover:bg-orange-50 transition-colors text-sm font-medium text-orange-700">
            <span>🔧</span> 설비 관리
          </a>
          <a href="/utility"
            className="flex items-center gap-2 bg-white rounded-xl border border-yellow-200 px-4 py-2.5 hover:bg-yellow-50 transition-colors text-sm font-medium text-yellow-700">
            <span>⚡</span> 유틸리티
          </a>
        </div>

        {/* ── KPI 카드 ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">핵심 지표</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              title={period === "today" ? "매출 (오늘)" : period === "week" ? "매출 (이번 주)" : months.length > 1 ? `매출 (${months.length}개월 합)` : "매출 (이번 달)"}
              actual={revenue}
              target={revenueTarget || kpiData.revenue.target}
              unit="원"
              icon="💰"
              isGood={revenue >= (revenueTarget || kpiData.revenue.target)}
            />
            <KPICard
              title="영업이익률"
              actual={profitMargin}
              target={kpiTargetByKey["profit_margin"] || kpiData.profitMargin.target}
              unit="%"
              icon="📈"
              isGood={profitMargin >= (kpiTargetByKey["profit_margin"] || kpiData.profitMargin.target)}
            />
            <KPICard
              title="현금잔고"
              actual={cashBalance}
              target={kpiTargetByKey["cash_balance"] || kpiData.cashBalance.target}
              unit="원"
              icon="🏦"
              isGood={cashBalance >= (kpiTargetByKey["cash_balance"] || kpiData.cashBalance.target)}
            />
            <KPICard
              title="미수금"
              actual={receivables}
              target={kpiTargetByKey["receivables"] || kpiData.receivables.target}
              unit="원"
              icon="⚠️"
              isGood={receivables <= (kpiTargetByKey["receivables"] || kpiData.receivables.target)}
            />
            <KPICard
              title="클레임"
              actual={periodClaimsCount ?? 0}
              target={kpiData.claims.target}
              unit="건"
              icon="📋"
              isGood={(periodClaimsCount ?? 0) <= kpiData.claims.target}
            />
            <KPICard
              title="수율"
              actual={avgYield ?? kpiData.yieldRate.actual}
              target={kpiData.yieldRate.target}
              unit="%"
              icon="🏭"
              isGood={(avgYield ?? kpiData.yieldRate.actual) >= kpiData.yieldRate.target}
            />
          </div>
        </section>

        {/* 기간 생산 요약 카드 */}
        {prodLogCount > 0 && (
          <section className="grid grid-cols-3 gap-3">
            {[
              { label: `생산일지 (${label})`, value: `${prodLogCount}건`,                  sub: "DB 실데이터", color: "text-[#1F3864]" },
              { label: "완성품 총 생산량",    value: `${totalOutput.toLocaleString()}kg`,  sub: "기간 합계",   color: "text-gray-800" },
              { label: "원료 총 투입량",      value: `${totalInput.toLocaleString()}kg`,   sub: "기간 합계",   color: "text-gray-800" },
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
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 월별 매출 추이 (최근 6개월)</h2>
            <RevenueChart data={monthlyRevenue} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">🚨 경고 알림</h2>
            <AlertPanel alerts={alerts} />
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
              <div key={d.name} className={`grid grid-cols-[120px_80px_1fr_1fr] items-start gap-4 px-5 py-4 text-sm ${i > 0 ? "border-t border-gray-100" : ""} ${d.rag_status === "red" ? "bg-red-50" : d.rag_status === "yellow" ? "bg-amber-50" : ""}`}>
                <div>
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  {d.fromDB && <div className="text-[10px] text-emerald-600 font-medium">● 팀장 보고</div>}
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
              <span className="ml-2 text-gray-400 font-normal normal-case">({actionItems.length}건 · DB)</span>
            </h2>
            {delayedActions > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">지연 {delayedActions}건</span>
            )}
          </div>
          <ActionItems items={actionItems} />
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0 · 재무KPI: monthly_kpi 실데이터 / 클레임·수율·생산량: Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
