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

  if (error) {
    // 새 컬럼이 없는 경우(마이그레이션 미실행) 기존 스키마로 재시도
    if (error.code === '42703' || error.message.includes('column')) {
      const { error: error2 } = await db.from("vacation_requests").insert({
        requester_id:   session.id,
        requester_name: session.name,
        dept:           session.dept ?? null,
        start_date,
        end_date:       realEndDate,
        days_count:     Math.ceil(daysCount),
        reason:         reason ?? null,
        status:         "pending",
      });
      if (error2) throw new Error(error2.message);
      // 마이그레이션 안내 (성공은 하지만 경고)
    } else {
      throw new Error(error.message);
    }
  }
  revalidatePath("/schedule");
  return { success: true };
}

export async function updateVacationRequest(id: string, data: RequestVacationData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();

  // Fetch existing request - handle missing columns (deducted_days may not exist yet)
  let existing: { requester_id: string; start_date: string; status: string; deducted_days?: number; days_count: number } | null = null;

  const { data: existingFull, error: fetchErr } = await db
    .from("vacation_requests")
    .select("requester_id, start_date, status, deducted_days, days_count")
    .eq("id", id)
    .single();

  if (fetchErr) {
    if (fetchErr.code === '42703' || fetchErr.message.includes('column')) {
      const { data: existingBasic, error: fetchErr2 } = await db
        .from("vacation_requests")
        .select("requester_id, start_date, status, days_count")
        .eq("id", id)
        .single();
      if (fetchErr2 || !existingBasic) throw new Error("신청 건을 찾을 수 없습니다.");
      existing = { ...existingBasic, deducted_days: existingBasic.days_count };
    } else {
      throw new Error("신청 건을 찾을 수 없습니다.");
    }
  } else {
    existing = existingFull;
  }

  if (!existing) throw new Error("신청 건을 찾을 수 없습니다.");
  if (existing.requester_id !== session.id) throw new Error("본인 신청만 수정 가능합니다.");

  // Cannot edit if vacation already started
  const today = new Date().toISOString().slice(0, 10);
  if (existing.start_date <= today) throw new Error("이미 시작되었거나 지난 휴가는 수정할 수 없습니다.");

  const { start_date, end_date, leave_type, hours_count, reason } = data;
  const deducted = calcDeductedDays(leave_type, start_date, end_date, hours_count);
  const isHalfOrHourUpdate = leave_type === '반차(오전)' || leave_type === '반차(오후)' || leave_type === '시간휴가';
  const realEndDate = isHalfOrHourUpdate ? start_date : end_date;

  // Check leave balance
  const year = new Date(start_date).getFullYear();
  const { data: bal } = await db
    .from("employee_leave_balances")
    .select("total_days, used_days")
    .eq("employee_id", session.id)
    .eq("year", year)
    .single();

  if (bal) {
    const prevDeducted = Number(existing.deducted_days ?? existing.days_count ?? 1);
    const totalDays = Number(bal.total_days);
    const usedDays = Number(bal.used_days);
    // If was approved, restore previous deduction before checking
    const effectiveUsed = existing.status === 'approved' ? Math.max(0, usedDays - prevDeducted) : usedDays;
    const remaining = totalDays - effectiveUsed;
    if (deducted > remaining) {
      throw new Error(`잔여 연차가 부족합니다. (신청: ${deducted}일, 잔여: ${remaining.toFixed(1)}일)`);
    }
  }

  // If was approved, restore the leave balance first
  if (existing.status === 'approved') {
    const prevDeducted = Number(existing.deducted_days ?? existing.days_count ?? 1);
    await restoreLeaveOnReject(
      db, id,
      session.id, session.name, session.dept ?? null,
      new Date(existing.start_date as string).getFullYear(),
      prevDeducted,
      { id: session.id, name: `${session.name}(수정)` }
    );
  }

  // Try update with all new columns
  const { error } = await db.from("vacation_requests").update({
    start_date,
    end_date: realEndDate,
    days_count: deducted,
    leave_type,
    hours_count: leave_type === '시간휴가' ? (hours_count ?? null) : null,
    deducted_days: deducted,
    reason: reason ?? null,
    status: 'pending',
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    reject_reason: null,
  }).eq("id", id);

  if (error) {
    // Fallback for old schema without new columns
    if (error.code === '42703' || error.message.includes('column')) {
      const { error: error2 } = await db.from("vacation_requests").update({
        start_date,
        end_date: realEndDate,
        days_count: Math.ceil(deducted),
        reason: reason ?? null,
        status: 'pending',
        approved_by: null,
        approved_by_name: null,
        approved_at: null,
        reject_reason: null,
      }).eq("id", id);
      if (error2) throw new Error(error2.message);
    } else {
      throw new Error(error.message);
    }
  }

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

  // 기존 상태 조회 (복구 처리용) — deducted_days 없는 구 스키마도 호환
  let vac: { requester_id: string; requester_name: string; dept: string | null; start_date: string; days_count: number; deducted_days?: number; status: string } | null = null;

  const { data: vacFull, error: fetchErr } = await db
    .from("vacation_requests")
    .select("requester_id, requester_name, dept, start_date, days_count, deducted_days, status")
    .eq("id", id)
    .single();

  if (fetchErr) {
    // deducted_days 컬럼이 없는 구 스키마일 때 재시도
    if (fetchErr.code === '42703' || fetchErr.message.includes('column')) {
      const { data: vacBasic, error: fetchErr2 } = await db
        .from("vacation_requests")
        .select("requester_id, requester_name, dept, start_date, days_count, status")
        .eq("id", id)
        .single();
      if (fetchErr2 || !vacBasic) throw new Error("신청 건을 찾을 수 없습니다.");
      vac = { ...vacBasic, deducted_days: vacBasic.days_count };
    } else {
      throw new Error("신청 건을 찾을 수 없습니다.");
    }
  } else {
    vac = vacFull;
  }

  if (!vac) throw new Error("신청 건을 찾을 수 없습니다.");

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
  const deductedDays = Number(vac.deducted_days ?? vac.days_count ?? 1);
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
