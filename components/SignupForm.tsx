"use client";

import { useActionState } from "react";
import { signup } from "@/app/actions/signup";
import Link from "next/link";

const DEPTS = [
  { value: "생산팀",   label: "🏭 생산팀 (두/내장·공장장)" },
  { value: "가공팀",   label: "⚙️ 가공팀 (포장가공)" },
  { value: "스킨팀",   label: "🔪 스킨팀 (스킨작업)" },
  { value: "재고팀",   label: "📦 재고팀 (냉동냉장 재고)" },
  { value: "품질팀",   label: "🔍 품질팀 (HACCP·순찰)" },
  { value: "배송팀",   label: "🚚 배송팀" },
  { value: "CS팀",     label: "📞 CS팀 (클레임관리)" },
  { value: "마케팅팀", label: "📊 마케팅팀 (영업)" },
  { value: "회계팀",   label: "💰 회계팀 (재무)" },
  { value: "온라인팀", label: "🛒 온라인팀 (쿠팡·스마트스토어)" },
  { value: "개발팀",   label: "🧪 개발팀 (개발이사·R&D)" },
];

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {state.error}
        </div>
      )}

      {/* 이름 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          required
          placeholder="홍길동"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/10 outline-none"
        />
      </div>

      {/* 아이디 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          아이디 <span className="text-red-500">*</span>
        </label>
        <input
          name="login_id"
          type="text"
          required
          placeholder="영문+숫자 조합 (예: hong123)"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/10 outline-none"
        />
      </div>

      {/* 비밀번호 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            name="password"
            type="password"
            required
            placeholder="4자 이상"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/10 outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            비밀번호 확인 <span className="text-red-500">*</span>
          </label>
          <input
            name="confirm"
            type="password"
            required
            placeholder="다시 입력"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] focus:ring-2 focus:ring-[#1F3864]/10 outline-none"
          />
        </div>
      </div>

      {/* 부서 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          부서 <span className="text-red-500">*</span>
        </label>
        <select
          name="dept"
          required
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none bg-white"
        >
          <option value="">-- 부서 선택 --</option>
          {DEPTS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* 직책 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">직책</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "worker",  label: "👷 작업자", desc: "일일 입력 담당" },
            { value: "manager", label: "👔 팀장",   desc: "부서 관리 담당" },
          ].map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 cursor-pointer hover:border-[#1F3864] hover:bg-[#1F3864]/5 transition-colors"
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                defaultChecked={r.value === "worker"}
                className="accent-[#1F3864]"
              />
              <div>
                <div className="text-sm font-semibold text-gray-800">{r.label}</div>
                <div className="text-xs text-gray-400">{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-60 transition-all mt-1"
      >
        {pending ? "등록 중..." : "계정 만들기"}
      </button>

      <p className="text-center text-sm text-gray-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="text-[#1F3864] font-semibold hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
