"use client";

import { useState } from "react";
import { updateAuditActual, finalizeAudit, type AuditEntry } from "@/app/actions/inventory-audit";

interface Props {
  entries: AuditEntry[];
  auditDate: string;
  isCoo: boolean;
  isFinalized: boolean;
}

export default function InventoryAuditForm({ entries, auditDate, isCoo, isFinalized }: Props) {
  const [rows, setRows] = useState(entries);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 섹션별 그룹
  const sections = Array.from(new Set(rows.map((r) => r.section)));

  function updateRow(id: string, field: "actual_stock" | "adjustment_reason", value: number | string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "actual_stock") {
          updated.difference = Number(value) - r.system_stock;
        }
        return updated;
      })
    );
  }

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSavingId(id);
    setMsg(null);
    const result = await updateAuditActual(id, row.actual_stock, row.adjustment_reason ?? undefined);
    if (result.success) {
      setMsg({ type: "ok", text: `${row.product_name} 저장 완료` });
    } else {
      setMsg({ type: "err", text: result.error ?? "저장 실패" });
    }
    setSavingId(null);
  }

  async function saveAll() {
    setLoading(true);
    setMsg(null);
    let errorCount = 0;
    for (const row of rows) {
      const result = await updateAuditActual(row.id, row.actual_stock, row.adjustment_reason ?? undefined);
      if (!result.success) errorCount++;
    }
    if (errorCount > 0) {
      setMsg({ type: "err", text: `${errorCount}건 저장 실패` });
    } else {
      setMsg({ type: "ok", text: "일괄 저장 완료" });
    }
    setLoading(false);
  }

  async function handleFinalize() {
    if (!confirm(`${auditDate} 실사를 확정하시겠습니까?\n확정 시 실물 재고가 시스템 재고에 반영됩니다.`)) return;
    setLoading(true);
    setMsg(null);
    const result = await finalizeAudit(auditDate);
    if (result.success) {
      setMsg({ type: "ok", text: "실사 확정 완료! 시스템 재고에 반영되었습니다." });
      setRows((prev) => prev.map((r) => ({ ...r, adjusted: true })));
    } else {
      setMsg({ type: "err", text: result.error ?? "확정 실패" });
    }
    setLoading(false);
  }

  function diffColor(diff: number) {
    if (diff === 0) return "text-emerald-600";
    if (diff > 0) return "text-blue-600";
    return "text-red-600";
  }

  function diffLabel(diff: number) {
    if (diff === 0) return "일치";
    if (diff > 0) return "초과";
    return "부족";
  }

  const totalDiffItems = rows.filter((r) => r.difference !== 0).length;
  const totalAbsDiff = rows.reduce((s, r) => s + Math.abs(r.difference), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 메시지 */}
      {msg && (
        <div
          className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 실사 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{rows.length}</div>
          <div className="text-xs text-gray-500 mt-1">전체 품목</div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
          <div className={`text-2xl font-bold ${totalDiffItems > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {totalDiffItems}
          </div>
          <div className="text-xs text-gray-500 mt-1">차이 품목</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{totalAbsDiff.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">총 차이량</div>
        </div>
      </div>

      {/* 버튼 영역 */}
      {!isFinalized && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={saveAll}
            disabled={loading}
            className="text-sm bg-[#1F3864] text-white px-4 py-2 rounded-xl hover:bg-[#2a4a7f] transition-colors font-medium disabled:opacity-50"
          >
            {loading ? "저장 중..." : "일괄 저장"}
          </button>
          {isCoo && (
            <button
              onClick={handleFinalize}
              disabled={loading}
              className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
            >
              실사 확정
            </button>
          )}
        </div>
      )}

      {isFinalized && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          이 실사는 확정 완료되었습니다. 시스템 재고에 반영 완료.
        </div>
      )}

      {/* 섹션별 테이블 */}
      {sections.map((section) => {
        const sectionRows = rows.filter((r) => r.section === section);
        return (
          <div key={section} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1F3864] text-white px-4 py-2.5 text-sm font-bold flex items-center justify-between">
              <span>{section}</span>
              <span className="text-xs text-blue-200">{sectionRows.length}개 품목</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">품목</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">시스템 재고</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">실물 재고</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">차이</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">사유</th>
                    {!isFinalized && <th className="text-right px-3 py-2 text-gray-500 font-medium">저장</th>}
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{row.product_name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.system_stock.toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {isFinalized ? (
                          <span className="text-gray-800 font-medium">{row.actual_stock.toFixed(1)}</span>
                        ) : (
                          <input
                            type="number"
                            step="0.1"
                            value={row.actual_stock || ""}
                            onChange={(e) => updateRow(row.id, "actual_stock", Number(e.target.value))}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs text-right focus:border-[#1F3864] outline-none"
                          />
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold ${diffColor(row.difference)}`}>
                        {row.difference !== 0 && (
                          <>
                            {row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}
                            <span className="text-[10px] ml-0.5 font-normal">({diffLabel(row.difference)})</span>
                          </>
                        )}
                        {row.difference === 0 && <span className="text-emerald-500">0</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        {isFinalized ? (
                          <span className="text-gray-400">{row.adjustment_reason ?? "-"}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.adjustment_reason ?? ""}
                            onChange={(e) => updateRow(row.id, "adjustment_reason", e.target.value)}
                            placeholder="차이 사유"
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#1F3864] outline-none"
                          />
                        )}
                      </td>
                      {!isFinalized && (
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => saveRow(row.id)}
                            disabled={savingId === row.id}
                            className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-2 py-1 rounded hover:bg-[#1F3864]/5 disabled:opacity-50"
                          >
                            {savingId === row.id ? "..." : "저장"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
