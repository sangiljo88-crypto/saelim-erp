import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ApprovalBoard from "@/components/ApprovalBoard";
import { createServerClient } from "@/lib/supabase";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const db = createServerClient();
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: approvals } = await db
    .from("cost_approvals")
    .select("id, title, dept, requested_by, request_date, amount, status, comment, approved_by, approved_at, created_at")
    .gte("request_date", since90)
    .order("created_at", { ascending: false });

  const all = approvals ?? [];
  const pending  = all.filter(a => a.status === "pending").length;
  const approved = all.filter(a => a.status === "approved").length;
  const rejected = all.filter(a => a.status === "rejected").length;

  const canApprove = session.role === "coo" || session.role === "ceo";
  const canRequest = session.role === "manager" || session.role === "coo";

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="비용 승인" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold text-gray-800">💰 비용 승인 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">결재 요청 · 승인/반려 · 최근 90일 이력</p>
        </div>
        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-amber-200 p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{pending}</div>
            <div className="text-xs text-gray-500 mt-1">대기 중</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{approved}</div>
            <div className="text-xs text-gray-500 mt-1">승인</div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{rejected}</div>
            <div className="text-xs text-gray-500 mt-1">반려</div>
          </div>
        </div>
        <ApprovalBoard
          approvals={all}
          canApprove={canApprove}
          canRequest={canRequest}
          userDept={session.dept ?? ""}
          userName={session.name}
        />
      </main>
    </div>
  );
}
