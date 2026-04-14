import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";

type Props = {
  searchParams: Promise<{ period?: string; customer?: string }>;
};

type CustomerRow = {
  customer_name: string;
  revenue: number;
  delivery_count: number;
  claim_count: number;
  claim_rate: number;
  grade: "A" | "B" | "C" | "D";
};

function gradeColor(grade: string) {
  switch (grade) {
    case "A": return "bg-emerald-100 text-emerald-700";
    case "B": return "bg-blue-100 text-blue-700";
    case "C": return "bg-amber-100 text-amber-700";
    case "D": return "bg-red-100 text-red-700";
    default:  return "bg-gray-100 text-gray-600";
  }
}

function assignGrades(rows: Omit<CustomerRow, "grade">[]): CustomerRow[] {
  const total = rows.length;
  if (total === 0) return [];
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  return sorted.map((row, i) => {
    const pct = (i + 1) / total;
    let grade: "A" | "B" | "C" | "D";
    if (pct <= 0.2) grade = "A";
    else if (pct <= 0.5) grade = "B";
    else if (pct <= 0.8) grade = "C";
    else grade = "D";
    return { ...row, grade };
  });
}

function periodLabel(period: string) {
  switch (period) {
    case "1m": return "이번 달";
    case "3m": return "최근 3개월";
    case "6m": return "최근 6개월";
    case "1y": return "올해";
    default:   return "이번 달";
  }
}

function periodStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case "1m": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    case "3m": return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
    case "6m": return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
    case "1y": return `${now.getFullYear()}-01-01`;
    default:   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  }
}

export default async function ProfitabilityPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    redirect("/login");
  }

  const params = await searchParams;
  const period = params.period ?? "1m";
  const selectedCustomer = params.customer ?? null;
  const startDate = periodStartDate(period);

  const db = createServerClient();

  // 납품 데이터 조회 (기간 필터)
  const { data: deliveries } = await db
    .from("deliveries")
    .select("customer_name, total_amount, delivery_date, status, items")
    .gte("delivery_date", startDate)
    .order("delivery_date", { ascending: false });

  // 클레임 데이터 조회 (기간 필터)
  const { data: claims } = await db
    .from("claims")
    .select("client_name, claim_date, status")
    .gte("claim_date", startDate);

  // 거래처별 집계
  const revenueMap = new Map<string, { revenue: number; count: number }>();
  for (const d of deliveries ?? []) {
    const name = d.customer_name;
    if (!name) continue;
    const existing = revenueMap.get(name) ?? { revenue: 0, count: 0 };
    existing.revenue += Number(d.total_amount ?? 0);
    existing.count += 1;
    revenueMap.set(name, existing);
  }

  // 클레임 집계
  const claimMap = new Map<string, number>();
  for (const c of claims ?? []) {
    const name = c.client_name;
    if (!name) continue;
    claimMap.set(name, (claimMap.get(name) ?? 0) + 1);
  }

  // 통합
  const rawRows: Omit<CustomerRow, "grade">[] = [];
  for (const [name, stats] of revenueMap) {
    const claimCount = claimMap.get(name) ?? 0;
    rawRows.push({
      customer_name: name,
      revenue: stats.revenue,
      delivery_count: stats.count,
      claim_count: claimCount,
      claim_rate: stats.count > 0 ? (claimCount / stats.count) * 100 : 0,
    });
  }

  const rows = assignGrades(rawRows);

  // 요약 통계
  const totalCustomers = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const avgRevenue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // 선택된 거래처의 납품 내역
  const selectedDeliveries = selectedCustomer
    ? (deliveries ?? []).filter((d) => d.customer_name === selectedCustomer)
    : [];

  const periods = [
    { key: "1m", label: "이번 달" },
    { key: "3m", label: "3개월" },
    { key: "6m", label: "6개월" },
    { key: "1y", label: "올해" },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="거래처 수익성 분석" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">거래처 수익성 분석</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              거래처별 매출 / 클레임 분석 ({periodLabel(period)})
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/customers" className="text-xs text-[#1F3864] hover:underline">
              거래처 관리
            </a>
            <span className="text-xs text-gray-300">|</span>
            <a href={session.role === "ceo" ? "/dashboard" : "/coo"} className="text-xs text-[#1F3864] hover:underline">
              대시보드
            </a>
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-2">
          {periods.map((p) => (
            <a
              key={p.key}
              href={`/customers/profitability?period=${p.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-[#1F3864] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </a>
          ))}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">총 거래처 수</div>
            <div className="text-xl font-bold text-[#1F3864]">{totalCustomers}곳</div>
            <div className="text-xs text-gray-400 mt-0.5">납품 실적 있는 거래처</div>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">총 매출</div>
            <div className="text-xl font-bold text-emerald-600">
              {(totalRevenue / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}만원
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{periodLabel(period)} 기준</div>
          </div>
          <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs text-gray-500 mb-1">평균 거래처당 매출</div>
            <div className="text-xl font-bold text-blue-600">
              {(avgRevenue / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}만원
            </div>
            <div className="text-xs text-gray-400 mt-0.5">거래처 평균</div>
          </div>
        </div>

        {/* 거래처별 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">거래처</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">매출(원)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">납품건수</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">클레임(건)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">클레임률(%)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">수익 등급</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      해당 기간 납품 실적이 없습니다
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={row.customer_name}
                      className={`border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                        selectedCustomer === row.customer_name ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/customers/profitability?period=${period}&customer=${encodeURIComponent(row.customer_name)}`}
                          className="font-medium text-[#1F3864] hover:underline"
                        >
                          {row.customer_name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {row.revenue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">{row.delivery_count}</td>
                      <td className="px-4 py-3 text-right">
                        {row.claim_count > 0 ? (
                          <span className="text-red-600 font-semibold">{row.claim_count}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.claim_rate > 0 ? (
                          <span className={row.claim_rate >= 10 ? "text-red-600 font-semibold" : "text-amber-600"}>
                            {row.claim_rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">0%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${gradeColor(row.grade)}`}>
                          {row.grade}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 선택된 거래처 납품 상세 */}
        {selectedCustomer && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                {selectedCustomer} 납품 내역
              </h2>
              <a
                href={`/customers/profitability?period=${period}`}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                닫기
              </a>
            </div>
            {selectedDeliveries.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">납품 내역 없음</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">날짜</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">금액(원)</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">상태</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">품목수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDeliveries.map((d, i) => {
                      const statusMap: Record<string, { label: string; color: string }> = {
                        shipped:   { label: "배송중", color: "bg-amber-100 text-amber-700" },
                        delivered: { label: "완료",   color: "bg-emerald-100 text-emerald-700" },
                        pending:   { label: "대기",   color: "bg-gray-100 text-gray-600" },
                        cancelled: { label: "취소",   color: "bg-red-100 text-red-600" },
                      };
                      const st = statusMap[d.status] ?? { label: d.status, color: "bg-gray-100 text-gray-600" };
                      const itemCount = Array.isArray(d.items) ? d.items.length : 0;
                      return (
                        <tr key={i} className="border-b last:border-b-0">
                          <td className="px-3 py-2 text-gray-600">{d.delivery_date}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {Number(d.total_amount ?? 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{itemCount}종</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP - 거래처 수익성 분석
        </footer>
      </main>
    </div>
  );
}
