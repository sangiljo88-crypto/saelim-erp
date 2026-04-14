-- =============================================
-- 새림 ERP - 스키마 v2 추가분
-- Supabase > SQL Editor 에서 실행하세요
-- =============================================

-- 6. 회원 테이블 (회원가입 시 저장)
CREATE TABLE IF NOT EXISTS members (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  login_id     TEXT        NOT NULL UNIQUE,
  password     TEXT        NOT NULL,        -- SHA-256 해시
  name         TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'worker',  -- worker | manager | coo | ceo
  dept         TEXT        NOT NULL DEFAULT '',
  active       BOOLEAN     DEFAULT true
);

-- 7. 부서별 주간 보고 (팀장 → COO → CEO 흐름)
--    팀장이 작성 → COO가 코멘트 달면 → CEO 대시보드에 반영
CREATE TABLE IF NOT EXISTS dept_reports (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  report_date   DATE        NOT NULL,       -- 보고 기준일 (보통 금요일)
  dept          TEXT        NOT NULL,
  manager_id    TEXT        NOT NULL,
  manager_name  TEXT        NOT NULL,
  rag_status    TEXT        NOT NULL DEFAULT 'green',  -- green | yellow | red
  issue         TEXT        NOT NULL,       -- 이번 주 핵심 이슈
  detail        TEXT,                       -- 상세 내용 / 수치
  next_action   TEXT,                       -- 다음 주 계획
  coo_comment   TEXT,                       -- COO 코멘트 (COO가 입력)
  coo_id        TEXT,
  coo_updated_at TIMESTAMPTZ,
  status        TEXT        DEFAULT 'submitted',  -- submitted | reviewed | approved
  UNIQUE (report_date, dept)                -- 같은 날짜/부서 중복 방지
);

-- 최신 부서 보고서만 빠르게 조회하기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_dept_reports_dept_date
  ON dept_reports(dept, report_date DESC);
