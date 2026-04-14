"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// ── 유통기한 임박 재고 조회 ──────────────────────────────────
export async function getExpiryAlerts(daysAhead = 30) {
  const db = createServerClient();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await db
    .from("frozen_inventory")
    .select("id, inventory_date, section, side, product_name, unit, current_stock, expiry_date, production_date")
    .not("expiry_date", "is", null)
    .lte("expiry_date", futureDate.toISOString().split("T")[0])
    .gte("expiry_date", today.toISOString().split("T")[0])
    .gt("current_stock", 0)
    .order("expiry_date", { ascending: true });

  if (error) {
    console.warn("[getExpiryAlerts]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const expiryDate = new Date(row.expiry_date as string);
    const diffMs = expiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      id: row.id as string,
      product_name: row.product_name as string,
      section: row.section as string,
      side: row.side as string,
      unit: row.unit as string,
      current_stock: row.current_stock as number,
      expiry_date: row.expiry_date as string,
      production_date: row.production_date as string | null,
      days_left: daysLeft,
    };
  });
}

// ── 유통기한 마스터 전체 조회 ────────────────────────────────
export async function getShelfLifeSettings() {
  const db = createServerClient();
  const { data, error } = await db
    .from("product_shelf_life")
    .select("id, product_code, product_name, shelf_life_days, storage_condition, updated_by, updated_at")
    .order("product_code");

  if (error) {
    console.warn("[getShelfLifeSettings]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    product_code: row.product_code as string,
    product_name: row.product_name as string,
    shelf_life_days: row.shelf_life_days as number,
    storage_condition: row.storage_condition as string | null,
    updated_by: row.updated_by as string | null,
    updated_at: row.updated_at as string | null,
  }));
}

// ── 유통기한 마스터 등록/수정 (COO/manager) ─────────────────
export async function upsertShelfLife(
  productCode: string,
  productName: string,
  shelfLifeDays: number,
  storageCondition: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager") {
      return { success: false, error: "유통기한 설정 권한이 없습니다. (팀장 이상)" };
    }

    const db = createServerClient();
    const { error } = await db
      .from("product_shelf_life")
      .upsert(
        {
          product_code: productCode,
          product_name: productName,
          shelf_life_days: shelfLifeDays,
          storage_condition: storageCondition,
          updated_by: session.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_code" }
      );

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "update",
      entityType: "product_shelf_life",
      entityName: `${productName} (${shelfLifeDays}일)`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 유통기한 임박 재고 (조인 쿼리) ──────────────────────────
export async function getExpiringInventory(daysAhead = 30) {
  return getExpiryAlerts(daysAhead);
}

// ── 품목코드로 유통기한 일수 조회 ───────────────────────────
export async function getShelfLifeByProductCode(productCode: string): Promise<number | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("product_shelf_life")
    .select("shelf_life_days")
    .eq("product_code", productCode)
    .maybeSingle();

  if (error || !data) return null;
  return data.shelf_life_days as number;
}

// ── 품목명으로 유통기한 일수 조회 ───────────────────────────
export async function getShelfLifeByProductName(productName: string): Promise<number | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("product_shelf_life")
    .select("shelf_life_days")
    .eq("product_name", productName)
    .maybeSingle();

  if (error || !data) return null;
  return data.shelf_life_days as number;
}
