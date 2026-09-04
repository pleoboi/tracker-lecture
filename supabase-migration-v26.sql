-- Migration v26 : suppression d'un club par n'importe quel modérateur
--
-- v25 limitait la suppression au seul créateur (auth.uid() = created_by).
-- Comme un club peut avoir plusieurs modérateurs (décision prise dès la
-- phase 1), n'importe quel modérateur doit pouvoir supprimer le club — pas
-- seulement celui qui l'a créé à l'origine.

DROP POLICY IF EXISTS "book_clubs_delete" ON book_clubs;
CREATE POLICY "book_clubs_delete" ON book_clubs FOR DELETE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_clubs.id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
