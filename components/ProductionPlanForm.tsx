"use client";

import { useState } from "react";
import { submitProductionPlan } from "@/app/actions/production";

// ── 팀별 기본 작업 템플릿 (실제 업무지시 기반) ───────────────────────────────
const DEPT_TEMPLATES: Record<string, { task: string; pkg_unit_g: number }[]> = {
  "스킨팀": [
    { task: "팜스코 꼬들목살",     pkg_unit_g: 300 },
    { task: "목우촌 꼬들살",       pkg_unit_g: 300 },
    { task: "뿔향정살",            pkg_unit_g: 500 },
    { task: "오아시스 꼬들살",     pkg_unit_g: 300 },
    { task: "오아시스 두항정살",   pkg_unit_g: 300 },
    { task: "오아시스 뿔살",       pkg_unit_g: 300 },
    { task: "목우촌 두항정살",     pkg_unit_g: 300 },
    { task: "조각머리",            pkg_unit_g: 0 },
    { task: "뒷판+발골",           pkg_unit_g: 0 },
    { task: "틀 작업",             pkg_unit_g: 0 },
  ],
  "가공팀": [
    { task: "해장국",              pkg_unit_g: 430 },
    { task: "국머리혼합",          pkg_unit_g: 2000 },
    { task: "모듬내장",            pkg_unit_g: 2000 },
    { task: "편육",                pkg_unit_g: 300 },
    { task: "돈까스",              pkg_unit_g: 1000 },
    { task: "막창슬라이스",        pkg_unit_g: 5000 },
    { task: "소선지",              pkg_unit_g: 500 },
    { task: "소창슬라이스",        pkg_unit_g: 2000 },
    { task: "순도리돈두슬라이스",  pkg_unit_g: 2000 },
    { task: "양념막창",            pkg_unit_g: 200 },
    { task: "양념곱창",            pkg_unit_g: 200 },
    { task: "두태다대기",          pkg_unit_g: 400 },
    { task: "떡갈비",              pkg_unit_g: 1000 },
    { task: "기타",                pkg_unit_g: 0 },
  ],
  "생산팀": [
    { task: "돼지머리(두) 작업",   pkg_unit_g: 0 },
    { task: "돼지내장 작업",       pkg_unit_g: 0 },
    { task: "편육 작업",           pkg_unit_g: 500 },
    { task: "기타",                pkg_unit_g: 0 },
  ],
};
const DEFAULT_TEMPLATE = [
  { task: "작업 1", pkg_unit_g: 0 },
  { task: "작업 2", pkg_unit_g: 0 },
];

// ── 팀별 기본 작업자 (DB에 없을 경우 fallback) ────────────────────────────────
const DEPT_DEFAULT_WORKERS: Record<string, string[]> = {
  "가공팀": ["쿠이", "배선화", "바른", "라이", "김하늘", "이상일", "서아원", "신태환", "이수아", "꾸앤", "이정은", "수닐", "바하두르", "마잉"],
  "스킨팀": ["체리", "비아", "김연화", "박생명", "니차건"],
};

interface PlanRow {
  task: string;           // 고정 (수정 가능)
  pkg_unit_g: number;     // 고정 (수정 가능)
  raw_input_kg: string;   // 입력
  target_count: string;   // 입력
  selected_workers: string[]; // 클릭 선택
  work_hours: string;     // 입력 (예: 08:00~17:00)
}

function makeRows(dept: string): PlanRow[] {
  const tpl = DEPT_TEMPLATES[dept] ?? DEFAULT_TEMPLATE;
  return tpl.map((t) => ({
    task:             t.task,
    pkg_unit_g:       t.pkg_unit_g,
    raw_input_kg:     "",
    target_count:     "",
    selected_workers: [],
    work_hours:       "08:00~17:00",
  }));
}

// ── WorkerPicker: 이름 칩 클릭 선택 ──────────────────────────────────────────
function WorkerPicker({
  workers,
  selected,
  onChange,
}: {
  workers: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  if (workers.length === 0) {
    return (
      <input
        type="number"
        value={selected.length || ""}
        onChange={(e) => {
          // workers 없으면 숫자 직접 입력 → 더미 배열 생성
          const n = Number(e.target.value);
          onChange(Array.from({ length: n }, (_, i) => `인원${i + 1}`));
        }}
        placeholder="명"
        className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center w-14 outline-none focus:border-[#1F3864]"
      />
    );
  }

  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name],
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {workers.map((name) => {
        const on = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            className={`text-[10px] px-2 py-1 rounded-full border font-medium cursor-pointer transition-colors
              ${on
                ? "bg-[#1F3864] text-white border-[#1F3864]"
                : "bg-white text-gray-500 border-gray-200 hover:border-[#1F3864]"}`}
          >
            {name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <span className="text-[10px] text-[#1F3864] font-bold self-center">
          {selected.length}명
        </span>
      )}
    </div>
  );
}

// ── PlanTable ─────────────────────────────────────────────────────────────────
// 반드시 최상위 컴포넌트로 선언 (내부 선언 시 매 렌더마다 언마운트 → 포커스 손실)
interface PlanTableProps {
  rows: PlanRow[];
  setRows: (v: PlanRow[]) => void;
  workers: string[];
  label: string;
  color: string;
}

function PlanTable({ rows, setRows, workers, label, color }: PlanTableProps) {
  function update<K extends keyof PlanRow>(i: number, field: K, val: PlanRow[K]) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* 헤더 바 */}
      <div className={`px-4 py-3 border-b border-gray-200 ${color}`}>
        <span className="text-xs font-bold">{label}</span>
      </div>

      <div className="divide-y divide-gray-100">
        {rows.map((row, i) => (
          <div key={i} className="p-3 flex flex-col gap-2">
            {/* 1행: 작업내용 + 포장단위 */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={row.task}
                onChange={(e) => update(i, "task", e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-[#1F3864] bg-blue-50/40"
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={row.pkg_unit_g || ""}
                  onChange={(e) => update(i, "pkg_unit_g", Number(e.target.value))}
                  placeholder="0"
                  className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
                />
                <span className="text-[10px] text-gray-400">g</span>
              </div>
            </div>

            {/* 2행: 원료투입 / 목표개수 / 근무시간 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400">원료투입(kg)</span>
                <input
                  type="number"
                  value={row.raw_input_kg}
                  onChange={(e) => update(i, "raw_input_kg", e.target.value)}
                  placeholder="kg"
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400">목표개수</span>
                <input
                  type="number"
                  value={row.target_count}
                  onChange={(e) => update(i, "target_count", e.target.value)}
                  placeholder="개"
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864]"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-400">근무시간</span>
                <input
                  type="text"
                  value={row.work_hours}
                  onChange={(e) => update(i, "work_hours", e.target.value)}
                  placeholder="08:00~17:00"
                  className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864]"
                />
              </div>
            </div>

            {/* 3행: 작업인원 선택 */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400">작업인원 선택</span>
              <WorkerPicker
                workers={workers}
                selected={row.selected_workers}
                onChange={(v) => update(i, "selected_workers", v)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 메인 폼 ───────────────────────────────────────────────────────────────────
interface ProductionPlanFormProps {
  dept?: string;
  workers?: string[];
}

export default function ProductionPlanForm({ dept = "생산팀", workers = [] }: ProductionPlanFormProps) {
  // DB에 worker 계정이 없으면 팀별 기본 명단 사용
  const effectiveWorkers = workers.length > 0 ? workers : (DEPT_DEFAULT_WORKERS[dept] ?? []);
  const today    = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  const [planDate,   setPlanDate]   = useState(today);
  const [todayRows,  setTodayRows]  = useState<PlanRow[]>(() => makeRows(dept));
  const [nextRows,   setNextRows]   = useState<PlanRow[]>(() => makeRows(dept));
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitProductionPlan(
        planDate,
        todayRows.filter((r) => r.task),
        nextRows.filter((r) => r.task),
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
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">
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
          rows={todayRows}
          setRows={setTodayRows}
          workers={effectiveWorkers}
          label={`📋 당일 생산 현황 (${planDate})`}
          color="bg-blue-50 text-blue-800"
        />

        {/* 익일 */}
        <PlanTable
          rows={nextRows}
          setRows={setNextRows}
          workers={effectiveWorkers}
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
