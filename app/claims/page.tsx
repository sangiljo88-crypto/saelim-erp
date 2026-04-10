import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ClaimsManager from "@/components/ClaimsManager";
import { createServerClient } from "@/lib/supabase";

export default async function ClaimsPage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) redirect("/login");

  const db = createServerClient();
  const { data: claims } = await db
    .from("claims")
    .select("id, claim_date, worker_name, dept, client_name, product_names, claim_type, content, status, created_at")
    .order("created_at", { ascending: false });

  const all       = claims ?? [];
  const pending   = all.filter((c) => c.status === "pending").length;
  const inProgress = all.filter((c) => c.status === "in_progress").length;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="클레임 관리" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">클레임 관리</h1>
            <p className="text-sm text-gray-500">거래처 불만·품질 이슈 접수 및 처리 현황</p>
          </div>
          <a
            href="/coo"
            className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
          >
            ← COO 대시보드
          </a>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{pending}</div>
            <div className="text-xs text-gray-500 mt-1">미처리</div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{inProgress}</div>
            <div className="text-xs text-gray-500 mt-1">처리중</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{all.length}</div>
            <div className="text-xs text-gray-500 mt-1">전체</div>
          </div>
        </div>

        {/* 클레임 목록 */}
        <ClaimsManager initialClaims={all as Parameters<typeof ClaimsManager>[0]["initialClaims"]} />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 클레임 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
