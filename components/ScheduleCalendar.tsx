"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  requestVacation,
  approveVacation,
  type ScheduleCategory,
} from "@/app/actions/schedule";
import {
  adjustLeaveBalance,
  initLeaveBalancesForYear,
} from "@/app/actions/leave";
import {
  calcDeductedDays,
  LEAVE_TYPE_COLOR,
  type LeaveType,
  type LeaveBalance,
} from "@/lib/types/leave";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface SessionInfo {
  id: string;
  name: string;
  role: string;
  dept?: string;
}

interface ScheduleEvent {
  id: string;
  event_date: string;
  end_date: string | null;
  title: string;
  description: string | null;
  category: string;
  dept: string | null;
  all_day: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  created_at: string;
}

interface VacationRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  dept: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  leave_type: string;
  hours_count: number | null;
  deducted_days: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

interface Props {
  session: SessionInfo;
  initialEvents: ScheduleEvent[];
  initialVacations: VacationRequest[];
  initialPending: VacationRequest[];
  pendingCount: number;
  currentYear: number;
  currentMonth: number;
  canApprove: boolean;
  canManage: boolean;
  myLeaveBalance: LeaveBalance | null;
  allLeaveBalances: LeaveBalance[];
}

// ──────────────────────────────────────────────
// DatePickerInput — 어디 클릭해도 달력 팝업 오픈
// ──────────────────────────────────────────────
function DatePickerInput({
  value, onChange, required = false, id, min,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  id?: string;
  min?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="w-full border border-gray-300 rounded-lg overflow-hidden cursor-pointer hover:border-[#1F3864] transition-colors focus-within:border-[#1F3864] focus-within:ring-2 focus-within:ring-[#1F3864]/20"
      onClick={() => { ref.current?.focus(); ref.current?.showPicker?.(); }}
    >
      <input
        ref={ref}
        id={id}
        type="date"
        required={required}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm focus:outline-none bg-transparent cursor-pointer"
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const CATEGORIES: ScheduleCategory[] = [
  "생산계획",
  "품목계획",
  "납품일정",
  "회의",
  "기타",
  "일정",
];

const CATEGORY_STYLES: Record<string, string> = {
  생산계획: "bg-blue-100 text-blue-700",
  품목계획: "bg-purple-100 text-purple-700",
  납품일정: "bg-emerald-100 text-emerald-700",
  회의: "bg-amber-100 text-amber-700",
  기타: "bg-gray-100 text-gray-700",
  일정: "bg-gray-100 text-gray-700",
};

const CATEGORY_DOT: Record<string, string> = {
  생산계획: "bg-blue-400",
  품목계획: "bg-purple-400",
  납품일정: "bg-emerald-400",
  회의: "bg-amber-400",
  기타: "bg-gray-400",
  일정: "bg-gray-400",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ──────────────────────────────────────────────
// Calendar helper
// ──────────────────────────────────────────────
function buildCalendarWeeks(year: number, month: number): string[][] {
  // month is 1-based
  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0);

  const startDow = firstDate.getDay(); // 0=Sun
  const totalDays = lastDate.getDate();

  const days: string[] = [];

  // Pad from previous month
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month - 1, -startDow + i + 1);
    days.push(formatDate(d));
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  // Pad to fill 6 weeks (42 cells)
  const remainder = 42 - days.length;
  for (let d = 1; d <= remainder; d++) {
    const dt = new Date(year, month, d);
    days.push(formatDate(dt));
  }

  // Split into weeks
  const weeks: string[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(days.slice(i * 7, i * 7 + 7));
  }
  return weeks;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return formatDate(new Date());
}

function isCurrentMonth(dateStr: string, year: number, month: number): boolean {
  return dateStr.startsWith(`${year}-${String(month).padStart(2, "0")}`);
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Check if a vacation covers a given date
function vacationCoversDate(v: VacationRequest, dateStr: string): boolean {
  return v.start_date <= dateStr && v.end_date >= dateStr;
}

// Count business days between two date strings (simple calendar days)
function countDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ScheduleCalendar({
  session,
  initialEvents,
  initialVacations,
  initialPending,
  pendingCount,
  currentYear,
  currentMonth,
  canApprove,
  canManage,
  myLeaveBalance,
  allLeaveBalances,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<"schedule" | "vacation">("schedule");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormDate, setAddFormDate] = useState<string>("");
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [vacations, setVacations] = useState<VacationRequest[]>(initialVacations);
  const [pendingVacations, setPendingVacations] = useState<VacationRequest[]>(initialPending);

  // 이벤트 상세 팝업
  const [popupEvent, setPopupEvent] = useState<ScheduleEvent | null>(null);
  const [popupEditMode, setPopupEditMode] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupDesc, setPopupDesc] = useState("");
  const [popupCategory, setPopupCategory] = useState<ScheduleCategory>("일정");
  const [popupStartDate, setPopupStartDate] = useState("");
  const [popupEndDate, setPopupEndDate] = useState("");

  // ── router.refresh() 후 서버 props 반영 (실시간 동기화) ──
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setVacations(initialVacations); }, [initialVacations]);
  useEffect(() => { setPendingVacations(initialPending); }, [initialPending]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Add form state
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventEndDate, setNewEventEndDate] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventCategory, setNewEventCategory] = useState<ScheduleCategory>("일정");
  const [newEventDept, setNewEventDept] = useState("");

  // Vacation form state
  const [vacStartDate, setVacStartDate] = useState("");
  const [vacEndDate, setVacEndDate] = useState("");
  const [vacReason, setVacReason] = useState("");
  const [vacLeaveType, setVacLeaveType] = useState<LeaveType>("연차");
  const [vacHours, setVacHours] = useState<number>(1);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  // 휴가 신청 모달
  const [showVacModal, setShowVacModal] = useState(false);

  // 연차 관리 (관리자) state
  const [balances, setBalances] = useState<LeaveBalance[]>(allLeaveBalances);
  const [adjustTarget, setAdjustTarget] = useState<LeaveBalance | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [initingYear, setInitingYear] = useState(false);

  useEffect(() => { setBalances(allLeaveBalances); }, [allLeaveBalances]);

  const today = todayStr();
  const weeks = buildCalendarWeeks(currentYear, currentMonth);

  const prev = prevMonth(currentYear, currentMonth);
  const next = nextMonth(currentYear, currentMonth);

  const navigate = useCallback(
    (year: number, month: number) => {
      router.push(`/schedule?month=${monthParam(year, month)}`);
    },
    [router]
  );

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  // Get events for a specific date
  function eventsForDate(dateStr: string): ScheduleEvent[] {
    return events.filter(
      (e) =>
        e.event_date <= dateStr &&
        (e.end_date ? e.end_date >= dateStr : e.event_date === dateStr)
    );
  }

  // Get vacations for a specific date (approved, calendar display)
  function vacationsForDate(dateStr: string): VacationRequest[] {
    return vacations.filter((v) => vacationCoversDate(v, dateStr));
  }

  // Open vacation modal for a specific day
  function openVacFormForDay(dateStr: string) {
    setVacStartDate(dateStr);
    setVacEndDate(dateStr);
    setVacLeaveType("연차");
    setVacHours(1);
    setVacReason("");
    setShowVacModal(true);
  }

  // Open add form for a specific day
  function openAddFormForDay(dateStr: string) {
    setAddFormDate(dateStr);
    setNewEventDate(dateStr);
    setNewEventEndDate("");
    setNewEventTitle("");
    setNewEventDesc("");
    setNewEventCategory("일정");
    setNewEventDept("");
    setShowAddForm(true);
  }

  // Submit new event
  async function handleCreateEvent() {
    if (!newEventTitle.trim() || !newEventDate) {
      showError("날짜와 제목을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createScheduleEvent({
          event_date: newEventDate,
          end_date: newEventEndDate || null,
          title: newEventTitle.trim(),
          description: newEventDesc.trim() || null,
          category: newEventCategory,
          dept: newEventDept.trim() || null,
          all_day: true,
        });
        // 즉시 로컬 state 반영 (실시간 표시)
        if (result.event) {
          setEvents((prev) => [...prev, result.event as ScheduleEvent]);
        }
        router.refresh(); // 백그라운드 서버 동기화
        setShowAddForm(false);
        showSuccess("일정이 등록되었습니다.");
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  // 팝업 열기
  function openPopup(ev: ScheduleEvent) {
    setPopupEvent(ev);
    setPopupEditMode(false);
    setPopupTitle(ev.title);
    setPopupDesc(ev.description ?? "");
    setPopupCategory((ev.category as ScheduleCategory) ?? "일정");
    setPopupStartDate(ev.event_date);
    setPopupEndDate(ev.end_date ?? "");
  }

  // 팝업에서 저장
  async function handlePopupSave() {
    if (!popupEvent || !popupTitle.trim()) return;
    startTransition(async () => {
      try {
        await updateScheduleEvent(popupEvent.id, {
          title:       popupTitle.trim(),
          description: popupDesc.trim() || null,
          category:    popupCategory,
          event_date:  popupStartDate,
          end_date:    popupEndDate || null,
        });
        // 즉시 로컬 반영
        setEvents((prev) =>
          prev.map((e) =>
            e.id === popupEvent.id
              ? { ...e, title: popupTitle.trim(), description: popupDesc.trim() || null,
                  category: popupCategory, event_date: popupStartDate,
                  end_date: popupEndDate || null }
              : e
          )
        );
        setPopupEvent(null);
        router.refresh();
        showSuccess("일정이 수정되었습니다.");
      } catch (err) {
        showError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      }
    });
  }

  // 팝업에서 삭제
  async function handlePopupDelete() {
    if (!popupEvent) return;
    if (!confirm("일정을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      try {
        await deleteScheduleEvent(popupEvent.id);
        setEvents((prev) => prev.filter((e) => e.id !== popupEvent.id));
        setPopupEvent(null);
        router.refresh();
        showSuccess("일정이 삭제되었습니다.");
      } catch (err) {
        showError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      }
    });
  }

  // Delete event
  async function handleDeleteEvent(id: string) {
    if (!confirm("일정을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      try {
        await deleteScheduleEvent(id);
        setEvents((prev) => prev.filter((e) => e.id !== id));
        showSuccess("일정이 삭제되었습니다.");
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  // 반차/시간휴가는 end_date = start_date
  const isHalfOrHour = vacLeaveType === "반차(오전)" || vacLeaveType === "반차(오후)" || vacLeaveType === "시간휴가";
  const effectiveEndDate = isHalfOrHour ? vacStartDate : vacEndDate;
  const previewDeducted = vacStartDate
    ? calcDeductedDays(vacLeaveType, vacStartDate, effectiveEndDate || vacStartDate, vacLeaveType === "시간휴가" ? vacHours : null)
    : 0;
  const myRemaining = myLeaveBalance
    ? Number(myLeaveBalance.total_days) - Number(myLeaveBalance.used_days)
    : null;

  // Submit vacation request
  async function handleRequestVacation() {
    if (!vacStartDate) {
      showError("시작일을 입력해주세요.");
      return;
    }
    if (!isHalfOrHour && !vacEndDate) {
      showError("종료일을 입력해주세요.");
      return;
    }
    if (!isHalfOrHour && vacStartDate > vacEndDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }
    startTransition(async () => {
      try {
        await requestVacation({
          start_date:   vacStartDate,
          end_date:     effectiveEndDate || vacStartDate,
          leave_type:   vacLeaveType,
          hours_count:  vacLeaveType === "시간휴가" ? vacHours : null,
          reason:       vacReason.trim() || null,
        });
        setVacStartDate("");
        setVacEndDate("");
        setVacReason("");
        setVacLeaveType("연차");
        setVacHours(1);
        setShowVacModal(false);
        showSuccess("휴가 신청이 완료되었습니다. 결재 대기 중입니다.");
        router.refresh();
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  // 연차 잔여 조정 (관리자)
  async function handleAdjustBalance() {
    if (!adjustTarget || !adjustDelta || !adjustReason.trim()) {
      showError("조정 값과 사유를 모두 입력해주세요.");
      return;
    }
    const delta = parseFloat(adjustDelta);
    if (isNaN(delta) || delta === 0) {
      showError("올바른 조정 값을 입력해주세요.");
      return;
    }
    setAdjusting(true);
    try {
      await adjustLeaveBalance(adjustTarget.employee_id, adjustTarget.year, delta, adjustReason);
      // 로컬 반영
      setBalances((prev) =>
        prev.map((b) =>
          b.employee_id === adjustTarget.employee_id
            ? { ...b, total_days: Math.max(0, Number(b.total_days) + delta) }
            : b
        )
      );
      setAdjustTarget(null);
      setAdjustDelta("");
      setAdjustReason("");
      showSuccess("연차가 조정되었습니다. 이력이 기록되었습니다.");
      router.refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setAdjusting(false);
    }
  }

  // 전직원 초기화 (관리자)
  async function handleInitBalances() {
    if (!confirm(`${new Date().getFullYear()}년도 아직 연차 미등록 직원에게 15일을 부여합니다. 진행하시겠습니까?`)) return;
    setInitingYear(true);
    try {
      const result = await initLeaveBalancesForYear(new Date().getFullYear());
      showSuccess(`${result.count}명에게 연차 15일이 부여되었습니다.`);
      router.refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setInitingYear(false);
    }
  }

  // Approve or reject vacation
  async function handleApproveVacation(id: string, status: "approved" | "rejected") {
    const reason = rejectReasonMap[id];
    if (status === "rejected" && !reason?.trim()) {
      showError("반려 사유를 입력해주세요.");
      return;
    }
    startTransition(async () => {
      try {
        await approveVacation(id, status, reason);
        setPendingVacations((prev) => prev.filter((v) => v.id !== id));
        showSuccess(status === "approved" ? "휴가가 승인되었습니다." : "휴가가 반려되었습니다.");
        router.refresh();
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Toast messages */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("schedule")}
            className={`flex-1 px-6 py-3.5 text-sm font-semibold transition-colors ${
              tab === "schedule"
                ? "bg-[#1F3864] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            📅 일정
          </button>
          <button
            onClick={() => setTab("vacation")}
            className={`flex-1 px-6 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === "vacation"
                ? "bg-[#1F3864] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🏖️ 휴가
            {pendingCount > 0 && canApprove && (
              <span className="absolute top-2 right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => navigate(prev.year, prev.month)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-[#1F3864] hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            &#8249; 이전달
          </button>
          <span className="text-base font-bold text-[#1F3864]">
            {monthLabel(currentYear, currentMonth)}
          </span>
          <button
            onClick={() => navigate(next.year, next.month)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-[#1F3864] hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            다음달 &#8250;
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-2 sm:p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-xs font-semibold py-2 ${
                  i === 0
                    ? "text-red-500"
                    : i === 6
                    ? "text-blue-500"
                    : "text-gray-500"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.flat().map((dateStr, idx) => {
              const isThisMonth = isCurrentMonth(dateStr, currentYear, currentMonth);
              const isToday = dateStr === today;
              const dow = idx % 7; // 0=Sun, 6=Sat
              const isSun = dow === 0;
              const isSat = dow === 6;

              const dayEvents =
                tab === "schedule"
                  ? eventsForDate(dateStr)
                  : [];
              const dayVacations =
                tab === "vacation"
                  ? vacationsForDate(dateStr)
                  : [];

              const isSelected = selectedDay === dateStr;
              const dayNum = parseInt(dateStr.split("-")[2], 10);

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (tab === "schedule" && isThisMonth) {
                      openAddFormForDay(dateStr);
                    } else if (tab === "vacation" && isThisMonth) {
                      openVacFormForDay(dateStr);
                    } else {
                      setSelectedDay(isSelected ? null : dateStr);
                    }
                  }}
                  className={`min-h-[72px] sm:min-h-[88px] p-1 rounded-lg cursor-pointer transition-colors border ${
                    isSelected
                      ? "border-[#1F3864] bg-blue-50"
                      : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                  } ${!isThisMonth ? "opacity-40" : ""} ${
                    isSun ? "bg-red-50/30" : isSat ? "bg-blue-50/30" : ""
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-[#1F3864] text-white"
                          : isSun
                          ? "text-red-500"
                          : isSat
                          ? "text-blue-500"
                          : "text-gray-700"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {tab === "schedule" && isThisMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddFormForDay(dateStr);
                        }}
                        className="text-gray-300 hover:text-[#1F3864] text-lg leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 transition-colors"
                        title="일정 추가"
                      >
                        +
                      </button>
                    )}
                    {tab === "vacation" && isThisMonth && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openVacFormForDay(dateStr);
                        }}
                        className="text-gray-300 hover:text-orange-400 text-lg leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-orange-50 transition-colors"
                        title="휴가 신청"
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Schedule tab: event dots/pills */}
                  {tab === "schedule" && (
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); openPopup(ev); }}
                          className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-75 transition-opacity ${
                            CATEGORY_STYLES[ev.category] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-gray-400 pl-1">
                          +{dayEvents.length - 3}더
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vacation tab: approved vacation bars */}
                  {tab === "vacation" && (
                    <div className="flex flex-col gap-0.5">
                      {dayVacations.slice(0, 3).map((v) => {
                        const lt = v.leave_type;
                        const leaveLabel = !lt || lt === "연차" ? "연차"
                          : lt === "반차(오전)" ? "오전반차"
                          : lt === "반차(오후)" ? "오후반차"
                          : lt === "시간휴가" ? `${v.hours_count ?? "?"}시간`
                          : lt;
                        const colorClass = lt === "반차(오전)" ? "bg-purple-100 text-purple-700"
                          : lt === "반차(오후)" ? "bg-indigo-100 text-indigo-700"
                          : lt === "시간휴가" ? "bg-amber-100 text-amber-700"
                          : "bg-orange-100 text-orange-700";
                        return (
                          <div key={v.id} className={`text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${colorClass}`}>
                            <span className="truncate font-medium">{v.requester_name}</span>
                            <span className="opacity-60 shrink-0">·{leaveLabel}</span>
                          </div>
                        );
                      })}
                      {dayVacations.length > 3 && (
                        <div className="text-[10px] text-gray-400 pl-1">
                          +{dayVacations.length - 3}더
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Global add button for schedule tab */}
        {tab === "schedule" && (
          <div className="px-4 sm:px-6 pb-4">
            <button
              onClick={() => openAddFormForDay(today)}
              className="text-sm bg-[#1F3864] text-white px-4 py-2 rounded-lg hover:bg-[#2a4a7f] transition-colors font-semibold"
            >
              + 일정 추가
            </button>
          </div>
        )}
        {/* Global vacation button + balance badge */}
        {tab === "vacation" && (
          <div className="px-4 sm:px-6 pb-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => openVacFormForDay(today)}
              className="text-sm bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
            >
              🏖️ 휴가 신청
            </button>
            {myRemaining !== null && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                myRemaining > 5
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : myRemaining > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                잔여 연차 <strong>{myRemaining.toFixed(1)}일</strong>
                {myLeaveBalance && <span className="text-gray-400 font-normal ml-1">/ {Number(myLeaveBalance.total_days).toFixed(0)}일</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Add Event Modal Popup ── */}
      {tab === "schedule" && showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddForm(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-base">일정 추가</h3>
                {addFormDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    📅 {addFormDate}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                ×
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작일 *</label>
                  <DatePickerInput value={newEventDate} onChange={setNewEventDate} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료일 (선택)</label>
                  <DatePickerInput value={newEventEndDate} onChange={setNewEventEndDate} min={newEventDate} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="일정 제목을 입력하세요"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용 (선택)</label>
                <textarea
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="상세 내용을 입력하세요"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">카테고리</label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value as ScheduleCategory)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">부서 (선택, 비워두면 전사)</label>
                  <input
                    type="text"
                    value={newEventDept}
                    onChange={(e) => setNewEventDept(e.target.value)}
                    placeholder="예: 생산팀"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleCreateEvent}
                  disabled={isPending}
                  className="flex-1 bg-[#1F3864] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2a4a7f] disabled:opacity-50 transition-colors"
                >
                  {isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Vacation Request Modal ── */}
      {showVacModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVacModal(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-base">🏖️ 휴가 신청</h3>
                {vacStartDate && (
                  <p className="text-xs text-gray-400 mt-0.5">📅 {vacStartDate}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {myRemaining !== null && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    myRemaining > 5
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : myRemaining > 0
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    잔여 {myRemaining.toFixed(1)}일
                  </span>
                )}
                <button
                  onClick={() => setShowVacModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* 휴가 종류 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">휴가 종류 *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["연차", "반차(오전)", "반차(오후)", "시간휴가"] as LeaveType[]).map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => { setVacLeaveType(lt); setVacHours(1); }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors text-left flex items-center gap-1.5 ${
                        vacLeaveType === lt
                          ? "bg-[#1F3864] text-white border-[#1F3864]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#1F3864] hover:text-[#1F3864]"
                      }`}
                    >
                      <span>{lt === "연차" ? "📅" : lt === "반차(오전)" ? "🌅" : lt === "반차(오후)" ? "🌇" : "⏱️"}</span>
                      <span>{lt}</span>
                      <span className={`ml-auto text-[10px] ${vacLeaveType === lt ? "text-white/70" : "text-gray-400"}`}>
                        {lt === "연차" ? "1일" : lt === "반차(오전)" ? "0.5일" : lt === "반차(오후)" ? "0.5일" : "시간/8"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작일 *</label>
                  <DatePickerInput value={vacStartDate} onChange={(v) => { setVacStartDate(v); if (isHalfOrHour) setVacEndDate(v); }} required />
                </div>
                {!isHalfOrHour && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료일 *</label>
                    <DatePickerInput value={vacEndDate} onChange={setVacEndDate} required min={vacStartDate} />
                  </div>
                )}
                {vacLeaveType === "시간휴가" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">사용 시간 *</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVacHours((h) => Math.max(1, h - 1))}
                        className="w-9 h-9 border border-gray-300 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                      >−</button>
                      <input
                        type="number" min={1} max={8}
                        value={vacHours}
                        onChange={(e) => setVacHours(Math.min(8, Math.max(1, Number(e.target.value))))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-[#1F3864]"
                      />
                      <button
                        type="button"
                        onClick={() => setVacHours((h) => Math.min(8, h + 1))}
                        className="w-9 h-9 border border-gray-300 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                      >+</button>
                      <span className="text-sm text-gray-500">시간</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 사유 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">사유 (선택)</label>
                <textarea
                  value={vacReason}
                  onChange={(e) => setVacReason(e.target.value)}
                  placeholder="휴가 사유를 입력하세요"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] resize-none"
                />
              </div>

              {/* 차감 미리보기 */}
              {vacStartDate && previewDeducted > 0 && (
                <div className={`px-4 py-3 rounded-xl flex items-center justify-between ${
                  myRemaining !== null && previewDeducted > myRemaining
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-200"
                }`}>
                  <div className="text-sm">
                    <span className="text-gray-600">차감 예정: </span>
                    <strong className={myRemaining !== null && previewDeducted > myRemaining ? "text-red-600" : "text-[#1F3864]"}>
                      {previewDeducted}일
                    </strong>
                    {myRemaining !== null && (
                      <span className="text-gray-400 text-xs ml-2">
                        → 신청 후 잔여: {(myRemaining - previewDeducted).toFixed(1)}일
                      </span>
                    )}
                  </div>
                  {myRemaining !== null && previewDeducted > myRemaining && (
                    <span className="text-xs font-semibold text-red-600">잔여 부족</span>
                  )}
                </div>
              )}

              {/* 버튼 */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleRequestVacation}
                  disabled={isPending || (myRemaining !== null && previewDeducted > myRemaining && previewDeducted > 0)}
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "신청 중..." : "✅ 신청 완료"}
                </button>
                <button
                  onClick={() => setShowVacModal(false)}
                  className="px-5 py-2.5 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Selected Day Detail Panel (schedule tab) ── */}
      {tab === "schedule" && selectedDay && (
        <SelectedDayPanel
          dateStr={selectedDay}
          events={eventsForDate(selectedDay)}
          session={session}
          onClose={() => setSelectedDay(null)}
          onAddEvent={() => openAddFormForDay(selectedDay)}
          onDeleteEvent={handleDeleteEvent}
          isPending={isPending}
        />
      )}

      {/* ── Selected Day Detail Panel (vacation tab) ── */}
      {tab === "vacation" && selectedDay && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{selectedDay} 휴가 현황</h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
          {vacationsForDate(selectedDay).length === 0 ? (
            <p className="text-sm text-gray-500">이 날 승인된 휴가가 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {vacationsForDate(selectedDay).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-semibold text-orange-700">
                    {v.requester_name}
                  </span>
                  {v.dept && (
                    <span className="text-xs text-gray-500">{v.dept}</span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">
                    {v.start_date} ~ {v.end_date} ({v.days_count}일)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Leave Balance Card ── */}
      {tab === "vacation" && myLeaveBalance && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-gray-700">내 연차 현황 ({myLeaveBalance.year}년)</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">총 <strong className="text-gray-700">{Number(myLeaveBalance.total_days).toFixed(0)}일</strong></span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">사용 <strong className="text-orange-600">{Number(myLeaveBalance.used_days).toFixed(1)}일</strong></span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">잔여 <strong className={
                  myRemaining! > 5 ? "text-emerald-600" : myRemaining! > 0 ? "text-amber-600" : "text-red-600"
                }>{myRemaining!.toFixed(1)}일</strong></span>
              </div>
            </div>
            {/* 잔여 프로그레스 */}
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    myRemaining! > 5 ? "bg-emerald-400" : myRemaining! > 0 ? "bg-amber-400" : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (myRemaining! / Number(myLeaveBalance.total_days)) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right">
                {Math.round((myRemaining! / Number(myLeaveBalance.total_days)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Approvals Section ── */}
      {tab === "vacation" && canApprove && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-bold text-gray-800">결재 대기</h3>
            {pendingVacations.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingVacations.length}건
              </span>
            )}
          </div>
          {pendingVacations.length === 0 ? (
            <p className="text-sm text-gray-500">대기 중인 휴가 신청이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pendingVacations.map((v) => (
                <div
                  key={v.id}
                  className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">
                          {v.requester_name}
                        </span>
                        {v.dept && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {v.dept}
                          </span>
                        )}
                        {v.leave_type && (
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            LEAVE_TYPE_COLOR[v.leave_type as LeaveType] ?? "bg-gray-100 text-gray-700"
                          }`}>
                            {v.leave_type}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {v.start_date}
                        {v.end_date !== v.start_date ? ` ~ ${v.end_date}` : ""}
                        {" "}({v.deducted_days}일 차감
                        {v.leave_type === "시간휴가" && v.hours_count ? ` · ${v.hours_count}시간` : ""})
                      </div>
                      {v.reason && (
                        <div className="text-xs text-gray-600 mt-1">사유: {v.reason}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        신청일: {v.created_at.slice(0, 10)}
                      </div>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                      대기
                    </span>
                  </div>
                  {/* Reject reason input */}
                  <div>
                    <input
                      type="text"
                      placeholder="반려 사유 (반려 시 필수)"
                      value={rejectReasonMap[v.id] ?? ""}
                      onChange={(e) =>
                        setRejectReasonMap((prev) => ({
                          ...prev,
                          [v.id]: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#1F3864]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveVacation(v.id, "approved")}
                      disabled={isPending}
                      className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleApproveVacation(v.id, "rejected")}
                      disabled={isPending}
                      className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      반려
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 연차 잔여 관리 (관리자) ── */}
      {tab === "vacation" && canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-gray-800">📊 직원 연차 현황</h3>
              <p className="text-xs text-gray-500 mt-0.5">연차 잔여를 조정하면 이력이 자동 기록됩니다</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/schedule/leave"
                className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                📋 이력 보기
              </a>
              <button
                onClick={handleInitBalances}
                disabled={initingYear}
                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors font-semibold"
              >
                {initingYear ? "처리 중..." : "🔄 미등록 직원 초기화"}
              </button>
            </div>
          </div>

          {balances.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">등록된 연차 정보가 없습니다.</p>
              <p className="text-xs mt-1">위 버튼을 눌러 직원 연차를 초기화하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">직원</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">부서</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">총 연차</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">사용</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">잔여</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {balances.map((b) => {
                    const remaining = Number(b.total_days) - Number(b.used_days);
                    return (
                      <tr key={b.employee_id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{b.employee_name}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{b.dept ?? "-"}</td>
                        <td className="py-2.5 px-3 text-center text-gray-700">{Number(b.total_days).toFixed(0)}일</td>
                        <td className="py-2.5 px-3 text-center text-orange-600">{Number(b.used_days).toFixed(1)}일</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`font-semibold ${
                            remaining > 5 ? "text-emerald-600"
                            : remaining > 0 ? "text-amber-600"
                            : "text-red-600"
                          }`}>
                            {remaining.toFixed(1)}일
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => { setAdjustTarget(b); setAdjustDelta(""); setAdjustReason(""); }}
                            className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-2.5 py-1 rounded-lg hover:bg-[#1F3864] hover:text-white transition-colors font-semibold"
                          >
                            조정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 연차 조정 모달 ── */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setAdjustTarget(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">연차 조정</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {adjustTarget.employee_name} · {adjustTarget.dept ?? ""}
                </p>
              </div>
              <button
                onClick={() => setAdjustTarget(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* 현재 상태 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">총 연차</div>
                  <div className="font-bold text-gray-700">{Number(adjustTarget.total_days).toFixed(0)}일</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">사용</div>
                  <div className="font-bold text-orange-600">{Number(adjustTarget.used_days).toFixed(1)}일</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">잔여</div>
                  <div className="font-bold text-emerald-600">
                    {(Number(adjustTarget.total_days) - Number(adjustTarget.used_days)).toFixed(1)}일
                  </div>
                </div>
              </div>
              {/* 조정 값 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  조정 값 * <span className="text-gray-400 font-normal">(양수=증가, 음수=감소)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => {
                      const n = parseFloat(prev || "0");
                      return isNaN(n) ? "-1" : String(n - 1);
                    })}
                    className="w-9 h-9 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    step="0.5"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    placeholder="예: 1 또는 -1"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((prev) => {
                      const n = parseFloat(prev || "0");
                      return isNaN(n) ? "1" : String(n + 1);
                    })}
                    className="w-9 h-9 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
                  >+</button>
                </div>
                {adjustDelta && !isNaN(parseFloat(adjustDelta)) && (
                  <p className="text-xs text-gray-500 mt-1">
                    조정 후 총 연차:{" "}
                    <strong className="text-[#1F3864]">
                      {Math.max(0, Number(adjustTarget.total_days) + parseFloat(adjustDelta)).toFixed(1)}일
                    </strong>
                  </p>
                )}
              </div>
              {/* 사유 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">조정 사유 *</label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="예: 입사 2년차 추가 부여, 오류 수정 등"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleAdjustBalance}
                  disabled={adjusting || !adjustDelta || !adjustReason.trim()}
                  className="flex-1 bg-[#1F3864] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2a4a7f] disabled:opacity-50 transition-colors"
                >
                  {adjusting ? "저장 중..." : "💾 저장 (이력 기록됨)"}
                </button>
                <button
                  onClick={() => setAdjustTarget(null)}
                  className="px-5 py-2.5 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 이벤트 상세 팝업 모달 ─────────────────── */}
      {popupEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setPopupEvent(null); setPopupEditMode(false); }}
        >
          {/* 배경 블러 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* 모달 카드 */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 색상 헤더 */}
            <div className={`px-6 pt-5 pb-4 rounded-t-2xl ${
              CATEGORY_STYLES[popupEvent.category] ?? "bg-gray-100"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {!popupEditMode && (
                    <div className="text-xs font-semibold opacity-70 mb-1">
                      {popupEvent.category}
                      {popupEvent.dept && ` · ${popupEvent.dept}`}
                    </div>
                  )}
                  {popupEditMode ? (
                    <input
                      type="text"
                      value={popupTitle}
                      onChange={(e) => setPopupTitle(e.target.value)}
                      className="w-full text-lg font-bold bg-white/80 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                      autoFocus
                    />
                  ) : (
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">
                      {popupEvent.title}
                    </h2>
                  )}
                </div>
                <button
                  onClick={() => { setPopupEvent(null); setPopupEditMode(false); }}
                  className="text-gray-500 hover:text-gray-800 text-2xl leading-none shrink-0 mt-0.5 cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* 날짜 */}
              {popupEditMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">시작일</label>
                    <DatePickerInput value={popupStartDate} onChange={setPopupStartDate} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">종료일 (선택)</label>
                    <DatePickerInput value={popupEndDate} onChange={setPopupEndDate} min={popupStartDate} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📅</span>
                  <span className="font-medium">
                    {popupEvent.event_date}
                    {popupEvent.end_date && popupEvent.end_date !== popupEvent.event_date
                      ? ` ~ ${popupEvent.end_date}` : ""}
                  </span>
                </div>
              )}

              {/* 카테고리 (수정 모드) */}
              {popupEditMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">카테고리</label>
                    <select value={popupCategory}
                      onChange={(e) => setPopupCategory(e.target.value as ScheduleCategory)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 내용 */}
              {popupEditMode ? (
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">내용</label>
                  <textarea
                    value={popupDesc}
                    onChange={(e) => setPopupDesc(e.target.value)}
                    rows={3}
                    placeholder="내용을 입력하세요"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 resize-none"
                  />
                </div>
              ) : (
                popupEvent.description && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">
                    {popupEvent.description}
                  </p>
                )
              )}

              {/* 작성/수정 정보 */}
              {!popupEditMode && (
                <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
                  <span>✍️ 작성: <strong className="text-gray-600">{popupEvent.created_by_name}</strong></span>
                  {popupEvent.updated_by_name && (
                    <span>🔧 수정: <strong className="text-gray-600">{popupEvent.updated_by_name}</strong></span>
                  )}
                  {popupEvent.updated_at && (
                    <span className="ml-auto">{popupEvent.updated_at.slice(0, 16).replace("T", " ")}</span>
                  )}
                </div>
              )}

              {/* 버튼 영역 */}
              {(session.id === popupEvent.created_by ||
                session.role === "coo" ||
                session.role === "ceo") && (
                <div className="flex items-center gap-2 pt-1">
                  {popupEditMode ? (
                    <>
                      <button
                        onClick={handlePopupSave}
                        disabled={isPending}
                        className="flex-1 bg-[#1F3864] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#2a4a7f] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isPending ? "저장 중…" : "💾 저장"}
                      </button>
                      <button
                        onClick={() => setPopupEditMode(false)}
                        className="px-5 py-2.5 text-sm text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setPopupEditMode(true)}
                        className="flex-1 border border-[#1F3864] text-[#1F3864] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#1F3864] hover:text-white transition-colors cursor-pointer"
                      >
                        ✏️ 수정
                      </button>
                      <button
                        onClick={handlePopupDelete}
                        disabled={isPending}
                        className="px-5 py-2.5 text-sm font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Selected Day Panel Component
// ──────────────────────────────────────────────
interface SelectedDayPanelProps {
  dateStr: string;
  events: ScheduleEvent[];
  session: SessionInfo;
  onClose: () => void;
  onAddEvent: () => void;
  onDeleteEvent: (id: string) => void;
  isPending: boolean;
}

function SelectedDayPanel({
  dateStr,
  events,
  session,
  onClose,
  onAddEvent,
  onDeleteEvent,
  isPending,
}: SelectedDayPanelProps) {
  const canModify = (ev: ScheduleEvent) =>
    ev.created_by === session.id ||
    session.role === "coo" ||
    session.role === "ceo";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800">{dateStr}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {events.length > 0 ? `${events.length}개 일정` : "등록된 일정 없음"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddEvent}
            className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a4a7f] transition-colors font-semibold"
          >
            + 일정 추가
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📅</div>
          <p className="text-sm">이 날 등록된 일정이 없습니다.</p>
          <button
            onClick={onAddEvent}
            className="mt-3 text-xs text-[#1F3864] hover:underline"
          >
            일정 추가하기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        CATEGORY_STYLES[ev.category] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ev.category}
                    </span>
                    {ev.dept && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {ev.dept}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-gray-800 mt-1.5 text-sm">
                    {ev.title}
                  </div>
                  {ev.end_date && ev.end_date !== ev.event_date && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {ev.event_date} ~ {ev.end_date}
                    </div>
                  )}
                  {ev.description && (
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap">
                      {ev.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>작성: {ev.created_by_name}</span>
                    {ev.updated_by_name && ev.updated_by_name !== ev.created_by_name && (
                      <span>수정: {ev.updated_by_name}</span>
                    )}
                  </div>
                </div>
                {canModify(ev) && (
                  <button
                    onClick={() => onDeleteEvent(ev.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
