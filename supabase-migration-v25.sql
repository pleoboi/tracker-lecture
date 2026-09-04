-- Migration v25 : Book Clubs (Communauté) — phase 1 : socle
--
-- Première brique de la partie "Communauté" qui remplace "Journal" dans la
-- barre de navigation mobile. Cette migration couvre uniquement le socle :
-- création de clubs, adhésion (publique ou par invitation), rôles
-- (modérateur/membre, plusieurs modérateurs possibles par club). Le chat, le
-- livre du club, les chapitres et l'historique arriveront dans des
-- migrations suivantes (phases 2 et 3).

CREATE TABLE IF NOT EXISTS book_clubs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text,
  cover_url         text,
  theme_color       text NOT NULL DEFAULT 'violet',
  genres            text[] NOT NULL DEFAULT '{}',
  is_public         boolean NOT NULL DEFAULT true,
  created_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count      integer NOT NULL DEFAULT 0,
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_club_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('moderator', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS book_club_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  invited_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, invited_user_id)
);

-- Référence de club sur une notification (invitation à rejoindre), même
-- principe que challenge_id ajouté en v16.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES book_clubs(id) ON DELETE CASCADE;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_club_invites ENABLE ROW LEVEL SECURITY;

-- book_clubs : visible si public, si on est le créateur, ou si on en est membre.
CREATE POLICY "book_clubs_select" ON book_clubs FOR SELECT USING (
  is_public = true
  OR auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_clubs.id AND m.user_id = auth.uid())
);
CREATE POLICY "book_clubs_insert" ON book_clubs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "book_clubs_update" ON book_clubs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_clubs.id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_clubs_delete" ON book_clubs FOR DELETE USING (auth.uid() = created_by);

-- book_club_members : lecture ouverte (même principe que challenge_participants)
-- pour simplifier l'affichage des listes de membres sans sous-requêtes en cascade.
CREATE POLICY "book_club_members_select" ON book_club_members FOR SELECT USING (true);
CREATE POLICY "book_club_members_insert" ON book_club_members FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (
    auth.uid() = (SELECT created_by FROM book_clubs WHERE id = club_id)
    OR EXISTS (SELECT 1 FROM book_clubs c WHERE c.id = club_id AND c.is_public = true)
    OR EXISTS (
      SELECT 1 FROM book_club_invites i
      WHERE i.club_id = book_club_members.club_id AND i.invited_user_id = auth.uid() AND i.status IN ('pending', 'accepted')
    )
  )
);
CREATE POLICY "book_club_members_update" ON book_club_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_members.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
CREATE POLICY "book_club_members_delete" ON book_club_members FOR DELETE USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_members.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);

-- book_club_invites : lu par l'invité, l'invitant, ou un modérateur du club.
CREATE POLICY "book_club_invites_select" ON book_club_invites FOR SELECT USING (
  auth.uid() = invited_user_id
  OR auth.uid() = invited_by
  OR EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_invites.club_id AND m.user_id = auth.uid() AND m.role = 'moderator')
);
-- N'importe quel membre du club peut inviter (pas réservé aux modérateurs).
CREATE POLICY "book_club_invites_insert" ON book_club_invites FOR INSERT WITH CHECK (
  auth.uid() = invited_by
  AND EXISTS (SELECT 1 FROM book_club_members m WHERE m.club_id = book_club_invites.club_id AND m.user_id = auth.uid())
);
CREATE POLICY "book_club_invites_update" ON book_club_invites FOR UPDATE USING (auth.uid() = invited_user_id);
CREATE POLICY "book_club_invites_delete" ON book_club_invites FOR DELETE USING (
  auth.uid() = invited_user_id OR auth.uid() = invited_by
);

-- ── Compteur de membres + activité récente (tri de la liste "Découvrir") ──────
CREATE OR REPLACE FUNCTION book_club_member_count_trigger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_clubs SET member_count = member_count + 1, last_activity_at = now() WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_book_club_member_count ON book_club_members;
CREATE TRIGGER trg_book_club_member_count
AFTER INSERT OR DELETE ON book_club_members
FOR EACH ROW EXECUTE FUNCTION book_club_member_count_trigger();

-- ── Index ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_book_club_members_user    ON book_club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_book_club_members_club    ON book_club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_book_club_invites_invitee ON book_club_invites(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_book_clubs_public_activity ON book_clubs(is_public, last_activity_at DESC);
