-- Migration v9 : likes sur les reviews + table notifications
-- À exécuter dans Supabase > SQL Editor

-- Table des likes sur les reviews
CREATE TABLE IF NOT EXISTS review_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     integer NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liker_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, reviewer_user_id, liker_user_id)
);

-- Table notifications (likes reviews, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL,                  -- 'review_like', 'follow', ...
  from_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  book_id       integer REFERENCES books(id) ON DELETE SET NULL,
  book_title    text,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index performance
CREATE INDEX IF NOT EXISTS idx_review_likes_book_reviewer ON review_likes (book_id, reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type    ON notifications (user_id, type, created_at DESC);

-- RLS review_likes
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture review_likes pour membres authentifiés"
  ON review_likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Insertion own like"
  ON review_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = liker_user_id);

CREATE POLICY "Suppression own like"
  ON review_likes FOR DELETE
  TO authenticated USING (auth.uid() = liker_user_id);

-- RLS notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture propres notifications"
  ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Insertion notification (trigger applicatif)"
  ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Marquer comme lu"
  ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
