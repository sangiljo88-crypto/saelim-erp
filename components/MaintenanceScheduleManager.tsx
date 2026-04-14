"use client";

import { useState, useTransition } from "react";
import {
  completeMaintenanceTask,
  upsertMaintenanceSchedule,
  adjustSparePartStock,
  upsertSparePart,
} from "@/app/actions/preventive-maintenance";
import type { MaintenanceSchedule, SparePart } from "@/app/actions/preventive-maintenance";

// ── 주기 레이블 ──────────────────────────────────────────────
const FREQ_LABEL: Record<string, string> = {
  daily: "매일",
  weekly: "매주",
  biweekly: "격주",
  monthly: "매월",
  quarterly: "분기",
  yearly: "연간",
};

const FREQ_OPTIONS = Object.entries(FREQ_LABEL);

// ── 상태 계산 ───────────────────────────────────────────────
function getStatus(nextDue: string): { label: string; color: string } {
  const today = new Date().toISOString().split("T")[0];
  if (nextDue < today) return { label: "지연", color: "bg-red-100 text-red-700" };
  if (nextDue === today) return { label: "오늘", color: "bg-amber-100 text-amber-700" };
  return { label: "정상", color: "bg-emerald-100 text-emerald-700" };
}

function getStockStatus(current: number, min: number): { label: string; color: string } {
  if (current < min) return { label: "부족", color: "bg-red-100 text-red-700" };
  return { label: "정상", color: "bg-emerald-100 text-emerald-700" };
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function MaintenanceScheduleManager({
  initialSchedules,
  initialParts,
  canEdit,
}: {
  initialSchedules: MaintenanceSchedule[];
  initialParts: SparePart[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"schedule" | "parts">("schedule");
  const [schedules, setSchedules] = useState(initialSchedules);
  const [parts, setParts] = useState(initialParts);
  const [isPending, startTransition] = useTransition();

  // ── 스케줄 폼 상태 ─────────────────────────────────────────
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    equipment_name: "",
    equipment_location: "",
    task_description: "",
    frequency: "weekly",
    next_due: new Date().toISOString().split("T")[0],
    assigned_to: "",
    notes: "",
  });
  const [scheduleErr, setScheduleErr] = useState("");

  // ── 부품 폼 상태 ──────────────────────────────────────────
  const [showPartForm, setShowPartForm] = useState(false);
  const [partForm, setPartForm] = useState({
    part_name: "",
    part_code: "",
    equipment_name: "",
    category: "소모품",
    current_stock: 0,
    min_stock: 2,
    unit: "개",
    unit_price: 0,
    supplier: "",
    notes: "",
  });
  const [partErr, setPartErr] = useState("");

  // ── 재고 조정 모달 ────────────────────────────────────────
  const [stockModal, setStockModal] = useState<{ partId: string; partName: string; delta: number } | null>(null);
  const [stockReason, setStockReason] = useState("");
  const [stockErr, setStockErr] = useState("");

  // ── 정비 완료 처리 ────────────────────────────────────────
  function handleComplete(id: string) {
    startTransition(async () => {
      const res = await completeMaintenanceTask(id);
      if (res.success) {
        // 로컬 상태 업데이트
        const today = new Date().toISOString().split("T")[0];
        setSchedules((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;
            const d = new Date();
            switch (s.frequency) {
              case "daily": d.setDate(d.getDate() + 1); break;
              case "weekly": d.setDate(d.getDate() + 7); break;
              case "biweekly": d.setDate(d.getDate() + 14); break;
              case "monthly": d.setMonth(d.getMonth() + 1); break;
              case "quarterly": d.setMonth(d.getMonth() + 3); break;
              case "yearly": d.setFullYear(d.getFullYear() + 1); break;
            }
            return { ...s, last_performed: today, next_due: d.toISOString().split("T")[0] };
          })
        );
      } else {
        alert(res.error ?? "오류가 발생했습니다");
      }
    });
  }

  // ── 스케줄 추가 ───────────────────────────────────────────
  function handleAddSchedule() {
    setScheduleErr("");
    if (!scheduleForm.equipment_name || !scheduleForm.task_description) {
      setScheduleErr("설비명과 정비내용은 필수입니다");
      return;
    }
    startTransition(async () => {
      const res = await upsertMaintenanceSchedule(scheduleForm);
      if (res.success) {
        setShowScheduleForm(false);
        setScheduleForm({
          equipment_name: "", equipment_location: "", task_description: "",
          frequency: "weekly", next_due: new Date().toISOString().split("T")[0],
          assigned_to: "", notes: "",
        });
        // 새로고침으로 데이터 반영
        window.location.reload();
      } else {
        setScheduleErr(res.error ?? "오류가 발생했습니다");
      }
    });
  }

  // ── 부품 추가 ──────────────────────────────────────────────
  function handleAddPart() {
    setPartErr("");
    if (!partForm.part_name) {
      setPartErr("부품명은 필수입니다");
      return;
    }
    startTransition(async () => {
      const res = await upsertSparePart(partForm);
      if (res.success) {
        setShowPartForm(false);
        setPartForm({
          part_name: "", part_code: "", equipment_name: "", category: "소모품",
          current_stock: 0, min_stock: 2, unit: "개", unit_price: 0, supplier: "", notes: "",
        });
        window.location.reload();
      } else {
        setPartErr(res.error ?? "오류가 발생했습니다");
      }
    });
  }

  // ── 재고 조정 ──────────────────────────────────────────────
  function handleAdjustStock() {
    if (!stockModal || !stockReason.trim()) {
      setStockErr("사유를 입력하세요");
      return;
    }
    setStockErr("");
    startTransition(async () => {
      const res = await adjustSparePartStock(stockModal.partId, stockModal.delta, stockReason);
      if (res.success) {
        setParts((prev) =>
          prev.map((p) =>
            p.id === stockModal.partId
              ? { ...p, current_stock: p.current_stock + stockModal.delta }
              : p
          )
        );
        setStockModal(null);
        setStockReason("");
      } else {
        setStockErr(res.error ?? "오류가 발생했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("schedule")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "schedule"
              ? "bg-[#1F3864] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          정비 스케줄
        </button>
        <button
          onClick={() => setTab("parts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "parts"
              ? "bg-[#1F3864] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          부품 재고
        </button>
      </div>

      {/* ─── 정비 스케줄 탭 ────────────────────────────────── */}
      {tab === "schedule" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold text-gray-700">정비 스케줄 ({schedules.length}건)</span>
            {canEdit && (
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a4a7f] transition-colors"
              >
                + 추가
              </button>
            )}
          </div>

          {/* 추가 폼 */}
          {showScheduleForm && (
            <div className="px-4 py-3 bg-gray-50 border-b flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="설비명 *"
                  value={scheduleForm.equipment_name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, equipment_name: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="설비 위치"
                  value={scheduleForm.equipment_location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, equipment_location: e.target.value })}
                />
              </div>
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="정비 내용 *"
                value={scheduleForm.task_description}
                onChange={(e) => setScheduleForm({ ...scheduleForm, task_description: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                >
                  {FREQ_OPTIONS.map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={scheduleForm.next_due}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, next_due: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="담당자"
                  value={scheduleForm.assigned_to}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, assigned_to: e.target.value })}
                />
              </div>
              {scheduleErr && <p className="text-xs text-red-600">{scheduleErr}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddSchedule}
                  disabled={isPending}
                  className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowScheduleForm(false)}
                  className="text-xs bg-gray-200 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">설비명</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">정비내용</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">주기</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">최근실시</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">다음예정</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">담당</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">상태</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      등록된 정비 스케줄이 없습니다
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => {
                    const status = getStatus(s.next_due);
                    return (
                      <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {s.equipment_name}
                          {s.equipment_location && (
                            <span className="text-xs text-gray-400 ml-1">({s.equipment_location})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{s.task_description}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            {FREQ_LABEL[s.frequency] ?? s.frequency}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500 text-xs">
                          {s.last_performed ?? "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-medium">
                          {s.next_due}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600 text-xs">
                          {s.assigned_to ?? "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleComplete(s.id)}
                            disabled={isPending}
                            className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-200 disabled:opacity-50 font-medium"
                          >
                            완료
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 부품 재고 탭 ──────────────────────────────────── */}
      {tab === "parts" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold text-gray-700">부품/소모품 재고 ({parts.length}건)</span>
            {canEdit && (
              <button
                onClick={() => setShowPartForm(!showPartForm)}
                className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a4a7f] transition-colors"
              >
                + 추가
              </button>
            )}
          </div>

          {/* 부품 추가 폼 */}
          {showPartForm && (
            <div className="px-4 py-3 bg-gray-50 border-b flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="부품명 *"
                  value={partForm.part_name}
                  onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="부품코드"
                  value={partForm.part_code}
                  onChange={(e) => setPartForm({ ...partForm, part_code: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="설비명"
                  value={partForm.equipment_name}
                  onChange={(e) => setPartForm({ ...partForm, equipment_name: e.target.value })}
                />
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={partForm.category}
                  onChange={(e) => setPartForm({ ...partForm, category: e.target.value })}
                >
                  <option value="소모품">소모품</option>
                  <option value="부품">부품</option>
                  <option value="공구">공구</option>
                  <option value="윤활유">윤활유</option>
                </select>
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="공급업체"
                  value={partForm.supplier}
                  onChange={(e) => setPartForm({ ...partForm, supplier: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="현재고"
                  value={partForm.current_stock}
                  onChange={(e) => setPartForm({ ...partForm, current_stock: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="최소재고"
                  value={partForm.min_stock}
                  onChange={(e) => setPartForm({ ...partForm, min_stock: Number(e.target.value) })}
                />
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="단위"
                  value={partForm.unit}
                  onChange={(e) => setPartForm({ ...partForm, unit: e.target.value })}
                />
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 text-sm"
                  placeholder="단가"
                  value={partForm.unit_price}
                  onChange={(e) => setPartForm({ ...partForm, unit_price: Number(e.target.value) })}
                />
              </div>
              {partErr && <p className="text-xs text-red-600">{partErr}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddPart}
                  disabled={isPending}
                  className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowPartForm(false)}
                  className="text-xs bg-gray-200 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 부품 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">부품명</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">코드</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">설비</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">현재고</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">최소재고</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">단가</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">상태</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">입고/출고</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      등록된 부품이 없습니다
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => {
                    const status = getStockStatus(p.current_stock, p.min_stock);
                    return (
                      <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{p.part_name}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500 text-xs font-mono">
                          {p.part_code ?? "-"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{p.equipment_name ?? "-"}</td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {p.current_stock}{p.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {p.min_stock}{p.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                          {Number(p.unit_price).toLocaleString()}원
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setStockModal({ partId: p.id, partName: p.part_name, delta: 1 })}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200 font-medium"
                            >
                              입고
                            </button>
                            <button
                              onClick={() => setStockModal({ partId: p.id, partName: p.part_name, delta: -1 })}
                              className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded hover:bg-orange-200 font-medium"
                            >
                              출고
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 재고 조정 모달 ───────────────────────────────── */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              {stockModal.partName} — {stockModal.delta > 0 ? "입고" : "출고"}
            </h3>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">수량</label>
              <input
                type="number"
                className="border rounded-lg px-3 py-2 text-sm"
                value={Math.abs(stockModal.delta)}
                min={1}
                onChange={(e) =>
                  setStockModal({
                    ...stockModal,
                    delta: stockModal.delta > 0 ? Number(e.target.value) : -Number(e.target.value),
                  })
                }
              />
              <label className="text-xs text-gray-500">사유 *</label>
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="입고/출고 사유"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />
              {stockErr && <p className="text-xs text-red-600">{stockErr}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAdjustStock}
                  disabled={isPending}
                  className="flex-1 text-sm bg-[#1F3864] text-white py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50"
                >
                  {isPending ? "처리 중..." : "확인"}
                </button>
                <button
                  onClick={() => { setStockModal(null); setStockReason(""); setStockErr(""); }}
                  className="flex-1 text-sm bg-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
