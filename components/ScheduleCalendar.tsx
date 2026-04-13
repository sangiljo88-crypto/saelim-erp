"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  requestVacation,
  approveVacation,
  type ScheduleCategory,
} from "@/app/actions/schedule";

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
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

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
        await createScheduleEvent({
          event_date: newEventDate,
          end_date: newEventEndDate || null,
          title: newEventTitle.trim(),
          description: newEventDesc.trim() || null,
          category: newEventCategory,
          dept: newEventDept.trim() || null,
          all_day: true,
        });
        // Optimistic update - reload via router
        router.refresh();
        setShowAddForm(false);
        showSuccess("일정이 등록되었습니다.");
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
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

  // Submit vacation request
  async function handleRequestVacation() {
    if (!vacStartDate || !vacEndDate) {
      showError("시작일과 종료일을 입력해주세요.");
      return;
    }
    if (vacStartDate > vacEndDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }
    startTransition(async () => {
      try {
        await requestVacation({
          start_date: vacStartDate,
          end_date: vacEndDate,
          days_count: countDays(vacStartDate, vacEndDate),
          reason: vacReason.trim() || null,
        });
        setVacStartDate("");
        setVacEndDate("");
        setVacReason("");
        showSuccess("휴가 신청이 완료되었습니다.");
        router.refresh();
      } catch (e) {
        showError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
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
                  onClick={() =>
                    setSelectedDay(isSelected ? null : dateStr)
                  }
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
                  </div>

                  {/* Schedule tab: event dots/pills */}
                  {tab === "schedule" && (
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${
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
                      {dayVacations.slice(0, 3).map((v) => (
                        <div
                          key={v.id}
                          className="text-[10px] px-1 py-0.5 rounded truncate bg-orange-100 text-orange-700"
                        >
                          {v.requester_name}
                        </div>
                      ))}
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
      </div>

      {/* ── Add Event Form ── */}
      {tab === "schedule" && showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">일정 추가</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                시작일 *
              </label>
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                종료일 (선택)
              </label>
              <input
                type="date"
                value={newEventEndDate}
                onChange={(e) => setNewEventEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                제목 *
              </label>
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="일정 제목을 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                내용 (선택)
              </label>
              <textarea
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                placeholder="상세 내용을 입력하세요"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                카테고리
              </label>
              <select
                value={newEventCategory}
                onChange={(e) => setNewEventCategory(e.target.value as ScheduleCategory)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                부서 (선택, 비워두면 전사 공유)
              </label>
              <input
                type="text"
                value={newEventDept}
                onChange={(e) => setNewEventDept(e.target.value)}
                placeholder="예: 생산팀"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleCreateEvent}
              disabled={isPending}
              className="bg-[#1F3864] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#2a4a7f] disabled:opacity-50 transition-colors"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-600 px-5 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
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

      {/* ── Vacation Request Form ── */}
      {tab === "vacation" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-bold text-gray-800 mb-4">휴가 신청</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                시작일 *
              </label>
              <input
                type="date"
                value={vacStartDate}
                onChange={(e) => setVacStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                종료일 *
              </label>
              <input
                type="date"
                value={vacEndDate}
                onChange={(e) => setVacEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                사유 (선택)
              </label>
              <textarea
                value={vacReason}
                onChange={(e) => setVacReason(e.target.value)}
                placeholder="휴가 사유를 입력하세요"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F3864] resize-none"
              />
            </div>
          </div>
          {vacStartDate && vacEndDate && vacStartDate <= vacEndDate && (
            <p className="text-xs text-gray-500 mt-2">
              총 {countDays(vacStartDate, vacEndDate)}일
            </p>
          )}
          <div className="mt-4">
            <button
              onClick={handleRequestVacation}
              disabled={isPending}
              className="bg-[#1F3864] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#2a4a7f] disabled:opacity-50 transition-colors"
            >
              {isPending ? "신청 중..." : "휴가 신청"}
            </button>
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
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">
                          {v.requester_name}
                        </span>
                        {v.dept && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {v.dept}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {v.start_date} ~ {v.end_date} ({v.days_count}일)
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
