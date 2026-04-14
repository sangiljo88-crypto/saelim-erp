import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CustomerDashboard from "@/components/CustomerDashboard";
import { createServerClient } from "@/lib/supabase";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const db = createServerClient();

  // 기준일
  const today     = new Date().toISOString().split("T")[0];
  const since30   = new Date(Date.now() - 30  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const since90   = new Date(Date.now() - 90  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    { data: customers },
    { data: recentDeliveries },
    { data: openClaims },
  ] = await Promise.all([
    db.from("customers")
      .select("id, name, type, contact_name, phone, address, monthly_avg, payment_terms, products, memo, active, created_at")
      .eq("active", true)
      .order("monthly_avg", { ascending: false }),

    // 최근 90일 납품 (거래처별 실적 계산용)
    db.from("deliveries")
      .select("customer_name, delivery_date, total_amount")
      .gte("delivery_date", since90)
      .order("delivery_date", { ascending: false }),

    // 미처리·처리중 클레임
    db.from("claims")
      .select("client_name, status, claim_date, claim_type")
      .in("status", ["pending", "in_progress"]),
  ]);

  // 거래처별 납품 실적 집계
  type DeliveryStats = {
    lastDate: string;
    total90: number;
    total30: number;
    count90: number;
  };
  const deliveryMap: Record<string, DeliveryStats> = {};
  for (const d of recentDeliveries ?? []) {
    if (!deliveryMap[d.customer_name]) {
      deliveryMap[d.customer_name] = { lastDate: d.delivery_date, total90: 0, total30: 0, count90: 0 };
    }
    const s = deliveryMap[d.customer_name];
    if (d.delivery_date > s.lastDate) s.lastDate = d.delivery_date;
    s.total90  += d.total_amount || 0;
    s.count90  += 1;
    if (d.delivery_date >= since30) s.total30 += d.total_amount || 0;
  }

  // 거래처별 미처리 클레임 집계
  const claimMap: Record<string, { pending: number; inProgress: number }> = {};
  for (const c of openClaims ?? []) {
    if (!claimMap[c.client_name]) claimMap[c.client_name] = { pending: 0, inProgress: 0 };
    if (c.status === "pending")     claimMap[c.client_name].pending++;
    if (c.status === "in_progress") claimMap[c.client_name].inProgress++;
  }

  // 관계 건강도 계산
  function healthScore(name: string): "good" | "warn" | "risk" {
    const d = deliveryMap[name];
    const c = claimMap[name];
    const pendingClaims = c?.pending ?? 0;
    const inProgressClaims = c?.inProgress ?? 0;

    if (pendingClaims >= 2) return "risk";

    const daysSinceLast = d?.lastDate
      ? Math.floor((Date.now() - new Date(d.lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceLast > 60) return "risk";
    if (pendingClaims > 0 || inProgressClaims > 0 || daysSinceLast > 30) return "warn";
    return "good";
  }

  // 데이터 조립
  const enriched = (customers ?? []).map((c) => ({
    ...c,
    delivery: deliveryMap[c.name] ?? null,
    claims:   claimMap[c.name]   ?? null,
    health:   healthScore(c.name),
  }));

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="거래처 관리" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">🤝 거래처 관계 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">납품 실적 · 클레임 이력 · 관계 건강도</p>
          </div>
          {(session.role === "coo" || session.role === "ceo") && (
            <a
              href="/customers/profitability"
              className="flex items-center gap-2 bg-[#1F3864] text-white rounded-xl px-4 py-2.5 hover:bg-[#2a4a7f] transition-colors text-sm font-medium"
            >
              💰 수익성 분석
            </a>
          )}
        </div>
        <CustomerDashboard
          customers={enriched}
          canEdit={session.role === "coo" || session.role === "manager"}
        />
      </main>
    </div>
  );
}
