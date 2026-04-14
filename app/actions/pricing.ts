"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export interface CustomerProductPrice {
  id: string;
  customer_id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  unit_price: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

// ── 거래처별 단가 목록 조회 ─────────────────────────────────
export async function getCustomerPrices(
  customerId?: string
): Promise<CustomerProductPrice[]> {
  try {
    const db = createServerClient();
    let query = db
      .from("customer_product_prices")
      .select("*")
      .order("customer_name")
      .order("product_name")
      .order("effective_from", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      customer_id: row.customer_id as string,
      customer_name: row.customer_name as string,
      product_code: row.product_code as string,
      product_name: row.product_name as string,
      unit_price: Number(row.unit_price ?? 0),
      effective_from: row.effective_from as string,
      effective_to: row.effective_to as string | null,
      notes: row.notes as string | null,
      updated_by: row.updated_by as string | null,
      updated_at: row.updated_at as string,
    }));
  } catch {
    return [];
  }
}

// ── 거래처 단가 등록/수정 ──────────────────────────────────
export async function upsertCustomerPrice(
  customerId: string,
  customerName: string,
  productCode: string,
  productName: string,
  unitPrice: number,
  effectiveFrom: string,
  effectiveTo?: string | null,
  notes?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager") {
      return { success: false, error: "단가 수정 권한이 없습니다. (팀장 이상)" };
    }

    const db = createServerClient();
    const updatedBy = `${session.name} (${session.role})`;

    const { error } = await db
      .from("customer_product_prices")
      .upsert(
        {
          customer_id: customerId,
          customer_name: customerName,
          product_code: productCode,
          product_name: productName,
          unit_price: unitPrice,
          effective_from: effectiveFrom,
          effective_to: effectiveTo ?? null,
          notes: notes ?? null,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id,product_code,effective_from" }
      );

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "update",
      entityType: "customer_product_price",
      entityName: `${customerName} - ${productName}`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    revalidatePath("/settings/pricing");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 거래처 단가 삭제 ───────────────────────────────────────
export async function deleteCustomerPrice(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo") {
      return { success: false, error: "단가 삭제는 COO만 가능합니다." };
    }

    const db = createServerClient();
    const { error } = await db
      .from("customer_product_prices")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "delete",
      entityType: "customer_product_price",
      entityId: id,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    revalidatePath("/settings/pricing");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 특정 거래처+품목의 유효 단가 조회 ─────────────────────
export async function getProductPriceForCustomer(
  customerId: string,
  productCode: string,
  date?: string
): Promise<number | null> {
  try {
    const db = createServerClient();
    const targetDate = date || new Date().toISOString().split("T")[0];

    const { data, error } = await db
      .from("customer_product_prices")
      .select("unit_price")
      .eq("customer_id", customerId)
      .eq("product_code", productCode)
      .lte("effective_from", targetDate)
      .or(`effective_to.is.null,effective_to.gte.${targetDate}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return Number(data.unit_price);
  } catch {
    return null;
  }
}

// ── 거래처의 전체 품목 단가 맵 (납품전표 연동용) ──────────
export async function getCustomerPriceMap(
  customerId: string
): Promise<Record<string, number>> {
  try {
    const db = createServerClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await db
      .from("customer_product_prices")
      .select("product_name, unit_price, effective_from")
      .eq("customer_id", customerId)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false });

    if (error || !data) return {};

    // 품목명별 가장 최근 유효 단가만 유지
    const map: Record<string, number> = {};
    for (const row of data) {
      const name = row.product_name as string;
      if (!(name in map)) {
        map[name] = Number(row.unit_price);
      }
    }
    return map;
  } catch {
    return {};
  }
}
