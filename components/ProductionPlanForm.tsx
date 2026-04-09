"use client";

import { useState } from "react";
import { submitProductionPlan } from "@/app/actions/submit";

interface PlanItem {
  team: string;
  product: string;
  target: number;
  notes: string;
}

const TEAMS = ["생산팀(두/내장)", "스킨팀", "가공팀", "배송팀"];
const PRODUCTS = [
  "돼지머리(두)", "돼지내장", "스킨작업", "소선지", "순도리돈두슬라이스",
  "편육", "모듬내장", "국머리혼합", "족발", "수육", "기타",
];

function makePlan(): PlanItem {
  return { team: "", product: "", target: 0, notes: "" };
}

export default function ProductionPlanForm() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [planDate, setPlanDate] = useState(today);
  const [todayPlans, setTodayPlans] = useState<PlanItem[]>([makePlan()]);
  const [nextPlans, setNextPlans] = useState<PlanItem[]>([makePlan()]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(list: PlanItem[], setList: (v: PlanItem[]) => void, i: number, field: keyof PlanItem, val: string | number) {
    setList(list.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitProductionPlan(planDate, todayPlans.filter((p) => p.product), nextPlans.filter((p) => p.product), notes);
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
      <div className="font-bold text-emerald-700">생산계획 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">다시 작성</button>
    </div>
  );

  function PlanTable({ plans, setPlans, label, color }: { plans: PlanItem[]; setPlans: (v: PlanItem[]) => void; label: string; color: string }) {
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between ${color}`}>
          <span className="text-xs font-bold">{label}</span>
          <button type="button" onClick={() => setPlans([...plans, makePlan()])}
            className="text-xs bg-white/80 px-2.5 py-1 rounded-lg font-semibold cursor-pointer hover:bg-white">
            + 추가
          </button>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <div className="grid text-[10px] text-gray-400 font-semibold px-1"
            style={{ gridTemplateColumns: "1fr 1.5fr 80px 1fr 20px" }}>
            <span>팀</span><span>품목</span><span className="text-center">목표수량</span><span>비고</span><span />
          </div>
          {plans.map((plan, i) => (
            <div key={i} className="grid gap-1 items-center"
              style={{ gridTemplateColumns: "1fr 1.5fr 80px 1fr 20px" }}>
              <select value={plan.team} onChange={(e) => update(plans, setPlans, i, "team", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864] bg-white">
                <option value="">팀 선택</option>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={plan.product} onChange={(e) => update(plans, setPlans, i, "product", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864] bg-white">
                <option value="">품목 선택</option>
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="number" value={plan.target || ""}
                onChange={(e) => update(plans, setPlans, i, "target", Number(e.target.value))}
                placeholder="두/kg"
                className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]" />
              <input type="text" value={plan.notes}
                onChange={(e) => update(plans, setPlans, i, "notes", e.target.value)}
                placeholder="비고"
                className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864]" />
              <button type="button" onClick={() => setPlans(plans.filter((_, idx) => idx !== i))}
                className="text-gray-300 hover:text-red-400 text-base cursor-pointer">×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">당일 / 익일 생산계획</div>
        <div className="text-xs text-blue-200 mt-0.5">공장장 작성 · 팀별 생산 목표 공유</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">기준 날짜 (당일)</label>
          <div className="flex gap-2 items-center">
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
            <span className="text-xs text-gray-400">→ 익일: {tomorrow}</span>
          </div>
        </div>

        <PlanTable plans={todayPlans} setPlans={setTodayPlans}
          label={`📋 당일 생산 현황 (${planDate})`}
          color="bg-blue-50 text-blue-800" />

        <PlanTable plans={nextPlans} setPlans={setNextPlans}
          label={`📅 익일 생산 계획 (${tomorrow})`}
          color="bg-amber-50 text-amber-800" />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">전달사항 / 특이사항</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="각 팀에 전달할 사항, 인원 변경, 특이사항 등..."
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864] resize-none" />
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "생산계획 저장"}
        </button>
      </div>
    </div>
  );
}
