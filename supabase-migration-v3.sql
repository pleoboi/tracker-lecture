-- Migration V3 : Relectures multiples (book_read_sessions)
-- Coller dans : Supabase Dashboard > SQL Editor > New query

create table if not exists book_read_sessions (
  id           bigint generated always as identity primary key,
  book_id      bigint not null references books(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  date_started date,
  date_read    date,
  created_at   timestamptz default now()
);

alter table book_read_sessions enable row level security;

create policy "brs_select" on book_read_sessions
  for select using (auth.uid() = user_id);

create policy "brs_insert" on book_read_sessions
  for insert with check (auth.uid() = user_id);

create policy "brs_delete" on book_read_sessions
  for delete using (auth.uid() = user_id);

create index if not exists idx_brs_book on book_read_sessions(book_id);
create index if not exists idx_brs_user on book_read_sessions(user_id);
