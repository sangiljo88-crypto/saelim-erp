// ── 부서 목록 (전사 표시 순서) ──
export const DEPT_ORDER = [
  "생산팀", "가공팀", "스킨팀", "재고팀", "품질팀",
  "배송팀", "CS팀", "마케팅팀", "회계팀", "온라인팀", "개발팀",
] as const;

export type DeptName = typeof DEPT_ORDER[number];

// ── 부서 + 전사 (KPI 등에서 사용) ──
export const DEPT_ORDER_WITH_ALL = ["전사", ...DEPT_ORDER] as const;

// ── 역할 라벨 ──
export const ROLE_LABEL: Record<string, string> = {
  ceo: "대표",
  coo: "COO",
  manager: "팀장",
  worker: "직원",
};

// ── 일정 카테고리 ──
export const SCHEDULE_CATEGORIES = [
  "생산계획", "품목계획", "납품일정", "회의", "기타", "일정",
] as const;

export type ScheduleCategory = typeof SCHEDULE_CATEGORIES[number];

// ── 임계값 (알림/상태 판정 기준) ──
export const THRESHOLDS = {
  yield: { good: 92, warning: 88 },           // % - 수율
  lowStock: 100,                               // 기본값 (품목별 설정 우선)
  utilityRiskRed: 1.30,                        // 유틸리티 비용 전월 대비
  utilityRiskYellow: 1.15,
  claimsAlertMin: 3,                           // 클레임 경고 최소 건수
} as const;

// ── RAG 상태 ──
export const RAG_DOT: Record<string, string> = { green: "🟢", yellow: "🟡", red: "🔴" };
export const RAG_TEXT: Record<string, string> = { green: "양호", yellow: "주의", red: "경고" };
export const RAG_COLOR: Record<string, string> = { green: "text-emerald-600", yellow: "text-amber-600", red: "text-red-600" };
