-- Migration v15 : historique des notes + système de challenges

-- Historique des évaluations par session (évolution de la note au fil des pages)
CREATE TABLE IF NOT EXISTS book_ratings_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id integer NOT NULL,
  rating numeric(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  page_at integer,
  logged_at timestamptz DEFAULT now()
);
ALTER TABLE book_ratings_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_ratings_history" ON book_ratings_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Challenges (défis de lecture)
CREATE TABLE IF NOT EXISTS challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('pages', 'books', 'sessions')),
  target_value integer NOT NULL CHECK (target_value > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_select"  ON challenges FOR SELECT  USING (true);
CREATE POLICY "challenges_insert"  ON challenges FOR INSERT  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "challenges_delete"  ON challenges FOR DELETE  USING (auth.uid() = creator_id);

-- Participants aux challenges
CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select"  ON challenge_participants FOR SELECT  USING (true);
CREATE POLICY "cp_insert"  ON challenge_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_id FROM challenges WHERE id = challenge_id)
  );
CREATE POLICY "cp_update"  ON challenge_participants
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cp_delete"  ON challenge_participants
  FOR DELETE USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_id FROM challenges WHERE id = challenge_id)
  );

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_book_ratings_history_book ON book_ratings_history(user_id, book_id);
