"use client";

import { useState } from "react";
import { startAudit } from "@/app/actions/inventory-audit";
import { useRouter } from "next/navigation";

export default function AuditStarter({ defaultDate }: { defaultDate: string }) {
  const [auditDate, setAuditDate] = useState(defaultDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleStart() {
    if (!auditDate) {
      setError("실사 날짜를 선택해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await startAudit(auditDate);
    if (result.success) {
      router.push(`/inventory/audit?date=${auditDate}`);
      router.refresh();
    } else {
      setError(result.error ?? "실사 시작 실패");
    }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center flex flex-col items-center gap-4">
      <div className="text-4xl mb-1">📋</div>
      <div className="font-semibold text-gray-700">재고 실사를 시작하세요</div>
      <div className="text-sm text-gray-400">
        현재 시스템 재고를 기준으로 실사 항목이 생성됩니다
      </div>

      <div className="flex items-center gap-3 mt-2">
        <label className="text-sm text-gray-600">실사 날짜:</label>
        <input
          type="date"
          value={auditDate}
          onChange={(e) => setAuditDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2 w-full max-w-md">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className="bg-[#1F3864] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#162c52] disabled:opacity-50 transition-all"
      >
        {loading ? "생성 중..." : "실사 시작"}
      </button>
    </div>
  );
}
