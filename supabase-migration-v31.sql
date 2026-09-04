-- Migration v31 : rattache le livre du club à sa fiche existante sur Swena
--
-- Stocke l'Open Library work id du livre ajouté à un club (même principe que
-- books.openlibrary_work_id, v23) pour pouvoir, en cliquant sur le livre,
-- rediriger vers sa fiche /livre/[id] si elle existe déjà sur le site plutôt
-- que de dupliquer l'information.

ALTER TABLE book_club_books ADD COLUMN IF NOT EXISTS openlibrary_work_id text;
