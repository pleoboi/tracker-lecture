-- Migration v42 : quiz de lecture par paliers (25 / 50 / 75 / 100 %)
-- Les questions sont stockées par livre (clé = titre normalisé) et ne sont lues que
-- par le serveur (RLS activé sans policy) pour ne pas exposer les réponses.

create table if not exists public.book_quiz (
  id          bigint generated always as identity primary key,
  book_key    text not null,
  book_title  text not null,
  tier        smallint not null check (tier in (25, 50, 75, 100)),
  question    text not null,
  options     jsonb not null,
  answer      smallint not null check (answer between 0 and 3),
  explanation text not null,
  created_at  timestamptz default now(),
  unique (book_key, tier)
);
alter table public.book_quiz enable row level security;

create table if not exists public.book_quiz_answers (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     bigint not null references public.books(id) on delete cascade,
  tier        smallint not null,
  correct     boolean not null,
  xp          integer not null default 0,
  answered_at timestamptz default now(),
  unique (user_id, book_id, tier)
);
alter table public.book_quiz_answers enable row level security;
drop policy if exists "book_quiz_answers_select_own" on public.book_quiz_answers;
create policy "book_quiz_answers_select_own" on public.book_quiz_answers for select using (auth.uid() = user_id);

alter table public.user_profiles add column if not exists quiz_bonus_points integer not null default 0;
