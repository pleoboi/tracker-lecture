-- Migration v27 : Book Clubs — phase 2 : salons de discussion + messagerie
--
-- Chaque club a un ou plusieurs salons ("rooms"). Le salon "Général" est créé
-- automatiquement à la création du club (côté application). Un salon de type
-- "chapter" (chapter_number renseigné) sera généré automatiquement par
-- chapitre du livre du club en phase 3 — la colonne existe déjà pour ça.

CREATE TABLE IF NOT EXISTS book_club_rooms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'chapter')),
  chapter_number  integer,
  name            text NOT NULL,
  icon            text NOT NULL DEFAULT '💬',
  position        integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_club_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES book_club_rooms(id) ON DELETE CASCADE,
  club_id     uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE book_club_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_club_messages ENABLE ROW LEVEL SECURITY;

-- Salons : visibles et gérables uniquement par les membres du club (création/
-- suppression réservées aux modérateurs pour éviter le désordre).
CREATE POLICY "book_club_rooms_select" ON book_club_rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_rooms.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_rooms_insert" ON book_club_rooms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_rooms.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_club_rooms_delete" ON book_club_rooms FOR DELETE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_rooms.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);

-- Messages : lus et écrits uniquement par les membres du club dont dépend le salon.
CREATE POLICY "book_club_messages_select" ON book_club_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_messages.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_messages_insert" ON book_club_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_messages.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_messages_delete" ON book_club_messages FOR DELETE USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_messages.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);

-- Active le temps réel sur les messages (idempotent — évite l'erreur si la
-- table est déjà membre de la publication).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'book_club_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE book_club_messages;
  END IF;
END $$;

-- Un nouveau message compte comme activité récente du club (tri "Découvrir").
CREATE OR REPLACE FUNCTION book_club_message_activity_trigger() RETURNS trigger AS $$
BEGIN
  UPDATE book_clubs SET last_activity_at = now() WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_book_club_message_activity ON book_club_messages;
CREATE TRIGGER trg_book_club_message_activity
AFTER INSERT ON book_club_messages
FOR EACH ROW EXECUTE FUNCTION book_club_message_activity_trigger();

CREATE INDEX IF NOT EXISTS idx_book_club_rooms_club    ON book_club_rooms(club_id, position);
CREATE INDEX IF NOT EXISTS idx_book_club_messages_room  ON book_club_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_book_club_messages_club  ON book_club_messages(club_id);
