"use client";

import { useState } from "react";
import { saveCooComment } from "@/app/actions/submit";
import { RAG_DOT } from "@/lib/constants";

interface Props {
  reportId: string;
  dept: string;
  existingComment?: string | null;
  managerName: string;
  issue: string;
  ragStatus: string;
  detail?: string | null;
  nextAction?: string | null;
  reportDate: string;
}

const RAG_BADGE: Record<string, string> = {
  green:  "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red:    "bg-red-100 text-red-700",
};
const RAG_LABEL: Record<string, string> = { green: "정상", yellow: "주의", red: "경고" };

export default function CooCommentBox({
  reportId, dept, existingComment, managerName,
  issue, ragStatus, detail, nextAction, reportDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(existingComment ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!comment.trim()) return;
    setLoading(true);
    const res = await saveCooComment(reportId, comment.trim());
    setLoading(false);
    if (!("error" in res)) { setSaved(true); setOpen(false); }
  }

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      ragStatus === "red" ? "border-red-200" : ragStatus === "yellow" ? "border-amber-200" : "border-gray-200"
    }`}>
      {/* 헤더 — 클릭으로 펼침 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 text-left transition-colors cursor-pointer"
      >
        <span className="text-base">{RAG_DOT[ragStatus] ?? "🟢"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{dept}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RAG_BADGE[ragStatus] ?? "bg-gray-100 text-gray-600"}`}>
              {RAG_LABEL[ragStatus] ?? ragStatus}
            </span>
            {saved && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">코멘트 저장됨</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{issue}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-400">{managerName}</div>
          <div className="text-xs text-gray-400">{reportDate}</div>
        </div>
        <span className="text-gray-400 ml-2">{open ? "▲" : "▼"}</span>
      </button>

      {/* 상세 내용 */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 flex flex-col gap-4">
          {/* 팀장 보고 내용 */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">팀장 보고 내용</div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-2">
              <div>
                <span className="text-xs text-gray-400">핵심 이슈</span>
                <p className="text-sm text-gray-800 mt-0.5">{issue}</p>
              </div>
              {detail && (
                <div className="border-t border-gray-100 pt-2">
                  <span className="text-xs text-gray-400">상세 / 수치</span>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">{detail}</p>
                </div>
              )}
              {nextAction && (
                <div className="border-t border-gray-100 pt-2">
                  <span className="text-xs text-gray-400">다음 주 계획</span>
                  <p className="text-sm text-gray-700 mt-0.5">{nextAction}</p>
                </div>
              )}
            </div>
          </div>

          {/* COO 코멘트 입력 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#1F3864] uppercase tracking-wider">
              💬 COO 코멘트
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="코멘트를 입력하면 팀장 화면 + CEO 대시보드에 표시됩니다"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none"
            />
            <button
              onClick={handleSave}
              disabled={loading || !comment.trim()}
              className="self-end text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#162c52] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? "저장 중..." : "코멘트 저장 → CEO 대시보드 반영"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
