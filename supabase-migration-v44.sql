-- v44 : messagerie privée entre membres (chat)
create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists direct_messages_pair_idx on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, read_at);

alter table public.direct_messages enable row level security;

drop policy if exists "dm_select_own" on public.direct_messages;
create policy "dm_select_own" on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "dm_insert_as_sender" on public.direct_messages;
create policy "dm_insert_as_sender" on public.direct_messages for insert
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

drop policy if exists "dm_mark_read" on public.direct_messages;
create policy "dm_mark_read" on public.direct_messages for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Temps réel (petite fenêtre qui s'ouvre à la réception)
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;

-- Reprise des anciens messages envoyés via les notifications
insert into public.direct_messages (sender_id, recipient_id, body, created_at)
select n.from_user_id, n.user_id, left(n.message, 1000), n.created_at
from public.notifications n
where n.type = 'direct_message' and n.from_user_id is not null and n.message is not null and n.from_user_id <> n.user_id
  and not exists (select 1 from public.direct_messages d where d.sender_id = n.from_user_id and d.recipient_id = n.user_id and d.created_at = n.created_at);
