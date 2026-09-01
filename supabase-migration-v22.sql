-- Migration v22 : challenges à objectif individuel + points de récompense
--
-- Jusqu'ici un challenge était forcément un classement compétitif (target_value
-- toujours null, un seul "gagnant" possible). On ajoute un second mode : un
-- objectif partagé (ex. "Finir 5 livres avant la fin de l'année") où CHAQUE
-- participant qui atteint la cible reçoit des points, indépendamment des autres.
--
-- reward_points : points versés à un participant qui atteint target_value.
-- challenge_participants.completed_at : horodatage du moment où l'objectif a
--   été atteint (null tant que ce n'est pas le cas) — sert de garde pour ne
--   verser les points qu'une seule fois par participant.

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0;

ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Cumul de points gagnés via les challenges à objectif, affiché aux côtés des
-- points de badges sur le profil (même principe que sprint_bonus_points).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS challenge_bonus_points integer NOT NULL DEFAULT 0;
