-- Préférences de notification par utilisateur.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
--
-- Format : { "likes": true, "comments": false, ... }
-- Une clé absente vaut « activée », donc {} = tout activé.

alter table public.user_profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
