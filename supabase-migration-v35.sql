-- v35 : couverture du tome correspondant à chaque session manga.
-- Remplie côté serveur après le log (MangaDex : tome lu, ou tome qui contient
-- le chapitre lu), affichée dans l'activité des amis à la place de la
-- couverture générique de la série.

alter table public.manga_logs add column if not exists cover_url text;
