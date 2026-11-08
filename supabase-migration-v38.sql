-- v38 : deux liens de lecture perso par série (tomes / chapitres).
-- Certains sites ou dossiers proposent les premiers volumes en tomes, puis la
-- suite en chapitres. Le bouton "Lire" prend le lien qui correspond à l'unité
-- de la dernière session (last_unit), mise à jour à chaque log.

alter table public.mangas add column if not exists read_url_volume text;
alter table public.mangas add column if not exists last_unit text;

-- Unité de la dernière session existante, pour les séries déjà loggées
update public.mangas m set last_unit = l.unit
from (
  select distinct on (manga_id) manga_id, unit
  from public.manga_logs
  order by manga_id, date desc, id desc
) l
where l.manga_id = m.id and m.last_unit is null;
