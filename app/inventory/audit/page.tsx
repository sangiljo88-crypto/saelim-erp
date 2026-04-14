import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import InventoryAuditForm from "@/components/InventoryAuditForm";
import { getAuditByDate, getAuditHistory } from "@/app/actions/inventory-audit";
import AuditStarter from "./AuditStarter";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function InventoryAuditPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  // COO, CEO, 재고팀장 접근 가능
  const canAccess =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && session.dept === "재고팀");
  if (!canAccess) redirect("/login");

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.date || today;

  // 선택된 날짜의 실사 데이터
  const auditEntries = await getAuditByDate(selectedDate);
  const isFinalized = auditEntries.length > 0 && auditEntries.every((e) => e.adjusted);

  // 실사 이력
  const history = await getAuditHistory(10);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="재고실사" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">재고실사 모드</h1>
            <p className="text-sm text-gray-500">
              실물 재고 실사 vs 시스템 재고 비교 · 차이 조정
            </p>
          </div>
          <a href="/inventory" className="text-xs text-[#1F3864] hover:underline">
            ← 재고 현황
          </a>
        </div>

        {/* 실사 진행 중 또는 실사 시작 */}
        {auditEntries.length > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-600">
                {isFinalized ? "실사 완료" : "실사 진행 중"} — {selectedDate}
              </h2>
              {isFinalized && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                  확정됨
                </span>
              )}
              {!isFinalized && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
                  진행중
                </span>
              )}
            </div>
            <InventoryAuditForm
              entries={auditEntries}
              auditDate={selectedDate}
              isCoo={session.role === "coo"}
              isFinalized={isFinalized}
            />
          </>
        ) : (
          <AuditStarter defaultDate={today} />
        )}

        {/* 실사 이력 */}
        {history.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              실사 이력
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((h) => (
                <a
                  key={h.date}
                  href={`/inventory/audit?date=${h.date}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1F3864]/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">{h.date}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        h.adjusted
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {h.adjusted ? "확정" : "미확정"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>전체 {h.totalItems}건</span>
                    <span className={h.itemsWithDiff > 0 ? "text-red-500 font-semibold" : ""}>
                      차이 {h.itemsWithDiff}건
                    </span>
                    <span>조정량 {h.totalAdjustment.toFixed(1)}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 재고실사 · Supabase 실데이터
        </footer>
      </main>
    </div>
  );
}
