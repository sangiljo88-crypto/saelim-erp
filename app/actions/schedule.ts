"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  days_count?: number;
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
  // 생성된 이벤트 전체를 반환 → 클라이언트 즉시 반영
  return { success: true, event: created };
}

export async function updateScheduleEvent(id: string, data: UpdateScheduleEventData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();

  // 권한 확인: 작성자이거나 coo/ceo만 수정 가능
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

  // 권한 확인
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

  const db = createServerClient();
  const { error } = await db.from("vacation_requests").insert({
    requester_id: session.id,
    requester_name: session.name,
    dept: session.dept ?? null,
    start_date: data.start_date,
    end_date: data.end_date,
    days_count: data.days_count ?? 1,
    reason: data.reason ?? null,
    status: "pending",
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

  // 권한: coo, ceo, 또는 manager+회계팀
  const canApprove =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀");

  if (!canApprove) throw new Error("승인 권한이 없습니다.");

  const db = createServerClient();
  const { error } = await db
    .from("vacation_requests")
    .update({
      status,
      approved_by: session.id,
      approved_by_name: session.name,
      approved_at: new Date().toISOString(),
      reject_reason: status === "rejected" ? (reason ?? null) : null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/schedule");
  return { success: true };
}
