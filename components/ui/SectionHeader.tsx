const BADGE_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
};

export default function SectionHeader({
  title,
  badge,
  badgeColor = "gray",
  action,
}: {
  title: string;
  badge?: string | number;
  badgeColor?: "gray" | "red" | "amber" | "emerald" | "blue";
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
        {badge !== undefined && badge !== null && badge !== "" && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE_COLORS[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
