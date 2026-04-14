-- 브리핑 읽음 확인 테이블
CREATE TABLE IF NOT EXISTS briefing_reads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID        NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  user_id     TEXT        NOT NULL,
  user_name   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (briefing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_reads_briefing_id
  ON briefing_reads(briefing_id);

-- 브리핑 댓글 테이블
CREATE TABLE IF NOT EXISTS briefing_comments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID        NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  user_id     TEXT        NOT NULL,
  user_name   TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_comments_briefing_id
  ON briefing_comments(briefing_id);
