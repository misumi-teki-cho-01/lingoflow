CREATE TABLE user_vocabulary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical_form  TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, canonical_form)
);

-- Establish the relationship after the table is created
ALTER TABLE user_annotations
  ADD CONSTRAINT fk_vocabulary
  FOREIGN KEY (vocabulary_id)
  REFERENCES user_vocabulary(id)
  ON DELETE SET NULL;
