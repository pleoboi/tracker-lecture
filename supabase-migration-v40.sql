-- Migration v40 : likes sur les activités manga du club
-- Un like = un membre aime une session manga (manga_logs) d'un autre membre.

create table if not exists public.manga_log_likes (
  id         uuid default gen_random_uuid() primary key,
  log_id     bigint not null references public.manga_logs(id) on delete cascade,
  liker_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (log_id, liker_id)
);

alter table public.manga_log_likes enable row level security;

drop policy if exists "manga_log_likes_select" on public.manga_log_likes;
create policy "manga_log_likes_select" on public.manga_log_likes for select using (true);

drop policy if exists "manga_log_likes_insert" on public.manga_log_likes;
create policy "manga_log_likes_insert" on public.manga_log_likes for insert with check (auth.uid() = liker_id);

drop policy if exists "manga_log_likes_delete" on public.manga_log_likes;
create policy "manga_log_likes_delete" on public.manga_log_likes for delete using (auth.uid() = liker_id);

create index if not exists idx_manga_log_likes_log on public.manga_log_likes(log_id);
