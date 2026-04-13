"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { calcDeductedDays, type LeaveType } from "@/lib/types/leave";
import { deductLeaveOnApproval, restoreLeaveOnReject } from "@/app/actions/leave";

export type ScheduleCategory = "생산계획" | "품목계획" | "납품일정" | "회의" | "기타" | "일정";

export interface CreateScheduleEventData {
  event_date: string;
  end_date?: string | null;
  title: string;
  description?: string | null;
  category?: ScheduleCategory;
  dept?: string | null;
  all_day?: boolean;
}

export interface UpdateScheduleEventData {
  event_date?: string;
  end_date?: string | null;
  title?: string;
  description?: string | null;
  category?: ScheduleCategory;
  dept?: string | null;
  all_day?: boolean;
}

export interface RequestVacationData {
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  hours_count?: number | null;
  reason?: string | null;
}

export async function createScheduleEvent(data: CreateScheduleEventData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data: created, error } = await db
    .from("schedule_events")
    .insert({
      event_date:       data.event_date,
      end_date:         data.end_date ?? null,
      title:            data.title,
      description:      data.description ?? null,
      category:         data.category ?? "일정",
      dept:             data.dept ?? null,
      all_day:          data.all_day ?? true,
      created_by:       session.id,
      created_by_name:  session.name,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  return { success: true, event: created };
}

export async function updateScheduleEvent(id: string, data: UpdateScheduleEventData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();

  const { data: existing, error: fetchError } = await db
    .from("schedule_events")
    .select("created_by")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("일정을 찾을 수 없습니다.");

  const canEdit =
    existing.created_by === session.id ||
    session.role === "coo" ||
    session.role === "ceo";

  if (!canEdit) throw new Error("수정 권한이 없습니다.");

  const { error } = await db
    .from("schedule_events")
    .update({
      ...data,
      updated_by: session.id,
      updated_by_name: session.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  return { success: true };
}

export async function deleteScheduleEvent(id: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();

  const { data: existing, error: fetchError } = await db
    .from("schedule_events")
    .select("created_by")
    .eq("id", id)
    .single();

  if (fetchError || !existing) throw new Error("일정을 찾을 수 없습니다.");

  const canDelete =
    existing.created_by === session.id ||
    session.role === "coo" ||
    session.role === "ceo";

  if (!canDelete) throw new Error("삭제 권한이 없습니다.");

  const { error } = await db.from("schedule_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  return { success: true };
}

export async function requestVacation(data: RequestVacationData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const { start_date, end_date, leave_type, hours_count, reason } = data;

  // 차감 일수 계산
  const deducted = calcDeductedDays(leave_type, start_date, end_date, hours_count);

  // 반차·시간휴가는 end_date = start_date 강제
  const realEndDate =
    leave_type === '반차(오전)' || leave_type === '반차(오후)' || leave_type === '시간휴가'
      ? start_date
      : end_date;

  // days_count: 반차=0.5, 시간휴가=hours/8, 연차=날짜 수
  const daysCount = deducted;

  const db = createServerClient();
  const year = new Date(start_date).getFullYear();

  // 잔여 연차 확인 (없으면 auto-init 15일)
  const { data: bal } = await db
    .from("employee_leave_balances")
    .select("total_days, used_days")
    .eq("employee_id", session.id)
    .eq("year", year)
    .single();

  const totalDays = bal ? Number(bal.total_days) : 15;
  const usedDays  = bal ? Number(bal.used_days)  : 0;
  const remaining = totalDays - usedDays;

  if (deducted > remaining) {
    throw new Error(
      `잔여 연차가 부족합니다. (신청: ${deducted}일, 잔여: ${remaining.toFixed(1)}일)`
    );
  }

  const { error } = await db.from("vacation_requests").insert({
    requester_id:   session.id,
    requester_name: session.name,
    dept:           session.dept ?? null,
    start_date,
    end_date:       realEndDate,
    days_count:     daysCount,
    leave_type,
    hours_count:    leave_type === '시간휴가' ? (hours_count ?? null) : null,
    deducted_days:  deducted,
    reason:         reason ?? null,
    status:         "pending",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  return { success: true };
}

export async function approveVacation(
  id: string,
  status: "approved" | "rejected",
  reason?: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const canApprove =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀");

  if (!canApprove) throw new Error("승인 권한이 없습니다.");

  const db = createServerClient();

  // 기존 상태 조회 (복구 처리용)
  const { data: vac, error: fetchErr } = await db
    .from("vacation_requests")
    .select("requester_id, requester_name, dept, start_date, deducted_days, status")
    .eq("id", id)
    .single();

  if (fetchErr || !vac) throw new Error("신청 건을 찾을 수 없습니다.");

  const { error } = await db
    .from("vacation_requests")
    .update({
      status,
      approved_by:       session.id,
      approved_by_name:  session.name,
      approved_at:       new Date().toISOString(),
      reject_reason:     status === "rejected" ? (reason ?? null) : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  const year = new Date(vac.start_date as string).getFullYear();
  const deductedDays = Number(vac.deducted_days ?? 1);
  const approverSession = { id: session.id, name: session.name };

  if (status === "approved") {
    // 승인: 연차 차감
    await deductLeaveOnApproval(
      db, id,
      vac.requester_id as string,
      vac.requester_name as string,
      (vac.dept as string | null),
      year, deductedDays, approverSession
    );
  } else if (status === "rejected" && vac.status === "approved") {
    // 이미 승인됐던 건 반려 → 연차 복구
    await restoreLeaveOnReject(
      db, id,
      vac.requester_id as string,
      vac.requester_name as string,
      (vac.dept as string | null),
      year, deductedDays, approverSession
    );
  }

  revalidatePath("/schedule");
  return { success: true };
}
