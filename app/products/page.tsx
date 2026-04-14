import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ProductMasterSection from "@/components/ProductMasterSection";
import { getProducts } from "@/app/actions/products";
import { getShelfLifeSettings } from "@/app/actions/expiry";

const ALLOWED_ROLES = new Set(["manager", "coo", "ceo"]);

export default async function ProductsPage() {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.has(session.role)) redirect("/login");

  const products = await getProducts();

  // 유통기한 마스터 맵 로드
  let shelfLifeMap: Record<string, number> = {};
  try {
    const shelfLifeSettings = await getShelfLifeSettings();
    for (const sl of shelfLifeSettings) {
      shelfLifeMap[sl.product_code] = sl.shelf_life_days;
    }
  } catch {
    // 테이블 미존재 시 무시
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="품목 마스터 관리" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-800">품목 마스터 관리</h1>
            <p className="text-sm text-gray-500">
              전체 {products.length}개 품목 · 행 클릭으로 인라인 편집 · 엑셀 업/다운로드
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 매입관리 바로가기 */}
            <a
              href="/purchases"
              className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#1F3864]/30 text-[#1F3864] px-4 py-2 rounded-lg hover:bg-[#1F3864] hover:text-white transition-colors whitespace-nowrap"
            >
              📦 매입관리
            </a>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold">
              관리자 전용
            </span>
          </div>
        </div>

        <ProductMasterSection initialProducts={products} shelfLifeMap={shelfLifeMap} />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 품목 마스터 · Supabase 연동
        </footer>
      </main>
    </div>
  );
}
