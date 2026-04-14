-- Add source_mode to distinguish CC-mode annotations from Scribe-mode annotations.
ALTER TABLE user_annotations
  ADD COLUMN source_mode TEXT NOT NULL DEFAULT 'scribe'
    CHECK (source_mode IN ('cc', 'scribe'));

-- Back-fill existing rows: they were all created before Scribe mode had its own save path,
-- so 'scribe' is the safest default.
COMMENT ON COLUMN user_annotations.source_mode IS
  'The study mode that produced this annotation: ''cc'' (closed-caption word selection) or ''scribe'' (dictation highlight).';
