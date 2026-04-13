export type LeaveType = '연차' | '반차(오전)' | '반차(오후)' | '시간휴가';

export interface LeaveBalance {
  id: string;
  employee_id: string;
  employee_name: string;
  dept: string | null;
  year: number;
  total_days: number;
  used_days: number;
}

export interface LeaveBalanceAdjustment {
  id: string;
  employee_id: string;
  employee_name: string;
  dept: string | null;
  year: number;
  before_days: number;
  after_days: number;
  delta: number;
  adjustment_type: string;
  reason: string;
  adjusted_by: string;
  adjusted_by_name: string;
  vacation_request_id: string | null;
  created_at: string;
}

export interface VacationRequestFull {
  id: string;
  requester_id: string;
  requester_name: string;
  dept: string | null;
  start_date: string;
  end_date: string;
  days_count: number;
  leave_type: LeaveType;
  hours_count: number | null;
  deducted_days: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

/** 휴가 종류별 차감 일수 계산 */
export function calcDeductedDays(
  leaveType: LeaveType,
  startDate: string,
  endDate: string,
  hoursCount?: number | null
): number {
  if (leaveType === '반차(오전)' || leaveType === '반차(오후)') return 0.5;
  if (leaveType === '시간휴가') return Math.round(((hoursCount ?? 1) / 8) * 10) / 10;
  // 연차: 날짜 수 계산
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  '연차':       '연차',
  '반차(오전)': '반차 (오전)',
  '반차(오후)': '반차 (오후)',
  '시간휴가':   '시간휴가',
};

export const LEAVE_TYPE_COLOR: Record<LeaveType, string> = {
  '연차':       'bg-blue-100 text-blue-700',
  '반차(오전)': 'bg-purple-100 text-purple-700',
  '반차(오후)': 'bg-indigo-100 text-indigo-700',
  '시간휴가':   'bg-amber-100 text-amber-700',
};
