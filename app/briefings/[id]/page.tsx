import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BriefingActions from "@/components/BriefingActions";
import BriefingInteractions from "@/components/BriefingInteractions";
import { createServerClient } from "@/lib/supabase";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  "all":          { label: "전체 공지",    color: "bg-gray-100 text-gray-700" },
  "업계동향":     { label: "업계동향",     color: "bg-blue-100 text-blue-700" },
  "현장팀":       { label: "현장팀",       color: "bg-orange-100 text-orange-700" },
  "물류팀":       { label: "물류팀",       color: "bg-sky-100 text-sky-700" },
  "품질CS팀":     { label: "품질CS팀",     color: "bg-purple-100 text-purple-700" },
  "영업마케팅팀": { label: "영업마케팅팀", color: "bg-emerald-100 text-emerald-700" },
  "경영지원팀":   { label: "경영지원팀",   color: "bg-rose-100 text-rose-700" },
  // 레거시
  "market":       { label: "업계동향",     color: "bg-blue-100 text-blue-700" },
  "weekly":       { label: "주간브리핑",   color: "bg-emerald-100 text-emerald-700" },
};

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const db = createServerClient();

  const [{ data: briefing }, { data: reads }, { data: comments }] = await Promise.all([
    db.from("briefings")
      .select("id, week_label, publish_date, category, title, content_html, author, is_pinned, created_at")
      .eq("id", id).single(),
    db.from("briefing_reads")
      .select("user_id, user_name")
      .eq("briefing_id", id)
      .order("created_at", { ascending: true }),
    db.from("briefing_comments")
      .select("id, user_id, user_name, content, created_at")
      .eq("briefing_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!briefing) notFound();

  const catMeta = CATEGORY_META[briefing.category] ?? { label: briefing.category, color: "bg-gray-100 text-gray-600" };
  const isCoo = session.role === "coo";

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="브리핑" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {briefing.is_pinned && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">📌 고정</span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catMeta.color}`}>
                {catMeta.label}
              </span>
              <span className="text-xs text-gray-400">{briefing.week_label}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{briefing.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>{briefing.author}</span>
              <span>·</span>
              <span>{briefing.publish_date}</span>
            </div>
          </div>

          {/* 본문 HTML 렌더링 */}
          <div
            className="px-6 py-6 briefing-content"
            dangerouslySetInnerHTML={{ __html: briefing.content_html }}
          />

          {/* 읽었어요 + 댓글 */}
          <BriefingInteractions
            briefingId={id}
            initialReads={reads ?? []}
            initialComments={comments ?? []}
            currentUserId={session.id}
            currentUserName={session.name}
            isCoo={isCoo}
          />

          {/* 하단 */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <a
              href="/briefings"
              className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
            >
              ← 목록으로
            </a>

            {isCoo && (
              <BriefingActions briefingId={id} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
