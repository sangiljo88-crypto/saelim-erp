"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export interface InspectionItem {
  product_name: string;
  qty_kg: number;
  weight_ok: boolean;
  temp_ok: boolean;
  package_ok: boolean;
  label_ok: boolean;
  notes: string;
}

export interface InspectionData {
  delivery_id?: string | null;
  inspection_date: string;
  customer_name: string;
  items: InspectionItem[];
  temp_reading?: number | null;
  notes?: string | null;
}

export interface InspectionRow {
  id: string;
  delivery_id: string | null;
  inspection_date: string;
  customer_name: string;
  inspector_name: string;
  inspector_id: string;
  items: InspectionItem[];
  overall_pass: boolean;
  temp_reading: number | null;
  notes: string | null;
  created_at: string;
}

// ── 검품 기록 등록 ──────────────────────────────────────────
export async function submitInspection(
  data: InspectionData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };

    // 전체 합격 여부 판정: 모든 아이템의 모든 체크가 true여야 합격
    const overallPass = data.items.every(
      (item) => item.weight_ok && item.temp_ok && item.package_ok && item.label_ok
    );

    const db = createServerClient();
    const { error } = await db.from("shipment_inspections").insert({
      delivery_id: data.delivery_id ?? null,
      inspection_date: data.inspection_date,
      customer_name: data.customer_name,
      inspector_name: session.name,
      inspector_id: session.id,
      items: data.items,
      overall_pass: overallPass,
      temp_reading: data.temp_reading ?? null,
      notes: data.notes ?? null,
    });

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "create",
      entityType: "shipment_inspection",
      entityName: `${data.customer_name} 검품 (${data.items.length}품목)`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    revalidatePath("/inspection");
    revalidatePath("/deliveries");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 검품 이력 조회 ──────────────────────────────────────────
export async function getInspections(dateFrom?: string, dateTo?: string): Promise<InspectionRow[]> {
  const db = createServerClient();
  let query = db
    .from("shipment_inspections")
    .select("id, delivery_id, inspection_date, customer_name, inspector_name, inspector_id, items, overall_pass, temp_reading, notes, created_at")
    .order("inspection_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (dateFrom) {
    query = query.gte("inspection_date", dateFrom);
  }
  if (dateTo) {
    query = query.lte("inspection_date", dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[getInspections]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    delivery_id: row.delivery_id as string | null,
    inspection_date: row.inspection_date as string,
    customer_name: row.customer_name as string,
    inspector_name: row.inspector_name as string,
    inspector_id: row.inspector_id as string,
    items: row.items as InspectionItem[],
    overall_pass: row.overall_pass as boolean,
    temp_reading: row.temp_reading as number | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  }));
}

// ── 납품건별 검품 조회 ──────────────────────────────────────
export async function getInspectionByDelivery(deliveryId: string): Promise<InspectionRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("shipment_inspections")
    .select("id, delivery_id, inspection_date, customer_name, inspector_name, inspector_id, items, overall_pass, temp_reading, notes, created_at")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    delivery_id: data.delivery_id as string | null,
    inspection_date: data.inspection_date as string,
    customer_name: data.customer_name as string,
    inspector_name: data.inspector_name as string,
    inspector_id: data.inspector_id as string,
    items: data.items as InspectionItem[],
    overall_pass: data.overall_pass as boolean,
    temp_reading: data.temp_reading as number | null,
    notes: data.notes as string | null,
    created_at: data.created_at as string,
  };
}
