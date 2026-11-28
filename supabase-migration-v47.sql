-- v47 : citations et notes de session privées (visibles seulement par leur auteur)

-- Citations : public par défaut (comme avant), ou privée
alter table public.book_quotes add column if not exists is_public boolean not null default true;

drop policy if exists "quotes_select" on public.book_quotes;
create policy "quotes_select" on public.book_quotes for select using (
  user_id = auth.uid()
  or (
    is_public
    and (
      not exists (select 1 from public.user_profiles p where p.id = book_quotes.user_id and p.is_private)
      or (
        exists (select 1 from public.user_follows a where a.follower_id = auth.uid() and a.following_id = book_quotes.user_id)
        and exists (select 1 from public.user_follows b where b.follower_id = book_quotes.user_id and b.following_id = auth.uid())
      )
    )
  )
);

-- Sessions de lecture : la note et la photo peuvent être gardées pour soi.
-- Les pages lues restent comptées partout (statistiques, activité, champion du jour).
alter table public.reading_logs add column if not exists session_private boolean not null default false;
