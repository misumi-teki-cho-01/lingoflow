-- Persist CC-mode word positions so saved annotations can be reconstructed
-- without relying on client localStorage.
ALTER TABLE user_annotations
  ADD COLUMN start_word_index INTEGER,
  ADD COLUMN end_word_index INTEGER;

COMMENT ON COLUMN user_annotations.start_word_index IS
  '0-based index among non-whitespace tokens in a transcript segment for CC-mode selections.';

COMMENT ON COLUMN user_annotations.end_word_index IS
  'Inclusive 0-based end index among non-whitespace tokens in a transcript segment for CC-mode selections.';

CREATE INDEX idx_user_annotations_cc_position
  ON user_annotations(user_id, transcript_id, source_mode, segment_index, start_word_index, end_word_index);
