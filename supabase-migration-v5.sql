-- Migration V5 : ISBN13 sur les livres (pour déduplication Goodreads)
-- Coller dans : Supabase Dashboard > SQL Editor > New query

alter table public.books
  add column if not exists isbn13 text;

create index if not exists idx_books_isbn13 on public.books(isbn13)
  where isbn13 is not null;
