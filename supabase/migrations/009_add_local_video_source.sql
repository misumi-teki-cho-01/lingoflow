ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_source_type_check;

ALTER TABLE videos
  ADD CONSTRAINT videos_source_type_check
  CHECK (source_type IN ('youtube', 'bilibili', 'local'));
