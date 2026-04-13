-- ══════════════════════════════════════════════════════════════
-- 연차 관리 시스템 스키마
-- Supabase SQL Editor에서 실행
-- ══════════════════════════════════════════════════════════════

-- 1. vacation_requests 테이블 컬럼 추가
ALTER TABLE vacation_requests
  ADD COLUMN IF NOT EXISTS leave_type    text    NOT NULL DEFAULT '연차',
  ADD COLUMN IF NOT EXISTS hours_count   numeric(4,1),
  ADD COLUMN IF NOT EXISTS deducted_days numeric(5,2) NOT NULL DEFAULT 1;

-- days_count를 소수점 허용으로 변경 (반차=0.5 등)
ALTER TABLE vacation_requests
  ALTER COLUMN days_count TYPE numeric(5,2) USING days_count::numeric;

-- 2. 직원별 연차 잔여 현황 테이블
CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   text        NOT NULL,
  employee_name text        NOT NULL,
  dept          text,
  year          integer     NOT NULL,
  total_days    numeric(5,1) NOT NULL DEFAULT 15,
  used_days     numeric(5,1) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (employee_id, year)
);

-- 3. 연차 조정/차감 이력 테이블
CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id          text        NOT NULL,
  employee_name        text        NOT NULL,
  dept                 text,
  year                 integer     NOT NULL,
  -- 변경 전후
  before_days          numeric(5,2) NOT NULL,
  after_days           numeric(5,2) NOT NULL,
  delta                numeric(5,2) NOT NULL,  -- 양수=증가, 음수=차감
  -- 이유
  adjustment_type      text        NOT NULL,   -- 'initial'|'deduct'|'restore'|'add'|'subtract'|'correction'
  reason               text        NOT NULL,
  -- 처리자
  adjusted_by          text        NOT NULL,
  adjusted_by_name     text        NOT NULL,
  -- 연관 휴가 신청 (차감/복구 시)
  vacation_request_id  uuid        REFERENCES vacation_requests(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year
  ON employee_leave_balances (employee_id, year);

CREATE INDEX IF NOT EXISTS idx_leave_adjustments_emp_year
  ON leave_balance_adjustments (employee_id, year);

CREATE INDEX IF NOT EXISTS idx_leave_adjustments_year
  ON leave_balance_adjustments (year, created_at DESC);
