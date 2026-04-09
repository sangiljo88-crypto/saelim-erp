"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="id" className="text-sm font-medium text-gray-700">아이디</label>
        <input
          id="id"
          name="id"
          type="text"
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          required
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/20 outline-none transition-all"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          required
          className="rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/20 outline-none transition-all"
        />
      </div>

      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-[#1F3864] px-4 py-3 text-sm font-semibold text-white hover:bg-[#162c52] disabled:opacity-60 transition-colors"
      >
        {pending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
