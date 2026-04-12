import { getSession, STAFF_USERS } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BriefingList from "@/components/BriefingList";
import { createServerClient } from "@/lib/supabase";

export default async function BriefingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "coo" || session.role === "ceo";
  const db = createServerClient();

  const { data: briefings } = await db
    .from("briefings")
    .select("id, week_label, publish_date, category, title, author, is_pinned, created_at")
    .order("is_pinned", { ascending: false })
    .order("publish_date", { ascending: false });

  // COO/CEO만 열람 수 가져오기
  let readCounts: Record<string, number> = {};
  if (isAdmin && briefings && briefings.length > 0) {
    const { data: reads } = await db
      .from("briefing_reads")
      .select("briefing_id")
      .in("briefing_id", briefings.map((b) => b.id));
    if (reads) {
      for (const r of reads) {
        readCounts[r.briefing_id] = (readCounts[r.briefing_id] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="브리핑" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">브리핑 게시판</h1>
            <p className="text-sm text-gray-500">업계동향 · 현장팀 · 물류팀 · 품질CS팀 · 영업마케팅팀 · 경영지원팀</p>
          </div>
          {session.role === "coo" && (
            <a
              href="/briefings/new"
              className="flex items-center gap-1 text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f]"
            >
              ✏️ 브리핑 등록
            </a>
          )}
        </div>

        <BriefingList
          initialBriefings={(briefings ?? []) as Parameters<typeof BriefingList>[0]["initialBriefings"]}
          isCoo={session.role === "coo"}
          isAdmin={isAdmin}
          readCounts={readCounts}
          totalStaff={STAFF_USERS.length}
        />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP · 브리핑 게시판
        </footer>
      </main>
    </div>
  );
}
