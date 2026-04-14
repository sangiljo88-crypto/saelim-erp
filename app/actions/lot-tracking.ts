"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── LOT 번호 자동 생성 (YYMMDD-SEQ, 동시 삽입 안전) ──────────────
async function generateLotNumber(db: ReturnType<typeof createServerClient>, productionDate: string): Promise<string> {
  const d = new Date(productionDate);
  const prefix = [
    String(d.getFullYear()).slice(2),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");

  // 같은 날짜 prefix를 가진 LOT 수를 세서 다음 순번 결정
  const { count } = await db
    .from("production_lots")
    .select("id", { count: "exact", head: true })
    .like("lot_number", `${prefix}-%`);

  const seq = ((count ?? 0) + 1).toString().padStart(3, "0");
  const candidate = `${prefix}-${seq}`;

  // 유니크 제약 충돌 대비: 이미 존재하면 +1 재시도
  const { data: existing } = await db
    .from("production_lots")
    .select("lot_number")
    .eq("lot_number", candidate)
    .maybeSingle();

  if (existing) {
    const nextSeq = ((count ?? 0) + 2).toString().padStart(3, "0");
    return `${prefix}-${nextSeq}`;
  }

  return candidate;
}

// ── LOT 생성 ──────────────────────────────────────────────────────
export async function createLot(data: {
  production_date: string;
  product_code?: string;
  product_name: string;
  dept?: string;
  output_qty: number;
  input_qty: number;
  worker_name?: string;
  worker_id?: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const lotNumber = await generateLotNumber(db, data.production_date);
  const yieldRate = data.input_qty > 0
    ? Math.round((data.output_qty / data.input_qty) * 1000) / 10
    : null;

  const { data: lot, error } = await db.from("production_lots").insert({
    lot_number: lotNumber,
    production_date: data.production_date,
    product_code: data.product_code ?? null,
    product_name: data.product_name,
    dept: data.dept ?? null,
    output_qty: data.output_qty,
    input_qty: data.input_qty,
    yield_rate: yieldRate,
    worker_name: data.worker_name ?? null,
    worker_id: data.worker_id ?? null,
    notes: data.notes ?? null,
  }).select("id, lot_number").single();

  if (error) throw new Error(error.message);
  revalidatePath("/lot");
  return lot;
}

// ── 원재료 연결 ───────────────────────────────────────────────────
export async function addLotMaterial(
  lotId: string,
  materials: {
    purchase_id?: string;
    material_name: string;
    supplier?: string;
    quantity_used: number;
    purchase_date?: string;
  }[]
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const rows = materials.map((m) => ({
    lot_id: lotId,
    purchase_id: m.purchase_id ?? null,
    material_name: m.material_name,
    supplier: m.supplier ?? null,
    quantity_used: m.quantity_used,
    purchase_date: m.purchase_date ?? null,
  }));

  const { error } = await db.from("lot_materials").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/lot");
  return { success: true };
}

// ── 출하 연결 ─────────────────────────────────────────────────────
export async function addLotShipment(
  lotId: string,
  shipments: {
    delivery_id?: string;
    customer_name: string;
    shipped_qty: number;
    shipped_date: string;
  }[]
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const rows = shipments.map((s) => ({
    lot_id: lotId,
    delivery_id: s.delivery_id ?? null,
    customer_name: s.customer_name,
    shipped_qty: s.shipped_qty,
    shipped_date: s.shipped_date,
  }));

  const { error } = await db.from("lot_shipments").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/lot");
  return { success: true };
}

// ── LOT 목록 조회 ─────────────────────────────────────────────────
export async function getLots(dateFrom?: string, dateTo?: string, productName?: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  let query = db
    .from("production_lots")
    .select("id, lot_number, production_date, product_code, product_name, dept, output_qty, input_qty, yield_rate, worker_name, status, notes, created_at")
    .order("production_date", { ascending: false })
    .order("lot_number", { ascending: false });

  if (dateFrom) query = query.gte("production_date", dateFrom);
  if (dateTo)   query = query.lte("production_date", dateTo);
  if (productName) query = query.ilike("product_name", `%${productName}%`);

  const { data: lots, error } = await query;
  if (error) throw new Error(error.message);

  // 각 LOT의 원재료/출하 건수를 가져온다
  const lotIds = (lots ?? []).map((l) => l.id);
  if (lotIds.length === 0) return [];

  const [{ data: matCounts }, { data: shipCounts }] = await Promise.all([
    db.from("lot_materials").select("lot_id").in("lot_id", lotIds),
    db.from("lot_shipments").select("lot_id").in("lot_id", lotIds),
  ]);

  const matCountMap: Record<string, number> = {};
  for (const m of matCounts ?? []) {
    matCountMap[m.lot_id] = (matCountMap[m.lot_id] || 0) + 1;
  }
  const shipCountMap: Record<string, number> = {};
  for (const s of shipCounts ?? []) {
    shipCountMap[s.lot_id] = (shipCountMap[s.lot_id] || 0) + 1;
  }

  return (lots ?? []).map((l) => ({
    ...l,
    material_count: matCountMap[l.id] || 0,
    shipment_count: shipCountMap[l.id] || 0,
  }));
}

// ── LOT 상세 조회 ─────────────────────────────────────────────────
export async function getLotDetail(lotId: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const [{ data: lot }, { data: materials }, { data: shipments }] = await Promise.all([
    db.from("production_lots").select("*").eq("id", lotId).single(),
    db.from("lot_materials").select("*").eq("lot_id", lotId).order("created_at"),
    db.from("lot_shipments").select("*").eq("lot_id", lotId).order("shipped_date"),
  ]);

  if (!lot) throw new Error("LOT을 찾을 수 없습니다");

  return {
    lot,
    materials: materials ?? [],
    shipments: shipments ?? [],
  };
}

// ── 순추적: 이 LOT은 어디로 갔나? ─────────────────────────────────
export async function traceLotForward(lotId: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("lot_shipments")
    .select("id, delivery_id, customer_name, shipped_qty, shipped_date")
    .eq("lot_id", lotId)
    .order("shipped_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── 역추적: 이 LOT은 어디서 왔나? ─────────────────────────────────
export async function traceLotBackward(lotId: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("lot_materials")
    .select("id, purchase_id, material_name, supplier, quantity_used, purchase_date")
    .eq("lot_id", lotId)
    .order("purchase_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── LOT 번호로 검색 ──────────────────────────────────────────────
export async function searchLotByNumber(lotNumber: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("production_lots")
    .select("id, lot_number, production_date, product_name, status")
    .ilike("lot_number", `%${lotNumber}%`)
    .order("production_date", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── 최근 매입 목록 (원재료 연결 폼용) ─────────────────────────────
export async function getRecentPurchases() {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("material_purchases")
    .select("id, purchase_date, material_name, supplier, quantity, remaining_qty, unit")
    .gt("remaining_qty", 0)
    .order("purchase_date", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── 최근 납품 목록 (출하 연결 폼용) ───────────────────────────────
export async function getRecentDeliveries() {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data, error } = await db
    .from("deliveries")
    .select("id, delivery_date, customer_name, total_amount, status")
    .order("delivery_date", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}
