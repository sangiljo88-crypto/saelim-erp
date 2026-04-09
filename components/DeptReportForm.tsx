"use client";

import { useActionState } from "react";
import { submitDeptReport } from "@/app/actions/submit";

interface ExistingReport {
  id: string;
  rag_status: string;
  issue: string;
  detail?: string | null;
  next_action?: string | null;
  status: string;
  coo_comment?: string | null;
  coo_updated_at?: string | null;
}

interface Props {
  dept: string;
  existing?: ExistingReport | null;
}

const RAG_OPTIONS = [
  { value: "green",  label: "🟢 정상",  desc: "목표 달성 중" },
  { value: "yellow", label: "🟡 주의",  desc: "일부 지표 미달" },
  { value: "red",    label: "🔴 경고",  desc: "즉시 조치 필요" },
];

export default function DeptReportForm({ dept, existing }: Props) {
  const [state, action, pending] = useActionState(submitDeptReport, null);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">주간 보고서 작성</h3>
          <p className="text-xs text-gray-400 mt-0.5">작성하면 COO에게 즉시 전달됩니다</p>
        </div>
        {existing?.status === "reviewed" && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
            COO 검토 완료
          </span>
        )}
        {existing?.status === "submitted" && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
            제출됨 · 검토 대기
          </span>
        )}
      </div>

      {/* COO 코멘트 표시 (있을 경우) */}
      {existing?.coo_comment && (
        <div className="mx-5 mt-4 bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-xl px-4 py-3">
          <div className="text-xs font-semibold text-[#1F3864] mb-1">💬 COO 코멘트</div>
          <div className="text-sm text-gray-700">{existing.coo_comment}</div>
        </div>
      )}

      <form action={action} className="px-5 py-4 flex flex-col gap-4">
        <input type="hidden" name="report_date" value={today} />

        {/* 상태 선택 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            부서 현황 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {RAG_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 cursor-pointer transition-all hover:border-gray-300"
              >
                <input
                  type="radio"
                  name="rag_status"
                  value={opt.value}
                  defaultChecked={
                    existing?.rag_status === opt.value ||
                    (!existing && opt.value === "green")
                  }
                  className="sr-only"
                />
                <span className="text-lg">{opt.label.split(" ")[0]}</span>
                <span className="text-xs font-semibold text-gray-700">{opt.label.split(" ")[1]}</span>
                <span className="text-[10px] text-gray-400">{opt.desc}</span>
              </label>
            ))}
          </div>
          {/* 실제 라디오 선택 처리를 위한 숨김 스타일 적용 */}
          <style>{`
            input[type="radio"]:checked + * + * + label,
            label:has(input[type="radio"]:checked) {
              border-color: #1F3864;
              background: #1F3864/5;
            }
          `}</style>
        </div>

        {/* 핵심 이슈 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            이번 주 핵심 이슈 <span className="text-red-500">*</span>
          </label>
          <input
            name="issue"
            type="text"
            required
            defaultValue={existing?.issue ?? ""}
            placeholder="예: 수율 91.2% — 목표 92% 미달, 3라인 설비 점검 중"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none"
          />
        </div>

        {/* 상세 내용 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">상세 내용 / 수치</label>
          <textarea
            name="detail"
            rows={3}
            defaultValue={existing?.detail ?? ""}
            placeholder="구체적인 수치, 원인 분석, 조치 내용 등..."
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none"
          />
        </div>

        {/* 다음 주 계획 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">다음 주 계획</label>
          <input
            name="next_action"
            type="text"
            defaultValue={existing?.next_action ?? ""}
            placeholder="예: 3라인 설비 점검 완료 후 정상 가동 목표"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none"
          />
        </div>

        {state?.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            ⚠️ {state.error}
          </div>
        )}

        {state?.success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
            ✅ COO에게 전달되었습니다!
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-60 transition-all"
        >
          {pending ? "제출 중..." : existing ? "보고서 업데이트" : "COO에게 보고"}
        </button>
      </form>
    </div>
  );
}
