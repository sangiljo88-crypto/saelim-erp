-- 024: 예방정비 스케줄 + 부품/소모품 재고

-- 예방정비 스케줄
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_name text NOT NULL,
  equipment_location text,
  task_description text NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',  -- 'daily','weekly','biweekly','monthly','quarterly','yearly'
  last_performed date,
  next_due date NOT NULL,
  assigned_to text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 부품/소모품 재고
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  part_name text NOT NULL,
  part_code text UNIQUE,
  equipment_name text,
  category text DEFAULT '소모품',
  current_stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 2,
  unit text NOT NULL DEFAULT '개',
  unit_price numeric(10,0) DEFAULT 0,
  supplier text,
  last_replaced date,
  notes text,
  updated_by text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_schedule_due ON maintenance_schedules(next_due);
CREATE INDEX IF NOT EXISTS idx_spare_parts_equip ON spare_parts(equipment_name);
