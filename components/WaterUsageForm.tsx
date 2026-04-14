"use client";

import { useState } from "react";
import { submitWaterUsage } from "@/app/actions/production";

export default function WaterUsageForm({
  recentData,
}: {
  recentData?: Array<{ usage_date: string; water_reading: number; ground_water_reading: number }>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      await submitWaterUsage(fd);
      setDone(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2">✅</div>
      <div className="font-bold text-emerald-700">수도 사용량 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">계속 입력</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">수도 / 지하수 사용량</div>
        <div className="text-xs text-blue-200 mt-0.5">일별 검침값 기록 · 새림 수도 및 지하수 관리</div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">검침 날짜</label>
          <input type="date" name="usage_date" defaultValue={today} required
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🚰</span>
              <label className="text-xs font-bold text-blue-800">수도 사용량</label>
            </div>
            <input type="number" name="water_reading" step="0.1" required
              placeholder="예: 31"
              className="border border-blue-300 rounded-lg px-3 py-2.5 text-lg font-bold text-center outline-none focus:border-blue-500 bg-white" />
            <span className="text-xs text-blue-500 text-center">㎥</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-teal-50 border border-teal-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🌊</span>
              <label className="text-xs font-bold text-teal-800">지하수 사용량</label>
            </div>
            <input type="number" name="ground_water_reading" step="0.1" required
              placeholder="예: 8"
              className="border border-teal-300 rounded-lg px-3 py-2.5 text-lg font-bold text-center outline-none focus:border-teal-500 bg-white" />
            <span className="text-xs text-teal-500 text-center">㎥</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">비고</label>
          <input type="text" name="notes" placeholder="특이사항 (예: 배관 누수 확인 등)"
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
        </div>

        {/* 최근 기록 */}
        {recentData && recentData.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">최근 기록</div>
            <div className="divide-y divide-gray-100">
              {recentData.slice(0, 5).map((r) => (
                <div key={r.usage_date} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-gray-500">{r.usage_date}</span>
                  <div className="flex gap-4">
                    <span className="text-blue-600 font-medium">수도 {r.water_reading}㎥</span>
                    <span className="text-teal-600 font-medium">지하수 {r.ground_water_reading}㎥</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "검침값 저장"}
        </button>
      </form>
    </div>
  );
}
