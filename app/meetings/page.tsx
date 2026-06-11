import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { createServerClient } from "@/lib/supabase";

interface MeetingRow {
  id: string;
  meeting_date: string;
  title: string;
  summary: string | null;
  author: string;
  created_at: string;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateWithDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${dateStr} (${WEEKDAY_KO[d.getUTCDay()]})`;
}

export default async function MeetingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // 회의록은 manager 이상만 열람
  if (session.role === "worker") redirect("/");

  const db = createServerClient();

  let meetings: MeetingRow[] = [];
  try {
    const { data } = await db
      .from("meeting_minutes")
      .select("id, meeting_date, title, summary, author, created_at")
      .order("meeting_date", { ascending: false })
      .order("created_at", { ascending: false });
    meetings = (data ?? []) as MeetingRow[];
  } catch {
    // 테이블 미존재(마이그레이션 미실행) 시 빈 목록으로 폴백
  }

  // 월별 그룹핑 — "2026-06" → 해당 월 회의록 목록
  const monthOrder: string[] = [];
  const monthGroups: Record<string, MeetingRow[]> = {};
  for (const m of meetings) {
    const month = m.meeting_date.slice(0, 7);
    if (!monthGroups[month]) {
      monthOrder.push(month);
      monthGroups[month] = [];
    }
    monthGroups[month].push(m);
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="회의록" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">회의록</h1>
            <p className="text-sm text-gray-500">아침회의 기록 · 일자별 누적 이력 · 매니저 이상 열람</p>
          </div>
        </div>

        {meetings.length === 0 ? (
          <Card padding="p-2">
            <EmptyState
              icon="📝"
              message="등록된 회의록이 없습니다"
              hint="아침회의 녹취(txt)가 변환되면 여기에 일자별로 쌓입니다"
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {monthOrder.map((month) => {
              const items = monthGroups[month];
              const [y, mo] = month.split("-");
              return (
                <div key={month} className="flex flex-col gap-2">
                  {/* 월 헤더 */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold shrink-0 bg-[#1F3864] text-white">
                      🗓 {y}년 {Number(mo)}월
                    </div>
                    <div className="flex-1 border-t border-gray-100" />
                    <span className="text-xs text-gray-400 shrink-0">{items.length}건</span>
                  </div>

                  {/* 해당 월 회의록 목록 */}
                  <div className="flex flex-col gap-2">
                    {items.map((m) => (
                      <a
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="bg-white rounded-xl border border-gray-200 hover:border-[#1F3864]/30 hover:shadow-sm transition-all flex items-start gap-3 px-5 py-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              📝 {formatDateWithDay(m.meeting_date)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-800 leading-snug">{m.title}</div>
                          {m.summary && (
                            <p className="text-xs text-gray-500 mt-1 truncate">{m.summary}</p>
                          )}
                          <div className="text-xs text-gray-400 mt-1">{m.author}</div>
                        </div>
                        <span className="text-gray-300 text-sm shrink-0 mt-1">›</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
