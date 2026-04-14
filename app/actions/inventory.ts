"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { ROLE_LABEL } from "@/lib/constants";
import { getShelfLifeByProductName } from "@/app/actions/expiry";

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

  // 유통기한 자동 계산: 각 아이템에 대해 product_shelf_life 조회
  const rowsWithExpiry = await Promise.all(
    items.map(async (item) => {
      const baseRow: Record<string, unknown> = { inventory_date: inventoryDate, ...item };
      try {
        const shelfLifeDays = await getShelfLifeByProductName(item.product_name);
        if (shelfLifeDays) {
          const today = new Date();
          const expiryDate = new Date(today);
          expiryDate.setDate(expiryDate.getDate() + shelfLifeDays);
          baseRow.production_date = today.toISOString().split("T")[0];
          baseRow.expiry_date = expiryDate.toISOString().split("T")[0];
        }
      } catch {
        // 유통기한 조회 실패 시 무시
      }
      return baseRow;
    })
  );

  const { error } = await db.from("frozen_inventory").upsert(rowsWithExpiry, {
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
