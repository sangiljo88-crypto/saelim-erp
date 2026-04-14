-- 클레임 SLA 타임라인 추적
ALTER TABLE claims ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS compensation_type text;  -- '대체납품','환불','할인','없음'
ALTER TABLE claims ADD COLUMN IF NOT EXISTS compensation_amount numeric(12,0) DEFAULT 0;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS communication_log jsonb DEFAULT '[]';
-- communication_log: [{ date, type: 'phone'|'email'|'visit', content, by }]
