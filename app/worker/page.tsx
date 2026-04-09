import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import WorkerForms from "@/components/WorkerForms";

export default async function WorkerPage() {
  const session = await getSession();
  if (!session || session.role !== "worker") redirect("/login");

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="작업자 입력" />
      <main className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-800">오늘의 업무 입력</h1>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString("ko-KR")} · {session.dept}</p>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">작업자</span>
        </div>

        <WorkerForms dept={session.dept ?? ""} />

        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          새림 ERP v1.0
        </footer>
      </main>
    </div>
  );
}
