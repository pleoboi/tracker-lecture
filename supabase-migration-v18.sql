-- Migration v18 : listes thématiques

CREATE TABLE IF NOT EXISTS book_lists (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  is_public   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE book_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lists_select" ON book_lists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "lists_insert" ON book_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lists_update" ON book_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lists_delete" ON book_lists FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user ON book_lists(user_id);

CREATE TABLE IF NOT EXISTS book_list_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id       uuid NOT NULL REFERENCES book_lists(id) ON DELETE CASCADE,
  book_title    text NOT NULL,
  book_author   text NOT NULL,
  book_cover_url text,
  position      integer DEFAULT 0,
  note          text,
  added_at      timestamptz DEFAULT now()
);
ALTER TABLE book_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list_items_select" ON book_list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM book_lists bl WHERE bl.id = list_id AND (bl.is_public = true OR bl.user_id = auth.uid()))
);
CREATE POLICY "list_items_insert" ON book_list_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM book_lists bl WHERE bl.id = list_id AND bl.user_id = auth.uid())
);
CREATE POLICY "list_items_delete" ON book_list_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM book_lists bl WHERE bl.id = list_id AND bl.user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON book_list_items(list_id);
