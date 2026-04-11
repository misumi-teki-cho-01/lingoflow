CREATE TABLE ai_explanations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id   UUID NOT NULL REFERENCES user_annotations(id) ON DELETE CASCADE,
  selected_text   TEXT NOT NULL,
  explanation     JSONB NOT NULL,
  model           TEXT NOT NULL,
  prompt_tokens   INTEGER,
  response_tokens INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own explanations"
  ON ai_explanations FOR SELECT
  USING (annotation_id IN (
    SELECT id FROM user_annotations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert explanations for own annotations"
  ON ai_explanations FOR INSERT
  WITH CHECK (annotation_id IN (
    SELECT id FROM user_annotations WHERE user_id = auth.uid()
  ));
