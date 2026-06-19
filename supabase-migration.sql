-- Migration à exécuter dans Supabase (SQL Editor) pour les nouvelles fonctionnalités.
-- Sans risque : ajoute seulement des colonnes optionnelles si elles n'existent pas.

alter table public.books add column if not exists genre text;
alter table public.books add column if not exists published_year integer;
alter table public.books add column if not exists summary text;
alter table public.books add column if not exists notes text;

-- Objectifs annuels (lecture + running), modifiables dans le Dashboard.
create table if not exists public.app_settings (
  id smallint primary key default 1,
  reading_pages_year integer default 25000,
  reading_books_year integer default 60,
  running_km_year integer default 1000,
  running_denivele_year integer default 12000
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Fonction RPC : met à jour les métadonnées éditoriales d'un livre (titre, auteur,
-- couverture, résumé, année) depuis n'importe quel utilisateur authentifié.
-- SECURITY DEFINER contourne le RLS sur UPDATE pour ces champs spécifiques.
create or replace function public.update_book_metadata(
  p_book_id  integer,
  p_title       text,
  p_author      text,
  p_cover_url   text,
  p_summary     text,
  p_year        integer
)
returns void
language plpgsql
security definer
as $$
begin
  update public.books set
    title          = p_title,
    author         = p_author,
    cover_url      = p_cover_url,
    summary        = p_summary,
    published_year = p_year
  where id = p_book_id;
end;
$$;

-- Jetons Strava (OAuth). Une seule ligne (app perso mono-utilisateur).
create table if not exists public.strava_tokens (
  id smallint primary key default 1,
  access_token text,
  refresh_token text,
  expires_at bigint,
  athlete_name text
);
