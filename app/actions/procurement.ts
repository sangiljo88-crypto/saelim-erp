"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── MRP 계산: 생산계획 → BOM → 재고 → 부족량 ──────────────
export async function calculateMaterialRequirements(daysAhead?: number) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const days = daysAhead ?? 7;
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const db = createServerClient();

  // 1. 생산계획 조회 (향후 N일)
  const { data: plans } = await db
    .from("production_plans")
    .select("id, plan_date, product_name, target_qty, status")
    .gte("plan_date", today)
    .lte("plan_date", endDate)
    .order("plan_date");

  // 2. BOM 매핑 조회
  const { data: bomEntries } = await db
    .from("product_bom")
    .select("product_code, product_name, material_name, qty_per_unit, unit");

  // product_name → 필요 원재료 리스트
  const bomMap: Record<
    string,
    Array<{ material_name: string; qty_per_unit: number; unit: string }>
  > = {};
  for (const b of bomEntries ?? []) {
    if (!bomMap[b.product_name]) bomMap[b.product_name] = [];
    bomMap[b.product_name].push({
      material_name: b.material_name,
      qty_per_unit: Number(b.qty_per_unit),
      unit: b.unit,
    });
  }

  // 3. 자재 소요량 계산
  const materialRequirements: Record<
    string,
    { required: number; unit: string }
  > = {};

  for (const plan of plans ?? []) {
    const bom = bomMap[plan.product_name];
    if (!bom) continue;
    for (const mat of bom) {
      if (!materialRequirements[mat.material_name]) {
        materialRequirements[mat.material_name] = { required: 0, unit: mat.unit };
      }
      materialRequirements[mat.material_name].required +=
        (plan.target_qty || 0) * mat.qty_per_unit;
    }
  }

  // 4. 현재 냉동재고 조회
  const { data: frozenRows } = await db
    .from("frozen_inventory")
    .select("product_name, current_stock");

  const stockMap: Record<string, number> = {};
  for (const row of frozenRows ?? []) {
    stockMap[row.product_name] =
      (stockMap[row.product_name] || 0) + (Number(row.current_stock) || 0);
  }

  // 5. 부족량 계산
  const results = Object.entries(materialRequirements).map(
    ([material, req]) => {
      const currentStock = stockMap[material] ?? 0;
      const shortfall = Math.max(0, req.required - currentStock);
      return {
        material,
        required: Math.round(req.required * 100) / 100,
        currentStock: Math.round(currentStock * 100) / 100,
        shortfall: Math.round(shortfall * 100) / 100,
        needsOrder: shortfall > 0,
        unit: req.unit,
      };
    }
  );

  return {
    plans: (plans ?? []) as Array<{
      id: string;
      plan_date: string;
      product_name: string;
      target_qty: number;
      status: string;
    }>,
    requirements: results.sort((a, b) => b.shortfall - a.shortfall),
    period: { from: today, to: endDate },
  };
}

// ── BOM 매핑 조회 ────────────────────────────────────────────
export async function getBomMappings() {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("product_bom")
    .select("id, product_code, product_name, material_code, material_name, qty_per_unit, unit, notes, updated_by, updated_at")
    .order("product_name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    product_code: string;
    product_name: string;
    material_code: string | null;
    material_name: string;
    qty_per_unit: number;
    unit: string;
    notes: string | null;
    updated_by: string | null;
    updated_at: string;
  }>;
}

// ── BOM 매핑 추가/수정 ─────────────────────────────────────
export async function upsertBomMapping(
  productCode: string,
  productName: string,
  materialName: string,
  qtyPerUnit: number
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const allowed = session.role === "coo" || session.role === "manager";
  if (!allowed) return { success: false, error: "권한 없음 (COO 또는 팀장)" };

  const db = createServerClient();
  const { error } = await db.from("product_bom").upsert(
    {
      product_code: productCode,
      product_name: productName,
      material_name: materialName,
      qty_per_unit: qtyPerUnit,
      updated_by: session.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_code,material_name" }
  );

  if (error) return { success: false, error: error.message };
  revalidatePath("/procurement");
  return { success: true };
}

// ── 최신 원재료 단가 조회 ────────────────────────────────────
export async function getLatestMaterialPrices() {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();

  // 원재료별 최신 매입 단가
  const { data: purchases } = await db
    .from("material_purchases")
    .select("material_name, unit_price, purchase_date")
    .order("purchase_date", { ascending: false });

  const priceMap: Record<string, number> = {};
  for (const p of purchases ?? []) {
    if (!priceMap[p.material_name]) {
      priceMap[p.material_name] = p.unit_price;
    }
  }

  return priceMap;
}
