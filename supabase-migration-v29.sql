-- Migration v29 : Book Clubs — phase 3 : livre du club, chapitres, milestones
--
-- book_club_books garde un historique : une ligne par livre lu par le club
-- (is_current = true pour le livre en cours, une seule à la fois par club —
-- imposé par l'index unique partiel ci-dessous). Passer au livre suivant
-- termine l'ancien (finished_at renseigné, is_current = false) sans le
-- supprimer : ça sert de socle pour l'historique du club.
--
-- Fixer le nombre de chapitres génère côté application un salon par chapitre
-- (book_club_rooms.type = 'chapter'), déjà prévu depuis la phase 2.

CREATE TABLE IF NOT EXISTS book_club_books (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  title           text NOT NULL,
  author          text,
  cover_url       text,
  isbn            text,
  total_chapters  integer,
  is_current      boolean NOT NULL DEFAULT true,
  added_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

-- Un seul livre "en cours" par club à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_club_books_one_current
  ON book_club_books(club_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS book_club_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  club_book_id    uuid NOT NULL REFERENCES book_club_books(id) ON DELETE CASCADE,
  chapter_number  integer NOT NULL,
  target_date     date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE book_club_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_club_milestones ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux membres du club ; gestion (ajout/mise à jour/suppression)
-- réservée aux modérateurs, comme pour les salons.
CREATE POLICY "book_club_books_select" ON book_club_books FOR SELECT USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_books.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_books_insert" ON book_club_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_books.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_club_books_update" ON book_club_books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_books.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_club_books_delete" ON book_club_books FOR DELETE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_books.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);

CREATE POLICY "book_club_milestones_select" ON book_club_milestones FOR SELECT USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_milestones.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_milestones_insert" ON book_club_milestones FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_milestones.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_club_milestones_delete" ON book_club_milestones FOR DELETE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_milestones.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);

-- Ajouter/terminer un livre compte comme activité récente du club.
CREATE OR REPLACE FUNCTION book_club_book_activity_trigger() RETURNS trigger AS $$
BEGIN
  UPDATE book_clubs SET last_activity_at = now() WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_book_club_book_activity ON book_club_books;
CREATE TRIGGER trg_book_club_book_activity
AFTER INSERT OR UPDATE ON book_club_books
FOR EACH ROW EXECUTE FUNCTION book_club_book_activity_trigger();

CREATE INDEX IF NOT EXISTS idx_book_club_books_club       ON book_club_books(club_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_club_milestones_book   ON book_club_milestones(club_book_id, chapter_number);
