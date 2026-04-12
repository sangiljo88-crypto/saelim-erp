"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

// ── 팀장 주간 보고 제출 ─────────────────────────────────────
export async function submitDeptReport(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== "manager") return { error: "팀장 권한 필요" };

  const db = createServerClient();
  const dept = session.dept ?? "";

  const payload = {
    report_date:  formData.get("report_date") as string,
    dept,
    manager_id:   session.id,
    manager_name: session.name,
    rag_status:   formData.get("rag_status") as string,
    issue:        formData.get("issue") as string,
    detail:       (formData.get("detail") as string) || null,
    next_action:  (formData.get("next_action") as string) || null,
    status:       "submitted",
  };

  const { error } = await db
    .from("dept_reports")
    .upsert(payload, { onConflict: "report_date,dept" });

  if (error) return { error: error.message };
  revalidatePath("/team");
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

// ── 컨테이너 재고 ────────────────────────────────────────────
export async function submitContainerInventory(
  inventoryDate: string,
  rows: Array<{ location: string; product_name: string; unit: string; prev_stock: number; incoming_qty: number; outgoing_qty: number; notes: string }>
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const inserts = rows.map((r) => ({ ...r, inventory_date: inventoryDate, recorded_by: session.name }));
  const { error } = await db.from("container_inventory").insert(inserts);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 품질 순찰일지 ────────────────────────────────────────────
export async function submitQualityPatrol(
  patrolDate: string,
  patrolTime: string,
  areas: string[],
  issues: Array<{ area: string; description: string; severity: string; action: string }>,
  overallStatus: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("quality_patrol").insert({
    patrol_date:    patrolDate,
    patrol_time:    patrolTime,
    inspector:      session.name,
    dept:           session.dept ?? "품질팀",
    areas,
    issues,
    overall_status: overallStatus,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 오딧 체크리스트 ─────────────────────────────────────────
export async function submitAuditChecklist(
  checkDate: string,
  auditType: string,
  items: Array<{ category: string; item: string; result: string; notes: string }>,
  overallResult: string,
  nextAction: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("audit_checklist").insert({
    check_date:     checkDate,
    audit_type:     auditType,
    inspector:      session.name,
    items,
    overall_result: overallResult,
    next_action:    nextAction,
  });
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

// ── COO 비용 승인/반려 ────────────────────────────────────────
export async function saveCostApproval(itemId: string, status: "approved" | "rejected", comment: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const { error } = await db
    .from("cost_approvals")
    .update({
      status,
      comment:     comment || null,
      approved_by: session.name,
      approved_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/coo");
  return { success: true };
}

// ── 클레임 상태 변경 (COO + 관련 팀장) ──────────────────────
const CLAIM_ALLOWED_DEPTS = new Set(["CS팀", "품질팀", "배송팀"]);

export async function updateClaimStatus(
  claimId: string,
  status: "pending" | "in_progress" | "resolved"
) {
  const session = await getSession();
  if (!session) return { error: "로그인 필요" };

  const isCoo     = session.role === "coo";
  const isManager = session.role === "manager" && CLAIM_ALLOWED_DEPTS.has(session.dept ?? "");
  if (!isCoo && !isManager) return { error: "권한 없음 (COO 또는 CS·품질·배송팀장)" };

  const db = createServerClient();
  const { error } = await db
    .from("claims")
    .update({ status })
    .eq("id", claimId);

  if (error) return { error: error.message };
  revalidatePath("/claims");
  revalidatePath("/coo");
  revalidatePath("/team");
  return { success: true };
}

// ── 거래처 저장 ────────────────────────────────────────────────
export async function saveCustomer(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const productsRaw = (formData.get("products") as string) || "";
  const products = productsRaw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const { error } = await db.from("customers").insert({
    name:          formData.get("name") as string,
    type:          (formData.get("type") as string) || "식당",
    contact_name:  (formData.get("contact_name") as string) || null,
    phone:         (formData.get("phone") as string) || null,
    address:       (formData.get("address") as string) || null,
    tax_id:        (formData.get("tax_id") as string) || null,
    credit_limit:  Number(formData.get("credit_limit")) || 0,
    payment_terms: Number(formData.get("payment_terms")) || 30,
    products:      products.length > 0 ? products : null,
    monthly_avg:   Number(formData.get("monthly_avg")) || 0,
    memo:          (formData.get("memo") as string) || null,
    active:        true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 납품전표 제출 ────────────────────────────────────────────
export async function submitDelivery(
  formData: FormData,
  items: Array<{ product: string; qty_kg: number; unit_price: number; amount: number }>
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  const db = createServerClient();

  const customerName = formData.get("customer_name") as string;
  const customerId   = (formData.get("customer_id") as string) || null;

  const { error } = await db.from("deliveries").insert({
    delivery_date: formData.get("delivery_date"),
    customer_name: customerName,
    customer_id:   customerId || undefined,
    dept:          session.dept ?? "배송팀",
    items,
    total_amount:  totalAmount,
    status:        "shipped",
    driver:        (formData.get("driver") as string) || null,
    notes:         (formData.get("notes") as string) || null,
  });

  if (error) {
    // deliveries 테이블 미생성 안내
    const msg = error.message.includes("does not exist")
      ? "deliveries 테이블이 없습니다. Supabase에서 schema_v4.sql을 실행해주세요."
      : error.message;
    return { success: false, error: msg };
  }

  try { revalidatePath("/team"); } catch {}
  return { success: true };
}

// ── COO 코멘트 저장 ──────────────────────────────────────────
export async function saveCooComment(reportId: string, comment: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const { error } = await db
    .from("dept_reports")
    .update({
      coo_comment:    comment,
      coo_id:         session.id,
      coo_updated_at: new Date().toISOString(),
      status:         "reviewed",
    })
    .eq("id", reportId);

  if (error) return { error: error.message };
  revalidatePath("/coo");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── hljs 코드블록 span 태그 제거 ────────────────────────────────
// Claude/Genspark 등 AI 코드하이라이터가 감싼 <span class="hljs-*"> 제거
function stripHljsSpans(html: string): string {
  // hljs span을 내용만 남기고 제거 (중첩 처리 위해 반복)
  // 일반 </span>은 건드리지 않음
  let result = html;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result
      .replace(/<span\s+class="hljs-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1")
      .replace(/<span\s+class="language-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1");
  }
  // <code> 블록 안에 남은 불필요한 줄바꿈 정리
  return result.replace(/<code[^>]*>\s*\n/g, (m) => m.trimEnd());
}

// ── 브리핑 등록 (COO 전용) ────────────────────────────────────
export async function submitBriefing(data: {
  week_label: string;
  publish_date: string;
  category: string;
  title: string;
  content_html: string;
  author: string;
  is_pinned: boolean;
}) {
  const session = await getSession();
  if (!session || session.role !== "coo") throw new Error("COO 권한 필요");
  const db = createServerClient();
  const cleaned = { ...data, content_html: stripHljsSpans(data.content_html) };
  const { data: inserted, error } = await db.from("briefings").insert(cleaned).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/briefings");
  revalidatePath("/coo");
  return { success: true, id: inserted?.id };
}

// ── 브리핑 수정 (COO 전용) ────────────────────────────────────
export async function updateBriefing(id: string, data: {
  week_label: string;
  publish_date: string;
  category: string;
  title: string;
  content_html: string;
  author: string;
  is_pinned: boolean;
}) {
  const session = await getSession();
  if (!session || session.role !== "coo") throw new Error("COO 권한 필요");
  const db = createServerClient();
  const cleaned = { ...data, content_html: stripHljsSpans(data.content_html) };
  const { error } = await db.from("briefings").update(cleaned).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/briefings");
  revalidatePath(`/briefings/${id}`);
  return { success: true };
}

// ── 브리핑 삭제 (COO 전용) ────────────────────────────────────
export async function deleteBriefing(id: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  const db = createServerClient();
  const { error } = await db.from("briefings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/briefings");
  return { success: true };
}

// ── 브리핑 핀 토글 (COO 전용) ────────────────────────────────
export async function toggleBriefingPin(id: string, is_pinned: boolean) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  const db = createServerClient();
  const { error } = await db.from("briefings").update({ is_pinned }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/briefings");
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

// ── 냉동 재고 단건 수정 (COO 현장 수정) ────────────────────────
export async function updateFrozenInventoryRow(
  id: string,
  updates: { prev_stock: number; usage_qty: number; incoming_qty: number; outgoing_qty: number; current_stock: number }
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const roleLabel: Record<string, string> = {
    coo: "COO", ceo: "대표", manager: "팀장", worker: "직원",
  };
  const modified_by = `${session.name} (${roleLabel[session.role] ?? session.role})`;
  const { error } = await db.from("frozen_inventory").update({ ...updates, modified_by }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inventory");
  revalidatePath("/coo");
  return { success: true };
}

// ── 클레임 상세(생산일·원인) 저장 ────────────────────────────
export async function updateClaimDetails(
  id: string,
  productionDate: string | null,
  rootCause: string | null
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db
    .from("claims")
    .update({ production_date: productionDate || null, root_cause: rootCause || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/claims");
  revalidatePath("/coo");
  return { success: true };
}

// ── 클레임 역추적: 생산일 기준 production_logs + hygiene_checks ─
export async function fetchClaimTraceability(productionDate: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();

  const [{ data: prodLogs }, { data: hygieneChecks }] = await Promise.all([
    db.from("production_logs")
      .select("id, work_date, worker_name, dept, product_name, input_qty, output_qty, waste_qty, issue_note")
      .eq("work_date", productionDate)
      .order("dept"),
    db.from("hygiene_checks")
      .select("id, check_date, worker_name, dept, items")
      .eq("check_date", productionDate),
  ]);

  return {
    prodLogs: (prodLogs ?? []) as Array<{
      id: string; work_date: string; worker_name: string; dept: string;
      product_name: string; input_qty: number; output_qty: number;
      waste_qty: number; issue_note: string | null;
    }>,
    hygieneChecks: (hygieneChecks ?? []) as Array<{
      id: string; check_date: string; worker_name: string; dept: string;
      items: Record<string, boolean>;
    }>,
  };
}

// ── 냉동·냉장·컨테이너 재고 ──────────────────────────────────
export async function saveFrozenInventory(
  inventoryDate: string,
  items: {
    section: string; side: string; product_name: string; unit: string;
    prev_stock: number; usage_qty: number; incoming_qty: number;
    outgoing_qty: number; current_stock: number;
  }[]
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const rows = items.map((item) => ({ inventory_date: inventoryDate, ...item }));
  const { error } = await db.from("frozen_inventory").upsert(rows, {
    onConflict: "inventory_date,section,product_name",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  revalidatePath("/inventory");
  revalidatePath("/coo");
  return { success: true };
}
