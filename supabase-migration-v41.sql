-- Dernier tome sorti (détecté automatiquement) et valeurs corrigées à la main
-- pour le dernier chapitre / tome sorti d'une série en cours.
alter table public.mangas add column if not exists latest_volume integer;
alter table public.mangas add column if not exists manual_latest_chapter integer;
alter table public.mangas add column if not exists manual_latest_volume integer;
