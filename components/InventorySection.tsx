"use client";

import { useState } from "react";

interface InventoryRow {
  id: string;
  inventory_date: string;
  location: string;
  product_name: string;
  unit: string;
  prev_stock: number;
  incoming_qty: number;
  outgoing_qty: number;
  recorded_by: string | null;
  notes: string | null;
}

const LOCATION_COLOR: Record<string, string> = {
  "2번냉동실":   "bg-blue-100 text-blue-700 border-blue-200",
  "3번냉동실":   "bg-indigo-100 text-indigo-700 border-indigo-200",
  "완제품냉동실": "bg-purple-100 text-purple-700 border-purple-200",
};

function getLocationColor(loc: string) {
  return LOCATION_COLOR[loc] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

function currentStock(row: InventoryRow) {
  return row.prev_stock + row.incoming_qty - row.outgoing_qty;
}

// 재고량 기준 경고 색상
function stockColor(qty: number) {
  if (qty <= 0)   return "text-red-600 font-bold";
  if (qty < 100)  return "text-amber-600 font-semibold";
  return "text-gray-800";
}

export default function InventorySection({ rows }: { rows: InventoryRow[] }) {
  const [selectedLocation, setSelectedLocation] = useState<string>("전체");

  const locations = ["전체", ...Array.from(new Set(rows.map((r) => r.location)))];

  const filtered = selectedLocation === "전체"
    ? rows
    : rows.filter((r) => r.location === selectedLocation);

  // 창고별 합산
  const byLocation = locations.slice(1).map((loc) => {
    const items = rows.filter((r) => r.location === loc);
    const total = items.reduce((s, r) => s + currentStock(r), 0);
    const lowCount = items.filter((r) => currentStock(r) < 100).length;
    return { loc, total, lowCount, count: items.length };
  });

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="text-3xl mb-2">📦</div>
        <p className="text-sm font-medium text-gray-600">재고 데이터가 없습니다</p>
        <p className="text-xs text-gray-400 mt-1">재고담당이 입력하거나 DB 마이그레이션을 먼저 실행해주세요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {/* 창고별 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {byLocation.map(({ loc, total, lowCount, count }) => (
          <button
            key={loc}
            onClick={() => setSelectedLocation(selectedLocation === loc ? "전체" : loc)}
            className={`text-left rounded-xl border px-4 py-3 transition-all cursor-pointer ${
              selectedLocation === loc
                ? "ring-2 ring-[#1F3864] " + getLocationColor(loc)
                : "bg-white border-gray-200 hover:border-[#1F3864]/40"
            }`}
          >
            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-1.5 border ${getLocationColor(loc)}`}>
              {loc}
            </div>
            <div className="text-xl font-bold text-gray-800">{total.toLocaleString()}<span className="text-xs font-normal text-gray-500 ml-1">kg</span></div>
            <div className="text-xs text-gray-400 mt-0.5">
              {count}개 품목
              {lowCount > 0 && <span className="ml-1.5 text-amber-600 font-semibold">⚠ 부족 {lowCount}종</span>}
            </div>
          </button>
        ))}
      </div>

      {/* 창고 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {locations.map((loc) => (
          <button
            key={loc}
            onClick={() => setSelectedLocation(loc)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              selectedLocation === loc
                ? "bg-[#1F3864] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
            }`}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* 품목별 재고 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">창고</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">품목</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">전일재고</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">입고</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">출고</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 bg-blue-50">현재고</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const curr = currentStock(row);
              return (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getLocationColor(row.location)}`}>
                      {row.location}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{row.prev_stock.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">+{row.incoming_qty.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-red-500">-{row.outgoing_qty.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right bg-blue-50 ${stockColor(curr)}`}>
                    {curr.toLocaleString()} <span className="text-xs text-gray-400">{row.unit}</span>
                    {curr < 100 && curr > 0 && <span className="ml-1 text-amber-500">⚠</span>}
                    {curr <= 0 && <span className="ml-1 text-red-500">❌</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={5} className="px-4 py-2.5 text-xs text-gray-400 font-medium">
                {selectedLocation === "전체" ? "전체 합계" : selectedLocation} 총 현재고
              </td>
              <td className="px-4 py-2.5 text-right bg-blue-100 text-blue-800 font-bold text-sm">
                {filtered.reduce((s, r) => s + currentStock(r), 0).toLocaleString()} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-right">
        기준일: {rows[0]?.inventory_date ?? "-"} · 재고담당 입력
      </p>
    </div>
  );
}
