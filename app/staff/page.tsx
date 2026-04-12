import { getSession, MOCK_USERS } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StaffManager from "@/components/StaffManager";
import { createServerClient } from "@/lib/supabase";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "coo" && session.role !== "ceo") redirect("/login");

  const db = createServerClient();
  const { data: dbMembers } = await db
    .from("members")
    .select("id, login_id, name, role, dept, active, created_at")
    .order("created_at", { ascending: true });

  // MOCK_USERS를 동일한 형식으로 변환 (레거시로 표시)
  const mockStaff = MOCK_USERS
    .filter(u => !["ceo", "coo", "worker1", "worker2", "prod"].includes(u.id))
    .map(u => ({
      id: u.id,
      login_id: u.id,
      name: u.name,
      role: u.role,
      dept: u.dept ?? null,
      active: true,
      created_at: null,
      isLegacy: true,
    }));

  const dbStaff = (dbMembers ?? []).map(m => ({ ...m, isLegacy: false }));

  // DB 계정과 MOCK이 같은 login_id인 경우 DB 우선
  const dbLoginIds = new Set(dbStaff.map(m => m.login_id));
  const filteredMock = mockStaff.filter(m => !dbLoginIds.has(m.login_id));

  const allStaff = [...dbStaff, ...filteredMock];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="직원 관리" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-gray-800">👥 직원 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">계정 등록 · 권한 설정 · 활성/비활성 관리</p>
        </div>
        <StaffManager
          staff={allStaff}
          canEdit={session.role === "coo"}
        />
      </main>
    </div>
  );
}
