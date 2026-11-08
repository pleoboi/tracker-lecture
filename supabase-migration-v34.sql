-- v34 : sorties de chapitres pour les séries en cours de parution.
--
-- Pour One Piece & co, il n'y a pas de "total" : on suit à la place le
-- dernier chapitre sorti (récupéré sur MangaDex, côté serveur) pour afficher
-- "à jour" / "X chapitres de retard" et signaler les nouveautés sur l'accueil
-- manga. Ces infos décrivent l'œuvre, pas la lecture du membre : elles sont
-- recopiées sur chaque ligne qui partage le même mangadex_id.

alter table public.mangas add column if not exists mangadex_id text;
alter table public.mangas add column if not exists latest_chapter numeric;
alter table public.mangas add column if not exists latest_chapter_title text;
alter table public.mangas add column if not exists latest_chapter_at timestamptz;
alter table public.mangas add column if not exists latest_chapter_url text;
alter table public.mangas add column if not exists latest_checked_at timestamptz;
-- Lien de lecture choisi par le membre (MANGA Plus, son site habituel...)
alter table public.mangas add column if not exists read_url text;

create index if not exists idx_mangas_mangadex on public.mangas (mangadex_id);
