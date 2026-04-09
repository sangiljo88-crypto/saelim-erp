"use client";

import { useState } from "react";
import { saveCostApproval } from "@/app/actions/submit";

interface ApprovalItem {
  id: string;
  title: string;
  dept: string;
  requested_by: string;
  request_date: string;
  amount: number;
  status: string;
}

type ItemStatus = "pending" | "approved" | "rejected";

export default function CostApprovalSection({ items }: { items: ApprovalItem[] }) {
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>(
    Object.fromEntries(items.map((i) => [i.id, "pending"]))
  );
  const [comments, setComments] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, ""]))
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pendingCount = items.filter((i) => statuses[i.id] === "pending").length;

  async function handleAction(id: string, action: "approved" | "rejected") {
    setLoading(id + action);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const result = await saveCostApproval(id, action, comments[id] ?? "");
      if (result?.error) {
        setErrors((prev) => ({ ...prev, [id]: result.error! }));
      } else {
        setStatuses((prev) => ({ ...prev, [id]: action }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">비용 승인 대기</h2>
        {pendingCount > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
            {pendingCount}건 대기중
          </span>
        )}
        {pendingCount === 0 && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
            모두 처리됨
          </span>
        )}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          승인 대기 중인 비용 항목이 없습니다
        </div>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const status = statuses[item.id];
          const isApproved = status === "approved";
          const isRejected = status === "rejected";
          const isPending  = status === "pending";
          const errMsg     = errors[item.id];

          return (
            <div
              key={item.id}
              className={`rounded-xl border px-5 py-3.5 transition-all ${
                isApproved
                  ? "bg-emerald-50 border-emerald-200"
                  : isRejected
                  ? "bg-red-50 border-red-100"
                  : "bg-white border-amber-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-lg ${isApproved ? "text-emerald-500" : isRejected ? "text-red-400" : "text-amber-500"}`}>
                  {isApproved ? "✅" : isRejected ? "❌" : "⏳"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">
                    {item.title}{" "}
                    <span className="text-gray-500 font-normal">
                      ({(item.amount / 10_000).toLocaleString()}만원)
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.dept} · {item.requested_by} · {item.request_date}
                  </div>
                </div>

                {isPending ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(item.id, "approved")}
                      disabled={loading !== null}
                      className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95 disabled:opacity-50 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    >
                      {loading === item.id + "approved" ? "처리중…" : "승인"}
                    </button>
                    <button
                      onClick={() => handleAction(item.id, "rejected")}
                      disabled={loading !== null}
                      className="text-xs bg-red-100 text-red-600 hover:bg-red-200 active:scale-95 disabled:opacity-50 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                    >
                      {loading === item.id + "rejected" ? "처리중…" : "반려"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {isApproved ? "승인됨" : "반려됨"}
                    </span>
                    <button
                      onClick={() => setStatuses((prev) => ({ ...prev, [item.id]: "pending" }))}
                      className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>

              {/* 코멘트 입력 (대기 중일 때만 표시) */}
              {isPending && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={comments[item.id] ?? ""}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="승인/반려 코멘트 (선택)"
                    className="w-full text-xs rounded-lg border border-gray-200 px-3 py-1.5 outline-none focus:border-[#1F3864] bg-gray-50"
                  />
                </div>
              )}

              {/* 코멘트 표시 (처리 후) */}
              {!isPending && comments[item.id] && (
                <div className="mt-2 text-xs text-gray-500 italic">
                  코멘트: {comments[item.id]}
                </div>
              )}

              {errMsg && (
                <div className="mt-2 text-xs text-red-500">{errMsg}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
