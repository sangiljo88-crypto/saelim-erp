"use client";

import { useState, useTransition } from "react";
import { savePayrollMonth, bulkUpdateBaseSalaries } from "@/app/actions/submit";

interface StaffPayroll {
  login_id: string;
  name: string;
  dept: string | null;
  role: string;
  base_salary: number;
  overtime_pay: number;
  bonus: number;
  deduction: number;
  total_pay: number;
  notes: string;
  hasSaved: boolean;
}

interface Props {
  yearMonth: string;
  staff: StaffPayroll[];
}

const ROLE_LABEL: Record<string, string> = {
  manager: "팀장",
  worker:  "작업자",
};

// 원 단위 → 만원 단위 (표시용)
function toMan(won: number) {
  return Math.round(won / 10000);
}

// 만원 단위 → 원 단위 (저장용)
function toWon(man: number) {
  return man * 10000;
}

export default function PayrollSheet({ yearMonth, staff }: Props) {
  // 표시/입력은 만원 단위로 관리
  const [rows, setRows] = useState<StaffPayroll[]>(
    staff.map(s => ({
      ...s,
      base_salary:  toMan(s.base_salary),
      overtime_pay: toMan(s.overtime_pay),
      bonus:        toMan(s.bonus),
      deduction:    toMan(s.deduction),
      total_pay:    toMan(s.total_pay),
    }))
  );

  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseSaveMsg, setBaseSaveMsg] = useState<string | null>(null);
  const [baseSaveError, setBaseSaveError] = useState<string | null>(null);

  // 월 이동
  const [year, month] = yearMonth.split("-").map(Number);
  const label = `${year}년 ${month}월`;

  function goPrevMonth() {
    const d = new Date(year, month - 2, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    window.location.href = `/payroll?month=${ym}`;
  }
  function goNextMonth() {
    const d = new Date(year, month, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    window.location.href = `/payroll?month=${ym}`;
  }

  // 행 값 변경
  function updateRow(
    idx: number,
    field: "base_salary" | "overtime_pay" | "bonus" | "deduction" | "notes",
    value: string
  ) {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (field === "notes") {
        row.notes = value;
      } else {
        (row as unknown as Record<string, number | string>)[field] = value === "" ? 0 : Number(value);
      }
      // 실지급액 자동 계산
      row.total_pay = row.base_salary + row.overtime_pay + row.bonus - row.deduction;
      next[idx] = row;
      return next;
    });
  }

  // 저장된 데이터 기준 요약 (초기 hasSaved 데이터)
  const savedRows = rows.filter((_, i) => staff[i]?.hasSaved);
  const totalLaborCost = savedRows.reduce((s, r) => s + r.total_pay, 0);
  const totalBase      = savedRows.reduce((s, r) => s + r.base_salary, 0);
  const totalExtra     = savedRows.reduce((s, r) => s + r.overtime_pay + r.bonus, 0);

  // 합계 행 (전체)
  const sumBase      = rows.reduce((s, r) => s + r.base_salary, 0);
  const sumOvertime  = rows.reduce((s, r) => s + r.overtime_pay, 0);
  const sumBonus     = rows.reduce((s, r) => s + r.bonus, 0);
  const sumDeduction = rows.reduce((s, r) => s + r.deduction, 0);
  const sumTotal     = rows.reduce((s, r) => s + r.total_pay, 0);

  // 급여 저장
  function handleSave() {
    setSaveMsg(null);
    setSaveError(null);
    startTransition(async () => {
      const records = rows.map((r, i) => ({
        login_id:      r.login_id,
        employee_name: r.name,
        dept:          r.dept,
        base_salary:   toWon(r.base_salary),
        overtime_pay:  toWon(r.overtime_pay),
        bonus:         toWon(r.bonus),
        deduction:     toWon(r.deduction),
        total_pay:     toWon(r.total_pay),
        notes:         r.notes,
      }));
      const res = await savePayrollMonth(yearMonth, records);
      if (res?.error) {
        setSaveError(res.error);
      } else {
        setSaveMsg(`✅ ${label} 급여 저장 완료 — CEO 인건비 KPI 반영`);
      }
    });
  }

  // 기본급 일괄 저장
  function handleBaseSave() {
    setBaseSaveMsg(null);
    setBaseSaveError(null);
    startTransition(async () => {
      const updates = rows.map(r => ({
        login_id:    r.login_id,
        name:        r.name,
        dept:        r.dept,
        base_salary: toWon(r.base_salary),
      }));
      const res = await bulkUpdateBaseSalaries(updates);
      if (res?.error) {
        setBaseSaveError(res.error);
      } else {
        setBaseSaveMsg("✅ 기본급 저장 완료 — 다음 달 입력 시 자동 pre-fill됩니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 월 선택 헤더 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
        <button
          onClick={goPrevMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          ← 이전달
        </button>
        <span className="font-bold text-gray-800 text-base">{label} 급여</span>
        <button
          onClick={goNextMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          다음달 →
        </button>
      </div>

      {/* 요약 카드 3개 (저장된 데이터 기준) */}
      {savedRows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-xs text-gray-400 mb-1">총 인건비</div>
            <div className="text-xl font-bold text-[#1F3864]">
              {totalLaborCost.toLocaleString()}만원
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{savedRows.length}명 합산</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-xs text-gray-400 mb-1">기본급 합계</div>
            <div className="text-xl font-bold text-gray-700">
              {totalBase.toLocaleString()}만원
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-xs text-gray-400 mb-1">연장/상여 합계</div>
            <div className="text-xl font-bold text-emerald-600">
              {totalExtra.toLocaleString()}만원
            </div>
          </div>
        </div>
      )}

      {/* 기본급 저장 버튼 + 메시지 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBaseSave}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-200 transition disabled:opacity-50"
        >
          {isPending ? "처리 중..." : "기본급 저장 (staff_salaries 동기화)"}
        </button>
        {baseSaveMsg && (
          <span className="text-sm text-emerald-600">{baseSaveMsg}</span>
        )}
        {baseSaveError && (
          <span className="text-sm text-red-500">{baseSaveError}</span>
        )}
      </div>

      {/* 입력 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs">
              <th className="px-4 py-3 text-left font-semibold">이름</th>
              <th className="px-3 py-3 text-left font-semibold">부서</th>
              <th className="px-3 py-3 text-left font-semibold">역할</th>
              <th className="px-3 py-3 text-right font-semibold">기본급(만원)</th>
              <th className="px-3 py-3 text-right font-semibold">연장수당(만원)</th>
              <th className="px-3 py-3 text-right font-semibold">상여(만원)</th>
              <th className="px-3 py-3 text-right font-semibold">공제(만원)</th>
              <th className="px-3 py-3 text-right font-semibold text-blue-600">실지급액(만원)</th>
              <th className="px-3 py-3 text-left font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.login_id}
                className={[
                  "border-b border-gray-50 hover:bg-gray-50 transition",
                  staff[idx]?.hasSaved ? "bg-emerald-50/60" : "",
                ].join(" ")}
              >
                <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap">
                  {row.name}
                  {staff[idx]?.hasSaved && (
                    <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">저장됨</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.dept ?? "-"}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                  {ROLE_LABEL[row.role] ?? row.role}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.base_salary || ""}
                    onChange={e => updateRow(idx, "base_salary", e.target.value)}
                    className="w-24 text-right border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.overtime_pay || ""}
                    onChange={e => updateRow(idx, "overtime_pay", e.target.value)}
                    className="w-24 text-right border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.bonus || ""}
                    onChange={e => updateRow(idx, "bonus", e.target.value)}
                    className="w-24 text-right border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.deduction || ""}
                    onChange={e => updateRow(idx, "deduction", e.target.value)}
                    className="w-24 text-right border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-bold text-blue-600 text-base">
                    {row.total_pay.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={e => updateRow(idx, "notes", e.target.value)}
                    className="w-28 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    placeholder="메모"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {/* 합계 행 */}
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-200 font-semibold text-gray-700">
              <td className="px-4 py-3" colSpan={3}>합계 ({rows.length}명)</td>
              <td className="px-3 py-3 text-right">{sumBase.toLocaleString()}</td>
              <td className="px-3 py-3 text-right">{sumOvertime.toLocaleString()}</td>
              <td className="px-3 py-3 text-right">{sumBonus.toLocaleString()}</td>
              <td className="px-3 py-3 text-right">{sumDeduction.toLocaleString()}</td>
              <td className="px-3 py-3 text-right text-blue-700 font-bold text-base">
                {sumTotal.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 저장 버튼 + 메시지 */}
      <div className="flex items-center gap-3 pb-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-6 py-2.5 rounded-lg bg-[#1F3864] text-white font-semibold text-sm hover:bg-[#162c52] transition disabled:opacity-50"
        >
          {isPending ? "저장 중..." : `${label} 급여 저장`}
        </button>
        {saveMsg && (
          <span className="text-sm text-emerald-600 font-medium">{saveMsg}</span>
        )}
        {saveError && (
          <span className="text-sm text-red-500">{saveError}</span>
        )}
      </div>
    </div>
  );
}
