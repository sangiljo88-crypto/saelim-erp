"use client";

export interface ActionItemRow {
  id: string | number;
  title: string;
  dept: string;
  deadline: string;
  status: "완료" | "진행" | "지연";
}

const statusStyle: Record<ActionItemRow["status"], string> = {
  완료: "bg-emerald-100 text-emerald-700",
  진행: "bg-blue-100 text-blue-700",
  지연: "bg-red-100 text-red-700",
};

export default function ActionItems({ items }: { items: ActionItemRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 hover:shadow-sm transition-shadow">
          <span className="text-gray-400 font-bold text-sm w-5 shrink-0">{typeof item.id === "number" ? item.id : "·"}</span>
          <span className="flex-1 text-sm font-medium text-gray-800">{item.title}</span>
          <span className="text-xs text-gray-400 shrink-0">{item.dept}</span>
          <span className="text-xs text-gray-400 shrink-0">{item.deadline}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle[item.status]}`}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}
