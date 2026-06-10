export default function EmptyState({
  icon,
  message,
  hint,
}: {
  icon?: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="py-8 text-center text-gray-400">
      {icon && <div className="text-3xl mb-2">{icon}</div>}
      <div className="text-sm">{message}</div>
      {hint && <div className="text-xs mt-1">{hint}</div>}
    </div>
  );
}
