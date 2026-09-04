-- Migration v28 : suivi de lecture des salons (compteur de messages non lus)
--
-- Une ligne par (salon, membre) qui retient la date du dernier message vu.
-- Mise à jour côté application : à l'ouverture d'un salon, et après l'envoi
-- d'un message (pour ne pas se compter soi-même comme "non lu").

CREATE TABLE IF NOT EXISTS book_club_room_reads (
  room_id       uuid NOT NULL REFERENCES book_club_rooms(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE book_club_room_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_club_room_reads_select" ON book_club_room_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "book_club_room_reads_insert" ON book_club_room_reads FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM book_club_rooms r
    JOIN book_club_members m ON m.club_id = r.club_id
    WHERE r.id = room_id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "book_club_room_reads_update" ON book_club_room_reads FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_book_club_room_reads_user ON book_club_room_reads(user_id);
