import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ScheduleCalendar from "@/components/ScheduleCalendar";
import { createServerClient } from "@/lib/supabase";
import type { LeaveBalance } from "@/lib/types/leave";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const monthParam = params.month;

  const now = new Date();
  let year: number;
  let month: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

  const db = createServerClient();
  const thisYear = now.getFullYear();

  const canApprove =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀");

  const canManage =
    canApprove;

  const [
    { data: eventsRaw },
    { data: vacationsRaw },
    { count: pendingCount },
    pendingVacationsResult,
    myBalanceResult,
    allBalancesResult,
    myVacationsResult,
  ] = await Promise.all([
    db.from("schedule_events")
      .select("*")
      .gte("event_date", firstDay)
      .lte("event_date", lastDay)
      .order("event_date", { ascending: true }),

    db.from("vacation_requests")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", lastDay)
      .gte("end_date", firstDay)
      .order("start_date", { ascending: true }),

    db.from("vacation_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    canApprove
      ? db.from("vacation_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),

    // 본인 연차 잔여 (올해)
    db.from("employee_leave_balances")
      .select("*")
      .eq("employee_id", session.id)
      .eq("year", thisYear)
      .single(),

    // 전직원 잔여 (관리자만)
    canManage
      ? db.from("employee_leave_balances")
          .select("*")
          .eq("year", thisYear)
          .order("dept", { ascending: true })
      : Promise.resolve({ data: [] }),

    // 내 휴가 신청 내역 (최근 30건)
    db.from("vacation_requests")
      .select("*")
      .eq("requester_id", session.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const events     = (eventsRaw ?? []) as ScheduleEvent[];
  const vacations  = (vacationsRaw ?? []) as VacationRequest[];
  const pendingVac = (pendingVacationsResult.data ?? []) as VacationRequest[];
  const myBalance  = (myBalanceResult.data ?? null) as LeaveBalance | null;
  const allBalances = (allBalancesResult.data ?? []) as LeaveBalance[];
  const myVacations = (myVacationsResult.data ?? []) as VacationRequest[];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="공유 일정" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-800">📅 공유 일정</h1>
            <p className="text-sm text-gray-500">일정 관리 및 휴가 신청/승인</p>
          </div>
          <a
            href="/schedule/leave"
            className="text-xs bg-white border border-gray-200 text-[#1F3864] px-3 py-1.5 rounded-lg hover:bg-[#1F3864] hover:text-white transition-colors font-semibold"
          >
            📋 연차 현황
          </a>
        </div>

        <ScheduleCalendar
          session={{
            id:   session.id,
            name: session.name,
            role: session.role,
            dept: session.dept,
          }}
          initialEvents={events}
          initialVacations={vacations}
          initialPending={pendingVac}
          pendingCount={pendingCount ?? 0}
          currentYear={year}
          currentMonth={month}
          canApprove={canApprove}
          canManage={canManage}
          myLeaveBalance={myBalance}
          allLeaveBalances={allBalances}
          myVacations={myVacations}
        />
      </main>
    </div>
  );
}

// Types
export interface ScheduleEvent {
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

export interface VacationRequest {
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
