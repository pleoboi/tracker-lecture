-- Migration v20 : snapshot de couverture + partage automatique des repères

-- Colonnes snapshot pour afficher les events sans rejoindre la table books
ALTER TABLE user_timeline_events ADD COLUMN IF NOT EXISTS book_title text;
ALTER TABLE user_timeline_events ADD COLUMN IF NOT EXISTS book_cover_url text;

-- Nouvelle politique SELECT : mes repères + repères des autres sur des livres que j'ai terminés
DROP POLICY IF EXISTS "timeline_select" ON user_timeline_events;
CREATE POLICY "timeline_select" ON user_timeline_events FOR SELECT USING (
  auth.uid() = user_id
  OR (
    book_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM books AS creator_book
      JOIN books AS reader_book
        ON LOWER(TRIM(reader_book.title)) = LOWER(TRIM(creator_book.title))
      WHERE creator_book.id = user_timeline_events.book_id
        AND reader_book.user_id = auth.uid()
        AND reader_book.status = 'completed'
    )
  )
);
