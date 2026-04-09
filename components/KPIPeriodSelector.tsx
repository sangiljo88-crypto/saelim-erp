"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

const PERIODS = [
  { key: "today",   label: "오늘" },
  { key: "week",    label: "이번 주" },
  { key: "month",   label: "이번 달" },
  { key: "quarter", label: "이번 분기" },
  { key: "half",    label: "반기" },
  { key: "custom",  label: "📅 기간 설정" },
];

function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthStartStr() { return new Date().toISOString().slice(0, 7) + "-01"; }

export default function KPIPeriodSelector({
  current,
  currentFrom,
  currentTo,
}: {
  current: string;
  currentFrom?: string;
  currentTo?: string;
}) {
  const router   = useRouter();
  const pathname = usePathname();

  const [showCustom, setShowCustom] = useState(current === "custom");
  // 기간 설정 패널 기본값: 이번 달 1일 ~ 오늘
  const [from, setFrom] = useState(currentFrom || monthStartStr());
  const [to,   setTo]   = useState(currentTo   || todayStr());

  function navigate(period: string) {
    if (period === "custom") {
      setShowCustom(true);
      return; // URL 이동 없이 패널만 열기
    }
    setShowCustom(false);
    router.push(`${pathname}?period=${period}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    const f = from <= to ? from : to;
    const t = from <= to ? to   : from;
    router.push(`${pathname}?period=custom&from=${f}&to=${t}`);
    setShowCustom(false);
  }

  const canApply = Boolean(from) && Boolean(to);

  return (
    <div className="flex flex-col gap-2">
      {/* 탭 버튼 */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => {
          const isActive = p.key === "custom"
            ? current === "custom" || showCustom
            : current === p.key && !showCustom;
          return (
            <button
              key={p.key}
              onClick={() => navigate(p.key)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#1F3864] text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864] hover:text-[#1F3864]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 기간 설정 패널 */}
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap bg-white border border-[#1F3864]/30 rounded-xl px-4 py-3 shadow-sm">
          <span className="text-xs text-gray-500 font-medium shrink-0">조회 기간</span>
          <input
            type="date"
            value={from}
            max={todayStr()}
            onChange={(e) => setFrom(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#1F3864] focus:ring-1 focus:ring-[#1F3864]/20"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={to}
            max={todayStr()}
            onChange={(e) => setTo(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#1F3864] focus:ring-1 focus:ring-[#1F3864]/20"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!canApply}
            className="text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
          >
            조회
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustom(false);
              if (current === "custom") router.push(`${pathname}?period=month`);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
