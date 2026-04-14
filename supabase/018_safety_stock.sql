-- 018: 품목별 안전재고 설정
-- 기존 전체 일괄 100 기준 → 품목별 개별 설정 가능
ALTER TABLE products ADD COLUMN IF NOT EXISTS safety_stock numeric(10,1) DEFAULT 100;
