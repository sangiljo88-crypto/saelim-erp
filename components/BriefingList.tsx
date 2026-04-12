"use client";

import { useState } from "react";
import { toggleBriefingPin, deleteBriefing } from "@/app/actions/submit";

export interface BriefingSummary {
  id: string;
  week_label: string;
  publish_date: string;
  category: string;   // DB 컬럼명 유지 (값: 부서명 또는 'all'/'업계동향' 등)
  title: string;
  author: string;
  is_pinned: boolean;
  created_at: string;
}

const DEPT_FILTERS = [
  "전체", "업계동향", "현장팀", "물류팀", "품질CS팀", "영업마케팅팀", "경영지원팀",
] as const;
type DeptFilter = (typeof DEPT_FILTERS)[number];

export const DEPT_META: Record<string, { label: string; color: string; dot: string }> = {
  "all":         { label: "전체 공지",    color: "bg-gray-100 text-gray-700",         dot: "bg-gray-400" },
  "업계동향":    { label: "업계동향",     color: "bg-blue-100 text-blue-700",          dot: "bg-blue-500" },
  "현장팀":      { label: "현장팀",       color: "bg-orange-100 text-orange-700",      dot: "bg-orange-500" },
  "물류팀":      { label: "물류팀",       color: "bg-sky-100 text-sky-700",            dot: "bg-sky-500" },
  "품질CS팀":    { label: "품질CS팀",     color: "bg-purple-100 text-purple-700",      dot: "bg-purple-500" },
  "영업마케팅팀": { label: "영업마케팅팀", color: "bg-emerald-100 text-emerald-700",   dot: "bg-emerald-500" },
  "경영지원팀":  { label: "경영지원팀",   color: "bg-rose-100 text-rose-700",          dot: "bg-rose-500" },
  // 레거시 값 호환
  "market":      { label: "업계동향",     color: "bg-blue-100 text-blue-700",          dot: "bg-blue-500" },
  "weekly":      { label: "주간브리핑",   color: "bg-emerald-100 text-emerald-700",    dot: "bg-emerald-500" },
};

function getDeptLabel(cat: string) {
  return DEPT_META[cat]?.label ?? cat;
}

export default function BriefingList({
  initialBriefings,
  isCoo,
}: {
  initialBriefings: BriefingSummary[];
  isCoo: boolean;
}) {
  const [briefings, setBriefings]           = useState<BriefingSummary[]>(initialBriefings);
  const [filter, setFilter]                 = useState<DeptFilter>("전체");
  const [pinLoading, setPinLoading]         = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading]   = useState<string | null>(null);

  const filtered = briefings.filter((b) => {
    if (filter === "전체") return true;
    // 업계동향은 'market' 레거시 값도 포함
    if (filter === "업계동향") return b.category === "업계동향" || b.category === "market";
    return getDeptLabel(b.category) === filter || b.category === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.publish_date.localeCompare(a.publish_date);
  });

  function countFor(dept: DeptFilter) {
    if (dept === "전체") return briefings.length;
    if (dept === "업계동향") return briefings.filter((b) => b.category === "업계동향" || b.category === "market").length;
    return briefings.filter((b) => getDeptLabel(b.category) === dept || b.category === dept).length;
  }

  async function handlePin(id: string, current: boolean) {
    setPinLoading(id);
    try {
      await toggleBriefingPin(id, !current);
      setBriefings((prev) => prev.map((b) => b.id === id ? { ...b, is_pinned: !current } : b));
    } finally {
      setPinLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(id);
    try {
      await deleteBriefing(id);
      setBriefings((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeleteLoading(null);
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 카테고리 필터 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        {DEPT_FILTERS.map((dept) => {
          const active = filter === dept;
          const cnt = countFor(dept);
          return (
            <button
              key={dept}
              onClick={() => setFilter(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-[#1F3864] text-white shadow"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {dept}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          {filter === "전체" ? "등록된 브리핑이 없습니다" : `${filter} 브리핑이 없습니다`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((b) => {
            const meta = DEPT_META[b.category] ?? { label: b.category, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
            return (
              <div
                key={b.id}
                className={`bg-white rounded-xl border transition-all hover:shadow-sm ${
                  b.is_pinned ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-[#1F3864]/30"
                }`}
              >
                <a href={`/briefings/${b.id}`} className="flex items-start gap-4 px-5 py-4">
                  {b.is_pinned && (
                    <span className="text-red-400 text-sm shrink-0 mt-0.5">📌</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">{b.week_label}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-800 truncate">{b.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {b.author} · {b.publish_date}&nbsp;
                      <span className="text-gray-300">
                        {new Date(b.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} 등록
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm shrink-0 mt-1">›</span>
                </a>

                {/* COO 관리 버튼 */}
                {isCoo && (
                  <div className="px-5 pb-3 pt-0 flex items-center justify-between border-t border-gray-50">
                    <button
                      onClick={() => handlePin(b.id, b.is_pinned)}
                      disabled={pinLoading === b.id}
                      className={`text-xs px-3 py-1 rounded-lg font-medium cursor-pointer transition-all disabled:opacity-50 ${
                        b.is_pinned
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {pinLoading === b.id ? "…" : b.is_pinned ? "📌 고정 해제" : "📌 상단 고정"}
                    </button>

                    {deleteConfirm === b.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500 font-medium">정말 삭제할까요?</span>
                        <button
                          onClick={() => handleDelete(b.id)}
                          disabled={deleteLoading === b.id}
                          className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                        >
                          {deleteLoading === b.id ? "삭제중…" : "삭제"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(b.id)}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors"
                      >
                        🗑 삭제
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
