-- v45 : le destinataire ne peut modifier que read_at (pas le texte)
revoke update on public.direct_messages from authenticated, anon;
grant update (read_at) on public.direct_messages to authenticated;
