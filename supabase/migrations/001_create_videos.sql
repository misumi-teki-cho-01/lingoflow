CREATE TABLE videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable for now; re-add NOT NULL when multi-user auth is enabled
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url           TEXT NOT NULL UNIQUE,
  source_type   TEXT NOT NULL CHECK (source_type IN ('youtube', 'bilibili')),
  video_ext_id  TEXT NOT NULL,
  title         TEXT,
  channel_name  TEXT,
  thumbnail_url TEXT,
  duration      INTEGER,
  language      TEXT DEFAULT 'en',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_ext_id ON videos(video_ext_id);

-- RLS: disabled for now (personal use, no multi-user auth)
-- Re-enable with proper policies when adding user management.
ALTER TABLE videos DISABLE ROW LEVEL SECURITY;
