CREATE TABLE user_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript_id   UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  vocabulary_id   UUID, -- Will reference user_vocabulary(id) once created
  selected_text   TEXT NOT NULL,
  segment_index   INTEGER,
  start_char      INTEGER,
  end_char        INTEGER,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'bookmark', 'note')),
  note_text       TEXT,
  color           TEXT DEFAULT 'yellow',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_annotations_user_transcript
  ON user_annotations(user_id, transcript_id);

ALTER TABLE user_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own annotations"
  ON user_annotations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
