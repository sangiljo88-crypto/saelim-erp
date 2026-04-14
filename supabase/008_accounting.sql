-- ────────────────────────────────────────────────────────────
--  회계 모듈 스키마
-- ────────────────────────────────────────────────────────────

-- 1. 매입 결제 내역 (매입채무 → 실결제 추적)
CREATE TABLE IF NOT EXISTS purchase_payments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id     uuid,                          -- material_purchases.id 참조 (optional)
  payment_date    date NOT NULL,
  supplier        text,
  amount          integer NOT NULL,              -- 결제금액 (부가세 포함)
  supply_amount   integer DEFAULT 0,             -- 공급가액 (부가세 별도)
  vat_amount      integer DEFAULT 0,             -- 부가세 (supply_amount × 10%)
  payment_method  text DEFAULT '계좌이체',       -- 현금/계좌이체/카드/어음/기업카드
  bank_account    text,                          -- 입금 계좌 / 카드 끝 4자리
  is_tax_invoice  boolean DEFAULT false,         -- 세금계산서 발행 여부
  tax_invoice_no  text,                          -- 세금계산서 번호
  memo            text,
  recorded_by     text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE purchase_payments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_purchase_payments_date     ON purchase_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_supplier ON purchase_payments(supplier);

-- 2. 현금흐름 원장 (모든 입출금 통합 관리)
CREATE TABLE IF NOT EXISTS cash_flow_ledger (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date date NOT NULL,
  flow_type        text NOT NULL CHECK (flow_type IN ('inflow', 'outflow')),
  category         text NOT NULL,
  -- 입금: '매출입금' | '기타수입'
  -- 출금: '매입결제' | '급여' | '경비' | '세금·공과금' | '유틸리티' | '기타지출'
  amount           integer NOT NULL,             -- 원 단위
  supply_amount    integer DEFAULT 0,            -- 부가세 제외 공급가액
  vat_amount       integer DEFAULT 0,            -- 부가세
  counterparty     text,                         -- 거래처 / 지급처
  payment_method   text DEFAULT '계좌이체',
  description      text,
  is_vat_deductible boolean DEFAULT false,       -- 매입세액공제 가능 여부
  ref_type         text,                         -- 'purchase_payment'|'payroll'|'cost_approval'|'delivery'|null
  ref_id           text,                         -- 참조 레코드 ID
  recorded_by      text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE cash_flow_ledger DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cash_flow_date     ON cash_flow_ledger(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_type     ON cash_flow_ledger(flow_type, category);
CREATE INDEX IF NOT EXISTS idx_cash_flow_counter  ON cash_flow_ledger(counterparty);

-- 3. 미지급 매입 현황 VIEW (material_purchases 기준)
--    결제 등록 전까지 '미결제'로 표시
CREATE OR REPLACE VIEW unpaid_purchases AS
SELECT
  mp.id,
  mp.purchase_date,
  mp.material_name,
  mp.supplier,
  mp.total_cost,
  mp.invoice_no,
  COALESCE(
    (SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = mp.id),
    0
  ) AS paid_amount,
  mp.total_cost - COALESCE(
    (SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = mp.id),
    0
  ) AS unpaid_amount
FROM material_purchases mp
WHERE mp.total_cost > COALESCE(
  (SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = mp.id),
  0
)
ORDER BY mp.purchase_date DESC;
