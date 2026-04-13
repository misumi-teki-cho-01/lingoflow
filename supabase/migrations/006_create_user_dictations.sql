CREATE TABLE user_dictations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id             UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  source_transcript_id UUID REFERENCES transcripts(id) ON DELETE SET NULL,
  language             TEXT NOT NULL DEFAULT 'en',
  content_html         TEXT,
  content_text         TEXT,
  segments             JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id, language)
);

CREATE INDEX idx_user_dictations_user_video
  ON user_dictations(user_id, video_id);

ALTER TABLE user_dictations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own dictations"
  ON user_dictations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
