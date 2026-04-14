import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import HygieneCheckDetail from "@/components/HygieneCheckDetail";
import TeamTodoList from "@/components/TeamTodoList";
import DeptReportForm from "@/components/DeptReportForm";
import WorkOrderForm from "@/components/WorkOrderForm";
import HeadWorkLogForm from "@/components/HeadWorkLogForm";
import LivestockIntakeForm from "@/components/LivestockIntakeForm";
import WaterUsageForm from "@/components/WaterUsageForm";
import ContainerInventoryForm from "@/components/ContainerInventoryForm";
import FrozenInventoryForm from "@/components/FrozenInventoryForm";
import QualityPatrolForm from "@/components/QualityPatrolForm";
import AuditChecklistForm from "@/components/AuditChecklistForm";
import ProductionPlanForm from "@/components/ProductionPlanForm";
import { createServerClient } from "@/lib/supabase";
import CustomerListView from "@/components/CustomerListView";
import TeamClaimsSection from "@/components/TeamClaimsSection";
import MonthlyKpiForm from "@/components/MonthlyKpiForm";

type KPI = { label: string; value: string; target: string; ok: boolean };
type Todo = { text: string; defaultDone?: boolean };

const deptData: Record<string, { kpis: KPI[]; todos: Todo[] }> = {
  "생산팀": {
    kpis: [
      { label: "오늘 머리 입고",    value: "-",     target: "300두 이상", ok: true },
      { label: "이번 달 처리 두수",  value: "-",     target: "8,000두",   ok: true },
      { label: "수율 목표",          value: "-",     target: "92%",        ok: true },
      { label: "설비 가동률",        value: "94.1%", target: "95%",        ok: false },
    ],
    todos: [
      { text: "두/내장 작업일지 작성" },
      { text: "농협 입고 두수 확인·기록" },
      { text: "수도 검침값 입력" },
      { text: "생산계획 공유 (당일/익일)" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "가공팀": {
    kpis: [
      { label: "오늘 작업 지시 품목",  value: "-",    target: "-",     ok: true },
      { label: "이번 달 평균 로스율",  value: "-",    target: "5% 이하", ok: true },
      { label: "당일 목표 달성율",     value: "-",    target: "100%",  ok: true },
      { label: "지방 로스 관리",       value: "-",    target: "기준치", ok: true },
    ],
    todos: [
      { text: "업무지시서 작성 (개발이사)" },
      { text: "당일 생산량·로스율 확인" },
      { text: "포장재 재고 점검" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "스킨팀": {
    kpis: [
      { label: "오늘 스킨 작업량",    value: "-",    target: "-",   ok: true },
      { label: "생산 수율",            value: "-",    target: "90%", ok: true },
      { label: "냉동 입고 현황",       value: "-",    target: "-",   ok: true },
      { label: "설비 이상 여부",       value: "정상", target: "이상없음", ok: true },
    ],
    todos: [
      { text: "스킨 작업일지 작성" },
      { text: "익일 생산 계획 확인" },
      { text: "냉동 보관 온도 점검" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "재고팀": {
    kpis: [
      { label: "냉동 재고 품목",   value: "-",  target: "-",      ok: true },
      { label: "냉장 재고 현황",   value: "-",  target: "-",      ok: true },
      { label: "재고 회전율",      value: "-",  target: "7일 이내", ok: true },
      { label: "부족 품목",        value: "0건", target: "0건",   ok: true },
    ],
    todos: [
      { text: "일일 냉동냉장 재고 현황 입력" },
      { text: "컨테이너 재고 이상 품목 보고" },
      { text: "월말 실사 준비 (재고 실사)" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "품질팀": {
    kpis: [
      { label: "부적합품 발생율",   value: "0.8%", target: "1.0%",   ok: true },
      { label: "HACCP 자체점검",    value: "-",    target: "월 1회", ok: true },
      { label: "클레임 처리율",     value: "100%", target: "100%",   ok: true },
      { label: "순찰 이슈 건수",    value: "0건",  target: "0건",    ok: true },
    ],
    todos: [
      { text: "오전 현장 순찰 실시" },
      { text: "HACCP 체크리스트 점검" },
      { text: "냉장·냉동 온도 기록 확인" },
      { text: "클레임 처리 현황 업데이트" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "마케팅팀": {
    kpis: [
      { label: "신규 거래처",       value: "2건",   target: "월 2건",   ok: true  },
      { label: "단가 재협상 진행",  value: "1건",   target: "-",        ok: true  },
      { label: "이번 달 수주 목표", value: "진행중", target: "1.8억",   ok: true  },
      { label: "제안서 발송",       value: "4건",   target: "월 4건",   ok: true  },
    ],
    todos: [
      { text: "BHC 단가 재협상 자료 완성" },
      { text: "신규 거래처 미팅 일정 조율" },
      { text: "4월 영업 실적 정리" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "회계팀": {
    kpis: [
      { label: "미수금 현황",      value: "3.8억", target: "2억 이하", ok: false },
      { label: "90일 초과",        value: "2건",   target: "0건",      ok: false },
      { label: "이번 달 매출",     value: "집계중", target: "18.3억",  ok: true  },
      { label: "비용 처리 완료율", value: "95%",   target: "100%",     ok: false },
    ],
    todos: [
      { text: "90일 초과 미수금 거래처 연락" },
      { text: "4월 세금계산서 발행 확인" },
      { text: "비용 결재 서류 정리" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "배송팀": {
    kpis: [
      { label: "납기 준수율",   value: "98.6%", target: "99%",   ok: false },
      { label: "배송 건수",     value: "142건", target: "150건", ok: false },
      { label: "반품 건수",     value: "1건",   target: "0건",   ok: false },
      { label: "차량 가동률",   value: "100%",  target: "100%",  ok: true  },
    ],
    todos: [
      { text: "냉장 차량 온도 점검" },
      { text: "4월 2주차 배송 스케줄 확인" },
      { text: "반품 건 원인 분석 보고" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "CS팀": {
    kpis: [
      { label: "클레임 접수",     value: "3건",    target: "월 2건 이하", ok: false },
      { label: "평균 처리 시간",  value: "31시간", target: "24시간",      ok: false },
      { label: "처리 완료율",     value: "100%",   target: "100%",        ok: true  },
      { label: "고객 만족도",     value: "4.1/5",  target: "4.5/5",       ok: false },
    ],
    todos: [
      { text: "미처리 클레임 현황 점검" },
      { text: "CS 처리 매뉴얼 보완 초안 작성" },
      { text: "고객사 피드백 정리" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "온라인팀": {
    kpis: [
      { label: "쿠팡 ROAS",     value: "312%",    target: "250%",    ok: true  },
      { label: "온라인 매출",   value: "2,400만", target: "2,000만", ok: true  },
      { label: "광고비 집행율", value: "87%",     target: "100%",    ok: false },
      { label: "신규 SKU 등록", value: "2건",     target: "월 3건",  ok: false },
    ],
    todos: [
      { text: "쿠팡 광고 예산 증액 요청서 작성" },
      { text: "4월 프로모션 기획안 제출" },
      { text: "신규 상품 상세페이지 작성" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
  "개발팀": {
    kpis: [
      { label: "육수 신제품",     value: "2주 지연", target: "4/12 완료", ok: false },
      { label: "포장재 승인",     value: "진행중",   target: "완료",      ok: false },
      { label: "진행 중 개발건",  value: "2건",      target: "-",         ok: true  },
      { label: "가공팀 업무지시", value: "매일",     target: "당일 완료", ok: true  },
    ],
    todos: [
      { text: "가공팀 업무지시서 작성 (매일)" },
      { text: "육수 신제품 포장재 승인 재추진" },
      { text: "레시피 최종 검토 완료" },
      { text: "주간 보고서 COO에게 제출" },
    ],
  },
};

// ── 부서별 표시 섹션 설정 ────────────────────────────────────
const SHOW_MONTHLY_KPI   = new Set(["회계팀"]);                // 월간 KPI 입력
const SHOW_PRODUCT_MASTER = new Set(["재고팀", "회계팀", "개발팀"]);
const SHOW_WORK_ORDER  = new Set(["개발팀", "가공팀"]);   // 업무지시서
const SHOW_HEAD_WORK   = new Set(["생산팀"]);              // 두/내장 작업일지
const SHOW_LIVESTOCK   = new Set(["생산팀"]);              // 농협 입고두수
const SHOW_WATER       = new Set(["생산팀"]);              // 수도사용량
const SHOW_INVENTORY   = new Set(["재고팀"]);              // 컨테이너재고
const SHOW_PATROL      = new Set(["품질팀"]);              // 순찰일지
const SHOW_AUDIT       = new Set(["품질팀"]);              // 오딧체크리스트
const SHOW_PLAN        = new Set(["생산팀", "스킨팀"]);    // 생산계획
const SHOW_PROD_LOG    = new Set(["생산팀", "가공팀", "스킨팀"]);
const SHOW_HYGIENE     = new Set(["생산팀", "품질팀", "배송팀", "가공팀", "스킨팀"]);
const SHOW_CLAIMS      = new Set(["품질팀", "CS팀", "배송팀"]);
const SHOW_CUSTOMERS   = new Set(["마케팅팀"]);            // 거래처 현황
const SHOW_DELIVERIES  = new Set(["배송팀"]);              // 납품전표

export default async function TeamPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/login");

  const dept = session.dept ?? "";
  const data = deptData[dept] ?? {
    kpis: [
      { label: "주간 목표",  value: "-",    target: "-",    ok: true },
      { label: "월간 실적",  value: "-",    target: "-",    ok: true },
      { label: "이슈 건수",  value: "0건",  target: "0건",  ok: true },
      { label: "완료율",     value: "100%", target: "100%", ok: true },
    ],
    todos: [{ text: "주간 보고서 COO에게 제출" }],
  };

  const db = createServerClient();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);
  const monthStart = `${thisMonth}-01`;

  const showProductMaster = SHOW_PRODUCT_MASTER.has(dept);
  const showProdLog   = SHOW_PROD_LOG.has(dept);
  const showHygiene   = SHOW_HYGIENE.has(dept);
  const showClaims    = SHOW_CLAIMS.has(dept);
  const showWorkOrder = SHOW_WORK_ORDER.has(dept);
  const showHeadWork  = SHOW_HEAD_WORK.has(dept);
  const showLivestock = SHOW_LIVESTOCK.has(dept);
  const showWater     = SHOW_WATER.has(dept);
  const showInventory = SHOW_INVENTORY.has(dept);
  const showPatrol    = SHOW_PATROL.has(dept);
  const showAudit     = SHOW_AUDIT.has(dept);
  const showPlan      = SHOW_PLAN.has(dept);
  const showCustomers   = SHOW_CUSTOMERS.has(dept);
  const showDeliveries  = SHOW_DELIVERIES.has(dept);
  const showMonthlyKpi  = SHOW_MONTHLY_KPI.has(dept);

  const [
    prodLogsRes,
    monthProdRes,
    hygieneRes,
    claimsRes,
    reportRes,
    headWorkRes,
    livestockRes,
    waterRes,
    workOrderRes,
    planRes,
    workersRes,
    patrolRes,
    inventoryRes,
    frozenPrevRes,
    customersRes,
    deliveriesRes,
    monthlyKpiRes,
  ] = await Promise.all([
    showProdLog
      ? db.from("production_logs").select("id, worker_name, product_name, output_qty, yield_rate, created_at")
          .eq("dept", dept).eq("work_date", today).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    showProdLog
      ? db.from("production_logs").select("yield_rate, output_qty").eq("dept", dept).gte("work_date", monthStart)
      : Promise.resolve({ data: null }),
    showHygiene
      ? db.from("hygiene_checks").select("worker_name, dept, all_passed, items, created_at")
          .eq("dept", dept).eq("check_date", today).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    showClaims
      ? db.from("claims").select("id, client_name, claim_type, claim_date, content, product_names, status, created_at")
          .eq("dept", dept).gte("claim_date", monthStart).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    db.from("dept_reports").select("id, report_date, rag_status, issue, detail, next_action, status, coo_comment, coo_updated_at")
      .eq("dept", dept).order("report_date", { ascending: false }).limit(1),
    showHeadWork
      ? db.from("head_work_logs").select("work_date, head_received, head_items, innard_items, notes, manager_name")
          .order("work_date", { ascending: false }).limit(3)
      : Promise.resolve({ data: null }),
    showLivestock
      ? db.from("livestock_intake").select("intake_date, nh_ledger, nh_actual, mokwuchon")
          .order("intake_date", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    showWater
      ? db.from("water_usage").select("usage_date, water_reading, ground_water_reading")
          .order("usage_date", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    showWorkOrder
      ? db.from("work_orders").select("order_date, ordered_by, workers, items, work_hours")
          .order("order_date", { ascending: false }).limit(3)
      : Promise.resolve({ data: null }),
    showPlan
      ? db.from("production_plans").select("plan_date, manager, today_plans, next_plans, notes")
          .order("plan_date", { ascending: false }).limit(2)
      : Promise.resolve({ data: null }),
    showPlan
      ? db.from("members").select("name").eq("dept", dept).eq("role", "worker").eq("active", true).order("name")
      : Promise.resolve({ data: null }),
    showPatrol
      ? db.from("quality_patrol").select("patrol_date, patrol_time, inspector, areas, issues, overall_status")
          .order("patrol_date", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    showInventory
      ? db.from("container_inventory").select("inventory_date, location, product_name, unit, prev_stock, incoming_qty, outgoing_qty")
          .eq("inventory_date", today).order("location")
      : Promise.resolve({ data: null }),
    showInventory
      ? db.from("frozen_inventory")
          .select("section, product_name, current_stock")
          .lt("inventory_date", today)
          .order("inventory_date", { ascending: false })
      : Promise.resolve({ data: null }),
    showCustomers
      ? db.from("customers").select("id, name, type, contact_name, phone, monthly_avg, payment_terms, active, products, memo")
          .eq("active", true).order("monthly_avg", { ascending: false })
      : Promise.resolve({ data: null }),
    showDeliveries
      ? db.from("deliveries").select("id, delivery_date, customer_name, total_amount, status, driver, items")
          .order("delivery_date", { ascending: false }).limit(10)
      : Promise.resolve({ data: null }),
    // 회계팀: 이번 달 monthly_kpi 기존 값
    showMonthlyKpi
      ? db.from("monthly_kpi")
          .select("kpi_key, actual")
          .eq("dept", "전사")
          .eq("year_month", thisMonth)
          .in("kpi_key", ["profit_margin", "cash_balance", "receivables", "revenue"])
      : Promise.resolve({ data: null }),
  ]);

  const todayProdLogs  = prodLogsRes.data;
  const monthProdLogs  = monthProdRes.data;
  const todayHygiene   = hygieneRes.data;
  const monthClaims    = claimsRes.data;
  const latestReport   = reportRes.data?.[0] ?? null;
  const recentHeadWork = headWorkRes.data;
  const recentLivestock = livestockRes.data;
  const recentWater    = waterRes.data;
  const recentWorkOrders = workOrderRes.data;
  const recentPlans    = planRes.data;
  const recentPatrols  = patrolRes.data;
  const todayInventory = inventoryRes.data;
  const customerList   = customersRes.data;
  const recentDeliveries = deliveriesRes.data;

  // 회계팀 KPI 기존값
  const kpiMap = Object.fromEntries(
    ((monthlyKpiRes.data ?? []) as Array<{ kpi_key: string; actual: number }>)
      .map((r) => [r.kpi_key, r.actual])
  );
  const existingKpi = {
    profit_margin: kpiMap["profit_margin"] ?? null,
    cash_balance:  kpiMap["cash_balance"]  ?? null,
    receivables:   kpiMap["receivables"]   ?? null,
    revenue:       kpiMap["revenue"]       ?? null,
  };
  const teamWorkers = (workersRes.data ?? []).map((w: { name: string }) => w.name);
  // 전일 기준 최신 재고 (각 품목별 가장 최근 날짜 1건)
  const frozenPrevMap = new Map<string, number>();
  for (const row of (frozenPrevRes.data ?? []) as unknown as { section: string; product_name: string; current_stock: number }[]) {
    const key = `${row.section}||${row.product_name}`;
    if (!frozenPrevMap.has(key)) frozenPrevMap.set(key, row.current_stock);
  }
  const frozenPrevData = Array.from(frozenPrevMap.entries()).map(([k, v]) => {
    const [section, product_name] = k.split("||");
    return { section, product_name, current_stock: v };
  });

  const avgYield = monthProdLogs && monthProdLogs.length > 0
    ? (monthProdLogs.reduce((s, r) => s + (r.yield_rate ?? 0), 0) / monthProdLogs.length).toFixed(1)
    : null;
  const totalOutput = monthProdLogs?.reduce((s, r) => s + (r.output_qty ?? 0), 0) ?? 0;
  const claimCount  = monthClaims?.length ?? 0;

  const kpis = dept === "생산팀" && avgYield
    ? data.kpis.map((k) => k.label === "수율 목표"
        ? { ...k, label: "이번 달 평균 수율", value: `${avgYield}%`, ok: Number(avgYield) >= 92 }
        : k)
    : data.kpis;

  const deptIcon: Record<string, string> = {
    "생산팀": "🏭", "가공팀": "⚙️", "스킨팀": "🔪", "재고팀": "📦",
    "품질팀": "🔍", "마케팅팀": "📊", "회계팀": "💰", "배송팀": "🚚",
    "CS팀": "📞", "온라인팀": "🛒", "개발팀": "🧪",
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle={`${dept} 관리`} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{deptIcon[dept] ?? "🏢"} {dept} 현황</h1>
            <p className="text-sm text-gray-500">{thisMonth.replace("-", "년 ")}월 · 팀장/관리자 뷰</p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold">팀장 전용</span>
        </div>

        {/* 품목 마스터 링크 (재고팀 / 회계팀 / 개발팀) */}
        {showProductMaster && (
          <section>
            <a
              href="/products"
              className="flex items-center justify-between bg-white rounded-xl border border-[#1F3864]/20 px-5 py-3.5 hover:bg-[#1F3864]/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📦</span>
                <div>
                  <div className="text-sm font-semibold text-[#1F3864]">품목 마스터 관리</div>
                  <div className="text-xs text-gray-400">전체 품목 조회·편집·엑셀 업/다운로드</div>
                </div>
              </div>
              <span className="text-[#1F3864] group-hover:translate-x-0.5 transition-transform text-sm">→</span>
            </a>
          </section>
        )}

        {/* ① 주간 보고서 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">주간 보고서</h2>
            <span className="text-xs text-gray-400">→ COO 검토 → CEO 대시보드</span>
          </div>
          <DeptReportForm dept={dept} existing={latestReport} />
        </section>

        {/* ② KPI 카드 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">핵심 지표</h2>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-xl border p-4 bg-white ${!kpi.ok ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
                <div className={`text-xl font-bold ${kpi.ok ? "text-gray-800" : "text-red-600"}`}>{kpi.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">목표: {kpi.target}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ③ 개발팀/가공팀: 업무지시서 */}
        {showWorkOrder && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">가공팀 업무지시서</h2>
            <WorkOrderForm />
            {recentWorkOrders && recentWorkOrders.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">최근 업무지시 이력</div>
                {recentWorkOrders.map((wo) => (
                  <div key={wo.order_date} className="px-4 py-3 border-b border-gray-100 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-700">{wo.order_date}</span>
                      <span className="text-xs text-gray-400">{wo.work_hours} · {wo.ordered_by}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      품목: {(wo.items as Array<{ product: string }>).map((it) => it.product).filter(Boolean).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ④ 생산팀: 두/내장 작업일지 */}
        {showHeadWork && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">두 / 내장 작업일지</h2>
            <HeadWorkLogForm />
            {recentHeadWork && recentHeadWork.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">최근 작업 이력</div>
                {recentHeadWork.map((hw) => (
                  <div key={hw.work_date} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 text-xs">
                    <span className="font-medium text-gray-700">{hw.work_date}</span>
                    <span className="text-amber-600 font-bold">{hw.head_received}두 입고</span>
                    <span className="text-gray-400">{hw.manager_name ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ⑤ 생산팀: 농협 입고두수 */}
        {showLivestock && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">농협 유통 입고 두수</h2>
            <LivestockIntakeForm />
            {recentLivestock && recentLivestock.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid text-[10px] text-gray-400 font-semibold px-4 py-2 bg-gray-50 border-b border-gray-100"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
                  <span>날짜</span><span className="text-center">장부</span><span className="text-center">입고</span><span className="text-center">목우촌</span><span className="text-center">차이</span>
                </div>
                {recentLivestock.map((li) => {
                  const diff = li.nh_actual - li.nh_ledger;
                  return (
                    <div key={li.intake_date} className="grid text-xs px-4 py-2.5 border-b border-gray-100 last:border-0"
                      style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
                      <span className="text-gray-600">{li.intake_date.slice(5)}</span>
                      <span className="text-center text-gray-600">{li.nh_ledger}</span>
                      <span className="text-center text-gray-600">{li.nh_actual}</span>
                      <span className="text-center text-gray-400">{li.mokwuchon}</span>
                      <span className={`text-center font-bold ${diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {diff > 0 ? "+" : ""}{diff}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ⑥ 생산팀: 수도사용량 */}
        {showWater && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">수도 / 지하수 사용량</h2>
            <WaterUsageForm recentData={recentWater ?? []} />
          </section>
        )}

        {/* ⑦ 생산팀/스킨팀: 생산계획 */}
        {showPlan && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">당일 / 익일 생산계획</h2>
            <ProductionPlanForm dept={dept} workers={teamWorkers} />
            {recentPlans && recentPlans.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">최근 생산계획</div>
                {recentPlans.map((p) => (
                  <div key={p.plan_date} className="px-4 py-3 border-b border-gray-100 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-700">{p.plan_date}</span>
                      <span className="text-xs text-gray-400">{p.manager}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      당일: {(p.today_plans as Array<{task: string; target_count: string; work_hours: string}>).filter((pl) => pl.task).map((pl) => `${pl.task}${pl.target_count ? `(${pl.target_count}개)` : ""}`).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ⑧ 재고팀: 냉동·냉장·컨테이너 재고 */}
        {showInventory && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">냉동·냉장·컨테이너 재고 현황</h2>
            <FrozenInventoryForm prevData={frozenPrevData} />
            {todayInventory && todayInventory.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">오늘 입력된 재고 ({today})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-2 text-gray-400">보관소</th>
                        <th className="text-left px-3 py-2 text-gray-400">품명</th>
                        <th className="text-center px-3 py-2 text-gray-400">입고</th>
                        <th className="text-center px-3 py-2 text-gray-400">출고</th>
                        <th className="text-center px-3 py-2 text-emerald-600">현재고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayInventory.map((inv, i) => {
                        const curr = inv.prev_stock + inv.incoming_qty - inv.outgoing_qty;
                        return (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2 text-gray-500">{inv.location}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{inv.product_name}</td>
                            <td className="px-3 py-2 text-center text-amber-600">{inv.incoming_qty}</td>
                            <td className="px-3 py-2 text-center text-red-500">{inv.outgoing_qty}</td>
                            <td className={`px-3 py-2 text-center font-bold ${curr < 50 ? "text-amber-600" : "text-emerald-600"}`}>{curr.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ⑨ 품질팀: 순찰일지 */}
        {showPatrol && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">현장 순찰일지</h2>
            <QualityPatrolForm />
            {recentPatrols && recentPatrols.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">최근 순찰 이력</div>
                {recentPatrols.map((p, i) => {
                  const issues = p.issues as Array<{ severity: string }>;
                  const issueCount = issues?.length ?? 0;
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-500 w-20 shrink-0">{p.patrol_date} {p.patrol_time}</span>
                      <span className="text-xs text-gray-700 flex-1">{p.inspector}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        p.overall_status === "정상" ? "bg-emerald-100 text-emerald-700"
                        : p.overall_status === "주의" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                      }`}>{p.overall_status}</span>
                      {issueCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">이슈 {issueCount}건</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ⑩ 품질팀: 오딧 체크리스트 */}
        {showAudit && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">HACCP / 위생 점검 체크리스트</h2>
            <AuditChecklistForm />
          </section>
        )}

        {/* ⑪ 생산일지 (생산/가공/스킨팀) */}
        {showProdLog && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">오늘 생산일지</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">DB 실시간</span>
            </div>
            {todayProdLogs && todayProdLogs.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-5 py-2.5 border-b border-gray-100 bg-gray-50">
                  <span>작업자</span><span>제품명</span><span>생산량</span><span>수율</span>
                </div>
                {todayProdLogs.map((log, i) => (
                  <div key={log.id} className={`grid grid-cols-4 items-center px-5 py-3 text-sm ${i > 0 ? "border-t border-gray-100" : ""}`}>
                    <span className="font-medium text-gray-800">{log.worker_name}</span>
                    <span className="text-gray-600 truncate">{log.product_name}</span>
                    <span className="text-gray-600">{log.output_qty?.toLocaleString()}kg</span>
                    <span className={`font-semibold ${(log.yield_rate ?? 0) >= 92 ? "text-emerald-600" : "text-amber-600"}`}>
                      {log.yield_rate ?? "-"}%
                    </span>
                  </div>
                ))}
                {totalOutput > 0 && (
                  <div className="px-5 py-2.5 border-t border-gray-200 bg-gray-50 flex justify-between text-xs text-gray-500">
                    <span>이번 달 총 생산량</span>
                    <span className="font-semibold text-gray-700">{totalOutput.toLocaleString()}kg</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="text-3xl mb-2">📋</div>
                <div className="text-sm text-gray-500">오늘 아직 입력된 생산일지가 없습니다</div>
              </div>
            )}
          </section>
        )}

        {/* ⑫ 위생점검 */}
        {showHygiene && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">오늘 위생점검</h2>
              {todayHygiene && todayHygiene.length > 0 && (
                <span className="text-xs text-gray-400">클릭하면 항목별 상세 확인</span>
              )}
            </div>
            <HygieneCheckDetail checks={todayHygiene ?? []} />
          </section>
        )}

        {/* ⑬ 클레임 */}
        {showClaims && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">이번 달 클레임</h2>
              {claimCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{claimCount}건</span>
              )}
            </div>
            <TeamClaimsSection initialClaims={(monthClaims ?? []) as Parameters<typeof TeamClaimsSection>[0]["initialClaims"]} />
          </section>
        )}

        {/* ⑭ 마케팅팀: 거래처 현황 */}
        {showCustomers && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">거래처 현황</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">DB 실시간</span>
            </div>
            <CustomerListView initialCustomers={(customerList ?? []) as Array<{
              id: string; name: string; type: string; contact_name: string | null;
              phone: string | null; monthly_avg: number; payment_terms: number;
              active: boolean; products: string[] | null; memo: string | null;
            }>} />
          </section>
        )}

        {/* ⑮ 배송팀: 최근 납품전표 */}
        {showDeliveries && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">최근 납품전표</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">DB 실시간</span>
            </div>
            {recentDeliveries && recentDeliveries.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
                  최근 납품 이력
                </div>
                {recentDeliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-0">
                    <span className="text-base">🚚</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{d.customer_name}</div>
                      <div className="text-xs text-gray-400">
                        {d.delivery_date}
                        {d.driver ? ` · ${d.driver}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#1F3864]">
                        {d.total_amount > 0 ? `${(d.total_amount / 10_000).toLocaleString()}만원` : "-"}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        d.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                        : d.status === "invoiced" ? "bg-blue-100 text-blue-700"
                        : d.status === "preparing" ? "bg-gray-100 text-gray-600"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {d.status === "delivered" ? "배송완료"
                          : d.status === "invoiced" ? "세금계산서 발행"
                          : d.status === "preparing" ? "준비중"
                          : "배송중"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <div className="text-3xl mb-2">🚚</div>
                <div className="text-sm text-gray-500">최근 납품 데이터가 없습니다</div>
              </div>
            )}
          </section>
        )}

        {/* 배송팀 전용: 배차일지 바로가기 */}
        {showDeliveries && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">배차 관리</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/dispatch" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1F3864] hover:shadow-md transition-all group">
                <div className="text-2xl mb-2">🚚</div>
                <div className="font-bold text-gray-800 group-hover:text-[#1F3864]">배차일지 작성</div>
                <div className="text-xs text-gray-500 mt-1">출발/도착 키로수, 방문처, 특이사항 기록</div>
              </a>
              <a href="/dispatch/fuel" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1F3864] hover:shadow-md transition-all group">
                <div className="text-2xl mb-2">⛽</div>
                <div className="font-bold text-gray-800 group-hover:text-[#1F3864]">유류비 분석</div>
                <div className="text-xs text-gray-500 mt-1">월별 차량별 주행거리·추정 유류비 확인</div>
              </a>
            </div>
          </section>
        )}

        {/* 회계팀 전용: 월간 KPI 입력 */}
        {showMonthlyKpi && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">월간 재무 KPI</h2>
              <span className="text-xs text-gray-400">→ COO 검토 → CEO 대시보드 자동 반영</span>
            </div>
            <MonthlyKpiForm yearMonth={thisMonth} existing={existingKpi} />
          </section>
        )}

        {/* ⑯ 이번 주 할 일 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">이번 주 할 일</h2>
          <TeamTodoList dept={dept} todos={data.todos} />
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v2.0 · {dept} · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
