"use client";

import { useState } from "react";
import { submitUtilityLog } from "@/app/actions/production";

export interface UtilityLog {
  id: string;
  log_month: string;
  electricity_kwh: number;
  electricity_cost: number;
  water_tap_ton: number;
  water_tap_cost: number;
  water_ground_ton: number;
  water_ground_cost: number;
  gas_m3: number;
  gas_cost: number;
  total_cost: number;
  memo: string | null;
  recorded_by: string | null;
  created_at: string;
}

function getRiskLevel(current: number, prev3: number[]): "green" | "yellow" | "red" | "none" {
  if (prev3.length === 0 || current === 0) return "none";
  const avg = prev3.reduce((s, v) => s + v, 0) / prev3.length;
  if (avg === 0) return "none";
  const ratio = current / avg;
  if (ratio >= 1.3) return "red";
  if (ratio >= 1.15) return "yellow";
  return "green";
}

function getRiskMeta(level: "green" | "yellow" | "red" | "none") {
  return {
    green:  { label: "정상",       color: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", icon: "🟢" },
    yellow: { label: "주의",       color: "bg-amber-100 text-amber-700",    bar: "bg-amber-500",   icon: "🟡" },
    red:    { label: "위험",       color: "bg-red-100 text-red-700",        bar: "bg-red-500",     icon: "🔴" },
    none:   { label: "데이터 없음", color: "bg-gray-100 text-gray-500",     bar: "bg-gray-300",    icon: "⚪" },
  }[level];
}

function fmt만(v: number) {
  if (v === 0) return "0원";
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}천만`;
  if (v >= 1_000_000)  return `${(v / 1_000_000).toFixed(1)}백만`;
  if (v >= 10_000)     return `${Math.round(v / 10_000)}만원`;
  return `${v.toLocaleString()}원`;
}

const EMPTY_FORM = {
  log_month: "",
  electricity_kwh: 0, electricity_cost: 0,
  water_tap_ton: 0,    water_tap_cost: 0,
  water_ground_ton: 0, water_ground_cost: 0,
  gas_m3: 0,           gas_cost: 0,
  memo: "",
};

function BarChart({ logs }: { logs: UtilityLog[] }) {
  const recent = logs.slice(0, 6).reverse();
  if (recent.length === 0) return null;
  const maxCost = Math.max(...recent.map((l) => l.total_cost), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {recent.map((l) => {
        const h = Math.max(4, Math.round((l.total_cost / maxCost) * 88));
        const month = l.log_month.slice(5, 7) + "월";
        return (
          <div key={l.log_month} className="flex flex-col items-center flex-1 gap-1">
            <div className="text-[10px] text-gray-500 font-medium">{fmt만(l.total_cost)}</div>
            <div
              className="w-full rounded-t-sm bg-[#1F3864] opacity-80 hover:opacity-100 transition-opacity"
              style={{ height: `${h}px` }}
              title={`${l.log_month} 총 ${l.total_cost.toLocaleString()}원`}
            />
            <div className="text-[10px] text-gray-400">{month}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function UtilityDashboard({ initialLogs }: { initialLogs: UtilityLog[] }) {
  const [logs, setLogs]         = useState<UtilityLog[]>(initialLogs);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState("");

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);

  const current = logs.find((l) => l.log_month === thisMonth);
  const prev3   = logs.filter((l) => l.log_month < thisMonth).slice(0, 3);

  const elecRisk       = getRiskLevel(current?.electricity_cost ?? 0,    prev3.map((l) => l.electricity_cost));
  const waterTapRisk   = getRiskLevel(current?.water_tap_cost ?? 0,      prev3.map((l) => l.water_tap_cost));
  const waterGroundRisk= getRiskLevel(current?.water_ground_cost ?? 0,   prev3.map((l) => l.water_ground_cost));
  const gasRisk        = getRiskLevel(current?.gas_cost ?? 0,            prev3.map((l) => l.gas_cost));

  const levels = [elecRisk, waterTapRisk, waterGroundRisk, gasRisk];
  const overallRisk = levels.includes("red") ? "red"
    : levels.includes("yellow") ? "yellow"
    : levels.every((l) => l === "green") ? "green"
    : "none";

  const prev1 = (() => {
    const [y, m] = thisMonth.split("-").map(Number);
    const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return logs.find((l) => l.log_month === prevM);
  })();

  function changeRate(curr: number, prev: number) {
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.log_month) { setSaveErr("월을 선택해주세요"); return; }
    setSaving(true);
    setSaveErr("");
    try {
      await submitUtilityLog(form);
      const total_cost = (form.electricity_cost || 0)
        + (form.water_tap_cost || 0)
        + (form.water_ground_cost || 0)
        + (form.gas_cost || 0);
      const newLog: UtilityLog = {
        id: crypto.randomUUID(), ...form,
        total_cost, memo: form.memo || null,
        recorded_by: "방금 저장됨",
        created_at: new Date().toISOString(),
      };
      setLogs((prev) =>
        [newLog, ...prev.filter((l) => l.log_month !== form.log_month)]
          .sort((a, b) => b.log_month.localeCompare(a.log_month))
      );
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } catch (err) {
      setSaveErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const overallMeta = getRiskMeta(overallRisk);

  // 항목 정의 (수도/지하수 분리)
  const items = [
    { label: "전기",   icon: "⚡", cost: current?.electricity_cost ?? 0,  usage: current?.electricity_kwh ?? 0,  unit: "kWh", risk: elecRisk,        prevAvg: prev3.length ? prev3.reduce((s, l) => s + l.electricity_cost, 0) / prev3.length : 0 },
    { label: "수도",   icon: "🚰", cost: current?.water_tap_cost ?? 0,     usage: current?.water_tap_ton ?? 0,    unit: "ton", risk: waterTapRisk,    prevAvg: prev3.length ? prev3.reduce((s, l) => s + l.water_tap_cost, 0) / prev3.length : 0 },
    { label: "지하수", icon: "💧", cost: current?.water_ground_cost ?? 0,  usage: current?.water_ground_ton ?? 0, unit: "ton", risk: waterGroundRisk, prevAvg: prev3.length ? prev3.reduce((s, l) => s + l.water_ground_cost, 0) / prev3.length : 0 },
    { label: "가스",   icon: "🔥", cost: current?.gas_cost ?? 0,           usage: current?.gas_m3 ?? 0,           unit: "m³",  risk: gasRisk,         prevAvg: prev3.length ? prev3.reduce((s, l) => s + l.gas_cost, 0) / prev3.length : 0 },
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* 전체 리스크 배너 */}
      {overallRisk !== "none" && (
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
          overallRisk === "red" ? "bg-red-50 border-red-300" :
          overallRisk === "yellow" ? "bg-amber-50 border-amber-300" :
          "bg-emerald-50 border-emerald-200"
        }`}>
          <div>
            <div className={`text-sm font-bold ${
              overallRisk === "red" ? "text-red-700" :
              overallRisk === "yellow" ? "text-amber-700" : "text-emerald-700"
            }`}>
              {overallMeta.icon} 이번달 유틸리티 리스크: {overallMeta.label}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {thisMonth.replace("-", "년 ")}월 기준 · 직전 3개월 평균 대비 분석
            </div>
          </div>
          {current && (
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800">{fmt만(current.total_cost)}</div>
              {prev1 && (() => {
                const rate = changeRate(current.total_cost, prev1.total_cost);
                if (rate === null) return null;
                return (
                  <div className={`text-xs font-semibold ${rate > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    전월 대비 {rate > 0 ? "▲" : "▼"} {Math.abs(rate).toFixed(1)}%
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 항목별 리스크 카드 (2x2 그리드) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          const meta = getRiskMeta(item.risk);
          const ratio = item.prevAvg > 0 ? ((item.cost / item.prevAvg - 1) * 100) : null;
          return (
            <div key={item.label} className={`bg-white rounded-xl border p-4 ${
              item.risk === "red" ? "border-red-200" :
              item.risk === "yellow" ? "border-amber-200" : "border-gray-200"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">{item.icon} {item.label}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
              </div>
              <div className="text-base font-bold text-gray-800">{fmt만(item.cost)}</div>
              {item.usage > 0 && (
                <div className="text-xs text-gray-400 mt-0.5">{item.usage.toLocaleString()} {item.unit}</div>
              )}
              {ratio !== null && (
                <div className={`text-xs font-semibold mt-1 ${ratio > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  3개월 평균 대비 {ratio > 0 ? "▲" : "▼"} {Math.abs(ratio).toFixed(0)}%
                </div>
              )}
              {item.prevAvg > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${Math.min(100, (item.cost / (item.prevAvg * 1.5)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 6개월 추이 바 차트 */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-600 mb-3">📊 월별 총 비용 추이 (최근 6개월)</div>
          <BarChart logs={logs} />
        </div>
      )}

      {/* 등록 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm(!showForm); setForm({ ...EMPTY_FORM, log_month: thisMonth }); }}
          className="flex items-center gap-1 text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f] cursor-pointer"
        >
          {showForm ? "✕ 취소" : "+ 유틸리티 비용 입력"}
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#1F3864]/20 rounded-xl px-5 py-4 flex flex-col gap-4">
          <div className="text-sm font-bold text-[#1F3864]">📝 월별 유틸리티 비용 입력</div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">대상 월 *</label>
            <input type="month" value={form.log_month}
              onChange={(e) => setForm((p) => ({ ...p, log_month: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              required />
          </div>

          {/* 전기 */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            <div className="text-xs font-bold text-yellow-700 mb-2">⚡ 전기</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">사용량 (kWh)</label>
                <input type="number" min={0} value={form.electricity_kwh || ""}
                  onChange={(e) => setForm((p) => ({ ...p, electricity_kwh: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">요금 (원)</label>
                <input type="number" min={0} value={form.electricity_cost || ""}
                  onChange={(e) => setForm((p) => ({ ...p, electricity_cost: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>
            </div>
          </div>

          {/* 수도 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <div className="text-xs font-bold text-blue-700 mb-2">🚰 수도</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">사용량 (ton)</label>
                <input type="number" min={0} value={form.water_tap_ton || ""}
                  onChange={(e) => setForm((p) => ({ ...p, water_tap_ton: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">요금 (원)</label>
                <input type="number" min={0} value={form.water_tap_cost || ""}
                  onChange={(e) => setForm((p) => ({ ...p, water_tap_cost: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          {/* 지하수 */}
          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3">
            <div className="text-xs font-bold text-cyan-700 mb-2">💧 지하수</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">사용량 (ton)</label>
                <input type="number" min={0} value={form.water_ground_ton || ""}
                  onChange={(e) => setForm((p) => ({ ...p, water_ground_ton: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">요금 (원)</label>
                <input type="number" min={0} value={form.water_ground_cost || ""}
                  onChange={(e) => setForm((p) => ({ ...p, water_ground_cost: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
            </div>
          </div>

          {/* 가스 */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <div className="text-xs font-bold text-orange-700 mb-2">🔥 가스/LPG</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">사용량 (m³)</label>
                <input type="number" min={0} value={form.gas_m3 || ""}
                  onChange={(e) => setForm((p) => ({ ...p, gas_m3: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">요금 (원)</label>
                <input type="number" min={0} value={form.gas_cost || ""}
                  onChange={(e) => setForm((p) => ({ ...p, gas_cost: Number(e.target.value) || 0 }))}
                  placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">메모</label>
            <input value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder="ex) 냉동기 이상 전기 급등, 지하수 펌프 교체 후 정상화"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
          </div>

          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}

          <button type="submit" disabled={saving}
            className="self-start bg-[#1F3864] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer">
            {saving ? "저장중…" : "💾 저장"}
          </button>
        </form>
      )}

      {/* 이력 테이블 */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-600">📋 월별 유틸리티 이력</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">월</th>
                  <th className="text-right px-2 py-2 text-yellow-600 font-medium">⚡ 전기</th>
                  <th className="text-right px-2 py-2 text-blue-600 font-medium">🚰 수도</th>
                  <th className="text-right px-2 py-2 text-cyan-600 font-medium">💧 지하수</th>
                  <th className="text-right px-2 py-2 text-orange-600 font-medium">🔥 가스</th>
                  <th className="text-right px-4 py-2 text-gray-700 font-medium">합계</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log, i) => {
                  const prevLog = logs[i + 1];
                  const rate = prevLog ? changeRate(log.total_cost, prevLog.total_cost) : null;
                  const isThisMonth = log.log_month === thisMonth;
                  return (
                    <tr key={log.id} className={isThisMonth ? "bg-blue-50/50" : "hover:bg-gray-50"}>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">
                        {log.log_month.replace("-", "년 ")}월
                        {isThisMonth && <span className="ml-1 text-blue-600 font-bold text-[10px]">이번달</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt만(log.electricity_cost)}
                        {log.electricity_kwh > 0 && <span className="text-gray-400 ml-0.5">({log.electricity_kwh.toLocaleString()})</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt만(log.water_tap_cost)}
                        {log.water_tap_ton > 0 && <span className="text-gray-400 ml-0.5">({log.water_tap_ton}t)</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt만(log.water_ground_cost)}
                        {log.water_ground_ton > 0 && <span className="text-gray-400 ml-0.5">({log.water_ground_ton}t)</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-700">
                        {fmt만(log.gas_cost)}
                        {log.gas_m3 > 0 && <span className="text-gray-400 ml-0.5">({log.gas_m3}m³)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                        {fmt만(log.total_cost)}
                        {rate !== null && (
                          <span className={`ml-1 text-[10px] font-semibold ${rate > 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {rate > 0 ? "▲" : "▼"}{Math.abs(rate).toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 max-w-[140px] truncate">{log.memo ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
