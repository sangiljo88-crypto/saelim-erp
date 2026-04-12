"use client";

import { useState } from "react";
import { toggleBriefingPin, deleteBriefing } from "@/app/actions/submit";

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

const DEPT_FILTERS = [
  "전체", "전체공지", "업계동향",
  "생산팀", "가공팀", "스킨팀", "재고팀", "품질팀",
  "배송팀", "CS팀", "마케팅팀", "회계팀", "온라인팀", "개발팀",
] as const;
type DeptFilter = (typeof DEPT_FILTERS)[number];

export const DEPT_META: Record<string, { label: string; color: string; dot: string; icon: string }> = {
  "all":      { label: "전체 공지",  color: "bg-red-100 text-red-700",          dot: "bg-red-500",     icon: "📢" },
  "업계동향": { label: "업계동향",   color: "bg-blue-100 text-blue-700",        dot: "bg-blue-500",    icon: "🌐" },
  "생산팀":   { label: "생산팀",     color: "bg-indigo-100 text-indigo-700",    dot: "bg-indigo-500",  icon: "🏭" },
  "가공팀":   { label: "가공팀",     color: "bg-orange-100 text-orange-700",    dot: "bg-orange-500",  icon: "🥩" },
  "스킨팀":   { label: "스킨팀",     color: "bg-pink-100 text-pink-700",        dot: "bg-pink-500",    icon: "📦" },
  "재고팀":   { label: "재고팀",     color: "bg-amber-100 text-amber-700",      dot: "bg-amber-500",   icon: "🗃" },
  "품질팀":   { label: "품질팀",     color: "bg-purple-100 text-purple-700",    dot: "bg-purple-500",  icon: "🔍" },
  "배송팀":   { label: "배송팀",     color: "bg-sky-100 text-sky-700",          dot: "bg-sky-500",     icon: "🚚" },
  "CS팀":     { label: "CS팀",       color: "bg-emerald-100 text-emerald-700",  dot: "bg-emerald-500", icon: "📞" },
  "마케팅팀": { label: "마케팅팀",   color: "bg-green-100 text-green-700",      dot: "bg-green-500",   icon: "📣" },
  "회계팀":   { label: "회계팀",     color: "bg-teal-100 text-teal-700",        dot: "bg-teal-500",    icon: "💰" },
  "온라인팀": { label: "온라인팀",   color: "bg-violet-100 text-violet-700",    dot: "bg-violet-500",  icon: "💻" },
  "개발팀":   { label: "개발팀",     color: "bg-gray-100 text-gray-700",        dot: "bg-gray-500",    icon: "🛠" },
  // 레거시 값 호환
  "market":   { label: "업계동향",   color: "bg-blue-100 text-blue-700",        dot: "bg-blue-500",    icon: "🌐" },
  "weekly":   { label: "주간브리핑", color: "bg-emerald-100 text-emerald-700",  dot: "bg-emerald-500", icon: "📋" },
};

export default function BriefingList({
  initialBriefings,
  isCoo,
  isAdmin = false,
  readCounts = {},
  totalStaff = 0,
}: {
  initialBriefings: BriefingSummary[];
  isCoo: boolean;
  isAdmin?: boolean;
  readCounts?: Record<string, number>;
  totalStaff?: number;
}) {
  const [briefings, setBriefings]         = useState<BriefingSummary[]>(initialBriefings);
  const [filter, setFilter]               = useState<DeptFilter>("전체");
  const [pinLoading, setPinLoading]       = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // ── 필터링 ────────────────────────────────────────────────────
  function matchesFilter(b: BriefingSummary) {
    if (filter === "전체")     return true;
    if (filter === "전체공지") return b.category === "all";
    if (filter === "업계동향") return b.category === "업계동향" || b.category === "market";
    return b.category === filter;
  }

  function countFor(dept: DeptFilter) {
    if (dept === "전체")     return briefings.length;
    if (dept === "전체공지") return briefings.filter((b) => b.category === "all").length;
    if (dept === "업계동향") return briefings.filter((b) => b.category === "업계동향" || b.category === "market").length;
    return briefings.filter((b) => b.category === dept).length;
  }

  // ── 주차별 그룹핑 ────────────────────────────────────────────
  const filtered = briefings.filter(matchesFilter);

  // 고정 글 (항상 최상단)
  const pinned   = filtered.filter((b) => b.is_pinned).sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const unpinned = filtered.filter((b) => !b.is_pinned).sort((a, b) => b.publish_date.localeCompare(a.publish_date));

  // week_label 순서로 그룹핑 (중복 제거 후 최신순)
  const weekOrder: string[] = [];
  const weekGroups: Record<string, BriefingSummary[]> = {};
  for (const b of unpinned) {
    if (!weekGroups[b.week_label]) {
      weekOrder.push(b.week_label);
      weekGroups[b.week_label] = [];
    }
    weekGroups[b.week_label].push(b);
  }

  // ── 이벤트 핸들러 ────────────────────────────────────────────
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

  // ── 브리핑 카드 렌더 ─────────────────────────────────────────
  function BriefingCard({ b }: { b: BriefingSummary }) {
    const meta = DEPT_META[b.category] ?? { label: b.category, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400", icon: "📄" };
    const readCount = readCounts[b.id] ?? 0;
    const readPct   = totalStaff > 0 ? Math.round((readCount / totalStaff) * 100) : 0;
    const readColor = readPct === 0 ? "bg-gray-100 text-gray-400" : readPct >= 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";

    return (
      <div
        className={`bg-white rounded-xl border transition-all hover:shadow-sm ${
          b.is_pinned ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-[#1F3864]/30"
        }`}
      >
        <a href={`/briefings/${b.id}`} className="flex items-start gap-3 px-5 py-4">
          {b.is_pinned && <span className="text-red-400 text-sm shrink-0 mt-0.5">📌</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* 전체 뷰에서만 카테고리 배지 표시 */}
              {filter === "전체" && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.icon} {meta.label}
                </span>
              )}
              <span className="text-xs text-gray-400">{b.publish_date}</span>
            </div>
            <div className="text-sm font-bold text-gray-800 leading-snug">{b.title}</div>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                {b.author}
                <span className="text-gray-300 ml-1">
                  · {new Date(b.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} 등록
                </span>
              </span>
              {isAdmin && totalStaff > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${readColor}`}>
                  👁 {readCount}/{totalStaff}명 · {readPct}%
                </span>
              )}
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
  }

  // ── 선택된 카테고리 메타 ─────────────────────────────────────
  const activeMeta = filter !== "전체" && filter !== "전체공지" && filter !== "업계동향"
    ? DEPT_META[filter]
    : null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── 카테고리 필터 탭 ─────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {DEPT_FILTERS.map((dept) => {
          const active = filter === dept;
          const cnt    = countFor(dept);
          const empty  = dept !== "전체" && cnt === 0;
          const deptMeta = DEPT_META[dept === "전체공지" ? "all" : dept];
          return (
            <button
              key={dept}
              onClick={() => setFilter(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-[#1F3864] text-white shadow"
                  : empty
                  ? "bg-white border border-gray-100 text-gray-300"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {deptMeta?.icon && !active && !empty ? `${deptMeta.icon} ` : ""}
              {dept === "전체공지" ? "전체공지" : dept}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                active ? "bg-white/20 text-white" : empty ? "bg-gray-50 text-gray-300" : "bg-gray-100 text-gray-500"
              }`}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 선택 카테고리 헤더 배너 ─────────────────────────── */}
      {activeMeta && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${activeMeta.color} border border-current/10`}>
          <span className="text-xl">{activeMeta.icon}</span>
          <div>
            <div className="font-bold text-sm">{activeMeta.label} 브리핑 아카이브</div>
            <div className="text-xs opacity-70 mt-0.5">
              총 {countFor(filter as DeptFilter)}건 · 주차별 누적 이력
            </div>
          </div>
        </div>
      )}

      {/* ── 빈 상태 ──────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm text-gray-500">
            {filter === "전체" ? "등록된 브리핑이 없습니다" : `${filter} 브리핑이 아직 없습니다`}
          </div>
          {isCoo && (
            <a href="/briefings/new" className="inline-block mt-3 text-xs text-[#1F3864] hover:underline font-semibold">
              + 첫 번째 브리핑 등록하기
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* 📌 고정 글 (항상 최상단) */}
          {pinned.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">📌 상단 고정</span>
                <div className="flex-1 border-t border-red-100" />
              </div>
              {pinned.map((b) => <BriefingCard key={b.id} b={b} />)}
            </div>
          )}

          {/* 📅 주차별 그룹 */}
          {weekOrder.map((weekLabel, idx) => {
            const items = weekGroups[weekLabel];
            const isLatest = idx === 0;
            return (
              <div key={weekLabel} className="flex flex-col gap-2">
                {/* 주차 헤더 */}
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                    isLatest
                      ? "bg-[#1F3864] text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    📅 {weekLabel}
                    {isLatest && (
                      <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">최신</span>
                    )}
                  </div>
                  <div className="flex-1 border-t border-gray-100" />
                  <span className="text-xs text-gray-400 shrink-0">{items.length}건</span>
                </div>

                {/* 해당 주차 브리핑 목록 */}
                <div className="flex flex-col gap-2 pl-0">
                  {items.map((b) => <BriefingCard key={b.id} b={b} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
