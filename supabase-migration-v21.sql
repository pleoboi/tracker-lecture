-- Migration v21 : table des souscriptions push PWA

CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- L'utilisateur ne peut lire et gérer que ses propres souscriptions
CREATE POLICY "push_select_own" ON user_push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_insert_own" ON user_push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_delete_own" ON user_push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Le service role bypass RLS nativement — pas besoin de policy dédiée
