-- 냉동·냉장·컨테이너 일별 재고 현황 테이블
CREATE TABLE IF NOT EXISTS frozen_inventory (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_date date NOT NULL,
  section        text NOT NULL,          -- '2번냉동실', '5번냉동고(발골)' 등
  side           text NOT NULL DEFAULT 'raw',  -- 'raw'(원재료) | 'product'(제품)
  product_name   text NOT NULL,
  unit           text DEFAULT 'kg/box',
  prev_stock     numeric DEFAULT 0,      -- 전일 현재고 (자동 반영)
  usage_qty      numeric DEFAULT 0,      -- 사용량
  incoming_qty   numeric DEFAULT 0,      -- 입고량
  outgoing_qty   numeric DEFAULT 0,      -- 출고량
  current_stock  numeric DEFAULT 0,      -- 현재고 (prev + incoming - usage - outgoing)
  created_at     timestamptz DEFAULT now(),
  UNIQUE(inventory_date, section, product_name)
);

ALTER TABLE frozen_inventory DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_frozen_inv_date   ON frozen_inventory(inventory_date DESC);
CREATE INDEX IF NOT EXISTS idx_frozen_inv_section ON frozen_inventory(section);
