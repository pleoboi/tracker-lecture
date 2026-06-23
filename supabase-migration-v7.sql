-- Migration v7 — Protection des données : Row Level Security (RLS)
-- À exécuter dans Supabase > SQL Editor
--
-- Principe :
--   • Seuls les utilisateurs authentifiés peuvent lire les données
--   • Chaque utilisateur ne peut modifier/supprimer que ses propres données
--   • Les fonctions RPC existantes (SECURITY DEFINER) ne sont pas affectées

-- ─── books ────────────────────────────────────────────────────────────────────
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur connecté peut lire tous les livres (nécessaire pour Découverte)
CREATE POLICY "books_select_authenticated"
  ON public.books FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insertion : uniquement pour son propre compte
CREATE POLICY "books_insert_own"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour : uniquement ses propres livres
CREATE POLICY "books_update_own"
  ON public.books FOR UPDATE
  USING (auth.uid() = user_id);

-- Suppression : uniquement ses propres livres
CREATE POLICY "books_delete_own"
  ON public.books FOR DELETE
  USING (auth.uid() = user_id);


-- ─── reading_logs ─────────────────────────────────────────────────────────────
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur connecté peut lire tous les logs (nécessaire pour Champion du jour)
CREATE POLICY "reading_logs_select_authenticated"
  ON public.reading_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reading_logs_insert_own"
  ON public.reading_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reading_logs_update_own"
  ON public.reading_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "reading_logs_delete_own"
  ON public.reading_logs FOR DELETE
  USING (auth.uid() = user_id);


-- ─── user_profiles ────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur connecté peut lire les profils (nécessaire pour Découverte / Membres)
CREATE POLICY "user_profiles_select_authenticated"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);


-- ─── user_follows ─────────────────────────────────────────────────────────────
-- (probablement déjà activé, idempotent)
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_follows_select_authenticated"
  ON public.user_follows FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_follows_insert_own"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "user_follows_delete_own"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ─── book_read_sessions (si elle existe) ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'book_read_sessions'
  ) THEN
    EXECUTE 'ALTER TABLE public.book_read_sessions ENABLE ROW LEVEL SECURITY';

    EXECUTE $policy$
      CREATE POLICY "sessions_select_authenticated"
        ON public.book_read_sessions FOR SELECT
        USING (auth.role() = 'authenticated')
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "sessions_insert_own"
        ON public.book_read_sessions FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "sessions_delete_own"
        ON public.book_read_sessions FOR DELETE
        USING (auth.uid() = user_id)
    $policy$;
  END IF;
END;
$$;
