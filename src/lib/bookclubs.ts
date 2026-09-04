// Types et constantes partagées pour la partie "Communauté" (book clubs).
// Phase 1 : socle uniquement (club, membres, invitations). Le chat, le livre
// du club, les chapitres/milestones et l'historique arriveront ensuite.

export interface BookClub {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  theme_color: string;
  genres: string[];
  is_public: boolean;
  created_by: string;
  member_count: number;
  last_activity_at: string;
  created_at: string;
}

export interface BookClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: "moderator" | "member";
  joined_at: string;
}

export interface BookClubInvite {
  id: string;
  club_id: string;
  invited_user_id: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface BookClubRoom {
  id: string;
  club_id: string;
  type: "general" | "chapter";
  chapter_number: number | null;
  name: string;
  icon: string;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface BookClubMessage {
  id: string;
  room_id: string;
  club_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface BookClubBook {
  id: string;
  club_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  openlibrary_work_id: string | null;
  genre: string | null;
  published_year: number | null;
  summary: string | null;
  total_chapters: number | null;
  is_current: boolean;
  added_by: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface BookClubMilestone {
  id: string;
  club_id: string;
  club_book_id: string;
  chapter_number: number;
  target_date: string;
  created_at: string;
}

/** Salon créé automatiquement à la création d'un club. */
export const DEFAULT_ROOM = { name: "Général", icon: "chat" };

/** Palette de thèmes d'un club — des clés stables (pas des hex) pour que la
 * couleur reste cohérente en thème clair/sombre via les tokens CSS existants. */
export const CLUB_THEMES = [
  { key: "violet", label: "Violet", var: "var(--color-violet)" },
  { key: "rose", label: "Rose", var: "var(--color-rose)" },
  { key: "gold", label: "Or", var: "var(--color-gold)" },
  { key: "sage", label: "Sauge", var: "var(--color-sage)" },
  { key: "danger", label: "Corail", var: "var(--color-danger)" },
  { key: "ink", label: "Encre", var: "var(--color-ink)" },
] as const;

export type ClubThemeKey = (typeof CLUB_THEMES)[number]["key"];

export function clubThemeVar(key: string): string {
  return CLUB_THEMES.find((t) => t.key === key)?.var ?? CLUB_THEMES[0].var;
}
