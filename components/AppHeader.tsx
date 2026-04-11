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
    <header className="bg-[#1F3864] text-white shadow-lg">
      <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between">
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
      </div>

      {/* 네비게이션 바 */}
      <nav className="px-4 sm:px-6 pb-2 flex items-center gap-1 overflow-x-auto">
        <a
          href={session.role === "ceo" ? "/dashboard" : session.role === "coo" ? "/coo" : session.role === "worker" ? "/worker" : "/team"}
          className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          🏠 홈
        </a>
        <a
          href="/briefings"
          className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          📰 브리핑
        </a>
        {(session.role === "coo" || session.role === "ceo") && (
          <a
            href="/claims"
            className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            📋 클레임
          </a>
        )}
        {(session.role === "coo" || session.role === "ceo") && (
          <a
            href="/inventory"
            className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            🏭 재고
          </a>
        )}
        {(session.role === "coo" || session.role === "ceo") && (
          <a
            href="/maintenance"
            className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            🔧 설비
          </a>
        )}
        {(session.role === "coo" || session.role === "ceo") && (
          <a
            href="/utility"
            className="text-xs text-blue-200 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            ⚡ 유틸리티
          </a>
        )}
        {session.role === "coo" && (
          <a
            href="/briefings/new"
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0 font-semibold"
          >
            ✏️ 브리핑 등록
          </a>
        )}
      </nav>
    </header>
  );
}
