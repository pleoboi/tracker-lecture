-- Migration V3 : Relectures multiples (book_read_sessions)
-- À exécuter dans l'éditeur SQL de Supabase (https://supabase.com/dashboard)

-- 1. Créer la table des sessions de lecture
create table if not exists book_read_sessions (
  id          bigint generated always as identity primary key,
  book_id     bigint  not null references books(id) on delete cascade,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  date_started date,
  date_read    date,
  created_at   timestamptz default now()
);

-- 2. Row Level Security
alter table book_read_sessions enable row level security;

-- Chaque utilisateur ne peut lire/écrire que ses propres sessions
create policy "sessions_owner" on book_read_sessions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tous les membres authentifiés peuvent lire les sessions (profil public)
create policy "sessions_read_authenticated" on book_read_sessions
  for select
  to authenticated
  using (true);

-- 3. Index pour les requêtes fréquentes
create index if not exists idx_book_read_sessions_book_id on book_read_sessions(book_id);
create index if not exists idx_book_read_sessions_user_id on book_read_sessions(user_id);
