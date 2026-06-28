-- Migration v12 : QCM de validation de fin de lecture
-- À exécuter dans Supabase > SQL Editor

-- ── 1. Table des quiz (cache partagé entre tous les membres) ─────────────────
CREATE TABLE IF NOT EXISTS book_quizzes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_key      TEXT        NOT NULL UNIQUE,        -- isbn13 ou "book-{id}"
  title         TEXT,
  question      TEXT        NOT NULL,
  choices       JSONB       NOT NULL,               -- ["option A","B","C","D"]
  correct_index INTEGER     NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_quizzes_key ON book_quizzes(quiz_key);

ALTER TABLE book_quizzes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='book_quizzes' AND policyname='quiz_select_auth') THEN
    CREATE POLICY "quiz_select_auth" ON book_quizzes FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='book_quizzes' AND policyname='quiz_insert_service') THEN
    CREATE POLICY "quiz_insert_service" ON book_quizzes FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='book_quizzes' AND policyname='quiz_upsert_service') THEN
    CREATE POLICY "quiz_upsert_service" ON book_quizzes FOR UPDATE WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Table des tentatives réussies (un seul crédit par livre par membre) ───
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_key     TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, quiz_key)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quiz_attempts' AND policyname='qa_select_own') THEN
    CREATE POLICY "qa_select_own" ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quiz_attempts' AND policyname='qa_insert_service') THEN
    CREATE POLICY "qa_insert_service" ON quiz_attempts FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── 3. Colonnes cumulatives sur user_profiles ────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS quiz_pass_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_bonus_points INTEGER NOT NULL DEFAULT 0;

-- ── 4. Fonction atomique d'incrémentation (évite les race conditions) ────────
CREATE OR REPLACE FUNCTION increment_quiz_stats(uid UUID, bonus INTEGER DEFAULT 30)
RETURNS TABLE(pass_count INTEGER, bonus_points INTEGER)
LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE user_profiles
  SET quiz_pass_count   = quiz_pass_count   + 1,
      quiz_bonus_points = quiz_bonus_points + bonus
  WHERE id = uid
  RETURNING quiz_pass_count, quiz_bonus_points;
$$;
