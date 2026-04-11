CREATE TABLE transcripts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language      TEXT NOT NULL DEFAULT 'en',
  segments      JSONB NOT NULL DEFAULT '[]',
  raw_response  JSONB,
  -- 'subtitle-raw' | 'subtitle-enhanced' | 'audio-transcribed'
  quality       TEXT CHECK (quality IN ('subtitle-raw', 'subtitle-enhanced', 'audio-transcribed')),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, language)
);

CREATE INDEX idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);

-- RLS: disabled for now (personal use, no multi-user auth)
-- Re-enable with proper policies when adding user management.
ALTER TABLE transcripts DISABLE ROW LEVEL SECURITY;
