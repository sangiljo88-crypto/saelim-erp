"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 회의록 삭제 (COO 전용) ───────────────────────────────────
export async function deleteMeeting(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "coo") return { success: false, error: "COO 권한 필요" };
  const db = createServerClient();
  const { error } = await db.from("meeting_minutes").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/meetings");
  return { success: true };
}
