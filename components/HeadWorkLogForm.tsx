"use client";

import { useState } from "react";
import { submitHeadWorkLog } from "@/app/actions/submit";

interface PartItem {
  name: string;
  unit: string;
  total: number;
  gyusan: number;
  road: number;
  delivery: number;
  jasuk: number;
  skin: number;
  frozen: number;
}

const HEAD_PARTS: { name: string; unit: string }[] = [
  { name: "귀",     unit: "kg" },
  { name: "뒷판",   unit: "kg" },
  { name: "혀",     unit: "kg" },
  { name: "덜미(O)", unit: "kg" },
  { name: "덜미(X)", unit: "kg" },
  { name: "관자",   unit: "kg" },
  { name: "꽃살",   unit: "kg" },
  { name: "뼛살",   unit: "kg" },
  { name: "설하",   unit: "kg" },
  { name: "두항정", unit: "kg" },
  { name: "통머리", unit: "두" },
  { name: "조각머리", unit: "두" },
  { name: "릎",     unit: "kg" },
];

const INNARD_PARTS: { name: string; unit: string }[] = [
  { name: "앞판(면도귀O)", unit: "kg" },
  { name: "앞판(면도귀X)", unit: "kg" },
  { name: "막창",   unit: "kg" },
  { name: "허파",   unit: "kg" },
  { name: "염통",   unit: "kg" },
  { name: "오소리", unit: "kg" },
  { name: "줄기염통", unit: "kg" },
];

function makeItems(parts: { name: string; unit: string }[]): PartItem[] {
  return parts.map((p) => ({ name: p.name, unit: p.unit, total: 0, gyusan: 0, road: 0, delivery: 0, jasuk: 0, skin: 0, frozen: 0 }));
}

function NumCell({ value, onChange, yellow }: { value: number; onChange: (v: number) => void; yellow?: boolean }) {
  return (
    <input type="number" value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full border rounded px-1 py-1.5 text-xs text-center outline-none focus:border-[#1F3864] ${
        yellow ? "bg-yellow-50 border-yellow-300 font-semibold" : "border-gray-200"
      }`} />
  );
}

export default function HeadWorkLogForm() {
  const today = new Date().toISOString().split("T")[0];
  const [workDate, setWorkDate] = useState(today);
  const [headReceived, setHeadReceived] = useState(0);
  const [headItems, setHeadItems] = useState<PartItem[]>(makeItems(HEAD_PARTS));
  const [innardItems, setInnardItems] = useState<PartItem[]>(makeItems(INNARD_PARTS));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function updateHead(i: number, field: keyof PartItem, val: number) {
    setHeadItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }
  function updateInnard(i: number, field: keyof PartItem, val: number) {
    setInnardItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitHeadWorkLog(workDate, headReceived, headItems, innardItems, notes);
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
      <div className="font-bold text-emerald-700">두/내장 작업일지 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">다시 입력</button>
    </div>
  );

  const DIST_COLS = [
    { key: "total",    label: "총생산량", yellow: true },
    { key: "gyusan",   label: "군산식당" },
    { key: "road",     label: "로드업체" },
    { key: "delivery", label: "택배" },
    { key: "jasuk",    label: "자숙" },
    { key: "skin",     label: "스킨작업" },
    { key: "frozen",   label: "냉동입고" },
  ] as const;

  function renderTable(items: PartItem[], update: (i: number, f: keyof PartItem, v: number) => void, title: string) {
    return (
      <div>
        <div className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 border-b border-gray-200">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-500 w-24">작업내용</th>
                <th className="text-center px-1 py-2 font-semibold text-gray-500 w-10">단위</th>
                {DIST_COLS.map((c) => (
                  <th key={c.key} className={`text-center px-1 py-2 font-semibold w-16 ${c.yellow ? "text-amber-600" : "text-gray-500"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium text-gray-700 text-xs">{item.name}</td>
                  <td className="px-1 py-1.5 text-center text-gray-400 text-xs">{item.unit}</td>
                  {DIST_COLS.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <NumCell value={item[c.key] as number} onChange={(v) => update(i, c.key, v)} yellow={c.yellow} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">두 / 내장 작업일지</div>
        <div className="text-xs text-blue-200 mt-0.5">공장장 입력 · 부위별 생산/출고 현황</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">작업일</label>
            <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">머리 입고 두수</label>
            <div className="flex items-center gap-2">
              <input type="number" value={headReceived || ""} onChange={(e) => setHeadReceived(Number(e.target.value))}
                placeholder="예: 379"
                className="flex-1 border border-yellow-300 bg-yellow-50 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-[#1F3864]" />
              <span className="text-xs text-gray-400 shrink-0">두</span>
            </div>
          </div>
        </div>

        {/* 두 테이블 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {renderTable(headItems, updateHead, "▶ 두 (머리 부위)")}
        </div>

        {/* 내장 테이블 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {renderTable(innardItems, updateInnard, "▶ 내장")}
        </div>

        {/* 특이사항 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500">특이사항</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="예: 머리 (조나,수닐,바하두루,마임) 로한발골지원 (폐수연장) -18:30 종료..."
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864] resize-none" />
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "작업일지 저장"}
        </button>
      </div>
    </div>
  );
}
