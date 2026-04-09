import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#1F3864] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">새</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">새림 ERP 계정 만들기</h1>
          <p className="text-sm text-gray-500 mt-2">부서와 직책을 선택해 가입하세요</p>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <SignupForm />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          새림 ERP v1.0 · 내부 임직원 전용
        </p>
      </div>
    </div>
  );
}
