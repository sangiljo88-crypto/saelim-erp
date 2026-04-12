import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import WeeklyReport from "@/components/WeeklyReport";
import { createServerClient } from "@/lib/supabase";

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ceo" && session.role !== "coo") redirect("/");

  const db = createServerClient();

  // 이번 주 범위 (오늘 기준 최근 7일)
  const until = new Date().toISOString().split("T")[0];
  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since = sinceDate.toISOString().split("T")[0];

  // 전주 범위
  const prevUntil = since;
  const prevSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  // 주 레이블 (날짜 범위로 표시)
  const weekLabel = `${since.slice(5).replace("-", "/")} ~ ${until.slice(5).replace("-", "/")}`;

  const [
    { data: production },
    { data: prevProduction },
    { data: thisWeekClaims },
    { data: openClaims },
    { data: prevWeekClaims },
    { data: deptReports },
    { data: costApprovals },
    { data: maintenance },
    { data: deliveries },
    { data: prevDeliveries },
    { data: products },
  ] = await Promise.all([
    // 이번 주 생산
    db.from("production_logs")
      .select("work_date, dept, product_id, product_name, input_qty, output_qty, yield_rate, issue_note")
      .gte("work_date", since)
      .order("work_date", { ascending: false }),

    // 전주 생산 (비교용)
    db.from("production_logs")
      .select("yield_rate, input_qty, output_qty")
      .gte("work_date", prevSince)
      .lt("work_date", prevUntil),

    // 이번 주 신규 클레임 (날짜 기준)
    db.from("claims")
      .select("id, claim_date, client_name, claim_type, content, status, dept")
      .gte("claim_date", since)
      .order("claim_date", { ascending: false }),

    // 누적 미처리·처리중 클레임 (날짜 무관)
    db.from("claims")
      .select("id, claim_date, client_name, claim_type, content, status, dept")
      .in("status", ["pending", "in_progress"])
      .order("claim_date", { ascending: false }),

    // 전주 신규 클레임 수 (비교용)
    db.from("claims")
      .select("id")
      .gte("claim_date", prevSince)
      .lt("claim_date", prevUntil),

    // 팀별 주간 보고
    db.from("dept_reports")
      .select("id, report_date, dept, manager_name, rag_status, issue, next_action, coo_comment")
      .gte("report_date", since)
      .order("report_date", { ascending: false }),

    // 비용 승인 대기
    db.from("cost_approvals")
      .select("id, title, dept, requested_by, request_date, amount, status")
      .eq("status", "pending")
      .order("request_date", { ascending: false }),

    // 설비 이슈
    db.from("maintenance_logs")
      .select("id, log_date, equipment_name, dept, log_type, description, result, cost")
      .or(`result.eq.진행중,log_date.gte.${since}`)
      .order("log_date", { ascending: false }),

    // 이번 주 납품
    db.from("deliveries")
      .select("delivery_date, customer_name, total_amount, status")
      .gte("delivery_date", since)
      .order("delivery_date", { ascending: false }),

    // 전주 납품 (비교용)
    db.from("deliveries")
      .select("total_amount")
      .gte("delivery_date", prevSince)
      .lt("delivery_date", prevUntil),

    // 단가 맵용 products
    db.from("products")
      .select("id, name, sale_price, unit")
      .eq("is_active", true)
      .gt("sale_price", 0),
  ]);

  // 단가 맵 빌드
  const priceById: Record<string, number> = {};
  const priceByName: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.sale_price > 0) {
      priceById[p.id] = p.sale_price;
      priceByName[p.name] = p.sale_price;
    }
  }

  const keywordPriceMap: Record<string, number> = {};
  if (products && products.length > 0) {
    const grouped: Record<string, number[]> = {};
    for (const p of products) {
      if (p.sale_price > 0 && p.unit === "kg") {
        const keywords = p.name.replace(/\s*\(.*?\)/g, "").trim().split(/\s+/);
        for (const kw of keywords) {
          if (kw.length >= 2) {
            if (!grouped[kw]) grouped[kw] = [];
            grouped[kw].push(p.sale_price);
          }
        }
      }
    }
    for (const [kw, prices] of Object.entries(grouped)) {
      keywordPriceMap[kw] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }
    keywordPriceMap["머리"]   ??= keywordPriceMap["통머리"] ?? 5000;
    keywordPriceMap["뼈"]     ??= 1800;
    keywordPriceMap["껍데기"] ??= 2800;
    keywordPriceMap["내장"]   ??= 3500;
    keywordPriceMap["족발"]   ??= 6800;
    keywordPriceMap["막창"]   ??= 6500;
    keywordPriceMap["소장"]   ??= 2500;
    keywordPriceMap["대장"]   ??= 2200;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] print:bg-white">
      <div className="print:hidden">
        <AppHeader session={session} subtitle="주간 경영 보고서" />
      </div>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 print:px-0 print:py-4">
        <WeeklyReport
          weekLabel={weekLabel}
          since={since}
          until={until}
          production={production ?? []}
          prevProduction={prevProduction ?? []}
          thisWeekClaims={thisWeekClaims ?? []}
          openClaims={openClaims ?? []}
          prevWeekClaimsCount={(prevWeekClaims ?? []).length}
          deptReports={deptReports ?? []}
          costApprovals={costApprovals ?? []}
          maintenance={maintenance ?? []}
          deliveries={deliveries ?? []}
          prevDeliveryTotal={(prevDeliveries ?? []).reduce((s, d) => s + (d.total_amount || 0), 0)}
          priceById={priceById}
          priceByName={priceByName}
          keywordPriceMap={keywordPriceMap}
        />
      </main>
    </div>
  );
}
