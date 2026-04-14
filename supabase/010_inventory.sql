-- 냉동냉장 컨테이너 재고 테이블 생성
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

ALTER TABLE container_inventory DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_container_inventory_date     ON container_inventory(inventory_date DESC);
CREATE INDEX IF NOT EXISTS idx_container_inventory_location ON container_inventory(location);

-- 샘플 데이터 (최신 날짜 기준)
INSERT INTO container_inventory (inventory_date, location, product_name, unit, prev_stock, incoming_qty, outgoing_qty, recorded_by) VALUES
  (CURRENT_DATE, '2번냉동실', '귀(냉동)',      'kg', 540,  120,    80,  '재고담당'),
  (CURRENT_DATE, '2번냉동실', '덜미(X)',        'kg', 120,  63.44,  0,   '재고담당'),
  (CURRENT_DATE, '2번냉동실', '관자(냉동)',     'kg', 89,   29.5,   30,  '재고담당'),
  (CURRENT_DATE, '2번냉동실', '꽃살(냉동)',     'kg', 76,   29.82,  50,  '재고담당'),
  (CURRENT_DATE, '3번냉동실', '릎(냉동)',       'kg', 800,  363,    200, '재고담당'),
  (CURRENT_DATE, '3번냉동실', '앞판(냉동)',     'kg', 600,  250,    150, '재고담당'),
  (CURRENT_DATE, '3번냉동실', '막창(냉동)',     'kg', 200,  80,     60,  '재고담당'),
  (CURRENT_DATE, '3번냉동실', '염통(냉동)',     'kg', 150,  100,    80,  '재고담당'),
  (CURRENT_DATE, '3번냉동실', '오소리(냉동)',   'kg', 180,  120,    100, '재고담당'),
  (CURRENT_DATE, '완제품냉동실', '소선지',      'kg', 300,  204,    180, '재고담당'),
  (CURRENT_DATE, '완제품냉동실', '편육',        'kg', 150,  106,    80,  '재고담당');
