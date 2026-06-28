-- Migration v11 : table user_badges (gamification)
-- À exécuter dans Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Tous les membres authentifiés peuvent voir tous les badges (pour le leaderboard + "qui a ce badge")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'user_badges_select_all'
  ) THEN
    CREATE POLICY "user_badges_select_all"
    ON user_badges FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- L'API service role insère sans restriction (WITH CHECK true = toujours autorisé)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'user_badges_insert_service'
  ) THEN
    CREATE POLICY "user_badges_insert_service"
    ON user_badges FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- Un utilisateur peut supprimer ses propres badges (admin cleanup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'user_badges_delete_own'
  ) THEN
    CREATE POLICY "user_badges_delete_own"
    ON user_badges FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;
