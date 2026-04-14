"use client";

import { useState } from "react";
import { updateClaimStatus, updateClaimDetails, fetchClaimTraceability } from "@/app/actions/quality";
import { addCommunicationLog, updateClaimSla } from "@/app/actions/claim-sla";

interface CommunicationEntry {
  date: string;
  type: string;
  content: string;
  by: string;
}

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
  production_date?: string | null;
  root_cause?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  compensation_type?: string | null;
  compensation_amount?: number | null;
  communication_log?: CommunicationEntry[] | null;
}

type TraceResult = {
  prodLogs: Array<{
    id: string; work_date: string; worker_name: string; dept: string;
    product_name: string; input_qty: number; output_qty: number;
    waste_qty: number; issue_note: string | null;
  }>;
  hygieneChecks: Array<{
    id: string; check_date: string; worker_name: string; dept: string;
    items: Record<string, boolean>;
  }>;
};

type FilterStatus = "all" | "pending" | "in_progress" | "resolved";
type SortKey = "created_at" | "claim_date" | "client_name" | "status";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "created_at",  label: "접수일시" },
  { key: "claim_date",  label: "클레임 날짜" },
  { key: "client_name", label: "거래처명" },
  { key: "status",      label: "상태" },
];

const STATUS_ORDER = { pending: 0, in_progress: 1, resolved: 2 };

const STATUS_META = {
  pending:     { label: "미처리",  color: "bg-red-100 text-red-700",         dot: "bg-red-500" },
  in_progress: { label: "처리중",  color: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  resolved:    { label: "완료",    color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

const CLAIM_TYPE_ICON: Record<string, string> = {
  "품질 이상":  "🔴",
  "포장 불량":  "📦",
  "수량 부족":  "⚖️",
  "배송 지연":  "🚚",
};

export default function ClaimsManager({ initialClaims }: { initialClaims: Claim[] }) {
  const [claims, setClaims]     = useState<Claim[]>(initialClaims);
  const [filter, setFilter]     = useState<FilterStatus>("all");
  const [sortKey, setSortKey]   = useState<SortKey>("created_at");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [loading, setLoading]   = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  // 역추적 관련 state
  const [traceEdits, setTraceEdits]   = useState<Record<string, { production_date: string; root_cause: string }>>({});
  const [traceSaving, setTraceSaving] = useState<string | null>(null);
  const [traceData, setTraceData]     = useState<Record<string, TraceResult | "loading">>({});

  // 소통 이력 관련 state
  const [commType, setCommType]           = useState<Record<string, string>>({});
  const [commContent, setCommContent]     = useState<Record<string, string>>({});
  const [commSaving, setCommSaving]       = useState<string | null>(null);
  const [compEdits, setCompEdits]         = useState<Record<string, { type: string; amount: string }>>({});
  const [compSaving, setCompSaving]       = useState<string | null>(null);

  function getTraceEdit(claim: Claim) {
    return traceEdits[claim.id] ?? {
      production_date: claim.production_date ?? "",
      root_cause:      claim.root_cause ?? "",
    };
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "client_name" ? "asc" : "desc");
    }
  }

  const filtered = (filter === "all" ? claims : claims.filter((c) => c.status === filter))
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status") {
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      } else if (sortKey === "client_name") {
        cmp = a.client_name.localeCompare(b.client_name, "ko");
      } else {
        cmp = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

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

  async function handleSaveDetails(claim: Claim) {
    const edit = getTraceEdit(claim);
    setTraceSaving(claim.id);
    try {
      await updateClaimDetails(claim.id, edit.production_date || null, edit.root_cause || null);
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? { ...c, production_date: edit.production_date || null, root_cause: edit.root_cause || null }
            : c
        )
      );
    } catch (err) {
      setErrors((prev) => ({ ...prev, [claim.id]: (err as Error).message }));
    } finally {
      setTraceSaving(null);
    }
  }

  async function handleAddComm(claimId: string) {
    const type = commType[claimId] || "phone";
    const content = commContent[claimId] || "";
    if (!content.trim()) return;
    setCommSaving(claimId);
    try {
      const result = await addCommunicationLog(claimId, { type, content: content.trim() });
      if (result.success && result.entry) {
        setClaims((prev) =>
          prev.map((c) => {
            if (c.id !== claimId) return c;
            const log = Array.isArray(c.communication_log) ? c.communication_log : [];
            return { ...c, communication_log: [...log, result.entry as CommunicationEntry] };
          })
        );
        setCommContent((prev) => ({ ...prev, [claimId]: "" }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [claimId]: (err as Error).message }));
    } finally {
      setCommSaving(null);
    }
  }

  async function handleSaveCompensation(claim: Claim) {
    const edit = compEdits[claim.id] ?? {
      type: claim.compensation_type ?? "없음",
      amount: String(claim.compensation_amount ?? 0),
    };
    setCompSaving(claim.id);
    try {
      const result = await updateClaimSla(claim.id, {
        compensation_type: edit.type,
        compensation_amount: Number(edit.amount) || 0,
      });
      if (result.success) {
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claim.id
              ? { ...c, compensation_type: edit.type, compensation_amount: Number(edit.amount) || 0 }
              : c
          )
        );
      } else {
        setErrors((prev) => ({ ...prev, [claim.id]: result.error ?? "" }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [claim.id]: (err as Error).message }));
    } finally {
      setCompSaving(null);
    }
  }

  async function handleFetchTrace(claimId: string, productionDate: string) {
    if (!productionDate) return;
    setTraceData((prev) => ({ ...prev, [claimId]: "loading" }));
    try {
      const result = await fetchClaimTraceability(productionDate);
      setTraceData((prev) => ({ ...prev, [claimId]: result }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [claimId]: (err as Error).message }));
      setTraceData((prev) => { const n = { ...prev }; delete n[claimId]; return n; });
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

      {/* 정렬 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 shrink-0">정렬:</span>
        {SORT_OPTIONS.map(({ key, label }) => {
          const active = sortKey === key;
          return (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#1F3864] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {label}
              {active && (
                <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
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
            const edit    = getTraceEdit(claim);
            const trace   = traceData[claim.id];
            const isTraceLoading = trace === "loading";
            const traceResult = trace && trace !== "loading" ? trace : null;

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
                      {claim.production_date && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          생산일 {claim.production_date}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {claim.dept} · {claim.worker_name} · {claim.claim_date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-xl flex flex-col gap-4">

                    {/* 기본 정보 */}
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

                    {/* 상태 변경 */}
                    <div className="flex items-center gap-2 flex-wrap">
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

                    {/* 생산 이력 역추적 */}
                    <div className="border-t border-blue-100 pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-blue-700">🔍 생산 이력 역추적</span>
                        <span className="text-xs text-gray-400">— 의심 생산일 기준으로 당일 생산·위생 기록을 조회합니다</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">의심 생산일</label>
                          <input
                            type="date"
                            value={edit.production_date}
                            onChange={(e) =>
                              setTraceEdits((prev) => ({
                                ...prev,
                                [claim.id]: { ...edit, production_date: e.target.value },
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">원인 분석</label>
                          <textarea
                            value={edit.root_cause}
                            onChange={(e) =>
                              setTraceEdits((prev) => ({
                                ...prev,
                                [claim.id]: { ...edit, root_cause: e.target.value },
                              }))
                            }
                            rows={2}
                            placeholder="ex) 당일 품질팀 위생점검 누락, 작업 중 온도 이탈 등"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => handleSaveDetails(claim)}
                          disabled={traceSaving === claim.id}
                          className="text-xs bg-[#1F3864] text-white px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50 cursor-pointer hover:bg-[#2a4a7f]"
                        >
                          {traceSaving === claim.id ? "저장중…" : "💾 저장"}
                        </button>
                        <button
                          onClick={() => handleFetchTrace(claim.id, edit.production_date)}
                          disabled={!edit.production_date || isTraceLoading}
                          className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg font-semibold disabled:opacity-40 cursor-pointer hover:bg-blue-700"
                        >
                          {isTraceLoading ? "조회중…" : "🔎 역추적 조회"}
                        </button>
                      </div>

                      {/* 역추적 결과 */}
                      {traceResult && (
                        <div className="flex flex-col gap-3">

                          {/* 생산 로그 */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1.5">
                              📋 당일 생산 기록 ({edit.production_date}) — {traceResult.prodLogs.length}건
                            </div>
                            {traceResult.prodLogs.length === 0 ? (
                              <div className="text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                해당 날짜 생산 기록 없음
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">팀</th>
                                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">작업자</th>
                                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">품명</th>
                                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">투입</th>
                                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">생산</th>
                                      <th className="text-center px-2 py-1.5 text-gray-500 font-medium">폐기</th>
                                      <th className="text-left px-2 py-1.5 text-amber-600 font-medium">이슈</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-50">
                                    {traceResult.prodLogs.map((log) => (
                                      <tr key={log.id} className={log.issue_note ? "bg-amber-50" : ""}>
                                        <td className="px-2 py-1.5 text-gray-600">{log.dept}</td>
                                        <td className="px-2 py-1.5 text-gray-600">{log.worker_name}</td>
                                        <td className="px-2 py-1.5 text-gray-800 font-medium">{log.product_name}</td>
                                        <td className="px-2 py-1.5 text-center text-gray-600">{log.input_qty}</td>
                                        <td className="px-2 py-1.5 text-center text-emerald-700 font-semibold">{log.output_qty}</td>
                                        <td className="px-2 py-1.5 text-center text-red-500">{log.waste_qty || "-"}</td>
                                        <td className="px-2 py-1.5 text-amber-700">{log.issue_note ?? "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* 위생 체크 */}
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1.5">
                              🧹 당일 위생 점검 기록 — {traceResult.hygieneChecks.length}건
                            </div>
                            {traceResult.hygieneChecks.length === 0 ? (
                              <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium">
                                ⚠️ 해당 날짜 위생 점검 기록 없음 — 누락 가능성 확인 필요
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {traceResult.hygieneChecks.map((hc) => {
                                  const failedItems = Object.entries(hc.items)
                                    .filter(([, v]) => !v)
                                    .map(([k]) => k);
                                  return (
                                    <div key={hc.id} className={`text-xs rounded-lg px-3 py-2 border ${failedItems.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
                                      <span className="font-semibold text-gray-700">{hc.dept}</span>
                                      <span className="text-gray-400 ml-2">{hc.worker_name}</span>
                                      {failedItems.length > 0 ? (
                                        <span className="ml-2 text-red-600 font-medium">
                                          ❌ 미이행: {failedItems.join(", ")}
                                        </span>
                                      ) : (
                                        <span className="ml-2 text-emerald-600 font-medium">✅ 전 항목 이행</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 저장된 원인 분석 표시 */}
                          {claim.root_cause && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                              <span className="text-xs font-semibold text-blue-700">📝 원인 분석: </span>
                              <span className="text-xs text-blue-800">{claim.root_cause}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 보상 정보 */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-xs font-bold text-gray-700 mb-2">보상 정보</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">보상 유형</label>
                          <select
                            value={(compEdits[claim.id]?.type) ?? (claim.compensation_type ?? "없음")}
                            onChange={(e) =>
                              setCompEdits((prev) => ({
                                ...prev,
                                [claim.id]: {
                                  ...(prev[claim.id] ?? { type: claim.compensation_type ?? "없음", amount: String(claim.compensation_amount ?? 0) }),
                                  type: e.target.value,
                                },
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            <option value="없음">없음</option>
                            <option value="대체납품">대체납품</option>
                            <option value="환불">환불</option>
                            <option value="할인">할인</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">보상 금액 (원)</label>
                          <input
                            type="number"
                            value={(compEdits[claim.id]?.amount) ?? String(claim.compensation_amount ?? 0)}
                            onChange={(e) =>
                              setCompEdits((prev) => ({
                                ...prev,
                                [claim.id]: {
                                  ...(prev[claim.id] ?? { type: claim.compensation_type ?? "없음", amount: String(claim.compensation_amount ?? 0) }),
                                  amount: e.target.value,
                                },
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => handleSaveCompensation(claim)}
                            disabled={compSaving === claim.id}
                            className="text-xs bg-[#1F3864] text-white px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50 cursor-pointer hover:bg-[#2a4a7f]"
                          >
                            {compSaving === claim.id ? "저장중..." : "보상 저장"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 소통 이력 */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-xs font-bold text-gray-700 mb-2">소통 이력</div>

                      {/* 기존 이력 목록 */}
                      {(Array.isArray(claim.communication_log) && claim.communication_log.length > 0) ? (
                        <div className="flex flex-col gap-1.5 mb-3">
                          {claim.communication_log.map((entry, idx) => {
                            const typeLabel = entry.type === "phone" ? "전화" : entry.type === "email" ? "이메일" : entry.type === "visit" ? "방문" : entry.type;
                            const typeColor = entry.type === "phone" ? "bg-blue-100 text-blue-700" : entry.type === "email" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700";
                            return (
                              <div key={idx} className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${typeColor}`}>{typeLabel}</span>
                                  <span className="text-gray-400">{entry.date ? new Date(entry.date).toLocaleString("ko-KR") : "-"}</span>
                                  <span className="text-gray-500 font-medium">{entry.by}</span>
                                </div>
                                <div className="text-gray-700">{entry.content}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mb-3">소통 이력이 없습니다</div>
                      )}

                      {/* 소통 추가 */}
                      <div className="flex flex-col gap-2 bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 font-medium">소통 추가</div>
                        <div className="flex gap-2 items-start">
                          <select
                            value={commType[claim.id] ?? "phone"}
                            onChange={(e) => setCommType((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 shrink-0"
                          >
                            <option value="phone">전화</option>
                            <option value="email">이메일</option>
                            <option value="visit">방문</option>
                          </select>
                          <textarea
                            value={commContent[claim.id] ?? ""}
                            onChange={(e) => setCommContent((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                            rows={2}
                            placeholder="소통 내용을 입력하세요"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                          <button
                            onClick={() => handleAddComm(claim.id)}
                            disabled={commSaving === claim.id || !(commContent[claim.id] ?? "").trim()}
                            className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 cursor-pointer hover:bg-[#2a4a7f] shrink-0"
                          >
                            {commSaving === claim.id ? "..." : "추가"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {err && <p className="text-xs text-red-500">{err}</p>}
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
