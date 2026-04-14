import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CustomerPricingTable from "@/components/CustomerPricingTable";
import { getCustomerPrices } from "@/app/actions/pricing";
import { getProducts } from "@/app/actions/products";
import { createServerClient } from "@/lib/supabase";

export default async function PricingSettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    redirect("/login");
  }

  const [prices, allProducts] = await Promise.all([
    getCustomerPrices(),
    getProducts(),
  ]);

  // 거래처 목록 조회
  let customers: { id: string; name: string }[] = [];
  try {
    const db = createServerClient();
    const { data } = await db
      .from("customers")
      .select("id, name")
      .eq("active", true)
      .order("name");
    customers = (data ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
    }));
  } catch {
    // 테이블 없으면 빈 배열
  }

  const productOptions = allProducts.map((p) => ({
    code: p.code,
    name: p.name,
    sale_price: p.sale_price,
  }));

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="거래처별 단가 설정" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">거래처별 단가 매트릭스</h1>
            <p className="text-sm text-gray-500">
              동일 품목도 거래처마다 다른 단가 적용 · 납품전표 자동 연동
            </p>
          </div>
          <a
            href={session.role === "ceo" ? "/dashboard" : "/coo"}
            className="text-xs text-[#1F3864] hover:underline"
          >
            ← 대시보드
          </a>
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{prices.length}</div>
            <div className="text-xs text-gray-500 mt-1">등록 단가 수</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {new Set(prices.map((p) => p.customer_name)).size}
            </div>
            <div className="text-xs text-gray-500 mt-1">거래처 수</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {new Set(prices.map((p) => p.product_name)).size}
            </div>
            <div className="text-xs text-gray-500 mt-1">품목 수</div>
          </div>
        </div>

        <CustomerPricingTable
          prices={prices}
          customers={customers}
          products={productOptions}
          isCoo={session.role === "coo"}
        />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 거래처 단가 관리 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
