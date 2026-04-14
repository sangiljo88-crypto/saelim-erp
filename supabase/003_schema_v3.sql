-- 새림 ERP Schema v3 - 실무 기반 확장 테이블
-- Supabase SQL Editor에서 실행하세요

-- 가공팀 업무지시서 (개발이사 입력)
CREATE TABLE IF NOT EXISTS work_orders (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_date   date NOT NULL DEFAULT CURRENT_DATE,
  ordered_by   text NOT NULL,
  dept         text NOT NULL DEFAULT '가공팀',
  work_hours   text DEFAULT '08:30~18:00',
  workers      text,
  items        jsonb NOT NULL DEFAULT '[]',
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(order_date, dept)
);

-- 두/내장 작업일지 (공장장 입력)
CREATE TABLE IF NOT EXISTS head_work_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_date     date NOT NULL DEFAULT CURRENT_DATE,
  manager       text,
  head_received integer DEFAULT 0,
  head_items    jsonb DEFAULT '[]',
  innard_items  jsonb DEFAULT '[]',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(work_date)
);

-- 농협 유통 입고 두수 (생산팀 입력)
CREATE TABLE IF NOT EXISTS livestock_intake (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  intake_date  date NOT NULL DEFAULT CURRENT_DATE,
  nh_ledger    integer DEFAULT 0,
  nh_actual    integer DEFAULT 0,
  mokwuchon    integer DEFAULT 0,
  recorded_by  text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(intake_date)
);

-- 수도/지하수 사용량 (생산팀 입력)
CREATE TABLE IF NOT EXISTS water_usage (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usage_date            date NOT NULL DEFAULT CURRENT_DATE,
  water_reading         numeric(10,1) DEFAULT 0,
  ground_water_reading  numeric(10,1) DEFAULT 0,
  recorded_by           text,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  UNIQUE(usage_date)
);

-- 냉동냉장 컨테이너 재고 (재고담당 입력)
CREATE TABLE IF NOT EXISTS container_inventory (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_date date NOT NULL DEFAULT CURRENT_DATE,
  location       text NOT NULL,
  product_name   text NOT NULL,
  unit           text DEFAULT 'kg',
  prev_stock     numeric(10,2) DEFAULT 0,
  incoming_qty   numeric(10,2) DEFAULT 0,
  outgoing_qty   numeric(10,2) DEFAULT 0,
  recorded_by    text,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- 품질 순찰일지 (품질팀 입력)
CREATE TABLE IF NOT EXISTS quality_patrol (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patrol_date    date NOT NULL DEFAULT CURRENT_DATE,
  patrol_time    text,
  inspector      text NOT NULL,
  dept           text DEFAULT '품질팀',
  areas          jsonb DEFAULT '[]',
  issues         jsonb DEFAULT '[]',
  overall_status text DEFAULT '정상',
  created_at     timestamptz DEFAULT now()
);

-- HACCP/위생 오딧 체크리스트 (품질팀 입력)
CREATE TABLE IF NOT EXISTS audit_checklist (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  check_date     date NOT NULL DEFAULT CURRENT_DATE,
  audit_type     text DEFAULT 'HACCP 자체점검',
  inspector      text,
  items          jsonb DEFAULT '[]',
  overall_result text DEFAULT '적합',
  next_action    text,
  created_at     timestamptz DEFAULT now()
);

-- 당일/익일 생산계획 (공장장 입력)
CREATE TABLE IF NOT EXISTS production_plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_date   date NOT NULL DEFAULT CURRENT_DATE,
  manager     text,
  today_plans jsonb DEFAULT '[]',
  next_plans  jsonb DEFAULT '[]',
  notes       text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(plan_date)
);

-- RLS 비활성화 (개발 편의)
ALTER TABLE work_orders         DISABLE ROW LEVEL SECURITY;
ALTER TABLE head_work_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE livestock_intake    DISABLE ROW LEVEL SECURITY;
ALTER TABLE water_usage         DISABLE ROW LEVEL SECURITY;
ALTER TABLE container_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE quality_patrol      DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_checklist     DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans    DISABLE ROW LEVEL SECURITY;
