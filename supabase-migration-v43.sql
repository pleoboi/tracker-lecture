-- v43 : compte privé (le champion du jour ne se compare qu'aux amis)
alter table public.user_profiles add column if not exists is_private boolean not null default false;
