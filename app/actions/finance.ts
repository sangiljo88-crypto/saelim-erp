"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

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
