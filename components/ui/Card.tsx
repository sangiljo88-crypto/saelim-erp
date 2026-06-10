export default function Card({
  children,
  className = "",
  padding = "p-5",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${padding} ${className}`}>
      {children}
    </div>
  );
}
