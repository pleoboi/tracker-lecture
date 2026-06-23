-- Migration V6 : Système de Follow (abonnés / abonnements)
-- À coller dans : Supabase Dashboard > SQL Editor > New query

create table if not exists public.user_follows (
  id           bigint generated always as identity primary key,
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  constraint user_follows_unique unique (follower_id, following_id)
);

alter table public.user_follows enable row level security;

-- Tous les membres authentifiés peuvent voir les abonnements
create policy "follows_select" on public.user_follows
  for select using (auth.role() = 'authenticated');

-- On ne peut s'abonner qu'en son propre nom
create policy "follows_insert" on public.user_follows
  for insert with check (auth.uid() = follower_id);

-- On ne peut supprimer que ses propres abonnements
create policy "follows_delete" on public.user_follows
  for delete using (auth.uid() = follower_id);

create index if not exists idx_follows_follower  on public.user_follows(follower_id);
create index if not exists idx_follows_following on public.user_follows(following_id);
