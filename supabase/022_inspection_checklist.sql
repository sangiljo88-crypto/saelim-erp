CREATE TABLE IF NOT EXISTS shipment_inspections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text NOT NULL,
  inspector_name text NOT NULL,
  inspector_id text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  -- items: [{ product_name, qty_kg, weight_ok, temp_ok, package_ok, label_ok, notes }]
  overall_pass boolean NOT NULL DEFAULT true,
  temp_reading numeric(4,1),
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspection_date ON shipment_inspections(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_delivery ON shipment_inspections(delivery_id);
