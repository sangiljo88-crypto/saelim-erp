"use client";

import { useState } from "react";
import { submitAuditChecklist } from "@/app/actions/submit";

const AUDIT_ITEMS = [
  // 원료 및 제품 관리
  { category: "원료·제품 관리", item: "냉장 보관 온도 0~5°C 유지 확인" },
  { category: "원료·제품 관리", item: "냉동 보관 온도 -18°C 이하 확인" },
  { category: "원료·제품 관리", item: "원료와 완제품 이격 보관 (15cm 이상)" },
  { category: "원료·제품 관리", item: "입고 원료 유통기한·규격 검수 완료" },
  { category: "원료·제품 관리", item: "부적합품 별도 구역 격리 보관" },
  { category: "원료·제품 관리", item: "해동육 일지 작성 완료" },
  { category: "원료·제품 관리", item: "선입선출(FIFO) 원칙 준수 확인" },
  // 시설·설비
  { category: "시설·설비", item: "작업장 바닥 청결 상태 양호" },
  { category: "시설·설비", item: "배수로 막힘 없이 정상 작동" },
  { category: "시설·설비", item: "냉장·냉동 설비 성애 제거 완료" },
  { category: "시설·설비", item: "손 세척 설비 (세제·온수) 정상 가동" },
  { category: "시설·설비", item: "폐기물 밀폐 용기 보관·처리 적합" },
  { category: "시설·설비", item: "방충·방서 설비 이상 없음 (포충등 등)" },
  { category: "시설·설비", item: "포장재 별도 보관 (청결한 장소)" },
  // 개인위생
  { category: "개인위생", item: "작업자 위생복·위생모 착용" },
  { category: "개인위생", item: "작업자 마스크 착용 (필요 구역)" },
  { category: "개인위생", item: "작업 전 손 세척 실시 여부 확인" },
  { category: "개인위생", item: "상처 부위 방수 밴드·장갑 착용" },
  { category: "개인위생", item: "개인 음식물·음료 반입 금지 준수" },
  // 문서·기록
  { category: "문서·기록", item: "HACCP 모니터링 기록지 최신화" },
  { category: "문서·기록", item: "CCP 한계기준 이탈 발생 시 조치 기록" },
  { category: "문서·기록", item: "위생 교육 이수 대장 비치 및 관리" },
  { category: "문서·기록", item: "온도 기록계 기록지 관리 적합" },
  // 작업 공정
  { category: "작업 공정", item: "교차오염 방지 (원료↔완제품 동선 분리)" },
  { category: "작업 공정", item: "작업 도구 용도별 색상 구분 준수" },
  { category: "작업 공정", item: "작업 종료 후 설비 세척·소독 실시" },
  { category: "작업 공정", item: "알레르기 유발물질 표시 관리 적합" },
];

type ItemResult = "적합" | "부적합" | "해당없음";

export default function AuditChecklistForm() {
  const today = new Date().toISOString().split("T")[0];
  const [checkDate, setCheckDate] = useState(today);
  const [auditType, setAuditType] = useState("HACCP 자체점검");
  const [results, setResults] = useState<Record<string, ItemResult>>(() =>
    Object.fromEntries(AUDIT_ITEMS.map((it) => [it.item, "적합"]))
  );
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [overallResult, setOverallResult] = useState("적합");
  const [nextAction, setNextAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const categories = [...new Set(AUDIT_ITEMS.map((it) => it.category))];
  const failCount = Object.values(results).filter((r) => r === "부적합").length;

  function setResult(item: string, result: ItemResult) {
    setResults((p) => ({ ...p, [item]: result }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const items = AUDIT_ITEMS.map((it) => ({
        category: it.category,
        item: it.item,
        result: results[it.item],
        notes: notesMap[it.item] ?? "",
      }));
      await submitAuditChecklist(checkDate, auditType, items, overallResult, nextAction);
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
      <div className="font-bold text-emerald-700">오딧 체크리스트 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">새 점검 시작</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-base">위생·HACCP 점검 체크리스트</div>
            <div className="text-xs text-blue-200 mt-0.5">정기 오딧 / 현장점검 대비 자체 점검</div>
          </div>
          {failCount > 0 && (
            <div className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              부적합 {failCount}건
            </div>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 헤더 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">점검 날짜</label>
            <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">점검 유형</label>
            <select value={auditType} onChange={(e) => setAuditType(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864] bg-white">
              <option>HACCP 자체점검</option>
              <option>정기 위생 점검</option>
              <option>현장 감사 대비 점검</option>
              <option>외부 기관 점검 전 점검</option>
            </select>
          </div>
        </div>

        {/* 카테고리별 체크리스트 */}
        {categories.map((cat) => (
          <div key={cat} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">{cat}</span>
              <span className="text-[10px] text-gray-400">
                {AUDIT_ITEMS.filter((it) => it.category === cat && results[it.item] === "부적합").length > 0
                  ? `⚠️ 부적합 ${AUDIT_ITEMS.filter((it) => it.category === cat && results[it.item] === "부적합").length}건`
                  : "✅ 이상 없음"
                }
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {AUDIT_ITEMS.filter((it) => it.category === cat).map((it) => (
                <div key={it.item} className={`px-4 py-3 ${results[it.item] === "부적합" ? "bg-red-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-700 flex-1 leading-relaxed pt-0.5">{it.item}</span>
                    <div className="flex gap-1 shrink-0">
                      {(["적합", "부적합", "해당없음"] as ItemResult[]).map((r) => (
                        <button key={r} type="button" onClick={() => setResult(it.item, r)}
                          className={`text-[10px] px-2 py-1 rounded-full border font-semibold transition-all cursor-pointer ${
                            results[it.item] === r
                              ? r === "적합" ? "bg-emerald-500 text-white border-emerald-500"
                                : r === "부적합" ? "bg-red-500 text-white border-red-500"
                                : "bg-gray-400 text-white border-gray-400"
                              : "bg-white text-gray-400 border-gray-300"
                          }`}>
                          {r === "적합" ? "✓" : r === "부적합" ? "✗" : "-"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {results[it.item] === "부적합" && (
                    <input type="text" placeholder="부적합 내용 및 조치계획..."
                      value={notesMap[it.item] ?? ""} onChange={(e) => setNotesMap((p) => ({ ...p, [it.item]: e.target.value }))}
                      className="mt-2 w-full border border-red-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-red-500 bg-white" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 종합 평가 */}
        <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-500">종합 평가</label>
          <div className="flex gap-3">
            {["적합", "조건부 적합", "부적합"].map((r) => (
              <button key={r} type="button" onClick={() => setOverallResult(r)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  overallResult === r
                    ? r === "적합" ? "bg-emerald-500 text-white border-emerald-500"
                      : r === "조건부 적합" ? "bg-amber-500 text-white border-amber-500"
                      : "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-500 border-gray-300"
                }`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">개선 조치 계획</label>
            <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={3}
              placeholder="부적합 항목에 대한 조치 일정 및 담당자..."
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864] resize-none" />
          </div>
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : `점검 결과 저장 (부적합 ${failCount}건)`}
        </button>
      </div>
    </div>
  );
}
