"use client";

import { useState } from "react";
import { submitProductionPlan } from "@/app/actions/submit";

interface PlanItem {
  task: string;
  pkg_unit_g: number | "";
  raw_input_kg: number | "";
  target_count: number | "";
  workers: number | "";
  work_hours: string;
}

function makePlan(): PlanItem {
  return { task: "", pkg_unit_g: "", raw_input_kg: "", target_count: "", workers: "", work_hours: "" };
}

// ── PlanTable을 최상위 컴포넌트로 분리 (핵심 수정) ────────────────────────────
// 부모 컴포넌트 안에 정의하면 렌더링마다 새 컴포넌트 타입 → 언마운트/포커스 손실
interface PlanTableProps {
  plans: PlanItem[];
  setPlans: (v: PlanItem[]) => void;
  label: string;
  color: string;
}

function PlanTable({ plans, setPlans, label, color }: PlanTableProps) {
  function update(i: number, field: keyof PlanItem, val: string | number) {
    setPlans(plans.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between ${color}`}>
        <span className="text-xs font-bold">{label}</span>
        <button
          type="button"
          onClick={() => setPlans([...plans, makePlan()])}
          className="text-xs bg-white/80 px-2.5 py-1 rounded-lg font-semibold cursor-pointer hover:bg-white"
        >
          + 행 추가
        </button>
      </div>

      {/* 헤더 */}
      <div className="px-3 pt-3 pb-1">
        <div
          className="grid text-[10px] text-gray-400 font-semibold px-1 gap-1"
          style={{ gridTemplateColumns: "2fr 70px 80px 70px 50px 90px 20px" }}
        >
          <span>작업내용</span>
          <span className="text-center">포장단위(g)</span>
          <span className="text-center">원료투입(kg)</span>
          <span className="text-center">목표개수</span>
          <span className="text-center">인원</span>
          <span className="text-center">근무시간</span>
          <span />
        </div>
      </div>

      {/* 행 */}
      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {plans.map((plan, i) => (
          <div
            key={i}
            className="grid gap-1 items-center"
            style={{ gridTemplateColumns: "2fr 70px 80px 70px 50px 90px 20px" }}
          >
            <input
              type="text"
              value={plan.task}
              onChange={(e) => update(i, "task", e.target.value)}
              placeholder="예) 스킨슬라이스 작업"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864]"
            />
            <input
              type="number"
              value={plan.pkg_unit_g}
              onChange={(e) => update(i, "pkg_unit_g", e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="g"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
            />
            <input
              type="number"
              value={plan.raw_input_kg}
              onChange={(e) => update(i, "raw_input_kg", e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="kg"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
            />
            <input
              type="number"
              value={plan.target_count}
              onChange={(e) => update(i, "target_count", e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="개"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
            />
            <input
              type="number"
              value={plan.workers}
              onChange={(e) => update(i, "workers", e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="명"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
            />
            <input
              type="text"
              value={plan.work_hours}
              onChange={(e) => update(i, "work_hours", e.target.value)}
              placeholder="08:00~17:00"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864]"
            />
            <button
              type="button"
              onClick={() => setPlans(plans.filter((_, idx) => idx !== i))}
              className="text-gray-300 hover:text-red-400 text-base cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}

        {plans.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">
            행을 추가해 계획을 입력하세요
          </p>
        )}
      </div>
    </div>
  );
}

// ── 메인 폼 ────────────────────────────────────────────────────────────────────
export default function ProductionPlanForm() {
  const today    = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  const [planDate,    setPlanDate]    = useState(today);
  const [todayPlans,  setTodayPlans]  = useState<PlanItem[]>([makePlan()]);
  const [nextPlans,   setNextPlans]   = useState<PlanItem[]>([makePlan()]);
  const [notes,       setNotes]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitProductionPlan(
        planDate,
        todayPlans.filter((p) => p.task),
        nextPlans.filter((p) => p.task),
        notes,
      );
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
      <p className="text-xs text-emerald-600 mt-1">CEO · COO · CFO · 각 팀장에게 공유됩니다</p>
      <button
        onClick={() => setDone(false)}
        className="mt-3 text-sm text-emerald-700 underline cursor-pointer"
      >
        다시 작성
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">당일 / 익일 생산계획</div>
        <div className="text-xs text-blue-200 mt-0.5">공장장 작성 · CEO·COO·CFO·팀장 전체 공유</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 날짜 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">기준 날짜 (당일)</label>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]"
            />
            <span className="text-xs text-gray-400">→ 익일: {tomorrow}</span>
          </div>
        </div>

        {/* 당일 */}
        <PlanTable
          plans={todayPlans}
          setPlans={setTodayPlans}
          label={`📋 당일 생산 현황 (${planDate})`}
          color="bg-blue-50 text-blue-800"
        />

        {/* 익일 */}
        <PlanTable
          plans={nextPlans}
          setPlans={setNextPlans}
          label={`📅 익일 생산 계획 (${tomorrow})`}
          color="bg-amber-50 text-amber-800"
        />

        {/* 전달사항 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">전달사항 / 특이사항</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="각 팀에 전달할 사항, 인원 변경, 특이사항 등..."
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864] resize-none"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
        >
          {loading ? "저장 중..." : "생산계획 저장"}
        </button>
      </div>
    </div>
  );
}
