-- ============================================================================
-- 029_meeting_minutes.sql
-- 회의록 테이블 — 아침회의 다글로(txt) → HTML 변환본을 일자별로 보관
-- 열람 권한: manager 이상 (페이지/API에서 role 체크 — ceo/coo/manager)
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_date  DATE        NOT NULL,              -- 회의 일자
  title         TEXT        NOT NULL,              -- 예: "6월 11일 아침회의"
  content_html  TEXT        NOT NULL,              -- 변환된 HTML 본문
  summary       TEXT,                              -- 한 줄 요약 (목록 표시용, 선택)
  author        TEXT        NOT NULL DEFAULT 'COO 조상일',
  source        TEXT        NOT NULL DEFAULT 'daglo', -- 출처: daglo(다글로 txt) / manual
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 같은 날짜에 여러 회의가 있을 수 있으므로 UNIQUE 제약은 두지 않음
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_date
  ON meeting_minutes(meeting_date DESC);
