"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export interface AuditEntry {
  id: string;
  audit_date: string;
  section: string;
  product_name: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  adjustment_reason: string | null;
  adjusted: boolean;
  audited_by: string;
  audited_by_name: string;
  created_at: string;
}

// ── 실사 시작: 현재 frozen_inventory 스냅샷으로 entries 생성 ──
export async function startAudit(
  auditDate: string
): Promise<{ success: boolean; entries?: AuditEntry[]; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager") {
      return { success: false, error: "실사 시작 권한이 없습니다. (팀장 이상)" };
    }

    const db = createServerClient();

    // 이미 해당 날짜 실사가 있는지 확인
    const { data: existing } = await db
      .from("inventory_audits")
      .select("id")
      .eq("audit_date", auditDate)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: `${auditDate} 실사가 이미 진행 중입니다. 기존 실사를 확인해주세요.` };
    }

    // 최신 frozen_inventory 가져오기
    const { data: latestDateRow } = await db
      .from("frozen_inventory")
      .select("inventory_date")
      .order("inventory_date", { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow) {
      return { success: false, error: "재고 데이터가 없습니다. 먼저 재고를 등록해주세요." };
    }

    const { data: inventoryRows } = await db
      .from("frozen_inventory")
      .select("section, product_name, current_stock")
      .eq("inventory_date", latestDateRow.inventory_date)
      .order("section")
      .order("product_name");

    if (!inventoryRows || inventoryRows.length === 0) {
      return { success: false, error: "재고 데이터가 비어있습니다." };
    }

    // 실사 엔트리 생성
    const entries = inventoryRows.map((row) => ({
      audit_date: auditDate,
      section: row.section as string,
      product_name: row.product_name as string,
      system_stock: Number(row.current_stock ?? 0),
      actual_stock: 0,
      adjustment_reason: null,
      adjusted: false,
      audited_by: session.id,
      audited_by_name: session.name,
    }));

    const { data: inserted, error } = await db
      .from("inventory_audits")
      .insert(entries)
      .select("*");

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "create",
      entityType: "inventory_audit",
      entityName: `${auditDate} 실사 시작 (${entries.length}건)`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    revalidatePath("/inventory/audit");

    return {
      success: true,
      entries: (inserted ?? []).map((r) => ({
        id: r.id as string,
        audit_date: r.audit_date as string,
        section: r.section as string,
        product_name: r.product_name as string,
        system_stock: Number(r.system_stock ?? 0),
        actual_stock: Number(r.actual_stock ?? 0),
        difference: Number(r.difference ?? 0),
        adjustment_reason: r.adjustment_reason as string | null,
        adjusted: r.adjusted as boolean,
        audited_by: r.audited_by as string,
        audited_by_name: r.audited_by_name as string,
        created_at: r.created_at as string,
      })),
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 실사 실물 수량 입력 ─────────────────────────────────────
export async function updateAuditActual(
  id: string,
  actualStock: number,
  adjustmentReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };

    const db = createServerClient();
    const { error } = await db
      .from("inventory_audits")
      .update({
        actual_stock: actualStock,
        adjustment_reason: adjustmentReason ?? null,
        audited_by: session.id,
        audited_by_name: session.name,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/inventory/audit");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 실사 확정: frozen_inventory 동기화 ─────────────────────
export async function finalizeAudit(
  auditDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo") {
      return { success: false, error: "실사 확정은 COO만 가능합니다." };
    }

    const db = createServerClient();

    // 해당 날짜 실사 항목 가져오기
    const { data: auditRows, error: fetchErr } = await db
      .from("inventory_audits")
      .select("id, section, product_name, actual_stock")
      .eq("audit_date", auditDate);

    if (fetchErr || !auditRows) {
      return { success: false, error: fetchErr?.message ?? "실사 데이터를 찾을 수 없습니다." };
    }

    // 전부 adjusted = true 로 마킹
    const { error: updateErr } = await db
      .from("inventory_audits")
      .update({ adjusted: true })
      .eq("audit_date", auditDate);

    if (updateErr) return { success: false, error: updateErr.message };

    // frozen_inventory의 current_stock을 실사 actual_stock으로 동기화
    const { data: latestDateRow } = await db
      .from("frozen_inventory")
      .select("inventory_date")
      .order("inventory_date", { ascending: false })
      .limit(1)
      .single();

    if (latestDateRow) {
      for (const row of auditRows) {
        await db
          .from("frozen_inventory")
          .update({ current_stock: row.actual_stock })
          .eq("inventory_date", latestDateRow.inventory_date)
          .eq("section", row.section)
          .eq("product_name", row.product_name);
      }
    }

    await logAudit({
      action: "update",
      entityType: "inventory_audit",
      entityName: `${auditDate} 실사 확정 (${auditRows.length}건)`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    revalidatePath("/inventory/audit");
    revalidatePath("/inventory");
    revalidatePath("/coo");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 실사 이력 조회 ──────────────────────────────────────────
export async function getAuditHistory(
  limit?: number
): Promise<{
  date: string;
  totalItems: number;
  itemsWithDiff: number;
  totalAdjustment: number;
  adjusted: boolean;
}[]> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("inventory_audits")
      .select("audit_date, system_stock, actual_stock, difference, adjusted")
      .order("audit_date", { ascending: false });

    if (error || !data) return [];

    // 날짜별 그룹핑
    const grouped = new Map<string, typeof data>();
    for (const row of data) {
      const d = row.audit_date as string;
      if (!grouped.has(d)) grouped.set(d, []);
      grouped.get(d)!.push(row);
    }

    const result = Array.from(grouped.entries()).map(([date, rows]) => ({
      date,
      totalItems: rows.length,
      itemsWithDiff: rows.filter((r) => Number(r.difference ?? 0) !== 0).length,
      totalAdjustment: rows.reduce((s, r) => s + Math.abs(Number(r.difference ?? 0)), 0),
      adjusted: rows.every((r) => r.adjusted === true),
    }));

    return limit ? result.slice(0, limit) : result;
  } catch {
    return [];
  }
}

// ── 특정 날짜 실사 조회 ─────────────────────────────────────
export async function getAuditByDate(
  date: string
): Promise<AuditEntry[]> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("inventory_audits")
      .select("*")
      .eq("audit_date", date)
      .order("section")
      .order("product_name");

    if (error || !data) return [];

    return data.map((r) => ({
      id: r.id as string,
      audit_date: r.audit_date as string,
      section: r.section as string,
      product_name: r.product_name as string,
      system_stock: Number(r.system_stock ?? 0),
      actual_stock: Number(r.actual_stock ?? 0),
      difference: Number(r.difference ?? 0),
      adjustment_reason: r.adjustment_reason as string | null,
      adjusted: r.adjusted as boolean,
      audited_by: r.audited_by as string,
      audited_by_name: r.audited_by_name as string,
      created_at: r.created_at as string,
    }));
  } catch {
    return [];
  }
}
