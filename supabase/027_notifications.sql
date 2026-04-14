-- 027_notifications.sql
-- 알림 시스템 + 웹훅 설정

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id text NOT NULL,
  recipient_name text,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',  -- 'info','warning','urgent','success'
  category text,  -- 'claim','approval','leave','inventory','maintenance','production'
  link text,  -- URL to navigate to (e.g. /claims, /approvals)
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id, is_read, created_at DESC);

-- 웹훅 설정 (카카오톡/이메일 등 외부 연동용)
CREATE TABLE IF NOT EXISTS webhook_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',  -- ['claim_new','approval_request','inventory_low']
  is_active boolean NOT NULL DEFAULT true,
  headers jsonb DEFAULT '{}',
  created_by text,
  created_at timestamptz DEFAULT now()
);
