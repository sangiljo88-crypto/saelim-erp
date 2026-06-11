import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import MeetingActions from "@/components/MeetingActions";
import { createServerClient } from "@/lib/supabase";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateWithDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${dateStr} (${WEEKDAY_KO[d.getUTCDay()]})`;
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // 회의록은 manager 이상만 열람
  if (session.role === "worker") redirect("/");

  const { id } = await params;
  const db = createServerClient();

  const { data: meeting } = await db
    .from("meeting_minutes")
    .select("id, meeting_date, title, content_html, summary, author, source, created_at")
    .eq("id", id)
    .single();

  if (!meeting) notFound();

  const isCoo = session.role === "coo";

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="회의록" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                📝 {formatDateWithDay(meeting.meeting_date)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{meeting.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>{meeting.author}</span>
              <span>·</span>
              <span>
                {new Date(meeting.created_at).toLocaleString("ko-KR", {
                  month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                })} 등록
              </span>
            </div>
          </div>

          {/* 본문 HTML 렌더링 — 브리핑과 동일한 스타일 클래스 재사용 */}
          <div
            className="px-6 py-6 briefing-content"
            dangerouslySetInnerHTML={{ __html: meeting.content_html }}
          />

          {/* 하단 */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <a
              href="/meetings"
              className="text-xs text-[#1F3864] hover:underline flex items-center gap-1"
            >
              ← 목록으로
            </a>

            {isCoo && <MeetingActions meetingId={id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
