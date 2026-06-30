-- Migration v14 : table user_goals (séparée de app_settings Gemini)
-- À exécuter dans Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS user_goals (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reading_pages_year  integer,
  reading_books_year  integer,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_goals" ON user_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
