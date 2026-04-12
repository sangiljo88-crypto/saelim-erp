"use client";

import { useState, useRef } from "react";
import {
  toggleBriefingRead,
  addBriefingComment,
  deleteBriefingComment,
  type BriefingRead,
  type BriefingComment,
} from "@/app/actions/briefing-interactions";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

interface StaffUser { id: string; name: string; dept?: string }

interface Props {
  briefingId: string;
  initialReads: BriefingRead[];
  initialComments: BriefingComment[];
  currentUserId: string;
  currentUserName: string;
  isCoo: boolean;
  staffUsers?: StaffUser[];  // COO/CEO에게만 전달
}

export default function BriefingInteractions({
  briefingId,
  initialReads,
  initialComments,
  currentUserId,
  isCoo,
  staffUsers,
}: Props) {
  const [reads, setReads] = useState<BriefingRead[]>(initialReads);
  const [comments, setComments] = useState<BriefingComment[]>(initialComments);
  const [readLoading, setReadLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasRead = reads.some((r) => r.user_id === currentUserId);

  // 읽었어요 토글
  async function handleToggleRead() {
    setReadLoading(true);
    try {
      const result = await toggleBriefingRead(briefingId);
      if ("reads" in result && result.reads) setReads(result.reads);
    } finally {
      setReadLoading(false);
    }
  }

  // 댓글 등록
  async function handleAddComment() {
    if (!commentText.trim() || commentLoading) return;
    setCommentLoading(true);
    try {
      const result = await addBriefingComment(briefingId, commentText);
      if ("comment" in result && result.comment) {
        setComments((prev) => [...prev, result.comment as BriefingComment]);
        setCommentText("");
      }
    } finally {
      setCommentLoading(false);
      textareaRef.current?.focus();
    }
  }

  // 댓글 삭제
  async function handleDeleteComment(commentId: string) {
    setDeletingId(commentId);
    try {
      const result = await deleteBriefingComment(commentId, briefingId);
      if ("success" in result) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // 읽은 사람 표시 (최대 4명 + 나머지 N명)
  const MAX_SHOW = 4;
  const shownReaders = reads.slice(0, MAX_SHOW);
  const extraCount = reads.length - MAX_SHOW;

  return (
    <div className="border-t border-gray-100">

      {/* ── 읽었어요 ───────────────────────────────────── */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleToggleRead}
            disabled={readLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border
              ${hasRead
                ? "bg-[#1F3864] text-white border-[#1F3864] shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-[#1F3864] hover:text-[#1F3864]"
              } ${readLoading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className="text-base">{hasRead ? "👍" : "👍"}</span>
            {hasRead ? "읽었어요" : "읽었어요"}
            {reads.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${hasRead ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                {reads.length}
              </span>
            )}
          </button>

          {/* 읽은 사람 이름 */}
          {reads.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {shownReaders.map((r) => (
                <span
                  key={r.user_id}
                  className={`text-xs px-2.5 py-1 rounded-full border
                    ${r.user_id === currentUserId
                      ? "bg-[#1F3864]/10 text-[#1F3864] border-[#1F3864]/20 font-semibold"
                      : "bg-gray-50 text-gray-500 border-gray-100"
                    }`}
                >
                  {r.user_name}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="text-xs text-gray-400">외 {extraCount}명</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── COO/CEO 전용: 열람 현황 ───────────────────── */}
      {staffUsers && staffUsers.length > 0 && (() => {
        const readIds = new Set(reads.map((r) => r.user_id));
        const unread = staffUsers.filter((u) => !readIds.has(u.id));
        const pct = Math.round((reads.length / staffUsers.length) * 100);
        const barColor = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
        return (
          <div className="border-t border-gray-50 px-6 py-5 bg-gray-50/60">
            <div className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-2">
              📊 열람 현황
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                ${pct >= 80 ? "bg-green-100 text-green-700" : pct >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                {reads.length}/{staffUsers.length}명 · {pct}%
              </span>
            </div>
            {/* 진행 바 */}
            <div className="w-full h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* 미열람자 */}
            {unread.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">아직 안 읽은 직원 ({unread.length}명)</div>
                <div className="flex flex-wrap gap-1.5">
                  {unread.map((u) => (
                    <span key={u.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-500">
                      {u.name}
                      {u.dept && <span className="text-gray-300 ml-1 text-[10px]">{u.dept}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {unread.length === 0 && (
              <div className="text-xs text-green-600 font-semibold">✅ 전원 열람 완료</div>
            )}
          </div>
        );
      })()}

      {/* ── 댓글 ──────────────────────────────────────── */}
      <div className="border-t border-gray-50 px-6 py-5">
        <div className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide">
          댓글 {comments.length > 0 ? `${comments.length}` : ""}
        </div>

        {/* 댓글 목록 */}
        {comments.length > 0 && (
          <div className="space-y-3 mb-5">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3 group">
                {/* 아바타 */}
                <div className="w-7 h-7 rounded-full bg-[#1F3864]/10 flex items-center justify-center text-xs font-bold text-[#1F3864] shrink-0 mt-0.5">
                  {c.user_name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{c.user_name}</span>
                    <span className="text-xs text-gray-300">{formatRelativeTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </div>

                {/* 삭제 버튼 */}
                {(c.user_id === currentUserId || isCoo) && (
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={deletingId === c.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          삭제
                        </button>
                        <span className="text-gray-300 text-xs">|</span>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="text-xs text-gray-300 hover:text-red-400"
                        title="댓글 삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 댓글 입력 */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment();
            }}
            placeholder="브리핑을 읽고 한 마디 남겨보세요 (Cmd+Enter 등록)"
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 placeholder:text-gray-300"
          />
          <button
            onClick={handleAddComment}
            disabled={!commentText.trim() || commentLoading}
            className="px-4 py-2.5 rounded-xl bg-[#1F3864] text-white text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1a2f58] transition-colors shrink-0"
          >
            {commentLoading ? "…" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
