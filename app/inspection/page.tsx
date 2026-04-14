import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ShipmentInspectionForm from "@/components/ShipmentInspectionForm";
import { getInspections } from "@/app/actions/inspection";
import type { InspectionItem } from "@/app/actions/inspection";

interface Props {
  searchParams: Promise<{ delivery_id?: string; customer?: string }>;
}

export default async function InspectionPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role === "worker") redirect("/login");

  const params = await searchParams;
  const deliveryId = params.delivery_id ?? null;
  const defaultCustomer = params.customer ?? "";

  let inspections: {
    id: string;
    inspection_date: string;
    customer_name: string;
    inspector_name: string;
    overall_pass: boolean;
    items: InspectionItem[];
    temp_reading: number | null;
    notes: string | null;
  }[] = [];

  try {
    inspections = await getInspections();
  } catch {
    // 테이블 미존재 시 무시
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="출하 검품" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">출하 검품 체크리스트</h1>
            <p className="text-sm text-gray-500">납품 전 품질검사 기록</p>
          </div>
          <a
            href={session.role === "ceo" ? "/dashboard" : session.role === "coo" ? "/coo" : "/team"}
            className="text-xs text-[#1F3864] hover:underline"
          >
            ← 대시보드
          </a>
        </div>

        {/* 검품 입력 폼 */}
        <ShipmentInspectionForm
          deliveryId={deliveryId}
          defaultCustomer={defaultCustomer}
        />

        {/* 최근 검품 이력 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">최근 검품 이력</h2>
            <span className="text-xs text-gray-400">최근 20건</span>
          </div>

          {inspections.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              검품 기록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {inspections.map((insp) => {
                const itemCount = Array.isArray(insp.items) ? insp.items.length : 0;
                return (
                  <div key={insp.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="text-sm text-gray-500 w-24 shrink-0">{insp.inspection_date}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{insp.customer_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        검품자: {insp.inspector_name} · {itemCount}품목
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        insp.overall_pass
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {insp.overall_pass ? "합격" : "불합격"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 출하 검품 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
