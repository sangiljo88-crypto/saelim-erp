-- 당일/익일 생산계획 테이블 생성
CREATE TABLE IF NOT EXISTS production_plans (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_date    date NOT NULL DEFAULT CURRENT_DATE,
  dept         text NOT NULL DEFAULT '생산팀',
  manager      text,
  today_plans  jsonb DEFAULT '[]',
  next_plans   jsonb DEFAULT '[]',
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(plan_date, dept)
);

ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_production_plans_date ON production_plans(plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_production_plans_dept ON production_plans(dept);
