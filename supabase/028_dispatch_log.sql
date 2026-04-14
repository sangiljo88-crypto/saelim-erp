-- 028_dispatch_log.sql
-- 배차일지 + 차량 마스터

-- 배차일지
CREATE TABLE IF NOT EXISTS dispatch_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_name text NOT NULL,           -- 차량명 (예: 1톤냉동, 3.5톤냉장, 5톤윙바디)
  vehicle_number text,                  -- 차량번호 (예: 12가3456)
  driver_id text NOT NULL,
  driver_name text NOT NULL,
  dept text DEFAULT '배송팀',
  start_mileage numeric(10,1) NOT NULL, -- 출발 키로수
  end_mileage numeric(10,1),            -- 도착 키로수 (귀환 후 입력)
  distance_km numeric(8,1) GENERATED ALWAYS AS (COALESCE(end_mileage, 0) - start_mileage) STORED,
  destinations text,                    -- 방문처 (콤마 구분: "A마트, B급식, C식당")
  delivery_count integer DEFAULT 0,     -- 납품처 수
  start_time time,                      -- 출발시간
  end_time time,                        -- 도착시간
  fuel_type text DEFAULT '경유',        -- 경유, 휘발유, LPG
  fuel_filled numeric(6,1),             -- 주유량(L) - 주유한 경우만
  fuel_cost numeric(10,0),              -- 주유비(원) - 주유한 경우만
  issues text,                          -- 차량 이상/특이사항
  status text NOT NULL DEFAULT 'departed', -- 'departed','returned','cancelled'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 차량 마스터
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_name text NOT NULL,
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text DEFAULT '냉동',     -- 냉동, 냉장, 상온, 윙바디
  capacity_ton numeric(4,1),            -- 적재량(톤)
  fuel_type text DEFAULT '경유',
  fuel_efficiency numeric(4,1) DEFAULT 8.0,  -- 연비(km/L)
  is_active boolean NOT NULL DEFAULT true,
  last_mileage numeric(10,1) DEFAULT 0, -- 최종 키로수 (자동 업데이트)
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_date ON dispatch_logs(dispatch_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_driver ON dispatch_logs(driver_id, dispatch_date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_vehicle ON dispatch_logs(vehicle_number, dispatch_date DESC);
