"use client";

import { useState } from "react";
import { updateClaimStatus } from "@/app/actions/quality";

interface Claim {
  id: string;
  client_name: string;
  claim_type: string;
  claim_date: string;
  content: string;
  product_names: string[];
  status: "pending" | "in_progress" | "resolved";
  created_at: string;
}

const STATUS_META = {
  pending:     { label: "접수됨",  color: "bg-amber-100 text-amber-700" },
  in_progress: { label: "처리중",  color: "bg-blue-100 text-blue-700" },
  resolved:    { label: "해결완료", color: "bg-emerald-100 text-emerald-700" },
};

const CLAIM_TYPE_ICON: Record<string, string> = {
  "품질 이상": "🔴", "포장 불량": "📦", "수량 부족": "⚖️", "배송 지연": "🚚",
};

export default function TeamClaimsSection({ initialClaims }: { initialClaims: Claim[] }) {
  const [claims, setClaims]     = useState<Claim[]>(initialClaims);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading]   = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  async function handleStatus(id: string, newStatus: "pending" | "in_progress" | "resolved") {
    setLoading(id + newStatus);
    setErrors((p) => ({ ...p, [id]: "" }));
    try {
      const result = await updateClaimStatus(id, newStatus);
      if (result?.error) {
        setErrors((p) => ({ ...p, [id]: result.error! }));
      } else {
        setClaims((p) => p.map((c) => c.id === id ? { ...c, status: newStatus } : c));
      }
    } catch (e) {
      setErrors((p) => ({ ...p, [id]: (e as Error).message }));
    } finally {
      setLoading(null);
    }
  }

  if (claims.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-sm text-gray-400">
        이번 달 접수된 클레임 없음
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {claims.map((c, i) => {
        const meta   = STATUS_META[c.status];
        const icon   = CLAIM_TYPE_ICON[c.claim_type] ?? "📋";
        const isOpen = expanded === c.id;
        const err    = errors[c.id];

        return (
          <div key={c.id} className={i > 0 ? "border-t border-gray-100" : ""}>
            {/* 헤더 행 — 클릭으로 토글 */}
            <div
              className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : c.id)}
            >
              <span className="text-base shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{c.client_name}</div>
                <div className="text-xs text-gray-400">{c.claim_type} · {c.claim_date}</div>
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* 상세 패널 */}
            {isOpen && (
              <div className="bg-gray-50 border-t border-gray-100 px-5 py-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">클레임 내용</span>
                    <p className="text-gray-800">{c.content}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">해당 제품</span>
                    <p className="text-gray-700">
                      {c.product_names?.length > 0 ? c.product_names.join(", ") : "-"}
                    </p>
                  </div>
                </div>

                {/* 상태 변경 */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-gray-400">상태 변경:</span>
                  {(["pending", "in_progress", "resolved"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatus(c.id, s)}
                      disabled={c.status === s || !!loading}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                        c.status === s
                          ? `${STATUS_META[s].color} ring-2 ring-offset-1 ring-current`
                          : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
                      }`}
                    >
                      {loading === c.id + s ? "처리중…" : STATUS_META[s].label}
                    </button>
                  ))}
                </div>

                {err && <p className="text-xs text-red-500">{err}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
