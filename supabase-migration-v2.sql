-- ============================================================
-- MIGRATION V2 — Tracker Lecture Multi-utilisateurs
-- ============================================================
-- ORDRE D'EXÉCUTION :
--
--   ÉTAPE 1 (maintenant) : Exécute la PARTIE A dans l'éditeur SQL Supabase.
--                          Elle modifie le schéma sans casser l'app actuelle.
--
--   ÉTAPE 2 (après la Phase 3 — auth) : Crée ton compte via /register.
--
--   ÉTAPE 3 (après l'étape 2) : Exécute la PARTIE B pour rattacher tes données
--                               existantes à ton nouveau compte.
--
--   ÉTAPE 4 (après l'étape 3) : Exécute la PARTIE C pour activer la sécurité (RLS).
-- ============================================================


-- ============================================================
-- PARTIE A — SCHÉMA (à exécuter maintenant)
-- ============================================================

-- 1. Table des profils utilisateurs
--    Liée à auth.users, peuplée automatiquement via trigger à l'inscription.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ajout de user_id sur les tables existantes (nullable d'abord)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reading_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Mise à jour d'app_settings :
--    - Objectifs de lecture rendus nullable (optionnels par utilisateur)
--    - Suppression des colonnes running hors scope V2
ALTER TABLE public.app_settings
  ALTER COLUMN reading_pages_year DROP NOT NULL,
  ALTER COLUMN reading_books_year DROP NOT NULL;

ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS running_km_year,
  DROP COLUMN IF EXISTS running_denivele_year;

-- Réinitialise les objectifs existants à NULL (chaque user définira les siens)
UPDATE public.app_settings SET reading_pages_year = NULL, reading_books_year = NULL;

-- 4. Trigger : crée automatiquement un profil à chaque nouvelle inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PARTIE B — ASSIGNATION DES DONNÉES EXISTANTES
-- (à exécuter après avoir créé ton compte via /register)
-- ============================================================

-- Ce bloc détecte automatiquement le premier compte créé
-- et lui rattache toutes les données sans user_id.

DO $$
DECLARE
  first_user UUID;
BEGIN
  SELECT id INTO first_user
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user IS NULL THEN
    RAISE EXCEPTION 'Aucun utilisateur trouvé. Crée d''abord ton compte via /register.';
  END IF;

  UPDATE public.books       SET user_id = first_user WHERE user_id IS NULL;
  UPDATE public.reading_logs SET user_id = first_user WHERE user_id IS NULL;
  UPDATE public.app_settings SET user_id = first_user WHERE user_id IS NULL;

  RAISE NOTICE 'Données existantes assignées au compte %', first_user;
END $$;

-- Rend user_id obligatoire une fois la migration faite
ALTER TABLE public.books        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.reading_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.app_settings ALTER COLUMN user_id SET NOT NULL;

-- Contrainte unique sur app_settings (1 ligne par utilisateur — nécessaire pour upsert)
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_user_id_unique UNIQUE (user_id);


-- ============================================================
-- PARTIE C — SÉCURITÉ ROW LEVEL SECURITY
-- (à exécuter après la Partie B)
-- ============================================================

-- Active RLS sur toutes les tables
ALTER TABLE public.books         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ---- books ----
-- Chaque utilisateur peut tout faire sur ses propres livres
DROP POLICY IF EXISTS "books_own_all"     ON public.books;
CREATE POLICY "books_own_all" ON public.books
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- Tout utilisateur authentifié peut lire les livres des autres (profils publics)
DROP POLICY IF EXISTS "books_read_others" ON public.books;
CREATE POLICY "books_read_others" ON public.books
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---- reading_logs ----
DROP POLICY IF EXISTS "logs_own_all"     ON public.reading_logs;
CREATE POLICY "logs_own_all" ON public.reading_logs
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_read_others" ON public.reading_logs;
CREATE POLICY "logs_read_others" ON public.reading_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---- app_settings ----
-- Paramètres strictement privés (aucun accès inter-utilisateurs)
DROP POLICY IF EXISTS "settings_own_all" ON public.app_settings;
CREATE POLICY "settings_own_all" ON public.app_settings
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- ---- user_profiles ----
-- Lecture publique (pour la page Membres), écriture uniquement sur son propre profil
DROP POLICY IF EXISTS "profiles_read_all"  ON public.user_profiles;
CREATE POLICY "profiles_read_all" ON public.user_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_own_write" ON public.user_profiles;
CREATE POLICY "profiles_own_write" ON public.user_profiles
  FOR ALL
  USING     (auth.uid() = id)
  WITH CHECK(auth.uid() = id);
