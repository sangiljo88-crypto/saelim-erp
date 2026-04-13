"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { MOCK_USERS } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { LeaveBalance, LeaveBalanceAdjustment } from "@/lib/types/leave";

const THIS_YEAR = new Date().getFullYear();

// ── 권한 체크 헬퍼 ───────────────────────────────────────────
function canManageLeave(session: { role: string; dept?: string }) {
  return (
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀")
  );
}

// ── 직원 본인 잔여 조회 ──────────────────────────────────────
export async function getMyLeaveBalance(year = THIS_YEAR): Promise<LeaveBalance | null> {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const { data } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("employee_id", session.id)
    .eq("year", year)
    .single();

  return data as LeaveBalance | null;
}

// ── 전직원 잔여 조회 (관리자 전용) ──────────────────────────
export async function getAllLeaveBalances(year = THIS_YEAR): Promise<LeaveBalance[]> {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  if (!canManageLeave(session)) throw new Error("조회 권한이 없습니다.");

  const db = createServerClient();
  const { data } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("year", year)
    .order("dept", { ascending: true });

  return (data ?? []) as LeaveBalance[];
}

// ── 이력 조회 (본인 또는 관리자) ────────────────────────────
export async function getLeaveAdjustmentHistory(
  employeeId?: string,
  year = THIS_YEAR
): Promise<LeaveBalanceAdjustment[]> {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const targetId = employeeId ?? session.id;

  // 본인 이력은 본인이 볼 수 있음, 타인 이력은 관리자만
  if (targetId !== session.id && !canManageLeave(session)) {
    throw new Error("조회 권한이 없습니다.");
  }

  const db = createServerClient();
  const { data } = await db
    .from("leave_balance_adjustments")
    .select("*")
    .eq("employee_id", targetId)
    .eq("year", year)
    .order("created_at", { ascending: false });

  return (data ?? []) as LeaveBalanceAdjustment[];
}

// ── 연차 잔여 조정 (관리자 전용) ────────────────────────────
export async function adjustLeaveBalance(
  employeeId: string,
  year: number,
  delta: number,       // 양수=증가, 음수=감소
  reason: string
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  if (!canManageLeave(session)) throw new Error("조정 권한이 없습니다.");
  if (!reason.trim()) throw new Error("조정 사유를 입력해주세요.");
  if (delta === 0) throw new Error("조정 값이 0입니다.");

  const db = createServerClient();

  // 현재 잔여 조회 (없으면 생성)
  const { data: existing } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  const emp = MOCK_USERS.find((u) => u.id === employeeId);
  const empName = emp?.name ?? employeeId;
  const empDept = emp?.dept ?? null;

  let balanceId: string;
  let currentTotal: number;

  if (!existing) {
    // 없으면 15일로 초기화 후 조정
    const { data: created, error } = await db
      .from("employee_leave_balances")
      .insert({
        employee_id:   employeeId,
        employee_name: empName,
        dept:          empDept,
        year,
        total_days: 15,
        used_days:  0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !created) throw new Error("잔여 생성 실패: " + (error?.message ?? ""));
    balanceId = created.id;
    currentTotal = 15;
  } else {
    balanceId = existing.id;
    currentTotal = Number(existing.total_days);
  }

  const newTotal = Math.max(0, currentTotal + delta);

  const { error: updErr } = await db
    .from("employee_leave_balances")
    .update({ total_days: newTotal, updated_at: new Date().toISOString() })
    .eq("id", balanceId);
  if (updErr) throw new Error("잔여 업데이트 실패: " + updErr.message);

  // 이력 기록
  await db.from("leave_balance_adjustments").insert({
    employee_id:      employeeId,
    employee_name:    empName,
    dept:             empDept,
    year,
    before_days:      currentTotal,
    after_days:       newTotal,
    delta,
    adjustment_type:  delta > 0 ? "add" : "subtract",
    reason:           reason.trim(),
    adjusted_by:      session.id,
    adjusted_by_name: session.name,
    vacation_request_id: null,
  });

  revalidatePath("/schedule/leave");
}

// ── 전 직원 연차 초기화 (연도별, 관리자 전용) ────────────────
export async function initLeaveBalancesForYear(year: number): Promise<{ count: number }> {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");
  if (!canManageLeave(session)) throw new Error("권한이 없습니다.");

  const db = createServerClient();

  // CEO/COO 제외한 전 직원 (레거시 계정 제외)
  const TARGET_IDS = ["ceo", "coo", "worker1", "worker2", "prod"];
  const employees = MOCK_USERS.filter((u) => !TARGET_IDS.includes(u.id));

  let count = 0;
  for (const emp of employees) {
    const { data: existing } = await db
      .from("employee_leave_balances")
      .select("id")
      .eq("employee_id", emp.id)
      .eq("year", year)
      .single();

    if (!existing) {
      const { error } = await db.from("employee_leave_balances").insert({
        employee_id:   emp.id,
        employee_name: emp.name,
        dept:          emp.dept ?? null,
        year,
        total_days: 15,
        used_days:  0,
        updated_at: new Date().toISOString(),
      });
      if (!error) {
        count++;
        // 초기 설정 이력
        await db.from("leave_balance_adjustments").insert({
          employee_id:      emp.id,
          employee_name:    emp.name,
          dept:             emp.dept ?? null,
          year,
          before_days:      0,
          after_days:       15,
          delta:            15,
          adjustment_type:  "initial",
          reason:           `${year}년도 연차 15일 초기 부여`,
          adjusted_by:      session.id,
          adjusted_by_name: session.name,
          vacation_request_id: null,
        });
      }
    }
  }

  revalidatePath("/schedule/leave");
  return { count };
}

// ── 내부 함수: 휴가 승인 시 연차 차감 (schedule.ts에서 호출) ─
export async function deductLeaveOnApproval(
  db: ReturnType<typeof createServerClient>,
  vacationId: string,
  employeeId: string,
  employeeName: string,
  employeeDept: string | null,
  year: number,
  deductedDays: number,
  approverSession: { id: string; name: string }
): Promise<void> {
  // 현재 잔여 조회 (없으면 15일로 초기화)
  const { data: bal } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  let balId: string;
  let beforeUsed: number;
  let totalDays: number;

  if (!bal) {
    const { data: created, error } = await db
      .from("employee_leave_balances")
      .insert({
        employee_id:   employeeId,
        employee_name: employeeName,
        dept:          employeeDept,
        year,
        total_days: 15,
        used_days:  0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !created) return;
    balId = created.id;
    beforeUsed = 0;
    totalDays = 15;
  } else {
    balId = bal.id;
    beforeUsed = Number(bal.used_days);
    totalDays = Number(bal.total_days);
  }

  const newUsed = Math.min(totalDays, beforeUsed + deductedDays);

  await db
    .from("employee_leave_balances")
    .update({ used_days: newUsed, updated_at: new Date().toISOString() })
    .eq("id", balId);

  await db.from("leave_balance_adjustments").insert({
    employee_id:         employeeId,
    employee_name:       employeeName,
    dept:                employeeDept,
    year,
    before_days:         totalDays - beforeUsed,
    after_days:          totalDays - newUsed,
    delta:               -deductedDays,
    adjustment_type:     "deduct",
    reason:              "휴가 승인에 의한 자동 차감",
    adjusted_by:         approverSession.id,
    adjusted_by_name:    approverSession.name,
    vacation_request_id: vacationId,
  });
}

// ── 내부 함수: 반려 시 연차 복구 ─────────────────────────────
export async function restoreLeaveOnReject(
  db: ReturnType<typeof createServerClient>,
  vacationId: string,
  employeeId: string,
  employeeName: string,
  employeeDept: string | null,
  year: number,
  deductedDays: number,
  approverSession: { id: string; name: string }
): Promise<void> {
  const { data: bal } = await db
    .from("employee_leave_balances")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .single();

  if (!bal) return;

  const beforeUsed = Number(bal.used_days);
  const totalDays = Number(bal.total_days);
  const newUsed = Math.max(0, beforeUsed - deductedDays);

  await db
    .from("employee_leave_balances")
    .update({ used_days: newUsed, updated_at: new Date().toISOString() })
    .eq("id", bal.id);

  await db.from("leave_balance_adjustments").insert({
    employee_id:         employeeId,
    employee_name:       employeeName,
    dept:                employeeDept,
    year,
    before_days:         totalDays - beforeUsed,
    after_days:          totalDays - newUsed,
    delta:               deductedDays,
    adjustment_type:     "restore",
    reason:              "휴가 반려에 의한 자동 복구",
    adjusted_by:         approverSession.id,
    adjusted_by_name:    approverSession.name,
    vacation_request_id: vacationId,
  });
}
