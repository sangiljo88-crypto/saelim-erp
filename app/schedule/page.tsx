import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ScheduleCalendar from "@/components/ScheduleCalendar";
import { createServerClient } from "@/lib/supabase";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const monthParam = params.month; // e.g. "2026-04"

  // Determine the year/month to display
  const now = new Date();
  let year: number;
  let month: number; // 1-based

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0); // last day of month
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

  const db = createServerClient();

  // Fetch schedule events for the month
  const { data: eventsRaw } = await db
    .from("schedule_events")
    .select("*")
    .gte("event_date", firstDay)
    .lte("event_date", lastDay)
    .order("event_date", { ascending: true });

  // Fetch approved vacations overlapping the month
  const { data: vacationsRaw } = await db
    .from("vacation_requests")
    .select("*")
    .eq("status", "approved")
    .lte("start_date", lastDay)
    .gte("end_date", firstDay)
    .order("start_date", { ascending: true });

  // Fetch pending vacation count
  const { count: pendingCount } = await db
    .from("vacation_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Fetch all pending vacation requests (for approvers)
  const canApprove =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀");

  let pendingVacationsRaw: VacationRequest[] = [];
  if (canApprove) {
    const { data } = await db
      .from("vacation_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    pendingVacationsRaw = (data ?? []) as VacationRequest[];
  }

  const events = (eventsRaw ?? []) as ScheduleEvent[];
  const vacations = (vacationsRaw ?? []) as VacationRequest[];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="공유 일정" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-800">📅 공유 일정</h1>
            <p className="text-sm text-gray-500">일정 관리 및 휴가 신청/승인</p>
          </div>
        </div>

        <ScheduleCalendar
          session={{
            id: session.id,
            name: session.name,
            role: session.role,
            dept: session.dept,
          }}
          initialEvents={events}
          initialVacations={vacations}
          initialPending={pendingVacationsRaw}
          pendingCount={pendingCount ?? 0}
          currentYear={year}
          currentMonth={month}
          canApprove={canApprove}
        />
      </main>
    </div>
  );
}

// Types re-exported for use in this file
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
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}
