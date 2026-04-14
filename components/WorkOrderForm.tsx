"use client";

import { useState } from "react";
import { submitWorkOrder } from "@/app/actions/production";

interface WorkItem {
  product: string;
  pkg_unit_g: number;
  raw_input_kg: number;
  target_count: number;
  production_count: number;
  fat_loss_kg: number;
}

const PROCESS_PRODUCTS = [
  "소선지", "순도리돈두슬라이스", "편육", "모듬내장", "국머리혼합",
  "수육", "족발", "순대", "돈까스용", "직화구이용", "기타",
];

export default function WorkOrderForm() {
  const today = new Date().toISOString().split("T")[0];
  const [orderDate, setOrderDate] = useState(today);
  const [workHours, setWorkHours] = useState("08:30~18:00");
  const [workers, setWorkers] = useState("");
  const [items, setItems] = useState<WorkItem[]>([
    { product: "", pkg_unit_g: 0, raw_input_kg: 0, target_count: 0, production_count: 0, fat_loss_kg: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function addRow() {
    setItems((p) => [...p, { product: "", pkg_unit_g: 0, raw_input_kg: 0, target_count: 0, production_count: 0, fat_loss_kg: 0 }]);
  }
  function removeRow(i: number) {
    setItems((p) => p.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, field: keyof WorkItem, val: string | number) {
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  async function handleSubmit() {
    const validItems = items.filter((it) => it.product.trim());
    if (!validItems.length) return;
    setLoading(true);
    try {
      await submitWorkOrder(validItems, workers, workHours, orderDate);
      setDone(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2">✅</div>
      <div className="font-bold text-emerald-700">업무지시서 저장 완료</div>
      <div className="text-sm text-emerald-600 mt-1">가공팀에 전달되었습니다</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">계속 입력</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">가공팀 업무지시서</div>
        <div className="text-xs text-blue-200 mt-0.5">개발이사 → 가공팀 작업 지시</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 날짜 + 근무시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">작업 날짜</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">근무시간</label>
            <input type="text" value={workHours} onChange={(e) => setWorkHours(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
        </div>

        {/* 인원 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">인원 (쉼표 구분)</label>
          <input type="text" value={workers} onChange={(e) => setWorkers(e.target.value)}
            placeholder="예: 쿠이, 바르른, 라이, 김하늘, 이수아..."
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
        </div>

        {/* 작업 목록 테이블 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500">작업 내용</label>
            <button type="button" onClick={addRow}
              className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer hover:bg-[#162c52]">
              + 행 추가
            </button>
          </div>

          {/* 헤더 */}
          <div className="grid text-[10px] text-gray-400 font-semibold px-2 py-1 bg-gray-50 rounded-lg"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 24px" }}>
            <span>작업내용</span>
            <span className="text-center">포장단위(g)</span>
            <span className="text-center">원료투입(kg)</span>
            <span className="text-center">목표개수</span>
            <span className="text-center">생산량</span>
            <span className="text-center">지방로스(kg)</span>
            <span />
          </div>

          {items.map((item, i) => (
            <div key={i} className="grid gap-1 items-center"
              style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 24px" }}>
              <select value={item.product} onChange={(e) => updateItem(i, "product", e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864] bg-white">
                <option value="">선택</option>
                {PROCESS_PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {(["pkg_unit_g", "raw_input_kg", "target_count", "production_count", "fat_loss_kg"] as const).map((f) => (
                <input key={f} type="number" value={item[f] || ""}
                  onChange={(e) => updateItem(i, f, Number(e.target.value))}
                  className={`border rounded-lg px-2 py-2 text-xs text-center outline-none focus:border-[#1F3864] ${
                    f === "production_count" ? "bg-yellow-50 border-yellow-300" : "border-gray-200"
                  }`} />
              ))}
              <button type="button" onClick={() => removeRow(i)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none cursor-pointer">×</button>
            </div>
          ))}
        </div>

        {/* 로스율 계산 표시 */}
        {items.some((it) => it.target_count > 0 && it.production_count > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-1">
            <div className="text-xs font-semibold text-blue-700 mb-1">📊 로스율 자동 계산</div>
            {items.filter((it) => it.target_count > 0 && it.production_count > 0).map((it, i) => {
              const loss = (((it.target_count - it.production_count) / it.target_count) * 100).toFixed(1);
              return (
                <div key={i} className="flex justify-between text-xs text-blue-600">
                  <span>{it.product || `항목${i+1}`}</span>
                  <span className="font-semibold">로스율: {loss}%</span>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={handleSubmit} disabled={loading || !items.some((it) => it.product)}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "업무지시서 저장"}
        </button>
      </div>
    </div>
  );
}
