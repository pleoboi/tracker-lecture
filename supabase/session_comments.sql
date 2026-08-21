-- Table des commentaires sur les sessions de lecture (notes / photos partagées aux abonnés).
-- À exécuter une fois dans l'éditeur SQL de Supabase.

create table if not exists public.session_comments (
  id          bigint generated always as identity primary key,
  log_id      bigint not null references public.reading_logs(id) on delete cascade,
  user_id     uuid   not null references auth.users(id) on delete cascade,
  content     text   not null check (char_length(content) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists session_comments_log_id_idx on public.session_comments (log_id);

alter table public.session_comments enable row level security;

-- Lecture : tout utilisateur authentifié peut lire les commentaires.
drop policy if exists "session_comments_select" on public.session_comments;
create policy "session_comments_select"
  on public.session_comments for select
  to authenticated
  using (true);

-- Écriture : on ne peut créer qu'un commentaire signé de soi-même.
drop policy if exists "session_comments_insert" on public.session_comments;
create policy "session_comments_insert"
  on public.session_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Suppression : l'auteur du commentaire OU le propriétaire de la session.
drop policy if exists "session_comments_delete" on public.session_comments;
create policy "session_comments_delete"
  on public.session_comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select rl.user_id from public.reading_logs rl where rl.id = log_id)
  );
