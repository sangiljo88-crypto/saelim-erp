"use client";

import { useState, useTransition } from "react";
import { createStaffMember, toggleMemberActive, resetMemberPassword, saveStaffSalary } from "@/app/actions/submit";

interface StaffMember {
  id: string;
  login_id: string;
  name: string;
  role: string;
  dept: string | null;
  active: boolean;
  created_at: string | null;
  isLegacy: boolean;
  base_salary?: number;
}

interface Props {
  staff: StaffMember[];
  canEdit: boolean;
  salaryMap?: Record<string, number>;  // login_id → base_salary (원 단위)
}

const ROLE_LABEL: Record<string, string> = {
  ceo:     "대표",
  coo:     "COO",
  manager: "팀장",
  worker:  "작업자",
};

const ROLE_BADGE: Record<string, string> = {
  ceo:     "bg-purple-100 text-purple-700 border border-purple-200",
  coo:     "bg-blue-100 text-blue-700 border border-blue-200",
  manager: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  worker:  "bg-amber-100 text-amber-700 border border-amber-200",
};

type FilterTab = "all" | "manager" | "worker";

export default function StaffManager({ staff, canEdit, salaryMap }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // 요약 통계
  const totalCount    = staff.length;
  const dbCount       = staff.filter(m => !m.isLegacy).length;
  const legacyCount   = staff.filter(m => m.isLegacy).length;
  const inactiveCount = staff.filter(m => !m.active).length;
  const salarySetCount   = staff.filter(m => (m.base_salary ?? 0) > 0).length;
  const salaryUnsetCount = staff.length - salarySetCount;

  // 필터링
  const filtered = staff.filter(m => {
    if (filter === "all") return true;
    if (filter === "manager") return m.role === "manager";
    if (filter === "worker")  return m.role === "worker";
    return true;
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await createStaffMember(formData);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFormSuccess(true);
        form.reset();
        setTimeout(() => {
          setFormSuccess(false);
          setShowForm(false);
        }, 1500);
      }
    });
  }

  function handleToggleActive(member: StaffMember) {
    startTransition(async () => {
      const result = await toggleMemberActive(member.id, !member.active);
      if (result.error) {
        setActionMsg(`오류: ${result.error}`);
      } else {
        setActionMsg(`${member.name} 계정을 ${!member.active ? "활성화" : "비활성화"}했습니다`);
        setTimeout(() => setActionMsg(null), 2500);
      }
    });
  }

  function handleResetPassword(member: StaffMember) {
    const newPw = prompt(`${member.name}의 새 비밀번호를 입력하세요 (4자 이상):`);
    if (!newPw) return;
    startTransition(async () => {
      const result = await resetMemberPassword(member.id, newPw);
      if (result.error) {
        setActionMsg(`오류: ${result.error}`);
      } else {
        setActionMsg(`${member.name} 비밀번호가 변경되었습니다`);
        setTimeout(() => setActionMsg(null), 2500);
      }
    });
  }

  function handleSaveSalary(member: StaffMember) {
    const input = prompt(`${member.name}의 기본급을 입력하세요 (만원 단위):`);
    if (!input) return;
    const newBaseSalary = Number(input);
    if (isNaN(newBaseSalary) || newBaseSalary < 0) {
      alert("올바른 금액을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const result = await saveStaffSalary(member.login_id, member.name, member.dept, newBaseSalary * 10000);
      if (result.error) {
        setActionMsg(`오류: ${result.error}`);
      } else {
        setActionMsg(`${member.name} 기본급이 저장되었습니다`);
        setTimeout(() => setActionMsg(null), 2500);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 액션 알림 */}
      {actionMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-2.5 rounded-xl">
          {actionMsg}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "전체 직원",      value: totalCount,      color: "text-gray-800" },
          { label: "DB 등록",        value: dbCount,         color: "text-blue-700" },
          { label: "레거시(코드)",   value: legacyCount,     color: "text-gray-500" },
          { label: "비활성",         value: inactiveCount,   color: "text-red-600"  },
          { label: "기본급 설정완료", value: salarySetCount,  color: "text-emerald-700" },
          { label: "미설정",         value: salaryUnsetCount, color: "text-amber-600" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 신규 직원 등록 폼 */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setFormError(null); setFormSuccess(false); }}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span>+ 신규 직원 등록</span>
            <span className="text-gray-400">{showForm ? "▲" : "▼"}</span>
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className="px-5 pb-5 border-t border-gray-100 pt-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">아이디 *</label>
                  <input
                    name="login_id"
                    type="text"
                    required
                    placeholder="예: w_proc3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                  <input
                    name="name"
                    type="text"
                    required
                    placeholder="예: 홍길동"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">초기 비밀번호 *</label>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="4자 이상"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">역할 *</label>
                  <select
                    name="role"
                    required
                    defaultValue=""
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  >
                    <option value="" disabled>역할 선택</option>
                    <option value="manager">팀장</option>
                    <option value="worker">작업자</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
                  <input
                    name="dept"
                    type="text"
                    placeholder="예: 가공팀 (선택사항)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  직원이 등록되었습니다.
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[#1F3864] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#162a50] disabled:opacity-50 transition-colors"
                >
                  {isPending ? "등록 중..." : "등록"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 역할별 필터 탭 */}
      <div className="flex gap-1.5">
        {(["all", "manager", "worker"] as FilterTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`text-sm px-4 py-1.5 rounded-full font-medium transition-colors ${
              filter === tab
                ? "bg-[#1F3864] text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab === "all" ? "전체" : tab === "manager" ? "팀장" : "작업자"}
            <span className="ml-1.5 text-xs opacity-70">
              {tab === "all"
                ? totalCount
                : staff.filter(m => m.role === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* 직원 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">이름</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">아이디</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">부서</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">역할</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">기본급</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">소스</th>
                {canEdit && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    해당하는 직원이 없습니다
                  </td>
                </tr>
              )}
              {filtered.map(member => (
                <tr key={`${member.isLegacy ? "legacy" : "db"}-${member.id}`} className={`hover:bg-gray-50 transition-colors ${!member.active ? "opacity-50" : ""}`}>
                  {/* 이름 */}
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {member.name}
                    {!member.active && (
                      <span className="ml-1.5 text-xs text-red-500 font-normal">(비활성)</span>
                    )}
                  </td>

                  {/* 아이디 */}
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {member.login_id}
                  </td>

                  {/* 부서 */}
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {member.dept ?? <span className="text-gray-300">—</span>}
                  </td>

                  {/* 역할 배지 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABEL[member.role] ?? member.role}
                    </span>
                  </td>

                  {/* 기본급 */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      {(member.base_salary ?? 0) > 0 ? (
                        <span className="text-sm text-gray-700">
                          {((member.base_salary ?? 0) / 10000).toLocaleString()}만원
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">미설정</span>
                      )}
                      {canEdit && !member.isLegacy && (
                        <button
                          type="button"
                          onClick={() => handleSaveSalary(member)}
                          disabled={isPending}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                          title="기본급 수정"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 소스 배지 */}
                  <td className="px-4 py-3">
                    {member.isLegacy ? (
                      <span
                        className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 cursor-help"
                        title="코드에 하드코딩된 계정입니다. 동일한 아이디로 DB 계정을 등록하면 자동으로 교체됩니다."
                      >
                        코드
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                        DB
                      </span>
                    )}
                  </td>

                  {/* 관리 버튼 */}
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      {!member.isLegacy ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(member)}
                            disabled={isPending}
                            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                              member.active
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(member)}
                            disabled={isPending}
                            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            비밀번호
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">
                          코드 계정
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 레거시 안내 */}
        {legacyCount > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-gray-500">코드</span> 배지 계정은 코드에 하드코딩된 레거시 계정입니다.
              동일한 아이디로 DB 계정을 등록하면 자동으로 DB 계정으로 교체됩니다.
            </p>
          </div>
        )}
      </div>

      {/* 급여 관리 바로가기 */}
      {canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-800">💴 이번달 급여 입력</div>
            <div className="text-xs text-amber-600 mt-0.5">월별 연장수당·상여 입력 → CEO 인건비 KPI 반영</div>
          </div>
          <a href="/payroll" className="text-sm bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors">
            급여 입력 →
          </a>
        </div>
      )}
    </div>
  );
}
