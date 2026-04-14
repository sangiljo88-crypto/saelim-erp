"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// ── 권한 체크 헬퍼 ─────────────────────────────────────────
function canManageProducts(session: { role: string; dept?: string }) {
  return (
    session.role === "coo" ||
    session.role === "ceo" ||
    session.role === "manager"
  );
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  purchase_price: number;
  sale_price: number;
  storage_type: string | null;
  storage_area: string | null;
  is_active: boolean;
  note: string | null;
  safety_stock: number;
}

// FALLBACK: DB 없을 때 정적 데이터
const FALLBACK_PRODUCTS: Product[] = [
  // 머리류
  { id: "f-001", code: "R001", name: "통머리",         category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-002", code: "R002", name: "조각머리",        category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-003", code: "R003", name: "귀",              category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-004", code: "R004", name: "뒷판",            category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-005", code: "R005", name: "혀",              category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-006", code: "R006", name: "덜미(면도귀O)",   category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-007", code: "R007", name: "덜미(면도귀X)",   category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-008", code: "R008", name: "관자",            category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-009", code: "R009", name: "꽃살",            category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-010", code: "R010", name: "뼛살",            category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-011", code: "R011", name: "설하",            category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-012", code: "R012", name: "두항정",          category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-013", code: "R013", name: "릎",              category: "원물", subcategory: "머리류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  // 내장류
  { id: "f-014", code: "R014", name: "앞판(면도귀O)",   category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-015", code: "R015", name: "앞판(면도귀X)",   category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-016", code: "R016", name: "막창",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-017", code: "R017", name: "허파",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-018", code: "R018", name: "염통",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-019", code: "R019", name: "오소리",          category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-020", code: "R020", name: "위",              category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-021", code: "R021", name: "소장",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-022", code: "R022", name: "대장",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-023", code: "R023", name: "간",              category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-024", code: "R024", name: "콩팥",            category: "원물", subcategory: "내장류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  // 스킨류
  { id: "f-025", code: "R025", name: "껍데기(생)",      category: "원물", subcategory: "스킨류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-026", code: "R026", name: "껍데기(자숙)",    category: "원물", subcategory: "스킨류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-027", code: "R027", name: "스킨세절",        category: "원물", subcategory: "스킨류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-028", code: "R028", name: "족발(생)",         category: "원물", subcategory: "스킨류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-029", code: "R029", name: "족발(자숙)",       category: "원물", subcategory: "스킨류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  // 뼈류
  { id: "f-030", code: "R030", name: "두골",            category: "원물", subcategory: "뼈류",  unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-031", code: "R031", name: "등뼈",            category: "원물", subcategory: "뼈류",  unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-032", code: "R032", name: "갈비뼈",          category: "원물", subcategory: "뼈류",  unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-033", code: "R033", name: "사골",            category: "원물", subcategory: "뼈류",  unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  // 육수류
  { id: "f-034", code: "P001", name: "육수(500ml)",     category: "가공품", subcategory: "육수류", unit: "개", purchase_price: 0, sale_price: 0, storage_type: "냉장", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-035", code: "P002", name: "육수(1L)",         category: "가공품", subcategory: "육수류", unit: "개", purchase_price: 0, sale_price: 0, storage_type: "냉장", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-036", code: "P003", name: "국물베이스",       category: "가공품", subcategory: "육수류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉장", storage_area: null, is_active: true, note: null, safety_stock: 100 },
  { id: "f-037", code: "P004", name: "순대원료",         category: "가공품", subcategory: "육수류", unit: "kg", purchase_price: 0, sale_price: 0, storage_type: "냉동", storage_area: null, is_active: true, note: null, safety_stock: 100 },
];

export async function getProducts(): Promise<Product[]> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from("products")
      .select("id, code, name, category, subcategory, unit, purchase_price, sale_price, storage_type, storage_area, is_active, note, safety_stock")
      .eq("is_active", true)
      .order("code");

    if (error || !data) {
      console.warn("[getProducts] DB error or no data, using fallback:", error?.message);
      return FALLBACK_PRODUCTS;
    }

    return data.map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      category: row.category as string,
      subcategory: row.subcategory as string | null,
      unit: row.unit as string,
      purchase_price: Number(row.purchase_price ?? 0),
      sale_price: Number(row.sale_price ?? 0),
      storage_type: row.storage_type as string | null,
      storage_area: row.storage_area as string | null,
      is_active: row.is_active as boolean,
      note: row.note as string | null,
      safety_stock: Number(row.safety_stock ?? 100),
    }));
  } catch {
    return FALLBACK_PRODUCTS;
  }
}

export async function upsertProduct(
  data: Omit<Product, "id"> & { id?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (!canManageProducts(session)) return { success: false, error: "품목 수정 권한이 없습니다. (팀장 이상)" };

    const db = createServerClient();
    const payload = {
      code: data.code,
      name: data.name,
      category: data.category,
      subcategory: data.subcategory ?? null,
      unit: data.unit,
      purchase_price: data.purchase_price,
      sale_price: data.sale_price,
      storage_type: data.storage_type ?? null,
      storage_area: data.storage_area ?? null,
      is_active: data.is_active ?? true,
      note: data.note ?? null,
      safety_stock: data.safety_stock ?? 100,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("products")
      .upsert(payload, { onConflict: "code" });

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "update",
      entityType: "product",
      entityName: data.name,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (!canManageProducts(session)) return { success: false, error: "품목 삭제 권한이 없습니다. (팀장 이상)" };

    const db = createServerClient();
    const { error } = await db
      .from("products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "delete",
      entityType: "product",
      entityId: id,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export interface BulkProductRow {
  code: string;
  name: string;
  category: string;
  subcategory?: string | null;
  unit: string;
  purchase_price?: number;
  sale_price?: number;
  storage_type?: string | null;
  storage_area?: string | null;
  note?: string | null;
}

export async function bulkUpsertProducts(
  rows: BulkProductRow[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (!canManageProducts(session)) return { success: false, error: "품목 일괄수정 권한이 없습니다. (팀장 이상)" };

    const db = createServerClient();
    const now = new Date().toISOString();
    const payload = rows.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory ?? null,
      unit: r.unit,
      purchase_price: r.purchase_price ?? 0,
      sale_price: r.sale_price ?? 0,
      storage_type: r.storage_type ?? null,
      storage_area: r.storage_area ?? null,
      is_active: true,
      note: r.note ?? null,
      updated_at: now,
    }));

    const { error } = await db
      .from("products")
      .upsert(payload, { onConflict: "code" });

    if (error) return { success: false, error: error.message };

    await logAudit({
      action: "create",
      entityType: "product",
      entityName: `${rows.length}건 일괄등록`,
      performedBy: session.id,
      performedByName: session.name,
      dept: session.dept,
    });

    return { success: true, count: rows.length };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
