-- =============================================
-- 새림 ERP - 스키마 v4 추가분
-- 거래처(고객사) 관리 + 납품전표 테이블
-- Supabase > SQL Editor 에서 실행하세요
-- =============================================

-- 거래처 마스터
CREATE TABLE IF NOT EXISTS customers (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL UNIQUE,
  type          text        DEFAULT '식당', -- 식당, 로드업체, 택배, 프랜차이즈, 가공업체, 도소매
  contact_name  text,
  phone         text,
  address       text,
  tax_id        text,
  credit_limit  numeric     DEFAULT 0,
  payment_terms integer     DEFAULT 30,
  products      text[],     -- 주요 거래 품목
  monthly_avg   numeric     DEFAULT 0, -- 월평균 거래액
  memo          text,
  active        boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customers_type   ON customers(type);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);

-- 납품전표
CREATE TABLE IF NOT EXISTS deliveries (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_date date        NOT NULL DEFAULT CURRENT_DATE,
  customer_name text        NOT NULL,
  customer_id   uuid        REFERENCES customers(id),
  dept          text        DEFAULT '배송팀',
  items         jsonb       DEFAULT '[]', -- [{product, qty_kg, unit_price, amount}]
  total_amount  numeric     DEFAULT 0,
  status        text        DEFAULT 'shipped', -- preparing, shipped, delivered, invoiced
  driver        text,
  invoice_no    text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE deliveries DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deliveries_date        ON deliveries(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);

-- COO 비용 승인 테이블
CREATE TABLE IF NOT EXISTS cost_approvals (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text        NOT NULL,
  dept         text        NOT NULL,
  requested_by text        NOT NULL,
  request_date date        NOT NULL DEFAULT CURRENT_DATE,
  amount       numeric     DEFAULT 0,
  status       text        DEFAULT 'pending', -- pending, approved, rejected
  comment      text,
  approved_by  text,
  approved_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE cost_approvals DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cost_approvals_status ON cost_approvals(status);
