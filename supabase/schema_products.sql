-- ============================================================
-- 새림 ERP — 품목 마스터 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,           -- 품목코드 (예: P001)
  name          text NOT NULL,                  -- 품목명
  category      text NOT NULL DEFAULT '가공품', -- 원물 / 가공품 / 포장재 / 부자재
  subcategory   text,                           -- 세부 분류 (머리류 / 내장류 / 껍데기류 등)
  unit          text NOT NULL DEFAULT 'kg',     -- 단위 (kg / 두 / 개 / 박스)
  purchase_price numeric(12,0) DEFAULT 0,       -- 매입 단가 (원/kg)
  sale_price     numeric(12,0) DEFAULT 0,       -- 판매 단가 (원/kg)
  storage_type  text DEFAULT '냉동',            -- 냉동 / 냉장 / 상온
  storage_area  text,                           -- 보관 위치 (A동 1호기 등)
  is_active     boolean DEFAULT true,           -- 사용 여부
  note          text,                           -- 비고
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE products DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
