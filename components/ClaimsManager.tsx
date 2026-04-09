"use client";

import { useState } from "react";
import { updateClaimStatus } from "@/app/actions/submit";

interface Claim {
  id: string;
  claim_date: string;
  worker_name: string;
  dept: string;
  client_name: string;
  product_names: string[];
  claim_type: string;
  content: string;
  status: "pending" | "in_progress" | "resolved";
  created_at: string;
}

type FilterStatus = "all" | "pending" | "in_progress" | "resolved";

const STATUS_META = {
  pending:     { label: "미처리",  color: "bg-red-100 text-red-700",      dot: "bg-red-500" },
  in_progress: { label: "처리중",  color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  resolved:    { label: "완료",    color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

const CLAIM_TYPE_ICON: Record<string, string> = {
  "품질 이상":  "🔴",
  "포장 불량":  "📦",
  "수량 부족":  "⚖️",
  "배송 지연":  "🚚",
};

export default function ClaimsManager({ initialClaims }: { initialClaims: Claim[] }) {
  const [claims, setClaims]           = useState<Claim[]>(initialClaims);
  const [filter, setFilter]           = useState<FilterStatus>("all");
  const [loading, setLoading]         = useState<string | null>(null);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [expanded, setExpanded]       = useState<string | null>(null);

  const filtered = filter === "all" ? claims : claims.filter((c) => c.status === filter);

  const counts = {
    all:         claims.length,
    pending:     claims.filter((c) => c.status === "pending").length,
    in_progress: claims.filter((c) => c.status === "in_progress").length,
    resolved:    claims.filter((c) => c.status === "resolved").length,
  };

  async function handleStatusChange(id: string, newStatus: "pending" | "in_progress" | "resolved") {
    setLoading(id + newStatus);
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const result = await updateClaimStatus(id, newStatus);
      if (result?.error) {
        setErrors((prev) => ({ ...prev, [id]: result.error! }));
      } else {
        setClaims((prev) =>
          prev.map((c) => c.id === id ? { ...c, status: newStatus } : c)
        );
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "in_progress", "resolved"] as FilterStatus[]).map((s) => {
          const meta = s === "all"
            ? { label: "전체", color: "bg-gray-100 text-gray-700" }
            : STATUS_META[s];
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-[#1F3864] text-white shadow"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {meta.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : meta.color}`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 클레임 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          해당 상태의 클레임이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((claim) => {
            const meta    = STATUS_META[claim.status];
            const isOpen  = expanded === claim.id;
            const icon    = CLAIM_TYPE_ICON[claim.claim_type] ?? "📋";
            const err     = errors[claim.id];
            const busy    = loading?.startsWith(claim.id);

            return (
              <div
                key={claim.id}
                className={`bg-white rounded-xl border transition-all ${
                  claim.status === "pending"
                    ? "border-red-200"
                    : claim.status === "in_progress"
                    ? "border-amber-200"
                    : "border-gray-200"
                }`}
              >
                {/* 헤더 행 */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : claim.id)}
                >
                  <span className="text-xl shrink-0">{icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{claim.client_name}</span>
                      <span className="text-xs text-gray-400">{claim.claim_type}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {claim.dept} · {claim.worker_name} · {claim.claim_date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* 빠른 상태 버튼 */}
                    {claim.status === "pending" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(claim.id, "in_progress"); }}
                        disabled={!!busy}
                        className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {loading === claim.id + "in_progress" ? "…" : "접수"}
                      </button>
                    )}
                    {claim.status === "in_progress" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(claim.id, "resolved"); }}
                        disabled={!!busy}
                        className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {loading === claim.id + "resolved" ? "…" : "완료"}
                      </button>
                    )}
                    {claim.status === "resolved" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(claim.id, "in_progress"); }}
                        disabled={!!busy}
                        className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer"
                      >
                        재오픈
                      </button>
                    )}
                    <span className="text-gray-300 text-sm">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* 상세 펼침 */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">클레임 내용</span>
                        <p className="text-gray-800">{claim.content}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">해당 제품</span>
                        <p className="text-gray-700">
                          {claim.product_names?.length > 0
                            ? claim.product_names.join(", ")
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* 상태 변경 전체 버튼 */}
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 mr-1">상태 변경:</span>
                      {(["pending", "in_progress", "resolved"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(claim.id, s)}
                          disabled={claim.status === s || !!busy}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                            claim.status === s
                              ? `${STATUS_META[s].color} ring-2 ring-offset-1 ring-current`
                              : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
                          }`}
                        >
                          {loading === claim.id + s ? "처리중…" : STATUS_META[s].label}
                        </button>
                      ))}
                    </div>

                    {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
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
