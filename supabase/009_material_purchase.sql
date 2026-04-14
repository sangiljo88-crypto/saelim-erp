-- ────────────────────────────────────────────────────────────────────
-- 새림 ERP 원재료 매입 추적 + FIFO 원가 계산 스키마
-- Supabase SQL Editor에서 실행
-- ────────────────────────────────────────────────────────────────────

-- 원재료 매입 배치 기록 (FIFO의 핵심 테이블)
CREATE TABLE IF NOT EXISTS material_purchases (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_date date    NOT NULL,
  material_name text    NOT NULL,   -- 원재료명 (예: "돼지 두수", "진공포장지 소")
  product_code  text,               -- products.code 참조용 (선택)
  supplier      text,               -- 공급업체 (예: 농협, 목욕촌)
  quantity      numeric NOT NULL,   -- 구매 수량
  unit          text    DEFAULT 'kg', -- 단위: kg / 두 / 개 / 장 / 박스
  unit_price    integer NOT NULL,   -- 단가 (원/단위)
  total_cost    integer NOT NULL,   -- 총 매입비용 (quantity × unit_price)
  remaining_qty numeric NOT NULL,   -- FIFO 잔여수량 (구매 시 = quantity)
  invoice_no    text,               -- 거래명세서 번호
  notes         text,
  recorded_by   text,
  created_at    timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_material_purchases_date     ON material_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_material_purchases_name     ON material_purchases(material_name);
CREATE INDEX IF NOT EXISTS idx_material_purchases_fifo     ON material_purchases(material_name, purchase_date, remaining_qty);

-- FIFO 잔여수량 업데이트용 함수 (PostgreSQL)
-- 생산/소비 기록 시 자동 차감 (Phase 2)
-- 현재는 manual 방식으로 remaining_qty 관리

COMMENT ON TABLE material_purchases IS '원재료 매입 배치 기록. FIFO 원가 계산의 기준 테이블.';
COMMENT ON COLUMN material_purchases.remaining_qty IS 'FIFO 잔여수량. 매입 시 quantity와 동일, 소비 기록 시 감소.';
