import { logout } from "@/app/actions/auth";
import { SessionPayload } from "@/lib/auth";

const roleLabel: Record<string, string> = {
  ceo: "대표이사",
  coo: "COO",
  manager: "팀장",
  worker: "작업자",
};

const roleColor: Record<string, string> = {
  ceo: "bg-purple-100 text-purple-700",
  coo: "bg-blue-100 text-blue-700",
  manager: "bg-emerald-100 text-emerald-700",
  worker: "bg-amber-100 text-amber-700",
};

export default function AppHeader({ session, subtitle }: { session: SessionPayload; subtitle?: string }) {
  return (
    <header className="bg-[#1F3864] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">새</div>
        <div>
          <div className="text-base font-bold leading-tight">새림 ERP</div>
          {subtitle && <div className="text-xs text-blue-200">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColor[session.role]}`}>
            {roleLabel[session.role]}
          </span>
          <span className="text-sm text-blue-100">{session.name}</span>
          {session.dept && <span className="text-xs text-blue-300">· {session.dept}</span>}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs text-blue-200 hover:text-white border border-blue-400/40 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
