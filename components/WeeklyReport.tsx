"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── 타입 ──────────────────────────────────────────────────────
interface ProductionLog {
  work_date: string;
  dept: string;
  product_name: string;
  input_qty: number;
  output_qty: number;
  yield_rate: number;
  issue_note: string | null;
  product_id?: string;
}

interface PrevProductionLog {
  yield_rate: number;
  input_qty: number;
  output_qty: number;
}

interface Claim {
  id: string;
  claim_date: string;
  client_name: string;
  claim_type: string;
  content: string;
  status: string;
  dept: string;
}

interface DeptReport {
  id: string;
  report_date: string;
  dept: string;
  manager_name: string;
  rag_status: string;
  issue: string;
  next_action: string | null;
  coo_comment: string | null;
}

interface CostApproval {
  id: string;
  title: string;
  dept: string;
  requested_by: string;
  request_date: string;
  amount: number;
  status: string;
}

interface MaintenanceLog {
  id: string;
  log_date: string;
  equipment_name: string;
  dept: string;
  log_type: string;
  description: string;
  result: string;
  cost: number | null;
}

interface DeliveryLog {
  delivery_date: string;
  customer_name: string;
  total_amount: number;
  status: string;
}

interface Props {
  weekLabel: string;
  weekOffset: number;
  since: string;
  until: string;
  production: ProductionLog[];
  prevProduction: PrevProductionLog[];
  thisWeekClaims: Claim[];
  openClaims: Claim[];
  prevWeekClaimsCount: number;
  deptReports: DeptReport[];
  costApprovals: CostApproval[];
  maintenance: MaintenanceLog[];
  deliveries: DeliveryLog[];
  prevDeliveryTotal: number;
  priceById: Record<string, number>;
  priceByName: Record<string, number>;
  keywordPriceMap: Record<string, number>;
}

// ── 유틸 ─────────────────────────────────────────────────────
function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function formatWon(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

function getPrice(
  log: ProductionLog,
  priceById: Record<string, number>,
  priceByName: Record<string, number>,
  keywordPriceMap: Record<string, number>,
): number {
  if (log.product_id && priceById[log.product_id]) return priceById[log.product_id];
  if (priceByName[log.product_name]) return priceByName[log.product_name];
  for (const [kw, price] of Object.entries(keywordPriceMap)) {
    if (log.product_name.includes(kw)) return price;
  }
  return 0;
}

const RAG_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  green:  { bg: "bg-green-100",  text: "text-green-700",  label: "정상" },
  yellow: { bg: "bg-amber-100",  text: "text-amber-700",  label: "주의" },
  red:    { bg: "bg-red-100",    text: "text-red-600",    label: "위험" },
};

const CLAIM_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: "bg-red-100",   text: "text-red-600",   label: "미처리" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", label: "처리중" },
  resolved:    { bg: "bg-green-100", text: "text-green-700", label: "완료" },
};

// ── 서브 컴포넌트 ─────────────────────────────────────────────
function Section({
  title, urgent = false, children,
}: {
  title: string; urgent?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${urgent ? "border-red-200" : "border-gray-200"}`}>
      <div className={`px-5 py-3.5 border-b flex items-center gap-2 ${urgent ? "bg-red-50 border-red-100" : "bg-gray-50/60 border-gray-100"}`}>
        <div className={`text-sm font-bold ${urgent ? "text-red-700" : "text-gray-700"}`}>{title}</div>
        {urgent && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">조치 필요</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Diff({ curr, prev, unit = "", invert = false }: {
  curr: number; prev: number; unit?: string; invert?: boolean;
}) {
  if (!prev) return null;
  const d = Math.round((curr - prev) * 10) / 10;
  if (d === 0) return <span className="text-xs text-gray-400">전주 동일</span>;
  const positive = invert ? d < 0 : d > 0;
  return (
    <span className={`text-xs font-semibold ${positive ? "text-green-500" : "text-red-400"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}{unit} 전주 대비
    </span>
  );
}

function StatCard({
  label, value, sub, color = "text-gray-800", diffNode,
}: {
  label: string; value: string; sub?: string; color?: string; diffNode?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {diffNode && <div className="mt-1">{diffNode}</div>}
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function WeeklyReport({
  weekLabel, weekOffset, since, until,
  production, prevProduction,
  thisWeekClaims, openClaims, prevWeekClaimsCount,
  deptReports, costApprovals, maintenance, deliveries, prevDeliveryTotal,
  priceById, priceByName, keywordPriceMap,
}: Props) {
  const [printing, setPrinting] = useState(false);
  const router = useRouter();

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 100);
  }

  function goWeek(offset: number) {
    const next = weekOffset + offset;
    if (next > 0) return; // 미래 주차 이동 불가
    router.push(`/report${next === 0 ? "" : `?week=${next}`}`);
  }

  // ── 납품 지표 ─────────────────────────────────────────────
  const totalDelivery     = deliveries.reduce((s, d) => s + (d.total_amount || 0), 0);
  const deliveryDiff      = prevDeliveryTotal
    ? Math.round(((totalDelivery - prevDeliveryTotal) / prevDeliveryTotal) * 100 * 10) / 10
    : null;

  // 거래처별 납품 집계
  const customerMap = new Map<string, number>();
  for (const d of deliveries) {
    customerMap.set(d.customer_name, (customerMap.get(d.customer_name) ?? 0) + (d.total_amount || 0));
  }
  const topCustomers = Array.from(customerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── 수율 지표 ─────────────────────────────────────────────
  const avgYield      = avg(production.map((l) => l.yield_rate));
  const prevAvgYield  = avg(prevProduction.map((l) => l.yield_rate));
  const totalInput    = production.reduce((s, l) => s + (l.input_qty || 0), 0);
  const totalOutput   = production.reduce((s, l) => s + (l.output_qty || 0), 0);
  const belowCount    = production.filter((l) => l.yield_rate < 85).length;
  const totalLoss     = production.reduce((sum, l) => {
    const loss = (l.input_qty || 0) - (l.output_qty || 0);
    const p = getPrice(l, priceById, priceByName, keywordPriceMap);
    return sum + (loss > 0 && p > 0 ? loss * p : 0);
  }, 0);

  // ── 클레임 지표 ───────────────────────────────────────────
  // thisWeekClaims: 이번 주 발생분 / openClaims: 누적 미처리·처리중
  // openClaims에서 이번 주 것은 제외해 "이월된" 건수만 따로 표시
  const thisWeekIds   = new Set(thisWeekClaims.map((c) => c.id));
  const carriedOpen   = openClaims.filter((c) => !thisWeekIds.has(c.id));

  // ── 팀 보고 ───────────────────────────────────────────────
  const allDepts      = ["현장팀", "물류팀", "품질CS팀", "영업마케팅팀", "경영지원팀"];
  const reportedDepts = new Set(deptReports.map((r) => r.dept));
  const redCount      = deptReports.filter((r) => r.rag_status === "red").length;

  // ── 비용 승인 ─────────────────────────────────────────────
  const pendingAmount = costApprovals.reduce((s, a) => s + (a.amount || 0), 0);

  // ── 설비 ─────────────────────────────────────────────────
  const openMaintenance = maintenance.filter((m) => m.result === "진행중");

  // ── 전체 이상 신호 여부 ───────────────────────────────────
  const hasAlert = redCount > 0 || openClaims.filter((c) => c.status === "pending").length > 2;

  return (
    <div className="flex flex-col gap-4 print:gap-3">

      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">📋 주간 경영 보고서</h1>
          {/* 주차 네비게이션 */}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => goWeek(-1)}
              className="print:hidden text-xs text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              ← 전주
            </button>
            <span className="text-sm font-semibold text-[#1F3864] px-1">{weekLabel}</span>
            <button
              onClick={() => goWeek(1)}
              disabled={weekOffset >= 0}
              className="print:hidden text-xs text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              다음 주 →
            </button>
            {weekOffset < 0 && (
              <button
                onClick={() => router.push("/report")}
                className="print:hidden text-xs text-[#1F3864] border border-[#1F3864] bg-white hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                이번 주
              </button>
            )}
          </div>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing}
          className="print:hidden text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1a2f58] transition-colors disabled:opacity-50 cursor-pointer"
        >
          🖨️ 인쇄 / PDF
        </button>
      </div>

      {/* ── 전체 이상 알림 배너 (있을 때만) ── */}
      {hasAlert && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">🚨</span>
          <div className="text-sm text-red-700 font-semibold">
            {redCount > 0 && `위험 상태 팀 ${redCount}곳`}
            {redCount > 0 && openClaims.filter((c) => c.status === "pending").length > 2 && " · "}
            {openClaims.filter((c) => c.status === "pending").length > 2 && `미처리 클레임 ${openClaims.filter((c) => c.status === "pending").length}건`}
            <span className="font-normal text-red-500 ml-2">즉시 확인이 필요합니다</span>
          </div>
        </div>
      )}

      {/* ── 핵심 지표 카드 4개 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 납품 금액 — 제일 먼저 */}
        <StatCard
          label="이번 주 납품액"
          value={deliveries.length ? formatWon(totalDelivery) : "–"}
          color="text-[#1F3864]"
          diffNode={
            deliveryDiff !== null ? (
              <span className={`text-xs font-semibold ${deliveryDiff >= 0 ? "text-green-500" : "text-red-400"}`}>
                {deliveryDiff >= 0 ? "▲" : "▼"} {Math.abs(deliveryDiff)}% 전주 대비
              </span>
            ) : undefined
          }
          sub={`${deliveries.length}건`}
        />

        {/* 평균 수율 */}
        <StatCard
          label="평균 수율"
          value={production.length ? `${avgYield}%` : "–"}
          color={avgYield >= 85 ? "text-green-600" : "text-red-500"}
          diffNode={
            prevAvgYield ? (
              <Diff curr={avgYield} prev={prevAvgYield} unit="%" />
            ) : undefined
          }
          sub={`미달 ${belowCount}건`}
        />

        {/* 클레임 */}
        <StatCard
          label="이번 주 클레임"
          value={`${thisWeekClaims.length}건`}
          color={thisWeekClaims.length > 0 ? "text-red-500" : "text-green-600"}
          diffNode={
            <Diff curr={thisWeekClaims.length} prev={prevWeekClaimsCount} invert unit="건" />
          }
          sub={carriedOpen.length > 0 ? `이월 미처리 ${carriedOpen.length}건` : "이월 없음"}
        />

        {/* 팀 보고 */}
        <StatCard
          label="팀별 보고 현황"
          value={`${reportedDepts.size}/${allDepts.length}팀`}
          color={redCount > 0 ? "text-red-500" : "text-gray-700"}
          sub={redCount > 0 ? `🔴 위험 ${redCount}건` : "이슈 없음"}
        />
      </div>

      {/* ── ① 납품 현황 (최상단 섹션) ── */}
      <Section title="🚚 납품 현황">
        {deliveries.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">이번 주 납품 데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 요약 row */}
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">총 납품 금액</div>
                <div className="text-2xl font-bold text-[#1F3864]">{formatWon(totalDelivery)}</div>
                {deliveryDiff !== null && (
                  <span className={`text-xs font-semibold ${deliveryDiff >= 0 ? "text-green-500" : "text-red-400"}`}>
                    {deliveryDiff >= 0 ? "▲" : "▼"} {Math.abs(deliveryDiff)}% 전주 대비
                    <span className="text-gray-400 font-normal ml-1">({formatWon(prevDeliveryTotal)})</span>
                  </span>
                )}
              </div>
              <div className="h-10 w-px bg-gray-100 hidden sm:block" />
              <div>
                <div className="text-xs text-gray-400 mb-0.5">납품 건수</div>
                <div className="text-xl font-bold text-gray-700">{deliveries.length}건</div>
              </div>
            </div>

            {/* 거래처별 납품액 */}
            {topCustomers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">거래처별 납품액 (TOP 5)</div>
                <div className="flex flex-col gap-1.5">
                  {topCustomers.map(([name, amount], i) => {
                    const pct = totalDelivery > 0 ? Math.round((amount / totalDelivery) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs text-gray-700 w-28 truncate shrink-0">{name}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1F3864]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-20 text-right shrink-0">
                          {formatWon(amount)}
                        </span>
                        <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── ② 수율 현황 ── */}
      <Section title="📊 수율 현황">
        {production.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">이번 주 생산 데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">총 투입</div>
                <div className="text-lg font-bold text-gray-700">{totalInput.toLocaleString()}kg</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">총 산출</div>
                <div className="text-lg font-bold text-gray-700">{totalOutput.toLocaleString()}kg</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${totalLoss > 500_000 ? "bg-red-50" : "bg-gray-50"}`}>
                <div className="text-xs text-gray-400 mb-1">추정 손실</div>
                <div className={`text-lg font-bold ${totalLoss > 500_000 ? "text-red-500" : "text-amber-500"}`}>
                  {totalLoss > 0 ? formatWon(totalLoss) : "–"}
                </div>
              </div>
            </div>

            {production.filter((l) => l.yield_rate < 85 || l.issue_note).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">⚠️ 기준 미달 · 이슈 항목</div>
                <div className="flex flex-col gap-1.5">
                  {production
                    .filter((l) => l.yield_rate < 85 || l.issue_note)
                    .sort((a, b) => a.yield_rate - b.yield_rate)
                    .slice(0, 5)
                    .map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                        <span className={`shrink-0 font-bold px-2 py-0.5 rounded-full ${l.yield_rate < 85 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                          {l.yield_rate}%
                        </span>
                        <span className="text-gray-600">{l.work_date} · {l.product_name} · {l.dept}</span>
                        {l.issue_note && <span className="text-gray-400 truncate">{l.issue_note}</span>}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── ③ 클레임 현황 ── */}
      <Section
        title="📋 클레임 현황"
        urgent={openClaims.filter((c) => c.status === "pending").length > 2}
      >
        {thisWeekClaims.length === 0 && openClaims.length === 0 ? (
          <div className="text-sm text-green-600 font-semibold text-center py-6">✅ 이번 주 클레임 없음 · 누적 미처리 없음</div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 이번 주 신규 */}
            {thisWeekClaims.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  이번 주 신규 ({thisWeekClaims.length}건)
                  <span className="ml-2 font-normal">
                    <Diff curr={thisWeekClaims.length} prev={prevWeekClaimsCount} invert unit="건" />
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {thisWeekClaims.slice(0, 5).map((c) => {
                    const s = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.pending;
                    return (
                      <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-700">{c.client_name} · {c.claim_type}</div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">{c.content}</div>
                        </div>
                        <span className="text-xs text-gray-300 shrink-0">{c.claim_date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 이월 미처리 */}
            {carriedOpen.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-500 mb-2">이월 미처리·처리중 ({carriedOpen.length}건)</div>
                <div className="flex flex-col gap-1">
                  {carriedOpen.slice(0, 5).map((c) => {
                    const s = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.pending;
                    return (
                      <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-700">{c.client_name} · {c.claim_type}</div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">{c.content}</div>
                        </div>
                        <span className="text-xs text-gray-300 shrink-0">{c.claim_date}</span>
                      </div>
                    );
                  })}
                  {carriedOpen.length > 5 && (
                    <div className="text-xs text-gray-400 text-center pt-1">
                      외 {carriedOpen.length - 5}건 ·{" "}
                      <a href="/claims" className="text-[#1F3864] underline">전체 보기</a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── ④ 팀별 주간 보고 ── */}
      <Section title="🏢 팀별 주간 보고">
        {deptReports.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">이번 주 제출된 보고 없음</div>
        ) : (
          <div className="flex flex-col gap-3">
            {deptReports
              .sort((a, b) => {
                const order = { red: 0, yellow: 1, green: 2 };
                return (order[a.rag_status as keyof typeof order] ?? 2) - (order[b.rag_status as keyof typeof order] ?? 2);
              })
              .map((r) => {
                const rag = RAG_STYLE[r.rag_status] ?? RAG_STYLE.green;
                return (
                  <div key={r.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${rag.bg} ${rag.text}`}>
                      {rag.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 mb-0.5">
                        {r.dept}
                        <span className="text-gray-400 font-normal"> · {r.manager_name} · {r.report_date}</span>
                      </div>
                      <div className="text-xs text-gray-600">{r.issue}</div>
                      {r.next_action && (
                        <div className="text-xs text-gray-400 mt-0.5">→ {r.next_action}</div>
                      )}
                      {r.coo_comment && (
                        <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                          💬 COO: {r.coo_comment}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* 미제출 팀 */}
            {(() => {
              const unreported = allDepts.filter((d) => !reportedDepts.has(d));
              if (!unreported.length) return <div className="text-xs text-green-600 font-semibold pt-1">✅ 전 팀 보고 완료</div>;
              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-gray-400">미제출:</span>
                  {unreported.map((d) => (
                    <span key={d} className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{d}</span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </Section>

      {/* ── ⑤ 비용 승인 대기 (있을 때만) ── */}
      {costApprovals.length > 0 && (
        <Section title="💰 대표 결재 필요 사항" urgent>
          <div className="flex flex-col gap-2">
            {costApprovals.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{a.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{a.dept} · {a.requested_by} · {a.request_date}</div>
                </div>
                <span className="text-sm font-bold text-amber-600 shrink-0">{formatWon(a.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">총 {costApprovals.length}건</span>
              <span className="text-sm font-bold text-gray-700">합계 {formatWon(pendingAmount)}</span>
            </div>
          </div>
        </Section>
      )}

      {/* ── ⑥ 설비 이슈 (있을 때만) ── */}
      {openMaintenance.length > 0 && (
        <Section title="🔧 처리중인 설비 이슈">
          <div className="flex flex-col gap-2">
            {openMaintenance.map((m) => (
              <div key={m.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">진행중</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{m.equipment_name} · {m.dept}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.log_date} · {m.description}</div>
                </div>
                {m.cost && m.cost > 0 && (
                  <span className="text-xs text-gray-500 shrink-0">{formatWon(m.cost)}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 푸터 */}
      <div className="text-center text-xs text-gray-400 py-2">
        새림 ERP · 주간 경영 보고서 · {new Date().toLocaleDateString("ko-KR")} 기준
      </div>
    </div>
  );
}
