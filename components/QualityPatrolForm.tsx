"use client";

import { useState } from "react";
import { submitQualityPatrol } from "@/app/actions/submit";

const PATROL_AREAS = ["생산라인 A", "생산라인 B", "냉장·냉동창고", "가공팀 작업장", "스킨팀 작업장", "포장실", "원료보관소", "폐기물보관소", "탈의실·화장실", "차량·외부"];

const SEVERITY_OPTIONS = [
  { value: "low",    label: "⚠️ 경미",   color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "medium", label: "🟠 보통",   color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "high",   label: "🔴 심각",   color: "bg-red-100 text-red-700 border-red-300" },
];

interface Issue {
  area: string;
  description: string;
  severity: string;
  action: string;
}

export default function QualityPatrolForm() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toTimeString().slice(0, 5);
  const [patrolDate, setPatrolDate] = useState(today);
  const [patrolTime, setPatrolTime] = useState(now);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [overallStatus, setOverallStatus] = useState("정상");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function toggleArea(area: string) {
    setSelectedAreas((p) => p.includes(area) ? p.filter((a) => a !== area) : [...p, area]);
  }

  function addIssue() {
    setIssues((p) => [...p, { area: selectedAreas[0] ?? "", description: "", severity: "low", action: "" }]);
  }

  function updateIssue(i: number, field: keyof Issue, val: string) {
    setIssues((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  function removeIssue(i: number) {
    setIssues((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitQualityPatrol(patrolDate, patrolTime, selectedAreas, issues, overallStatus);
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
      <div className="font-bold text-emerald-700">순찰일지 저장 완료</div>
      <button onClick={() => setDone(false)} className="mt-3 text-sm text-emerald-700 underline cursor-pointer">추가 입력</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-[#1F3864] text-white px-5 py-4">
        <div className="font-bold text-base">품질 순찰일지</div>
        <div className="text-xs text-blue-200 mt-0.5">일일 현장 순찰 · 이슈 즉시 기록</div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 날짜/시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">순찰 날짜</label>
            <input type="date" value={patrolDate} onChange={(e) => setPatrolDate(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">순찰 시간</label>
            <input type="time" value={patrolTime} onChange={(e) => setPatrolTime(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3864]" />
          </div>
        </div>

        {/* 순찰 구역 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500">순찰 구역 (복수 선택)</label>
          <div className="flex flex-wrap gap-2">
            {PATROL_AREAS.map((area) => (
              <button key={area} type="button" onClick={() => toggleArea(area)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                  selectedAreas.includes(area)
                    ? "bg-[#1F3864] text-white border-[#1F3864]"
                    : "bg-white text-gray-600 border-gray-300 hover:border-[#1F3864]"
                }`}>
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* 종합 상태 */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500">종합 상태</label>
          <div className="flex gap-2">
            {["정상", "주의", "긴급"].map((s) => (
              <button key={s} type="button" onClick={() => setOverallStatus(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  overallStatus === s
                    ? s === "정상" ? "bg-emerald-500 text-white border-emerald-500"
                      : s === "주의" ? "bg-amber-500 text-white border-amber-500"
                      : "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-500 border-gray-300"
                }`}>
                {s === "정상" ? "✅ 정상" : s === "주의" ? "⚠️ 주의" : "🔴 긴급"}
              </button>
            ))}
          </div>
        </div>

        {/* 발견 이슈 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500">발견 이슈 ({issues.length}건)</label>
            <button type="button" onClick={addIssue}
              className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer hover:bg-amber-600">
              + 이슈 추가
            </button>
          </div>

          {issues.map((issue, i) => (
            <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">이슈 #{i + 1}</span>
                <button type="button" onClick={() => removeIssue(i)}
                  className="text-gray-300 hover:text-red-400 text-lg cursor-pointer">×</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-500">발견 구역</label>
                  <select value={issue.area} onChange={(e) => updateIssue(i, "area", e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-xs outline-none bg-white focus:border-[#1F3864]">
                    <option value="">선택</option>
                    {PATROL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-500">위험도</label>
                  <select value={issue.severity} onChange={(e) => updateIssue(i, "severity", e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-xs outline-none bg-white focus:border-[#1F3864]">
                    {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500">이슈 내용</label>
                <textarea value={issue.description} onChange={(e) => updateIssue(i, "description", e.target.value)}
                  rows={2} placeholder="발견된 문제를 구체적으로 기술..."
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#1F3864] resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-500">조치사항</label>
                <input type="text" value={issue.action} onChange={(e) => updateIssue(i, "action", e.target.value)}
                  placeholder="즉시 조치 내용 또는 담당자 지정..."
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#1F3864]" />
              </div>
            </div>
          ))}

          {issues.length === 0 && (
            <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center text-xs text-gray-400">
              이슈 없음 (정상 순찰)
            </div>
          )}
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading || selectedAreas.length === 0}
          className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 transition-all cursor-pointer">
          {loading ? "저장 중..." : "순찰일지 저장"}
        </button>
      </div>
    </div>
  );
}
