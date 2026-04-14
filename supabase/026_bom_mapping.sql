-- 간이 BOM (제품 → 원재료 매핑)
CREATE TABLE IF NOT EXISTS product_bom (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code text NOT NULL,
  product_name text NOT NULL,
  material_code text,
  material_name text NOT NULL,
  qty_per_unit numeric(10,3) NOT NULL DEFAULT 1,  -- material qty needed per 1kg of product
  unit text NOT NULL DEFAULT 'kg',
  notes text,
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_code, material_name)
);
