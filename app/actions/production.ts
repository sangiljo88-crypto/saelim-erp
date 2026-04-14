"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createLot } from "@/app/actions/lot-tracking";

export async function submitProductionLog(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { error } = await db.from("production_logs").insert({
    work_date:    formData.get("date"),
    worker_id:    session.id,
    worker_name:  session.name,
    dept:         session.dept ?? "",
    product_id:   formData.get("product_id"),
    product_name: formData.get("product_name"),
    input_qty:    Number(formData.get("input_qty"))  || 0,
    output_qty:   Number(formData.get("output_qty")) || 0,
    waste_qty:    Number(formData.get("waste_qty"))  || 0,
    pack_qty:     Number(formData.get("pack_qty"))   || 0,
    issue_note:   formData.get("issue_note") || null,
  });

  if (error) throw new Error(error.message);

  // 생산일지 저장 성공 시 자동으로 LOT 생성
  try {
    await createLot({
      production_date: formData.get("date") as string,
      product_code: (formData.get("product_id") as string) || undefined,
      product_name: formData.get("product_name") as string,
      dept: session.dept ?? undefined,
      output_qty: Number(formData.get("output_qty")) || 0,
      input_qty: Number(formData.get("input_qty")) || 0,
      worker_name: session.name,
      worker_id: session.id,
    });
  } catch {
    // LOT 테이블 미존재 등의 경우 무시 — 생산일지 자체는 이미 저장됨
  }

  return { success: true };
}

export async function submitHygieneCheck(items: Record<string, boolean>, checkDate: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { error } = await db.from("hygiene_checks").insert({
    check_date:  checkDate,
    worker_id:   session.id,
    worker_name: session.name,
    dept:        session.dept ?? "",
    items,
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function submitClaim(formData: FormData, productNames: string[]) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { error } = await db.from("claims").insert({
    claim_date:    formData.get("claim_date"),
    worker_id:     session.id,
    worker_name:   session.name,
    dept:          session.dept ?? "",
    client_name:   formData.get("client_name"),
    product_names: productNames,
    claim_type:    formData.get("claim_type"),
    content:       formData.get("content"),
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

// ── 가공팀 업무지시서 ────────────────────────────────────────
export async function submitWorkOrder(
  items: Array<{ product: string; pkg_unit_g: number; raw_input_kg: number; target_count: number; production_count: number; fat_loss_kg: number }>,
  workers: string,
  workHours: string,
  orderDate: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("work_orders").upsert({
    order_date:  orderDate,
    ordered_by:  session.name,
    dept:        "가공팀",
    work_hours:  workHours,
    workers,
    items,
  }, { onConflict: "order_date,dept" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 두/내장 작업일지 ─────────────────────────────────────────
export async function submitHeadWorkLog(
  workDate: string,
  headReceived: number,
  headWorked: number,
  headItems: object[],
  innardItems: object[],
  notes: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("head_work_logs").upsert({
    work_date:     workDate,
    manager:       session.name,
    head_received: headReceived,
    head_worked:   headWorked,
    head_items:    headItems,
    innard_items:  innardItems,
    notes,
  }, { onConflict: "work_date" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 생산계획 ────────────────────────────────────────────────
export async function submitProductionPlan(
  planDate: string,
  todayPlans: object[],
  nextPlans: object[],
  notes: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const dept = session.dept ?? "생산팀";
  const { error } = await db.from("production_plans").upsert({
    plan_date:    planDate,
    dept,
    manager:      session.name,
    today_plans:  todayPlans,
    next_plans:   nextPlans,
    notes,
  }, { onConflict: "plan_date,dept" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  revalidatePath("/dashboard");
  revalidatePath("/coo");
  return { success: true };
}

// ── 농협 유통 입고 두수 ─────────────────────────────────────
export async function submitLivestockIntake(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("livestock_intake").upsert({
    intake_date:  formData.get("intake_date"),
    nh_ledger:    Number(formData.get("nh_ledger")) || 0,
    nh_actual:    Number(formData.get("nh_actual")) || 0,
    mokwuchon:    Number(formData.get("mokwuchon")) || 0,
    recorded_by:  session.name,
    notes:        formData.get("notes") || null,
  }, { onConflict: "intake_date" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 수도/지하수 사용량 ──────────────────────────────────────
export async function submitWaterUsage(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("water_usage").upsert({
    usage_date:           formData.get("usage_date"),
    water_reading:        Number(formData.get("water_reading")) || 0,
    ground_water_reading: Number(formData.get("ground_water_reading")) || 0,
    recorded_by:          session.name,
    notes:                formData.get("notes") || null,
  }, { onConflict: "usage_date" });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 유틸리티 사용량/비용 등록 ────────────────────────────────
export async function submitUtilityLog(data: {
  log_month: string;
  electricity_kwh: number;
  electricity_cost: number;
  water_tap_ton: number;
  water_tap_cost: number;
  water_ground_ton: number;
  water_ground_cost: number;
  gas_m3: number;
  gas_cost: number;
  memo: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const total_cost = (data.electricity_cost || 0)
    + (data.water_tap_cost || 0)
    + (data.water_ground_cost || 0)
    + (data.gas_cost || 0);
  const { error } = await db.from("utility_logs").upsert({
    ...data,
    total_cost,
    memo:        data.memo || null,
    recorded_by: session.name,
  }, { onConflict: "log_month" });
  if (error) throw new Error(error.message);
  revalidatePath("/utility");
  revalidatePath("/coo");
  return { success: true };
}

// ── 설비 수리 이력 등록 ───────────────────────────────────────
export async function submitMaintenanceLog(data: {
  equipment_name: string;
  dept: string;
  log_date: string;
  log_type: string;
  description: string;
  parts_used: string;
  cost: number;
  technician: string;
  result: string;
  next_check_date: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("maintenance_logs").insert({
    ...data,
    parts_used:      data.parts_used     || null,
    cost:            data.cost           || 0,
    technician:      data.technician     || null,
    next_check_date: data.next_check_date || null,
    recorded_by:     session.name,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
  revalidatePath("/coo");
  return { success: true };
}
