import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";
import { getClaimSlaStats, getClaimPatterns } from "@/app/actions/claim-sla";

export default async function ClaimSlaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // COO/CEO/CS팀/품질팀 접근 허용
  const allowed =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && ["CS팀", "품질팀"].includes(session.dept ?? ""));
  if (!allowed) redirect("/login");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthStart = `${thisMonth}-01`;

  // SLA 통계
  const slaStats = await getClaimSlaStats(monthStart);

  // 패턴 분석
  const patterns = await getClaimPatterns(3);

  // 미해결 클레임 (SLA 카운트다운)
  const db = createServerClient();
  const { data: unresolvedClaims } = await db
    .from("claims")
    .select("id, claim_date, created_at, client_name, product_names, status, first_response_at")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true });

  const unresolved = unresolvedClaims ?? [];

  function getElapsedHours(createdAt: string): number {
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  }

  function getSlaStatus(hours: number): { label: string; color: string; bgColor: string } {
    if (hours < 24) return { label: "정상", color: "text-emerald-700", bgColor: "bg-emerald-100" };
    if (hours < 72) return { label: "주의", color: "text-amber-700", bgColor: "bg-amber-100" };
    return { label: "초과", color: "text-red-700", bgColor: "bg-red-100" };
  }

  const responseTarget = 24;
  const resolutionTarget = 72;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="클레임 SLA 분석" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">클레임 SLA 분석</h1>
            <p className="text-sm text-gray-500">응답시간 추적 / 패턴 분석 / 미해결 현황</p>
          </div>
          <a
            href="/claims"
            className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
          >
            ← 클레임 관리
          </a>
        </div>

        {/* a) SLA 현황 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 평균 1차 응답시간 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-2">평균 1차 응답시간</div>
            <div className="flex items-end gap-2">
              <span
                className={`text-2xl font-bold ${
                  slaStats.avgResponseHours <= responseTarget
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {slaStats.avgResponseHours > 0
                  ? `${slaStats.avgResponseHours}시간`
                  : "-"}
              </span>
              <span className="text-xs text-gray-400 mb-1">
                목표: {responseTarget}시간 이내
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  slaStats.avgResponseHours <= responseTarget
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(
                    (slaStats.avgResponseHours / responseTarget) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 평균 해결시간 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-2">평균 해결시간</div>
            <div className="flex items-end gap-2">
              <span
                className={`text-2xl font-bold ${
                  slaStats.avgResolutionHours <= resolutionTarget
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {slaStats.avgResolutionHours > 0
                  ? `${slaStats.avgResolutionHours}시간`
                  : "-"}
              </span>
              <span className="text-xs text-gray-400 mb-1">
                목표: {resolutionTarget}시간 이내
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  slaStats.avgResolutionHours <= resolutionTarget
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(
                    (slaStats.avgResolutionHours / resolutionTarget) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 이번달 보상 총액 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-2">이번달 보상 총액</div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#1F3864]">
                {slaStats.compensationTotal > 0
                  ? `${(slaStats.compensationTotal / 10000).toLocaleString()}만원`
                  : "0원"}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              전체 {slaStats.totalClaims}건 / 해결 {slaStats.resolvedCount}건
            </div>
          </div>
        </div>

        {/* b) 패턴 분석 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            반복 클레임 품목 (최근 3개월)
          </h2>
          {patterns.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              분석 데이터가 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      품목명
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      클레임 횟수
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      최근 3개월
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      주요 원인
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patterns.map((p) => (
                    <tr
                      key={p.productName}
                      className={p.isRepeatOffender ? "bg-red-50" : ""}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            p.isRepeatOffender
                              ? "text-red-700"
                              : "text-gray-800"
                          }`}
                        >
                          {p.productName}
                        </span>
                        {p.isRepeatOffender && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                            반복
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {p.totalCount}
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-semibold ${
                          p.recentMonthsCount >= 3
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {p.recentMonthsCount}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.topCause}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* c) 미해결 클레임 + SLA 카운트다운 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            미해결 클레임 ({unresolved.length}건)
          </h2>
          {unresolved.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              미해결 클레임이 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      접수일
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      품목
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      거래처
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      경과시간
                    </th>
                    <th className="text-center px-4 py-3 text-xs text-gray-500 font-medium">
                      SLA 상태
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unresolved.map((c) => {
                    const hours = getElapsedHours(c.created_at);
                    const sla = getSlaStatus(hours);
                    const productList = Array.isArray(c.product_names)
                      ? c.product_names.join(", ")
                      : "-";

                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-gray-600">
                          {c.claim_date ?? c.created_at?.split("T")[0]}
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">
                          {productList}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {c.client_name}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-700">
                          {hours < 1
                            ? `${Math.round(hours * 60)}분`
                            : `${Math.round(hours)}시간`}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full ${sla.bgColor} ${sla.color}`}
                          >
                            {sla.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP / 클레임 SLA 분석
        </footer>
      </main>
    </div>
  );
}
