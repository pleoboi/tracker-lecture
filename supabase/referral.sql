-- Parrainage : trace qui a invité qui.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
--
-- Le "code" de parrainage est simplement l'identifiant du parrain (aucune
-- colonne de code séparée à générer/gérer) : le lien prend la forme
-- /register?ref=<uuid-du-parrain>.

alter table public.user_profiles
  add column if not exists referred_by uuid references auth.users(id);

create index if not exists user_profiles_referred_by_idx on public.user_profiles (referred_by);
