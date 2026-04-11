import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BriefingForm from "@/components/BriefingForm";

export default async function BriefingNewPage() {
  const session = await getSession();
  if (!session || session.role !== "coo") redirect("/briefings");

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="브리핑 등록" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-800">브리핑 등록</h1>
            <p className="text-sm text-gray-500">업계동향 또는 주간브리핑 작성</p>
          </div>
          <a href="/briefings" className="text-xs text-[#1F3864] hover:underline">← 목록으로</a>
        </div>
        <BriefingForm authorName={`COO ${session.name}`} />
      </main>
    </div>
  );
}
