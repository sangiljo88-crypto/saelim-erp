-- ────────────────────────────────────────────────────────────
-- 새림 ERP 급여 관리 스키마 (Supabase SQL Editor에서 실행)
-- ────────────────────────────────────────────────────────────

-- 1. 직원 기본급 테이블
CREATE TABLE IF NOT EXISTS staff_salaries (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  login_id    text    UNIQUE NOT NULL,          -- members.login_id 또는 MOCK_USERS id
  name        text    NOT NULL,
  dept        text,
  base_salary integer DEFAULT 0,               -- 원 단위 (만원 입력 × 10000)
  notes       text,
  updated_by  text,
  updated_at  timestamptz DEFAULT now()
);

-- 2. 월별 실지급 급여 기록 테이블
CREATE TABLE IF NOT EXISTS payroll_records (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  year_month     text    NOT NULL,              -- "2026-04"
  login_id       text    NOT NULL,
  employee_name  text    NOT NULL,
  dept           text,
  base_salary    integer DEFAULT 0,            -- 해당 월 기본급
  overtime_pay   integer DEFAULT 0,            -- 연장근무수당
  bonus          integer DEFAULT 0,            -- 상여
  deduction      integer DEFAULT 0,            -- 공제 (4대보험 등)
  total_pay      integer DEFAULT 0,            -- 실지급 = 기본 + 연장 + 상여 - 공제
  notes          text,
  recorded_by    text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(year_month, login_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payroll_year_month ON payroll_records(year_month);
CREATE INDEX IF NOT EXISTS idx_payroll_login_id   ON payroll_records(login_id);
