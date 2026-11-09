-- v39 : profil manga, catégories (démographie) et notes de chapitres.
--
-- 1. mangas.demographic : catégorie éditoriale de la série (shonen, seinen,
--    shojo, josei, kodomo, autre). Récupérée sur AniList (tag "Demographic"),
--    modifiable à la main. null = pas encore vérifiée.
-- 2. manga_logs.volume : tome qui contient les chapitres lus pendant la
--    session. Sert à fusionner dans l'activité du club les sessions du même
--    jour sur le même tome (remplie côté serveur après le log).
-- 3. manga_logs.rating : note (0,5 à 5) des chapitres lus pendant la session.
-- 4. user_profiles.favorite_manga_ids : les 4 mangas favoris du profil manga
--    (équivalent de favorite_book_ids côté livres).

alter table public.mangas add column if not exists demographic text;
alter table public.mangas drop constraint if exists mangas_demographic_check;
alter table public.mangas add constraint mangas_demographic_check
  check (demographic is null or demographic in ('shonen', 'seinen', 'shojo', 'josei', 'kodomo', 'autre'));

alter table public.manga_logs add column if not exists volume integer;
alter table public.manga_logs add column if not exists rating numeric(2, 1);
alter table public.manga_logs drop constraint if exists manga_logs_rating_check;
alter table public.manga_logs add constraint manga_logs_rating_check
  check (rating is null or (rating >= 0 and rating <= 5));

alter table public.user_profiles add column if not exists favorite_manga_ids bigint[];

-- Sessions « tomes » existantes : le tome est la valeur atteinte
update public.manga_logs set volume = end_value where unit = 'volume' and volume is null;
