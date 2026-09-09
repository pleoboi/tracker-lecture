-- v32 : préférence d'affichage de la progression (pages ou pourcentage).
-- Purement présentationnel : `books.progress` reste toujours stocké en pages
-- (comme avant) pour que les stats, l'activité des amis, le Wrapped etc.
-- continuent de fonctionner sans aucun changement. Seul l'input affiché à
-- l'utilisateur (au moment d'ajouter un livre ou de noter une session)
-- change de forme selon cette préférence.

alter table public.books
  add column if not exists progress_mode text not null default 'pages';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_progress_mode_check'
  ) then
    alter table public.books
      add constraint books_progress_mode_check
      check (progress_mode in ('pages', 'percent'));
  end if;
end $$;
