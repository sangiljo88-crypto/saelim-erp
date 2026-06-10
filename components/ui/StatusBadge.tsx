const TONE_STYLES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-700",
};

export default function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  );
}
