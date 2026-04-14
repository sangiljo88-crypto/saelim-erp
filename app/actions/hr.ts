"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

// ── 직원 등록 (COO 전용) ─────────────────────────────────────────
export async function createStaffMember(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const { hashPassword } = await import("@/lib/hash");
  const db = createServerClient();

  const login_id = (formData.get("login_id") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const name     = (formData.get("name") as string)?.trim();
  const role     = formData.get("role") as string;
  const dept     = (formData.get("dept") as string)?.trim() || null;

  if (!login_id || !password || !name || !role) return { error: "필수 항목 누락" };

  const { error } = await db.from("members").insert({
    login_id,
    password: hashPassword(password),
    name,
    role,
    dept,
    active: true,
  });

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return { error: `아이디 '${login_id}'가 이미 존재합니다` };
    }
    return { error: error.message };
  }
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 활성/비활성 토글 (COO 전용) ────────────────────────
export async function toggleMemberActive(memberId: string, active: boolean) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const { error } = await db
    .from("members")
    .update({ active })
    .eq("id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 비밀번호 변경 (COO 전용) ───────────────────────────
export async function resetMemberPassword(memberId: string, newPassword: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  if (!newPassword || newPassword.length < 4) return { error: "비밀번호는 4자 이상" };

  const { hashPassword } = await import("@/lib/hash");
  const db = createServerClient();
  const { error } = await db
    .from("members")
    .update({ password: hashPassword(newPassword) })
    .eq("id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  return { success: true };
}

// ── 직원 기본급 저장 (COO 전용) ──────────────────────────────
export async function saveStaffSalary(
  loginId: string,
  name: string,
  dept: string | null,
  baseSalary: number
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  if (baseSalary < 0) return { error: "기본급은 0 이상이어야 합니다." };

  const db = createServerClient();
  const { error } = await db.from("staff_salaries").upsert(
    {
      login_id:    loginId,
      name,
      dept,
      base_salary: baseSalary,
      updated_by:  session.name,
      updated_at:  new Date().toISOString(),
    },
    { onConflict: "login_id" }
  );

  if (error) return { error: error.message };

  await logAudit({
    action: "update",
    entityType: "staff_salary",
    entityName: name,
    changes: {
      base_salary: { before: null, after: baseSalary },
    },
    performedBy: session.id,
    performedByName: session.name,
    dept: session.dept,
  });

  revalidatePath("/staff");
  revalidatePath("/payroll");
  return { success: true };
}

// ── 월별 급여 일괄 저장 (COO 전용) → monthly_kpi 자동 반영 ─
export async function savePayrollMonth(
  yearMonth: string,
  records: Array<{
    login_id: string;
    employee_name: string;
    dept: string | null;
    base_salary: number;
    overtime_pay: number;
    bonus: number;
    deduction: number;
    total_pay: number;
    notes: string;
  }>
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();

  // 금액 음수 검증
  const hasNeg = records.some((r) => r.base_salary < 0 || r.total_pay < 0);
  if (hasNeg) return { error: "급여 금액은 0 이상이어야 합니다." };

  // 급여 기록 일괄 upsert
  const rows = records.map((r) => ({
    ...r,
    year_month:  yearMonth,
    recorded_by: session.name,
  }));

  const { error } = await db
    .from("payroll_records")
    .upsert(rows, { onConflict: "year_month,login_id" });

  if (error) return { error: error.message };

  // monthly_kpi 인건비 자동 동기화
  const totalLaborCost = records.reduce((s, r) => s + r.total_pay, 0);
  await db.from("monthly_kpi").upsert(
    {
      year_month: yearMonth,
      dept:       "전사",
      kpi_key:    "labor_cost",
      actual:     totalLaborCost,
      target:     0,  // 목표는 별도 관리
    },
    { onConflict: "year_month,dept,kpi_key" }
  );

  revalidatePath("/payroll");
  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── 기본급 일괄 갱신 (payroll 입력 전 staff_salaries 동기화) ─
export async function bulkUpdateBaseSalaries(
  updates: Array<{ login_id: string; name: string; dept: string | null; base_salary: number }>
) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const rows = updates.map((u) => ({
    ...u,
    updated_by: session.name,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from("staff_salaries")
    .upsert(rows, { onConflict: "login_id" });

  if (error) return { error: error.message };
  revalidatePath("/staff");
  revalidatePath("/payroll");
  return { success: true };
}
