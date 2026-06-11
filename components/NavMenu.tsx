"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

// ──────────────────────────────────────────────
// 메뉴 정의 — 역할/부서 기반 노출 필터
// ──────────────────────────────────────────────
type Role = "ceo" | "coo" | "manager" | "worker";

interface NavItem {
  label: string;
  href: string;
  roles: Role[];          // 노출 대상 역할
  depts?: string[];       // manager일 때 부서 제한 (없으면 모든 부서)
  cooOnly?: boolean;      // coo 전용 (roles보다 우선)
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["ceo", "coo", "manager", "worker"];
const MGMT: Role[] = ["ceo", "coo"];
const MGMT_MGR: Role[] = ["ceo", "coo", "manager"];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "생산·품질",
    items: [
      { label: "수율 현황",     href: "/yield",               roles: MGMT },
      { label: "원가 분석",     href: "/yield/cost-analysis", roles: MGMT },
      { label: "클레임",        href: "/claims",              roles: MGMT_MGR },
      { label: "클레임 SLA",    href: "/claims/sla",          roles: MGMT },
      { label: "검품",          href: "/inspection",          roles: MGMT_MGR },
      { label: "LOT 이력추적",  href: "/lot",                 roles: MGMT_MGR },
    ],
  },
  {
    label: "재고·구매",
    items: [
      { label: "창고 재고",     href: "/inventory",           roles: MGMT },
      { label: "재고 실사",     href: "/inventory/audit",     roles: MGMT_MGR, depts: ["재고팀"] },
      { label: "매입 관리",     href: "/purchases",           roles: ["coo", "manager"] },
      { label: "자재 소요",     href: "/procurement",         roles: MGMT_MGR, depts: ["재고팀", "생산팀"] },
      { label: "품목 마스터",   href: "/products",            roles: MGMT_MGR },
    ],
  },
  {
    label: "영업·배송",
    items: [
      { label: "거래처",        href: "/customers",               roles: ALL },
      { label: "거래처 수익성", href: "/customers/profitability", roles: MGMT },
      { label: "거래처 단가",   href: "/settings/pricing",        roles: MGMT },
      { label: "납품 이력",     href: "/deliveries",              roles: MGMT_MGR },
      { label: "배차일지",      href: "/dispatch",                roles: ALL },
      { label: "유류비 분석",   href: "/dispatch/fuel",           roles: MGMT_MGR },
    ],
  },
  {
    label: "경영지원",
    items: [
      { label: "비용 승인",     href: "/approvals",             roles: MGMT_MGR },
      { label: "회의록",        href: "/meetings",              roles: MGMT_MGR },
      { label: "주간보고",      href: "/report",                roles: MGMT },
      { label: "회계",          href: "/accounting",            roles: MGMT },
      { label: "급여",          href: "/payroll",               roles: [], cooOnly: true },
      { label: "직원 관리",     href: "/staff",                 roles: MGMT },
      { label: "연차 현황",     href: "/schedule/leave",        roles: ALL },
      { label: "설비 관리",     href: "/maintenance",           roles: MGMT },
      { label: "정비 스케줄",   href: "/maintenance/schedule",  roles: MGMT },
      { label: "유틸리티",      href: "/utility",               roles: MGMT },
      { label: "KPI 목표",      href: "/settings/kpi",          roles: MGMT },
      { label: "감사 로그",     href: "/settings/audit",        roles: MGMT },
    ],
  },
];

function visibleItems(group: NavGroup, role: Role, dept?: string): NavItem[] {
  return group.items.filter((item) => {
    if (item.cooOnly) return role === "coo";
    if (!item.roles.includes(role)) return false;
    if (role === "manager" && item.depts && !item.depts.includes(dept ?? "")) return false;
    return true;
  });
}

// ──────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────
export default function NavMenu({
  role,
  dept,
  hasNewBriefing,
}: {
  role: Role;
  dept?: string;
  hasNewBriefing: boolean;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // 경로 이동 시 메뉴 닫기
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  const homePath =
    role === "ceo" ? "/dashboard" : role === "coo" ? "/coo" : role === "worker" ? "/worker" : "/team";

  const groups = NAV_GROUPS
    .map((g) => ({ label: g.label, items: visibleItems(g, role, dept) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === pathname || (href !== "/" && pathname.startsWith(href + "/"));

  const groupHasActive = (items: NavItem[]) => items.some((i) => isActive(i.href));

  const topLink = (href: string, label: string, badge?: boolean) => (
    <a
      key={href}
      href={href}
      className={`relative text-[13px] px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
        isActive(href) ? "bg-white/15 text-white font-semibold" : "text-blue-200 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
      {badge && <span className="absolute top-1 right-0.5 w-2 h-2 bg-red-400 rounded-full" />}
    </a>
  );

  return (
    <div ref={navRef}>
      {/* ── 데스크톱 네비게이션 ── */}
      <nav className="hidden md:flex items-center gap-0.5 px-4 sm:px-6 pb-2">
        {topLink(homePath, "홈")}
        {topLink("/briefings", "브리핑", hasNewBriefing)}
        {topLink("/schedule", "일정")}

        <span className="w-px h-4 bg-white/20 mx-1.5 shrink-0" />

        {groups.map((g) =>
          g.items.length <= 2 ? (
            // 항목 1~2개 그룹은 평면 링크로
            g.items.map((item) => topLink(item.href, item.label))
          ) : (
            <div key={g.label} className="relative shrink-0">
              <button
                onClick={() => setOpenGroup(openGroup === g.label ? null : g.label)}
                className={`flex items-center gap-1 text-[13px] px-3 py-1.5 rounded-lg transition-colors ${
                  groupHasActive(g.items) || openGroup === g.label
                    ? "bg-white/15 text-white font-semibold"
                    : "text-blue-200 hover:text-white hover:bg-white/10"
                }`}
              >
                {g.label}
                <svg
                  className={`w-3 h-3 transition-transform ${openGroup === g.label ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openGroup === g.label && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[180px]">
                  {g.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isActive(item.href)
                          ? "bg-blue-50 text-[#1F3864] font-semibold"
                          : "text-gray-700 hover:bg-gray-50 hover:text-[#1F3864]"
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {role === "coo" && (
          <a
            href="/briefings/new"
            className="ml-auto text-[13px] bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0 font-semibold"
          >
            ✏️ 브리핑 등록
          </a>
        )}
      </nav>

      {/* ── 모바일: 햄버거 + 핵심 3개 ── */}
      <nav className="flex md:hidden items-center gap-1 px-4 pb-2">
        {topLink(homePath, "홈")}
        {topLink("/briefings", "브리핑", hasNewBriefing)}
        {topLink("/schedule", "일정")}
        {groups.length > 0 && (
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ml-auto flex items-center gap-1.5 text-[13px] text-blue-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            전체 메뉴
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        )}
      </nav>

      {/* ── 모바일 드로어 ── */}
      {mobileOpen && (
        <div className="md:hidden bg-[#16294a] border-t border-white/10 px-4 py-4 grid grid-cols-2 gap-x-4 gap-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="text-[11px] font-bold text-blue-300 uppercase tracking-wider mb-2">{g.label}</div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`text-sm py-1.5 px-2 rounded-lg ${
                      isActive(item.href) ? "bg-white/15 text-white font-semibold" : "text-blue-100 active:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
          {role === "coo" && (
            <a href="/briefings/new" className="col-span-2 text-center text-sm bg-white/20 text-white font-semibold py-2.5 rounded-xl">
              ✏️ 브리핑 등록
            </a>
          )}
        </div>
      )}
    </div>
  );
}
