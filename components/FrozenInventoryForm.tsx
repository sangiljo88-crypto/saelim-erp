"use client";

import { useState } from "react";
import { saveFrozenInventory } from "@/app/actions/submit";

// ── 창고별 품목 템플릿 (실제 엑셀 기준) ──────────────────────────────────────
type TplItem = { name: string; unit: string };

const RAW_SECTIONS: { section: string; items: TplItem[] }[] = [
  {
    section: "2번냉동실",
    items: [
      { name: "염통슬라이스1kg",        unit: "kg/box" },
      { name: "삶은염통1kg",             unit: "kg/box" },
      { name: "삶은염통150g",            unit: "kg/box" },
      { name: "삶은돼지머리(반통)",      unit: "kg/box" },
      { name: "삶은오소리1kg",           unit: "kg/box" },
      { name: "오소리슬라이스1kg",       unit: "kg/box" },
      { name: "삶은새끼보600g",          unit: "kg/box" },
      { name: "삶은간",                  unit: "kg/box" },
      { name: "삶은돼지허파",            unit: "kg/box" },
      { name: "삶은돈소창1kg",           unit: "kg/box" },
      { name: "대창슬라이스1kg",         unit: "kg/box" },
      { name: "생돈막창1kg",             unit: "kg/box" },
      { name: "전지슬라이스1kg*15",      unit: "kg/box" },
      { name: "돈두슬(삼공티피엘)2kg",   unit: "kg/box" },
      { name: "돈두슬1kg",              unit: "kg/box" },
    ],
  },
  {
    section: "3번냉동실",
    items: [
      { name: "롤삼겹(항정)14kg",        unit: "kg/box" },
      { name: "모듬내장2kg",             unit: "kg/box" },
      { name: "삶은돈소창(슬)1kg",       unit: "kg/box" },
      { name: "귀없는돈두슬라이스1kg",   unit: "kg/box" },
      { name: "소창슬라이스2kg",         unit: "kg/box" },
      { name: "삶은오소리감투1kg",       unit: "kg/box" },
      { name: "삶은모듬내장1kg",         unit: "kg/box" },
    ],
  },
  {
    section: "냉장실",
    items: [
      { name: "꼬들살(덜미)O",   unit: "kg/box" },
      { name: "꼬들살(덜미)X",   unit: "kg/box" },
      { name: "뽈살",            unit: "kg/box" },
      { name: "두항정살5kg",     unit: "kg/box" },
      { name: "관자살",          unit: "kg/box" },
      { name: "설하살",          unit: "kg/box" },
    ],
  },
  {
    section: "(1번)왼쪽컨테이너",
    items: [
      { name: "돈두육(앞판)20kg",        unit: "kg/box" },
      { name: "돈두육(앞판)10kg",        unit: "kg/box" },
      { name: "새끼보",                  unit: "kg/box" },
      { name: "손질돈귀10kg",            unit: "kg/box" },
      { name: "(목우촌)삶음돼지소장10kg", unit: "kg/box" },
      { name: "앞판",                    unit: "kg/box" },
      { name: "소창(슬)2kg",             unit: "kg/box" },
      { name: "돈등뼈10kg",              unit: "kg/box" },
    ],
  },
  {
    section: "(2번)오른쪽컨테이너",
    items: [
      { name: "수입뽈살27kg",            unit: "kg/box" },
      { name: "새끼보",                  unit: "kg/box" },
      { name: "삶은돼지막창(슬)5kg",     unit: "kg/box" },
      { name: "로스팅막창(슬)3kg",       unit: "kg/box" },
      { name: "롤삼겹(항정)14kg",        unit: "kg/box" },
      { name: "롤삼겹(항정)20kg",        unit: "kg/box" },
      { name: "롤삼겹(항정)자사",        unit: "kg/box" },
      { name: "(목우촌)삶음돼지소장10kg", unit: "kg/box" },
    ],
  },
  {
    section: "4번냉동고(가공)",
    items: [
      { name: "앞다리(전지)",      unit: "kg/box" },
      { name: "습식빵가루(2kg*5)", unit: "kg/box" },
      { name: "오소리슬라이스1kg", unit: "kg/box" },
      { name: "소창슬라이스2kg",   unit: "kg/box" },
      { name: "눈꽃두태",          unit: "kg/box" },
      { name: "사태(수입)",        unit: "kg/box" },
      { name: "소위(수입)",        unit: "kg/box" },
      { name: "양지(수입)",        unit: "kg/box" },
      { name: "갈비(수입)",        unit: "kg/box" },
      { name: "한우사골",          unit: "kg/box" },
      { name: "목전지(수입)",      unit: "kg/box" },
      { name: "한우잡뼈",          unit: "kg/box" },
      { name: "돈육뒷다리",        unit: "kg/box" },
      { name: "돈소창슬라이스5kg", unit: "kg/box" },
      { name: "돈두슬(인터넷)10kg", unit: "kg/box" },
      { name: "뽈살슬라이스",      unit: "kg/box" },
      { name: "귀슬라이스(2kg*8)", unit: "kg/box" },
    ],
  },
  {
    section: "5번냉동고(발골)",
    items: [
      { name: "돼지오소리10kg",          unit: "kg/box" },
      { name: "돼지막창10kg",            unit: "kg/box" },
      { name: "돼지염통10kg",            unit: "kg/box" },
      { name: "꽃살10kg",                unit: "kg/box" },
      { name: "목갈비10kg",              unit: "kg/box" },
      { name: "설하살10kg",              unit: "kg/box" },
      { name: "돈두설10kg",              unit: "kg/box" },
      { name: "앞판(귀x)",               unit: "kg/box" },
      { name: "앞판(귀o)",               unit: "kg/box" },
      { name: "돈피",                    unit: "kg/box" },
      { name: "관자살",                  unit: "kg/box" },
      { name: "목우촌대장10kg",          unit: "kg/box" },
      { name: "수입뽈살",                unit: "kg/box" },
      { name: "(목우촌)삶음돼지소장10kg", unit: "kg/box" },
      { name: "돈조각머리(ea)",          unit: "kg/box" },
      { name: "눈밑살",                  unit: "kg/box" },
      { name: "꽃살",                    unit: "kg/box" },
      { name: "혀",                      unit: "kg/box" },
      { name: "귀",                      unit: "kg/box" },
      { name: "뽈살",                    unit: "kg/box" },
      { name: "롤삼겹(항정)자사",        unit: "kg/box" },
    ],
  },
];

const PRODUCT_SECTIONS: { section: string; items: TplItem[] }[] = [
  {
    section: "1번냉동실(제품)",
    items: [
      { name: "설하살300g",    unit: "ea" },
      { name: "꼬들살300g",    unit: "ea" },
      { name: "뽈살300g",      unit: "ea" },
      { name: "꽃살300g",      unit: "ea" },
      { name: "꼬들목살300g",  unit: "ea" },
      { name: "관자살300g",    unit: "ea" },
      { name: "별난모듬300g",  unit: "ea" },
      { name: "두항정살300g",  unit: "ea" },
      { name: "뒷고기모듬500g", unit: "ea" },
      { name: "뽈항정500g",    unit: "ea" },
      { name: "차돌대패(바로구이)", unit: "ea" },
    ],
  },
  {
    section: "2번냉동실(제품)",
    items: [
      { name: "돈가스1.3kg(계란o)", unit: "ea" },
      { name: "돈가스1.3kg(계란x)", unit: "ea" },
      { name: "돈가스1kg",          unit: "ea" },
      { name: "스토어다대기",       unit: "ea" },
      { name: "등심(box)",          unit: "box" },
    ],
  },
  {
    section: "3번냉동실(제품)",
    items: [
      { name: "옥고진액육수(500g*16)", unit: "ea" },
    ],
  },
  {
    section: "냉장실(제품)",
    items: [
      { name: "꼬들살300g",          unit: "ea" },
      { name: "뽈살300g",            unit: "ea" },
      { name: "두항정살300g",        unit: "ea" },
      { name: "나주곰탕농축소스(5k*2)", unit: "ea" },
      { name: "통머리",              unit: "ea" },
      { name: "양념곱창200g",        unit: "ea" },
      { name: "양념막창200g",        unit: "ea" },
      { name: "편육(청담동순도리)",   unit: "ea" },
      { name: "돈두슬라이스2kg(냉장)", unit: "ea" },
      { name: "편육300g",            unit: "ea" },
      { name: "황제살",              unit: "ea" },
    ],
  },
  {
    section: "가공냉동실(제품)",
    items: [
      { name: "할매머릿고기(혼합)", unit: "ea" },
      { name: "해장국",             unit: "ea" },
    ],
  },
];

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface InventoryRow {
  section: string;
  side: "raw" | "product";
  product_name: string;
  unit: string;
  prev_stock: number;
  usage_qty: number;
  incoming_qty: number;
  outgoing_qty: number;
  current_stock: number;
}

function makeRows(
  sections: { section: string; items: TplItem[] }[],
  side: "raw" | "product",
  prevMap: Map<string, number>
): InventoryRow[] {
  return sections.flatMap(({ section, items }) =>
    items.map(({ name, unit }) => {
      const key = `${section}||${name}`;
      const prev = prevMap.get(key) ?? 0;
      return {
        section, side,
        product_name: name,
        unit,
        prev_stock:    prev,
        usage_qty:     0,
        incoming_qty:  0,
        outgoing_qty:  0,
        current_stock: prev,
      };
    })
  );
}

// ── 숫자 입력 셀 ──────────────────────────────────────────────────────────────
function N({ value, onChange, color }: {
  value: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={`w-full border rounded px-1 py-1.5 text-xs text-right outline-none focus:border-[#1F3864] ${color ?? "border-gray-200"}`}
    />
  );
}

// ── 섹션 테이블 ───────────────────────────────────────────────────────────────
function SectionTable({
  section, rows, allRows, setRows, isProduct,
}: {
  section: string;
  rows: InventoryRow[];
  allRows: InventoryRow[];
  setRows: (v: InventoryRow[]) => void;
  isProduct: boolean;
}) {
  const [open, setOpen] = useState(true);

  function update(i: number, field: keyof InventoryRow, val: number) {
    const globalIdx = allRows.indexOf(rows[i]);
    const next = [...allRows];
    const row = { ...next[globalIdx], [field]: val };
    row.current_stock = row.prev_stock + row.incoming_qty - row.usage_qty - row.outgoing_qty;
    next[globalIdx] = row;
    setRows(next);
  }

  // 변경된 행만 강조
  const hasChange = rows.some((r) => r.usage_qty > 0 || r.incoming_qty > 0 || r.outgoing_qty > 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${
          isProduct ? "bg-emerald-50" : "bg-blue-50"
        }`}
      >
        <span className="text-xs font-bold text-gray-700">{section}</span>
        <div className="flex items-center gap-2">
          {hasChange && <span className="text-[10px] bg-amber-400 text-white px-2 py-0.5 rounded-full font-bold">변경</span>}
          <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-500 min-w-[140px]">품명</th>
                <th className="text-center px-1 py-2 font-semibold text-gray-400 w-12">단위</th>
                <th className="text-center px-1 py-2 font-semibold text-gray-500 w-16">전일재고</th>
                <th className="text-center px-1 py-2 font-semibold text-blue-500 w-16">사용량</th>
                <th className="text-center px-1 py-2 font-semibold text-emerald-600 w-16">입고량</th>
                <th className="text-center px-1 py-2 font-semibold text-red-400 w-16">출고량</th>
                <th className="text-center px-1 py-2 font-semibold text-amber-600 w-16">현재고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const changed = row.usage_qty > 0 || row.incoming_qty > 0 || row.outgoing_qty > 0;
                return (
                  <tr key={i} className={`border-b border-gray-100 ${changed ? "bg-amber-50/40" : "hover:bg-gray-50"}`}>
                    <td className="px-3 py-1 font-medium text-gray-700">{row.product_name}</td>
                    <td className="px-1 py-1 text-center text-gray-400">{row.unit}</td>
                    <td className="px-1 py-1 text-right text-gray-500 font-mono text-xs">
                      {row.prev_stock ? row.prev_stock.toLocaleString() : "-"}
                    </td>
                    <td className="px-1 py-1">
                      <N value={row.usage_qty}    onChange={(v) => update(i, "usage_qty",    v)} color="border-blue-200" />
                    </td>
                    <td className="px-1 py-1">
                      <N value={row.incoming_qty} onChange={(v) => update(i, "incoming_qty", v)} color="border-emerald-200" />
                    </td>
                    <td className="px-1 py-1">
                      <N value={row.outgoing_qty} onChange={(v) => update(i, "outgoing_qty", v)} color="border-red-200" />
                    </td>
                    <td className={`px-2 py-1 text-right font-bold font-mono ${
                      row.current_stock <= 0 ? "text-red-500" : "text-[#1F3864]"
                    }`}>
                      {row.current_stock.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
interface Props {
  prevData?: { section: string; product_name: string; current_stock: number }[];
}

export default function FrozenInventoryForm({ prevData = [] }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // 전일 재고 맵
  const prevMap = new Map(prevData.map((d) => [`${d.section}||${d.product_name}`, d.current_stock]));

  const [rows, setRows] = useState<InventoryRow[]>([
    ...makeRows(RAW_SECTIONS,     "raw",     prevMap),
    ...makeRows(PRODUCT_SECTIONS, "product", prevMap),
  ]);

  async function handleSubmit() {
    const changed = rows.filter((r) => r.usage_qty > 0 || r.incoming_qty > 0 || r.outgoing_qty > 0 || r.prev_stock > 0);
    if (changed.length === 0) { alert("변경된 항목이 없습니다."); return; }
    setLoading(true);
    try {
      await saveFrozenInventory(date, changed);
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

  const rawRows     = rows.filter((r) => r.side === "raw");
  const productRows = rows.filter((r) => r.side === "product");

  const changedCount = rows.filter((r) => r.usage_qty > 0 || r.incoming_qty > 0 || r.outgoing_qty > 0).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">냉동·냉장·컨테이너 재고 현황</div>
        <div className="text-xs text-blue-200 mt-0.5">창고 담당자 입력 · 사용량·입고량·출고량만 입력하면 현재고 자동 계산</div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* 날짜 + 요약 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">작업일</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          {changedCount > 0 && (
            <div className="mt-4 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 font-semibold">
              {changedCount}개 항목 변경됨
            </div>
          )}
        </div>

        {/* 색상 범례 */}
        <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-blue-200 bg-blue-50 inline-block" />사용량</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-emerald-200 bg-emerald-50 inline-block" />입고량</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-red-200 bg-red-50 inline-block" />출고량</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />현재고 자동계산</span>
        </div>

        {/* 원재료 섹션 */}
        <div className="text-xs font-bold text-blue-700 px-1">📦 원재료</div>
        {RAW_SECTIONS.map(({ section }) => (
          <SectionTable
            key={section}
            section={section}
            rows={rawRows.filter((r) => r.section === section)}
            allRows={rows}
            setRows={setRows}
            isProduct={false}
          />
        ))}

        {/* 제품 섹션 */}
        <div className="text-xs font-bold text-emerald-700 px-1 mt-2">🏷️ 제품</div>
        {PRODUCT_SECTIONS.map(({ section }) => (
          <SectionTable
            key={section}
            section={section}
            rows={productRows.filter((r) => r.section === section)}
            allRows={rows}
            setRows={setRows}
            isProduct={true}
          />
        ))}

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer mt-2">
          {loading ? "저장 중..." : `재고 현황 저장 (${changedCount > 0 ? changedCount + "개 항목" : "변경 없음"})`}
        </button>
      </div>
    </div>
  );
}
