/** Types de notifications que l'utilisateur peut activer ou couper individuellement. */
export type NotifType =
  | "likes"
  | "comments"
  | "follows"
  | "recommendations"
  | "challenges"
  | "clubs"
  | "messages"
  | "badges"
  | "reminders"
  | "sprint";

export type NotifPrefs = Partial<Record<NotifType, boolean>>;

/** Tout est activé par défaut : une préférence absente vaut « activée ». */
export function isNotifEnabled(prefs: NotifPrefs | null | undefined, type: NotifType): boolean {
  return prefs?.[type] !== false;
}

export const NOTIF_GROUPS: {
  title: string;
  items: { type: NotifType; label: string; desc: string }[];
}[] = [
  {
    title: "Interactions",
    items: [
      { type: "likes", label: "J'aime", desc: "Quand un membre aime ta note ou ton avis" },
      { type: "comments", label: "Commentaires", desc: "Quand un membre commente ta note de lecture" },
      { type: "follows", label: "Nouveaux abonnés", desc: "Quand quelqu'un s'abonne à toi" },
      { type: "recommendations", label: "Recommandations", desc: "Quand un ami te conseille un livre" },
      { type: "challenges", label: "Invitations aux défis", desc: "Quand on t'invite à rejoindre un défi" },
      { type: "clubs", label: "Invitations aux book clubs", desc: "Quand on t'invite à rejoindre un book club" },
      { type: "messages", label: "Messages directs", desc: "Quand un ami t'envoie un message personnel" },
    ],
  },
  {
    title: "Ta progression",
    items: [
      { type: "badges", label: "Badges", desc: "Quand tu débloques un nouveau badge" },
    ],
  },
  {
    title: "Rappels",
    items: [
      { type: "reminders", label: "Rappels quotidiens", desc: "Le matin pour noter ta veille, le soir pour ton bilan" },
      { type: "sprint", label: "Sprint du soir", desc: "Le rappel de fin de journée pour tenir ta série" },
    ],
  },
];
