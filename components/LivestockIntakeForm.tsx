"use client";

import { useState } from "react";
import { submitLivestockIntake } from "@/app/actions/submit";

export default function LivestockIntakeForm() {
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [nhLedger, setNhLedger] = useState(0);
  const [nhActual, setNhActual] = useState(0);
  const [mokwuchon, setMokwuchon] = useState(0);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");

  const diff = nhActual - nhLedger;

  async function handleSubmit() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("intake_date", date);
      fd.set("nh_ledger",   String(nhLedger));
      fd.set("nh_actual",   String(nhActual));
      fd.set("mokwuchon",   String(mokwuchon));
      fd.set("notes",       notes);
      await submitLivestockIntake(fd);
      setDone(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2">✅</div>
      <div className="font-bold text-emerald-700">농협 입고 두수 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">계속 입력</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">농협 유통 입고 두수</div>
        <div className="text-xs text-blue-200 mt-0.5">장부 vs 실입고 차이 관리</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">입고 날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
        </div>

        {/* 입력 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-blue-700">농협유통 장부</label>
            <input type="number" value={nhLedger || ""}
              onChange={(e) => setNhLedger(Number(e.target.value))}
              placeholder="두"
              className="border border-blue-300 rounded-lg px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-blue-500 bg-white" />
            <span className="text-[10px] text-blue-500 text-center">두</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-amber-700">농협유통 실입고</label>
            <input type="number" value={nhActual || ""}
              onChange={(e) => setNhActual(Number(e.target.value))}
              placeholder="두"
              className="border border-amber-300 rounded-lg px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-amber-500 bg-white" />
            <span className="text-[10px] text-amber-500 text-center">두</span>
          </div>
          <div className="flex flex-col gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <label className="text-xs font-semibold text-gray-700">목우촌</label>
            <input type="number" value={mokwuchon || ""}
              onChange={(e) => setMokwuchon(Number(e.target.value))}
              placeholder="두"
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-gray-500 bg-white" />
            <span className="text-[10px] text-gray-400 text-center">두</span>
          </div>
        </div>

        {/* 차이 자동 계산 */}
        <div className={`rounded-xl p-4 border-2 text-center ${
          diff === 0 ? "bg-emerald-50 border-emerald-300" :
          diff > 0 ? "bg-blue-50 border-blue-300" : "bg-red-50 border-red-300"
        }`}>
          <div className="text-xs font-semibold text-gray-500 mb-1">차이 (실입고 - 장부)</div>
          <div className={`text-2xl font-bold ${
            diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-red-600"
          }`}>
            {diff > 0 ? "+" : ""}{diff} 두
          </div>
          <div className="text-xs mt-1 text-gray-400">
            {diff === 0 ? "✅ 정확히 일치" : diff > 0 ? "📈 초과 입고" : "📉 부족 입고"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">비고</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="특이사항이 있으면 입력"
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading || !nhLedger && !nhActual}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "입고 기록 저장"}
        </button>
      </div>
    </div>
  );
}
