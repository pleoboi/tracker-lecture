-- Migration V4 : Onboarding flag
-- Coller dans : Supabase Dashboard > SQL Editor > New query

alter table user_profiles
  add column if not exists has_seen_onboarding boolean default false;
