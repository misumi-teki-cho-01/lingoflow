CREATE TABLE user_progress (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id               UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  last_position          REAL DEFAULT 0,
  shadow_count           INTEGER DEFAULT 0,
  total_practice_seconds INTEGER DEFAULT 0,
  segments_practiced     JSONB DEFAULT '[]',
  completed              BOOLEAN DEFAULT FALSE,
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE INDEX idx_user_progress_user_video
  ON user_progress(user_id, video_id);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own progress"
  ON user_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
