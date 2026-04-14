-- 023_lot_tracking.sql
-- LOT 이력추적: 원재료 매입 → 생산 → 출하 연결

-- 생산 LOT 마스터
CREATE TABLE IF NOT EXISTS production_lots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_number text NOT NULL UNIQUE,
  production_date date NOT NULL,
  product_code text,
  product_name text NOT NULL,
  dept text,
  output_qty numeric(10,1) NOT NULL DEFAULT 0,
  input_qty numeric(10,1) NOT NULL DEFAULT 0,
  yield_rate numeric(5,1),
  worker_name text,
  worker_id text,
  status text NOT NULL DEFAULT 'produced',  -- 'produced', 'shipped', 'recalled'
  notes text,
  created_at timestamptz DEFAULT now()
);

-- LOT ↔ 원재료 매입 배치 연결
CREATE TABLE IF NOT EXISTS lot_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  purchase_id uuid,
  material_name text NOT NULL,
  supplier text,
  quantity_used numeric(10,1) NOT NULL DEFAULT 0,
  purchase_date date,
  created_at timestamptz DEFAULT now()
);

-- LOT ↔ 출하 연결
CREATE TABLE IF NOT EXISTS lot_shipments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  delivery_id uuid,
  customer_name text NOT NULL,
  shipped_qty numeric(10,1) NOT NULL DEFAULT 0,
  shipped_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lots_date ON production_lots(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_lots_product ON production_lots(product_name);
CREATE INDEX IF NOT EXISTS idx_lot_materials_lot ON lot_materials(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_shipments_lot ON lot_shipments(lot_id);
