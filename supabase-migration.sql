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

-- Jetons Strava (OAuth). Une seule ligne (app perso mono-utilisateur).
create table if not exists public.strava_tokens (
  id smallint primary key default 1,
  access_token text,
  refresh_token text,
  expires_at bigint,
  athlete_name text
);
