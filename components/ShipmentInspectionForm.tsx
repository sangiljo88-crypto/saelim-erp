"use client";

import { useState } from "react";
import { submitInspection } from "@/app/actions/inspection";
import type { InspectionItem } from "@/app/actions/inspection";

interface Props {
  deliveryId?: string | null;
  defaultCustomer?: string;
  defaultItems?: { product_name: string; qty_kg: number }[];
  onSuccess?: () => void;
}

const EMPTY_ITEM: InspectionItem = {
  product_name: "",
  qty_kg: 0,
  weight_ok: false,
  temp_ok: false,
  package_ok: false,
  label_ok: false,
  notes: "",
};

export default function ShipmentInspectionForm({
  deliveryId,
  defaultCustomer = "",
  defaultItems,
  onSuccess,
}: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [inspectionDate, setInspectionDate] = useState(today);
  const [customerName, setCustomerName] = useState(defaultCustomer);
  const [items, setItems] = useState<InspectionItem[]>(
    defaultItems && defaultItems.length > 0
      ? defaultItems.map((di) => ({ ...EMPTY_ITEM, product_name: di.product_name, qty_kg: di.qty_kg }))
      : [{ ...EMPTY_ITEM }]
  );
  const [tempReading, setTempReading] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 전체 합격 여부 판정
  const allChecked = items.length > 0 && items.every(
    (item) => item.product_name.trim() && item.weight_ok && item.temp_ok && item.package_ok && item.label_ok
  );

  function updateItem(idx: number, field: keyof InspectionItem, value: string | number | boolean) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      setMsg({ type: "error", text: "거래처명을 입력해주세요." });
      return;
    }

    const validItems = items.filter((it) => it.product_name.trim());
    if (validItems.length === 0) {
      setMsg({ type: "error", text: "검품 품목을 1개 이상 입력해주세요." });
      return;
    }

    setLoading(true);
    try {
      const result = await submitInspection({
        delivery_id: deliveryId ?? null,
        inspection_date: inspectionDate,
        customer_name: customerName,
        items: validItems,
        temp_reading: tempReading ? Number(tempReading) : null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setMsg({ type: "error", text: result.error ?? "저장 실패" });
      } else {
        setMsg({ type: "success", text: "검품 기록이 저장되었습니다." });
        // 폼 초기화
        setItems([{ ...EMPTY_ITEM }]);
        setTempReading("");
        setNotes("");
        if (!deliveryId) setCustomerName("");
        onSuccess?.();
      }
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-5">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <span>📋</span> 출하 검품 체크리스트
      </h2>

      {/* 알림 */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {msg.text}
        </div>
      )}

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">검품 날짜 <span className="text-red-500">*</span></label>
        <input
          type="date"
          value={inspectionDate}
          onChange={(e) => setInspectionDate(e.target.value)}
          required
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none"
        />
      </div>

      {/* 거래처 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">거래처명 <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="거래처명 입력"
          required
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none"
        />
      </div>

      {/* 검품 품목 리스트 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">검품 품목 <span className="text-red-500">*</span></label>
          <button
            type="button"
            onClick={addItem}
            className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-3 py-1 rounded-lg hover:bg-[#1F3864]/5 transition-colors"
          >
            + 품목 추가
          </button>
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
              <input
                type="text"
                value={item.product_name}
                onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                placeholder="품목명"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
              />
              <input
                type="number"
                value={item.qty_kg || ""}
                onChange={(e) => updateItem(idx, "qty_kg", Number(e.target.value))}
                placeholder="수량(kg)"
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-center focus:border-[#1F3864] outline-none"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-gray-300 hover:text-red-400 text-base transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 4개 체크박스 */}
            <div className="flex flex-wrap gap-3 pl-8">
              {([
                { key: "weight_ok" as const, label: "중량확인" },
                { key: "temp_ok" as const,   label: "온도확인" },
                { key: "package_ok" as const, label: "포장상태" },
                { key: "label_ok" as const,  label: "표시확인" },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item[key] as boolean}
                    onChange={(e) => updateItem(idx, key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#1F3864] focus:ring-[#1F3864]"
                  />
                  <span className={`text-xs font-medium ${
                    item[key] ? "text-emerald-700" : "text-gray-500"
                  }`}>
                    {label} {item[key] ? "✓" : ""}
                  </span>
                </label>
              ))}
            </div>

            {/* 품목별 비고 */}
            <div className="pl-8">
              <input
                type="text"
                value={item.notes}
                onChange={(e) => updateItem(idx, "notes", e.target.value)}
                placeholder="품목별 비고 (선택)"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-[#1F3864] outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 온도 측정값 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">온도 측정값 (°C)</label>
        <input
          type="number"
          step="0.1"
          value={tempReading}
          onChange={(e) => setTempReading(e.target.value)}
          placeholder="예: -18.5"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none w-40"
        />
      </div>

      {/* 종합 비고 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">종합 비고</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="특이사항, 개선 요청 사항 등"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none"
        />
      </div>

      {/* 합격/불합격 표시 */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
        allChecked
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
      }`}>
        <span className="text-lg">{allChecked ? "✅" : "⚠️"}</span>
        <span className={`text-sm font-semibold ${
          allChecked ? "text-emerald-700" : "text-amber-700"
        }`}>
          {allChecked ? "전체 합격 (PASS)" : "일부 미확인 항목 있음 (FAIL)"}
        </span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-50 transition-all"
      >
        {loading ? "저장 중..." : "검품 기록 제출"}
      </button>
    </form>
  );
}
