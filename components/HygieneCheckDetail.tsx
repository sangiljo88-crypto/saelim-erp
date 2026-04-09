"use client";

import { useState } from "react";

interface HygieneRow {
  worker_name: string;
  dept: string;
  all_passed: boolean;
  items?: Record<string, boolean> | null;
}

export default function HygieneCheckDetail({ checks }: { checks: HygieneRow[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (checks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
        <div className="text-sm text-gray-400">오늘 위생점검 입력 없음</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {checks.map((h, i) => {
        const isOpen = expanded === i;
        const failedItems = h.items
          ? Object.entries(h.items).filter(([, v]) => v === false)
          : [];
        const passedItems = h.items
          ? Object.entries(h.items).filter(([, v]) => v === true)
          : [];
        const totalItems = h.items ? Object.keys(h.items).length : 0;

        return (
          <div
            key={i}
            className={`rounded-xl border overflow-hidden transition-all ${
              h.all_passed ? "border-emerald-200" : "border-red-200"
            }`}
          >
            {/* 헤더 행 — 클릭하면 펼침 */}
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors cursor-pointer ${
                h.all_passed
                  ? "bg-white hover:bg-emerald-50"
                  : "bg-red-50 hover:bg-red-100"
              }`}
            >
              <span className={`text-lg shrink-0 ${h.all_passed ? "text-emerald-500" : "text-red-500"}`}>
                {h.all_passed ? "✅" : "❌"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800">{h.worker_name}</span>
                {h.dept && (
                  <span className="ml-2 text-xs text-gray-400">{h.dept}</span>
                )}
              </div>
              {totalItems > 0 && (
                <span className="text-xs text-gray-400 shrink-0">
                  {passedItems.length}/{totalItems}항목
                </span>
              )}
              <span
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  h.all_passed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {h.all_passed ? "전체 통과" : `불합격 ${failedItems.length}항목`}
              </span>
              <span className="text-gray-400 text-xs shrink-0">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* 상세 항목 — 펼쳤을 때 */}
            {isOpen && h.items && (
              <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                {/* 불합격 항목 먼저 */}
                {failedItems.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                      ❌ 불합격 항목 ({failedItems.length}건)
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {failedItems.map(([key]) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                        >
                          <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">✕</span>
                          </span>
                          <span className="text-sm text-red-700 font-medium">{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 통과 항목 */}
                {passedItems.length > 0 && (
                  <div>
                    {failedItems.length > 0 && (
                      <div className="text-xs font-semibold text-emerald-600 mb-2">
                        ✅ 통과 항목 ({passedItems.length}건)
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {passedItems.map(([key]) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2"
                        >
                          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">✓</span>
                          </span>
                          <span className="text-sm text-gray-600">{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* items가 있지만 비어있는 경우 */}
                {totalItems === 0 && (
                  <div className="text-xs text-gray-400">항목 데이터 없음</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
