import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BriefingForm from "@/components/BriefingForm";
import { createServerClient } from "@/lib/supabase";

export default async function BriefingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "coo") redirect("/briefings");

  const { id } = await params;
  const db = createServerClient();
  const { data: briefing } = await db
    .from("briefings")
    .select("id, week_label, publish_date, category, title, content_html, author, is_pinned")
    .eq("id", id)
    .single();

  if (!briefing) notFound();

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="브리핑 수정" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-800">브리핑 수정</h1>
            <p className="text-sm text-gray-500 truncate max-w-xs">{briefing.title}</p>
          </div>
          <a href={`/briefings/${id}`} className="text-xs text-[#1F3864] hover:underline">← 돌아가기</a>
        </div>

        <BriefingForm
          authorName={`COO ${session.name}`}
          initial={{
            id:           briefing.id,
            week_label:   briefing.week_label,
            publish_date: briefing.publish_date,
            category:     briefing.category,
            title:        briefing.title,
            content_html: briefing.content_html,
            author:       briefing.author,
            is_pinned:    briefing.is_pinned,
          }}
        />
      </main>
    </div>
  );
}
