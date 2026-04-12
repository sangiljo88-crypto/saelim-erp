import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import YieldDashboard from "@/components/YieldDashboard";
import { createServerClient } from "@/lib/supabase";

export default async function YieldPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "worker") redirect("/worker");

  const db = createServerClient();

  // 최근 30일 기준
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const [{ data: logs }, { data: products }] = await Promise.all([
    db.from("production_logs")
      .select("work_date, dept, product_id, product_name, input_qty, output_qty, yield_rate, issue_note, worker_name")
      .gte("work_date", since)
      .order("work_date", { ascending: true }),
    db.from("products")
      .select("id, name, sale_price, unit")
      .eq("is_active", true)
      .gt("sale_price", 0),
  ]);

  // product_id → sale_price 맵
  const priceById: Record<string, number> = {};
  const priceByName: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.sale_price > 0) {
      priceById[p.id] = p.sale_price;
      priceByName[p.name] = p.sale_price;
    }
  }

  // 부분 매칭: production_logs의 품목명이 products 테이블과 다를 때 키워드로 연결
  // ex) "돼지 머리" → 머리류 평균가, "돼지 뼈" → 뼈류 대표가
  const keywordPriceMap: Record<string, number> = {};
  if (products && products.length > 0) {
    const grouped: Record<string, number[]> = {};
    for (const p of products) {
      if (p.sale_price > 0 && p.unit === "kg") {
        // 대분류 키워드 추출 (괄호 앞 단어들)
        const keywords = p.name.replace(/\s*\(.*?\)/g, "").trim().split(/\s+/);
        for (const kw of keywords) {
          if (kw.length >= 2) {
            if (!grouped[kw]) grouped[kw] = [];
            grouped[kw].push(p.sale_price);
          }
        }
      }
    }
    // 키워드별 평균 단가
    for (const [kw, prices] of Object.entries(grouped)) {
      keywordPriceMap[kw] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }
    // 자주 쓰이는 합성어 추가
    keywordPriceMap["머리"]     ??= keywordPriceMap["통머리"] ?? 5000;
    keywordPriceMap["뼈"]       ??= 1800;
    keywordPriceMap["껍데기"]   ??= 2800;
    keywordPriceMap["내장"]     ??= 3500;
    keywordPriceMap["족발"]     ??= 6800;
    keywordPriceMap["막창"]     ??= 6500;
    keywordPriceMap["소장"]     ??= 2500;
    keywordPriceMap["대장"]     ??= 2200;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="수율 현황" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-gray-800">📊 수율 현황 대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">생산 수율 추이 · 품목별 분석 · 이슈 추적</p>
        </div>
        <YieldDashboard logs={logs ?? []} priceById={priceById} priceByName={priceByName} keywordPriceMap={keywordPriceMap} />
      </main>
    </div>
  );
}
