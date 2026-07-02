-- Migration v16 : likes sur sessions + challenges ouverts sans objectif fixe

-- 1. Likes sur les sessions de lecture
CREATE TABLE IF NOT EXISTS session_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id     text NOT NULL,
  liker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (log_id, liker_id)
);
ALTER TABLE session_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_likes_select" ON session_likes FOR SELECT USING (true);
CREATE POLICY "session_likes_insert" ON session_likes FOR INSERT WITH CHECK (auth.uid() = liker_id);
CREATE POLICY "session_likes_delete" ON session_likes FOR DELETE USING (auth.uid() = liker_id);
CREATE INDEX IF NOT EXISTS idx_session_likes_log    ON session_likes(log_id);
CREATE INDEX IF NOT EXISTS idx_session_likes_liker  ON session_likes(liker_id);

-- 2. Challenges : target_value devient optionnel (classement pur sans objectif)
ALTER TABLE challenges ALTER COLUMN target_value DROP NOT NULL;
ALTER TABLE challenges ALTER COLUMN target_value SET DEFAULT NULL;

-- 3. Notifications : colonne challenge_id pour les invitations
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE;
