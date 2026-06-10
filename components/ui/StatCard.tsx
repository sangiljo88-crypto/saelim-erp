const TONE_COLORS: Record<string, string> = {
  default: "text-[#1F3864]",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};

export default function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-full">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${TONE_COLORS[tone]}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
