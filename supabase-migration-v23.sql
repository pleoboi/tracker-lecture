-- Migration v23 : détection des doublons multilingues (Open Library Work ID)
--
-- Un ISBN identifie une ÉDITION précise (langue, éditeur, année) — les
-- éditions anglaise et française du même livre ont donc des ISBN totalement
-- différents, et leurs titres n'ont souvent aucune similarité textuelle.
-- Ni la comparaison ISBN ni la comparaison de titre (utilisées à l'import
-- Goodreads) ne peuvent donc détecter ces doublons.
--
-- Open Library regroupe toutes les éditions/traductions d'un même livre sous
-- un identifiant "œuvre" commun (ex: OL82563W). On le résout par ISBN et on
-- le met en cache ici pour comparer les livres entre eux indépendamment de
-- la langue, sans re-solliciter l'API à chaque import.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS openlibrary_work_id text;

CREATE INDEX IF NOT EXISTS idx_books_openlibrary_work_id
  ON books (openlibrary_work_id)
  WHERE openlibrary_work_id IS NOT NULL;
