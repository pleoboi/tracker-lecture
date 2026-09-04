-- Migration v30 : fiche du livre de club (genre, année, résumé)
--
-- Complète book_club_books avec les métadonnées déjà renvoyées par la
-- recherche (Open Library / Google Books) mais pas encore stockées, pour
-- pouvoir afficher une fiche livre correcte en cliquant dessus.

ALTER TABLE book_club_books ADD COLUMN IF NOT EXISTS genre text;
ALTER TABLE book_club_books ADD COLUMN IF NOT EXISTS published_year integer;
ALTER TABLE book_club_books ADD COLUMN IF NOT EXISTS summary text;
