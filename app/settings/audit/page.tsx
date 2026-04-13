import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createServerClient } from "@/lib/supabase";

const ENTITY_LABELS: Record<string, string> = {
  product: "품목",
  frozen_inventory: "냉동재고",
  material_purchase: "원재료매입",
  cost_approval: "비용승인",
  purchase_payment: "매입결제",
  staff_salary: "급여",
};

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  create: { label: "등록", color: "bg-emerald-100 text-emerald-700" },
  update: { label: "수정", color: "bg-blue-100 text-blue-700" },
  delete: { label: "삭제", color: "bg-red-100 text-red-700" },
};

function ChangeSummary({ changes }: { changes: Record<string, { before: unknown; after: unknown }> | null }) {
  if (!changes) return <span className="text-gray-400">-</span>;
  const entries = Object.entries(changes);
  if (entries.length === 0) return <span className="text-gray-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.slice(0, 3).map(([key, val]) => (
        <span key={key} className="text-xs text-gray-600">
          <span className="font-medium">{key}</span>:{" "}
          {val.before !== null && val.before !== undefined ? String(val.before) : "–"} →{" "}
          {val.after !== null && val.after !== undefined ? String(val.after) : "–"}
        </span>
      ))}
      {entries.length > 3 && (
        <span className="text-xs text-gray-400">외 {entries.length - 3}건</span>
      )}
    </div>
  );
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo")) {
    redirect("/login");
  }

  const params = await searchParams;
  const filterEntityType = params.entityType || "";

  const db = createServerClient();
  let query = db
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filterEntityType) {
    query = query.eq("entity_type", filterEntityType);
  }

  const { data: logs } = await query;
  const auditLogs = (logs ?? []) as Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    entity_name: string | null;
    changes: Record<string, { before: unknown; after: unknown }> | null;
    performed_by: string;
    performed_by_name: string;
    dept: string | null;
    created_at: string;
  }>;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="감사 로그" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">감사 로그</h1>
            <p className="text-sm text-gray-500">
              주요 데이터 변경 이력 · 최근 200건
            </p>
          </div>
          <a
            href="/coo"
            className="text-sm text-blue-600 hover:underline"
          >
            ← COO 대시보드
          </a>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <form className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-600">대상 필터:</label>
            <select
              name="entityType"
              defaultValue={filterEntityType}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-[#1F3864] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#2a4a7f] transition-colors"
            >
              조회
            </button>
          </form>
        </div>

        {/* 로그 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">일시</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">작업</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">대상</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">상세</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">변경내용</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">수행자</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      감사 로그가 없습니다
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const badge = ACTION_BADGE[log.action] ?? {
                      label: log.action,
                      color: "bg-gray-100 text-gray-600",
                    };
                    const entityLabel =
                      ENTITY_LABELS[log.entity_type] ?? log.entity_type;
                    const createdAt = new Date(log.created_at);
                    const dateStr = `${(createdAt.getMonth() + 1).toString().padStart(2, "0")}/${createdAt.getDate().toString().padStart(2, "0")} ${createdAt.getHours().toString().padStart(2, "0")}:${createdAt.getMinutes().toString().padStart(2, "0")}`;

                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {entityLabel}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {log.entity_name ?? log.entity_id ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <ChangeSummary changes={log.changes} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          <div className="text-xs">
                            <span className="font-medium">{log.performed_by_name}</span>
                            {log.dept && (
                              <span className="text-gray-400 ml-1">({log.dept})</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0 · 감사 로그
        </footer>
      </main>
    </div>
  );
}
