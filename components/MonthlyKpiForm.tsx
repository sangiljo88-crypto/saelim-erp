"use client";

import { useState } from "react";
import { saveMonthlyKpi } from "@/app/actions/submit";

interface Props {
  yearMonth: string; // "2026-04"
  existing: {
    profit_margin: number | null;
    cash_balance: number | null;  // 원 단위
    receivables: number | null;   // 원 단위
    revenue: number | null;       // 원 단위 (납품전표 자동집계, 읽기전용)
  };
}

function fmt억(n: number | null) {
  if (!n) return null;
  return (n / 100_000_000).toFixed(2);
}

export default function MonthlyKpiForm({ yearMonth, existing }: Props) {
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const label = `${yearMonth.slice(0, 4)}년 ${parseInt(yearMonth.slice(5))}월`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("year_month", yearMonth);
      const result = await saveMonthlyKpi(fd);
      if ("error" in result) {
        setError(result.error ?? "저장 실패");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-700">💰 월간 재무 KPI 입력</div>
          <div className="text-xs text-gray-400 mt-0.5">{label} · 저장 즉시 CEO 대시보드에 반영됩니다</div>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
          → CEO 대시보드
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">

        {/* 매출 — 읽기전용 (납품전표 자동집계) */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3.5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-blue-700 mb-0.5">이번 달 매출</div>
            <div className="text-xs text-blue-500">납품전표 저장 시 자동 집계 · 수동 입력 불필요</div>
          </div>
          <div className="text-right shrink-0">
            {existing.revenue ? (
              <div className="text-xl font-bold text-blue-700">
                {(existing.revenue / 100_000_000).toFixed(1)}억원
              </div>
            ) : (
              <div className="text-sm text-blue-400 font-medium">납품전표 입력 시 반영</div>
            )}
          </div>
        </div>

        {/* 입력 3개 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* 영업이익률 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-600">
              영업이익률 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                name="profit_margin"
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                defaultValue={existing.profit_margin ?? ""}
                placeholder="예: 7.9"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm pr-8 outline-none focus:border-[#1F3864] focus:ring-1 focus:ring-[#1F3864]/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-semibold">%</span>
            </div>
            <div className="text-xs text-gray-400">목표: 10% 이상</div>
          </div>

          {/* 현금잔고 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-600">
              현금잔고 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                name="cash_balance"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={fmt억(existing.cash_balance) ?? ""}
                placeholder="예: 11.8"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm pr-12 outline-none focus:border-[#1F3864] focus:ring-1 focus:ring-[#1F3864]/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">억원</span>
            </div>
            <div className="text-xs text-gray-400">목표: 10억 이상</div>
          </div>

          {/* 미수금 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-600">
              미수금 <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                name="receivables"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={fmt억(existing.receivables) ?? ""}
                placeholder="예: 3.8"
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm pr-12 outline-none focus:border-[#1F3864] focus:ring-1 focus:ring-[#1F3864]/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">억원</span>
            </div>
            <div className="text-xs text-gray-400">목표: 2억 이하</div>
          </div>
        </div>

        {/* 에러 / 성공 */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 font-semibold">
            ✅ 저장 완료 — CEO 대시보드에 반영되었습니다
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#1F3864] text-white font-semibold rounded-xl text-sm
            hover:bg-[#1a2f58] disabled:opacity-50 transition-colors"
        >
          {saving ? "저장 중..." : `${label} KPI 저장 → CEO 대시보드 반영`}
        </button>
      </form>
    </div>
  );
}
