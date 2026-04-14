-- KPI 목표치 관리 테이블
-- COO/CEO가 부서별 KPI 목표를 DB에서 관리할 수 있도록 지원
CREATE TABLE IF NOT EXISTS kpi_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dept text NOT NULL,
  kpi_key text NOT NULL,
  label text NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 2026,
  quarter integer,
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dept, kpi_key, year, quarter)
);
