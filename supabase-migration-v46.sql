-- v46 : citations (profil + page du livre) et likes de citations
create table if not exists public.book_quotes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id bigint references public.books(id) on delete set null,
  book_key text not null,            -- titre normalisé : regroupe les citations d'un même livre entre comptes
  book_title text not null,
  book_author text,
  book_cover text,
  body text not null check (char_length(body) between 3 and 1200),
  page int check (page is null or page > 0),
  created_at timestamptz not null default now()
);
create index if not exists book_quotes_user_idx on public.book_quotes (user_id, created_at desc);
create index if not exists book_quotes_book_idx on public.book_quotes (book_key, created_at desc);

create table if not exists public.quote_likes (
  quote_id bigint not null references public.book_quotes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (quote_id, user_id)
);

alter table public.book_quotes enable row level security;
alter table public.quote_likes enable row level security;

-- Visible par tous, sauf les citations des comptes privés (visibles par leurs amis : abonnements réciproques)
drop policy if exists "quotes_select" on public.book_quotes;
create policy "quotes_select" on public.book_quotes for select using (
  user_id = auth.uid()
  or not exists (select 1 from public.user_profiles p where p.id = book_quotes.user_id and p.is_private)
  or (
    exists (select 1 from public.user_follows a where a.follower_id = auth.uid() and a.following_id = book_quotes.user_id)
    and exists (select 1 from public.user_follows b where b.follower_id = book_quotes.user_id and b.following_id = auth.uid())
  )
);

drop policy if exists "quotes_insert_own" on public.book_quotes;
create policy "quotes_insert_own" on public.book_quotes for insert with check (user_id = auth.uid());

drop policy if exists "quotes_delete_own" on public.book_quotes;
create policy "quotes_delete_own" on public.book_quotes for delete using (user_id = auth.uid());

drop policy if exists "quote_likes_select" on public.quote_likes;
create policy "quote_likes_select" on public.quote_likes for select using (
  exists (select 1 from public.book_quotes q where q.id = quote_likes.quote_id)
);

drop policy if exists "quote_likes_insert_own" on public.quote_likes;
create policy "quote_likes_insert_own" on public.quote_likes for insert with check (
  user_id = auth.uid() and exists (select 1 from public.book_quotes q where q.id = quote_id)
);

drop policy if exists "quote_likes_delete_own" on public.quote_likes;
create policy "quote_likes_delete_own" on public.quote_likes for delete using (user_id = auth.uid());
