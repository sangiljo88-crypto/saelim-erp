import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import TestAccountsSection from "@/components/TestAccountsSection";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await getSession();
  if (session) {
    const map = { ceo: "/dashboard", coo: "/coo", manager: "/team", worker: "/worker" };
    redirect(map[session.role]);
  }
  const { registered } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F3864] to-[#2d5299] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 카드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur text-3xl font-black text-white mb-4 shadow-lg">
            새
          </div>
          <h1 className="text-2xl font-bold text-white">새림 ERP</h1>
          <p className="text-blue-200 text-sm mt-1">전사 운영 관리 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">로그인</h2>
          {registered && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">
              ✅ 가입 완료! 로그인해주세요.
            </div>
          )}
          <LoginForm />

          {/* 역할별 안내 */}
          <TestAccountsSection />
        </div>

        <div className="text-center mt-5">
          <Link
            href="/signup"
            className="inline-block text-sm text-blue-200 hover:text-white underline underline-offset-2 transition-colors"
          >
            처음 사용하시나요? 계정 만들기 →
          </Link>
        </div>
        <p className="text-center text-blue-200/60 text-xs mt-3">
          새림 ERP v1.0 · Supabase 연동
        </p>
      </div>
    </div>
  );
}
