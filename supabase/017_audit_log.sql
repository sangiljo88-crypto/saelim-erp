-- 감사 로그 테이블
-- 품목, 재고, 비용승인, 매입, 결제, 급여 등 주요 변경 사항을 추적

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  changes jsonb,
  performed_by text NOT NULL,
  performed_by_name text NOT NULL,
  dept text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
