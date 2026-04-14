-- 020: 재고실사 모드
-- 월별 실물 재고 실사 vs 시스템 재고 비교

CREATE TABLE IF NOT EXISTS inventory_audits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_date date NOT NULL,
  section text NOT NULL,
  product_name text NOT NULL,
  system_stock numeric(10,1) NOT NULL DEFAULT 0,
  actual_stock numeric(10,1) NOT NULL DEFAULT 0,
  difference numeric(10,1) GENERATED ALWAYS AS (actual_stock - system_stock) STORED,
  adjustment_reason text,
  adjusted boolean NOT NULL DEFAULT false,
  audited_by text NOT NULL,
  audited_by_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(audit_date, section, product_name)
);
CREATE INDEX IF NOT EXISTS idx_audit_date ON inventory_audits(audit_date DESC);
