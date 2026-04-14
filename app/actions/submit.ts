"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { ROLE_LABEL } from "@/lib/constants";

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

  await logAudit({
    action: "update",
    entityType: "cost_approval",
    entityId: itemId,
    changes: { status: { before: "pending", after: status } },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

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

  // 금액 음수 검증
  const hasNegative = items.some((it) => it.qty_kg < 0 || it.unit_price < 0 || it.amount < 0);
  if (hasNegative) return { success: false, error: "수량·단가·금액은 0 이상이어야 합니다." };

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
    const msg = error.message.includes("does not exist")
      ? "deliveries 테이블이 없습니다. Supabase에서 schema_v4.sql을 실행해주세요."
      : error.message;
    return { success: false, error: msg };
  }

  // ── CEO 매출 KPI 자동 동기화 ──────────────────────────────
  // 납품전표 저장 즉시 해당 월의 monthly_kpi(revenue) 재집계
  try {
    const deliveryDate = (formData.get("delivery_date") as string) ?? new Date().toISOString().split("T")[0];
    const yearMonth = deliveryDate.slice(0, 7);
    const nextYM = (() => {
      const [y, m] = yearMonth.split("-").map(Number);
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    })();

    const { data: monthRows } = await db
      .from("deliveries")
      .select("total_amount")
      .gte("delivery_date", `${yearMonth}-01`)
      .lt("delivery_date", `${nextYM}-01`);

    const monthRevenue = (monthRows ?? []).reduce((s, d) => s + (d.total_amount || 0), 0);

    await db.from("monthly_kpi").upsert(
      {
        year_month: yearMonth,
        dept:       "전사",
        kpi_key:    "revenue",
        actual:     monthRevenue,
        target:     1_500_000_000, // 월 목표 15억 (연 180억 기준)
      },
      { onConflict: "year_month,dept,kpi_key" }
    );
  } catch {
    // KPI 동기화 실패는 납품 저장 결과에 영향 주지 않음
  }

  try { revalidatePath("/team"); revalidatePath("/dashboard"); } catch {}
  return { success: true };
}

// ── 회계팀 월간 KPI 저장 (→ CEO 대시보드 자동 반영) ─────────
export async function saveMonthlyKpi(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "manager" || session.dept !== "회계팀") {
    return { error: "회계팀 팀장 권한 필요" };
  }

  const db        = createServerClient();
  const yearMonth = formData.get("year_month") as string;

  const rows = [
    { kpi_key: "profit_margin", actual: Number(formData.get("profit_margin")) || 0, target: 10 },
    { kpi_key: "cash_balance",  actual: Math.round(Number(formData.get("cash_balance")) * 100_000_000), target: 1_000_000_000 },
    { kpi_key: "receivables",   actual: Math.round(Number(formData.get("receivables"))  * 100_000_000), target: 200_000_000  },
  ].map((r) => ({
    year_month: yearMonth,
    dept:       "전사",
    kpi_key:    r.kpi_key,
    actual:     r.actual,
    target:     r.target,
  }));

  const { error } = await db
    .from("monthly_kpi")
    .upsert(rows, { onConflict: "year_month,dept,kpi_key" });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/team");
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
  const canEdit = session.role === "coo" || session.role === "ceo" || session.role === "manager";
  if (!canEdit) throw new Error("재고 수정 권한이 없습니다. (팀장 이상)");
  const db = createServerClient();
  const modified_by = `${session.name} (${ROLE_LABEL[session.role] ?? session.role})`;
  const { error } = await db.from("frozen_inventory").update({ ...updates, modified_by }).eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    action: "update",
    entityType: "frozen_inventory",
    entityId: id,
    changes: {
      prev_stock: { before: null, after: updates.prev_stock },
      current_stock: { before: null, after: updates.current_stock },
    },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

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
  const canEdit = session.role === "coo" || session.role === "ceo" || session.role === "manager";
  if (!canEdit) throw new Error("재고 저장 권한이 없습니다. (팀장 이상)");
  const db = createServerClient();
  const rows = items.map((item) => ({ inventory_date: inventoryDate, ...item }));
  const { error } = await db.from("frozen_inventory").upsert(rows, {
    onConflict: "inventory_date,section,product_name",
  });
  if (error) throw new Error(error.message);

  await logAudit({
    action: "create",
    entityType: "frozen_inventory",
    entityName: `${items.length}건 재고 저장`,
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

  revalidatePath("/team");
  revalidatePath("/inventory");
  revalidatePath("/coo");
  return { success: true };
}

// ── 비용 승인 요청 등록 (팀장 이상) ─────────────────────────
export async function submitCostApprovalRequest(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "manager" && session.role !== "coo")) {
    return { error: "팀장 이상 권한 필요" };
  }

  const amount = Number(formData.get("amount")) || 0;
  if (amount < 0) return { error: "금액은 0 이상이어야 합니다." };

  const db = createServerClient();
  const { error } = await db.from("cost_approvals").insert({
    title:        formData.get("title") as string,
    dept:         session.dept ?? session.role,
    requested_by: session.name,
    request_date: (formData.get("request_date") as string) || new Date().toISOString().split("T")[0],
    amount,
    status:       "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/approvals");
  revalidatePath("/coo");
  return { success: true };
}

// ── 비용 승인/반려 (COO + CEO) ────────────────────────────────
export async function approveCostRequest(itemId: string, status: "approved" | "rejected", comment: string) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) return { error: "COO/CEO 권한 필요" };

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
  revalidatePath("/approvals");
  revalidatePath("/coo");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── 직원 등록 (COO 전용) ─────────────────────────────────────────
export async function createStaffMember(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const { hashPassword } = await import("@/lib/hash");
  const db = createServerClient();

  const login_id = (formData.get("login_id") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const name     = (formData.get("name") as string)?.trim();
  const role     = formData.get("role") as string;
  const dept     = (formData.get("dept") as string)?.trim() || null;

  if (!login_id || !password || !name || !role) return { error: "필수 항목 누락" };

  const { error } = await db.from("members").insert({
    login_id,
    password: hashPassword(password),
    name,
    role,
    dept,
    active: true,
  });

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { error: `아이디 '${login_id}'가 이미 존재합니다` };
    }
    return { error: error.message };
  }
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 활성/비활성 토글 (COO 전용) ────────────────────────
export async function toggleMemberActive(memberId: string, active: boolean) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const { error } = await db
    .from("members")
    .update({ active })
    .eq("id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 비밀번호 변경 (COO 전용) ───────────────────────────
export async function resetMemberPassword(memberId: string, newPassword: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  if (!newPassword || newPassword.length < 4) return { error: "비밀번호는 4자 이상" };

  const { hashPassword } = await import("@/lib/hash");
  const db = createServerClient();
  const { error } = await db
    .from("members")
    .update({ password: hashPassword(newPassword) })
    .eq("id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 기본급 저장 (COO 전용) ──────────────────────────────
export async function saveStaffSalary(
  loginId: string,
  name: string,
  dept: string | null,
  baseSalary: number
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  if (baseSalary < 0) return { error: "기본급은 0 이상이어야 합니다." };

  const db = createServerClient();
  const { error } = await db.from("staff_salaries").upsert(
    {
      login_id:    loginId,
      name,
      dept,
      base_salary: baseSalary,
      updated_by:  session.name,
      updated_at:  new Date().toISOString(),
    },
    { onConflict: "login_id" }
  );

  if (error) return { error: error.message };

  await logAudit({
    action: "update",
    entityType: "staff_salary",
    entityName: name,
    changes: {
      base_salary: { before: null, after: baseSalary },
    },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

  revalidatePath("/staff");
  revalidatePath("/payroll");
  return { success: true };
}

// ── 월별 급여 일괄 저장 (COO 전용) → monthly_kpi 자동 반영 ─
export async function savePayrollMonth(
  yearMonth: string,
  records: Array<{
    login_id: string;
    employee_name: string;
    dept: string | null;
    base_salary: number;
    overtime_pay: number;
    bonus: number;
    deduction: number;
    total_pay: number;
    notes: string;
  }>
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();

  // 금액 음수 검증
  const hasNeg = records.some((r) => r.base_salary < 0 || r.total_pay < 0);
  if (hasNeg) return { error: "급여 금액은 0 이상이어야 합니다." };

  // 급여 기록 일괄 upsert
  const rows = records.map((r) => ({
    ...r,
    year_month:  yearMonth,
    recorded_by: session.name,
  }));

  const { error } = await db
    .from("payroll_records")
    .upsert(rows, { onConflict: "year_month,login_id" });

  if (error) return { error: error.message };

  // monthly_kpi 인건비 자동 동기화
  const totalLaborCost = records.reduce((s, r) => s + r.total_pay, 0);
  await db.from("monthly_kpi").upsert(
    {
      year_month: yearMonth,
      dept:       "전사",
      kpi_key:    "labor_cost",
      actual:     totalLaborCost,
      target:     0,  // 목표는 별도 관리
    },
    { onConflict: "year_month,dept,kpi_key" }
  );

  revalidatePath("/payroll");
  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── 기본급 일괄 갱신 (payroll 입력 전 staff_salaries 동기화) ─
export async function bulkUpdateBaseSalaries(
  updates: Array<{ login_id: string; name: string; dept: string | null; base_salary: number }>
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const rows = updates.map((u) => ({
    ...u,
    updated_by: session.name,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from("staff_salaries")
    .upsert(rows, { onConflict: "login_id" });

  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/payroll");
  return { success: true };
}

// ── 원재료 매입 입고 기록 (COO/manager) ──────────────────────
export async function recordMaterialPurchase(data: {
  purchase_date:   string;
  material_name:   string;
  product_code:    string | null;
  supplier:        string;
  quantity:        number;
  unit:            string;
  unit_price:      number;
  invoice_no:      string;
  notes:           string;
  storage_section?: string;   // 입고 창고 (재고 자동 반영용)
}) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "manager")) {
    return { error: "COO/팀장 권한 필요" };
  }

  if (data.quantity < 0) return { error: "수량은 0 이상이어야 합니다." };
  if (data.unit_price < 0) return { error: "단가는 0 이상이어야 합니다." };

  const db         = createServerClient();
  const total_cost = Math.round(data.quantity * data.unit_price);

  const { storage_section, ...insertData } = data;
  const { error } = await db.from("material_purchases").insert({
    ...insertData,
    total_cost,
    remaining_qty: data.quantity,   // 최초 입고 시 잔여 = 전체
    recorded_by:   session.name,
  });

  if (error) return { error: error.message };

  await logAudit({
    action: "create",
    entityType: "material_purchase",
    entityName: data.material_name,
    changes: {
      quantity: { before: null, after: data.quantity },
      unit_price: { before: null, after: data.unit_price },
      total_cost: { before: null, after: total_cost },
    },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

  // products.purchase_price 최신 단가로 자동 업데이트 (있는 경우)
  if (data.product_code) {
    await db
      .from("products")
      .update({ purchase_price: data.unit_price, updated_at: new Date().toISOString() })
      .eq("code", data.product_code);
  }

  // 재고 자동 반영 (입고 창고 선택 시 frozen_inventory.incoming_qty 업데이트)
  if (storage_section) {
    const { data: existing } = await db
      .from("frozen_inventory")
      .select("id, incoming_qty, prev_stock, usage_qty, outgoing_qty")
      .eq("inventory_date", data.purchase_date)
      .eq("section", storage_section)
      .eq("product_name", data.material_name)
      .maybeSingle();

    if (existing) {
      const newIncoming = (existing.incoming_qty || 0) + data.quantity;
      await db.from("frozen_inventory").update({
        incoming_qty:  newIncoming,
        current_stock: (existing.prev_stock || 0) + newIncoming - (existing.usage_qty || 0) - (existing.outgoing_qty || 0),
      }).eq("id", existing.id);
    } else {
      await db.from("frozen_inventory").insert({
        inventory_date: data.purchase_date,
        section:        storage_section,
        side:           "raw",
        product_name:   data.material_name,
        unit:           data.unit,
        incoming_qty:   data.quantity,
        current_stock:  data.quantity,
      });
    }
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  return { success: true };
}

// ── 매입 배치 잔여수량 수정 (COO 전용) ───────────────────────
export async function updatePurchaseRemaining(id: string, remaining_qty: number) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  if (remaining_qty < 0) return { error: "잔여수량은 0 이상" };

  const db = createServerClient();
  const { error } = await db
    .from("material_purchases")
    .update({ remaining_qty })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/purchases");
  return { success: true };
}

// ── 회계: 매입 결제 등록 ─────────────────────────────────────
export async function recordPurchasePayment(data: {
  purchase_id?:   string;
  payment_date:   string;
  supplier:       string;
  amount:         number;
  supply_amount:  number;
  vat_amount:     number;
  payment_method: string;
  bank_account:   string;
  is_tax_invoice: boolean;
  tax_invoice_no: string;
  memo:           string;
}) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    return { error: "COO/CEO 권한 필요" };
  }
  if (data.amount < 0) return { error: "결제 금액은 0 이상이어야 합니다." };

  const db = createServerClient();

  // 1. purchase_payments 저장
  const { error } = await db.from("purchase_payments").insert({
    ...data,
    recorded_by: session.name,
  });
  if (error) return { error: error.message };

  // 2. cash_flow_ledger에도 자동 기록 (매입결제 outflow)
  await db.from("cash_flow_ledger").insert({
    transaction_date: data.payment_date,
    flow_type:        "outflow",
    category:         "매입결제",
    amount:           data.amount,
    supply_amount:    data.supply_amount,
    vat_amount:       data.vat_amount,
    counterparty:     data.supplier,
    payment_method:   data.payment_method,
    description:      data.memo || `${data.supplier} 매입결제`,
    is_vat_deductible: data.is_tax_invoice,
    ref_type:         data.purchase_id ? "material_purchase" : null,
    ref_id:           data.purchase_id || null,
    recorded_by:      session.name,
  });

  await logAudit({
    action: "create",
    entityType: "purchase_payment",
    entityName: data.supplier,
    changes: {
      amount: { before: null, after: data.amount },
      payment_method: { before: null, after: data.payment_method },
    },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

  revalidatePath("/accounting");
  return { success: true };
}

// ── 회계: 현금흐름 항목 등록 (일반) ──────────────────────────
export async function recordCashFlow(data: {
  transaction_date:  string;
  flow_type:         "inflow" | "outflow";
  category:          string;
  amount:            number;
  supply_amount:     number;
  vat_amount:        number;
  counterparty:      string;
  payment_method:    string;
  description:       string;
  is_vat_deductible: boolean;
}) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    return { error: "COO/CEO 권한 필요" };
  }
  if (data.amount < 0) return { error: "금액은 0 이상이어야 합니다." };

  const db = createServerClient();
  const { error } = await db.from("cash_flow_ledger").insert({
    ...data,
    recorded_by: session.name,
  });
  if (error) return { error: error.message };
  revalidatePath("/accounting");
  return { success: true };
}
