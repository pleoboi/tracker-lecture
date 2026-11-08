-- v36 : descriptif des séries manga (Wikipédia FR en priorité, AniList en repli),
-- même principe que le résumé des livres.

alter table public.mangas add column if not exists summary text;
alter table public.mangas add column if not exists summary_source text; -- "Wikipédia", "AniList (anglais)", "Perso"
alter table public.mangas add column if not exists summary_url text;
