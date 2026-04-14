-- 019: 거래처별 품목 단가 매트릭스
-- 동일 품목이라도 거래처마다 다른 단가 적용 가능

CREATE TABLE IF NOT EXISTS customer_product_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  customer_name text NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  updated_by text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, product_code, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_cpp_customer ON customer_product_prices(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpp_product ON customer_product_prices(product_code);
