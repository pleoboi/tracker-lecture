-- Migration v17 : recommandations de livres entre membres

-- 1. Colonne message sur notifications (pour stocker le message de reco)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text;

-- 2. Table book_recommendations
CREATE TABLE IF NOT EXISTS book_recommendations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title   text NOT NULL,
  book_author  text NOT NULL,
  book_cover   text,
  message      text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE book_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reco_select" ON book_recommendations FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);
CREATE POLICY "reco_insert" ON book_recommendations FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "reco_delete" ON book_recommendations FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE INDEX IF NOT EXISTS idx_reco_to   ON book_recommendations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_reco_from ON book_recommendations(from_user_id);
