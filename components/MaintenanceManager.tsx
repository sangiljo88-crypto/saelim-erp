"use client";

import { useState } from "react";
import { submitMaintenanceLog } from "@/app/actions/submit";

export interface MaintenanceLog {
  id: string;
  equipment_name: string;
  dept: string | null;
  log_date: string;
  log_type: string;
  description: string;
  parts_used: string | null;
  cost: number;
  technician: string | null;
  result: string;
  next_check_date: string | null;
  recorded_by: string | null;
  created_at: string;
}

const LOG_TYPES = ["정기점검", "고장수리", "예방정비", "부품교체", "외부AS"];
const RESULT_META = {
  완료:   { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  진행중: { color: "bg-amber-100 text-amber-700",    dot: "bg-amber-500" },
  보류:   { color: "bg-gray-100 text-gray-600",      dot: "bg-gray-400" },
};
const LOG_TYPE_COLOR: Record<string, string> = {
  정기점검: "bg-blue-100 text-blue-700",
  고장수리: "bg-red-100 text-red-700",
  예방정비: "bg-purple-100 text-purple-700",
  부품교체: "bg-orange-100 text-orange-700",
  외부AS:   "bg-gray-100 text-gray-700",
};

const COMMON_EQUIPMENT = [
  "진공포장기 1호", "진공포장기 2호", "냉동컴프레서", "절단기",
  "세척기", "냉장고", "냉동고", "보일러", "지게차", "컨베이어",
];

const DEPTS = ["생산팀", "가공팀", "스킨팀", "품질팀", "배송팀", "공통"];

const EMPTY_FORM = {
  equipment_name: "", dept: "", log_date: "", log_type: "고장수리",
  description: "", parts_used: "", cost: 0, technician: "", result: "완료",
  next_check_date: "",
};

export default function MaintenanceManager({ initialLogs }: { initialLogs: MaintenanceLog[] }) {
  const [logs, setLogs]           = useState<MaintenanceLog[]>(initialLogs);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");
  const [filterEquip, setFilterEquip] = useState("전체");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // 설비별 그룹화
  const equipmentSet = ["전체", ...Array.from(new Set(logs.map((l) => l.equipment_name))).sort()];

  const filtered = filterEquip === "전체"
    ? logs
    : logs.filter((l) => l.equipment_name === filterEquip);

  // 설비별 마지막 이력 요약
  const equipSummary = Array.from(
    logs.reduce((map, l) => {
      const prev = map.get(l.equipment_name);
      if (!prev || l.log_date > prev.log_date) map.set(l.equipment_name, l);
      return map;
    }, new Map<string, MaintenanceLog>())
  ).sort((a, b) => b[1].log_date.localeCompare(a[1].log_date));

  // 7일내 점검 예정
  const upcoming = logs.filter((l) => {
    if (!l.next_check_date) return false;
    const diff = Math.ceil((new Date(l.next_check_date).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  // 이번달 비용 합계
  const thisMonth = today.slice(0, 7);
  const monthCost = logs
    .filter((l) => l.log_date.startsWith(thisMonth))
    .reduce((s, l) => s + (l.cost ?? 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipment_name || !form.log_date || !form.description) {
      setSaveErr("설비명, 날짜, 작업내용은 필수입니다");
      return;
    }
    setSaving(true);
    setSaveErr("");
    try {
      await submitMaintenanceLog({ ...form });
      // 로컬 state 업데이트 (임시 id)
      setLogs((prev) => [{
        id: crypto.randomUUID(),
        ...form,
        cost: form.cost || 0,
        parts_used: form.parts_used || null,
        technician: form.technician || null,
        next_check_date: form.next_check_date || null,
        dept: form.dept || null,
        recorded_by: "방금 저장됨",
        created_at: new Date().toISOString(),
      }, ...prev]);
      setForm({ ...EMPTY_FORM, log_date: today });
      setShowForm(false);
    } catch (err) {
      setSaveErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-[#1F3864]">{logs.length}</div>
          <div className="text-xs text-gray-500 mt-1">전체 수리 이력</div>
        </div>
        <div className={`bg-white rounded-xl border p-4 text-center ${upcoming.length > 0 ? "border-amber-300" : "border-gray-200"}`}>
          <div className={`text-2xl font-bold ${upcoming.length > 0 ? "text-amber-600" : "text-gray-400"}`}>
            {upcoming.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">7일내 점검 예정</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">
            {monthCost > 0 ? `${(monthCost / 10000).toFixed(0)}만원` : "0원"}
          </div>
          <div className="text-xs text-gray-500 mt-1">이번달 수리비용</div>
        </div>
      </div>

      {/* 7일내 점검 예정 알림 */}
      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1">
          <div className="text-xs font-bold text-amber-700 mb-1">⏰ 점검 예정 알림</div>
          {upcoming.map((l) => {
            const diff = Math.ceil((new Date(l.next_check_date!).getTime() - Date.now()) / 86400000);
            return (
              <div key={l.id} className="text-xs text-amber-800 flex items-center gap-2">
                <span className="font-semibold">{l.equipment_name}</span>
                <span className="text-amber-600">→ {l.next_check_date}</span>
                <span className={`px-1.5 py-0.5 rounded-full font-bold ${diff === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {diff === 0 ? "오늘!" : `D-${diff}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 설비 현황 카드 그리드 */}
      <div>
        <div className="text-xs font-bold text-gray-600 mb-2">🔧 설비별 최근 이력</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {equipSummary.map(([name, last]) => {
            const result = last.result as keyof typeof RESULT_META;
            const meta = RESULT_META[result] ?? RESULT_META["완료"];
            const daysSince = Math.floor((Date.now() - new Date(last.log_date).getTime()) / 86400000);
            return (
              <button
                key={name}
                onClick={() => setFilterEquip(filterEquip === name ? "전체" : name)}
                className={`text-left bg-white rounded-xl border px-3 py-3 transition-all cursor-pointer ${
                  filterEquip === name ? "border-[#1F3864] ring-2 ring-[#1F3864]/20" : "border-gray-200 hover:border-[#1F3864]/40"
                }`}
              >
                <div className="text-xs font-bold text-gray-800 truncate">{name}</div>
                <div className={`text-xs font-semibold mt-1 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${meta.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {last.result}
                </div>
                <div className="text-xs text-gray-400 mt-1">{last.log_type} · {daysSince === 0 ? "오늘" : `${daysSince}일 전`}</div>
              </button>
            );
          })}
          {equipSummary.length === 0 && (
            <div className="col-span-3 text-xs text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">
              아직 등록된 설비 이력이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 이력 목록 헤더 + 필터 + 등록 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-600">수리 이력</span>
          {equipmentSet.map((eq) => (
            <button
              key={eq}
              onClick={() => setFilterEquip(eq)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-all ${
                filterEquip === eq
                  ? "bg-[#1F3864] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#1F3864]"
              }`}
            >
              {eq} {eq !== "전체" && <span className="opacity-60">({logs.filter((l) => l.equipment_name === eq).length})</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setForm({ ...EMPTY_FORM, log_date: today }); }}
          className="flex items-center gap-1 text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f] cursor-pointer"
        >
          {showForm ? "✕ 취소" : "+ 수리 이력 등록"}
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#1F3864]/20 rounded-xl px-5 py-4 flex flex-col gap-4">
          <div className="text-sm font-bold text-[#1F3864]">📝 수리 이력 등록</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 설비명 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">설비명 *</label>
              <input
                list="equipment-list"
                value={form.equipment_name}
                onChange={(e) => setForm((p) => ({ ...p, equipment_name: e.target.value }))}
                placeholder="ex) 진공포장기 1호"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                required
              />
              <datalist id="equipment-list">
                {COMMON_EQUIPMENT.map((eq) => <option key={eq} value={eq} />)}
                {logs.map((l) => <option key={l.id} value={l.equipment_name} />)}
              </datalist>
            </div>
            {/* 담당 부서 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">담당 부서</label>
              <select
                value={form.dept}
                onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              >
                <option value="">선택</option>
                {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {/* 날짜 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">수리 날짜 *</label>
              <input
                type="date"
                value={form.log_date}
                onChange={(e) => setForm((p) => ({ ...p, log_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                required
              />
            </div>
            {/* 유형 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">작업 유형 *</label>
              <select
                value={form.log_type}
                onChange={(e) => setForm((p) => ({ ...p, log_type: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              >
                {LOG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 작업 내용 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">작업 내용 *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="ex) 진공펌프 오일 교체, 씰링부 고무패킹 마모로 교체"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 교체 부품 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">교체 부품</label>
              <input
                value={form.parts_used}
                onChange={(e) => setForm((p) => ({ ...p, parts_used: e.target.value }))}
                placeholder="ex) 고무패킹, 오일 2L"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              />
            </div>
            {/* 비용 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">수리 비용 (원)</label>
              <input
                type="number"
                value={form.cost || ""}
                onChange={(e) => setForm((p) => ({ ...p, cost: Number(e.target.value) || 0 }))}
                placeholder="0"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              />
            </div>
            {/* 담당자 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">수리 담당자</label>
              <input
                value={form.technician}
                onChange={(e) => setForm((p) => ({ ...p, technician: e.target.value }))}
                placeholder="ex) 홍길동 기사, 삼성서비스"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 처리 결과 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">처리 결과</label>
              <select
                value={form.result}
                onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              >
                <option value="완료">완료</option>
                <option value="진행중">진행중</option>
                <option value="보류">보류</option>
              </select>
            </div>
            {/* 다음 점검 예정일 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">다음 점검 예정일</label>
              <input
                type="date"
                value={form.next_check_date}
                onChange={(e) => setForm((p) => ({ ...p, next_check_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
              />
            </div>
          </div>

          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}

          <button
            type="submit"
            disabled={saving}
            className="self-start bg-[#1F3864] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer"
          >
            {saving ? "저장중…" : "💾 저장"}
          </button>
        </form>
      )}

      {/* 이력 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          {filterEquip === "전체" ? "등록된 수리 이력이 없습니다" : `${filterEquip} 이력이 없습니다`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((log) => {
            const result = log.result as keyof typeof RESULT_META;
            const resMeta = RESULT_META[result] ?? RESULT_META["완료"];
            const isOpen = expanded === log.id;
            return (
              <div
                key={log.id}
                className="bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-[#1F3864]/30 transition-all"
                onClick={() => setExpanded(isOpen ? null : log.id)}
              >
                {/* 행 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{log.equipment_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LOG_TYPE_COLOR[log.log_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.log_type}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${resMeta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${resMeta.dot}`} />
                        {log.result}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {log.log_date} · {log.dept ?? "-"} · {log.recorded_by ?? "-"}
                      {log.cost > 0 && <span className="ml-2 text-amber-600 font-medium">₩{log.cost.toLocaleString()}</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm shrink-0">{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* 상세 */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">작업 내용</span>
                      <p className="text-gray-800">{log.description}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                      {log.parts_used && (
                        <div><span className="text-gray-400">교체 부품: </span>{log.parts_used}</div>
                      )}
                      {log.technician && (
                        <div><span className="text-gray-400">담당자: </span>{log.technician}</div>
                      )}
                      {log.next_check_date && (
                        <div>
                          <span className="text-gray-400">다음 점검: </span>
                          <span className="font-semibold text-blue-600">{log.next_check_date}</span>
                        </div>
                      )}
                      {log.cost > 0 && (
                        <div><span className="text-gray-400">비용: </span><span className="font-semibold text-amber-700">₩{log.cost.toLocaleString()}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
