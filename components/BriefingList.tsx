"use client";

import { useState } from "react";
import { toggleBriefingPin } from "@/app/actions/submit";

export interface BriefingSummary {
  id: string;
  week_label: string;
  publish_date: string;
  category: string;
  title: string;
  author: string;
  is_pinned: boolean;
  created_at: string;
}

type FilterCat = "all" | "market" | "weekly";

const CATEGORY_META: Record<string, { label: string; color: string; dot: string }> = {
  market: { label: "업계동향",   color: "bg-blue-100 text-blue-700",      dot: "bg-blue-500" },
  weekly: { label: "주간브리핑", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

export default function BriefingList({
  initialBriefings,
  isCoo,
}: {
  initialBriefings: BriefingSummary[];
  isCoo: boolean;
}) {
  const [briefings, setBriefings] = useState<BriefingSummary[]>(initialBriefings);
  const [filter, setFilter]       = useState<FilterCat>("all");
  const [pinLoading, setPinLoading] = useState<string | null>(null);

  const filtered = briefings.filter(
    (b) => filter === "all" || b.category === filter
  );

  // 핀 고정 먼저, 그 다음 날짜 내림차순
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.publish_date.localeCompare(a.publish_date);
  });

  const counts = {
    all:    briefings.length,
    market: briefings.filter((b) => b.category === "market").length,
    weekly: briefings.filter((b) => b.category === "weekly").length,
  };

  async function handlePin(id: string, current: boolean) {
    setPinLoading(id);
    try {
      await toggleBriefingPin(id, !current);
      setBriefings((prev) =>
        prev.map((b) => b.id === id ? { ...b, is_pinned: !current } : b)
      );
    } finally {
      setPinLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "market", "weekly"] as FilterCat[]).map((cat) => {
          const meta = cat === "all"
            ? { label: "전체", color: "bg-gray-100 text-gray-700" }
            : CATEGORY_META[cat];
          const active = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-[#1F3864] text-white shadow"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {meta.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : meta.color}`}>
                {counts[cat]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400">
          {filter === "all" ? "등록된 브리핑이 없습니다" : `${CATEGORY_META[filter]?.label} 브리핑이 없습니다`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((b) => {
            const cat = CATEGORY_META[b.category] ?? { label: b.category, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
            return (
              <div
                key={b.id}
                className={`bg-white rounded-xl border transition-all hover:shadow-sm ${
                  b.is_pinned ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-[#1F3864]/30"
                }`}
              >
                <a href={`/briefings/${b.id}`} className="flex items-start gap-4 px-5 py-4 block">
                  {/* 핀 아이콘 */}
                  {b.is_pinned && (
                    <span className="text-red-400 text-sm shrink-0 mt-0.5">📌</span>
                  )}

                  {/* 본문 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cat.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                        {cat.label}
                      </span>
                      <span className="text-xs text-gray-400">{b.week_label}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-800 truncate">{b.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {b.author} · {b.publish_date}
                    </div>
                  </div>

                  <span className="text-gray-300 text-sm shrink-0 mt-1">›</span>
                </a>

                {/* COO 핀 토글 버튼 */}
                {isCoo && (
                  <div className="px-5 pb-3 pt-0 flex justify-end border-t border-gray-50">
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
