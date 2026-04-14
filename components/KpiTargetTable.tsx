"use client";

import { useState, useEffect, useTransition } from "react";
import { upsertKpiTarget, initDefaultTargets } from "@/app/actions/kpi-targets";
import type { KpiTarget } from "@/app/actions/kpi-targets";
import { DEPT_ORDER_WITH_ALL } from "@/lib/constants";

export default function KpiTargetTable({
  targets,
  year,
}: {
  targets: KpiTarget[];
  year: number;
}) {
  const [localTargets, setLocalTargets] = useState<KpiTarget[]>(targets);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 서버에서 새 props가 오면 동기화
  useEffect(() => { setLocalTargets(targets); }, [targets]);

  // 부서별 그룹핑
  const grouped = new Map<string, KpiTarget[]>();
  for (const t of localTargets) {
    const arr = grouped.get(t.dept) ?? [];
    arr.push(t);
    grouped.set(t.dept, arr);
  }

  const sortedDepts = DEPT_ORDER_WITH_ALL.filter((d) => grouped.has(d));

  function rowKey(t: KpiTarget) {
    return `${t.dept}__${t.kpi_key}`;
  }

  function handleEdit(t: KpiTarget) {
    setEditingKey(rowKey(t));
    setEditValue(String(t.target_value));
    setMessage(null);
  }

  function handleCancel() {
    setEditingKey(null);
    setEditValue("");
  }

  function handleSave(t: KpiTarget) {
    const numVal = Number(editValue);
    if (isNaN(numVal)) {
      setMessage({ type: "error", text: "숫자를 입력해주세요" });
      return;
    }
    startTransition(async () => {
      const result = await upsertKpiTarget(
        t.dept,
        t.kpi_key,
        t.label,
        numVal,
        t.unit,
        year,
        t.quarter
      );
      if (result.success) {
        // 로컬 state 즉시 반영
        setLocalTargets((prev) =>
          prev.map((item) =>
            item.dept === t.dept && item.kpi_key === t.kpi_key
              ? { ...item, target_value: numVal }
              : item
          )
        );
        setMessage({ type: "success", text: `${t.dept} ${t.label} 목표가 ${numVal}${t.unit}(으)로 변경되었습니다` });
        setEditingKey(null);
      } else {
        setMessage({ type: "error", text: result.error ?? "저장 실패" });
      }
    });
  }

  function handleInit() {
    if (!confirm(`${year}년 KPI 목표를 기본값으로 초기화합니다.\n기존 값이 있으면 덮어씁니다. 진행할까요?`)) return;
    startTransition(async () => {
      const result = await initDefaultTargets(year);
      if (result.success) {
        setMessage({ type: "success", text: `${year}년 기본 목표 ${result.count}건이 설정되었습니다` });
      } else {
        setMessage({ type: "error", text: result.error ?? "초기화 실패" });
      }
    });
  }

  function formatValue(val: number, unit: string) {
    if (unit === "원" || unit === "원/월") {
      if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(1)}억`;
      if (val >= 10_000) return `${Math.round(val / 10_000).toLocaleString()}만`;
      return val.toLocaleString();
    }
    return val.toLocaleString();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 액션 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          총 {localTargets.length}개 지표 · {sortedDepts.length}개 부서
        </div>
        <button
          onClick={handleInit}
          disabled={isPending}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "처리 중..." : `${year}년 기본값으로 초기화`}
        </button>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`text-sm px-4 py-2.5 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 부서별 테이블 */}
      {sortedDepts.map((dept) => {
        const items = grouped.get(dept) ?? [];
        return (
          <div key={dept} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1F3864] text-white px-4 py-2.5 text-sm font-semibold">
              {dept}
              <span className="ml-2 text-blue-200 font-normal">{items.length}개 지표</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium">지표명</th>
                  <th className="text-right px-4 py-2 font-medium">현재 목표치</th>
                  <th className="text-center px-4 py-2 font-medium">단위</th>
                  <th className="text-center px-4 py-2 font-medium w-24">수정</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const key = rowKey(t);
                  const isEditing = editingKey === key;
                  return (
                    <tr key={key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">{t.label}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(t);
                              if (e.key === "Escape") handleCancel();
                            }}
                            className="w-40 text-right border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold text-[#1F3864]">
                            {formatValue(t.target_value, t.unit)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-500">{t.unit}</td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSave(t)}
                              disabled={isPending}
                              className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a4a7f] transition-colors disabled:opacity-50"
                            >
                              {isPending ? "..." : "저장"}
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(t)}
                            className="text-xs text-[#1F3864] hover:text-[#2a4a7f] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items[0]?.updated_by && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                최종 수정: {items[0].updated_by} · {items[0].updated_at ? new Date(items[0].updated_at).toLocaleDateString("ko-KR") : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
