"use client";

import { useState } from "react";
import { submitContainerInventory } from "@/app/actions/inventory";

const LOCATIONS = ["2번냉동실", "3번냉동실", "냉장실", "원료냉동실", "완제품냉동실"];

const PRESET_PRODUCTS = [
  { name: "귀(냉동)", unit: "kg", location: "2번냉동실" },
  { name: "덜미(냉동)", unit: "kg", location: "2번냉동실" },
  { name: "관자(냉동)", unit: "kg", location: "2번냉동실" },
  { name: "꽃살(냉동)", unit: "kg", location: "2번냉동실" },
  { name: "릎(냉동)", unit: "kg", location: "3번냉동실" },
  { name: "앞판(냉동)", unit: "kg", location: "3번냉동실" },
  { name: "막창(냉동)", unit: "kg", location: "3번냉동실" },
  { name: "염통(냉동)", unit: "kg", location: "3번냉동실" },
  { name: "오소리(냉동)", unit: "kg", location: "3번냉동실" },
  { name: "소선지", unit: "kg", location: "완제품냉동실" },
  { name: "편육", unit: "kg", location: "완제품냉동실" },
  { name: "모듬내장", unit: "kg", location: "완제품냉동실" },
];

interface InvRow {
  location: string;
  product_name: string;
  unit: string;
  prev_stock: number;
  incoming_qty: number;
  outgoing_qty: number;
  notes: string;
}

export default function ContainerInventoryForm() {
  const today = new Date().toISOString().split("T")[0];
  const [invDate, setInvDate] = useState(today);
  const [rows, setRows] = useState<InvRow[]>(
    PRESET_PRODUCTS.map((p) => ({ location: p.location, product_name: p.name, unit: p.unit, prev_stock: 0, incoming_qty: 0, outgoing_qty: 0, notes: "" }))
  );
  const [newLoc, setNewLoc] = useState(LOCATIONS[0]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function updateRow(i: number, field: keyof InvRow, val: string | number) {
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }
  function addRow() {
    setRows((p) => [...p, { location: newLoc, product_name: "", unit: "kg", prev_stock: 0, incoming_qty: 0, outgoing_qty: 0, notes: "" }]);
  }

  async function handleSubmit() {
    const validRows = rows.filter((r) => r.product_name.trim());
    if (!validRows.length) return;
    setLoading(true);
    try {
      await submitContainerInventory(invDate, validRows);
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
      <div className="font-bold text-emerald-700">재고 현황 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">다시 입력</button>
    </div>
  );

  const grouped = LOCATIONS.reduce<Record<string, InvRow[]>>((acc, loc) => {
    acc[loc] = rows.filter((r) => r.location === loc);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">냉동·냉장 컨테이너 재고</div>
        <div className="text-xs text-blue-200 mt-0.5">재고담당 · 일일 현재고 관리</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">기준 날짜</label>
            <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <select value={newLoc} onChange={(e) => setNewLoc(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#1F3864] bg-white">
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button type="button" onClick={addRow}
              className="text-xs bg-[#1F3864] text-white px-3 py-2 rounded-lg font-semibold cursor-pointer hover:bg-[#162c52] whitespace-nowrap">
              + 품목 추가
            </button>
          </div>
        </div>

        {/* 위치별 테이블 */}
        {LOCATIONS.map((loc) => {
          const locRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.location === loc);
          if (locRows.length === 0) return null;
          return (
            <div key={loc} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700">📦 {loc}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold w-28">품명</th>
                      <th className="text-center px-2 py-2 text-gray-400 font-semibold w-12">단위</th>
                      <th className="text-center px-2 py-2 text-gray-400 font-semibold">전일재고</th>
                      <th className="text-center px-2 py-2 text-amber-500 font-semibold">입고량</th>
                      <th className="text-center px-2 py-2 text-red-400 font-semibold">출고량</th>
                      <th className="text-center px-2 py-2 text-emerald-600 font-semibold">현재고</th>
                      <th className="text-left px-2 py-2 text-gray-400 font-semibold">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locRows.map(({ idx }) => {
                      const r = rows[idx];
                      const current = r.prev_stock + r.incoming_qty - r.outgoing_qty;
                      return (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            <input type="text" value={r.product_name} onChange={(e) => updateRow(idx, "product_name", e.target.value)}
                              className="w-full border-0 outline-none text-xs font-medium text-gray-700 bg-transparent" />
                          </td>
                          <td className="px-2 py-1 text-center text-gray-400">{r.unit}</td>
                          {(["prev_stock", "incoming_qty", "outgoing_qty"] as const).map((f) => (
                            <td key={f} className="px-1 py-1">
                              <input type="number" value={r[f] || ""}
                                onChange={(e) => updateRow(idx, f, Number(e.target.value))}
                                className={`w-full border rounded px-1 py-1.5 text-xs text-center outline-none focus:border-[#1F3864] ${
                                  f === "incoming_qty" ? "border-amber-200 bg-amber-50"
                                  : f === "outgoing_qty" ? "border-red-200 bg-red-50"
                                  : "border-gray-200"
                                }`} />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-center">
                            <span className={`font-bold text-xs ${current < 0 ? "text-red-600" : current < 50 ? "text-amber-600" : "text-emerald-600"}`}>
                              {current.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-1 py-1">
                            <input type="text" value={r.notes} onChange={(e) => updateRow(idx, "notes", e.target.value)}
                              className="w-full border-0 outline-none text-xs text-gray-400 bg-transparent" placeholder="-" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "재고 현황 저장"}
        </button>
      </div>
    </div>
  );
}
