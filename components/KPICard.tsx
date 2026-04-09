"use client";

interface KPICardProps {
  title: string;
  actual: number | string;
  target: number | string;
  unit: string;
  achievementRate?: number;
  icon: string;
  isGood?: boolean; // false면 낮을수록 좋음 (클레임, 미수금 등)
}

function formatValue(val: number | string, unit: string): string {
  if (typeof val === "string") return val;
  if (unit === "원") {
    if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(1)}억`;
    if (val >= 10_000) return `${(val / 10_000).toFixed(0)}만`;
    return val.toLocaleString();
  }
  if (unit === "%") return `${val.toFixed(1)}%`;
  return `${val}${unit}`;
}

export default function KPICard({ title, actual, target, unit, achievementRate, icon, isGood = true }: KPICardProps) {
  const rate = achievementRate ?? (typeof actual === "number" && typeof target === "number" ? (actual / target) * 100 : 100);

  let colorClass = "text-emerald-600";
  let bgClass = "bg-emerald-50 border-emerald-200";
  let badgeClass = "bg-emerald-100 text-emerald-700";

  if (isGood) {
    if (rate < 90) { colorClass = "text-red-600"; bgClass = "bg-red-50 border-red-200"; badgeClass = "bg-red-100 text-red-700"; }
    else if (rate < 97) { colorClass = "text-amber-600"; bgClass = "bg-amber-50 border-amber-200"; badgeClass = "bg-amber-100 text-amber-700"; }
  } else {
    if (rate > 130) { colorClass = "text-red-600"; bgClass = "bg-red-50 border-red-200"; badgeClass = "bg-red-100 text-red-700"; }
    else if (rate > 110) { colorClass = "text-amber-600"; bgClass = "bg-amber-50 border-amber-200"; badgeClass = "bg-amber-100 text-amber-700"; }
  }

  return (
    <div className={`rounded-xl border p-5 ${bgClass} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {formatValue(actual as number, unit)}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>목표: {formatValue(target as number, unit)}</span>
        <span className={`px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>
          {rate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
