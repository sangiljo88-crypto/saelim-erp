"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

// ── 타입 ─────────────────────────────────────────────────────
export interface MaintenanceSchedule {
  id: string;
  equipment_name: string;
  equipment_location: string | null;
  task_description: string;
  frequency: string;
  last_performed: string | null;
  next_due: string;
  assigned_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SparePart {
  id: string;
  part_name: string;
  part_code: string | null;
  equipment_name: string | null;
  category: string;
  current_stock: number;
  min_stock: number;
  unit: string;
  unit_price: number;
  supplier: string | null;
  last_replaced: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ── 권한 체크 ────────────────────────────────────────────────
function canManage(role: string) {
  return role === "coo" || role === "ceo" || role === "manager";
}

// ── 다음 정비일 계산 ─────────────────────────────────────────
function calculateNextDue(fromDate: Date, frequency: string): string {
  const d = new Date(fromDate);
  switch (frequency) {
    case "daily":     d.setDate(d.getDate() + 1); break;
    case "weekly":    d.setDate(d.getDate() + 7); break;
    case "biweekly":  d.setDate(d.getDate() + 14); break;
    case "monthly":   d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setDate(d.getDate() + 7); break;
  }
  return d.toISOString().split("T")[0];
}

// ── 스케줄 조회 ──────────────────────────────────────────────
export async function getMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("maintenance_schedules")
      .select("*")
      .eq("is_active", true)
      .order("next_due", { ascending: true });

    if (error || !data) return [];
    return data as MaintenanceSchedule[];
  } catch {
    return [];
  }
}

// ── 스케줄 생성/수정 (COO/manager) ──────────────────────────
export async function upsertMaintenanceSchedule(
  input: {
    id?: string;
    equipment_name: string;
    equipment_location?: string;
    task_description: string;
    frequency: string;
    next_due: string;
    assigned_to?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (!canManage(session.role)) return { success: false, error: "권한이 없습니다. (팀장 이상)" };

    const db = createServerClient();
    const payload = {
      equipment_name: input.equipment_name,
      equipment_location: input.equipment_location ?? null,
      task_description: input.task_description,
      frequency: input.frequency,
      next_due: input.next_due,
      assigned_to: input.assigned_to ?? null,
      notes: input.notes ?? null,
      created_by: session.name,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await db
        .from("maintenance_schedules")
        .update(payload)
        .eq("id", input.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await db
        .from("maintenance_schedules")
        .insert(payload);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 정비 완료 (인증된 사용자) ────────────────────────────────
export async function completeMaintenanceTask(
  scheduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };

    const db = createServerClient();

    // 현재 스케줄 조회
    const { data: schedule, error: fetchErr } = await db
      .from("maintenance_schedules")
      .select("frequency")
      .eq("id", scheduleId)
      .single();

    if (fetchErr || !schedule) return { success: false, error: "스케줄을 찾을 수 없습니다" };

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const nextDue = calculateNextDue(today, schedule.frequency);

    const { error } = await db
      .from("maintenance_schedules")
      .update({
        last_performed: todayStr,
        next_due: nextDue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 지연된 스케줄 조회 ──────────────────────────────────────
export async function getOverdueSchedules(): Promise<MaintenanceSchedule[]> {
  try {
    const db = createServerClient();
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await db
      .from("maintenance_schedules")
      .select("*")
      .eq("is_active", true)
      .lt("next_due", today)
      .order("next_due", { ascending: true });

    if (error || !data) return [];
    return data as MaintenanceSchedule[];
  } catch {
    return [];
  }
}

// ── 부품 조회 ───────────────────────────────────────────────
export async function getSpareParts(): Promise<SparePart[]> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("spare_parts")
      .select("*")
      .order("part_name");

    if (error || !data) return [];
    return data as SparePart[];
  } catch {
    return [];
  }
}

// ── 부품 생성/수정 (COO/manager) ────────────────────────────
export async function upsertSparePart(
  input: {
    id?: string;
    part_name: string;
    part_code?: string;
    equipment_name?: string;
    category?: string;
    current_stock: number;
    min_stock: number;
    unit?: string;
    unit_price?: number;
    supplier?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (!canManage(session.role)) return { success: false, error: "권한이 없습니다. (팀장 이상)" };

    const db = createServerClient();
    const payload = {
      part_name: input.part_name,
      part_code: input.part_code ?? null,
      equipment_name: input.equipment_name ?? null,
      category: input.category ?? "소모품",
      current_stock: input.current_stock,
      min_stock: input.min_stock,
      unit: input.unit ?? "개",
      unit_price: input.unit_price ?? 0,
      supplier: input.supplier ?? null,
      notes: input.notes ?? null,
      updated_by: session.name,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await db.from("spare_parts").update(payload).eq("id", input.id);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await db.from("spare_parts").insert(payload);
      if (error) return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 부품 재고 조정 ─────────────────────────────────────────
export async function adjustSparePartStock(
  partId: string,
  delta: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };

    const db = createServerClient();

    // 현재 재고 조회
    const { data: part, error: fetchErr } = await db
      .from("spare_parts")
      .select("current_stock, notes")
      .eq("id", partId)
      .single();

    if (fetchErr || !part) return { success: false, error: "부품을 찾을 수 없습니다" };

    const newStock = part.current_stock + delta;
    if (newStock < 0) return { success: false, error: "재고가 부족합니다" };

    const logNote = `[${new Date().toISOString().split("T")[0]} ${session.name}] ${delta > 0 ? "입고" : "출고"} ${Math.abs(delta)}개: ${reason}`;
    const updatedNotes = part.notes ? `${part.notes}\n${logNote}` : logNote;

    const { error } = await db
      .from("spare_parts")
      .update({
        current_stock: newStock,
        notes: updatedNotes,
        updated_by: session.name,
        updated_at: new Date().toISOString(),
        ...(delta < 0 ? { last_replaced: new Date().toISOString().split("T")[0] } : {}),
      })
      .eq("id", partId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
