"use client";

import { Department, RagStatus } from "@/lib/sampleData";

function RagBadge({ status }: { status: RagStatus }) {
  const map = {
    green: { bg: "bg-emerald-500", label: "정상" },
    yellow: { bg: "bg-amber-400", label: "주의" },
    red: { bg: "bg-red-500", label: "경고" },
  };
  const { bg, label } = map[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full ${bg} inline-block`} />
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </div>
  );
}

export default function DeptStatusTable({ departments }: { departments: Department[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1F3864] text-white text-xs">
            <th className="py-3 px-4 text-left font-semibold">부서</th>
            <th className="py-3 px-4 text-center font-semibold">상태</th>
            <th className="py-3 px-4 text-left font-semibold">이번 주 이슈</th>
            <th className="py-3 px-4 text-left font-semibold">COO 코멘트</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((dept, i) => (
            <tr key={dept.name} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
              <td className="py-3 px-4 font-semibold text-[#1F3864]">{dept.name}</td>
              <td className="py-3 px-4 text-center"><RagBadge status={dept.status} /></td>
              <td className="py-3 px-4 text-gray-700">{dept.issue}</td>
              <td className="py-3 px-4 text-gray-500 italic">{dept.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
