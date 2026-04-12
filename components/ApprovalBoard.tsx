"use client";

import { useState, useTransition } from "react";
import { submitCostApprovalRequest, approveCostRequest } from "@/app/actions/submit";

interface Approval {
  id: string;
  title: string;
  dept: string;
  requested_by: string;
  request_date: string;
  amount: number;
  status: string;
  comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Props {
  approvals: Approval[];
  canApprove: boolean;
  canRequest: boolean;
  userDept: string;
  userName: string;
}

type TabKey = "all" | "pending" | "done";

const STATUS_LABEL: Record<string, string> = {
  pending:  "대기",
  approved: "승인",
  rejected: "반려",
};

const STATUS_CLASS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

function fmt만원(amount: number) {
  return `${(amount / 10_000).toLocaleString()}만원`;
}

function fmtDatetime(iso: string) {
  return iso.slice(0, 16).replace("T", " ");
}

export default function ApprovalBoard({ approvals, canApprove, canRequest, userDept, userName }: Props) {
  // ── 요청 폼 상태 ──────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── 탭 필터 ──────────────────────────────────────────────
  const [tab, setTab] = useState<TabKey>("all");

  // ── 승인/반려 인라인 상태 ────────────────────────────────
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  // 낙관적 상태 오버라이드 (서버 응답 전까지 UI 반영용)
  const [optimistic, setOptimistic] = useState<Record<string, { status: string; comment?: string; approved_by?: string; approved_at?: string }>>({});

  // ── 필터링 ───────────────────────────────────────────────
  const filtered = approvals
    .map(a => ({ ...a, ...(optimistic[a.id] ?? {}) }))
    .filter(a => {
      if (tab === "pending") return a.status === "pending";
      if (tab === "done")    return a.status === "approved" || a.status === "rejected";
      return true;
    });

  // ── 요청 등록 핸들러 ─────────────────────────────────────
  async function handleSubmitRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setFormSuccess(false);
    const fd = new FormData(e.currentTarget);
    // 만원 → 원 변환
    const manwon = Number(fd.get("amount_manwon")) || 0;
    fd.set("amount", String(manwon * 10_000));
    fd.delete("amount_manwon");

    startTransition(async () => {
      const result = await submitCostApprovalRequest(fd);
      if (result?.error) {
        setFormError(result.error);
      } else {
        setFormSuccess(true);
        setFormOpen(false);
        // 폼 리셋은 페이지 리로드(revalidatePath)로 처리됨
      }
    });
  }

  // ── 승인 핸들러 ──────────────────────────────────────────
  async function handleApprove(id: string) {
    setActionLoading(id + "_approve");
    setActionError(prev => ({ ...prev, [id]: "" }));
    const result = await approveCostRequest(id, "approved", "");
    setActionLoading(null);
    if (result?.error) {
      setActionError(prev => ({ ...prev, [id]: result.error! }));
    } else {
      setOptimistic(prev => ({ ...prev, [id]: { status: "approved", approved_by: userName, approved_at: new Date().toISOString() } }));
    }
  }

  // ── 반려 핸들러 ──────────────────────────────────────────
  async function handleReject(id: string) {
    setActionLoading(id + "_reject");
    setActionError(prev => ({ ...prev, [id]: "" }));
    const comment = rejectComment[id] ?? "";
    const result = await approveCostRequest(id, "rejected", comment);
    setActionLoading(null);
    if (result?.error) {
      setActionError(prev => ({ ...prev, [id]: result.error! }));
    } else {
      setOptimistic(prev => ({ ...prev, [id]: { status: "rejected", comment, approved_by: userName, approved_at: new Date().toISOString() } }));
      setRejectOpen(prev => ({ ...prev, [id]: false }));
    }
  }

  const pendingCount = approvals.filter(a => (optimistic[a.id]?.status ?? a.status) === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── 요청 등록 폼 ────────────────────────────────── */}
      {canRequest && (
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            onClick={() => setFormOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span>+ 비용 승인 요청 등록</span>
            <span className="text-gray-400 text-xs">{formOpen ? "▲ 접기" : "▼ 펼치기"}</span>
          </button>

          {formOpen && (
            <form onSubmit={handleSubmitRequest} className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">제목 *</label>
                <input
                  name="title"
                  required
                  placeholder="예: 포장재 구매비"
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#1F3864] bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">요청 날짜 *</label>
                  <input
                    name="request_date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#1F3864] bg-gray-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">금액 (만원) *</label>
                  <input
                    name="amount_manwon"
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="예: 50"
                    className="text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[#1F3864] bg-gray-50"
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-red-500">{formError}</p>}
              {formSuccess && <p className="text-xs text-emerald-600">요청이 등록되었습니다.</p>}

              <button
                type="submit"
                disabled={isPending}
                className="mt-1 text-sm bg-[#1F3864] text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-[#162d52] active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {isPending ? "등록 중…" : "요청 등록"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── 탭 필터 ────────────────────────────────────── */}
      <div className="flex gap-2">
        {(["all", "pending", "done"] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${
              tab === t
                ? "bg-[#1F3864] text-white border-[#1F3864]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {t === "all" ? `전체 (${approvals.length})` : t === "pending" ? `대기 중 (${pendingCount})` : "처리 완료"}
          </button>
        ))}
      </div>

      {/* ── 목록 ────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          해당하는 항목이 없습니다
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(item => {
          const isPendingItem  = item.status === "pending";
          const isApprovedItem = item.status === "approved";
          const isRejectedItem = item.status === "rejected";
          const isRejectExpanded = rejectOpen[item.id];
          const errMsg = actionError[item.id];

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border px-5 py-4 transition-all ${
                isApprovedItem
                  ? "border-emerald-200"
                  : isRejectedItem
                  ? "border-red-200"
                  : "border-amber-200"
              }`}
            >
              {/* 헤더 행 */}
              <div className="flex items-start gap-3">
                {/* 부서 배지 + 요청자 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {item.dept}
                    </span>
                    <span className="text-xs text-gray-400">{item.requested_by}</span>
                    <span className="text-xs text-gray-400">· {item.request_date}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-800">{item.title}</div>
                </div>

                {/* 금액 + 상태 배지 */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-bold text-gray-700">{fmt만원(item.amount)}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLASS[item.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              </div>

              {/* ── pending + canApprove: 승인/반려 버튼 ── */}
              {isPendingItem && canApprove && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={actionLoading !== null}
                      className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95 disabled:opacity-50 px-4 py-1.5 rounded-lg font-semibold transition-all"
                    >
                      {actionLoading === item.id + "_approve" ? "처리 중…" : "승인"}
                    </button>
                    <button
                      onClick={() => setRejectOpen(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      disabled={actionLoading !== null}
                      className="text-xs bg-red-100 text-red-600 hover:bg-red-200 active:scale-95 disabled:opacity-50 px-4 py-1.5 rounded-lg font-semibold transition-all"
                    >
                      반려
                    </button>
                  </div>

                  {isRejectExpanded && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rejectComment[item.id] ?? ""}
                        onChange={e => setRejectComment(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="반려 사유 입력 (선택)"
                        className="flex-1 text-xs rounded-lg border border-gray-200 px-3 py-1.5 outline-none focus:border-red-400 bg-gray-50"
                      />
                      <button
                        onClick={() => handleReject(item.id)}
                        disabled={actionLoading !== null}
                        className="text-xs bg-red-500 text-white hover:bg-red-600 active:scale-95 disabled:opacity-50 px-4 py-1.5 rounded-lg font-semibold transition-all"
                      >
                        {actionLoading === item.id + "_reject" ? "처리 중…" : "반려 확정"}
                      </button>
                    </div>
                  )}

                  {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
                </div>
              )}

              {/* ── 처리 완료: 처리자·일시·코멘트 ── */}
              {(isApprovedItem || isRejectedItem) && (
                <div className="mt-2.5 text-xs text-gray-400 flex flex-col gap-0.5">
                  <span>
                    {isApprovedItem ? "승인자" : "반려자"}: {item.approved_by ?? "-"}
                    {item.approved_at && <> · {fmtDatetime(item.approved_at)}</>}
                  </span>
                  {item.comment && (
                    <span className="italic text-gray-500">코멘트: {item.comment}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
