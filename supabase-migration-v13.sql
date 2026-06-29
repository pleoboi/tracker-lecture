-- Migration v13 : Sprint Éclair (badge cumulatif) + Défi mensuel livres
-- À exécuter dans Supabase > SQL Editor

-- ── Colonnes cumulatives Sprint Éclair sur user_profiles ─────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sprint_eclair_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprint_bonus_points   INTEGER NOT NULL DEFAULT 0;

-- ── Fonction atomique Sprint Éclair ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_sprint_stats(uid UUID, bonus INTEGER DEFAULT 40)
RETURNS TABLE(sprint_count INTEGER, bonus_points INTEGER)
LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_profiles
  SET sprint_eclair_count = sprint_eclair_count + 1,
      sprint_bonus_points = sprint_bonus_points + bonus
  WHERE id = uid
  RETURNING sprint_eclair_count, sprint_bonus_points;
$$;
