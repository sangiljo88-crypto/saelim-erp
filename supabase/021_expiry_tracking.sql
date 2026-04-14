-- 재고 유통기한 추적
ALTER TABLE frozen_inventory
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS production_date date;

-- 유통기한 마스터 (품목별 기본 유통기한 일수)
CREATE TABLE IF NOT EXISTS product_shelf_life (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code text NOT NULL UNIQUE,
  product_name text NOT NULL,
  shelf_life_days integer NOT NULL DEFAULT 180,
  storage_condition text DEFAULT '냉동',
  updated_by text,
  updated_at timestamptz DEFAULT now()
);
