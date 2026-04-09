"use client";

interface Alert {
  level: string;
  message: string;
}

export default function AlertPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            alert.level === "red"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-amber-50 border border-amber-200 text-amber-800"
          }`}
        >
          <span className="text-base shrink-0">{alert.level === "red" ? "🔴" : "🟡"}</span>
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
