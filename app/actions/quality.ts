"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 품질 순찰일지 ────────────────────────────────────────────
export async function submitQualityPatrol(
  patrolDate: string,
  patrolTime: string,
  areas: string[],
  issues: Array<{ area: string; description: string; severity: string; action: string }>,
  overallStatus: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("quality_patrol").insert({
    patrol_date:    patrolDate,
    patrol_time:    patrolTime,
    inspector:      session.name,
    dept:           session.dept ?? "품질팀",
    areas,
    issues,
    overall_status: overallStatus,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 오딧 체크리스트 ─────────────────────────────────────────
export async function submitAuditChecklist(
  checkDate: string,
  auditType: string,
  items: Array<{ category: string; item: string; result: string; notes: string }>,
  overallResult: string,
  nextAction: string
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db.from("audit_checklist").insert({
    check_date:     checkDate,
    audit_type:     auditType,
    inspector:      session.name,
    items,
    overall_result: overallResult,
    next_action:    nextAction,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}

// ── 클레임 상태 변경 (COO + 관련 팀장) ──────────────────────
const CLAIM_ALLOWED_DEPTS = new Set(["CS팀", "품질팀", "배송팀"]);

export async function updateClaimStatus(
  claimId: string,
  status: "pending" | "in_progress" | "resolved"
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const isCoo     = session.role === "coo";
  const isManager = session.role === "manager" && CLAIM_ALLOWED_DEPTS.has(session.dept ?? "");
  if (!isCoo && !isManager) return { success: false, error: "권한 없음 (COO 또는 CS·품질·배송팀장)" };

  const db = createServerClient();
  const { error } = await db
    .from("claims")
    .update({ status })
    .eq("id", claimId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/claims");
  revalidatePath("/coo");
  revalidatePath("/team");
  return { success: true };
}

// ── 클레임 상세(생산일·원인) 저장 ────────────────────────────
export async function updateClaimDetails(
  id: string,
  productionDate: string | null,
  rootCause: string | null
) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();
  const { error } = await db
    .from("claims")
    .update({ production_date: productionDate || null, root_cause: rootCause || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/claims");
  revalidatePath("/coo");
  return { success: true };
}

// ── 클레임 역추적: 생산일 기준 production_logs + hygiene_checks ─
export async function fetchClaimTraceability(productionDate: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  const db = createServerClient();

  const [{ data: prodLogs }, { data: hygieneChecks }] = await Promise.all([
    db.from("production_logs")
      .select("id, work_date, worker_name, dept, product_name, input_qty, output_qty, waste_qty, issue_note")
      .eq("work_date", productionDate)
      .order("dept"),
    db.from("hygiene_checks")
      .select("id, check_date, worker_name, dept, items")
      .eq("check_date", productionDate),
  ]);

  return {
    prodLogs: (prodLogs ?? []) as Array<{
      id: string; work_date: string; worker_name: string; dept: string;
      product_name: string; input_qty: number; output_qty: number;
      waste_qty: number; issue_note: string | null;
    }>,
    hygieneChecks: (hygieneChecks ?? []) as Array<{
      id: string; check_date: string; worker_name: string; dept: string;
      items: Record<string, boolean>;
    }>,
  };
}
