"use client";

import { useState, useRef } from "react";
import { submitDelivery } from "@/app/actions/submit";

interface Customer {
  id: string;
  name: string;
  type: string;
}

interface DeliveryItem {
  product: string;
  isCustom: boolean;
  qty_kg: number;
  unit_price: number;
  amount: number;
}

interface Props {
  customers: Customer[];
  onSuccess: () => void;
  onError: (msg: string) => void;
}

const PRODUCT_OPTIONS = [
  "돼지 머리", "돼지 뒷고기", "돼지 족발", "돼지 내장", "돼지 뼈",
  "돼지 껍데기", "육수 (포장)", "국물 베이스", "순대 원료", "혼합 부산물",
];

const EMPTY_ITEM: DeliveryItem = { product: "", isCustom: false, qty_kg: 0, unit_price: 0, amount: 0 };

export default function DeliveryForm({ customers, onSuccess, onError }: Props) {
  const [items, setItems] = useState<DeliveryItem[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const totalAmount = items.reduce((s, it) => s + it.amount, 0);

  function updateItem(idx: number, field: keyof DeliveryItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      // 자동 금액 계산
      if (field === "qty_kg" || field === "unit_price") {
        item.amount = item.qty_kg * item.unit_price;
      }
      next[idx] = item;
      return next;
    });
  }

  function addRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || items.every((it) => !it.product)) {
      onError("품목을 1개 이상 입력해주세요.");
      return;
    }
    const validItems = items.filter((it) => it.product.trim());
    if (validItems.length === 0) {
      onError("품목명을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      const result = await submitDelivery(fd, validItems);
      if (!result.success) {
        onError(result.error ?? "저장 중 오류가 발생했습니다.");
      } else {
        onSuccess();
      }
    } catch (err) {
      onError((err as Error).message ?? "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-5">
      <h2 className="font-bold text-gray-800">납품전표 입력</h2>

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">납품 날짜 <span className="text-red-500">*</span></label>
        <input name="delivery_date" type="date" required
          defaultValue={new Date().toISOString().split("T")[0]}
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none" />
      </div>

      {/* 거래처 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">거래처 <span className="text-red-500">*</span></label>
        {customers.length > 0 ? (
          <select name="customer_name" required
            onChange={(e) => {
              const selected = customers.find((c) => c.name === e.target.value);
              const hiddenInput = formRef.current?.querySelector<HTMLInputElement>('input[name="customer_id"]');
              if (hiddenInput) hiddenInput.value = selected?.id ?? "";
            }}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none bg-white">
            <option value="">거래처를 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name} ({c.type})</option>
            ))}
          </select>
        ) : (
          <input name="customer_name" required type="text" placeholder="거래처명 입력"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none" />
        )}
        <input type="hidden" name="customer_id" defaultValue="" />
      </div>

      {/* 납품 품목 동적 rows */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">납품 품목 <span className="text-red-500">*</span></label>
          <button type="button" onClick={addRow}
            className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-3 py-1 rounded-lg hover:bg-[#1F3864]/5 transition-colors">
            + 품목 추가
          </button>
        </div>

        {/* 헤더 */}
        <div className="grid gap-2 text-[10px] text-gray-400 font-semibold"
          style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr auto" }}>
          <span>품목명</span>
          <span className="text-center">수량(kg)</span>
          <span className="text-center">단가(원)</span>
          <span className="text-center">금액(원)</span>
          <span></span>
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="grid gap-2 items-center"
            style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr auto" }}>
            {item.isCustom ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="품목명 입력"
                  value={item.product}
                  autoFocus
                  onChange={(e) => updateItem(idx, "product", e.target.value)}
                  className="flex-1 rounded-lg border border-[#1F3864]/40 px-2 py-2 text-xs focus:border-[#1F3864] outline-none" />
                <button type="button" onClick={() => {
                  setItems((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], isCustom: false, product: "" };
                    return next;
                  });
                }} className="text-gray-300 hover:text-gray-500 text-xs px-1">↩</button>
              </div>
            ) : (
              <select
                value={item.product}
                onChange={(e) => {
                  if (e.target.value === "__custom") {
                    setItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], isCustom: true, product: "" };
                      return next;
                    });
                  } else {
                    updateItem(idx, "product", e.target.value);
                  }
                }}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs focus:border-[#1F3864] outline-none bg-white truncate">
                <option value="">품목 선택</option>
                {PRODUCT_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__custom">✏️ 직접 입력</option>
              </select>
            )}

            <input
              type="number"
              value={item.qty_kg || ""}
              onChange={(e) => updateItem(idx, "qty_kg", Number(e.target.value))}
              placeholder="0"
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-center focus:border-[#1F3864] outline-none" />

            <input
              type="number"
              value={item.unit_price || ""}
              onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
              placeholder="0"
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs text-center focus:border-[#1F3864] outline-none" />

            <div className="text-xs text-right font-semibold text-[#1F3864] min-w-[52px]">
              {item.amount > 0 ? (item.amount / 10_000).toFixed(1) + "만" : "-"}
            </div>

            {items.length > 1 && (
              <button type="button" onClick={() => removeRow(idx)}
                className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors">
                ✕
              </button>
            )}
          </div>
        ))}

        {/* 합계 */}
        {totalAmount > 0 && (
          <div className="flex justify-between items-center bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-xl px-4 py-2.5 mt-1">
            <span className="text-sm font-medium text-gray-600">납품 합계</span>
            <span className="text-lg font-bold text-[#1F3864]">
              {(totalAmount / 10_000).toLocaleString()}만원
            </span>
          </div>
        )}
      </div>

      {/* 운전기사 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">운전기사</label>
        <input name="driver" type="text" placeholder="예: 홍길동"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none" />
      </div>

      {/* 비고 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">비고</label>
        <textarea name="notes" rows={2} placeholder="특이사항, 온도 조건 등"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none" />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-50 transition-all">
        {loading ? "저장 중..." : "납품전표 제출"}
      </button>
    </form>
  );
}
