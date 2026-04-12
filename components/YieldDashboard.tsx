"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

interface Log {
  work_date: string;
  dept: string;
  product_id?: string;
  product_name: string;
  input_qty: number;
  output_qty: number;
  yield_rate: number;
  issue_note: string | null;
  worker_name: string;
}

const THRESHOLD = 85; // 기준 수율 (%)
const PERIODS = [
  { label: "이번 주",  days: 7  },
  { label: "2주",      days: 14 },
  { label: "이번 달",  days: 30 },
] as const;

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function yieldColor(rate: number) {
  if (rate >= 90) return "#22c55e";
  if (rate >= THRESHOLD) return "#f59e0b";
  return "#ef4444";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatWon(amount: number) {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

function getPrice(log: Log, priceById: Record<string, number>, priceByName: Record<string, number>): number {
  if (log.product_id && priceById[log.product_id]) return priceById[log.product_id];
  if (priceByName[log.product_name]) return priceByName[log.product_name];
  return 0;
}

export default function YieldDashboard({
  logs,
  priceById = {},
  priceByName = {},
}: {
  logs: Log[];
  priceById?: Record<string, number>;
  priceByName?: Record<string, number>;
}) {
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString().split("T")[0];
  }, [periodDays]);

  const filtered = useMemo(
    () => logs.filter((l) => l.work_date >= cutoff),
    [logs, cutoff]
  );

  // ── 일별 수율 집계 ────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const l of filtered) {
      if (!map.has(l.work_date)) map.set(l.work_date, []);
      map.get(l.work_date)!.push(l.yield_rate);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rates]) => ({
        date: formatDate(date),
        수율: avg(rates),
        기준: THRESHOLD,
      }));
  }, [filtered]);

  // ── 품목별 수율 집계 ─────────────────────────────────────
  const productData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const l of filtered) {
      const key = l.product_name || "미분류";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l.yield_rate);
    }
    return Array.from(map.entries())
      .map(([name, rates]) => ({ name, 수율: avg(rates), count: rates.length }))
      .sort((a, b) => b.수율 - a.수율);
  }, [filtered]);

  // ── 요약 지표 ────────────────────────────────────────────
  const allRates = filtered.map((l) => l.yield_rate);
  const avgYield = avg(allRates);
  const belowThreshold = filtered.filter((l) => l.yield_rate < THRESHOLD).length;
  const totalInput = filtered.reduce((s, l) => s + (l.input_qty || 0), 0);
  const totalOutput = filtered.reduce((s, l) => s + (l.output_qty || 0), 0);

  // 손실 금액 계산
  const totalLossAmount = useMemo(() =>
    filtered.reduce((sum, l) => {
      const loss = (l.input_qty || 0) - (l.output_qty || 0);
      const price = getPrice(l, priceById, priceByName);
      return sum + (loss > 0 && price > 0 ? loss * price : 0);
    }, 0),
  [filtered, priceById, priceByName]);

  const hasPriceData = useMemo(() =>
    filtered.some((l) => getPrice(l, priceById, priceByName) > 0),
  [filtered, priceById, priceByName]);

  // 이전 기간 비교
  const prevCutoff = useMemo(() => {
    const d = new Date(cutoff);
    d.setDate(d.getDate() - periodDays);
    return d.toISOString().split("T")[0];
  }, [cutoff, periodDays]);
  const prevLogs = logs.filter((l) => l.work_date >= prevCutoff && l.work_date < cutoff);
  const prevAvg = avg(prevLogs.map((l) => l.yield_rate));
  const diff = prevAvg ? Math.round((avgYield - prevAvg) * 10) / 10 : null;

  // ── 이슈 목록 ────────────────────────────────────────────
  const issues = useMemo(
    () =>
      filtered
        .filter((l) => l.issue_note || l.yield_rate < THRESHOLD)
        .sort((a, b) => b.work_date.localeCompare(a.work_date))
        .slice(0, 10),
    [filtered]
  );

  const hasData = filtered.length > 0;

  return (
    <div className="flex flex-col gap-4">

      {/* 기간 선택 */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriodDays(p.days as 7 | 14 | 30)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer
              ${periodDays === p.days
                ? "bg-[#1F3864] text-white shadow"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 평균 수율 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">평균 수율</div>
          <div className={`text-2xl font-bold ${hasData ? (avgYield >= THRESHOLD ? "text-green-600" : "text-red-500") : "text-gray-300"}`}>
            {hasData ? `${avgYield}%` : "–"}
          </div>
          {diff !== null && (
            <div className={`text-xs mt-1 font-semibold ${diff >= 0 ? "text-green-500" : "text-red-400"}`}>
              {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}% 전기 대비
            </div>
          )}
        </div>

        {/* 기준 미달 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">기준 미달 ({THRESHOLD}% 미만)</div>
          <div className={`text-2xl font-bold ${belowThreshold > 0 ? "text-red-500" : "text-green-600"}`}>
            {hasData ? `${belowThreshold}건` : "–"}
          </div>
          <div className="text-xs text-gray-400 mt-1">전체 {filtered.length}건 중</div>
        </div>

        {/* 총 투입 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">총 투입량</div>
          <div className="text-2xl font-bold text-gray-700">
            {hasData ? `${totalInput.toLocaleString()}kg` : "–"}
          </div>
          <div className="text-xs text-gray-400 mt-1">기간 합계</div>
        </div>

        {/* 손실 금액 */}
        <div className={`bg-white rounded-xl border p-4 ${hasPriceData && totalLossAmount > 0 ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
          <div className="text-xs text-gray-400 mb-1">추정 손실 금액</div>
          <div className={`text-2xl font-bold ${hasPriceData ? (totalLossAmount > 500_000 ? "text-red-500" : "text-amber-500") : "text-gray-300"}`}>
            {!hasData ? "–" : !hasPriceData ? "단가 미설정" : formatWon(totalLossAmount)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {hasData && totalInput > 0
              ? `손실 ${(totalInput - totalOutput).toLocaleString()}kg × 판매단가`
              : "단가 설정 시 자동 계산"}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center text-sm text-gray-400">
          해당 기간에 생산 데이터가 없습니다
        </div>
      ) : (
        <>
          {/* 일별 수율 추이 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-bold text-gray-700 mb-4">📈 일별 수율 추이</div>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "수율"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <ReferenceLine
                    y={THRESHOLD}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `기준 ${THRESHOLD}%`, position: "right", fontSize: 10, fill: "#ef4444" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="수율"
                    stroke="#1F3864"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={payload.date}
                          cx={cx} cy={cy} r={5}
                          fill={yieldColor(payload.수율)}
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
            )}
          </div>

          {/* 품목별 수율 */}
          {productData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-700 mb-4">📦 품목별 평균 수율</div>
              <ResponsiveContainer width="100%" height={Math.max(160, productData.length * 40)}>
                <BarChart
                  layout="vertical"
                  data={productData}
                  margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "수율"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <ReferenceLine x={THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar dataKey="수율" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
                    {productData.map((entry) => (
                      <Cell key={entry.name} fill={yieldColor(entry.수율)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 이슈 및 미달 로그 */}
          {issues.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-bold text-gray-700 mb-3">⚠️ 이슈 및 기준 미달 로그</div>
              <div className="flex flex-col gap-2">
                {issues.map((l, i) => {
                  const loss = (l.input_qty || 0) - (l.output_qty || 0);
                  const price = getPrice(l, priceById, priceByName);
                  const lossAmt = loss > 0 && price > 0 ? loss * price : 0;
                  return (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full
                        ${l.yield_rate < THRESHOLD ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                        {l.yield_rate}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
                          {l.work_date} · {l.product_name || "미분류"} · {l.dept}
                          {lossAmt > 0 && (
                            <span className="text-red-500 font-bold">
                              손실 {formatWon(lossAmt)}
                            </span>
                          )}
                        </div>
                        {l.issue_note && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{l.issue_note}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">{l.worker_name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
