-- Migration v24 : colonnes manquantes Sprint Éclair (rattrapage de la v13)
--
-- Diagnostic : le code référence user_profiles.sprint_bonus_points depuis la
-- fonctionnalité "Sprint Éclair" (migration v13), mais cette colonne n'existe
-- pas en base — la migration v13 n'a apparemment jamais été exécutée.
-- Conséquence concrète : PostgREST fait échouer ENTIÈREMENT toute requête qui
-- sélectionne une colonne inexistante (pas juste ce champ) — ce qui cassait
-- silencieusement le classement du club ET l'avatar/nom affichés en haut de
-- "Mes marque-pages" (les deux dépendent d'un SELECT incluant cette colonne).
--
-- Idempotent (IF NOT EXISTS) : sans risque si une partie a déjà été appliquée.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sprint_eclair_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprint_bonus_points   INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_sprint_stats(uid UUID, bonus INTEGER DEFAULT 40)
RETURNS TABLE(sprint_count INTEGER, bonus_points INTEGER)
LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_profiles
  SET sprint_eclair_count = sprint_eclair_count + 1,
      sprint_bonus_points = sprint_bonus_points + bonus
  WHERE id = uid
  RETURNING sprint_eclair_count, sprint_bonus_points;
$$;
