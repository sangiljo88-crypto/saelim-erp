import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";
import type { LeaveBalance, LeaveBalanceAdjustment } from "@/lib/types/leave";

export default async function LeavePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "회계팀");

  const thisYear = new Date().getFullYear();
  const db = createServerClient();

  const [myBalanceResult, allBalancesResult, myHistoryResult, allHistoryResult] =
    await Promise.all([
      db.from("employee_leave_balances")
        .select("*")
        .eq("employee_id", session.id)
        .eq("year", thisYear)
        .single(),

      canManage
        ? db.from("employee_leave_balances")
            .select("*")
            .eq("year", thisYear)
            .order("dept", { ascending: true })
        : Promise.resolve({ data: [] }),

      // 본인 이력
      db.from("leave_balance_adjustments")
        .select("*")
        .eq("employee_id", session.id)
        .eq("year", thisYear)
        .order("created_at", { ascending: false }),

      // 전직원 이력 (관리자)
      canManage
        ? db.from("leave_balance_adjustments")
            .select("*")
            .eq("year", thisYear)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
    ]);

  const myBalance = (myBalanceResult.data ?? null) as LeaveBalance | null;
  const allBalances = (allBalancesResult.data ?? []) as LeaveBalance[];
  const myHistory = (myHistoryResult.data ?? []) as LeaveBalanceAdjustment[];
  const allHistory = (allHistoryResult.data ?? []) as LeaveBalanceAdjustment[];

  const ADJUSTMENT_TYPE_LABEL: Record<string, string> = {
    initial:  "초기 부여",
    add:      "추가",
    subtract: "차감 (수동)",
    deduct:   "차감 (승인)",
    restore:  "복구 (반려)",
    correction: "수정",
  };

  const ADJUSTMENT_TYPE_COLOR: Record<string, string> = {
    initial:  "bg-blue-100 text-blue-700",
    add:      "bg-emerald-100 text-emerald-700",
    subtract: "bg-orange-100 text-orange-700",
    deduct:   "bg-red-100 text-red-700",
    restore:  "bg-purple-100 text-purple-700",
    correction: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="연차 현황" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">📋 연차 현황</h1>
            <p className="text-sm text-gray-500">{thisYear}년도 연차 사용 현황 및 이력</p>
          </div>
          <a
            href="/schedule"
            className="text-xs bg-white border border-gray-200 text-[#1F3864] px-3 py-1.5 rounded-lg hover:bg-[#1F3864] hover:text-white transition-colors font-semibold"
          >
            ← 공유 일정
          </a>
        </div>

        {/* 내 연차 요약 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4">내 연차 현황</h2>
          {myBalance ? (
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-blue-50 rounded-xl px-4 py-4 text-center border border-blue-100">
                <div className="text-xs text-blue-500 font-semibold mb-1">총 연차</div>
                <div className="text-3xl font-black text-blue-700">{Number(myBalance.total_days).toFixed(0)}</div>
                <div className="text-xs text-blue-400 mt-0.5">일</div>
              </div>
              <div className="bg-orange-50 rounded-xl px-4 py-4 text-center border border-orange-100">
                <div className="text-xs text-orange-500 font-semibold mb-1">사용</div>
                <div className="text-3xl font-black text-orange-600">{Number(myBalance.used_days).toFixed(1)}</div>
                <div className="text-xs text-orange-400 mt-0.5">일</div>
              </div>
              <div className={`rounded-xl px-4 py-4 text-center border ${
                Number(myBalance.total_days) - Number(myBalance.used_days) > 5
                  ? "bg-emerald-50 border-emerald-100"
                  : Number(myBalance.total_days) - Number(myBalance.used_days) > 0
                  ? "bg-amber-50 border-amber-100"
                  : "bg-red-50 border-red-100"
              }`}>
                <div className={`text-xs font-semibold mb-1 ${
                  Number(myBalance.total_days) - Number(myBalance.used_days) > 5
                    ? "text-emerald-500" : Number(myBalance.total_days) - Number(myBalance.used_days) > 0
                    ? "text-amber-500" : "text-red-500"
                }`}>잔여</div>
                <div className={`text-3xl font-black ${
                  Number(myBalance.total_days) - Number(myBalance.used_days) > 5
                    ? "text-emerald-600" : Number(myBalance.total_days) - Number(myBalance.used_days) > 0
                    ? "text-amber-600" : "text-red-600"
                }`}>
                  {(Number(myBalance.total_days) - Number(myBalance.used_days)).toFixed(1)}
                </div>
                <div className={`text-xs mt-0.5 ${
                  Number(myBalance.total_days) - Number(myBalance.used_days) > 5
                    ? "text-emerald-400" : Number(myBalance.total_days) - Number(myBalance.used_days) > 0
                    ? "text-amber-400" : "text-red-400"
                }`}>일</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">아직 연차 정보가 등록되지 않았습니다.</p>
              <p className="text-xs mt-1">관리자에게 초기화를 요청하세요.</p>
            </div>
          )}

          {/* 내 이력 */}
          <h3 className="font-semibold text-gray-700 text-sm mb-3 border-t border-gray-100 pt-4">내 연차 이력</h3>
          {myHistory.length === 0 ? (
            <p className="text-sm text-gray-400">이력이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">일시</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">구분</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">변동</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">이전</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">이후</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">사유</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">처리자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                        {h.created_at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          ADJUSTMENT_TYPE_COLOR[h.adjustment_type] ?? "bg-gray-100 text-gray-700"
                        }`}>
                          {ADJUSTMENT_TYPE_LABEL[h.adjustment_type] ?? h.adjustment_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-semibold">
                        <span className={Number(h.delta) >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {Number(h.delta) >= 0 ? "+" : ""}{Number(h.delta).toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-gray-500 text-xs">{Number(h.before_days).toFixed(1)}일</td>
                      <td className="py-2 px-3 text-center text-gray-700 text-xs font-semibold">{Number(h.after_days).toFixed(1)}일</td>
                      <td className="py-2 px-3 text-xs text-gray-600 max-w-[180px] truncate">{h.reason}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{h.adjusted_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 전직원 현황 (관리자) */}
        {canManage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">전직원 연차 현황</h2>
            {allBalances.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 연차 정보가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">직원</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">부서</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">총 연차</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">사용</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">잔여</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">소진율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allBalances.map((b) => {
                      const remaining = Number(b.total_days) - Number(b.used_days);
                      const pct = Number(b.total_days) > 0
                        ? Math.round((Number(b.used_days) / Number(b.total_days)) * 100)
                        : 0;
                      return (
                        <tr key={b.employee_id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-semibold text-gray-800">{b.employee_name}</td>
                          <td className="py-2.5 px-3 text-gray-500 text-xs">{b.dept ?? "-"}</td>
                          <td className="py-2.5 px-3 text-center text-gray-700">{Number(b.total_days).toFixed(0)}일</td>
                          <td className="py-2.5 px-3 text-center text-orange-600">{Number(b.used_days).toFixed(1)}일</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-semibold ${
                              remaining > 5 ? "text-emerald-600"
                              : remaining > 0 ? "text-amber-600"
                              : "text-red-600"
                            }`}>{remaining.toFixed(1)}일</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    pct < 50 ? "bg-emerald-400"
                                    : pct < 80 ? "bg-amber-400"
                                    : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 전직원 이력 */}
            <h3 className="font-semibold text-gray-700 text-sm mb-3 border-t border-gray-100 pt-4">전체 조정 이력 (최근 200건)</h3>
            {allHistory.length === 0 ? (
              <p className="text-sm text-gray-400">이력이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">일시</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">직원</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">구분</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">변동</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">이전</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">이후</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">사유</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">처리자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {h.created_at.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="py-2 px-3 text-xs font-semibold text-gray-700">{h.employee_name}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            ADJUSTMENT_TYPE_COLOR[h.adjustment_type] ?? "bg-gray-100 text-gray-700"
                          }`}>
                            {ADJUSTMENT_TYPE_LABEL[h.adjustment_type] ?? h.adjustment_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-semibold">
                          <span className={Number(h.delta) >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {Number(h.delta) >= 0 ? "+" : ""}{Number(h.delta).toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-500 text-xs">{Number(h.before_days).toFixed(1)}일</td>
                        <td className="py-2 px-3 text-center text-gray-700 text-xs font-semibold">{Number(h.after_days).toFixed(1)}일</td>
                        <td className="py-2 px-3 text-xs text-gray-600 max-w-[180px] truncate">{h.reason}</td>
                        <td className="py-2 px-3 text-xs text-gray-500">{h.adjusted_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
