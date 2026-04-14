-- 공유 일정
CREATE TABLE IF NOT EXISTS schedule_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date date NOT NULL,
  end_date date,
  title text NOT NULL,
  description text,
  category text DEFAULT '일정',  -- '생산계획'|'품목계획'|'납품일정'|'회의'|'기타'|'일정'
  dept text,                     -- null = 전사 공유
  all_day boolean DEFAULT true,
  created_by text NOT NULL,
  created_by_name text NOT NULL,
  updated_by text,
  updated_by_name text,
  updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE schedule_events DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_schedule_events_date ON schedule_events(event_date);

-- 휴가 신청
CREATE TABLE IF NOT EXISTS vacation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id text NOT NULL,
  requester_name text NOT NULL,
  dept text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer DEFAULT 1,
  reason text,
  status text DEFAULT 'pending',  -- 'pending'|'approved'|'rejected'
  approved_by text,
  approved_by_name text,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vacation_requests DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_vacation_requests_date ON vacation_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
