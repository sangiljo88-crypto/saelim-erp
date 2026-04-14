-- head_work_logs 테이블에 head_worked 컬럼 추가
ALTER TABLE head_work_logs ADD COLUMN IF NOT EXISTS head_worked integer DEFAULT 0;
