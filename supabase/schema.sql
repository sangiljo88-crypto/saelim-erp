-- =============================================
-- 새림 ERP - Supabase 데이터베이스 스키마
-- Supabase > SQL Editor 에서 실행하세요
-- =============================================

-- 1. 생산일지
CREATE TABLE IF NOT EXISTS production_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  work_date    DATE        NOT NULL,
  worker_id    TEXT        NOT NULL,
  worker_name  TEXT        NOT NULL,
  dept         TEXT        NOT NULL,
  product_id   TEXT        NOT NULL,
  product_name TEXT        NOT NULL,
  input_qty    NUMERIC     NOT NULL DEFAULT 0,
  output_qty   NUMERIC     NOT NULL DEFAULT 0,
  waste_qty    NUMERIC     NOT NULL DEFAULT 0,
  pack_qty     INTEGER              DEFAULT 0,
  yield_rate   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN input_qty > 0
    THEN ROUND((output_qty / input_qty * 100)::numeric, 1)
    ELSE 0 END
  ) STORED,
  issue_note   TEXT,
  status       TEXT        DEFAULT 'submitted'  -- submitted | reviewed | approved
);

-- 2. 위생점검 체크리스트
CREATE TABLE IF NOT EXISTS hygiene_checks (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  check_date   DATE        NOT NULL,
  worker_id    TEXT        NOT NULL,
  worker_name  TEXT        NOT NULL,
  dept         TEXT        NOT NULL,
  items        JSONB       NOT NULL DEFAULT '{}',  -- { "해동육 일지": true, ... }
  all_passed   BOOLEAN     GENERATED ALWAYS AS (
    NOT (items::text LIKE '%false%')
  ) STORED,
  status       TEXT        DEFAULT 'submitted'
);

-- 3. 클레임 접수
CREATE TABLE IF NOT EXISTS claims (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  claim_date    DATE        NOT NULL,
  worker_id     TEXT        NOT NULL,
  worker_name   TEXT        NOT NULL,
  dept          TEXT        NOT NULL,
  client_name   TEXT        NOT NULL,
  product_names TEXT[]      DEFAULT '{}',
  claim_type    TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  status        TEXT        DEFAULT 'pending'  -- pending | in_progress | resolved
);

-- 4. 월간 KPI (팀장/COO가 입력)
CREATE TABLE IF NOT EXISTS monthly_kpi (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  year_month   TEXT        NOT NULL,   -- '2026-04'
  dept         TEXT        NOT NULL,
  kpi_key      TEXT        NOT NULL,   -- 'revenue', 'yield_rate', etc.
  target       NUMERIC,
  actual       NUMERIC,
  unit         TEXT,
  note         TEXT,
  UNIQUE (year_month, dept, kpi_key)
);

-- 5. Action Items (COO 관리)
CREATE TABLE IF NOT EXISTS action_items (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  title        TEXT        NOT NULL,
  dept         TEXT        NOT NULL,
  deadline     DATE        NOT NULL,
  status       TEXT        DEFAULT '진행',  -- 진행 | 완료 | 지연
  created_by   TEXT        NOT NULL,
  note         TEXT
);

-- =============================================
-- 샘플 데이터 (테스트용)
-- =============================================

INSERT INTO action_items (title, dept, deadline, status, created_by) VALUES
  ('BHC 단가 재협상 완료',        '마케팅팀', '2026-04-15', '진행', 'coo'),
  ('90일 초과 미수금 회수',        '회계팀',   '2026-04-10', '지연', 'coo'),
  ('3라인 설비 점검 및 수율 개선', '생산팀',   '2026-04-20', '진행', 'coo'),
  ('CS팀 클레임 처리 매뉴얼 보완', 'CS팀',     '2026-04-30', '진행', 'coo'),
  ('육수 신제품 포장재 최종 승인', '개발팀',   '2026-04-12', '지연', 'coo')
ON CONFLICT DO NOTHING;
