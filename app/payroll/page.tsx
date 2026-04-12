import { getSession, MOCK_USERS } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import PayrollSheet from "@/components/PayrollSheet";
import { createServerClient } from "@/lib/supabase";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function PayrollPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "coo") redirect("/coo");

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const currentYM = params.month || today.slice(0, 7);

  const db = createServerClient();

  // 직원 기본급 + 이달 기존 급여 기록을 병렬 조회
  const [
    { data: salaries },
    { data: payrolls },
    { data: dbMembers },
  ] = await Promise.all([
    db.from("staff_salaries").select("login_id, name, dept, base_salary"),
    db.from("payroll_records")
      .select("login_id, base_salary, overtime_pay, bonus, deduction, total_pay, notes")
      .eq("year_month", currentYM),
    db.from("members")
      .select("login_id, name, role, dept, active")
      .eq("active", true),
  ]);

  // 전체 직원 목록 조합 (DB + MOCK, 작업자/팀장만)
  const mockStaff = MOCK_USERS
    .filter(u => !["ceo", "coo", "worker1", "worker2", "prod"].includes(u.id))
    .filter(u => u.role === "worker" || u.role === "manager")
    .map(u => ({ login_id: u.id, name: u.name, role: u.role, dept: u.dept ?? null }));

  const dbStaff = (dbMembers ?? [])
    .filter(m => m.role === "worker" || m.role === "manager")
    .map(m => ({ login_id: m.login_id, name: m.name, role: m.role, dept: m.dept ?? null }));

  const dbLoginIds = new Set(dbStaff.map(m => m.login_id));
  const allStaff = [...dbStaff, ...mockStaff.filter(m => !dbLoginIds.has(m.login_id))];

  // 기본급 맵
  const salaryMap: Record<string, number> = {};
  for (const s of salaries ?? []) salaryMap[s.login_id] = s.base_salary;

  // 이달 기존 급여 맵
  type PayrollRow = NonNullable<typeof payrolls>[number];
  const payrollMap: Record<string, PayrollRow> = {};
  for (const p of payrolls ?? []) payrollMap[p.login_id] = p;

  // 직원 + 급여 정보 병합
  const enriched = allStaff.map(s => ({
    login_id:     s.login_id,
    name:         s.name,
    dept:         s.dept,
    role:         s.role,
    base_salary:  payrollMap[s.login_id]?.base_salary ?? salaryMap[s.login_id] ?? 0,
    overtime_pay: payrollMap[s.login_id]?.overtime_pay ?? 0,
    bonus:        payrollMap[s.login_id]?.bonus ?? 0,
    deduction:    payrollMap[s.login_id]?.deduction ?? 0,
    total_pay:    payrollMap[s.login_id]?.total_pay ?? 0,
    notes:        payrollMap[s.login_id]?.notes ?? "",
    hasSaved:     !!payrollMap[s.login_id],
  }));

  const label = `${currentYM.slice(0, 4)}년 ${parseInt(currentYM.slice(5))}월`;
  const totalLaborCost = (payrolls ?? []).reduce((s, p) => s + (p.total_pay || 0), 0);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="급여 관리" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">💴 월별 급여 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">기본급 설정 · 연장/상여 입력 · 실지급액 → CEO 인건비 KPI 자동 반영</p>
          </div>
          {totalLaborCost > 0 && (
            <div className="text-right">
              <div className="text-xs text-gray-400">{label} 총 인건비</div>
              <div className="text-xl font-bold text-[#1F3864]">
                {(totalLaborCost / 10000).toLocaleString()}만원
              </div>
            </div>
          )}
        </div>

        <PayrollSheet
          yearMonth={currentYM}
          staff={enriched}
        />
      </main>
    </div>
  );
}
