export const kpiData = {
  revenue: { actual: 1_820_000_000, target: 1_833_333_333, unit: "원" },
  profitMargin: { actual: 8.2, target: 10.0, unit: "%" },
  cashBalance: { actual: 1_250_000_000, target: 1_000_000_000, unit: "원" },
  receivables: { actual: 380_000_000, target: 200_000_000, unit: "원" },
  claims: { actual: 3, target: 2, unit: "건" },
  yieldRate: { actual: 91.4, target: 92.0, unit: "%" },
};

export type RagStatus = "green" | "yellow" | "red";

export interface Department {
  name: string;
  status: RagStatus;
  issue: string;
  comment: string;
}

export const departments: Department[] = [
  { name: "생산팀", status: "yellow", issue: "수율 91.4% — 목표 92% 미달", comment: "3라인 설비 점검 필요" },
  { name: "품질팀", status: "green", issue: "이번 달 클레임 3건, 전월 대비 감소", comment: "HACCP 점검 정상" },
  { name: "마케팅팀", status: "green", issue: "신규 거래처 2건 계약 완료", comment: "BHC 단가 재협상 진행 중" },
  { name: "회계팀", status: "red", issue: "미수금 3억8천만원 — 목표 초과", comment: "90일 초과 거래처 2곳 COO 확인 필요" },
  { name: "배송팀", status: "green", issue: "납기 준수율 98.6%", comment: "이상 없음" },
  { name: "CS팀", status: "yellow", issue: "클레임 평균 처리 시간 31시간 — 기준 초과", comment: "처리 인력 보강 검토" },
  { name: "온라인팀", status: "green", issue: "쿠팡 ROAS 312%", comment: "광고 예산 증액 요청 검토 중" },
  { name: "개발팀", status: "yellow", issue: "육수 신제품 개발 2주 지연", comment: "포장재 승인 지연이 원인" },
];

export interface ActionItem {
  id: number;
  title: string;
  dept: string;
  deadline: string;
  status: "완료" | "진행" | "지연";
}

export const actionItems: ActionItem[] = [
  { id: 1, title: "BHC 단가 재협상 완료", dept: "마케팅팀", deadline: "2026-04-15", status: "진행" },
  { id: 2, title: "90일 초과 미수금 회수 (A거래처)", dept: "회계팀", deadline: "2026-04-10", status: "지연" },
  { id: 3, title: "3라인 설비 점검 및 수율 개선", dept: "생산팀", deadline: "2026-04-20", status: "진행" },
  { id: 4, title: "CS팀 클레임 처리 매뉴얼 보완", dept: "CS팀", deadline: "2026-04-30", status: "진행" },
  { id: 5, title: "육수 신제품 포장재 최종 승인", dept: "개발팀", deadline: "2026-04-12", status: "지연" },
];

export const monthlyRevenue = [
  { month: "10월", actual: 1_650_000_000, target: 1_833_333_333 },
  { month: "11월", actual: 1_720_000_000, target: 1_833_333_333 },
  { month: "12월", actual: 1_900_000_000, target: 1_833_333_333 },
  { month: "1월", actual: 1_580_000_000, target: 1_833_333_333 },
  { month: "2월", actual: 1_640_000_000, target: 1_833_333_333 },
  { month: "3월", actual: 1_820_000_000, target: 1_833_333_333 },
];

export const alerts = [
  { level: "red", message: "미수금 90일 초과 거래처: ㈜대성푸드(1억2천), 한우마트(8천)" },
  { level: "red", message: "현금잔고 경고 없음 (현재 12.5억 — 정상)" },
  { level: "yellow", message: "수율 3일 연속 92% 미달 — 생산팀 점검 필요" },
  { level: "yellow", message: "육수 신제품 포장재 승인 지연 — 납기 리스크" },
];
