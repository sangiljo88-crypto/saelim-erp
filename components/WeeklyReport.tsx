"use client";

import { useState } from "react";

// ── 타입 ──────────────────────────────────────────────────────
interface ProductionLog {
  work_date: string;
  dept: string;
  product_name: string;
  input_qty: number;
  output_qty: number;
  yield_rate: number;
  issue_note: string | null;
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
  since: string;
  until: string;
  production: ProductionLog[];
  claims: Claim[];
  deptReports: DeptReport[];
  costApprovals: CostApproval[];
  maintenance: MaintenanceLog[];
  deliveries: DeliveryLog[];
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
  log: ProductionLog & { product_id?: string },
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
  pending:     { bg: "bg-red-100",    text: "text-red-600",   label: "미처리" },
  in_progress: { bg: "bg-amber-100",  text: "text-amber-700", label: "처리중" },
  resolved:    { bg: "bg-green-100",  text: "text-green-700", label: "완료" },
};

// ── 섹션 카드 ─────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <div className="text-sm font-bold text-gray-700">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatCard({
  label, value, sub, color = "text-gray-800",
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function WeeklyReport({
  weekLabel, since, until,
  production, claims, deptReports, costApprovals, maintenance, deliveries,
  priceById, priceByName, keywordPriceMap,
}: Props) {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 100);
  }

  // ── 수율 지표 ─────────────────────────────────────────────
  const avgYield   = avg(production.map((l) => l.yield_rate));
  const totalInput  = production.reduce((s, l) => s + (l.input_qty || 0), 0);
  const totalOutput = production.reduce((s, l) => s + (l.output_qty || 0), 0);
  const belowThreshold = production.filter((l) => l.yield_rate < 85).length;
  const totalLoss = production.reduce((sum, l) => {
    const loss = (l.input_qty || 0) - (l.output_qty || 0);
    const p = getPrice(l as ProductionLog & { product_id?: string }, priceById, priceByName, keywordPriceMap);
    return sum + (loss > 0 && p > 0 ? loss * p : 0);
  }, 0);

  // ── 클레임 지표 ───────────────────────────────────────────
  const newClaims       = claims.filter((c) => c.status === "pending").length;
  const progressClaims  = claims.filter((c) => c.status === "in_progress").length;
  const resolvedClaims  = claims.filter((c) => c.status === "resolved").length;

  // ── 팀 보고 ───────────────────────────────────────────────
  const allDepts = ["현장팀", "물류팀", "품질CS팀", "영업마케팅팀", "경영지원팀"];
  const reportedDepts = new Set(deptReports.map((r) => r.dept));
  const redCount    = deptReports.filter((r) => r.rag_status === "red").length;

  // ── 비용 승인 ─────────────────────────────────────────────
  const pendingApprovals = costApprovals.filter((a) => a.status === "pending");
  const pendingAmount    = pendingApprovals.reduce((s, a) => s + (a.amount || 0), 0);

  // ── 납품 ─────────────────────────────────────────────────
  const totalDelivery = deliveries.reduce((s, d) => s + (d.total_amount || 0), 0);

  // ── 설비 진행중 이슈 ──────────────────────────────────────
  const openMaintenance = maintenance.filter((m) => m.result === "진행중");

  return (
    <div className="flex flex-col gap-4 print:gap-3">

      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">📋 주간 경영 보고서</h1>
          <p className="text-sm text-gray-500 mt-0.5">{weekLabel} · {since} ~ {until}</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing}
          className="print:hidden text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1a2f58] transition-colors disabled:opacity-50 cursor-pointer"
        >
          🖨️ 인쇄 / PDF
        </button>
      </div>

      {/* 핵심 지표 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="평균 수율"
          value={production.length ? `${avgYield}%` : "–"}
          sub={`미달 ${belowThreshold}건`}
          color={avgYield >= 85 ? "text-green-600" : "text-red-500"}
        />
        <StatCard
          label="클레임 신규"
          value={claims.length ? `${newClaims}건` : "–"}
          sub={`처리중 ${progressClaims}건 · 완료 ${resolvedClaims}건`}
          color={newClaims > 0 ? "text-red-500" : "text-green-600"}
        />
        <StatCard
          label="팀별 보고"
          value={`${reportedDepts.size}/${allDepts.length}팀`}
          sub={redCount > 0 ? `🔴 위험 ${redCount}건` : "이슈 없음"}
          color={redCount > 0 ? "text-red-500" : "text-gray-700"}
        />
        <StatCard
          label="비용 승인 대기"
          value={pendingApprovals.length ? `${pendingApprovals.length}건` : "0건"}
          sub={pendingApprovals.length ? formatWon(pendingAmount) : "대기 없음"}
          color={pendingApprovals.length > 0 ? "text-amber-600" : "text-green-600"}
        />
      </div>

      {/* 수율 현황 */}
      <Section title="📊 수율 현황">
        {production.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">이번 주 생산 데이터 없음</div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 요약 row */}
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
                  {totalLoss > 0 ? formatWon(totalLoss) : "단가 미설정"}
                </div>
              </div>
            </div>

            {/* 이슈 로그 */}
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

      {/* 클레임 현황 */}
      <Section title="📋 클레임 현황">
        {claims.length === 0 ? (
          <div className="text-sm text-green-600 font-semibold text-center py-6">✅ 이번 주 클레임 없음</div>
        ) : (
          <div className="flex flex-col gap-2">
            {claims.slice(0, 8).map((c) => {
              const s = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.pending;
              return (
                <div key={c.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700">
                      {c.claim_date} · {c.client_name} · {c.claim_type}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{c.content}</div>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{c.dept}</span>
                </div>
              );
            })}
            {claims.length > 8 && (
              <div className="text-xs text-gray-400 text-center pt-1">
                외 {claims.length - 8}건 · <a href="/claims" className="text-[#1F3864] underline print:no-underline">전체 보기</a>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 팀별 주간 보고 */}
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
                        {r.dept} <span className="text-gray-400 font-normal">· {r.manager_name} · {r.report_date}</span>
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
              if (!unreported.length) return null;
              return (
                <div className="flex flex-wrap gap-1.5 pt-1">
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

      {/* 비용 승인 대기 (있을 때만) */}
      {pendingApprovals.length > 0 && (
        <Section title="💰 비용 승인 대기">
          <div className="flex flex-col gap-2">
            {pendingApprovals.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{a.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{a.dept} · {a.requested_by} · {a.request_date}</div>
                </div>
                <span className="text-sm font-bold text-amber-600 shrink-0">{formatWon(a.amount)}</span>
              </div>
            ))}
            <div className="text-right text-xs font-bold text-gray-600 pt-1">
              합계 {formatWon(pendingAmount)}
            </div>
          </div>
        </Section>
      )}

      {/* 설비 진행중 이슈 (있을 때만) */}
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

      {/* 납품 현황 (데이터 있을 때만) */}
      {deliveries.length > 0 && (
        <Section title="🚚 납품 현황">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">납품 건수</div>
              <div className="text-xl font-bold text-gray-700">{deliveries.length}건</div>
            </div>
            {totalDelivery > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-0.5">총 납품 금액</div>
                <div className="text-xl font-bold text-[#1F3864]">{formatWon(totalDelivery)}</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 푸터 */}
      <div className="text-center text-xs text-gray-400 py-2 print:block">
        새림 ERP · 주간 경영 보고서 · {new Date().toLocaleDateString("ko-KR")} 기준
      </div>

    </div>
  );
}
