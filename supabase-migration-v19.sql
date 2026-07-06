-- Migration v19 : frise chronologique historique personnelle

CREATE TABLE IF NOT EXISTS user_timeline_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id     bigint REFERENCES books(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  start_year  integer NOT NULL,
  end_year    integer,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE user_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline_select" ON user_timeline_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "timeline_insert" ON user_timeline_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "timeline_update" ON user_timeline_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "timeline_delete" ON user_timeline_events FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_user ON user_timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_year ON user_timeline_events(user_id, start_year);
